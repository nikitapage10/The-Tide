/**
 * Small, allocation-free simulations driven by the pointer on the home hero.
 *
 * - RockBodies: every rock is its own body in space (momentum, spin, a slow
 *   drift home); the pointer is a soft repulsor.
 * - FlowSim: a 64×64 "stable fluids" grid over the planet's disc. The pointer
 *   stirs the air (and planted storms set it turning); the GPU cloud
 *   simulation is carried by this air, and a "cleared" channel thins the haze
 *   where you brush through (it slowly fills back in).
 */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * Rocks as independent bodies in space. Each has its own momentum and spin;
 * there is almost no drag, so a pushed rock glides, slows gradually and drifts
 * back home slowly. The pointer is a soft repulsor whose push falls off with
 * distance and is divided by the rock's mass (big rocks barely move). Rocks cut
 * by the frame only move outward past the edges they are cut by.
 *
 * Shader data, one 64×64 RGBA texture: per-rock offset (16-bit x, y) at
 * (id % 32, id / 32), angle at (32 + id % 32, id / 32), and a coarse 48×27
 * "hint" grid of offsets (rows 32–58) telling the shader where to look for a
 * rock that moved onto a pixel.
 */
export class RockBodies {
  readonly n: number;
  private cx: Float32Array;
  private cy: Float32Array;
  private mass: Float32Array;
  private reachR: Float32Array;
  private flags: Uint8Array;
  private ox: Float32Array;
  private oy: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private a: Float32Array;
  private va: Float32Array;
  private presence = 0;
  readonly state = new Uint8Array(64 * 64 * 4);
  readonly gw = 48;
  readonly gh = 27;
  private hintMag = new Float32Array(48 * 27);
  awake = false;

  constructor(
    rocks: readonly (readonly number[])[],
    readonly w: number,
    readonly h: number,
    /** Reach of the push around the pointer (source px). */
    readonly reach: number,
    /** Strength of the push. */
    readonly strength: number,
  ) {
    const n = (this.n = Math.min(rocks.length, 1023));
    this.cx = Float32Array.from(rocks.slice(0, n), (r) => r[0]!);
    this.cy = Float32Array.from(rocks.slice(0, n), (r) => r[1]!);
    this.reachR = Float32Array.from(rocks.slice(0, n), (r) => r[2]!);
    this.mass = Float32Array.from(rocks.slice(0, n), (r) => 0.6 + (r[2]! / 22) ** 2);
    this.flags = Uint8Array.from(rocks.slice(0, n), (r) => r[3]!);
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.a = new Float32Array(n);
    this.va = new Float32Array(n);
    this.pack();
  }

  /** mx, my: pointer in source px. dt: frames elapsed (≈1). */
  step(mx: number, my: number, enabled: boolean, release: boolean, dt: number) {
    const on = enabled && Number.isFinite(mx) && Number.isFinite(my);
    this.presence += ((on ? 1 : 0) - this.presence) * Math.min(1, 0.01 * dt);
    if (!this.awake && this.presence < 0.002) return;
    const R = this.reach;
    const G = this.strength * this.presence;
    // Nearly frictionless; a very soft pull home (stronger when leaving the hero).
    const drag = release ? 0.9 : 0.986;
    const k = release ? 0.02 : 0.00012;
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      const f = this.flags[i]!;
      let fx = 0;
      let fy = 0;
      if (G > 0.0005) {
        const rx = this.cx[i]! + this.ox[i]! - mx;
        const ry = this.cy[i]! + this.oy[i]! - my;
        const d2 = rx * rx + ry * ry;
        const RR = R + this.reachR[i]!;
        if (d2 < 9 * RR * RR) {
          const d = Math.sqrt(d2) || 1;
          const push = (G * Math.exp(-d2 / (RR * RR))) / this.mass[i]!;
          fx = (rx / d) * push;
          fy = (ry / d) * push;
          // A little spin from an off-centre push.
          this.va[i] = this.va[i]! + ((rx * fy - ry * fx) / (RR * RR)) * 0.002 * dt;
        }
      }
      let vx = (this.vx[i]! + (fx - k * this.ox[i]!) * dt) * Math.pow(drag, dt);
      let vy = (this.vy[i]! + (fy - k * this.oy[i]!) * dt) * Math.pow(drag, dt);
      // Never fast.
      const sp = Math.hypot(vx, vy);
      if (sp > 0.45) {
        vx *= 0.45 / sp;
        vy *= 0.45 / sp;
      }
      let ox = this.ox[i]! + vx * dt;
      let oy = this.oy[i]! + vy * dt;
      // Cut rocks only ever move outward past their cut edges.
      if (f & 1 && ox > 0) {
        ox = 0;
        vx = Math.min(vx, 0);
      }
      if (f & 2 && ox < 0) {
        ox = 0;
        vx = Math.max(vx, 0);
      }
      if (f & 4 && oy > 0) {
        oy = 0;
        vy = Math.min(vy, 0);
      }
      if (f & 8 && oy < 0) {
        oy = 0;
        vy = Math.max(vy, 0);
      }
      this.ox[i] = Math.max(-120, Math.min(120, ox));
      this.oy[i] = Math.max(-120, Math.min(120, oy));
      this.vx[i] = vx;
      this.vy[i] = vy;
      const va = (this.va[i]! - k * 0.6 * this.a[i]! * dt) * Math.pow(drag, dt);
      this.va[i] = f ? 0 : clamp(va, -0.004, 0.004);
      this.a[i] = f ? 0 : clamp(this.a[i]! + this.va[i]! * dt, -1.2, 1.2);
      live = Math.max(live, Math.abs(this.ox[i]!), Math.abs(this.oy[i]!), Math.abs(this.a[i]!) * 40, sp * 20);
    }
    this.awake = live > 0.05 || this.presence > 0.002;
    if (!this.awake) {
      this.ox.fill(0);
      this.oy.fill(0);
      this.vx.fill(0);
      this.vy.fill(0);
      this.a.fill(0);
      this.va.fill(0);
    }
    this.pack();
  }

  private pack() {
    const enc16 = (v: number, range: number) => clamp(Math.round((v / range + 0.5) * 65535), 0, 65535);
    const S = this.state;
    const at = (x: number, y: number) => (y * 64 + x) * 4;
    this.hintMag.fill(0);
    for (let j = 0; j < this.gh; j++)
      for (let i = 0; i < this.gw; i++) {
        const o = at(i, 32 + j);
        S[o] = 128;
        S[o + 1] = 128;
        S[o + 2] = 0;
        S[o + 3] = 255;
      }
    for (let i = 0; i < this.n; i++) {
      const id = i + 1;
      const x = enc16(this.ox[i]!, 256);
      const y = enc16(this.oy[i]!, 256);
      const an = enc16(this.a[i]!, 8);
      const o = at(id % 32, Math.floor(id / 32));
      S[o] = x >> 8;
      S[o + 1] = x & 255;
      S[o + 2] = y >> 8;
      S[o + 3] = y & 255;
      const oa = at(32 + (id % 32), Math.floor(id / 32));
      S[oa] = an >> 8;
      S[oa + 1] = an & 255;
      S[oa + 3] = 255;
      // Hint grid: cells the moved rock now covers point back by its offset.
      const mag = Math.hypot(this.ox[i]!, this.oy[i]!);
      if (mag < 0.5) continue;
      const r = this.reachR[i]! * 1.3 + 6;
      const nx = this.cx[i]! + this.ox[i]!;
      const ny = this.cy[i]! + this.oy[i]!;
      const i0 = Math.max(0, Math.floor(((nx - r) / this.w) * this.gw));
      const i1 = Math.min(this.gw - 1, Math.floor(((nx + r) / this.w) * this.gw));
      const j0 = Math.max(0, Math.floor(((ny - r) / this.h) * this.gh));
      const j1 = Math.min(this.gh - 1, Math.floor(((ny + r) / this.h) * this.gh));
      for (let j = j0; j <= j1; j++)
        for (let ii = i0; ii <= i1; ii++) {
          const q = j * this.gw + ii;
          if (mag <= this.hintMag[q]!) continue;
          this.hintMag[q] = mag;
          const oh = at(ii, 32 + j);
          S[oh] = clamp(Math.round((this.ox[i]! / 256 + 0.5) * 255), 0, 255);
          S[oh + 1] = clamp(Math.round((this.oy[i]! / 256 + 0.5) * 255), 0, 255);
        }
    }
  }
}

export class FlowSim {
  readonly n = 64;
  private u = new Float32Array(64 * 64);
  private v = new Float32Array(64 * 64);
  private t1 = new Float32Array(64 * 64);
  private t2 = new Float32Array(64 * 64);
  private p = new Float32Array(64 * 64);
  private div = new Float32Array(64 * 64);
  private clr = new Float32Array(64 * 64);
  readonly data = new Uint8Array(64 * 64 * 4);
  awake = true;

  constructor() {
    this.pack();
  }

  private sample(f: Float32Array, x: number, y: number) {
    const n = this.n;
    x = clamp(x, 0, n - 1.001);
    y = clamp(y, 0, n - 1.001);
    const i = x | 0;
    const j = y | 0;
    const fx = x - i;
    const fy = y - j;
    const k = j * n + i;
    return (f[k]! * (1 - fx) + f[k + 1]! * fx) * (1 - fy) + (f[k + n]! * (1 - fx) + f[k + n + 1]! * fx) * fy;
  }

  /** Air velocity at a disc position (disc units per frame). */
  velocityAt(x: number, y: number): [number, number] {
    const gx = ((x + 1) / 2) * this.n - 0.5;
    const gy = ((y + 1) / 2) * this.n - 0.5;
    const s = 2 / this.n;
    return [this.sample(this.u, gx, gy) * s, this.sample(this.v, gx, gy) * s];
  }

  /** A storm you planted: the air starts turning around the point. */
  vortex(mx: number, my: number) {
    const n = this.n;
    const gx = ((mx + 1) / 2) * n - 0.5;
    const gy = ((my + 1) / 2) * n - 0.5;
    const r = 3.5;
    for (let j = Math.max(0, (gy - 3 * r) | 0); j < Math.min(n, gy + 3 * r); j++)
      for (let i = Math.max(0, (gx - 3 * r) | 0); i < Math.min(n, gx + 3 * r); i++) {
        const ex = i - gx;
        const ey = j - gy;
        const w = Math.exp(-(ex * ex + ey * ey) / (r * r));
        const k = j * n + i;
        this.u[k] = this.u[k]! - ey * w * 0.25;
        this.v[k] = this.v[k]! + ex * w * 0.25;
      }
    this.awake = true;
  }

  /** Pointer in disc units (-1..1) and its motion this frame in the same units. */
  step(mx: number, my: number, mvx: number, mvy: number) {
    const n = this.n;
    const { u, v, t1, t2, p, div, clr } = this;
    mvx = clamp(mvx, -0.03, 0.03);
    mvy = clamp(mvy, -0.03, 0.03);
    const speed = Math.hypot(mvx, mvy);
    if (speed > 0.0004 && mx * mx + my * my < 1.1) {
      const gx = ((mx + 1) / 2) * n - 0.5;
      const gy = ((my + 1) / 2) * n - 0.5;
      const fx = (mvx * n) / 2;
      const fy = (mvy * n) / 2;
      const r = 0.9;   // a small wake, about the size of the cursor's reach
      for (let j = Math.max(0, (gy - 3 * r) | 0); j < Math.min(n, gy + 3 * r); j++)
        for (let i = Math.max(0, (gx - 3 * r) | 0); i < Math.min(n, gx + 3 * r); i++) {
          const w = Math.exp(-((i - gx) ** 2 + (j - gy) ** 2) / (r * r));
          const k = j * n + i;
          // A gentle wake: the air picks up a little of the pointer's motion.
          u[k] = u[k]! + fx * w * 0.22;
          v[k] = v[k]! + fy * w * 0.22;
          clr[k] = Math.min(0.5, clr[k]! + w * Math.min(0.02, speed * 0.5));
        }
      this.awake = true;
    }
    if (!this.awake) return;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        t1[k] = this.sample(u, i - u[k]!, j - v[k]!);
        t2[k] = this.sample(v, i - u[k]!, j - v[k]!);
      }
    u.set(t1);
    v.set(t2);
    // No pressure solve: that spread every push across the whole disc (and swept
    // all the cloud away). The wake stays local and dies out quickly.
    void p;
    void div;
    for (let k = 0; k < n * n; k++) {
      u[k] = u[k]! * 0.93;
      v[k] = v[k]! * 0.93;
    }
    // The cleared amount drifts a little with the air and fills back in slowly.
    let live = 0;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        t1[k] = this.sample(clr, i - u[k]! * 0.5, j - v[k]! * 0.5) * 0.9965;
        live = Math.max(live, t1[k]!, Math.abs(u[k]!) * 3, Math.abs(v[k]!) * 3);
      }
    clr.set(t1);
    if (live < 0.003) {
      clr.fill(0);
      u.fill(0);
      v.fill(0);
      this.awake = false;
    }
    this.pack();
  }

  private pack() {
    const { clr, data } = this;
    for (let k = 0; k < clr.length; k++) {
      // Velocity in grid cells per frame (±2), then the cleared amount.
      // 128 = still air exactly; ±127 = ±2 cells per frame.
      data[k * 4] = clamp(128 + Math.round((this.u[k]! / 2) * 127), 1, 255);
      data[k * 4 + 1] = clamp(128 + Math.round((this.v[k]! / 2) * 127), 1, 255);
      data[k * 4 + 2] = clamp(Math.round(clr[k]! * 255), 0, 255);
      data[k * 4 + 3] = 255;
    }
  }
}
