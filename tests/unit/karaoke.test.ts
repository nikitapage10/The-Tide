import { describe, expect, it } from "vitest";
import { timeWords, wordAt, type TimedWord } from "@/components/audio/karaoke";
import timed from "../../public/audio/ilyr-narration.words.json";
import { readFileSync } from "node:fs";

describe("read-along timing", () => {
  it("matches words despite punctuation, case and a misheard name", () => {
    const heard: TimedWord[] = [
      [0, 0.5, "You"],
      [0.5, 1, "have"],
      [1, 1.5, "washed"],
      [1.5, 2, "upon"],
      [2, 2.5, "Aelir,"],
      [2.5, 3, "a"],
      [3, 3.5, "world"],
    ];
    const { starts } = timeWords(["You", "have", "washed", "upon", "**Ilyr**,", "a", "world"], heard);
    expect(starts).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
  });

  it("fills a page word the narrator skipped from its neighbours, keeping order", () => {
    const heard: TimedWord[] = [
      [0, 1, "light"],
      [2, 3, "remains"],
    ];
    const { starts } = timeWords(["light", "that", "remains"], heard);
    expect(starts[1]).toBeGreaterThan(1);
    expect(starts[1]).toBeLessThan(2);
    expect(wordAt({ starts }, 2.4)).toBe(2);
    expect(wordAt({ starts }, -1)).toBe(-1);
  });

  it("follows the real Arrival text closely", () => {
    // The page text: the intro document, as words.
    const page = readFileSync("lore/docs/intro.md", "utf8").split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
    const { starts } = timeWords(page, timed as TimedWord[]);
    const at = (w: string) => starts[page.findIndex((p) => p.replace(/\W/g, "") === w)]!;
    const atLast = (w: string) => starts[page.findLastIndex((p) => p.replace(/\W/g, "") === w)]!;
    // Landmarks heard in the recording.
    expect(Math.abs(at("Breathe") - (timed as TimedWord[]).find((t) => t[2].startsWith("Breathe"))![0])).toBeLessThan(0.01);
    expect(at("Divergence")).toBeGreaterThan(at("Drowning"));
    expect(atLast("harmony")).toBeGreaterThan(420);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]!);
  });
});
