#!/usr/bin/env python3
"""
Turns the GM's Word documents into the Markdown the lore bundle is built from.

    python3 scripts/build-lore-docs.py <folder with the .docx files>

For each known document it writes lore/docs/<slug>.md and, when the document
opens with an image, a portrait at public/lore/peoples/<slug>.webp.

The documents mark headings with bold paragraphs. Template sections (Origins,
the Age of the Abyssal Veil, the Three Consequences, Today, Anatomy, Behavior,
Unique Abilities, Reproduction, Habitat; About and History for enclaves)
become "##"; everything else bold-on-its-own becomes "###". Images, their
auto-generated alt text and stray zero-width characters are dropped. The text
is otherwise kept exactly as written (redaction happens when it is shown).
Needs pandoc and Pillow.
"""
import glob
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# file-name fragment -> slug (the uploads carry a random prefix)
DOCS = {
    "Nyth_rok": "nythrok",
    "Obscarron": "obscarron",
    "Teru_nga": "teruanga",
    "Umbrasa": "umbrasa",
    "Resonara": "resonara",
    "The_Normandy_Enclave": "normandy-enclave",
    "Tide_101": "tide-101",
    "Intro_New": "intro",
}

TOP = re.compile(
    r"^(origins\b|.*age of the abyssal veil$|(the )?impact of\b|.*\btoday\b|state of\b|anatomy$|behavior$|"
    r"unique abilities$|reproduction$|habitat$|about$|history$|the return to primus)",
    re.I,
)
WHOLE_BOLD = re.compile(r"^\*{2,3}(.+?)\*{2,3}$")


def convert(src: str, slug: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        md = subprocess.run(
            ["pandoc", "-t", "gfm", "--wrap=none", f"--extract-media={tmp}", src],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        images = sorted(glob.glob(os.path.join(tmp, "media", "*")))
        if images:
            out = os.path.join(ROOT, "public", "lore", "peoples", f"{slug}.webp")
            os.makedirs(os.path.dirname(out), exist_ok=True)
            im = Image.open(images[0]).convert("RGB")
            im.thumbnail((900, 1200))
            im.save(out, "WEBP", quality=82)
            print(f"  portrait -> {os.path.relpath(out, ROOT)} {im.size}")

    md = md.replace("​", "").replace("﻿", "")
    md = re.sub(r"<img[^>]*>", "", md)
    lines = md.splitlines()
    out_lines = []
    title = None
    seen_text = False
    for line in lines:
        s = line.strip()
        if s.startswith("# "):
            # The document title (sometimes just the image line).
            t = s[2:].strip()
            if t and title is None:
                title = t
            continue
        # Tide 101 sets one era name as plain text; make it a heading like the others.
        if re.match(r"^Age of the Veil \(A\.V\.\)", s):
            out_lines.append("### Age of the Veil (A.V.)")
            continue
        m = WHOLE_BOLD.match(s)
        if m:
            h = m.group(1).strip().rstrip(":").strip()
            if title and h.lower() == title.lower():
                continue  # the title repeated as bold text
            if not seen_text and not TOP.match(h):
                out_lines.append(f"*{h}*")  # an epithet under the title, e.g. "Children of the Core"
                continue
            out_lines.append(("## " if TOP.match(h) else "### ") + h)
            continue
        if s:
            seen_text = True
        out_lines.append(line.rstrip())
    text = "\n".join(out_lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
    dest = os.path.join(ROOT, "lore", "docs", f"{slug}.md")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w") as f:
        if title:
            f.write(f"<!-- title: {title} -->\n")
        f.write(text)
    print(f"{os.path.basename(src)} -> {os.path.relpath(dest, ROOT)}")


def main() -> None:
    folder = sys.argv[1] if len(sys.argv) > 1 else "."
    done = set()
    for path in sorted(glob.glob(os.path.join(folder, "*.docx"))):
        for frag, slug in DOCS.items():
            if frag in os.path.basename(path) and slug not in done:
                convert(path, slug)
                done.add(slug)
    missing = set(DOCS.values()) - done
    if missing:
        print("not found:", ", ".join(sorted(missing)))


if __name__ == "__main__":
    main()
