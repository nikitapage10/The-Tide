import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zBundle } from "@/lib/contract/schema";

describe("published JSON Schema", () => {
  it("matches the Zod contract (run `npm run contract:schema` after changing the contract)", () => {
    const file = JSON.parse(readFileSync(path.join(process.cwd(), "contract/tide.publication.v1.schema.json"), "utf8"));
    const { $id: _id, title: _t, description: _d, ...rest } = file;
    void _id;
    void _t;
    void _d;
    expect(rest).toEqual(JSON.parse(JSON.stringify(z.toJSONSchema(zBundle, { target: "draft-2020-12", io: "input" }))));
  });
});
