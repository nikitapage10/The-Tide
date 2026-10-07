"use client";
/**
 * Cloud lab: a flat patch of cloud deck seen from orbit, with several different
 * interaction models to try side by side. Not part of the site's navigation.
 *
 *  1. Fluid:     a real 2D fluid (stable fluids with pressure and vorticity);
 *                the cursor is wind, and the cloud is dye carried by the air.
 *  2. Eddies:    the same fluid, but the cursor sheds pairs of counter-rotating
 *                eddies (like a wing tip), so cloud curls and tears apart.
 *  3. Particles: the deck is thousands of soft puffs; the cursor is a gust that
 *                scatters them, and they drift slowly back.
 *  4. Dissipate: the deck stays put; the cursor thins it and sheds small
 *                evaporating wisps (what the home hero does now).
 *  5. Nebula:    layered, glowing volumetric haze; the cursor stirs the air and
 *                the haze is re-drawn through the stirred coordinates.
 *  6. Curl flow: the deck drifts on a field of gentle eddies (curl noise); the
 *                cursor whips up local turbulence that billows the cloud apart.
 *  7. Wake:      the fluid with a thin, focused wind: the cursor leaves a narrow
 *                wake that slowly feathers apart, like a contrail.
 *  8. Puffs + air: soft puffs carried by a simple air simulation the cursor stirs.
 *  9. Light:     nothing moves; the cursor is a low light skimming the cloud
 *                tops, raising highlights and casting shadows.
 * 10. Layered:   all three together: a drifting cloud deck underneath that the
 *                cursor doesn't touch, a denser moving layer of puffs on top that
 *                the cursor stirs, and the cursor's light over both.
 */
import { useEffect, useRef, useState } from "react";
import { FlowSim } from "@/components/home/heroPhysics";

type Mode = "fluid" | "eddies" | "particles" | "dissipate" | "nebula" | "curl" | "wake" | "airpuffs" | "light" | "layered";

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "fluid", label: "1 · Fluid", note: "Real fluid: the cursor is wind, the cloud is carried by the air." },
  { id: "eddies", label: "2 · Eddies", note: "The cursor sheds counter-rotating eddies: clouds curl and tear." },
  { id: "particles", label: "3 · Particles", note: "The deck is soft puffs; the cursor is a gust that scatters them." },
  { id: "dissipate", label: "4 · Dissipate", note: "Cloud thins where you pass and sheds evaporating wisps." },
  { id: "nebula", label: "5 · Nebula", note: "Layered glowing haze; the cursor stirs it and light glows through the thin parts." },
  { id: "curl", label: "6 · Curl flow", note: "Clouds drift on gentle eddies; the cursor whips up turbulence that billows them apart." },
  { id: "wake", label: "7 · Wake", note: "A thin, focused wind: the cursor leaves a wake that slowly feathers apart." },
  { id: "airpuffs", label: "8 · Puffs + air", note: "Soft puffs carried by moving air that the cursor stirs." },
  { id: "light", label: "9 · Light", note: "Nothing moves: the cursor is a low light skimming the cloud tops." },
  { id: "layered", label: "10 · Layered", note: "Drifting deck below (untouched), moving puffs above that you stir, and the cursor's light on both." },
];

const VERT = `
attribute vec2 a;
varying vec2 vUv;
void main() { vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }
`;

const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return v / 0.97;
}
// The natural cloud deck (density 0..1) at a point (aspect-corrected units).
float deck(vec2 p) {
  vec2 w = vec2(fbm(p * 1.2), fbm(p * 1.2 + vec2(5.2, 1.3)));
  float b = fbm(p * 2.2 + 0.5 * w);
  float d = fbm(p * 9.0 + 2.0 * w);
  return smoothstep(0.44, 0.74, b + (d - 0.5) * 0.35);
}
`;

const ADVECT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel, uSrc;
uniform float uDt, uDecay;
void main() {
  vec2 back = vUv - uDt * texture2D(uVel, vUv).xy;
  gl_FragColor = uDecay * texture2D(uSrc, back);
}
`;

// Dye advection that also relaxes toward the natural deck (recovery).
const ADVECT_DYE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel, uSrc;
uniform float uDt, uK, uAspect;
${NOISE}
void main() {
  vec2 back = vUv - uDt * texture2D(uVel, vUv).xy;
  float d = texture2D(uSrc, back).r;
  float target = deck(vec2(vUv.x * uAspect, vUv.y) * 2.0);
  gl_FragColor = vec4(mix(d, target, uK), 0.0, 0.0, 1.0);
}
`;

const SPLAT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius, uAspect, uKind;
void main() {
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  float g = exp(-dot(d, d) / uRadius);
  vec3 base = texture2D(uTarget, vUv).xyz;
  if (uKind > 0.5) {
    // A spinning eddy (uValue.x = spin, sign = direction).
    vec2 t = vec2(-d.y, d.x) / max(length(d), 1e-4);
    gl_FragColor = vec4(base + vec3(t * uValue.x * g * min(1.0, length(d) * 40.0), 0.0), 1.0);
  } else {
    gl_FragColor = vec4(base + uValue * g, 1.0);
  }
}
`;

const CURL = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float l = texture2D(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float r = texture2D(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float b = texture2D(uVel, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uVel, vUv + vec2(0.0, uTexel.y)).x;
  gl_FragColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}
`;

const VORTICITY = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel, uCurl;
uniform vec2 uTexel;
uniform float uStrength, uDt;
void main() {
  float l = texture2D(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float c = texture2D(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  f /= length(f) + 1e-4;
  f *= uStrength * c * vec2(1.0, -1.0);
  vec2 v = texture2D(uVel, vUv).xy + f * uDt;
  gl_FragColor = vec4(clamp(v, -1.0, 1.0), 0.0, 1.0);
}
`;

const DIVERGENCE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float l = texture2D(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uVel, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture2D(uVel, vUv + vec2(0.0, uTexel.y)).y;
  gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
`;

const PRESSURE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uP, uDiv;
uniform vec2 uTexel;
void main() {
  float l = texture2D(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uP, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uP, vUv + vec2(0.0, uTexel.y)).x;
  float d = texture2D(uDiv, vUv).x;
  gl_FragColor = vec4((l + r + b + t - d) * 0.25, 0.0, 0.0, 1.0);
}
`;

const GRADIENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uP, uVel;
uniform vec2 uTexel;
void main() {
  float l = texture2D(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uP, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uP, vUv + vec2(0.0, uTexel.y)).x;
  vec2 v = texture2D(uVel, vUv).xy - 0.5 * vec2(r - l, t - b);
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

// Final image: dark ocean and land under lit, shadow-casting cloud.
const DISPLAY = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDye;
uniform float uAspect, uUseDye;
uniform vec2 uTexel;
${NOISE}
float cloudAt(vec2 uv) {
  return uUseDye > 0.5 ? texture2D(uDye, uv).r : 0.0;
}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float land = smoothstep(0.52, 0.56, fbm(p * 1.6 + 20.0));
  vec3 ground = mix(vec3(0.07, 0.085, 0.1), vec3(0.16, 0.17, 0.17) * (0.8 + 0.4 * fbm(p * 12.0)), land);
  float c = cloudAt(vUv);
  // Cloud fine texture, so the dye reads as cloud rather than smoke.
  float tex = fbm(p * 22.0) * 0.5 + fbm(p * 50.0) * 0.5;
  float dens = smoothstep(0.05, 0.85, c * (0.75 + 0.5 * tex));
  vec2 sunOff = vec2(-1.0, 1.0) * uTexel * 6.0;
  float shadow = smoothstep(0.05, 0.85, cloudAt(vUv + sunOff));
  ground *= 1.0 - 0.5 * shadow * (1.0 - dens);
  float hx = cloudAt(vUv + vec2(uTexel.x * 2.0, 0.0)) - cloudAt(vUv - vec2(uTexel.x * 2.0, 0.0));
  float hy = cloudAt(vUv + vec2(0.0, uTexel.y * 2.0)) - cloudAt(vUv - vec2(0.0, uTexel.y * 2.0));
  float lit = clamp(0.75 + (-hx + hy) * 6.0, 0.4, 1.15);
  vec3 cloud = vec3(0.9, 0.93, 0.97) * lit * (0.75 + 0.35 * tex);
  vec3 col = mix(ground, cloud, dens);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Reference map (RG = the coordinates the haze is drawn from), carried by the
// air and relaxing back to the identity.
const ADVECT_MAP = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel, uSrc;
uniform float uDt, uK;
void main() {
  vec2 back = vUv - uDt * texture2D(uVel, vUv).xy;
  vec2 m = texture2D(uSrc, back).xy;
  gl_FragColor = vec4(mix(m, vUv, uK), 0.0, 1.0);
}
`;

const NEBULA = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uAspect, uT;
uniform vec2 uM;
${NOISE}
void main() {
  vec2 q = texture2D(uMap, vUv).xy;
  vec2 p = vec2(q.x * uAspect, q.y) * 1.7;
  float t = uT * 0.02;
  vec2 w = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  float n1 = fbm(p * 1.4 + 2.2 * w);
  float n2 = fbm(p * 3.1 - 1.4 * w + vec2(t * 2.0, 0.0));
  float n3 = fbm(p * 7.0 + 3.0 * w);
  // Back layer: broad dim dust; mid layer: brighter filaments; front: wisps.
  float back = smoothstep(0.3, 0.9, n1);
  float mid = smoothstep(0.5, 0.85, n2) * (0.6 + 0.6 * n3);
  float front = smoothstep(0.62, 0.9, n3) * smoothstep(0.4, 0.7, n1);
  // Light glowing through where the haze is thin (the edges of the clouds).
  float rim = smoothstep(0.35, 0.55, n1) * (1.0 - smoothstep(0.55, 0.8, n1));
  vec2 dm = vec2((vUv.x - uM.x) * uAspect, vUv.y - uM.y);
  float near = exp(-dot(dm, dm) / 0.03);
  vec3 col = vec3(0.012, 0.016, 0.024);
  // Faint stars behind, dimmed by the haze.
  vec2 sg = vUv * vec2(uAspect, 1.0) * 220.0;
  vec2 si = floor(sg);
  float st = step(0.985, hash(si)) * exp(-dot(sg - si - 0.5, sg - si - 0.5) * 6.0);
  col += vec3(0.8, 0.85, 0.95) * st * (1.0 - back) * 0.7;
  col += vec3(0.32, 0.36, 0.44) * back * 0.55;
  col += vec3(0.62, 0.68, 0.78) * mid * 0.45;
  col += vec3(0.85, 0.88, 0.95) * front * 0.35;
  col += vec3(0.7, 0.78, 0.95) * rim * (0.12 + 0.5 * near);
  col *= 1.0 + 0.35 * near;
  gl_FragColor = vec4(col, 1.0);
}
`;

// Velocity from curl noise (drift of gentle eddies), plus cursor turbulence.
const CURLVEL = `
precision highp float;
varying vec2 vUv;
uniform float uAspect, uT, uStir, uRad;
uniform vec2 uM;
${NOISE}
float psi(vec2 p, float s) { return fbm(p * s + vec2(uT * 0.05, -uT * 0.03)); }
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float e = 0.004;
  float a = psi(p + vec2(0.0, e), 2.0) - psi(p - vec2(0.0, e), 2.0);
  float b = psi(p + vec2(e, 0.0), 2.0) - psi(p - vec2(e, 0.0), 2.0);
  vec2 v = vec2(a, -b) / (2.0 * e) * 0.004;
  vec2 dm = vec2((vUv.x - uM.x) * uAspect, vUv.y - uM.y);
  float g = exp(-dot(dm, dm) / uRad) * uStir;
  if (g > 0.001) {
    float a2 = psi(p + vec2(0.0, e), 14.0) - psi(p - vec2(0.0, e), 14.0);
    float b2 = psi(p + vec2(e, 0.0), 14.0) - psi(p - vec2(e, 0.0), 14.0);
    v += vec2(a2, -b2) / (2.0 * e) * 0.02 * g;
  }
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

// A low light at the cursor skimming the (static) cloud tops.
const LIGHT = `
precision highp float;
varying vec2 vUv;
uniform float uAspect;
uniform vec2 uM;
uniform float uOn;
${NOISE}
float h(vec2 uv) { return deck(vec2(uv.x * uAspect, uv.y) * 2.0); }
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float land = smoothstep(0.52, 0.56, fbm(p * 1.6 + 20.0));
  vec3 ground = mix(vec3(0.07, 0.085, 0.1), vec3(0.16, 0.17, 0.17), land);
  float d = h(vUv);
  float tex = fbm(p * 22.0) * 0.5 + fbm(p * 50.0) * 0.5;
  float hgt = d * (0.75 + 0.5 * tex);
  float e = 0.003;
  float hx = h(vUv + vec2(e, 0.0)) - h(vUv - vec2(e, 0.0));
  float hy = h(vUv + vec2(0.0, e)) - h(vUv - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx * 6.0, -hy * 6.0, 1.0));
  vec3 lp = vec3((uM.x - vUv.x) * uAspect, uM.y - vUv.y, 0.12);
  float dist = length(lp);
  vec3 L = lp / dist;
  float diff = clamp(dot(n, L), 0.0, 1.0) / (1.0 + dist * dist * 18.0);
  // Soft shadow: march toward the light over the height field.
  float shade = 1.0;
  for (int i = 1; i <= 10; i++) {
    float t = float(i) / 10.0;
    vec2 sp = mix(vUv, uM, t * 0.35);
    float hh = h(sp);
    float rayH = hgt + t * 0.35 * 0.6;
    shade = min(shade, 1.0 - smoothstep(0.0, 0.25, hh - rayH) * 0.8);
  }
  vec3 base = mix(ground, vec3(0.55, 0.58, 0.62) * (0.7 + 0.3 * tex), smoothstep(0.05, 0.85, hgt));
  vec3 col = base * (0.55 + 1.3 * diff * shade * uOn) + vec3(0.9, 0.93, 1.0) * pow(diff, 3.0) * 0.4 * uOn;
  gl_FragColor = vec4(col, 1.0);
}
`;

// Layered mode, bottom: the planet's own clouds, using the same formulas,
// drift speed and lighting as the home page, over a patch of the planet
// artwork. Not affected by the cursor, apart from its light.
const LAYER_BASE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPlanet;
uniform float uAspect, uT, uLight;
uniform vec2 uM;
${NOISE}
float fbm5(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return v / 0.97;
}
vec2 coords(vec2 uv) { return vec2(uv.x * uAspect, uv.y) * 2.0 + vec2(uT * 0.012, uT * 0.003); }
float cbase(vec2 p) {
  vec2 w = vec2(fbm(p * 0.8 + vec2(0.0, uT * 0.02)), fbm(p * 0.8 + vec2(5.2, 1.3 - uT * 0.017)));
  return fbm5(p * 1.7 + 0.45 * w);
}
float cdens(vec2 p) {
  float detail = fbm5(p * 5.0 + vec2(uT * 0.04, 0.0));
  return smoothstep(0.43, 0.73, cbase(p) + (detail - 0.5) * 0.4);
}
void main() {
  // A patch of the planet artwork (the lit middle of the disc).
  vec2 img = vec2(mix(1260.0, 1880.0, vUv.x), mix(820.0, 360.0, vUv.y)) / vec2(2000.0, 1126.0);
  vec3 col = texture2D(uPlanet, img).rgb;
  vec2 pw = coords(vUv);
  vec2 sunStep = normalize(vec2(-0.85, -0.35)) * 0.035;
  float dens = cdens(pw);
  float densSun = cdens(pw + sunStep);
  col *= 1.0 - 0.4 * densSun * (1.0 - dens);
  float tops = fbm5(pw * 18.0 + vec2(uT * 0.05, 0.0));
  float shade = clamp(0.8 - (densSun - dens) * 1.4, 0.35, 1.0);
  float bright = 0.7 * shade * (0.72 + 0.4 * tops);
  vec3 cloudCol = mix(vec3(0.6, 0.66, 0.74), vec3(0.97, 0.98, 1.0), smoothstep(0.1, 0.8, dens)) * bright;
  col = mix(col, cloudCol, pow(dens, 1.3) * 0.8);
  // The cursor's light, raised on the cloud tops.
  vec2 dl = vec2((uM.x - vUv.x) * uAspect, uM.y - vUv.y);
  float near = exp(-dot(dl, dl) / 0.05);
  float face = clamp(0.5 + (densSun - dens) * -3.0, 0.0, 1.0);
  col *= 1.0 + uLight * near * (0.25 + 0.6 * dens * face);
  gl_FragColor = vec4(col, 1.0);
}
`;

const PUFF_VERT = `
attribute vec4 aP;     // x, y (uv); size px; alpha
varying float vA;
varying float vSeed;
uniform float uDpr, uAspect, uLight, uSoft;
varying float vSoft;
uniform vec2 uM;
varying float vL;
varying vec2 vToLight;
void main() {
  gl_Position = vec4(aP.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = floor(aP.z) * uDpr;
  vA = aP.w;
  vec2 dl = vec2((uM.x - aP.x) * uAspect, uM.y - aP.y);
  vL = uLight * exp(-dot(dl, dl) / 0.025);
  vToLight = normalize(dl + 1e-4);
  vSoft = uSoft;
  // A fixed seed per puff (deriving it from the position made puffs strobe).
  vSeed = fract(aP.z);
}
`;

const PUFF_FRAG = `
precision mediump float;
varying float vA;
varying float vSeed;
varying float vL;
varying vec2 vToLight;
varying float vSoft;
float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n1(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = length(c);
  if (d > 1.0) discard;
  float n = n1(c * 2.4 + vSeed * 40.0) * 0.6 + n1(c * 5.0 + vSeed * 13.0) * 0.4;
  float puff = smoothstep(1.0, 0.25, d) * smoothstep(0.2, 0.7, n + 0.3 * (1.0 - d));
  // Soft mode: broad, wispy sheets that blend into each other.
  puff = mix(puff, pow(1.0 - d, 1.6) * (0.55 + 0.6 * n), vSoft);
  float lit = 0.8 + 0.25 * (-c.x - c.y) * 0.5;
  // The cursor's light: the side of each puff facing it brightens.
  vec2 cf = vec2(c.x, -c.y);
  lit += vL * (0.5 + 0.9 * clamp(dot(cf, vToLight), 0.0, 1.0) * (1.0 - d * 0.3));
  float a = clamp(puff * vA, 0.0, 1.0);
  gl_FragColor = vec4(vec3(0.9, 0.93, 0.97) * lit * a, a);
}
`;

// CPU copy of the deck function (for placing particles where there is cloud).
function hash(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number) {
  let v = 0, a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(x, y);
    const nx = x * 2.02 + 3.1, ny = y * 2.02 + 1.7;
    x = nx;
    y = ny;
    a *= 0.5;
  }
  return v / 0.97;
}
function deck(x: number, y: number) {
  const wx = fbm(x * 1.2, y * 1.2), wy = fbm(x * 1.2 + 5.2, y * 1.2 + 1.3);
  const b = fbm(x * 2.2 + 0.5 * wx, y * 2.2 + 0.5 * wy);
  const d = fbm(x * 9 + 2 * wx, y * 9 + 2 * wy);
  const v = b + (d - 0.5) * 0.35;
  const t = Math.min(1, Math.max(0, (v - 0.44) / 0.3));
  return t * t * (3 - 2 * t);
}

export function CloudLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("fluid");
  const [strength, setStrength] = useState(0.5);
  const [radius, setRadius] = useState(0.5);
  const [recover, setRecover] = useState(0.3);
  const [resetKey, setResetKey] = useState(0);
  const params = useRef({ mode, strength, radius, recover });
  useEffect(() => {
    params.current = { mode, strength, radius, recover };
  }, [mode, strength, radius, recover]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      queueMicrotask(() => setError("WebGL is not available in this browser."));
      return;
    }
    const half = gl.getExtension("OES_texture_half_float");
    gl.getExtension("OES_texture_half_float_linear");
    const full = gl.getExtension("OES_texture_float");
    gl.getExtension("OES_texture_float_linear");
    const texType = half ? half.HALF_FLOAT_OES : full ? gl.FLOAT : gl.UNSIGNED_BYTE;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const program = (vs: string, fs: string) => {
      const p = gl.createProgram()!;
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, "a");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
      const cache = new Map<string, WebGLUniformLocation | null>();
      return {
        p,
        u: (n: string) => {
          if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n));
          return cache.get(n)!;
        },
      };
    };

    let P: Record<string, ReturnType<typeof program>>;
    try {
      P = {
        advect: program(VERT, ADVECT),
        advectDye: program(VERT, ADVECT_DYE),
        splat: program(VERT, SPLAT),
        curl: program(VERT, CURL),
        vort: program(VERT, VORTICITY),
        div: program(VERT, DIVERGENCE),
        pres: program(VERT, PRESSURE),
        grad: program(VERT, GRADIENT),
        display: program(VERT, DISPLAY),
        puff: program(PUFF_VERT, PUFF_FRAG),
        advectMap: program(VERT, ADVECT_MAP),
        nebula: program(VERT, NEBULA),
        curlVel: program(VERT, CURLVEL),
        light: program(VERT, LIGHT),
        layerBase: program(VERT, LAYER_BASE),
      };
    } catch (e) {
      queueMicrotask(() => setError(String(e)));
      return;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const bindQuad = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    };

    type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };
    const target = (w: number, h: number): Target => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, texType, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h };
    };
    type Pair = { read: Target; write: Target; swap(): void };
    const pair = (w: number, h: number): Pair => {
      const state = { r: target(w, h), w: target(w, h) };
      return {
        get read() {
          return state.r;
        },
        get write() {
          return state.w;
        },
        swap() {
          const t = state.r;
          state.r = state.w;
          state.w = t;
        },
      };
    };

    const SIM = 192;
    const DYE = 640;
    const vel = pair(SIM, SIM);
    const dye = pair(DYE, DYE);
    const pres = pair(SIM, SIM);
    const curlT = target(SIM, SIM);
    const divT = target(SIM, SIM);

    const draw = (t: Target | null, w: number, h: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const tex = (unit: number, t: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      return unit;
    };

    let aspect = 1;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      aspect = canvas.width / Math.max(1, canvas.height);
    };
    resize();

    // Fill the dye with the natural deck (one advection step with full recovery).
    const resetDye = () => {
      bindQuad();
      if (params.current.mode === "nebula") {
        gl.useProgram(P.advectMap!.p);
        gl.uniform1i(P.advectMap!.u("uVel"), tex(0, vel.read.tex));
        gl.uniform1i(P.advectMap!.u("uSrc"), tex(1, dye.read.tex));
        gl.uniform1f(P.advectMap!.u("uDt"), 0);
        gl.uniform1f(P.advectMap!.u("uK"), 1);
        draw(dye.write, DYE, DYE);
        dye.swap();
        gl.bindFramebuffer(gl.FRAMEBUFFER, vel.read.fb);
        gl.viewport(0, 0, SIM, SIM);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      gl.useProgram(P.advectDye!.p);
      gl.uniform1i(P.advectDye!.u("uVel"), tex(0, vel.read.tex));
      gl.uniform1i(P.advectDye!.u("uSrc"), tex(1, dye.read.tex));
      gl.uniform1f(P.advectDye!.u("uDt"), 0);
      gl.uniform1f(P.advectDye!.u("uK"), 1);
      gl.uniform1f(P.advectDye!.u("uAspect"), aspect);
      draw(dye.write, DYE, DYE);
      dye.swap();
      // Also clear velocity.
      gl.bindFramebuffer(gl.FRAMEBUFFER, vel.read.fb);
      gl.viewport(0, 0, SIM, SIM);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    resetDye();

    // Particles (modes 3 and 4).
    const MAXP = 7000;
    const pA = new Float32Array(MAXP * 4);
    const homes = new Float32Array(MAXP * 2);
    const pv = new Float32Array(MAXP * 2);
    let pCount = 0;
    const placeDeck = () => {
      pCount = 0;
      let tries = 0;
      const layered = params.current.mode === "layered";
      const want = layered ? 2600 : 5200;
      while (pCount < want && tries < 90000) {
        tries++;
        const x = Math.random(), y = Math.random();
        // The top layer is its own cloud system (a different pattern from the deck).
        const d = layered ? deck(x * aspect * 1.6 + 7.3, y * 1.6 + 3.1) : deck(x * aspect * 2, y * 2);
        if (Math.random() > d) continue;
        const i = pCount++;
        homes[i * 2] = x;
        homes[i * 2 + 1] = y;
        const size = Math.floor(layered ? 34 + Math.random() * 46 : 10 + Math.random() * 16) + Math.random() * 0.98;
        pA.set([x, y, size, layered ? 0.06 + 0.14 * d : 0.18 + 0.3 * d], i * 4);
        pv[i * 2] = pv[i * 2 + 1] = 0;
      }
    };
    placeDeck();
    // Wisps for mode 4 (separate pool appended after nothing; reuse arrays).
    const wisps: { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; a: number }[] = [];
    const puffBuf = gl.createBuffer();
    // The planet artwork, for the Layered mode's ground.
    const planetTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, planetTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([12, 14, 18, 255]));
    {
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, planetTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      };
      img.src = "/brand/planet-v2.webp";
    }
    let stir = 0;
    let air = new FlowSim();

    const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false, inside: false };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width;
      pointer.y = 1 - (e.clientY - r.top) / r.height;
      pointer.inside = pointer.x >= 0 && pointer.x <= 1 && pointer.y >= 0 && pointer.y <= 1;
      pointer.moved = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize);

    const splat = (t: Pair, w: number, h: number, x: number, y: number, v: [number, number, number], r: number, kind = 0) => {
      gl.useProgram(P.splat!.p);
      gl.uniform1i(P.splat!.u("uTarget"), tex(0, t.read.tex));
      gl.uniform2f(P.splat!.u("uPoint"), x, y);
      gl.uniform3f(P.splat!.u("uValue"), v[0], v[1], v[2]);
      gl.uniform1f(P.splat!.u("uRadius"), r);
      gl.uniform1f(P.splat!.u("uAspect"), aspect);
      gl.uniform1f(P.splat!.u("uKind"), kind);
      draw(t.write, w, h);
      t.swap();
    };

    let last = performance.now();
    let raf = 0;
    let lastMode: Mode = params.current.mode;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const { mode, strength, radius, recover } = params.current;
      if (mode !== lastMode) {
        lastMode = mode;
        resetDye();
        placeDeck();
        wisps.length = 0;
        air = new FlowSim();
        stir = 0;
      }
      bindQuad();
      const dx = pointer.x - pointer.px, dy = pointer.y - pointer.py;
      const moving = pointer.moved && pointer.inside && Math.hypot(dx, dy) > 1e-5;
      const texel: [number, number] = [1 / SIM, 1 / SIM];
      const rad = 0.00015 + radius * 0.0012;

      const fluidLike = mode === "fluid" || mode === "eddies" || mode === "wake" || mode === "nebula";
      if (fluidLike || mode === "dissipate" || mode === "curl") {
        // Forces.
        if (moving && mode === "wake") {
          splat(vel, SIM, SIM, pointer.x, pointer.y, [dx * 70 * strength, dy * 70 * strength, 0], rad * 0.18);
        }
        if (moving && mode === "nebula") {
          splat(vel, SIM, SIM, pointer.x, pointer.y, [dx * 40 * strength, dy * 40 * strength, 0], rad * 1.5);
          splat(vel, SIM, SIM, pointer.x, pointer.y, [3 * strength * Math.min(1, Math.hypot(dx, dy) * 80), 0, 0], rad * 1.2, 1);
        }
        if (mode === "curl") {
          stir = Math.min(1.5, stir * Math.exp(-dt * 1.2) + (moving ? Math.hypot(dx, dy) * 40 * strength : 0));
          gl.useProgram(P.curlVel!.p);
          gl.uniform1f(P.curlVel!.u("uAspect"), aspect);
          gl.uniform1f(P.curlVel!.u("uT"), now / 1000);
          gl.uniform1f(P.curlVel!.u("uStir"), stir);
          gl.uniform1f(P.curlVel!.u("uRad"), rad * 3);
          gl.uniform2f(P.curlVel!.u("uM"), pointer.x, pointer.y);
          draw(vel.write, SIM, SIM);
          vel.swap();
        }
        if (moving && mode === "fluid") {
          splat(vel, SIM, SIM, pointer.x, pointer.y, [dx * 60 * strength * 2, dy * 60 * strength * 2, 0], rad);
        }
        if (moving && mode === "eddies") {
          const len = Math.hypot(dx, dy * (1 / aspect)) || 1;
          const nx = -dy / len, ny = dx / len;
          const off = Math.sqrt(rad) * 0.9;
          splat(vel, SIM, SIM, pointer.x, pointer.y, [dx * 25 * strength, dy * 25 * strength, 0], rad);
          splat(vel, SIM, SIM, pointer.x + nx * off / aspect, pointer.y + ny * off, [8 * strength * Math.min(1, len * 60), 0, 0], rad * 0.6, 1);
          splat(vel, SIM, SIM, pointer.x - nx * off / aspect, pointer.y - ny * off, [-8 * strength * Math.min(1, len * 60), 0, 0], rad * 0.6, 1);
        }
        if (moving && mode === "dissipate") {
          splat(dye, DYE, DYE, pointer.x, pointer.y, [-0.12 * strength, 0, 0], rad * 0.8);
          for (let i = 0; i < 6; i++) {
            const t = Math.random();
            const sx = pointer.x - dx * t + (Math.random() - 0.5) * 0.03;
            const sy = pointer.y - dy * t + (Math.random() - 0.5) * 0.03;
            const d = deck(sx * aspect * 2, sy * 2);
            if (d < 0.1) continue;
            const side = Math.random() < 0.5 ? -1 : 1;
            wisps.push({
              x: sx,
              y: sy,
              vx: dx * (0.2 + Math.random() * 0.4) * 60 - dy * side * 30 * Math.random(),
              vy: dy * (0.2 + Math.random() * 0.4) * 60 + dx * side * 30 * Math.random(),
              age: 0,
              life: 1 + Math.random() * 1.6,
              size: 6 + Math.random() * 10,
              a: 0.35 * d,
            });
          }
          if (wisps.length > 1500) wisps.splice(0, wisps.length - 1500);
        }

        if (fluidLike) {
          // Vorticity (keeps the swirls alive), pressure projection, advection.
          gl.useProgram(P.curl!.p);
          gl.uniform1i(P.curl!.u("uVel"), tex(0, vel.read.tex));
          gl.uniform2f(P.curl!.u("uTexel"), ...texel);
          draw(curlT, SIM, SIM);
          gl.useProgram(P.vort!.p);
          gl.uniform1i(P.vort!.u("uVel"), tex(0, vel.read.tex));
          gl.uniform1i(P.vort!.u("uCurl"), tex(1, curlT.tex));
          gl.uniform2f(P.vort!.u("uTexel"), ...texel);
          gl.uniform1f(P.vort!.u("uStrength"), mode === "eddies" ? 30 : mode === "wake" ? 45 : 12);
          gl.uniform1f(P.vort!.u("uDt"), dt);
          draw(vel.write, SIM, SIM);
          vel.swap();
          gl.useProgram(P.div!.p);
          gl.uniform1i(P.div!.u("uVel"), tex(0, vel.read.tex));
          gl.uniform2f(P.div!.u("uTexel"), ...texel);
          draw(divT, SIM, SIM);
          gl.useProgram(P.pres!.p);
          gl.uniform2f(P.pres!.u("uTexel"), ...texel);
          gl.uniform1i(P.pres!.u("uDiv"), tex(1, divT.tex));
          for (let i = 0; i < 20; i++) {
            gl.uniform1i(P.pres!.u("uP"), tex(0, pres.read.tex));
            draw(pres.write, SIM, SIM);
            pres.swap();
          }
          gl.useProgram(P.grad!.p);
          gl.uniform1i(P.grad!.u("uP"), tex(0, pres.read.tex));
          gl.uniform1i(P.grad!.u("uVel"), tex(1, vel.read.tex));
          gl.uniform2f(P.grad!.u("uTexel"), ...texel);
          draw(vel.write, SIM, SIM);
          vel.swap();
          gl.useProgram(P.advect!.p);
          gl.uniform1i(P.advect!.u("uVel"), tex(0, vel.read.tex));
          gl.uniform1i(P.advect!.u("uSrc"), tex(1, vel.read.tex));
          gl.uniform1f(P.advect!.u("uDt"), dt);
          gl.uniform1f(P.advect!.u("uDecay"), Math.exp(-dt * 0.9));
          draw(vel.write, SIM, SIM);
          vel.swap();
        }
        if (mode === "nebula") {
          gl.useProgram(P.advectMap!.p);
          gl.uniform1i(P.advectMap!.u("uVel"), tex(0, vel.read.tex));
          gl.uniform1i(P.advectMap!.u("uSrc"), tex(1, dye.read.tex));
          gl.uniform1f(P.advectMap!.u("uDt"), dt);
          gl.uniform1f(P.advectMap!.u("uK"), 1 - Math.exp(-dt * recover * recover * 1.5));
          draw(dye.write, DYE, DYE);
          dye.swap();
        } else {
        gl.useProgram(P.advectDye!.p);
        gl.uniform1i(P.advectDye!.u("uVel"), tex(0, vel.read.tex));
        gl.uniform1i(P.advectDye!.u("uSrc"), tex(1, dye.read.tex));
        gl.uniform1f(P.advectDye!.u("uDt"), mode === "dissipate" ? 0 : dt);
        // Recovery: how quickly the deck returns to its natural shape (0 = never).
        gl.uniform1f(P.advectDye!.u("uK"), 1 - Math.exp(-dt * recover * recover * 1.5));
        gl.uniform1f(P.advectDye!.u("uAspect"), aspect);
        draw(dye.write, DYE, DYE);
        dye.swap();
        }
      }

      // Puffs + air: a simple air simulation (the hero's) carries the puffs.
      if (mode === "airpuffs" || mode === "layered") {
        const layered = mode === "layered";
        // Layered: the whole top system drifts with a steady wind (and wraps).
        // Same direction and speed as the deck below (its coords drift +0.012, +0.003).
        const wx0 = layered ? -0.006 / aspect : 0, wy0 = layered ? -0.0015 : 0;
        const mx = pointer.x * 2 - 1, my = pointer.y * 2 - 1;
        air.step(mx, my, moving ? dx * 2 * (0.5 + strength) : 0, moving ? dy * 2 * (0.5 + strength) : 0, dt * 60);
        const k = 0.1 + recover * 1.0;
        for (let i = 0; i < pCount; i++) {
          const o = i * 4;
          let x = pA[o]!, y = pA[o + 1]!;
          const [ax, ay] = air.velocityAt(x * 2 - 1, y * 2 - 1);
          // Air velocity (disc units per frame) → uv per second.
          const gain = (layered ? 110 : 30) * (1 + 2 * strength);
          const wx = ax * gain, wy = ay * gain;
          let vx = pv[i * 2]!, vy = pv[i * 2 + 1]!;
          vx += (wx - vx) * Math.min(1, dt * (2 + 6 * hash(i, 3)));
          vy += (wy - vy) * Math.min(1, dt * (2 + 6 * hash(i, 4)));
          if (layered) {
            let hx = homes[i * 2]! + wx0 * dt, hy = homes[i * 2 + 1]! + wy0 * dt;
            if (hx < -0.05) { hx += 1.1; x += 1.1; }
            if (hy < -0.05) { hy += 1.1; y += 1.1; }
            homes[i * 2] = hx;
            homes[i * 2 + 1] = hy;
          }
          vx += (homes[i * 2]! - x) * k * dt;
          vy += (homes[i * 2 + 1]! - y) * k * dt;
          x += (vx + wx0) * dt;
          y += (vy + wy0) * dt;
          pA[o] = x;
          pA[o + 1] = y;
          pv[i * 2] = vx;
          pv[i * 2 + 1] = vy;
        }
      }

      // Particles (mode 3): a gust scatters puffs; they drift back.
      if (mode === "particles") {
        const R = 0.03 + radius * 0.09;
        const k = 0.15 + recover * 1.2;
        for (let i = 0; i < pCount; i++) {
          const o = i * 4;
          let x = pA[o]!, y = pA[o + 1]!;
          let vx = pv[i * 2]!, vy = pv[i * 2 + 1]!;
          if (moving) {
            const ex = (x - pointer.x) * aspect, ey = y - pointer.y;
            const d2 = ex * ex + ey * ey;
            if (d2 < R * R) {
              const w = 1 - Math.sqrt(d2) / R;
              const d = Math.sqrt(d2) || 1e-4;
              vx += (dx * 18 * strength + (ex / d) * 0.25 * strength * Math.hypot(dx, dy) * 40) * w * (0.6 + 0.8 * hash(i, 1));
              vy += (dy * 18 * strength + (ey / d) * 0.25 * strength * Math.hypot(dx, dy) * 40) * w * (0.6 + 0.8 * hash(i, 2));
            }
          }
          vx = (vx + (homes[i * 2]! - x) * k * dt) * Math.exp(-dt * 2.2);
          vy = (vy + (homes[i * 2 + 1]! - y) * k * dt) * Math.exp(-dt * 2.2);
          x += vx * dt;
          y += vy * dt;
          pA[o] = x;
          pA[o + 1] = y;
          pv[i * 2] = vx;
          pv[i * 2 + 1] = vy;
        }
      }

      // Wisps (mode 4).
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i]!;
        w.age += dt / w.life;
        w.vx *= Math.exp(-dt * 2.5);
        w.vy *= Math.exp(-dt * 2.5);
        w.x += (w.vx / 60) * dt * 3;
        w.y += (w.vy / 60) * dt * 3;
        if (w.age >= 1) wisps.splice(i, 1);
      }

      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.moved = false;

      // Display.
      bindQuad();
      const puffMode = mode === "particles" || mode === "airpuffs" || mode === "layered";
      const lightAmt = pointer.inside ? 0.4 + strength * 0.6 : 0;
      if (mode === "nebula") {
        gl.useProgram(P.nebula!.p);
        gl.uniform1i(P.nebula!.u("uMap"), tex(0, dye.read.tex));
        gl.uniform1f(P.nebula!.u("uAspect"), aspect);
        gl.uniform1f(P.nebula!.u("uT"), now / 1000);
        gl.uniform2f(P.nebula!.u("uM"), pointer.x, pointer.y);
      } else if (mode === "layered") {
        gl.useProgram(P.layerBase!.p);
        gl.uniform1f(P.layerBase!.u("uAspect"), aspect);
        gl.uniform1f(P.layerBase!.u("uT"), now / 1000);
        gl.uniform1f(P.layerBase!.u("uLight"), lightAmt);
        gl.uniform2f(P.layerBase!.u("uM"), pointer.x, pointer.y);
        gl.uniform1i(P.layerBase!.u("uPlanet"), tex(2, planetTex));
      } else if (mode === "light") {
        gl.useProgram(P.light!.p);
        gl.uniform1f(P.light!.u("uAspect"), aspect);
        gl.uniform2f(P.light!.u("uM"), pointer.x, pointer.y);
        gl.uniform1f(P.light!.u("uOn"), pointer.inside ? 0.6 + strength * 0.8 : 0.0);
      } else {
        gl.useProgram(P.display!.p);
        gl.uniform1i(P.display!.u("uDye"), tex(0, dye.read.tex));
        gl.uniform1f(P.display!.u("uAspect"), aspect);
        gl.uniform1f(P.display!.u("uUseDye"), puffMode ? 0 : 1);
        gl.uniform2f(P.display!.u("uTexel"), 1 / DYE, 1 / DYE);
      }
      draw(null, canvas.width, canvas.height);

      const puffs = puffMode ? pCount : mode === "dissipate" ? wisps.length : 0;
      if (puffs > 0) {
        const data = puffMode ? pA.subarray(0, pCount * 4) : new Float32Array(wisps.length * 4);
        if (!puffMode)
          wisps.forEach((w, i) => data.set([w.x, w.y, w.size * (1 + w.age), w.a * Math.sin(Math.PI * Math.min(1, w.age * 1.2 + 0.05))], i * 4));
        gl.useProgram(P.puff!.p);
        gl.uniform1f(P.puff!.u("uDpr"), dpr);
        gl.uniform1f(P.puff!.u("uAspect"), aspect);
        gl.uniform2f(P.puff!.u("uM"), pointer.x, pointer.y);
        gl.uniform1f(P.puff!.u("uLight"), mode === "layered" ? lightAmt : 0);
        gl.uniform1f(P.puff!.u("uSoft"), mode === "layered" ? 1 : 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, puffBuf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        const la = gl.getAttribLocation(P.puff!.p, "aP");
        gl.enableVertexAttribArray(la);
        gl.vertexAttribPointer(la, 4, gl.FLOAT, false, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.POINTS, 0, puffs);
        gl.disable(gl.BLEND);
      }
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, [resetKey]);

  const note = MODES.find((m) => m.id === mode)!.note;
  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div className="absolute left-4 top-4 z-10 max-w-sm space-y-4 border border-white/10 bg-black/70 p-4 backdrop-blur-sm">
        <p className="tracked flex justify-between text-[0.65rem] text-faint">
          <span>The Tide · Cloud lab</span>
          <a href="/workshop/cloud-lab" className="text-white/60 no-underline hover:text-white">Workshop</a>
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Interaction model">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`tracked border px-2 py-1 text-[0.62rem] ${mode === m.id ? "border-white text-white" : "border-white/20 text-white/60 hover:text-white"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-white/70">{note}</p>
        {(
          [
            ["Strength", strength, setStrength],
            ["Radius", radius, setRadius],
            ["Recovery", recover, setRecover],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="block">
            <span className="tracked flex justify-between text-[0.6rem] text-white/60">
              {label} <span>{value.toFixed(2)}</span>
            </span>
            <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full" />
          </label>
        ))}
        <button type="button" onClick={() => setResetKey((k) => k + 1)} className="tracked border border-white/20 px-2 py-1 text-[0.62rem] text-white/70 hover:text-white">
          Reset
        </button>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <p className="text-[0.7rem] leading-5 text-white/40">Move the cursor through the clouds. Tell me which model feels right (and the slider values), and I&apos;ll bring it to the planet.</p>
      </div>
    </div>
  );
}
