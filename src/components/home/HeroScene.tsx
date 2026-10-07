"use client";
/**
 * WebGL hero scene, rendered as two stacked canvases that share one shader:
 *   layer "planet"  – opaque backdrop (planet + gravitic stream), under the interface
 *   layer "meteors" – transparent rocks, ABOVE everything (title, callouts, menu)
 * Both apply the same gravity lens, so the whole scene bends together.
 *
 * - Intro (shared clock): menu, then outer rocks, then middle rocks, then the
 *   planet. Each layer is darker than the one in front; the planet starts very
 *   dark and gains its light as you scroll in (progress p: 0 → 1).
 * - Planet limb and streams: always in motion, kept light (see planetWithLimb):
 *   a flow orbiting the horizon like light bending around a heavy mass, a
 *   photon ring with travelling knots, and strands flowing in and out.
 * - Gravity lens: the pointer slowly bends space. Bright light passing through
 *   the bend is gathered into a faint magnified ring with a slight prism split
 *   (no halo over empty black); small ghost flares trail off the pointer.
 *   Barely present before you scroll; stronger as you scroll in.
 *
 * Geometry matches the CSS .hero-frame so DOM callouts stay pinned to the art.
 */
import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uPlanet, uFar, uNear;
uniform int uLayer;       // 0 = planet (opaque), 1 = meteors (premultiplied alpha)
uniform vec2 uRes;
uniform vec2 uFrameC;
uniform vec2 uFrameS;
uniform float uP;
uniform float uT;
uniform vec2 uM;
uniform vec2 uV;
uniform float uE;
uniform float uDpr;
uniform float uS;         // smoothed scroll speed (progress per second, >= 0)
uniform float uMenuH;     // header height (CSS px); rocks are kept off the menu at rest

const vec2 SRC = vec2(2000.0, 1126.0);
const vec2 LIMB_C = vec2(1.0122, 0.6500); // planet centre in artwork uv (fitted to the horizon)
const float LIMB_R = 883.0;               // planet radius in source px

float intro(float a, float b) { return smoothstep(a, b, uT); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec4 tex(sampler2D s, vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(s, uv);
}

// Two-scale, luminance-masked unsharp mask: a fine pass for line edges and a
// wider pass for local contrast, so the streams read crisp when upscaled,
// without amplifying the dark blocks.
vec3 sharpPlanet(vec2 uv) {
  vec2 tx = 1.0 / SRC;
  vec3 c0 = tex(uPlanet, uv).rgb;
  vec3 b1 = (tex(uPlanet, uv + vec2(tx.x, 0.0)).rgb + tex(uPlanet, uv - vec2(tx.x, 0.0)).rgb
           + tex(uPlanet, uv + vec2(0.0, tx.y)).rgb + tex(uPlanet, uv - vec2(0.0, tx.y)).rgb) * 0.25;
  vec2 t2 = tx * 2.5;
  vec3 b2 = (tex(uPlanet, uv + vec2(t2.x, t2.y)).rgb + tex(uPlanet, uv - vec2(t2.x, t2.y)).rgb
           + tex(uPlanet, uv + vec2(t2.x, -t2.y)).rgb + tex(uPlanet, uv - vec2(t2.x, -t2.y)).rgb) * 0.25;
  float l = dot(c0, vec3(0.3333));
  float m = smoothstep(0.04, 0.25, l);
  vec3 c = c0 + (c0 - b1) * 1.6 * m + (c0 - b2) * 0.55 * m;
  // Gentle S-curve: deeper blacks between the strands, brighter cores.
  c = max(c, 0.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
  return c;
}

// Smooth value noise and a small fbm, for slow flowing motion.
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { return 0.6 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.1 * vnoise(p * 4.1 + 3.7); }

const vec2 PINCH = vec2(0.20, 0.453); // where the streams cross, in artwork uv

// Black-hole-like horizon plus a flowing tide, always in motion and kept light.
// The stream lines themselves are never displaced (that chopped them up): only
// light moves along them.
// - Streams: broad, soft swells of light travel along the strands; some bundles
//   carry light in toward the planet, others carry it out, at the same time.
// - Horizon: a gentle turbulent flow circles the planet just above its edge,
//   bending the light there; a thin photon ring with travelling bright knots
//   hugs the limb, with a fainter second ring and a soft halo.
vec3 planetWithLimb(vec2 uv) {
  vec2 q = (uv - LIMB_C) * SRC;
  float rq = length(q);
  float dl = rq - LIMB_R;
  float ang = atan(q.y, q.x);
  vec2 nrm = q / max(rq, 1.0);
  vec2 tng = vec2(-nrm.y, nrm.x);
  float outside = smoothstep(-2.0, 8.0, dl);
  // Horizon flow: confined close to the edge and ramped in smoothly, so the
  // strands that meet the planet are not sheared.
  float hug = exp(-max(dl, 0.0) / 70.0) * smoothstep(0.0, 30.0, dl);
  float orbit = ang * 7.0 - uT * 0.55;
  float turb = fbm(vec2(orbit, dl * 0.03 - uT * 0.25)) - 0.5;
  vec2 disp = (nrm * 6.0 * turb + tng * 7.0 * turb) * hug;
  vec3 col = sharpPlanet(uv + disp / SRC);

  // Streams: coordinates around the crossing point. s runs along the flow
  // (negative left of the crossing), across picks out bundles of strands.
  vec2 w = (uv - PINCH) * SRC;
  float along = length(w);
  float s = w.x < 0.0 ? -along : along;
  // Bundle angle, mirrored on the left so a strand keeps its bundle through the crossing.
  float across = atan(w.y, abs(w.x)) * (w.x < 0.0 ? -1.0 : 1.0);
  // Neighbouring bundles alternate: light flows into the planet on some, out on others.
  float inward = smoothstep(-0.35, 0.35, sin(across * 9.0 + 0.6));
  // Soft patches of light drifting along the strands (toward the planet on inward
  // bundles, away from it on the others).
  float pIn = vnoise(vec2(s * 0.004 - uT * 0.35, across * 4.0));
  float pOut = vnoise(vec2(s * 0.004 + uT * 0.35, across * 4.0 + 9.0));
  float flare = smoothstep(0.55, 0.92, mix(pOut, pIn, inward));
  // The glow is traced from the strands themselves, heavily blurred, and drawn
  // over them additively, so the light follows the lines without moving them.
  vec2 tx = 1.0 / SRC;
  float halo1 = 0.0, halo2 = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.7854;
    vec2 d = vec2(cos(a), sin(a));
    halo1 += dot(tex(uPlanet, uv + d * 9.0 * tx).rgb, vec3(0.3333));
    halo2 += dot(tex(uPlanet, uv + d * 24.0 * tx).rgb, vec3(0.3333));
  }
  float glowSrc = smoothstep(0.03, 0.45, (halo1 * 0.6 + halo2 * 0.4) / 8.0);
  float streamZone = (1.0 - smoothstep(-40.0, 0.0, -dl)) * smoothstep(30.0, 160.0, along);
  col += vec3(0.84, 0.9, 1.0) * glowSrc * flare * streamZone * 0.4;

  // Thin, brighter glints that run along the line cores themselves: the ridges of
  // the strands (pixel brighter than its blurred surroundings), lit by short,
  // quicker flecks travelling in the same direction as their bundle.
  float lum0 = dot(tex(uPlanet, uv).rgb, vec3(0.3333));
  float core = smoothstep(0.015, 0.14, lum0 - halo1 / 8.0);
  float gIn = vnoise(vec2(s * 0.011 - uT * 0.8, across * 16.0));
  float gOut = vnoise(vec2(s * 0.011 + uT * 0.8, across * 16.0 + 5.0));
  float glint = smoothstep(0.68, 0.95, mix(gOut, gIn, inward));
  col += vec3(0.9, 0.95, 1.0) * core * glint * streamZone * 0.75;

  // Photon ring with knots of light circling the planet, a second ring, a halo.
  float knots = 0.45 + 1.1 * smoothstep(0.45, 0.9, fbm(vec2(ang * 22.0 - uT * 1.1, uT * 0.1)));
  float beam = 0.55 + 0.45 * cos(ang + 2.1 + 0.4 * sin(uT * 0.2));
  float ring1 = exp(-pow((dl - 3.0) / 2.6, 2.0));
  float ring2 = exp(-pow((dl - 13.0 - 3.0 * turb) / 1.6, 2.0));
  float halo = exp(-max(dl, 0.0) / 60.0) * outside * (0.8 + 0.4 * turb);
  vec3 tint = vec3(0.86, 0.91, 1.0);
  col += tint * (ring1 * 0.2 * beam * knots + ring2 * 0.07 * beam * knots + halo * 0.04);

  // Atmosphere: a faint veil of cloud drifting over the planet, projected onto the
  // sphere (foreshortened toward the limb) and thickening toward the edge.
  float inside = 1.0 - smoothstep(-6.0, 0.0, dl);
  vec2 sph = q / LIMB_R;
  float z = sqrt(max(0.0, 1.0 - dot(sph, sph)));
  vec2 cuv = sph / (0.35 + z) * 3.2;
  float cloud = fbm(cuv + vec2(uT * 0.012, uT * 0.004));
  cloud = smoothstep(0.42, 0.8, cloud * 0.75 + fbm(cuv * 2.3 - vec2(uT * 0.02, 0.0)) * 0.35);
  float rimMist = pow(1.0 - z, 3.0);
  col += vec3(0.82, 0.88, 0.95) * inside * (cloud * (0.07 + 0.08 * rimMist) + rimMist * 0.06);
  return col;
}

// Faint "fourth-dimension" stars in the empty space: sparse points that breathe
// slowly; now and then one slips out of phase, jumping a few pixels, splitting
// into a prism triplet with a thin scanline before settling back.
vec3 stars(vec2 sp, float emptiness) {
  const float CELL = 64.0;
  vec2 cell = floor(sp / CELL);
  float h = hash(cell);
  if (h < 0.7 || emptiness < 0.01) return vec3(0.0);
  vec2 pos = (cell + 0.2 + 0.6 * vec2(hash(cell + 3.1), hash(cell + 7.7))) * CELL;
  float slot = floor(uT * 0.4 + h * 17.0);
  float g = step(0.93, hash(cell + slot * 1.37));            // out of phase this slot
  float gt = fract(uT * 0.4 + h * 17.0);
  float active = g * step(gt, 0.18);                          // only briefly
  vec2 jump = active * (vec2(hash(cell + slot), hash(cell - slot)) - 0.5) * 10.0;
  vec2 d = sp - pos - jump;
  float breathe = 0.55 + 0.45 * sin(uT * (0.4 + h) + h * 40.0);
  float b = (0.16 + 0.3 * hash(cell + 1.9)) * breathe;
  float split = 1.6 * active;
  vec3 c = vec3(exp(-dot(d - vec2(split, 0.0), d - vec2(split, 0.0)) * 1.3),
                exp(-dot(d, d) * 1.3),
                exp(-dot(d + vec2(split, 0.0), d + vec2(split, 0.0)) * 1.3));
  float scan = active * exp(-d.y * d.y * 3.0) * smoothstep(9.0, 0.0, abs(d.x)) * 0.35;
  return (c + scan) * b * emptiness;
}

// Backlit meteor: dark body, thin rim of light from the upper left. Optional soft
// blur (in source px) to push a layer back in depth. Premultiplied output.
vec4 meteor(sampler2D s, vec2 uv, float bright, float rimAmt, vec2 px, float blurPx) {
  vec2 o = px * blurPx;
  vec4 c = tex(s, uv) * 0.4
         + (tex(s, uv + vec2(o.x, 0.0)) + tex(s, uv - vec2(o.x, 0.0))
          + tex(s, uv + vec2(0.0, o.y)) + tex(s, uv - vec2(0.0, o.y))) * 0.15;
  float edge = clamp(c.a - tex(s, uv + vec2(-1.6, -1.6) * px).a, 0.0, 1.0);
  return vec4((c.rgb * bright + vec3(edge * rimAmt)) * c.a, c.a);
}

// Rocks flying past the camera: the base meteor (depth blur) plus a radial zoom
// streak away from the zoom origin, with a faint prism split along the streak.
vec4 flyby(sampler2D s, vec2 uv, vec2 origin, float streak, float bright, float rimAmt, vec2 px, float blurPx) {
  vec4 base = meteor(s, uv, bright, rimAmt, px, blurPx);
  if (streak < 0.0005) return base;
  vec2 dv = uv - origin;
  vec3 acc = vec3(0.0);
  float aa = 0.0;
  for (int i = 1; i <= 6; i++) {
    float t = float(i) / 6.0;
    vec4 cr = tex(s, uv - dv * streak * t * 1.12);
    vec4 cg = tex(s, uv - dv * streak * t);
    vec4 cb = tex(s, uv - dv * streak * t * 0.88);
    acc += vec3(cr.r * cr.a, cg.g * cg.a, cb.b * cb.a) * bright;
    aa += cg.a;
  }
  float w = clamp(streak * 18.0, 0.0, 0.7);
  return mix(base, vec4(acc / 6.0, aa / 6.0), w);
}

vec4 scene(vec2 sp) {
  vec2 f = (sp - (uFrameC - 0.5 * uFrameS)) / uFrameS;
  vec2 px = 1.0 / uFrameS;
  if (uLayer == 0) {
    float iPlanet = intro(2.0, 3.8);
    float sP = 1.25 - 0.25 * uP + 0.06 * (1.0 - iPlanet);
    vec2 oP = vec2(0.85, 0.58);
    vec2 puv = oP + (f - oP) / sP;
    vec3 col = planetWithLimb(puv);
    // Stars only where space is empty: dark, and off the planet.
    float dlS = length((puv - LIMB_C) * SRC) - LIMB_R;
    float empty = (1.0 - smoothstep(0.03, 0.14, dot(col, vec3(0.3333)))) * smoothstep(20.0, 80.0, dlS);
    col += stars(sp, empty);
    col *= iPlanet * mix(0.07, 1.0, smoothstep(0.0, 1.0, uP));
    return vec4(col, 1.0);
  }
  float iNear = intro(0.6, 1.9);
  float iFar = intro(1.3, 2.7);

  // Depth of field grows as the rocks leave the focal plane; streaks come from
  // the zoom itself plus how fast you scroll.
  float depth = smoothstep(0.05, 1.0, uP);
  float rush = clamp(uS, 0.0, 2.0);

  // Middle rocks: darker, slightly soft, spread outward and thin to a faint frame.
  float sF = 1.0 + 0.9 * uP + 0.08 * (1.0 - iFar);
  vec2 oF = vec2(0.5);
  vec4 far = flyby(uFar, oF + (f - oF) / sF, oF, 0.012 * depth + 0.02 * rush,
                   mix(0.22, 0.4, uP), mix(0.22, 0.4, uP), px / sF, 1.6 + 3.5 * depth);
  // Stays solid through most of the scroll; gone by the last frame (only the planet remains).
  far *= iFar * (1.0 - smoothstep(0.78, 0.99, uP));

  // Outer rocks: brightest; they rise and fly past the camera, catching a glint
  // of light on their rims as they go.
  float sN = 1.05 + 1.7 * uP + 0.1 * (1.0 - iNear);
  vec2 oN = vec2(0.5, 0.95);
  vec2 uvN = oN + (f - oN) / sN;
  float glint = 0.35 + 0.5 * sin(3.14159 * clamp(uP * 1.4, 0.0, 1.0));
  vec4 near = flyby(uNear, uvN, oN, 0.02 * depth + 0.035 * rush, 0.8, glint, px / sN, 7.0 * depth * depth);
  // Fully opaque until the very end of the scroll, then gone by the last frame.
  near *= iNear * (1.0 - smoothstep(0.84, 0.97, uP));
  return near + far * (1.0 - near.a);
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 res = uRes / uDpr;
  float R = 0.14 * min(res.x, res.y);

  vec2 d = sp - uM;
  float r = length(d);
  float fall = exp(-(r * r) / (R * R * 2.0));
  float e = uE * mix(0.12, 1.0, smoothstep(0.0, 1.0, uP));

  float pull = e * 0.3 * R * R / (r * r + R * R * 0.35) * fall;
  vec2 dir = r > 0.001 ? d / r : vec2(0.0);
  float twist = e * 0.2 * fall * clamp(uV.x / 30.0, -1.0, 1.0);
  float cs = cos(twist), sn = sin(twist);
  vec2 dRot = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  vec2 warped = uM + dRot - dir * pull;

  // Light gathered by the lens: a magnification ring that brightens what is
  // actually there (streams, limb, rock rims) with a slight prism split.
  float ring = exp(-pow((r - R * 0.55) / (R * 0.16), 2.0));
  float ca = e * (1.2 * fall + 3.0 * ring);
  vec4 cg = scene(warped);
  vec3 col = cg.rgb;
  // The prism split only costs extra samples where the lens is actually active.
  if (ca > 0.05) {
    col.r = scene(warped + dir * ca).r;
    col.b = scene(warped - dir * ca).b;
  }
  col *= 1.0 + e * (0.55 * ring + 0.15 * fall);

  if (uLayer == 0) {
    // Small ghost flares thrown off the pointer through the screen centre.
    vec2 c = res * 0.5;
    float ghosts = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 gpos = c + (uM - c) * (-0.35 - 0.4 * fi);
      float gr = R * (0.05 + 0.035 * fi);
      ghosts += smoothstep(gr, gr * 0.35, length(sp - gpos)) * (0.07 - 0.012 * fi);
    }
    col += vec3(0.85, 0.92, 1.0) * ghosts * e;
    // Fine grain baked into the image: a little heavier on the bright strands.
    float lum = dot(col, vec3(0.3333));
    col += (hash(sp + fract(uT)) - 0.5) * ((3.0 + 9.0 * smoothstep(0.05, 0.6, lum)) / 255.0);
    gl_FragColor = vec4(col, 1.0);
  } else {
    // Keep the menu strip clear at rest; once scrolling, rocks pass over it faintly.
    float band = 1.0 - smoothstep(uMenuH - 6.0, uMenuH + 36.0, sp.y);
    float keep = 1.0 - band * (1.0 - 0.4 * min(1.0, uP * 14.0));
    gl_FragColor = vec4(col, cg.a) * keep;
  }
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Frame geometry, identical to the CSS .hero-frame rules in globals.css. */
export function frameGeometry(w: number, h: number) {
  const fw = Math.max(1.12 * w, (2000 / 1126) * h);
  const fh = fw / (2000 / 1126);
  const cx = w / h <= 1 ? 0.15 * w : 0.5 * w + 0.06 * w;
  return { cx, cy: h / 2, fw, fh };
}

const SOURCES = {
  planet: { files: ["/brand/planet-v2.webp"], uniforms: ["uPlanet"] },
  meteors: { files: ["/brand/meteors-far.webp", "/brand/meteors-near.webp"], uniforms: ["uFar", "uNear"] },
} as const;

export function HeroScene({
  layer,
  progress,
  clock,
  onReady,
  onFail,
  className,
}: {
  layer: "planet" | "meteors";
  progress: { current: number };
  /** Shared intro clock (ms timestamp) so both canvases animate in sync. */
  clock: { current: number };
  onReady?: () => void;
  onFail?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const transparent = layer === "meteors";
    const gl = canvas.getContext("webgl", { antialias: false, alpha: transparent, premultipliedAlpha: true });
    if (!gl) {
      onFail?.();
      return;
    }
    // Software rasterisers (no GPU) can't keep up with the shaders: use the image layers.
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|software/i.test(renderer) && !/[?&]gl=force\b/.test(window.location.search)) {
      onFail?.();
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let raf = 0;
    let visible = true;

    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    } catch {
      onFail?.();
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = { res: u("uRes"), fc: u("uFrameC"), fs: u("uFrameS"), p: u("uP"), t: u("uT"), m: u("uM"), v: u("uV"), e: u("uE"), dpr: u("uDpr"), s: u("uS"), menu: u("uMenuH") };
    gl.uniform1i(u("uLayer"), transparent ? 1 : 0);
    gl.clearColor(0, 0, 0, 0);

    // Pointer state: the lens follows the cursor closely, while its strength
    // builds up / settles slowly over a couple of seconds.
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, svx: 0, svy: 0, e: 0, target: 0, lx: 0, ly: 0, lt: 0 };
    let dpr = 1;
    const menuH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 84;
    // Scroll speed, smoothed, so streaks swell while you scroll and settle after.
    const scroll = { p: progress.current, t: 0, v: 0 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const g = frameGeometry(rect.width, rect.height);
      pointer.x += (pointer.tx - pointer.x) * 0.09;
      pointer.y += (pointer.ty - pointer.y) * 0.09;
      pointer.target *= 0.988;
      pointer.e += (pointer.target - pointer.e) * 0.012;
      pointer.svx += (pointer.vx - pointer.svx) * 0.015;
      pointer.svy += (pointer.vy - pointer.svy) * 0.015;
      pointer.vx *= 0.96;
      pointer.vy *= 0.96;
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.fc, g.cx, g.cy);
      gl.uniform2f(U.fs, g.fw, g.fh);
      gl.uniform1f(U.p, progress.current);
      gl.uniform1f(U.t, reduced ? 10 : (now - clock.current) / 1000);
      gl.uniform2f(U.m, pointer.x, pointer.y);
      gl.uniform2f(U.v, pointer.svx, pointer.svy);
      gl.uniform1f(U.e, reduced ? 0 : pointer.e);
      gl.uniform1f(U.dpr, dpr);
      const sdt = scroll.t ? Math.min(0.1, (now - scroll.t) / 1000) : 0;
      if (sdt > 0) {
        const inst = Math.abs(progress.current - scroll.p) / sdt;
        scroll.v += (inst - scroll.v) * (inst > scroll.v ? 0.12 : 0.05);
      }
      scroll.p = progress.current;
      scroll.t = now;
      gl.uniform1f(U.s, reduced ? 0 : scroll.v);
      gl.uniform1f(U.menu, menuH);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (visible && !document.hidden) draw(now);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const now = performance.now();
      const dt = Math.max(8, now - pointer.lt);
      const vx = ((x - pointer.lx) / dt) * 16;
      const vy = ((y - pointer.ly) / dt) * 16;
      pointer.vx = pointer.vx * 0.7 + vx * 0.3;
      pointer.vy = pointer.vy * 0.7 + vy * 0.3;
      pointer.lx = x;
      pointer.ly = y;
      pointer.lt = now;
      if (pointer.e < 0.005) {
        pointer.x = x;
        pointer.y = y;
      }
      pointer.tx = x;
      pointer.ty = y;
      pointer.target = Math.min(1, pointer.target + Math.min(0.04, Math.hypot(vx, vy) / 400));
    };

    const src = SOURCES[layer];
    Promise.all(src.files.map(loadImage))
      .then((imgs) => {
        if (disposed) return;
        imgs.forEach((img, i) => {
          const t = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.uniform1i(u(src.uniforms[i]!), i);
        });
        resize();
        if (!clock.current) clock.current = performance.now();
        onReady?.();
        raf = requestAnimationFrame(loop);
      })
      .catch(() => onFail?.());

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [layer, progress, clock, onReady, onFail]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
