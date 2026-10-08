import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/ui/Markdown";
import { renameWorld } from "@/lib/domain/world-name";

describe("the world's name: Ilyr", () => {
  it("replaces the old working names, adjective and possessives, on word boundaries only", () => {
    expect(renameWorld("Primus, Primus's moon, the Primal races")).toBe("Ilyr, Ilyr's moon, the Ilyrian races");
    expect(renameWorld("Primuses and Primality stay")).toBe("Primuses and Primality stay");
  });
  it("never shows the old name in rendered Markdown", () => {
    const html = renderToStaticMarkup(createElement(Markdown, null, "You have washed upon the shores of **Primus**, among the Primal races. `Primus` in code too."));
    expect(html).not.toMatch(/Primus|Primal/);
    expect(html).toContain("<strong>Ilyr</strong>");
    expect(html).toContain("Ilyrian races");
  });
});
