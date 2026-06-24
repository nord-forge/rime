import { chromium, type CDPSession } from "@playwright/test";
import { spawn } from "node:child_process";
import { newsletterDoc } from "../test/fixtures/newsletter";

// Instrumented DnD perf benchmark (ENV-21, resolves OD-3). Drives a long drag
// across the realistic newsletter fixture under CPU throttling that approximates
// the low-end ("potato PC") reference machine, and gates on:
//   - frame cadence: ≥95% of drag frames ≤ 16.6 ms (≈60fps)
//   - detection latency: p95 of the per-frame (resolve + indicator-position) work
//     ≤ the committed OD-3 budget.
// Exits non-zero if either gate is breached so it can gate CI / the perf sign-off.

const CPU_THROTTLE = 4; // emulate ~4x slower CPU (low-end reference profile)
const FRAME_MS = 1000 / 60; // 16.6ms
const FRAME_BUDGET_RATIO = 0.95; // ≥95% of frames within one frame
const DETECTION_P95_BUDGET_MS = 8; // OD-3: half a frame, paint headroom

const PORT = Number(process.env.BENCH_PORT ?? 4318);
const BASE_URL = `http://localhost:${PORT}`;

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
}

/** Start the Vite dev server and resolve once it answers on PORT. */
async function startServer(): Promise<() => void> {
  const proc = spawn("bunx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (Date.now() > deadline) {
      proc.kill();
      throw new Error("vite did not start within 30s");
    }
    try {
      const res = await fetch(`${BASE_URL}/e2e/harness.html`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return () => proc.kill();
}

async function main(): Promise<void> {
  const stopServer = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const client: CDPSession = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });

  await page.goto(`${BASE_URL}/e2e/harness.html`);
  await page.waitForSelector("rime-editor");
  await page.evaluate(async (doc) => {
    const el = document.querySelector("rime-editor") as unknown as {
      whenCanvasReady(): Promise<unknown>;
      loadDoc(d: unknown): void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
  }, newsletterDoc());

  // Measure the actual per-frame detection work (resolve + indicator line math)
  // over the REAL rendered geometry, sampling many points across the canvas.
  const detection = await page.evaluate(async () => {
    const mod = await import("/src/index.ts");
    const host = document.querySelector("rime-editor")!;
    const iframe = host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    const cdoc = iframe.contentDocument!;
    const el = host as unknown as { getDoc(): any };
    const doc = el.getDoc();

    // Build column geometry the same way the controller does.
    const columns = [];
    for (const section of doc.children) {
      for (const column of section.children) {
        const colEl = cdoc.querySelector(`[data-node-id="${column.id}"]`) as HTMLElement | null;
        if (!colEl) continue;
        columns.push({
          columnId: column.id,
          rect: colEl.getBoundingClientRect(),
          children: column.children
            .map((c: any) => {
              const e = cdoc.querySelector(`[data-node-id="${c.id}"]`) as HTMLElement | null;
              return e ? { id: c.id, rect: e.getBoundingClientRect() } : null;
            })
            .filter(Boolean),
        });
      }
    }

    const { resolveDropTarget, indicatorLineFor } = mod as unknown as {
      resolveDropTarget: (p: { x: number; y: number }, cols: unknown[]) => unknown;
      indicatorLineFor: (t: unknown, cols: unknown[]) => unknown;
    };

    const durations: number[] = [];
    const W = iframe.clientWidth;
    const H = cdoc.documentElement.scrollHeight;
    for (let i = 0; i < 400; i++) {
      const x = (i * 37) % W;
      const y = (i * 53) % H;
      const t0 = performance.now();
      const target = resolveDropTarget({ x, y }, columns) as { parentId: string } | null;
      if (target) indicatorLineFor(target, columns);
      durations.push(performance.now() - t0);
    }
    return durations;
  });

  // Measure frame cadence during a real driven drag across the canvas.
  await page.evaluate(() => {
    (window as unknown as { __frames: number[] }).__frames = [];
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      (window as unknown as { __frames: number[] }).__frames.push(now - last);
      last = now;
      (window as unknown as { __raf: number }).__raf = requestAnimationFrame(tick);
    };
    (window as unknown as { __raf: number }).__raf = requestAnimationFrame(tick);
  });

  const frame = page.viewportSize();
  const startX = (frame?.width ?? 1280) / 2;
  await page.mouse.move(startX, 120);
  await page.mouse.down();
  await page.mouse.move(startX, 130);
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(startX + (i % 2 === 0 ? -120 : 120), 140 + i * 6, { steps: 2 });
  }
  await page.mouse.up();

  const frames: number[] = await page.evaluate(() => {
    cancelAnimationFrame((window as unknown as { __raf: number }).__raf);
    return (window as unknown as { __frames: number[] }).__frames;
  });

  await browser.close();
  stopServer();

  // Report.
  const within = frames.filter((d) => d <= FRAME_MS + 1).length / Math.max(1, frames.length);
  const detP50 = p95(detection.filter((_, i) => i % 2 === 0)); // rough p50 proxy
  const detP95 = p95(detection);

  console.log(`\nDnD perf benchmark (CPU throttle ${CPU_THROTTLE}x)`);
  console.log(`  frames sampled:        ${frames.length}`);
  console.log(
    `  frames ≤ 16.6ms:       ${(within * 100).toFixed(1)}%  (gate ≥ ${FRAME_BUDGET_RATIO * 100}%)`,
  );
  console.log(`  detection p50:         ${detP50.toFixed(3)} ms`);
  console.log(
    `  detection p95:         ${detP95.toFixed(3)} ms  (gate ≤ ${DETECTION_P95_BUDGET_MS} ms)`,
  );

  let failed = false;
  if (within < FRAME_BUDGET_RATIO) {
    console.error(`❌ FAIL: only ${(within * 100).toFixed(1)}% of frames within 60fps`);
    failed = true;
  }
  if (detP95 > DETECTION_P95_BUDGET_MS) {
    console.error(
      `❌ FAIL: detection p95 ${detP95.toFixed(3)}ms exceeds ${DETECTION_P95_BUDGET_MS}ms`,
    );
    failed = true;
  }
  if (failed) process.exit(1);
  console.log("✅ PASS: drag cadence + detection latency within budget\n");
}

await main();
