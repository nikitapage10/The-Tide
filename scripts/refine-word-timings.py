#!/usr/bin/env python3
"""
Refine the narration's word timings against the recording itself.

The transcript's word times (lore/narration/ilyr-narration.whisper.json, from
Whisper) run back to back: after a pause, the next word is marked as starting
where the last one ended, though the voice is still silent. This moves each
such start to where the voice actually begins (the loudness, measured every
10 ms, first rising out of the quiet), and writes the result where the site
reads it: public/audio/ilyr-narration.words.json.

    python3 scripts/refine-word-timings.py
"""
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public/audio/ilyr-narration.mp3"
RAW = ROOT / "lore/narration/ilyr-narration.whisper.json"
OUT = ROOT / "public/audio/ilyr-narration.words.json"
HOP = 0.01  # seconds per loudness frame


def loudness_db() -> np.ndarray:
    pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(AUDIO), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], check=True, capture_output=True).stdout
    a = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    hop = int(16000 * HOP)
    n = len(a) // hop
    rms = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(1))
    # A light smoothing (30 ms) so a single quiet frame inside a word doesn't count as silence.
    rms = np.convolve(rms, np.ones(3) / 3, mode="same")
    return 20 * np.log10(rms + 1e-9)


def main() -> None:
    db = loudness_db()
    # Silence: within 6 dB of the recording's quiet floor.
    quiet = np.percentile(db, 20) + 6
    words = json.loads(RAW.read_text())
    moved = 0
    out = []
    for start, end, word in words:
        i, j = int(start / HOP), int(end / HOP)
        seg = db[i : max(i + 1, j)]
        voiced = np.nonzero(seg > quiet)[0]
        # Starting in silence: move the start to the first voiced frame (keeping some of the word).
        if len(voiced) and voiced[0] >= 3:
            new = round(start + voiced[0] * HOP, 2)
            if new < end - 0.05:
                start = new
                moved += 1
        out.append([start, end, word])
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"{len(out)} words, {moved} starts moved to the voice; wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
