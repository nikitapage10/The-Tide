import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildLines, parseVtt } from "@/components/audio/SpokenStage";
import type { TimedWord } from "@/components/audio/karaoke";
import timed from "../../public/audio/ilyr-narration.words.json";

describe("the spoken stage", () => {
  it("reads caption cues from WebVTT", () => {
    const cues = parseVtt("WEBVTT\n\n1\n00:00:00.200 --> 00:00:09.200\nWaves crash upon shores.\n\n2\n00:01:02.500 --> 00:01:04.000\nThe Tide.\n");
    expect(cues).toEqual([
      { start: 0.2, end: 9.2, text: "Waves crash upon shores." },
      { start: 62.5, end: 64, text: "The Tide." },
    ]);
  });

  it("times every word of the real narration's lines, in order, inside each line", () => {
    const lines = buildLines(parseVtt(readFileSync("public/audio/ilyr-narration.vtt", "utf8")), timed as TimedWord[]);
    expect(lines.length).toBeGreaterThan(50);
    for (const l of lines) {
      expect(l.starts).toHaveLength(l.words.length);
      for (let i = 1; i < l.starts.length; i++) expect(l.starts[i]).toBeGreaterThanOrEqual(l.starts[i - 1]!);
      expect(l.starts[0]!).toBeGreaterThan(l.start - 1);
      expect(l.starts.at(-1)!).toBeLessThan(l.end + 1);
    }
    // The corrected name, as the captions spell it.
    expect(lines.some((l) => l.words.includes("Ilyr,"))).toBe(true);
  });
});
