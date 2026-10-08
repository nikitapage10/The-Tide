#!/usr/bin/env python3
"""
Cut the art sheets in art/source/ (see docs/ART_BRIEF.md) into web assets in
public/art/. Re-run after replacing any sheet:  python3 scripts/build-art.py

- Transparent sheets (sigils, glass, numerals...) are cut on their grid, then
  trimmed to the visible pixels; each piece keeps its transparency.
- Black-ground strips (ages, homelands...) are split at their dark gutters.
- Scenes are resized and saved as WebP.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "public" / "art"


def save(im: Image.Image, rel: str, *, max_w: int | None = None, max_h: int | None = None, q: int = 82) -> None:
    w, h = im.size
    s = min(1.0, (max_w or w) / w, (max_h or h) / h)
    if s < 1:
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    path = OUT / f"{rel}.webp"
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)
    print(f"  {path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}")


def trim(im: Image.Image, pad: int = 6, thresh: int = 10) -> Image.Image | None:
    """Crop to the pixels that show (alpha above `thresh`), with a little air."""
    a = np.asarray(im.getchannel("A"))
    ys, xs = np.nonzero(a > thresh)
    if len(xs) < 40:  # an empty cell
        return None
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad + 1), min(im.height, y1 + pad + 1)))


def grid(name: str, cols: int, rows: int, join: int = 9) -> list[Image.Image]:
    """Every non-empty cell of a transparent sheet, row by row.

    Pieces that spill over their cell's edge are kept whole, and slivers of a
    neighbour are left out: the sheet is split into shapes (pixels that show,
    joined across gaps of `join` px), and each shape belongs to the cell that
    holds its centre.
    """
    im = Image.open(SRC / name).convert("RGBA")
    w, h = im.size
    alpha = np.asarray(im.getchannel("A"))
    shown = alpha > 10
    labels, n = ndimage.label(ndimage.binary_dilation(shown, iterations=join))
    labels = labels * shown
    sizes = ndimage.sum(np.ones_like(labels), labels, index=range(1, n + 1))
    centres = ndimage.center_of_mass(shown, labels, index=range(1, n + 1))
    # A shape far bigger than a cell (soft mist touching its neighbours) is
    # shared: each cell takes the part inside its own edges.
    boxes = ndimage.find_objects(labels)
    shared = {k + 1 for k, b in enumerate(boxes) if b and ((b[1].stop - b[1].start) > 1.25 * w / cols or (b[0].stop - b[0].start) > 1.25 * h / rows)}
    cells = []
    for r in range(rows):
        for c in range(cols):
            x0, x1, y0, y1 = c * w // cols, (c + 1) * w // cols, r * h // rows, (r + 1) * h // rows
            mine = [k + 1 for k, (cy, cx) in enumerate(centres) if k + 1 not in shared and sizes[k] > 30 and x0 <= cx < x1 and y0 <= cy < y1]
            inside = np.zeros_like(shown)
            inside[y0:y1, x0:x1] = True
            part = np.isin(labels, list(shared)) & inside if shared else np.zeros_like(shown)
            if not mine and not part.any():
                continue
            # Specks far smaller than the main shape are dust, not part of it.
            if mine:
                big = max(sizes[k - 1] for k in mine)
                mine = [k for k in mine if sizes[k - 1] > big * 0.004]
            keep = np.isin(labels, mine) | part
            piece = np.asarray(im).copy()
            piece[..., 3] = np.where(keep, piece[..., 3], 0)
            t = trim(Image.fromarray(piece, "RGBA"))
            if t is not None:
                cells.append(t)
    return cells


def square(im: Image.Image, size: int) -> Image.Image:
    """Centre a trimmed piece on a transparent square, scaled to fit."""
    s = size / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return out


def panels(name: str, n: int, dark: float = 14.0) -> list[Image.Image]:
    """Split a black-ground strip into its n side-by-side panels at the dark
    gutters, all cut to one shared height and one shared width."""
    im = Image.open(SRC / name).convert("RGB")
    lum = np.asarray(im.convert("L"), dtype=np.float32)
    cols = lum.mean(axis=0)
    on = cols > dark
    runs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        if not v and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(cols)))
    runs = [r for r in runs if r[1] - r[0] > len(cols) / (n * 4)]
    if len(runs) != n:  # no clean gutters: equal parts
        runs = [(k * len(cols) // n, (k + 1) * len(cols) // n) for k in range(n)]
    # The panels' shared top and bottom: rows lit in the panels' columns.
    inside = np.concatenate([lum[:, a:b] for a, b in runs], axis=1).mean(axis=1)
    lit = np.nonzero(inside > dark / 2)[0]
    top, bottom = (lit[0], lit[-1] + 1) if len(lit) else (0, im.height)
    width = min(b - a for a, b in runs)
    out = []
    for a, b in runs:
        x = a + ((b - a) - width) // 2
        out.append(im.crop((x, top, x + width, bottom)))
    return out


def thirds(name: str, n: int) -> list[Image.Image]:
    """Equal side-by-side parts of one continuous image, full height."""
    im = Image.open(SRC / name).convert("RGB")
    return [im.crop((k * im.width // n, 0, (k + 1) * im.width // n, im.height)) for k in range(n)]


def bands(name: str, n: int, inset: int = 6) -> list[Image.Image]:
    """Equal horizontal bands (for strips with hairline gutters)."""
    im = Image.open(SRC / name).convert("RGB")
    w, h = im.size
    return [im.crop((0, k * h // n + inset, w, (k + 1) * h // n - inset)) for k in range(n)]


def scene(name: str, rel: str, max_w: int = 2400) -> None:
    save(Image.open(SRC / name).convert("RGB"), rel, max_w=max_w)


def named(pieces: list[Image.Image], names: list[str], folder: str, size: int | None = None, max_h: int | None = None) -> None:
    if len(pieces) < len(names):
        print(f"  ! {folder}: {len(pieces)} pieces for {len(names)} names")
    for p, n in zip(pieces, names):
        save(square(p, size) if size else p, f"{folder}/{n}", max_h=max_h)


def main() -> None:
    print("sigils")
    named(grid("01-sigils-ages.png", 3, 3), ["shoreborn", "undertow", "veil", "verdancy", "tide", "today", "drowning", "divergence", "drift"], "sigils/ages", 256)
    named(grid("02-sigils-peoples.png", 3, 3), ["nythrok", "obscarron", "teruanga", "umbrasa", "resonara", "irridosai", "blightmourn", "syntherion", "enclaves"], "sigils/peoples", 256)
    named(
        grid("03-sigils-rooms-world-people.png", 4, 4),
        ["environments", "places", "history", "technology", "relics", "phenomena", "workings", "concepts", "peoples", "characters", "creatures", "factions", "institutions"],
        "sigils/rooms",
        256,
    )
    named(
        grid("04-sigils-rooms-stories-studio-workshop.png", 4, 4),
        ["campaigns", "one-shots", "novels", "short-fiction", "music", "artwork", "elements", "aesthetics", "branding", "other", "prints", "builds", "publishing", "sources", "labs"],
        "sigils/rooms",
        256,
    )
    named(
        grid("05-interface-glyphs.png", 4, 4),
        ["play", "pause", "search", "menu", "close", "arrow-left", "arrow-right", "arrow-down", "sound-on", "sound-off", "external", "filter", "expand", "pin", "frame", "seal"],
        "glyphs",
        128,
    )
    named(grid("06-markers.png", 3, 2), ["people-star", "faction-star", "place", "uncertain", "floating-mountain", "rift"], "markers", 128)

    print("numerals")
    for i, p in enumerate(grid("07-numerals.png", 5, 2, join=4)):
        save(p, f"numerals/{i}", max_h=480)

    print("glass")
    named(grid("08-monoliths-peoples.png", 8, 1), ["nythrok", "obscarron", "teruanga", "umbrasa", "resonara", "irridosai", "blightmourn", "syntherion"], "monoliths", max_h=900)
    named(grid("10-library-volumes.png", 4, 1), ["novel", "campaign", "one-shot", "chapbook"], "volumes", max_h=700)
    vit = trim(Image.open(SRC / "11-vitrine.png").convert("RGBA"))
    assert vit is not None
    save(vit, "vitrine", max_w=1200)
    named(
        grid("24-technology-relics.png", 4, 2),
        ["helio-regulator", "star-barge", "geothermal-condenser", "gravity-bridge", "rotbook", "shoreborn-artefact", "moon-shard", "obsidian-idol"],
        "objects",
        640,
    )
    named(grid("23-phenomena.png", 3, 2), ["drowning", "divergence", "drift", "tide", "windows-of-memory", "echoing-miasma"], "phenomena", 720)
    named(grid("27-arrivals.png", 2, 2), ["normandy", "conquistadors", "te-ara-kore", "armada"], "arrivals", 720)
    river = trim(Image.open(SRC / "22-river.png").convert("RGBA"))
    assert river is not None
    save(river, "river", max_h=2400)
    named(grid("30-textures.png", 3, 1), ["grain", "mist", "threads"], "textures", max_h=900)

    print("scenes")
    for n, rel in [("12-arrival.png", "story/arrival"), ("13-before.png", "story/before"), ("14-veil.png", "story/veil"), ("15-verdancy.png", "story/verdancy"), ("16-tide.png", "story/tide")]:
        scene(n, rel)
    scene("09-monoliths-sections.png", "story/enter")
    scene("17-world-hero.png", "heroes/world")
    scene("25-people-hero.png", "heroes/people")
    scene("21-survey.png", "world/survey")

    print("strips")
    named(panels("19-ages.png", 6), ["shoreborn", "undertow", "veil", "verdancy", "tide", "today"], "ages", max_h=1000)
    named(bands("20-environments.png", 4), ["sea", "desert", "forest", "abyss"], "environments")
    named(panels("26-homelands.png", 5), ["nythrok", "obscarron", "teruanga", "umbrasa", "resonara"], "homelands", max_h=1000)
    named(thirds("28-unknowns.png", 3), ["figure", "creature", "landscape"], "unknowns", max_h=900)
    named(thirds("29-backdrops.png", 3), ["library", "studio", "workshop"], "backdrops", max_h=900)


if __name__ == "__main__":
    main()
