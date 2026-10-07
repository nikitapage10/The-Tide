"use client";
/**
 * WebGL hero scene: planet, middle meteors and outer meteors composited in one
 * shader at screen resolution (full-size source images, no CSS upscaling).
 *
 * - Intro: outer rocks fade in first, then the middle rocks, then the planet.
 *   Each layer is darker than the one in front; the planet starts very dark
 *   and gains its light as you scroll in (progress p: 0 → 1).
 * - Gravity lens: moving the pointer slowly bends space around it. Everything
 *   near it is gently pulled and twisted, with a trace of chromatic fringing.
 *   It eases in while the pointer moves and eases out when it stops.
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

// Planet with a luminance-masked unsharp mask: crisper streams and surface
// detail without amplifying compression blocks in the dark areas.
vec3 sharpPlanet(vec2 uv) {
  vec2 tx = 1.0 / vec2(2000.0, 1126.0);
  vec3 c0 = tex(uPlanet, uv).rgb;
  vec3 blur = (tex(uPlanet, uv + vec2(tx.x, 0.0)).rgb + tex(uPlanet, uv - vec2(tx.x, 0.0)).rgb
             + tex(uPlanet, uv + vec2(0.0, tx.y)).rgb + tex(uPlanet, uv - vec2(0.0, tx.y)).rgb) * 0.25;
  float lum = dot(c0, vec3(0.3333));
  float k = 1.1 * smoothstep(0.05, 0.3, lum);
  return max(c0 + (c0 - blur) * k, 0.0);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

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

  float iNear = intro(0.6, 1.9);
  float iFar = intro(1.3, 2.7);
  float iPlanet = intro(2.0, 3.8);

  // Planet: zooms out around its centre as you scroll; dark until you scroll in.
  float sP = 1.25 - 0.25 * uP + 0.06 * (1.0 - iPlanet);
  vec2 oP = vec2(0.85, 0.58);
  vec3 col = sharpPlanet(oP + (f - oP) / sP);
  col *= iPlanet * mix(0.07, 1.0, smoothstep(0.0, 1.0, uP));

  // Middle rocks: darker, spread outward and thin out.
  float sF = 1.0 + 0.9 * uP + 0.08 * (1.0 - iFar);
  vec4 far = meteor(uFar, 0.5 + (f - 0.5) / sF, mix(0.22, 0.45, uP), mix(0.3, 0.55, uP), px / sF);
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
  float R = 0.2 * min(res.x, res.y);                                 // lens radius

  vec2 d = sp - uM;
  float r = length(d);
  float fall = exp(-(r * r) / (R * R * 2.0));
  // Barely there before you scroll; grows as you scroll in.
  float e = uE * mix(0.12, 1.0, smoothstep(0.0, 1.0, uP));

  // Gentle gravitational lens: a soft pull toward the pointer and a slow twist
  // that follows the (heavily smoothed) direction of motion.
  float pull = e * 0.32 * R * R / (r * r + R * R * 0.35) * fall;
  vec2 dir = r > 0.001 ? d / r : vec2(0.0);
  float twist = e * 0.22 * fall * clamp(uV.x / 30.0, -1.0, 1.0);
  float cs = cos(twist), sn = sin(twist);
  vec2 dRot = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  vec2 warped = uM + dRot - dir * pull;

  // A trace of chromatic fringing inside the bend.
  vec2 ca = dir * e * 1.4 * fall;
  vec3 col;
  col.r = scene(warped + ca).r;
  col.g = scene(warped).g;
  col.b = scene(warped - ca).b;

  // Small lens-flare ghosts thrown off the pointer along the line through the
  // screen centre (no halo or streak). Soft-edged and faint.
  vec2 c = res * 0.5;
  float ghosts = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 gpos = c + (uM - c) * (-0.35 - 0.4 * fi);
    float gr = R * (0.05 + 0.035 * fi);
    ghosts += smoothstep(gr, gr * 0.35, length(sp - gpos)) * (0.07 - 0.012 * fi);
  }
  col += vec3(0.85, 0.92, 1.0) * ghosts * e;

  // A whisper of grain hides banding and compression blocks in deep blacks.
  col += (hash(sp + fract(uT)) - 0.5) * (2.2 / 255.0);

  gl_FragColor = vec4(col, 1.0);
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

export function HeroScene({
  progress,
  onReady,
  onFail,
  className,
}: {
  progress: { current: number };
  onReady: () => void;
  onFail: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) {
      onFail();
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
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        onFail();
        return;
      }
    } catch {
      onFail();
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

    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, svx: 0, svy: 0, e: 0, target: 0, lx: 0, ly: 0, lt: 0 };
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
      // Slow, smooth easing: the lens trails the pointer and swells/settles gradually.
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      pointer.target *= 0.97;
      pointer.e += (pointer.target - pointer.e) * 0.035;
      pointer.svx += (pointer.vx - pointer.svx) * 0.04;
      pointer.svy += (pointer.vy - pointer.svy) * 0.04;
      pointer.vx *= 0.94;
      pointer.vy *= 0.94;
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.fc, g.cx, g.cy);
      gl.uniform2f(U.fs, g.fw, g.fh);
      gl.uniform1f(U.p, progress.current);
      gl.uniform1f(U.t, reduced ? 10 : (now - start) / 1000);
      gl.uniform2f(U.m, pointer.x, pointer.y);
      gl.uniform2f(U.v, pointer.svx, pointer.svy);
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
      if (pointer.e < 0.01) {
        pointer.x = x;
        pointer.y = y;
      }
      pointer.tx = x;
      pointer.ty = y;
      pointer.target = Math.min(1, pointer.target + Math.min(0.08, Math.hypot(vx, vy) / 260));
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
      .catch(() => onFail());

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
  }, [progress, onReady, onFail]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
