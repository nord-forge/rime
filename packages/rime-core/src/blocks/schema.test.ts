import { describe, expect, test } from "bun:test";
import type { BlockSchema, FieldDef } from "./schema";

describe("schema field types", () => {
  test("a multiline/code field is a plain string field", () => {
    const field: FieldDef = { key: "html", label: "HTML", type: "code", group: "Content" };
    expect(field.type).toBe("code");
  });

  test("a list field carries itemFields and bounds", () => {
    const schema: BlockSchema = {
      fields: [
        {
          key: "items",
          label: "Links",
          type: "list",
          minItems: 1,
          maxItems: 8,
          itemFields: [
            { key: "label", label: "Label", type: "text" },
            { key: "href", label: "URL", type: "url" },
          ],
        },
      ],
    };
    const list = schema.fields[0]!;
    expect(list.type).toBe("list");
    expect(list.itemFields).toHaveLength(2);
    expect(list.itemFields!.map((f) => f.key)).toEqual(["label", "href"]);
    expect(list.minItems).toBe(1);
    expect(list.maxItems).toBe(8);
  });
});
