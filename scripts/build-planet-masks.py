#!/usr/bin/env python3
"""Bake masks for the planet artwork (public/brand/planet-v2.webp).

Writes public/brand/planet-masks.png (half resolution):
  R = land (where city lights may appear), G = the light streams crossing the
  disc (never land), B = 0.
Land is the brighter, textured ground on the disc; the streams are bright lines
running straight away from the point where they cross (PINCH), found with a
structure tensor. Requires numpy, scipy, Pillow:  python3 scripts/build-planet-masks.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Image.open("public/brand/planet-v2.webp").convert("L")
W, H = SRC.size
lum = np.asarray(SRC).astype(np.float32) / 255.0
PINCH = np.array([0.20 * W, 0.453 * H])
LIMB_C = np.array([1.0122 * W, 0.65 * H])
LIMB_R = 883.0

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
disc = np.hypot(xx - LIMB_C[0], yy - LIMB_C[1]) < LIMB_R - 4

# Structure tensor: dominant line direction per pixel.
gx = ndimage.sobel(lum, axis=1)
gy = ndimage.sobel(lum, axis=0)
s = 3.0
jxx = ndimage.gaussian_filter(gx * gx, s)
jyy = ndimage.gaussian_filter(gy * gy, s)
jxy = ndimage.gaussian_filter(gx * gy, s)
ang = 0.5 * np.arctan2(2 * jxy, jxx - jyy)          # gradient direction
lx, ly = -np.sin(ang), np.cos(ang)                   # line direction (perpendicular)
coh = np.sqrt((jxx - jyy) ** 2 + 4 * jxy**2) / (jxx + jyy + 1e-6)
vx, vy = xx - PINCH[0], yy - PINCH[1]
vn = np.hypot(vx, vy) + 1e-6
align = np.abs(lx * vx / vn + ly * vy / vn)
bright = ndimage.gaussian_filter(lum, 1.0)
stream = disc & (align > 0.97) & (coh > 0.35) & (bright > 0.3)
stream = ndimage.binary_opening(stream, iterations=1)
# Keep only long, thin pieces (the strands), not stray bright texture.
lab, n = ndimage.label(ndimage.binary_dilation(stream, iterations=2))
keep = np.zeros(n + 1, bool)
for i, sl in enumerate(ndimage.find_objects(lab), start=1):
    ys, xs = np.nonzero(lab[sl] == i)
    if len(xs) < 50:
        continue
    ev = np.linalg.eigvalsh(np.cov(np.vstack([xs, ys]).astype(float)))
    keep[i] = np.sqrt(ev[1]) > 50 and ev[1] / max(ev[0], 1e-3) > 40   # long and thin
stream = keep[lab] & stream
stream = ndimage.binary_dilation(stream, iterations=7)
stream_f = ndimage.gaussian_filter(stream.astype(np.float32), 4.0)

ground = ndimage.gaussian_filter(lum, 5.0)
# Ground texture (the atmosphere's bright rim is smooth; land is textured).
tex = np.sqrt(np.clip(ndimage.gaussian_filter(lum**2, 4.0) - ndimage.gaussian_filter(lum, 4.0) ** 2, 0, None))
rim = np.hypot(xx - LIMB_C[0], yy - LIMB_C[1]) > LIMB_R - 70
land = disc & ~rim & (ground > 0.2) & (tex > 0.045) & (stream_f < 0.2)
land = ndimage.binary_opening(land, iterations=2)
land_f = ndimage.gaussian_filter(land.astype(np.float32), 3.0) * (1 - np.clip(stream_f * 3, 0, 1))

out = np.zeros((H, W, 3), np.uint8)
out[..., 0] = np.clip(land_f * 255, 0, 255)
out[..., 1] = np.clip(stream_f * 255, 0, 255)
Image.fromarray(out).resize((W // 2, H // 2), Image.BILINEAR).save("public/brand/planet-masks.png", optimize=True)
print("land", land.mean().round(3), "stream", stream.mean().round(4))
