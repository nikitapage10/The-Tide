#!/usr/bin/env python3
"""
Turns the GM's Word documents into the Markdown the lore bundle is built from.

    python3 scripts/build-lore-docs.py <folder or ZIP with the .docx files>

For each known document it writes lore/docs/<slug>.md and, when the document
opens with an image, a portrait at public/lore/peoples/<slug>.webp.

The documents mark headings with bold paragraphs. Template sections (Origins,
the Age of the Abyssal Veil, the Three Consequences, Today, Anatomy, Behavior,
Unique Abilities, Reproduction, Habitat; About and History for enclaves)
become "##"; everything else bold-on-its-own becomes "###". Images, their
auto-generated alt text and stray zero-width characters are dropped. Prose is preserved while headings and formatting become Markdown; legacy
world names are normalized to Ilyr / Ilyan. No etymology is invented.
Accepts a directory or ZIP containing all 12 documents. Needs pandoc and Pillow.
"""
import glob
import os
import re
import subprocess
import sys
import tempfile
import hashlib
import json
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# file-name fragment -> slug (the uploads carry a random prefix)
DOCS = {
    "nythrok": "nythrok", "obscarron": "obscarron", "terunga": "teruanga",
    "umbrasa": "umbrasa", "resonara": "resonara", "thenormandyenclave": "normandy-enclave",
    "tide101": "tide-101", "intro": "intro", "blightmourn": "blightmourn",
    "irridosa": "irridosai", "syntherion": "syntherion", "humans": "humans",
}


TOP = re.compile(
    r"^(origins\b|.*age of the abyssal veil$|(the )?impact of\b|.*\btoday\b|state of\b|anatomy$|behavior$|"
    r"unique abilities$|reproduction$|habitat$|about$|history$|the return to\b)",
    re.I,
)
WHOLE_BOLD = re.compile(r"^\*{2,3}(.+?)\*{2,3}$")


def rename_world(text: str) -> str:
    """Normalize legacy working names; never invent an etymology."""
    text = re.sub(r"\bPrimus\b", "Ilyr", text)
    return re.sub(r"\b(?:Primal|Ilyrian)\b", "Ilyan", text)


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
    md = rename_world(md)
    lines = md.splitlines()
    out_lines = []
    title = None
    seen_text = False
    for line in lines:
        s = line.strip()
        if not s or s.startswith("!["):
            out_lines.append("")
            continue
        heading = re.match(r"^(#{1,6}) (.+)$", s)
        if heading:
            h = heading.group(2).strip().rstrip(":").strip()
            # A title appears before prose. In newer files the first H1
            # follows the overview and is a real section, not a title.
            if not seen_text and title is None and not TOP.match(h):
                title = h
                continue
            level = "## " if TOP.match(h) or len(heading.group(1)) == 1 else "### "
            out_lines.append(level + h)
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
    input_path = sys.argv[1] if len(sys.argv) > 1 else "."
    with tempfile.TemporaryDirectory() as temp:
        if zipfile.is_zipfile(input_path):
            with zipfile.ZipFile(input_path) as archive:
                for name in archive.namelist():
                    if name.lower().endswith(".docx"):
                        with open(os.path.join(temp, os.path.basename(name)), "wb") as dest:
                            dest.write(archive.read(name))
            folder = temp
        else:
            folder = input_path
        done = set()
        provenance = []
        for path in sorted(glob.glob(os.path.join(folder, "*.docx"))):
            normalized = re.sub(r"[^a-z0-9]", "", os.path.basename(path).lower())
            for frag, slug in DOCS.items():
                if frag in normalized and slug not in done:
                    convert(path, slug)
                    done.add(slug)
                    with open(path, "rb") as source:
                        digest = hashlib.sha256(source.read()).hexdigest()
                    provenance.append({"filename": os.path.basename(path), "slug": slug, "sha256": digest})
                    break
        missing = set(DOCS.values()) - done
        if missing:
            raise SystemExit("Missing required documents: " + ", ".join(sorted(missing)))
        with open(os.path.join(ROOT, "lore", "source-manifest.json"), "w") as manifest:
            json.dump({"archive": os.path.basename(input_path), "documents": provenance}, manifest, indent=2)
            manifest.write("\n")


if __name__ == "__main__":
    main()
