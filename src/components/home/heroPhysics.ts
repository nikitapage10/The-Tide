/**
 * Small, allocation-free simulations driven by the pointer on the home hero.
 *
 * - FlowSim: a 64×64 "stable fluids" grid over the planet's disc. The pointer
 *   stirs it; it tracks how far the air has carried things (a displacement
 *   field the shader uses to move clouds and haze) and where they were brushed
 *   thin. Everything relaxes slowly, so the weather reforms.
 * - RockLayer: every rock of a meteor layer is a body with a spring back to its
 *   place. The pointer shoves and spins the ones it touches; only the few that
 *   are currently displaced are sent to the shader.
 */
import { ROCKS } from "./rocks";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class FlowSim {
  readonly n = 64;
  private u = new Float32Array(64 * 64);
  private v = new Float32Array(64 * 64);
  private t1 = new Float32Array(64 * 64);
  private t2 = new Float32Array(64 * 64);
  private p = new Float32Array(64 * 64);
  private div = new Float32Array(64 * 64);
  private dx = new Float32Array(64 * 64);
  private dy = new Float32Array(64 * 64);
  private clr = new Float32Array(64 * 64);
  readonly data = new Uint8Array(64 * 64 * 4);
  /** False once everything has relaxed (no need to re-upload). */
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

  /** A storm surge: an outward gust from a point (disc units), clearing its centre. */
  burst(mx: number, my: number) {
    const n = this.n;
    const gx = ((mx + 1) / 2) * n - 0.5;
    const gy = ((my + 1) / 2) * n - 0.5;
    const r = 6;
    for (let j = Math.max(0, (gy - 3 * r) | 0); j < Math.min(n, gy + 3 * r); j++)
      for (let i = Math.max(0, (gx - 3 * r) | 0); i < Math.min(n, gx + 3 * r); i++) {
        const ex = i - gx;
        const ey = j - gy;
        const d = Math.hypot(ex, ey) || 1;
        const w = Math.exp(-(d * d) / (r * r));
        const k = j * n + i;
        // Outward, with a little twist so the surge spirals.
        this.u[k]! += ((ex / d) * 1.6 - (ey / d) * 0.5) * w;
        this.v[k]! += ((ey / d) * 1.6 + (ex / d) * 0.5) * w;
        this.clr[k] = Math.min(1, this.clr[k]! + w * 0.5);
      }
    this.awake = true;
  }

  /** Pointer in disc units (-1..1) and its motion per frame in the same units. */
  step(mx: number, my: number, mvx: number, mvy: number) {
    const n = this.n;
    const { u, v, t1, t2, p, div, dx, dy, clr } = this;
    const speed = Math.hypot(mvx, mvy);
    if (speed > 0.0005 && Math.abs(mx) < 1.15 && Math.abs(my) < 1.15) {
      const gx = ((mx + 1) / 2) * n - 0.5;
      const gy = ((my + 1) / 2) * n - 0.5;
      const fx = (mvx * n) / 2;
      const fy = (mvy * n) / 2;
      const r = 3.2;
      for (let j = Math.max(0, (gy - 3 * r) | 0); j < Math.min(n, gy + 3 * r); j++)
        for (let i = Math.max(0, (gx - 3 * r) | 0); i < Math.min(n, gx + 3 * r); i++) {
          const w = Math.exp(-((i - gx) ** 2 + (j - gy) ** 2) / (r * r));
          const k = j * n + i;
          u[k]! += fx * w * 0.9;
          v[k]! += fy * w * 0.9;
          clr[k] = Math.min(1, clr[k]! + w * Math.min(0.12, speed * 3));
        }
      this.awake = true;
    }
    if (!this.awake) return;

    // Advect velocity by itself.
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        t1[k] = this.sample(u, i - u[k]!, j - v[k]!);
        t2[k] = this.sample(v, i - u[k]!, j - v[k]!);
      }
    u.set(t1);
    v.set(t2);
    // Make it swirl rather than compress: pressure projection (Jacobi).
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        div[k] = -0.5 * (u[k + 1]! - u[k - 1]! + v[k + n]! - v[k - n]!);
        p[k] = 0;
      }
    for (let it = 0; it < 16; it++)
      for (let j = 1; j < n - 1; j++)
        for (let i = 1; i < n - 1; i++) {
          const k = j * n + i;
          p[k] = (div[k]! + p[k - 1]! + p[k + 1]! + p[k - n]! + p[k + n]!) / 4;
        }
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        u[k]! -= 0.5 * (p[k + 1]! - p[k - 1]!);
        v[k]! -= 0.5 * (p[k + n]! - p[k - n]!);
      }

    // Carry the displacement and the cleared amount along with the air.
    const toDisc = 2 / n;
    let live = 0;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const bx = i - u[k]!;
        const by = j - v[k]!;
        t1[k] = clamp((this.sample(dx, bx, by) + u[k]! * toDisc) * 0.992, -0.16, 0.16);
        t2[k] = clamp((this.sample(dy, bx, by) + v[k]! * toDisc) * 0.992, -0.16, 0.16);
        div[k] = this.sample(clr, bx, by) * 0.993;
        u[k]! *= 0.982;
        v[k]! *= 0.982;
        live = Math.max(live, Math.abs(t1[k]!), Math.abs(t2[k]!), div[k]!, Math.abs(u[k]!) * 4);
      }
    dx.set(t1);
    dy.set(t2);
    clr.set(div);
    if (live < 0.002) {
      dx.fill(0);
      dy.fill(0);
      clr.fill(0);
      u.fill(0);
      v.fill(0);
      this.awake = false;
    }
    this.pack();
  }

  private pack() {
    const { dx, dy, clr, data } = this;
    for (let k = 0; k < dx.length; k++) {
      data[k * 4] = clamp(Math.round((dx[k]! / 0.6 + 0.5) * 255), 0, 255);
      data[k * 4 + 1] = clamp(Math.round((dy[k]! / 0.6 + 0.5) * 255), 0, 255);
      data[k * 4 + 2] = clamp(Math.round(clr[k]! * 255), 0, 255);
      data[k * 4 + 3] = 255;
    }
  }
}

export class RockLayer {
  readonly w: number;
  readonly h: number;
  private cx: Float32Array;
  private cy: Float32Array;
  private r: Float32Array;
  private fixed: Uint8Array;
  private dx: Float32Array;
  private dy: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private a: Float32Array;
  private va: Float32Array;
  private active = new Set<number>();
  /** Uniform data for the shader: [id, dx, dy, angle] and [centreX, centreY]. */
  readonly moved: Float32Array;
  readonly centres: Float32Array;
  count = 0;

  constructor(
    layer: keyof typeof ROCKS,
    readonly cap: number,
  ) {
    const L: { w: number; h: number; rocks: readonly (readonly number[])[] } = ROCKS[layer];
    this.w = L.w;
    this.h = L.h;
    const n = L.rocks.length;
    this.cx = Float32Array.from(L.rocks, (r) => r[0]!);
    this.cy = Float32Array.from(L.rocks, (r) => r[1]!);
    this.r = Float32Array.from(L.rocks, (r) => r[2]!);
    this.fixed = Uint8Array.from(L.rocks, (r) => r[3]!);
    this.dx = new Float32Array(n);
    this.dy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.a = new Float32Array(n);
    this.va = new Float32Array(n);
    this.moved = new Float32Array(cap * 4);
    this.centres = new Float32Array(cap * 2);
  }

  /**
   * Pointer position and motion this frame, in the layer's source pixels.
   * `enabled`: the pointer may push; `release`: send everything home quickly.
   */
  step(mx: number, my: number, mvx: number, mvy: number, enabled: boolean, release: boolean) {
    // A long frame or a flick must not launch anything.
    mvx = clamp(mvx, -30, 30);
    mvy = clamp(mvy, -30, 30);
    const speed = Math.hypot(mvx, mvy);
    if (enabled && speed > 0.2) {
      for (let i = 0; i < this.cx.length; i++) {
        if (this.fixed[i]) continue;
        const px = this.cx[i]! + this.dx[i]!;
        const py = this.cy[i]! + this.dy[i]!;
        const R = this.r[i]! + 34;
        const ex = px - mx;
        const ey = py - my;
        const d2 = ex * ex + ey * ey;
        if (d2 > R * R) continue;
        if (!this.active.has(i) && this.active.size >= this.cap) continue;
        const d = Math.sqrt(d2) || 1;
        const nx = ex / d;
        const ny = ey / d;
        const overlap = Math.min(R - d, 30);
        const mass = 0.5 + this.r[i]! / 22;
        this.vx[i]! += (nx * overlap * 0.1 + mvx * 0.3 * (overlap / R)) / mass;
        this.vy[i]! += (ny * overlap * 0.1 + mvy * 0.3 * (overlap / R)) / mass;
        this.va[i]! += ((nx * mvy - ny * mvx) * 0.0012) / mass;
        this.active.add(i);
      }
    }
    const k = release ? 0.06 : 0.0016;
    let c = 0;
    for (const i of this.active) {
      this.vx[i] = clamp((this.vx[i]! - this.dx[i]! * k) * 0.94, -14, 14);
      this.vy[i] = clamp((this.vy[i]! - this.dy[i]! * k) * 0.94, -14, 14);
      // Keep rocks near home so none leaves the frame for good.
      const lim = 220;
      if (Math.abs(this.dx[i]!) > lim) this.vx[i]! -= Math.sign(this.dx[i]!) * 0.6;
      if (Math.abs(this.dy[i]!) > lim) this.vy[i]! -= Math.sign(this.dy[i]!) * 0.6;
      this.dx[i]! += this.vx[i]!;
      this.dy[i]! += this.vy[i]!;
      this.va[i] = (this.va[i]! - this.a[i]! * k) * 0.94;
      this.a[i]! += this.va[i]!;
      if (Math.abs(this.dx[i]!) + Math.abs(this.dy[i]!) < 0.3 && Math.abs(this.vx[i]!) + Math.abs(this.vy[i]!) < 0.03 && Math.abs(this.a[i]!) < 0.002) {
        this.dx[i] = this.dy[i] = this.vx[i] = this.vy[i] = this.a[i] = this.va[i] = 0;
        this.active.delete(i);
        continue;
      }
      this.moved.set([i + 1, this.dx[i]!, this.dy[i]!, this.a[i]!], c * 4);
      this.centres.set([this.cx[i]!, this.cy[i]!], c * 2);
      c++;
    }
    this.count = c;
  }
}
