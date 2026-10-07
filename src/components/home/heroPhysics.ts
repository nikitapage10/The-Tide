/**
 * Small, allocation-free simulations driven by the pointer on the home hero.
 *
 * - GravityField: a coarse grid over a meteor layer holding a smooth
 *   displacement field. The pointer acts as a soft reverse singularity that
 *   pushes the field outward; it has inertia, a gentle spring home and some
 *   coupling between neighbours, so rocks drift away together and float back.
 *   The shader moves each rock rigidly by the field at the rock's centre.
 * - FlowSim: a 64×64 "stable fluids" grid over the planet's disc. The pointer
 *   stirs the air (and planted storms set it turning); the GPU cloud
 *   simulation is carried by this air, and a "cleared" channel thins the haze
 *   where you brush through (it slowly fills back in).
 */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class GravityField {
  readonly gw = 48;
  readonly gh = 27;
  private dx: Float32Array;
  private dy: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private presence = 0;
  readonly data: Uint8Array;
  awake = true;

  constructor(
    readonly w: number,
    readonly h: number,
    /** Reach of the push, in source px. */
    readonly reach: number,
    /** Strength of the push. */
    readonly strength: number,
  ) {
    const n = this.gw * this.gh;
    this.dx = new Float32Array(n);
    this.dy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.data = new Uint8Array(n * 4);
    this.pack();
  }

  /**
   * mx, my: pointer in source px. `enabled`: the pointer may push. `release`:
   * send everything home quickly. dt: frames elapsed (≈1).
   */
  step(mx: number, my: number, enabled: boolean, release: boolean, dt: number) {
    const { gw, gh, dx, dy, vx, vy } = this;
    const on = enabled && Number.isFinite(mx) && Number.isFinite(my);
    this.presence += ((on ? 1 : 0) - this.presence) * Math.min(1, 0.015 * dt);
    if (!this.awake && this.presence < 0.001) return;
    const R = this.reach;
    const G = this.strength * this.presence;
    // Overdamped: rocks glide out and settle back without bouncing.
    const k = release ? 0.05 : 0.005;
    const c = release ? 0.35 : 0.16;
    let live = 0;
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const q = j * gw + i;
        let fx = 0;
        let fy = 0;
        if (G > 0.0001) {
          const rx = ((i + 0.5) / gw) * this.w + dx[q]! - mx;
          const ry = ((j + 0.5) / gh) * this.h + dy[q]! - my;
          const d2 = rx * rx + ry * ry;
          const d = Math.sqrt(d2) || 1;
          // Soft repulsion: strongest near the pointer, smooth, gone well beyond reach.
          const f = ((G * R * R) / (d2 + R * R * 0.4)) * Math.exp(-d2 / (9 * R * R));
          fx = (rx / d) * f;
          fy = (ry / d) * f;
        }
        // Neighbour coupling: velocities lean toward the local average.
        let ax = 0;
        let ay = 0;
        let cnt = 0;
        if (i > 0) {
          ax += vx[q - 1]!;
          ay += vy[q - 1]!;
          cnt++;
        }
        if (i < gw - 1) {
          ax += vx[q + 1]!;
          ay += vy[q + 1]!;
          cnt++;
        }
        if (j > 0) {
          ax += vx[q - gw]!;
          ay += vy[q - gw]!;
          cnt++;
        }
        if (j < gh - 1) {
          ax += vx[q + gw]!;
          ay += vy[q + gw]!;
          cnt++;
        }
        const cx = cnt ? ax / cnt - vx[q]! : 0;
        const cy = cnt ? ay / cnt - vy[q]! : 0;
        vx[q] = vx[q]! + (fx - k * dx[q]! - c * vx[q]! + 0.15 * cx) * dt;
        vy[q] = vy[q]! + (fy - k * dy[q]! - c * vy[q]! + 0.15 * cy) * dt;
        dx[q] = clamp(dx[q]! + vx[q]! * dt, -60, 60);
        dy[q] = clamp(dy[q]! + vy[q]! * dt, -60, 60);
        live = Math.max(live, Math.abs(dx[q]!), Math.abs(dy[q]!), Math.abs(vx[q]!) * 10);
      }
    this.awake = live > 0.05 || this.presence > 0.001;
    if (live <= 0.05 && this.presence <= 0.001) {
      dx.fill(0);
      dy.fill(0);
      vx.fill(0);
      vy.fill(0);
    }
    this.pack();
  }

  private pack() {
    const { dx, dy, data } = this;
    for (let q = 0; q < dx.length; q++) {
      data[q * 4] = clamp(Math.round((dx[q]! / 256 + 0.5) * 255), 0, 255);
      data[q * 4 + 1] = clamp(Math.round((dy[q]! / 256 + 0.5) * 255), 0, 255);
      data[q * 4 + 2] = 0;
      data[q * 4 + 3] = 255;
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
      const r = 2.6;
      for (let j = Math.max(0, (gy - 3 * r) | 0); j < Math.min(n, gy + 3 * r); j++)
        for (let i = Math.max(0, (gx - 3 * r) | 0); i < Math.min(n, gx + 3 * r); i++) {
          const w = Math.exp(-((i - gx) ** 2 + (j - gy) ** 2) / (r * r));
          const k = j * n + i;
          u[k] = u[k]! + fx * w * 0.6;
          v[k] = v[k]! + fy * w * 0.6;
          clr[k] = Math.min(0.85, clr[k]! + w * Math.min(0.05, speed * 1.2));
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
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        div[k] = -0.5 * (u[k + 1]! - u[k - 1]! + v[k + n]! - v[k - n]!);
        p[k] = 0;
      }
    for (let it = 0; it < 14; it++)
      for (let j = 1; j < n - 1; j++)
        for (let i = 1; i < n - 1; i++) {
          const k = j * n + i;
          p[k] = (div[k]! + p[k - 1]! + p[k + 1]! + p[k - n]! + p[k + n]!) / 4;
        }
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        u[k] = (u[k]! - 0.5 * (p[k + 1]! - p[k - 1]!)) * 0.975;
        v[k] = (v[k]! - 0.5 * (p[k + n]! - p[k - n]!)) * 0.975;
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
      data[k * 4] = clamp(Math.round((this.u[k]! / 4 + 0.5) * 255), 0, 255);
      data[k * 4 + 1] = clamp(Math.round((this.v[k]! / 4 + 0.5) * 255), 0, 255);
      data[k * 4 + 2] = clamp(Math.round(clr[k]! * 255), 0, 255);
      data[k * 4 + 3] = 255;
    }
  }
}
