import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/ui/Markdown";
import { redactPlain, splitRedacted } from "@/lib/domain/redaction";

describe("world-name redaction", () => {
  it("withholds the name, its adjective and possessives, on word boundaries only", () => {
    expect(redactPlain("Primus, Primus's moon, the Primal races")).toBe("[redacted], [redacted] moon, the [redacted] races");
    expect(redactPlain("Primuses and Primality stay")).toBe("Primuses and Primality stay");
    expect(splitRedacted("the shores of Primus.")).toEqual(["the shores of ", { redacted: "Primus" }, "."]);
  });
  it("can be lifted", () => {
    expect(redactPlain("Primus", true)).toBe("Primus");
  });
  it("never puts the name in rendered Markdown", () => {
    const html = renderToStaticMarkup(createElement(Markdown, null, "You have washed upon the shores of **Primus**, among the Primal races. `Primus` in code too."));
    expect(html).not.toMatch(/Primus|Primal/);
    expect(html).toContain("[redacted]");
    expect(html).toContain("world-name");
  });
});
