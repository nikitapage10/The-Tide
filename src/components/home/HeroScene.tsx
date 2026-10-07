"use client";
/**
 * WebGL hero scene: planet, middle meteors and outer meteors composited in one
 * shader at screen resolution (full-size source images, no CSS upscaling).
 *
 * - Intro: outer rocks fade in first, then the middle rocks, then the planet.
 *   Each layer is darker than the one in front; the planet starts very dark
 *   and gains its light as you scroll in (progress p: 0 → 1).
 * - Gravity lens: moving the pointer bends space around it. Everything near
 *   it is pulled and slightly twisted (frame-dragging), with chromatic
 *   fringing, an Einstein ring, an anamorphic streak and faint ghosts.
 *   It appears only while the pointer moves and decays within about a second.
 *
 * Geometry matches the CSS .hero-frame so DOM callouts stay pinned to the art.
 * If WebGL is unavailable the DOM image layers underneath remain visible.
 */
import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uPlanet, uFar, uNear;
uniform vec2 uRes;        // canvas size in px
uniform vec2 uFrameC;     // frame centre in px (top-left origin)
uniform vec2 uFrameS;     // frame size in px
uniform float uP;         // scroll progress
uniform float uT;         // seconds since textures loaded
uniform vec2 uM;          // pointer in px (top-left origin)
uniform vec2 uV;          // pointer velocity (px/frame, smoothed)
uniform float uE;         // lens energy 0..1
uniform float uDpr;

float intro(float a, float b) { return smoothstep(a, b, uT); }

vec4 tex(sampler2D s, vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(s, uv);
}

// Backlit meteor: dark body with a thin rim of light from the upper left.
vec4 meteor(sampler2D s, vec2 uv, float bright, float rimAmt, vec2 px) {
  vec4 c = tex(s, uv);
  float edge = clamp(c.a - tex(s, uv + vec2(-1.6, -1.6) * px).a, 0.0, 1.0);
  vec3 col = c.rgb * bright + vec3(edge * rimAmt);
  return vec4(col, c.a);
}

vec3 scene(vec2 sp) {
  vec2 f = (sp - (uFrameC - 0.5 * uFrameS)) / uFrameS;   // frame uv (0..1)
  vec2 px = 1.0 / uFrameS;

  float iNear = intro(0.0, 1.3);
  float iFar = intro(0.55, 1.9);
  float iPlanet = intro(1.1, 2.8);

  // Planet: zooms out around its centre as you scroll; dark until you scroll in.
  float sP = 1.25 - 0.25 * uP + 0.06 * (1.0 - iPlanet);
  vec2 oP = vec2(0.85, 0.58);
  vec3 col = tex(uPlanet, oP + (f - oP) / sP).rgb;
  col *= iPlanet * mix(0.16, 1.0, smoothstep(0.0, 1.0, uP));

  // Middle rocks: darker, spread outward and thin out.
  float sF = 1.0 + 0.9 * uP + 0.08 * (1.0 - iFar);
  vec4 far = meteor(uFar, 0.5 + (f - 0.5) / sF, 0.45, 0.55, px / sF);
  col = mix(col, far.rgb, far.a * iFar * clamp(1.0 - 0.55 * uP, 0.0, 1.0));

  // Outer rocks: brightest, fly past the camera.
  float sN = 1.05 + 1.6 * uP + 0.1 * (1.0 - iNear);
  vec4 near = meteor(uNear, 0.5 + (f - 0.5) / sN, 0.8, 0.35, px / sN);
  col = mix(col, near.rgb, near.a * iNear * clamp(1.0 - 1.7 * uP, 0.0, 1.0));
  return col;
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;   // css px, top-left origin
  vec2 res = uRes / uDpr;
  float R = 0.16 * min(res.x, res.y);                                // lens radius

  vec2 d = sp - uM;
  float r = length(d);
  float fall = exp(-(r * r) / (R * R * 2.2));
  float e = uE;

  // Gravitational lens: pull toward the pointer (strong near, fading out),
  // plus a twist along the direction of motion (frame dragging).
  float pull = e * 0.85 * R * R / (r * r + R * R * 0.16) * fall;
  vec2 dir = r > 0.001 ? d / r : vec2(0.0);
  float twist = e * 0.9 * fall * clamp(length(uV) / 18.0, 0.2, 1.0) * sign(uV.x + uV.y + 0.0001);
  float cs = cos(twist), sn = sin(twist);
  vec2 dRot = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  vec2 warped = uM + dRot - dir * pull;

  // Chromatic fringing grows inside the bend.
  vec2 ca = dir * e * 5.0 * fall;
  vec3 col;
  col.r = scene(warped + ca).r;
  col.g = scene(warped).g;
  col.b = scene(warped - ca).b;

  // Lens flare (additive, only while moving).
  vec2 vdir = length(uV) > 0.01 ? normalize(uV) : vec2(1.0, 0.0);
  vec2 local = vec2(dot(d, vdir), dot(d, vec2(-vdir.y, vdir.x)));
  float streak = exp(-abs(local.y) / 1.6) * exp(-abs(local.x) / (R * 3.2));
  float ring = exp(-pow((r - R * 0.42) / (R * 0.045), 2.0));
  float glow = exp(-(r * r) / (R * R * 0.08));
  vec2 c = res * 0.5;
  float ghosts = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = -0.45 - 0.55 * float(i);
    vec2 gpos = c + (uM - c) * k;
    float gr = R * (0.08 + 0.05 * float(i));
    ghosts += smoothstep(gr, gr * 0.6, length(sp - gpos)) * (0.05 - 0.012 * float(i));
  }
  vec3 flare = vec3(0.86, 0.92, 1.0) * (streak * 0.45 + ring * 0.3 + glow * 0.14 + ghosts * 1.4) * e;
  flare += vec3(ring * 0.06, 0.0, ring * 0.09) * e;      // faint spectral edge on the ring

  gl_FragColor = vec4(col + flare, 1.0);
}
`;

export interface SceneHandle {
  progress: { current: number };
}

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

export function HeroScene({ progress, onReady, className }: { progress: { current: number }; onReady: () => void; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) return;
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
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    } catch {
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
    const U = {
      res: u("uRes"), fc: u("uFrameC"), fs: u("uFrameS"), p: u("uP"), t: u("uT"), m: u("uM"), v: u("uV"), e: u("uE"), dpr: u("uDpr"),
    };

    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, e: 0, lx: 0, ly: 0, lt: 0 };
    let start = 0;
    let dpr = 1;

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
      pointer.x += (pointer.tx - pointer.x) * 0.2;
      pointer.y += (pointer.ty - pointer.y) * 0.2;
      pointer.e *= 0.95;
      pointer.vx *= 0.9;
      pointer.vy *= 0.9;
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.fc, g.cx, g.cy);
      gl.uniform2f(U.fs, g.fw, g.fh);
      gl.uniform1f(U.p, progress.current);
      gl.uniform1f(U.t, reduced ? 10 : (now - start) / 1000);
      gl.uniform2f(U.m, pointer.x, pointer.y);
      gl.uniform2f(U.v, pointer.vx, pointer.vy);
      gl.uniform1f(U.e, reduced ? 0 : pointer.e);
      gl.uniform1f(U.dpr, dpr);
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
      pointer.vx = pointer.vx * 0.6 + vx * 0.4;
      pointer.vy = pointer.vy * 0.6 + vy * 0.4;
      pointer.lx = x;
      pointer.ly = y;
      pointer.lt = now;
      if (pointer.e < 0.02) {
        pointer.x = x;
        pointer.y = y;
      }
      pointer.tx = x;
      pointer.ty = y;
      pointer.e = Math.min(1, pointer.e + Math.min(0.18, Math.hypot(vx, vy) / 90));
    };

    Promise.all(["/brand/planet-v2.webp", "/brand/meteors-far.webp", "/brand/meteors-near.webp"].map(loadImage))
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
        });
        gl.uniform1i(u("uPlanet"), 0);
        gl.uniform1i(u("uFar"), 1);
        gl.uniform1i(u("uNear"), 2);
        resize();
        start = performance.now();
        onReady();
        raf = requestAnimationFrame(loop);
      })
      .catch(() => undefined);

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
  }, [progress, onReady]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
