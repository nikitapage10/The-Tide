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
import { CloudWisps, FlowSim, RockBodies } from "./heroPhysics";
import { heroSignal } from "./heroSound";
import { ROCKS } from "./rocks";

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { return 0.6 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.1 * vnoise(p * 4.1 + 3.7); }
float fbm5(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return v / 0.97;
}
`;

const CLOUDS = `
// Cloud cover, shared by the planet shader and the cloud simulation.
// cloudCoords: sphere point → cloud space (foreshortened at the limb, wound into
// cyclones, drifting). cloudBase: the large-scale cloud amount (before detail),
// including storms you planted. The simulation carries this amount around with
// the air; the planet shader adds fine detail at full resolution.
vec2 cloudCoords(vec2 sph) {
  float z = sqrt(max(0.0, 1.0 - dot(sph, sph)));
  vec2 eyes[3];
  eyes[0] = vec2(-0.4127, -0.0255);   // the storm in the artwork
  eyes[1] = vec2(-0.45, -0.55);
  eyes[2] = vec2(-0.2, 0.32);
  vec2 ps = sph;
  for (int k = 0; k < 3; k++) {
    vec2 d = ps - eyes[k];
    float fall = exp(-dot(d, d) / 0.012);
    float a = fall * (k == 1 ? -2.0 : 2.0);
    float cs = cos(a), sn = sin(a);
    ps = eyes[k] + vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  }
  // Latitude/longitude on the sphere, so clouds shrink toward the horizon the
  // way real ones do (and the slow drift runs around the globe).
  float zz = sqrt(max(0.0, 1.0 - dot(ps, ps)));
  vec2 ll = vec2(atan(ps.x, max(zz, 0.0001)), asin(clamp(ps.y, -1.0, 1.0)));
  return ll * 3.0 + vec2(uT * 0.012, uT * 0.003);
}
// Storms you plant: the weather around the point is wound into a cyclone by
// differential rotation (the inside turns faster and keeps turning, slowing as
// the storm dies), which draws the real cloud texture into soft spiral bands;
// cloud thickens around a clear eye. Lasts about seven seconds.
vec2 stormTwist(vec2 sph, out float bonus, out float eye) {
  bonus = 0.0;
  eye = 0.0;
  vec2 q = sph;
  for (int k = 0; k < 3; k++) {
    float sa = uStorm[k].z;
    if (sa < 0.0 || sa > 7.5) continue;
    float grow = smoothstep(0.0, 1.0, sa) * (1.0 - smoothstep(4.5, 7.5, sa));
    vec2 c = uStorm[k].xy;
    vec2 d = q - c;
    float r = length(d) / 0.05;
    if (r > 2.6) continue;
    // A gentle twist only draws nearby cloud in; the storm brings its own.
    float spinA = (0.6 * sa - 0.04 * sa * sa + 0.4) * grow;
    // (No twisting of the surrounding cloud: that read as stringy liquid.)
    spinA *= 0.0;
    // Its own cloud, generated whether or not there was any here: two smooth
    // logarithmic spiral arms that keep turning (slowing as it dies), softened
    // by low-frequency noise so the edges are soft rather than jagged.
    float th = atan(d.y, d.x);
    float turn = 2.2 * sa - 0.14 * sa * sa;
    float spiral = 0.5 + 0.5 * cos(2.0 * th - 3.2 * log(r + 0.12) - turn + uStorm[k].w * 6.0);
    spiral = smoothstep(0.15, 0.95, spiral);
    float soft = 0.7 + 0.3 * vnoise(vec2(th * 2.0 + uStorm[k].w * 9.0, r * 2.0));
    bonus = max(bonus, grow * smoothstep(2.2, 0.55, r) * mix(0.35, 1.0, spiral) * soft);
    eye = max(eye, grow * exp(-r * r * 14.0));
  }
  return q;
}
float cloudBase(vec2 sph) {
  float bonus, eye;
  vec2 tw = stormTwist(sph, bonus, eye);
  vec2 p = cloudCoords(tw);
  vec2 w = vec2(fbm(p * 0.8 + vec2(0.0, uT * 0.02)), fbm(p * 0.8 + vec2(5.2, 1.3 - uT * 0.017)));
  float base = fbm5(p * 1.7 + 0.45 * w);
  return max(base, 0.4 + 0.38 * bonus) - eye * 0.3;
}
// Final cloud density from the (simulated) base amount plus fine detail.
float cloudDetail(float base, vec2 pw) {
  // Soft, rounded detail (coarser than before, so no fine streaks).
  float detail = fbm5(pw * 5.0 + vec2(uT * 0.04, 0.0));
  return smoothstep(0.38, 0.7, base + (detail - 0.5) * 0.4);
}
`;

const FRAG = `
precision highp float;
uniform sampler2D uPlanet, uFar, uNear;
uniform sampler2D uFlow;          // planet: weather flow (z: where the clouds were brushed thin)
uniform sampler2D uMasks;         // planet: baked masks (R land, G light streams on the disc)
uniform sampler2D uIdsFar, uIdsNear; // meteors: rock id per pixel
uniform vec4 uStorm[3];           // planet: storms you planted (disc x, y, age s, seed); age < 0 = none
uniform sampler2D uCentFar, uCentNear;   // meteors: each rock pixel's rock centre + movable flag
uniform sampler2D uStateFar, uStateNear; // meteors: rock bodies (offsets, spins, search hints), 64×64
// uLayer is a compile-time constant (0 = planet, opaque; 1 = meteors, premultiplied
// alpha): each canvas compiles only its own code, which keeps first-load compile short.
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
uniform vec4 uStrandA[6]; // planet: strands drawn off the planet: start (xy) and control point (zw), CSS px
uniform vec4 uStrandT[6]; // planet: strand tip (xy), width (z), strength (w)
uniform vec4 uStrandBox;  // planet: their bounding box (padded); empty when off

const vec2 SRC = vec2(2000.0, 1126.0);
const vec2 LIMB_C = vec2(1.0122, 0.6500); // planet centre in artwork uv (fitted to the horizon)
const float LIMB_R = 883.0;               // planet radius in source px

float intro(float a, float b) { return smoothstep(a, b, uT); }
${NOISE}
${CLOUDS}

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
  // Never darken below the source (that leaves dark halos beside bright edges,
  // e.g. a dark line just outside the horizon).
  c = max(c, c0 * 0.97);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
  return c;
}

// Smooth value noise and a small fbm, for slow flowing motion.

// Screen position of the pixel being shaded (set in scene(); used by the clouds).
vec2 gSp;



const vec2 PINCH = vec2(0.20, 0.453); // where the streams cross, in artwork uv

// Planted storms knock out the power grid. Shortly after the lightning whole
// neighbourhoods (nb) go dark quickly, spreading out from the storm; power then
// returns slowly, light by light (lid), scattered over several seconds, each
// with a brief flicker as it comes back.
float gridOutage(vec2 nb, vec2 lid, vec2 sph) {
  float outage = 0.0;
  for (int k = 0; k < 3; k++) {
    float sa = uStorm[k].z;
    if (sa < 0.0 || sa > 13.0) continue;
    float dd = length(sph - uStorm[k].xy);
    float hN = hash(nb + uStorm[k].w * 31.0);
    if (dd > 0.22 || hN > 1.2 * (1.0 - dd / 0.22)) continue;
    float tFail = 1.2 + dd * 4.0 + hN * 0.5;
    float tBack = tFail + 1.5 + 5.5 * hash(lid + 3.0 + uStorm[k].w);
    float flickN = step(0.5, hash(nb + floor(uT * 14.0)));
    float flickL = step(0.5, hash(lid + floor(uT * 14.0)));
    if (sa > tFail - 0.3 && sa < tFail) outage = max(outage, flickN);
    else if (sa >= tFail && sa < tBack) outage = 1.0;
    else if (sa >= tBack && sa < tBack + 0.25) outage = max(outage, flickL);
  }
  return outage;
}

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
  // Drift shimmer: now and then (about every 40 s) a narrow heat-shimmer tear
  // (about every 25 s) opens over the planet for a few seconds; through it, refracted, a different
  // patch of surface shows, with a faint prism split along its edges.
  float riftSlot = floor(uT / 25.0);
  float riftT = uT - riftSlot * 25.0 - 6.0;
  float riftOn = smoothstep(0.0, 0.8, riftT) * (1.0 - smoothstep(2.6, 4.0, riftT));
  vec3 riftCol = vec3(0.0);
  float riftMask = 0.0;
  if (riftOn > 0.001) {
    vec2 rc = LIMB_C + vec2(-0.32 + 0.2 * hash(vec2(riftSlot, 1.0)), -0.25 + 0.4 * hash(vec2(riftSlot, 2.0)));
    float ra = hash(vec2(riftSlot, 3.0)) * 3.1416;
    vec2 rd = (uv - rc) * SRC;
    vec2 rl = vec2(cos(ra) * rd.x + sin(ra) * rd.y, -sin(ra) * rd.x + cos(ra) * rd.y);
    float shimmer = fbm(vec2(rl.x * 0.03, uT * 1.5)) - 0.5;
    float ell = length(rl / vec2(110.0 + 40.0 * riftOn, 8.0 + 14.0 * riftOn + 10.0 * shimmer));
    riftMask = (1.0 - smoothstep(0.55, 1.0, ell)) * riftOn;
    if (riftMask > 0.001) {
      vec2 elsewhere = uv + vec2(0.21, -0.13) + vec2(rl.y, -rl.x) * 0.25 / SRC;
      vec2 edgeN = normalize(rl + 1e-3) * (1.0 - ell) * 4.0 / SRC;
      riftCol = vec3(sharpPlanet(elsewhere + edgeN).r, sharpPlanet(elsewhere).g, sharpPlanet(elsewhere - edgeN).b);
      riftCol *= 0.8 + 0.3 * shimmer;
    }
  }
  vec3 col = sharpPlanet(uv + disp / SRC);
  col = mix(col, riftCol, riftMask);

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

  // Weather, wrapped onto the sphere (foreshortened at the limb), in layers:
  //   surface → lower atmosphere (haze that softens the ground, with drifting
  //   veils and banding) → cloud shadows → clouds → a thin upper haze over the
  //   clouds, so they sit inside the atmosphere rather than on the picture.
  // The pointer stirs the air (a small fluid simulation); the air carries the
  // cloud amount (uClouds, simulated on the GPU), so clouds are pushed around
  // as material, and the haze thins where you brush through.
  float inside = 1.0 - smoothstep(-6.0, 0.0, dl);
  vec2 sph = q / LIMB_R;
  float z = sqrt(max(0.0, 1.0 - dot(sph, sph)));
  vec4 fl = texture2D(uFlow, clamp(sph * 0.5 + 0.5, 0.0, 1.0));
  vec2 flowD = vec2(0.0); // clouds are never warped by the pointer
  float cleared = fl.z;
  vec3 nrm3 = vec3(sph, z);
  vec3 sunDir = normalize(vec3(-0.85, -0.35, 0.4));
  float light = clamp(dot(nrm3, sunDir), 0.0, 1.0);
  float fres = pow(1.0 - z, 2.2);
  // Day–night line, art-directed to cross the visible lower right of the disc
  // (most of the planet's true night side lies beyond the frame).
  float nightSide = smoothstep(-0.3, 0.3, (sph.x + 0.62) * 0.9 + (sph.y + 0.05)) * inside;
  vec3 skyCol = vec3(0.78, 0.86, 0.96);

  if (dl < 0.0) {
    // Lower atmosphere: soften the ground under a lit haze with drifting veils
    // and faint latitude banding; carried by the flow at half strength.
    vec2 hs = sph - flowD * 0.5;
    vec2 t6 = vec2(6.0) / SRC;
    vec3 soft = (tex(uPlanet, uv + vec2(t6.x, 0.0)).rgb + tex(uPlanet, uv - vec2(t6.x, 0.0)).rgb
               + tex(uPlanet, uv + vec2(0.0, t6.y)).rgb + tex(uPlanet, uv - vec2(0.0, t6.y)).rgb) * 0.25;
    float veils = fbm5(hs * 3.5 + vec2(uT * 0.015, 0.0));
    float bands = fbm(vec2(hs.x * 2.0 + uT * 0.01, hs.y * 16.0 + 2.0 * veils));
    float hazeD = clamp(0.18 + 0.5 * smoothstep(0.35, 0.8, veils) + 0.25 * bands + 0.9 * fres, 0.0, 1.0);
    hazeD *= 1.0 - 0.6 * cleared;
    // (The softening fades out before the horizon: there its average would pull
    // in the black of space and draw a dark line along the limb.)
    col = mix(col, soft, 0.55 * hazeD * (1.0 - smoothstep(-28.0, -6.0, dl)));
    col = mix(col, skyCol * (0.25 + 0.75 * light), 0.22 * hazeD * (0.5 + 0.5 * light));

    // Mid layer: a thin veil between the ground and the clouds, stretched into
    // soft streaks and drifting slowly the other way. Not interactive.
    vec2 vq = vec2(sph.x / (0.35 + z), sph.y * 1.0) * vec2(1.4, 4.0) + vec2(-uT * 0.006, uT * 0.002);
    float veil = smoothstep(0.42, 0.8, fbm5(vq + 0.6 * vec2(fbm(vq * 0.7), fbm(vq * 0.7 + 4.0))));
    float veilA = veil * 0.26 * (0.45 + 0.55 * light) * smoothstep(0.0, 0.2, z);
    col *= 1.0 - 0.18 * veil;                                   // its faint shadow
    col = mix(col, skyCol * (0.55 + 0.45 * light), veilA);

    // Clouds. They stay where the weather puts them (warping them read as
    // smeared liquid). Where the cursor passes, cloud dissipates: a hole with
    // ragged edges opens and slowly fills back in, while the cloud that was
    // there breaks off as small drifting wisps (drawn separately as particles).
    vec2 sunStepS = normalize(sunDir.xy) * 0.012;
    vec2 srcH = sph;
    vec2 srcS = sph + sunStepS;
    float sbH, seH;
    vec2 pw = cloudCoords(stormTwist(srcH, sbH, seH));
    float rag = vnoise(pw * 14.0 + 11.0) * 0.6 + vnoise(pw * 31.0) * 0.4;
    float holeH = clamp(cleared * 2.4 - 0.55 * rag, 0.0, 1.0);
    float coverH = 1.0 - smoothstep(0.15, 0.6, holeH);
    float coverS = coverH;
    float baseHere = cloudBase(srcH);
    float baseSun = cloudBase(srcS);
    float dens = clamp(cloudDetail(baseHere, pw) * coverH, 0.0, 1.0);
    // Smooth storm cloud (fine detail would break its arms into jagged bits).
    dens = mix(dens, smoothstep(0.42, 0.72, baseHere) * coverH, sbH * 0.7);
    float densSun = clamp(cloudDetail(baseSun, cloudCoords(stormTwist(srcS, sbH, seH))) * coverS, 0.0, 1.0);
    vec2 eyes[3];
    eyes[0] = vec2(-0.4127, -0.0255);
    eyes[1] = vec2(-0.45, -0.55);
    eyes[2] = vec2(-0.2, 0.32);
    // Shadows cast on the ground (through the haze) by cloud toward the sun.
    col *= 1.0 - 0.4 * densSun * (1.0 - dens);
    float tops = fbm5(pw * 18.0 + vec2(uT * 0.05, 0.0));
    float shade = clamp(0.8 - (densSun - dens) * 1.4, 0.35, 1.0);
    float bright = (0.28 + 0.62 * light) * shade * (0.72 + 0.4 * tops);
    vec3 cloudCol = mix(vec3(0.6, 0.66, 0.74), vec3(0.97, 0.98, 1.0), smoothstep(0.1, 0.8, dens)) * bright;
    float alpha = pow(dens, 1.3) * 0.8 * smoothstep(0.0, 0.15, z);
    col = mix(col, cloudCol, inside * alpha);

    // Lightning inside the storms: now and then (rarely) a flash lights a cloud
    // from within.
    float flash = 0.0;
    for (int k = 0; k < 5; k++) {
      float fk = float(k);
      vec2 cell = k < 3 ? eyes[k] + vec2(0.06, -0.04) : vec2(hash(vec2(fk, floor(uT * 0.05))) * 1.4 - 0.7, hash(vec2(floor(uT * 0.05), fk)) * 1.4 - 0.7);
      // Now and then: on average a flash somewhere every ~3–4 s.
      float slot = floor(uT * 1.2 + fk * 3.1);
      float on = step(0.94, hash(vec2(slot, fk * 7.3)));
      float ph = fract(uT * 1.2 + fk * 3.1);
      float strobe = on * exp(-ph * 9.0) * (0.6 + 0.4 * step(0.5, fract(ph * 6.0)));
      vec2 dc = sph - flowD - cell - (vec2(hash(vec2(slot, 1.0)), hash(vec2(slot, 2.0))) - 0.5) * 0.12;
      flash += strobe * exp(-dot(dc, dc) / 0.004);
    }
    // Planted storms: lightning flickering inside each one.
    for (int k = 0; k < 3; k++) {
      float sa = uStorm[k].z;
      if (sa < 0.0 || sa > 5.0) continue;
      float grow = smoothstep(0.0, 0.4, sa) * (1.0 - smoothstep(2.5, 5.0, sa));
      float slot = floor(sa * 3.0);
      float on = step(0.6, hash(vec2(slot, uStorm[k].w * 13.0)));
      float ph = fract(sa * 3.0);
      vec2 jitter = (vec2(hash(vec2(slot, 4.0 + uStorm[k].w)), hash(vec2(slot, 5.0 + uStorm[k].w))) - 0.5) * 0.06;
      vec2 dsx = sph - uStorm[k].xy - jitter;
      flash += on * exp(-ph * 7.0) * exp(-dot(dsx, dsx) / 0.003) * grow * 2.2;
    }
    col += vec3(0.82, 0.88, 1.0) * flash * (0.25 + 0.75 * dens) * inside;

    // Dusk: the lower right of the visible disc lies past the day–night line.
    col *= 1.0 - 0.72 * nightSide;

    // City lights, as seen from orbit: each city is a cluster of many tiny
    // lights, dense at its core and thinning irregularly outward, under a faint
    // skyglow; roads between cities are strings of lights; a few planned
    // districts are perfectly regular lattices (it is a future world); a light
    // sprinkle of rural lights elsewhere. Settled in pockets (post-ravage), on
    // land only (baked mask), shown across the planet, brightest past dusk.
    float landHere = texture2D(uMasks, uv).r;
    if (landHere > 0.01) {
      float lat = asin(clamp(sph.y, -1.0, 1.0));
      float lon = atan(sph.x, z);
      vec2 sc = vec2(lon * cos(lat), lat);
      // Busier and quieter regions, but every landmass has some settlement.
      float region = 0.18 + 0.82 * smoothstep(0.42, 0.62, fbm(sc * 3.2 + 3.0));
      // Light density here: city cores and the roads between them.
      vec2 cg = sc * 30.0;
      vec2 cb = floor(cg);
      float ld = 0.0;
      float road = 0.0;
      float planned = 0.0;
      vec2 plannedC = vec2(0.0);
      float plannedA = 0.0;
      float out0 = 0.0;
      for (int a = -1; a <= 1; a++) {
        for (int b = -1; b <= 1; b++) {
          vec2 c0 = cb + vec2(float(a), float(b));
          float h0 = hash(c0 + 17.0);
          if (h0 < 0.25) continue;
          vec2 p0 = c0 + 0.2 + 0.6 * vec2(hash(c0 + 5.0), hash(c0 + 6.0));
          float pop = pow(hash(c0 + 9.0), 1.6);
          float r = 0.08 + 0.3 * pop;
          vec2 dv = cg - p0;
          // Irregular outline: the radius wobbles with direction and noise.
          float wob = 0.65 + 0.7 * fbm(dv * 4.0 + c0 * 3.1);
          float core = exp(-dot(dv, dv) / (r * r * wob * wob));
          ld += core * (0.5 + 0.8 * pop);
          if (hash(c0 + 23.0) > 0.88 && core > planned) {
            planned = core;
            plannedC = p0;
            plannedA = hash(c0 + 24.0) * 1.57;
          }
          for (int e = 0; e < 2; e++) {
            vec2 c1 = c0 + (e == 0 ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
            if (hash(c1 + 17.0) < 0.25 || hash(c0 + float(e) * 3.0 + 41.0) < 0.2) continue;
            vec2 p1 = c1 + 0.2 + 0.6 * vec2(hash(c1 + 5.0), hash(c1 + 6.0));
            vec2 ed = p1 - p0;
            float t = clamp(dot(dv, ed) / dot(ed, ed), 0.0, 1.0);
            float dr = length(dv - ed * t);
            ld += exp(-dr * dr * 500.0) * 0.9;
            road = max(road, exp(-dr * dr * 2500.0));
          }
        }
      }
      // Blackouts go district by district: the lights here belong to the nearest
      // neighbourhood centre (irregular cells), and a whole neighbourhood goes out
      // together.
      vec2 ng = sc * 70.0;
      vec2 nb = floor(ng);
      float nd = 1e9;
      vec2 nbId = nb;
      for (int a = -1; a <= 1; a++) {
        for (int b = -1; b <= 1; b++) {
          vec2 c = nb + vec2(float(a), float(b));
          vec2 pnt = c + vec2(hash(c + 61.0), hash(c + 62.0));
          float dd = dot(ng - pnt, ng - pnt);
          if (dd < nd) { nd = dd; nbId = c; }
        }
      }
      // The neighbourhood's glow returns gradually with its lights.
      out0 = gridOutage(nbId, nbId + 0.37, sph);
      ld = ld * region + 0.05 * region + 0.012;
      // Individual lights: a fine grid; each cell lit with probability = density.
      vec2 fg = sc * 380.0;
      vec2 fi = floor(fg);
      float fh = hash(fi + 71.0);
      vec2 fp = fi + 0.25 + 0.5 * vec2(hash(fi + 72.0), hash(fi + 73.0));
      float lit = step(1.0 - clamp(ld * 0.75, 0.0, 0.85), fh);
      float outL = gridOutage(nbId, fi, sph);
      float pt = lit * exp(-dot(fg - fp, fg - fp) * 4.0) * (0.6 + 1.0 * hash(fi + 74.0));
      // Planned districts: a perfectly regular lattice instead.
      if (planned > 0.15) {
        vec2 rel = (cg - plannedC) * 34.0;
        rel = vec2(cos(plannedA) * rel.x + sin(plannedA) * rel.y, -sin(plannedA) * rel.x + cos(plannedA) * rel.y);
        vec2 lq = abs(fract(rel) - 0.5);
        float lattice = exp(-dot(lq, lq) * 70.0) * smoothstep(0.15, 0.5, planned);
        pt = mix(pt, lattice * 1.1, smoothstep(0.15, 0.5, planned));
      }
      vec3 warm = vec3(1.0, 0.86, 0.66);
      vec3 cool = vec3(0.93, 0.95, 1.0);
      vec3 lights = mix(warm, cool, planned > 0.15 ? 0.7 : 0.15) * pt * 1.6
                  + warm * smoothstep(0.05, 0.9, ld) * 0.12 * (1.0 - 0.9 * out0) // skyglow
                  + warm * road * region * 0.2 * (1.0 - 0.95 * out0);  // the road network itself
      lights *= 1.0 - 0.95 * outL;
      float twinkle = 0.9 + 0.1 * sin(uT * 2.3 + fh * 30.0);
      // Faint where the sun is strong (the lit left), bright where it is dim
      // (lower right and toward the middle), brightest past dusk.
      float sunny = smoothstep(0.1, 0.55, light);
      float shown = mix(1.35, 0.35, sunny) + 0.35 * nightSide;
      col += lights * smoothstep(0.1, 0.5, landHere) * shown * twinkle * (1.0 - 0.85 * dens) * inside;
    }

    // Sun glint: a soft specular sheen on open water, toward the sun.
    float water = 1.0 - smoothstep(0.05, 0.16, dot(tex(uPlanet, uv).rgb, vec3(0.3333)));
    vec3 halfV = normalize(sunDir + vec3(0.0, 0.0, 1.0));
    float spec = pow(clamp(dot(nrm3, halfV), 0.0, 1.0), 48.0);
    col += vec3(0.9, 0.94, 1.0) * spec * water * (1.0 - dens) * 0.22 * (0.75 + 0.25 * fbm(sph * 60.0 + uT * 0.3));

    // Meteors entering the atmosphere: a short burning streak near the limb
    // every few seconds, gone in about a second.
    float mSlot = floor(uT / 5.0);
    float mT = (uT - mSlot * 5.0 - 1.0) / 1.1;
    if (mT > 0.0 && mT < 1.0) {
      float ma = 2.2 + 1.8 * hash(vec2(mSlot, 7.0));   // on the visible (left) side
      vec2 m0 = vec2(cos(ma), sin(ma)) * (0.82 + 0.12 * hash(vec2(mSlot, 9.0)));
      vec2 mdir = normalize(vec2(-m0.y, m0.x) * (hash(vec2(mSlot, 4.0)) > 0.5 ? 1.0 : -1.0) - m0 * 0.4);
      vec2 head = m0 + mdir * 0.1 * mT;
      vec2 rel = sph - head;
      float mAlong = dot(rel, -mdir);
      float mAcross = dot(rel, vec2(-mdir.y, mdir.x));
      float trail = smoothstep(0.06, 0.0, mAlong) * step(0.0, mAlong) * exp(-mAcross * mAcross / 0.000004);
      float headG = exp(-dot(rel, rel) / 0.000012);
      float fade = sin(3.1416 * mT);
      col += vec3(1.0, 0.96, 0.92) * (trail * 0.6 + headG * 1.2) * fade;
    }

  }
  // One continuous atmosphere across the horizon: haze over the disc thickening
  // toward the edge, and the same thickness carried on outward as a glowing
  // shell, so there is no seam (or dark ring) at the limb.
  float lit2 = clamp(dot(nrm, normalize(vec2(-0.9, -0.4))) * 0.5 + 0.5, 0.0, 1.0);
  float edgeLit = 0.3 + 0.7 * lit2;
  float discLit = mix(edgeLit, 0.4 + 0.8 * light, smoothstep(0.0, 0.35, z));
  float atmoIn = (0.06 + 0.36 * fres) * discLit * (1.0 - 0.4 * cleared) * (1.0 - 0.75 * nightSide);
  float atmoOut = 0.42 * edgeLit * (0.7 * exp(-max(dl, 0.0) / 26.0) + 0.3 * exp(-max(dl, 0.0) / 80.0));
  float atmo = mix(atmoIn, atmoOut, smoothstep(-4.0, 4.0, dl));
  col = mix(col, skyCol, clamp(atmo, 0.0, 0.5));
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

// Individually moved rocks (pointer physics, before scrolling). A rock's own
// pixels leave their home spot (keep = 0 there) and are drawn at its new
// position and angle instead.
const vec2 ROCK_SZ = vec2(1672.0, 941.0);
float rockId(sampler2D ids, vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  vec4 t = texture2D(ids, uv);
  return floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) * 256.0;
}
// Rocks are independent bodies (simulated on the CPU, see RockBodies): each
// has its own offset and spin. A pixel finds which rock (if any) now covers it
// by trying a few candidates: the search hint, its own position, and a short
// fixed-point walk; then it checks the rock really covers it.
vec4 stateAt(sampler2D st, vec2 cell) { return texture2D(st, (cell + 0.5) / 64.0); }
float dec16(float hi, float lo) { return (floor(hi * 255.0 + 0.5) * 256.0 + floor(lo * 255.0 + 0.5)) / 65535.0 - 0.5; }
// Offset (uv) and turn of a rock.
vec3 rockState(sampler2D st, float id) {
  vec2 c = vec2(mod(id, 32.0), floor(id / 32.0));
  vec4 o = stateAt(st, c);
  vec4 a = stateAt(st, c + vec2(32.0, 0.0));
  return vec3(vec2(dec16(o.r, o.g), dec16(o.b, o.a)) * 256.0 / ROCK_SZ, dec16(a.r, a.g) * 8.0);
}
vec2 hintAt(sampler2D st, vec2 uv) {
  vec2 cell = clamp(floor(uv * vec2(48.0, 27.0)), vec2(0.0), vec2(47.0, 26.0));
  return (stateAt(st, cell + vec2(0.0, 32.0)).rg - 0.5) * 256.0 / ROCK_SZ;
}
float flagsAt(sampler2D cent, vec2 uv) { return floor(texture2D(cent, clamp(uv, 0.0, 1.0)).b * 255.0 + 0.5); }
float bit(float flags, float b) { return mod(floor(flags / pow(2.0, b)), 2.0); }
vec2 rigidMove(sampler2D ids, sampler2D cent, sampler2D st, vec2 uv, float bobAmp, out float keep) {
  keep = 1.0;
  float idP = rockId(ids, uv);
  if (idP > 0.5 && bit(flagsAt(cent, uv), 0.0) < 0.5) return uv;     // a rock that stays put
  vec2 hint = hintAt(st, uv);
  vec2 q = uv - hint;
  for (int k = 0; k < 5; k++) {
    if (k == 1) q = uv;
    else if (k == 2) q = uv - hint * 0.5;
    float idQ = rockId(ids, q);
    if (idQ < 0.5) continue;
    vec4 cQ = texture2D(cent, clamp(q, 0.0, 1.0));
    float fl = floor(cQ.b * 255.0 + 0.5);
    if (bit(fl, 0.0) < 0.5) continue;
    vec3 m = rockState(st, idQ);
    // Gentle individual float, for rocks not cut by the frame.
    float h = hash(vec2(idQ, 7.0));
    float edge = fl > 1.5 ? 1.0 : 0.0;
    m.xy += (1.0 - edge) * vec2(sin(uT * 0.21 + h * 6.28), cos(uT * 0.17 + h * 9.1)) * bobAmp / ROCK_SZ;
    vec2 c = cQ.rg;
    vec2 rel = (uv - c - m.xy) * ROCK_SZ;
    float cs = cos(-m.z), sn = sin(-m.z);
    vec2 s2 = c + vec2(cs * rel.x - sn * rel.y, sn * rel.x + cs * rel.y) / ROCK_SZ;
    if (abs(rockId(ids, s2) - idQ) < 0.5) return s2;
    q = uv - m.xy;                                         // walk toward the rock's new place
  }
  if (idP > 0.5) keep = 0.0;                               // this rock has moved away
  return uv;
}

// Signed distance (source px) from the planet's horizon for a screen point.
float planetDl(vec2 sp) {
  vec2 f = (sp - (uFrameC - 0.5 * uFrameS)) / uFrameS;
  float sP = 1.25 - 0.25 * uP;
  vec2 oP = vec2(0.85, 0.58);
  vec2 puv = oP + (f - oP) / sP;
  return length((puv - LIMB_C) * SRC) - LIMB_R;
}

vec4 scene(vec2 sp) {
  gSp = sp;
  vec2 f = (sp - (uFrameC - 0.5 * uFrameS)) / uFrameS;
  vec2 px = 1.0 / uFrameS;
  if (uLayer == 0) {
    float sP = 1.25 - 0.25 * uP;
    vec2 oP = vec2(0.85, 0.58);
    vec2 puv = oP + (f - oP) / sP;
    vec3 col = planetWithLimb(puv);
    // Stars only where space is empty: dark, and off the planet.
    float dlS = length((puv - LIMB_C) * SRC) - LIMB_R;
    float empty = (1.0 - smoothstep(0.03, 0.14, dot(col, vec3(0.3333)))) * smoothstep(20.0, 80.0, dlS);
    col += stars(sp, empty);
    // Fine star dust and a faint drifting nebula haze fill the empty dark,
    // strongest on the left where the frame is emptiest. Very low contrast.
    float leftBias = 1.0 - 0.6 * clamp(sp.x / max(1.0, uRes.x / uDpr), 0.0, 1.0);
    vec2 dc = floor(sp / 9.0);
    float dh = hash(dc + 11.0);
    vec2 dp = (dc + 0.5 + 0.35 * (vec2(hash(dc + 4.0), hash(dc + 9.0)) - 0.5)) * 9.0;
    float dust = step(0.82, dh) * exp(-dot(sp - dp, sp - dp) * 1.8) * (0.05 + 0.06 * hash(dc + 2.0));
    dust *= 0.6 + 0.4 * sin(uT * (0.5 + dh) + dh * 30.0);
    vec2 nq = sp * 0.0016 + vec2(uT * 0.004, -uT * 0.002);
    float neb = fbm5(nq + 1.3 * vec2(fbm(nq * 1.7), fbm(nq * 1.7 + 5.0)));
    float nebula = smoothstep(0.45, 0.85, neb) * 0.035;
    col += (vec3(0.78, 0.84, 0.95) * (dust + nebula)) * empty * leftBias;
    // Intro (no movement): the streams of light fade in first as a soft wipe from
    // left to right, then the planet fades up out of black.
    float sx = sp.x / max(1.0, uRes.x / uDpr);
    float iStreams = smoothstep(0.0, 1.0, (uT - 1.1 - sx * 1.1) / 1.8);
    float iDisc = intro(2.0, 5.2);
    // The planet emerges through the streams: a wide, soft blend across the limb.
    float iPlanet = mix(iStreams, iDisc * (0.6 + 0.4 * iStreams), smoothstep(-90.0, 30.0, -dlS));
    // Tidal pulse: about every 30 s a soft wave of light rolls across the
    // planet and the streams, lifting what is already lit (like sun through haze).
    float tideT = mod(uT - 8.0, 30.0) / 6.0;
    if (tideT < 1.0) {
      float front = -0.25 + 1.5 * tideT;
      float band = exp(-pow((sx - front) / 0.12, 2.0)) * sin(3.1416 * tideT);
      float litAmt = smoothstep(0.04, 0.5, dot(col, vec3(0.3333)));
      col *= 1.0 + 0.4 * band * litAmt;
      col += vec3(0.8, 0.86, 0.95) * band * 0.02;
    }
    col *= iPlanet * mix(0.07, 1.0, smoothstep(0.0, 1.0, uP));
    return vec4(col, 1.0);
  }
  float iNear = intro(0.4, 2.4);
  float iFar = intro(0.8, 3.0);

  // Depth of field grows as the rocks leave the focal plane; streaks come from
  // the zoom itself plus how fast you scroll.
  float depth = smoothstep(0.05, 1.0, uP);
  float rush = clamp(uS, 0.0, 2.0);

  // Middle rocks: darker, slightly soft, spread outward and thin to a faint frame.
  float sF = 1.0 + 0.9 * uP + 0.08 * (1.0 - iFar);
  vec2 oF = vec2(0.5);
  vec2 uvF = oF + (f - oF) / sF;
  float keepF = 1.0;
  uvF = rigidMove(uIdsFar, uCentFar, uStateFar, uvF, 2.5, keepF);
  vec4 far = keepF * flyby(uFar, uvF, oF, 0.012 * depth + 0.02 * rush,
                   mix(0.22, 0.4, uP), mix(0.22, 0.4, uP), px / sF, 1.6 + 3.5 * depth);
  // Stays solid through most of the scroll; gone by the last frame (only the planet remains).
  far *= iFar * (1.0 - smoothstep(0.78, 0.99, uP));

  // Outer rocks: brightest; they rise and fly past the camera, catching a glint
  // of light on their rims as they go.
  float sN = 1.05 + 1.7 * uP + 0.1 * (1.0 - iNear);
  vec2 oN = vec2(0.5, 0.95);
  vec2 uvN = oN + (f - oN) / sN;
  float glint = 0.35 + 0.5 * sin(3.14159 * clamp(uP * 1.4, 0.0, 1.0));
  float keepN = 1.0;
  uvN = rigidMove(uIdsNear, uCentNear, uStateNear, uvN, 4.0, keepN);
  vec4 near = keepN * flyby(uNear, uvN, oN, 0.02 * depth + 0.035 * rush, 0.8, glint, px / sN, 7.0 * depth * depth);
  // Fully opaque until the very end of the scroll, then gone by the last frame.
  near *= iNear * (1.0 - smoothstep(0.84, 0.97, uP));
  vec4 rocks = near + far * (1.0 - near.a);
  // Foreground motes: a few soft, out-of-focus specks of dust drifting between
  // the lens and the scene, nudged slightly by the pointer (parallax).
  vec2 mq = (sp + (uM - uRes / uDpr * 0.5) * 0.02 + vec2(uT * 4.0, -uT * 2.5)) / 150.0;
  vec2 mi = floor(mq);
  float mh = hash(mi + 51.0);
  vec2 mp = mi + 0.2 + 0.6 * vec2(hash(mi + 3.0), hash(mi + 6.0));
  float mr = (0.02 + 0.03 * hash(mi + 9.0));
  float md = length(mq - mp);
  float bokeh = step(0.86, mh) * (smoothstep(mr, mr * 0.7, md) * 0.7 + smoothstep(mr, mr * 0.92, md) * 0.3);
  float mote = bokeh * (0.035 + 0.03 * sin(uT * 0.3 + mh * 20.0)) * min(iNear, 1.0);
  return rocks + vec4(vec3(0.85, 0.9, 1.0) * mote, mote) * (1.0 - rocks.a);
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
  if (uLayer == 0) {
    // The lens bends space, not the planet: no warp over the planet's disc (its
    // clouds still part, and the light ring, prism and flares still show).
    float onSpace = smoothstep(0.0, 90.0, planetDl(sp));
    warped = mix(sp, warped, onSpace);
    dir *= onSpace;
  }
  float onSpaceCA = uLayer == 0 ? smoothstep(0.0, 40.0, planetDl(sp)) : 1.0;
  // The lens' halo and flares exist only in space: the planet's edge crops them.
  float pointerInSpace = uLayer == 0 ? smoothstep(-2.0, 3.0, planetDl(sp)) : 1.0;

  // Light gathered by the lens: a magnification ring that brightens what is
  // actually there (streams, limb, rock rims) with a slight prism split.
  float ring = exp(-pow((r - R * 0.55) / (R * 0.16), 2.0));
  float ca = e * (1.2 * fall + 3.0 * ring);
  // One scene evaluation per pixel (a prism split would triple the shader, and
  // its compile time); a faint colour fringe on the lens ring stands in for it.
  vec4 cg = scene(warped);
  vec3 col = cg.rgb;
#if uLayer == 1
  col *= 1.0 + e * (0.55 * ring + 0.15 * fall) * pointerInSpace;
#endif

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
    col += vec3(0.85, 0.92, 1.0) * ghosts * e * pointerInSpace;
    // In space the cursor acts like a small lens: light already there (the
    // streams, the ribbons) is gathered and brightened in a soft ring with a
    // faint prismatic edge, and a dim glow sits at its centre. Nothing drawn
    // on empty black, so it reads as optics, not as a shape.
    vec2 dmF = sp - uM;
    float rF = length(dmF);
    float lensRing = exp(-pow((rF - R * 0.32) / (R * 0.12), 2.0));
    float lit0 = dot(col, vec3(0.3333));
    vec3 prism = vec3(1.0 + 0.25 * sin(rF * 0.08 - uT * 1.5), 1.0, 1.0 + 0.25 * sin(rF * 0.08 - uT * 1.5 + 2.0));
    col *= 1.0 + e * pointerInSpace * (0.9 * lensRing * prism - 0.0);
    col += vec3(0.72, 0.8, 0.95) * exp(-rF * rF / (R * R * 0.02)) * 0.05 * e * pointerInSpace * (0.6 + 0.4 * smoothstep(0.02, 0.2, lit0));
    // Strands of energy drawn off the planet toward the cursor: a few curved
    // filaments leave the limb nearest the pointer, bending and swaying as if
    // stretched and pulled, with light flowing outward along them. Mild, cool
    // grey-blue; they fade with distance and when the cursor returns.
    if (sp.x > uStrandBox.x && sp.y > uStrandBox.y && sp.x < uStrandBox.z && sp.y < uStrandBox.w) {
      vec3 sc3 = vec3(0.0);
      for (int k = 0; k < 6; k++) {
        vec2 A = uStrandA[k].xy, C = uStrandA[k].zw, T = uStrandT[k].xy;
        float wid = uStrandT[k].z, str = uStrandT[k].w;
        if (str <= 0.001) continue;
        vec2 prev = A;
        float best = 1e9, bestT = 0.0;
        for (int j = 1; j <= 14; j++) {
          float t = float(j) / 14.0;
          vec2 P = mix(mix(A, C, t), mix(C, T, t), t);
          vec2 ab = P - prev;
          float h = clamp(dot(sp - prev, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
          float d = length(sp - prev - ab * h);
          if (d < best) { best = d; bestT = (float(j) - 1.0 + h) / 14.0; }
          prev = P;
        }
        float w = wid * (1.0 - 0.6 * bestT);                       // tapering toward the tip
        float flow = 0.55 + 0.45 * vnoise(vec2(bestT * 9.0 - uT * 1.6, float(k) * 7.0));
        float fadeTip = 1.0 - smoothstep(0.7, 1.0, bestT);
        // Soft cores that melt into a wide glow (they read as part of the sheet).
        float line = 0.55 * exp(-best * best / (w * w)) + 0.4 * exp(-best * best / (14.0 * w * w));
        sc3 = max(sc3, vec3(line * flow * fadeTip * str));
      }
      // The sheet between them: a soft gradient filling the fan, brightest along
      // its middle, with faint striations flowing outward.
      vec2 A0 = uStrandA[0].xy, A3 = uStrandA[3].xy;
      vec2 Cm = (uStrandA[1].zw + uStrandA[2].zw) * 0.5;
      vec2 Tm = (uStrandT[1].xy + uStrandT[2].xy) * 0.5;
      vec2 Am = (A0 + A3) * 0.5;
      vec2 prevC = Am;
      float bestC = 1e9, tC = 0.0;
      for (int j = 1; j <= 14; j++) {
        float t = float(j) / 14.0;
        vec2 P = mix(mix(Am, Cm, t), mix(Cm, Tm, t), t);
        vec2 ab = P - prevC;
        float h = clamp(dot(sp - prevC, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
        float d = length(sp - prevC - ab * h);
        if (d < bestC) { bestC = d; tC = (float(j) - 1.0 + h) / 14.0; }
        prevC = P;
      }
      // Half-width of the fan at this point: wide at the planet, pinching to the tip.
      float spreadC = length(uStrandA[3].zw - uStrandA[0].zw);
      float halfW = length(A3 - A0) * 0.5 * (1.0 - tC) * (1.0 - tC) + spreadC * 0.6 * 4.0 * tC * (1.0 - tC) + 4.0;
      float across = bestC / halfW;
      // Made of many faint filaments (not a flat fill), so the strands dissolve into it.
      float fil = vnoise(vec2(across * 12.0 + 0.6 * sin(tC * 6.0 + uT * 0.4), tC * 4.0 - uT * 1.1));
      fil = 0.3 * fil + 0.7 * pow(vnoise(vec2(across * 26.0, tC * 7.0 - uT * 1.6)), 2.0) + 0.25 * fil * fil;
      float sheet = exp(-across * across * 1.3) * (0.35 + 0.9 * fil) * smoothstep(0.0, 0.12, tC) * (1.0 - smoothstep(0.7, 1.0, tC));
      float sheetStr = max(uStrandT[1].w, uStrandT[2].w);
      // Fade out well inside the region it is drawn in (no visible mask edges).
      vec2 e2 = min(sp - uStrandBox.xy, uStrandBox.zw - sp);
      float edgeFade = smoothstep(0.0, 50.0, min(e2.x, e2.y));
      col += vec3(0.78, 0.82, 0.88) * (sc3 * 0.3 + sheet * sheetStr * 0.24) * pointerInSpace * edgeFade;
    }
    // Fine grain baked into the image: a little heavier on the bright strands.
    float lum = dot(col, vec3(0.3333));
    col += (hash(sp + fract(uT)) - 0.5) * ((3.0 + 9.0 * smoothstep(0.05, 0.6, lum)) / 255.0);
    // Overall grade: a slight cool tint.
    col *= vec3(0.975, 0.993, 1.02);
    gl_FragColor = vec4(col, 1.0);
  } else {
    // Keep the menu strip clear at rest; once scrolling, rocks pass over it faintly.
    float band = 1.0 - smoothstep(uMenuH - 6.0, uMenuH + 36.0, sp.y);
    float keep = 1.0 - band * (1.0 - 0.4 * min(1.0, uP * 14.0));
    col *= vec3(0.975, 0.993, 1.02);
    gl_FragColor = vec4(col, cg.a) * keep;
  }
}
`;

// Cloud wisps (point sprites): each takes its look from the cloud where it
// broke off (density computed here from the same weather functions), drifts,
// swells a little and evaporates.
const WISP_VERT = `
precision highp float;
attribute vec4 aP;            // x, y (disc); age 0..1; seed
attribute vec2 aS;            // where it broke off (disc)
uniform vec2 uRes, uFrameC, uFrameS;
uniform float uP, uDpr, uT;
uniform vec4 uStorm[3];
varying float vA;
varying float vSeed;
varying vec3 vCol;
${NOISE}
${CLOUDS}
void main() {
  vec2 puv = vec2(1.0122, 0.65) + aP.xy * 883.0 / vec2(2000.0, 1126.0);
  vec2 oP = vec2(0.85, 0.58);
  vec2 f = oP + (puv - oP) * (1.25 - 0.25 * uP);
  vec2 sp = (uFrameC - 0.5 * uFrameS) + f * uFrameS;
  vec2 clip = sp / (uRes / uDpr) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  float r2 = dot(aP.xy, aP.xy);
  float z = sqrt(max(0.0, 1.0 - r2));
  float bonus, eye;
  vec2 tw = stormTwist(aS, bonus, eye);
  float dens = cloudDetail(cloudBase(aS), cloudCoords(tw));
  float age = aP.z;
  gl_PointSize = (5.0 + 9.0 * aP.w) * (1.0 + 0.9 * age) * uDpr * (uFrameS.x / 1800.0) * (0.4 + 0.6 * z);
  vA = dens * smoothstep(0.0, 0.08, age) * pow(1.0 - age, 1.4) * step(r2, 0.985) * smoothstep(0.0, 0.2, z);
  vSeed = aP.w;
  vec3 nrm = vec3(aP.xy, z);
  float light = clamp(dot(nrm, normalize(vec3(-0.85, -0.35, 0.4))), 0.0, 1.0);
  float night = smoothstep(-0.3, 0.3, (aP.x + 0.62) * 0.9 + (aP.y + 0.05));
  vCol = vec3(0.94, 0.96, 0.99) * (0.3 + 0.62 * light) * (1.0 - 0.72 * night);
}
`;

const WISP_FRAG = `
precision mediump float;
uniform float uBright;
varying float vA;
varying float vSeed;
varying vec3 vCol;
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
  float n = n1(c * 2.5 + vSeed * 31.0) * 0.6 + n1(c * 5.0 + vSeed * 17.0) * 0.4;
  float puff = smoothstep(1.0, 0.2, d) * smoothstep(0.25, 0.75, n + 0.25 * (1.0 - d));
  float a = clamp(puff * vA * 0.55 * uBright, 0.0, 1.0);
  gl_FragColor = vec4(vCol * a, a);
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
  planet: { files: ["/brand/planet-v2.webp", "/brand/planet-masks.png"], uniforms: ["uPlanet", "uMasks"] },
  meteors: {
    files: ["/brand/meteors-far.webp", "/brand/meteors-near.webp", "/brand/meteors-far-ids.png", "/brand/meteors-near-ids.png", "/brand/meteors-far-centres.png", "/brand/meteors-near-centres.png"],
    uniforms: ["uFar", "uNear", "uIdsFar", "uIdsNear", "uCentFar", "uCentNear"],
  },
} as const;

export function HeroScene({
  layer,
  progress,
  clock,
  onReady,
  onFail,
  onStorm,
  className,
}: {
  layer: "planet" | "meteors";
  progress: { current: number };
  /** Shared intro clock (ms timestamp) so both canvases animate in sync. */
  clock: { current: number };
  onReady?: () => void;
  /** A storm was planted at this point (CSS px, relative to the canvas). */
  onStorm?: (x: number, y: number) => void;
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
    // Preview aid: ?t=SECONDS starts the scene clock later (to check timed effects).
    const timeShift = Math.max(0, Number(new URLSearchParams(window.location.search).get("t")) || 0);
    let disposed = false;
    let raf = 0;
    let visible = true;

    // Compile without blocking the page where the browser allows it
    // (KHR_parallel_shader_compile); link status is only read once it is done.
    const parallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;
    const prog = gl.createProgram()!;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(vs, VERT);
    gl.shaderSource(fs, `#define uLayer ${transparent ? 1 : 0}\n` + FRAG);
    gl.compileShader(vs);
    gl.compileShader(fs);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    const linked = () =>
      new Promise<boolean>((resolve) => {
        const check = () => {
          if (disposed) return resolve(false);
          if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) {
            setTimeout(check, 50);
            return;
          }
          resolve(!!gl.getProgramParameter(prog, gl.LINK_STATUS));
        };
        check();
      });
    // Everything that touches the program waits until it has finished compiling.
    let teardown: (() => void) | undefined;
    const setup = (): (() => void) | undefined => {
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = (n: string) => gl.getUniformLocation(prog, n);
      const U = { res: u("uRes"), fc: u("uFrameC"), fs: u("uFrameS"), p: u("uP"), t: u("uT"), m: u("uM"), v: u("uV"), e: u("uE"), dpr: u("uDpr"), s: u("uS"), menu: u("uMenuH"), storm: u("uStorm[0]"), strandA: u("uStrandA[0]"), strandT: u("uStrandT[0]"), strandBox: u("uStrandBox") };
      gl.clearColor(0, 0, 0, 0);

      // Pointer state: the lens follows the cursor closely, while its strength
      // builds up / settles slowly over a couple of seconds.
      const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, svx: 0, svy: 0, e: 0, target: 0, lx: 0, ly: 0, lt: 0 };
      let dpr = 1;
      // Strands drawn off the planet toward the cursor (planet layer).
      const head = { x: -9999, y: -9999 };
      const strand = { on: 0 };
      const flowState = [0, 1, 2, 3].map(() => ({ tx: -9999, ty: -9999, cx: -9999, cy: -9999 }));
      let strandDt = 1;
      let strandLast = 0;
      const strandA = new Float32Array(24);
      const strandT = new Float32Array(24);
      // Pointer-driven simulations: weather over the planet, rocks in the meteor layer.
      const flow = layer === "planet" ? new FlowSim() : null;
      const fieldFar = layer === "meteors" ? new RockBodies(ROCKS.far.rocks, ROCKS.far.w, ROCKS.far.h, 110, 0.012) : null;
      const fieldNear = layer === "meteors" ? new RockBodies(ROCKS.near.rocks, ROCKS.near.w, ROCKS.near.h, 200, 0.006) : null;
      const prevSim = { disc: [NaN, NaN] };
      let lastFrame = 0;
      // Storms planted by clicking the planet (up to three): disc position, time, seed.
      const storms = [0, 1, 2].map(() => ({ x: 0, y: 0, t: -1e9, seed: Math.random() }));
      let nextStorm = 0;
      const stormData = new Float32Array(12);

      // Small data textures (weather flow, gravity fields), updated in place.
      const dataTex = new Map<number, WebGLTexture>();
      const uploadData = (unit: number, uniform: string, w: number, h: number, data: Uint8Array, exact = false) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        let t = dataTex.get(unit);
        if (!t) {
          t = gl.createTexture()!;
          dataTex.set(unit, t);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, exact ? gl.NEAREST : gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, exact ? gl.NEAREST : gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
          gl.uniform1i(u(uniform), unit);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
        }
      };
      const uploadSims = () => {
        if (flow) {
          uploadData(3, "uFlow", flow.n, flow.n, flow.data);
          flow.dirty = false;
        }
        if (fieldFar) uploadData(6, "uStateFar", 64, 64, fieldFar.state, true);
        if (fieldNear) uploadData(7, "uStateNear", 64, 64, fieldNear.state, true);
      };

      // Cloud wisps (planet only): a small second program drawing point sprites.
      const wisps = layer === "planet" ? new CloudWisps() : null;
      let wProg: WebGLProgram | null = null;
      let wBufA: WebGLBuffer | null = null;
      let wBufS: WebGLBuffer | null = null;
      let wLocA = -1;
      let wLocS = -1;
      const WU: Record<string, WebGLUniformLocation | null> = {};
      if (wisps) {
        try {
          wProg = gl.createProgram()!;
          gl.attachShader(wProg, compile(gl, gl.VERTEX_SHADER, WISP_VERT));
          gl.attachShader(wProg, compile(gl, gl.FRAGMENT_SHADER, WISP_FRAG));
          gl.linkProgram(wProg);
          if (!gl.getProgramParameter(wProg, gl.LINK_STATUS)) throw new Error("link");
          wLocA = gl.getAttribLocation(wProg, "aP");
          wLocS = gl.getAttribLocation(wProg, "aS");
          for (const n of ["uRes", "uFrameC", "uFrameS", "uP", "uDpr", "uT", "uStorm[0]", "uBright"]) WU[n] = gl.getUniformLocation(wProg, n);
          wBufA = gl.createBuffer();
          wBufS = gl.createBuffer();
        } catch {
          wProg = null; // the clouds still work, just without wisps
        }
        gl.useProgram(prog);
      }
      const drawWisps = (g: { cx: number; cy: number; fw: number; fh: number }, p: number, tSec: number) => {
        if (!wisps || !wProg || !wBufA || !wBufS || wisps.count === 0) return;
        gl.useProgram(wProg);
        gl.uniform2f(WU.uRes!, canvas.width, canvas.height);
        gl.uniform2f(WU.uFrameC!, g.cx, g.cy);
        gl.uniform2f(WU.uFrameS!, g.fw, g.fh);
        gl.uniform1f(WU.uP!, p);
        gl.uniform1f(WU.uDpr!, dpr);
        gl.uniform1f(WU.uT!, tSec);
        gl.uniform4fv(WU["uStorm[0]"]!, stormData);
        gl.uniform1f(WU.uBright!, smooth(2.0, 5.2, tSec) * (0.07 + 0.93 * smooth(0, 1, p)));
        gl.bindBuffer(gl.ARRAY_BUFFER, wBufA);
        gl.bufferData(gl.ARRAY_BUFFER, wisps.a.subarray(0, wisps.count * 4), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(wLocA);
        gl.vertexAttribPointer(wLocA, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, wBufS);
        gl.bufferData(gl.ARRAY_BUFFER, wisps.s.subarray(0, wisps.count * 2), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(wLocS);
        gl.vertexAttribPointer(wLocS, 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.POINTS, 0, wisps.count);
        gl.disable(gl.BLEND);
        if (wLocA !== loc) gl.disableVertexAttribArray(wLocA);
        if (wLocS !== loc) gl.disableVertexAttribArray(wLocS);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      };
      // Adaptive quality: lower the planet's render scale if frames run long.
      const quality = { scale: 1, ema: 16, last: 0, changed: 0 };
      const menuH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 84;
      // Scroll speed, smoothed, so streaks swell while you scroll and settle after.
      const scroll = { p: progress.current, t: 0, v: 0 };

      const smooth = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2) * quality.scale;
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
        if (!transparent) {
          strandDt = strandLast ? Math.min(6, (now - strandLast) / 16.67) : 1;
          strandLast = now;
          if (pointer.tx > -9000) {
            head.x = head.x < -9000 ? pointer.tx : head.x + (pointer.tx - head.x) * 0.18;
            head.y = head.y < -9000 ? pointer.ty : head.y + (pointer.ty - head.y) * 0.18;
          }
          // The planet on screen (matches the shader's frame and zoom).
          const sP = 1.25 - 0.25 * progress.current;
          const pcx = g.cx - g.fw / 2 + (0.85 + (1.0122 - 0.85) * sP) * g.fw;
          const pcy = g.cy - g.fh / 2 + (0.58 + (0.65 - 0.58) * sP) * g.fh;
          const pr = (883 / 2000) * g.fw * sP;
          const dx = head.x - pcx;
          const dy = head.y - pcy;
          const out = Math.hypot(dx, dy) - pr;
          // All strands stem from one place: where the main streams meet the
          // planet (the limb point facing the streams' crossing). From there they
          // leave along the streams and bend up or down toward the cursor.
          const toScreen = (sx: number, sy: number): [number, number] => [
            g.cx - g.fw / 2 + (0.85 + (sx / 2000 - 0.85) * sP) * g.fw,
            g.cy - g.fh / 2 + (0.58 + (sy / 1126 - 0.58) * sP) * g.fh,
          ];
          const [ax, ay] = toScreen(2024.4 - 0.9906 * (883 - 14), 731.9 - 0.1353 * (883 - 14));
          const [lx, ly] = toScreen(2024.4 - 0.9906 * 883, 731.9 - 0.1353 * 883);
          const ox = lx - ax || -1, oy = ly - ay;
          const on = Math.hypot(ox, oy);
          const tx0 = ox / on, ty0 = oy / on;                 // outward, along the streams
          const reach = Math.hypot(head.x - ax, head.y - ay);
          // Present while the cursor is out in space, not too far off; eases in/out.
          // Only as the rocks clear: faint while the last ones leave, full once gone.
          const clear = smooth(0.72, 0.97, progress.current);
          const want = head.x > -9000 && out > 8 && reach < pr * 1.3 && clear > 0 && !reduced ? clear : 0;
          strand.on += (want - strand.on) * (1 - Math.pow(1 - (want > strand.on ? 0.04 : 0.06), strandDt));
          strandA.fill(0);
          strandT.fill(0);
          if (strand.on > 0.002) {
            // Perpendicular to the line from the root to the cursor.
            const ux = (head.x - ax) / Math.max(reach, 1), uy = (head.y - ay) / Math.max(reach, 1);
            const px = -uy, py = ux;
            let x0 = Math.min(head.x, ax), y0 = Math.min(head.y, ay);
            let x1 = Math.max(head.x, ax), y1 = Math.max(head.y, ay);
            // Roots spread across the middle of the limb (fixed points, like the
            // streams in the artwork); each leaves along the streams and bends
            // toward the cursor, where they gather.
            // (Centred a little higher up the limb than the streams' crossing.)
            const baseAng = Math.atan2(ay - pcy, ax - pcx) + 0.1;
            const mrx = pcx + Math.cos(baseAng) * (pr - 14);
            const mry = pcy + Math.sin(baseAng) * (pr - 14);
            for (let k = 0; k < 4; k++) {
              const s = k - 1.5;
              const ra = baseAng + s * 0.09;
              const rx = pcx + Math.cos(ra) * (pr - 14);
              const ry = pcy + Math.sin(ra) * (pr - 14);
              // Ethereal, not elastic: each strand's tip and bend drift after the
              // cursor at their own unhurried pace, with a slow independent sway,
              // so they trail and settle like smoke rather than snapping.
              const st = flowState[k]!;
              // Frame-rate independent (≈ 0.025–0.06 per 60 Hz frame).
              const ease = 1 - Math.pow(1 - (0.025 + 0.012 * k), strandDt);
              const wob = Math.sin(((now - clock.current) / 1000) * (0.35 + 0.07 * k) + k * 2.3);
              const tgx = head.x + px * s * 6 + px * wob * 10;
              const tgy = head.y + py * s * 6 + py * wob * 10;
              if (st.tx < -9000) {
                st.tx = rx;
                st.ty = ry;
              }
              st.tx += (tgx - st.tx) * ease;
              st.ty += (tgy - st.ty) * ease;
              const tx = st.tx, ty = st.ty;
              const reachK = Math.hypot(tx - rx, ty - ry);
              // Concave: bowing in toward the shared middle line, leaning along the streams.
              const midx = (rx + tx) / 2, midy = (ry + ty) / 2;
              const axmx = (mrx + tx) / 2, axmy = (mry + ty) / 2;
              const gcx = midx + (axmx - midx) * 1.15 + tx0 * reachK * 0.12 + px * wob * reachK * 0.04;
              const gcy = midy + (axmy - midy) * 1.15 + ty0 * reachK * 0.12 + py * wob * reachK * 0.04;
              if (st.cx < -9000) {
                st.cx = gcx;
                st.cy = gcy;
              }
              const ease2 = 1 - Math.pow(1 - (0.025 + 0.012 * k) * 0.7, strandDt);
              st.cx += (gcx - st.cx) * ease2;
              st.cy += (gcy - st.cy) * ease2;
              const cxp = st.cx, cyp = st.cy;
              x0 = Math.min(x0, rx, tx);
              y0 = Math.min(y0, ry, ty);
              x1 = Math.max(x1, rx, tx);
              y1 = Math.max(y1, ry, ty);
              strandA.set([rx, ry, cxp, cyp], k * 4);
              strandT.set([tx, ty, 1.5 + 0.6 * (k % 2), strand.on * (k === 1 || k === 2 ? 1 : 0.75) * (1 - 0.5 * Math.min(1, reach / (pr * 1.3)))], k * 4);
              x0 = Math.min(x0, cxp);
              y0 = Math.min(y0, cyp);
              x1 = Math.max(x1, cxp);
              y1 = Math.max(y1, cyp);
            }
            // Generous padding: the sheet's soft falloff must end well inside it.
            const pad = 90 + reach * 0.25;
            gl.uniform4f(U.strandBox, x0 - pad, y0 - pad, x1 + pad, y1 + pad);
          } else {
            for (const st of flowState) st.tx = st.cx = -9999;
            gl.uniform4f(U.strandBox, 0, 0, -1, -1);
          }
          gl.uniform4fv(U.strandA, strandA);
          gl.uniform4fv(U.strandT, strandT);
        }
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
        gl.uniform1f(U.t, reduced ? 10 : (now - clock.current) / 1000 + timeShift);
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
        const tSec = (now - clock.current) / 1000 + timeShift;
        const p = progress.current;
        const fx = (pointer.tx - (g.cx - g.fw / 2)) / g.fw;
        const fy = (pointer.ty - (g.cy - g.fh / 2)) / g.fh;
        const hasPointer = pointer.tx > -9000 && !reduced;
        const dt = lastFrame ? Math.min(3, Math.max(0.5, (now - lastFrame) / 16.67)) : 1;
        lastFrame = now;
        if (flow) {
          const sP = 1.25 - 0.25 * p;
          const mx = ((0.85 + (fx - 0.85) / sP - 1.0122) * 2000) / 883;
          const my = ((0.58 + (fy - 0.58) / sP - 0.65) * 1126) / 883;
          const [lx, ly] = prevSim.disc;
          // The weather only responds once the planet is revealed (later in the scroll);
          // before that, the rocks are the only thing the pointer moves.
          const stir = hasPointer && p > 0.6;
          const dmx = stir && Number.isFinite(lx) ? mx - lx! : 0;
          const dmy = stir && Number.isFinite(ly) ? my - ly! : 0;
          // The pointer's wake gently moves the air, and the air carries the cloud.
          flow.step(mx, my, dmx, dmy, dt);
          if (wisps) {
            if (stir) wisps.spawn(mx, my, dmx, dmy, dt);
            wisps.step(flow, dt);
          }
          prevSim.disc = [mx, my];
          heroSignal.overPlanet = p > 0.6 && mx * mx + my * my < 1.05;
          storms.forEach((st, k) => stormData.set([st.x, st.y, (now - st.t) / 1000, st.seed], k * 4));
          gl.uniform4fv(U.storm, stormData);
        }
        if (fieldFar && fieldNear) {
          // Before scrolling, the pointer is a soft reverse singularity among the rocks.
          const enabled = hasPointer && p < 0.08 && tSec > 1.5;
          const release = p > 0.08;
          const sF = 1 + 0.9 * p + 0.08 * (1 - smooth(0.8, 3.0, tSec));
          const sN = 1.05 + 1.7 * p + 0.1 * (1 - smooth(0.4, 2.4, tSec));
          fieldFar.step((0.5 + (fx - 0.5) / sF) * fieldFar.w, (0.5 + (fy - 0.5) / sF) * fieldFar.h, enabled, release, dt);
          fieldNear.step((0.5 + (fx - 0.5) / sN) * fieldNear.w, (0.95 + (fy - 0.95) / sN) * fieldNear.h, enabled, release, dt);
        }
        if ((flow && flow.dirty) || (fieldFar && (fieldFar.awake || fieldNear!.awake))) uploadSims();
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        drawWisps(g, p, tSec);
      };

      const loop = (now: number) => {
        if (disposed) return;
        if (visible && !document.hidden) {
          draw(now);
          // Adaptive quality (planet only): if frames run long, render a little
          // smaller; recover when there is headroom. At most one change per 2s.
          if (layer === "planet" && quality.last) {
            quality.ema += (Math.min(100, now - quality.last) - quality.ema) * 0.05;
            if (now - quality.changed > 2000) {
              const next = quality.ema > 24 ? Math.max(0.55, quality.scale - 0.15) : quality.ema < 15 ? Math.min(1, quality.scale + 0.1) : quality.scale;
              if (next !== quality.scale) {
                quality.scale = next;
                quality.changed = now;
                resize();
              }
            }
          }
          quality.last = now;
        } else quality.last = 0;
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
            // Rock id maps must be read exactly: nearest filtering, no colour conversion.
            const ids = src.uniforms[i]!.startsWith("uIds") || src.uniforms[i]!.startsWith("uCent");
            const filter = ids ? gl.NEAREST : gl.LINEAR;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, ids ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.uniform1i(u(src.uniforms[i]!), i);
          });
          uploadSims();
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
      // Clicking the planet plants a small storm there.
      const onDown = (e: PointerEvent) => {
        if (!flow || reduced || progress.current < 0.6) return;
        const rect = canvas.getBoundingClientRect();
        const g = frameGeometry(rect.width, rect.height);
        const fx = (e.clientX - rect.left - (g.cx - g.fw / 2)) / g.fw;
        const fy = (e.clientY - rect.top - (g.cy - g.fh / 2)) / g.fh;
        const sP = 1.25 - 0.25 * progress.current;
        const mx = ((0.85 + (fx - 0.85) / sP - 1.0122) * 2000) / 883;
        const my = ((0.58 + (fy - 0.58) / sP - 0.65) * 1126) / 883;
        if (mx * mx + my * my > 1) return;
        const st = storms[nextStorm]!;
        nextStorm = (nextStorm + 1) % storms.length;
        st.x = mx;
        st.y = my;
        st.t = performance.now();
        st.seed = Math.random();
        heroSignal.surgeAt = st.t;
        flow.vortex(mx, my);
        onStorm?.(e.clientX - rect.left, e.clientY - rect.top);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      return () => {
        window.removeEventListener("pointerdown", onDown);
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
      };
    };
    void linked().then((ok) => {
      if (disposed) return;
      if (!ok) {
        onFail?.();
        return;
      }
      teardown = setup();
    });
    return () => {
      disposed = true;
      teardown?.();
    };
  }, [layer, progress, clock, onReady, onFail, onStorm]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
