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

  /** Storms you planted: the air keeps turning around them for a few seconds. */
  private storms: { x: number; y: number; life: number; dir: number }[] = [];
  /** Set when new data needs uploading (including the final still frame). */
  dirty = true;

  vortex(mx: number, my: number) {
    this.storms.push({ x: ((mx + 1) / 2) * this.n - 0.5, y: ((my + 1) / 2) * this.n - 0.5, life: 1, dir: 1 });
    if (this.storms.length > 3) this.storms.shift();
    this.awake = true;
  }

  /**
   * Pointer in disc units (-1..1) and its motion this frame in the same units.
   * dt: frames elapsed (≈1).
   */
  step(mx: number, my: number, mvx: number, mvy: number, dt = 1) {
    const n = this.n;
    const { u, v, t1, t2, clr } = this;
    mvx = clamp(mvx, -0.03, 0.03);
    mvy = clamp(mvy, -0.03, 0.03);
    const speed = Math.hypot(mvx, mvy);
    // The pointer's wake is a narrow band along the path it just travelled (not
    // a round blob); clouds there pick up a fraction of its motion and coast.
    if (speed > 0.0004 && mx * mx + my * my < 1.1) {
      const bx = ((mx + 1) / 2) * n - 0.5;
      const by = ((my + 1) / 2) * n - 0.5;
      const ax = bx - (mvx * n) / 2;
      const ay = by - (mvy * n) / 2;
      const fx = (mvx * n) / 2;
      const fy = (mvy * n) / 2;
      const r = 0.75;
      const ex = bx - ax;
      const ey = by - ay;
      const ll = Math.max(ex * ex + ey * ey, 1e-6);
      for (let j = Math.max(0, Math.floor(Math.min(ay, by) - 3 * r)); j <= Math.min(n - 1, Math.ceil(Math.max(ay, by) + 3 * r)); j++)
        for (let i = Math.max(0, Math.floor(Math.min(ax, bx) - 3 * r)); i <= Math.min(n - 1, Math.ceil(Math.max(ax, bx) + 3 * r)); i++) {
          const t = clamp(((i - ax) * ex + (j - ay) * ey) / ll, 0, 1);
          const d2 = (i - ax - ex * t) ** 2 + (j - ay - ey * t) ** 2;
          const w = Math.exp(-d2 / (r * r));
          const k = j * n + i;
          // Carried along a little, and parted to either side of the path, so the
          // cloud breaks apart around the pointer rather than smearing.
          const side = (i - ax - ex * t) * -ey + (j - ay - ey * t) * ex >= 0 ? 1 : -1;
          const sl = Math.sqrt(ll);
          const pw = Math.exp(-d2 / (r * r * 2.2)) * Math.min(1, Math.sqrt(d2) / r);
          u[k] = u[k]! + fx * w * 0.035 + (-ey / sl) * side * pw * Math.hypot(fx, fy) * 0.03;
          v[k] = v[k]! + fy * w * 0.035 + (ex / sl) * side * pw * Math.hypot(fx, fy) * 0.03;
          clr[k] = Math.min(0.6, clr[k]! + w * Math.min(0.035, speed * 1.1));
        }
      this.awake = true;
    }
    // Planted storms: the air spins around each for a few seconds, fading.
    for (const st of this.storms) {
      const R = 1.4;
      const spin = 0.0012 * st.life * dt;
      for (let j = Math.max(0, Math.floor(st.y - 3 * R)); j <= Math.min(n - 1, Math.ceil(st.y + 3 * R)); j++)
        for (let i = Math.max(0, Math.floor(st.x - 3 * R)); i <= Math.min(n - 1, Math.ceil(st.x + 3 * R)); i++) {
          const ex = i - st.x;
          const ey = j - st.y;
          const w = Math.exp(-(ex * ex + ey * ey) / (R * R));
          const k = j * n + i;
          u[k] = u[k]! - ey * w * spin;
          v[k] = v[k]! + ex * w * spin;
        }
      st.life -= dt / 360; // about six seconds
    }
    this.storms = this.storms.filter((st) => st.life > 0);
    if (!this.awake) return;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        t1[k] = this.sample(u, i - u[k]!, j - v[k]!);
        t2[k] = this.sample(v, i - u[k]!, j - v[k]!);
      }
    u.set(t1);
    v.set(t2);
    // No pressure solve (it spread every push across the whole disc). The wake
    // coasts briefly, then the air is still again.
    const damp = Math.pow(0.9, dt);
    for (let k = 0; k < n * n; k++) {
      u[k] = u[k]! * damp;
      v[k] = v[k]! * damp;
    }
    let live = 0;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        t1[k] = this.sample(clr, i - u[k]!, j - v[k]!) * Math.pow(0.996, dt);
        live = Math.max(live, t1[k]!, Math.abs(u[k]!) * 20, Math.abs(v[k]!) * 20);
      }
    clr.set(t1);
    if (live < 0.003 && this.storms.length === 0) {
      clr.fill(0);
      u.fill(0);
      v.fill(0);
      this.awake = false;
    }
    this.pack();
  }

  private pack() {
    this.dirty = true;
    const { clr, data } = this;
    for (let k = 0; k < clr.length; k++) {
      // Velocity in grid cells per frame (±0.5), then the cleared amount.
      // 128 = still air exactly; ±127 = ±0.5 cells per frame.
      data[k * 4] = clamp(128 + Math.round((this.u[k]! / 0.5) * 127), 1, 255);
      data[k * 4 + 1] = clamp(128 + Math.round((this.v[k]! / 0.5) * 127), 1, 255);
      data[k * 4 + 2] = clamp(Math.round(clr[k]! * 255), 0, 255);
      data[k * 4 + 3] = 255;
    }
  }
}

/**
 * Wisps of cloud broken off where the cursor passes through the cloud deck:
 * many small, soft particles thrown along and to the sides of the path, carried
 * by the air, spreading and evaporating over a second or two. (The deck itself
 * thins where they came from and slowly fills back in.)
 */
export class CloudWisps {
  readonly max = 1400;
  /** Per particle: x, y (disc units), age 0..1, seed; then spawn x, y. */
  readonly a = new Float32Array(1400 * 4);
  readonly s = new Float32Array(1400 * 2);
  private vx = new Float32Array(1400);
  private vy = new Float32Array(1400);
  private life = new Float32Array(1400);
  count = 0;

  spawn(mx: number, my: number, mvx: number, mvy: number, dt: number) {
    mvx = clamp(mvx, -0.03, 0.03);
    mvy = clamp(mvy, -0.03, 0.03);
    const speed = Math.hypot(mvx, mvy);
    if (speed < 0.0004 || mx * mx + my * my > 0.97) return;
    const n = Math.min(12, Math.floor(speed * 900 * dt) + (Math.random() < 0.5 ? 1 : 0));
    const ux = mvx / speed, uy = mvy / speed;
    for (let q = 0; q < n; q++) {
      if (this.count >= this.max) this.remove(0);
      const i = this.count++;
      // Along the stretch just travelled, spread across a narrow band.
      const t = Math.random();
      const side = (Math.random() * 2 - 1) * 0.028;
      const x = mx - mvx * t - uy * side;
      const y = my - mvy * t + ux * side;
      this.a.set([x, y, 0, Math.random()], i * 4);
      this.s.set([x, y], i * 2);
      // Thrown a little along the motion and parted to the side it sits on.
      const k = 0.12 + Math.random() * 0.35;
      const sp = Math.sign(side) * speed * (0.15 + Math.random() * 0.35);
      this.vx[i] = mvx * k - uy * sp + (Math.random() - 0.5) * 0.0008;
      this.vy[i] = mvy * k + ux * sp + (Math.random() - 0.5) * 0.0008;
      this.life[i] = 70 + Math.random() * 100;
    }
  }

  private remove(i: number) {
    const last = --this.count;
    if (i !== last) {
      this.a.copyWithin(i * 4, last * 4, last * 4 + 4);
      this.s.copyWithin(i * 2, last * 2, last * 2 + 2);
      this.vx[i] = this.vx[last]!;
      this.vy[i] = this.vy[last]!;
      this.life[i] = this.life[last]!;
    }
  }

  step(flow: FlowSim, dt: number) {
    const drag = Math.pow(0.955, dt);
    for (let i = this.count - 1; i >= 0; i--) {
      const o = i * 4;
      const [ax, ay] = flow.velocityAt(this.a[o]!, this.a[o + 1]!);
      this.vx[i] = (this.vx[i]! + ax * 0.04 * dt) * drag;
      this.vy[i] = (this.vy[i]! + ay * 0.04 * dt) * drag;
      this.a[o] = this.a[o]! + this.vx[i]! * dt;
      this.a[o + 1] = this.a[o + 1]! + this.vy[i]! * dt;
      this.a[o + 2] = this.a[o + 2]! + dt / this.life[i]!;
      if (this.a[o + 2]! >= 1) this.remove(i);
    }
  }
}

/** CPU value noise / fbm (for placing the puff layer's cloud system). */
function h2(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function vn(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm2(x: number, y: number) {
  let v = 0, a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * vn(x, y);
    x = x * 2.02 + 3.1;
    y = y * 2.02 + 1.7;
    a *= 0.5;
  }
  return v / 0.97;
}

/**
 * The upper cloud layer: large, soft, translucent puffs that overlap into
 * sheets. They drift with the weather below (same direction and speed, in
 * latitude/longitude on the sphere) and are carried by the air the cursor
 * stirs, then settle back into formation.
 *
 * attrs per puff: disc x, y; size (integer px) + seed (fraction); alpha.
 */
export class CloudPuffs {
  readonly count: number;
  readonly attrs: Float32Array;
  private lon: Float32Array;
  private lat: Float32Array;
  private ox: Float32Array;
  private oy: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private coupling: Float32Array;
  // Life cycle: puffs form, live a while, evaporate and re-form elsewhere, so
  // the layer keeps renewing itself (and gaps you push open fill back in).
  private age: Float32Array;
  private span: Float32Array;
  private alpha: Float32Array;

  constructor(n = 4200) {
    this.count = n;
    this.lon = new Float32Array(n);
    this.lat = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.attrs = new Float32Array(n * 4);
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.age = new Float32Array(n);
    this.span = new Float32Array(n);
    this.coupling = Float32Array.from({ length: n }, () => 2 + 6 * Math.random());
    for (let i = 0; i < n; i++) {
      this.respawn(i);
      // Start at random points in their lives, so they do not all renew together.
      this.age[i] = Math.random() * this.span[i]!;
    }
    this.place();
  }

  /** Re-form puff i somewhere in the cloud system (in its own pattern). */
  private respawn(i: number) {
    for (let tries = 0; tries < 60; tries++) {
      const la = Math.asin(Math.random() * 2 - 1);
      const lo = (Math.random() * 2 - 1) * (Math.PI / 2);
      const d = Math.min(1, Math.max(0, (fbm2(lo * 2.4 + 7.3, la * 2.4 + 3.1) - 0.5) / 0.22));
      if (Math.random() > d && tries < 59) continue;
      this.lon[i] = lo;
      this.lat[i] = la;
      this.alpha[i] = 0.06 + 0.14 * d;
      break;
    }
    this.attrs[i * 4 + 2] = 50 + Math.floor(Math.random() * 64) + Math.random() * 0.98;
    this.ox[i] = this.oy[i] = this.vx[i] = this.vy[i] = 0;
    this.age[i] = 0;
    this.span[i] = 20 + Math.random() * 20;
  }

  private place() {
    for (let i = 0; i < this.count; i++) {
      const cl = Math.cos(this.lat[i]!);
      this.attrs[i * 4] = cl * Math.sin(this.lon[i]!) + this.ox[i]!;
      this.attrs[i * 4 + 1] = Math.sin(this.lat[i]!) + this.oy[i]!;
      const a = this.age[i]!, sp = this.span[i]!;
      const fade = Math.min(1, a / 3) * Math.min(1, Math.max(0, sp - a) / 4);
      this.attrs[i * 4 + 3] = this.alpha[i]! * fade;
    }
  }

  /** dt: frames (≈1). The drift matches the lower deck's (see cloudCoords). */
  step(flow: FlowSim, dt: number, strength = 1, storms: { x: number; y: number; age: number }[] = []) {
    const s = dt / 60;
    for (let i = 0; i < this.count; i++) {
      let lo = this.lon[i]! - 0.004 * s;
      let la = this.lat[i]! - 0.001 * s;
      if (lo < -Math.PI / 2) lo += Math.PI;
      if (la < -1.45) la += 2.9;
      this.lon[i] = lo;
      this.lat[i] = la;
      const x = this.attrs[i * 4]!, y = this.attrs[i * 4 + 1]!;
      const [ax, ay] = flow.velocityAt(x, y);
      const k = this.coupling[i]!;
      // Follow the stirred air (disc units per second), spring gently home.
      let tx = ax * 60 * 6 * strength, ty = ay * 60 * 6 * strength;
      // A storm nearby draws this puff into its spin (and slightly inward).
      for (const st of storms) {
        const ex = x - st.x, ey = y - st.y;
        const d = Math.hypot(ex, ey);
        if (d > 0.3 || d < 1e-4) continue;
        const life = Math.min(1, st.age / 1.5) * (1 - Math.min(1, Math.max(0, st.age - 7) / 4));
        const w = Math.exp(-(d * d) / (0.12 * 0.12)) * life;
        // Inflow stronger than before, so the storm gathers cloud instead of
        // clearing a dark ring around itself.
        const inflow = 0.03 * Math.min(1, d / 0.03);
        tx += (-ey / d) * 0.04 * w - (ex / d) * inflow * w;
        ty += (ex / d) * 0.04 * w - (ey / d) * inflow * w;
      }
      let vx = this.vx[i]! + (tx - this.vx[i]!) * Math.min(1, s * k);
      let vy = this.vy[i]! + (ty - this.vy[i]!) * Math.min(1, s * k);
      // Recovery: a steady pull back to its place in the (still drifting) cloud
      // system; pushed puffs glide home over a few seconds.
      vx -= this.ox[i]! * 1.6 * s;
      vy -= this.oy[i]! * 1.6 * s;
      vx *= Math.exp(-s * 2.4);
      vy *= Math.exp(-s * 2.4);
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.ox[i] = clamp(this.ox[i]! + vx * s, -0.25, 0.25);
      this.oy[i] = clamp(this.oy[i]! + vy * s, -0.25, 0.25);
      this.age[i] = this.age[i]! + s;
      if (this.age[i]! >= this.span[i]!) this.respawn(i);
    }
    this.place();
  }
}

/**
 * Storms made of the upper layer's puff material. A click spawns puffs laid out
 * along a dense eyewall and broken spiral bands; they orbit (faster near the
 * eye, slowing as the storm dies) in the planet's tangent plane at that spot,
 * so a storm is foreshortened toward the limb like everything else. They are
 * carried by the stirred air, and the storm draws the upper layer's nearby
 * puffs into its spin (see CloudPuffs.step). Lasts about ten seconds.
 * attrs layout matches CloudPuffs.
 */
export class StormPuffs {
  readonly max = 2400;
  readonly attrs = new Float32Array(2400 * 4);
  count = 0;
  /** Active storms: centre (disc), age (s), for the upper layer to swirl into. */
  readonly centres: { x: number; y: number; age: number }[] = [];
  private sid: number[] = [];
  private ang: number[] = [];
  private rad: number[] = [];
  private ox: number[] = [];
  private oy: number[] = [];
  private vx: number[] = [];
  private vy: number[] = [];
  private age: number[] = [];
  private base: number[] = [];
  private size: number[] = [];

  spawn(x: number, y: number) {
    this.centres.push({ x, y, age: 0 });
    if (this.centres.length > 3) this.centres.shift();
    const id = this.centres[this.centres.length - 1]!;
    // Built from the same material as the drifting upper layer (similar puff
    // sizes and transparency), with about as much overlap as a thick patch of
    // it: an eyewall of smaller puffs ringing a small eye, a dense overcast
    // around it, and three spiral bands thinning out into the open cloud.
    const n = 290;
    const arms = 3;
    const phase = Math.random() * Math.PI * 2;
    for (let q = 0; q < n; q++) {
      if (this.ang.length >= this.max) this.drop(0);
      const kind = q < 40 ? 0 : q < 130 ? 1 : 2; // eyewall, overcast, bands
      const r =
        kind === 0 ? 0.009 + Math.random() * 0.007 : kind === 1 ? 0.014 + Math.sqrt(Math.random()) * 0.032 : 0.035 + Math.pow(Math.random(), 0.9) * 0.125;
      const arm = Math.floor(Math.random() * arms);
      const a = kind < 2 ? Math.random() * Math.PI * 2 : phase + (arm / arms) * Math.PI * 2 - Math.log(r / 0.02) * 1.5 + (Math.random() - 0.5) * (0.18 + 0.5 * r / 0.16);
      this.sid.push(this.centres.indexOf(id));
      this.ang.push(a);
      this.rad.push(r);
      this.ox.push(0);
      this.oy.push(0);
      this.vx.push(0);
      this.vy.push(0);
      this.age.push(-Math.random() * 1.5);
      const out = Math.min(1, (r - 0.035) / 0.125);
      this.base.push(kind === 0 ? 0.3 + Math.random() * 0.06 : kind === 1 ? 0.22 + Math.random() * 0.06 : 0.21 - 0.12 * out + Math.random() * 0.05);
      this.size.push(Math.floor(kind === 0 ? 14 + Math.random() * 8 : kind === 1 ? 26 + Math.random() * 20 : 30 + Math.random() * 40) + Math.random() * 0.98);
    }
    this.cx.push(x);
    this.cy.push(y);
  }
  private cx: number[] = [];
  private cy: number[] = [];

  private drop(i: number) {
    for (const arr of [this.sid, this.ang, this.rad, this.ox, this.oy, this.vx, this.vy, this.age, this.base, this.size]) arr.splice(i, 1);
  }

  /** Disc position of a point at angular radius r, angle a, around centre (x, y). */
  private onSphere(x: number, y: number, r: number, a: number): [number, number] {
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    // Tangent basis at the centre: e1 along longitude, e2 along latitude.
    let e1x = z, e1y = 0, e1z = -x;
    const l1 = Math.hypot(e1x, e1y, e1z) || 1;
    e1x /= l1;
    e1y /= l1;
    e1z /= l1;
    const e2x = y * e1z - z * e1y, e2y = z * e1x - x * e1z;
    const c = Math.cos(r), sn = Math.sin(r);
    return [x * c + (e1x * Math.cos(a) + e2x * Math.sin(a)) * sn, y * c + (e1y * Math.cos(a) + e2y * Math.sin(a)) * sn];
  }

  step(flow: FlowSim, dt: number) {
    const s = dt / 60;
    for (const c of this.centres) c.age += s;
    while (this.centres.length && this.centres[0]!.age > 11) {
      this.centres.shift();
      for (let i = 0; i < this.sid.length; i++) this.sid[i] = this.sid[i]! - 1;
      this.cx.shift();
      this.cy.shift();
    }
    for (let i = this.ang.length - 1; i >= 0; i--) {
      const age = (this.age[i] = this.age[i]! + s);
      if (age > 10 || this.sid[i]! < 0) {
        this.drop(i);
        continue;
      }
      const spin = (1 - Math.min(1, Math.max(0, age) / 10)) * 0.9;
      this.ang[i] = this.ang[i]! + (spin * 0.01 / Math.max(0.012, this.rad[i]!)) * s;
      // The bands wind in slowly; the eye never closes up or opens out.
      this.rad[i] = Math.max(0.006, this.rad[i]! * (1 - 0.025 * s));
      const k = this.sid[i]!;
      const [x, y] = this.onSphere(this.cx[k]!, this.cy[k]!, this.rad[i]!, this.ang[i]!);
      const [ax, ay] = flow.velocityAt(x + this.ox[i]!, y + this.oy[i]!);
      // Pushed by the stirred air (the cursor), but the storm's own spin is
      // already in its orbit, and a gentle pull brings pushed puffs back, so
      // the air's vortex never flings the core outward and hollows the eye.
      this.vx[i] = (this.vx[i]! + (ax * 60 * 3 - this.vx[i]!) * Math.min(1, s * 4)) * Math.exp(-s * 0.8) - this.ox[i]! * 1.2 * s;
      this.vy[i] = (this.vy[i]! + (ay * 60 * 3 - this.vy[i]!) * Math.min(1, s * 4)) * Math.exp(-s * 0.8) - this.oy[i]! * 1.2 * s;
      this.ox[i] = clamp(this.ox[i]! + this.vx[i]! * s, -0.3, 0.3);
      this.oy[i] = clamp(this.oy[i]! + this.vy[i]! * s, -0.3, 0.3);
    }
    this.count = this.ang.length;
    for (let i = 0; i < this.count; i++) {
      const age = this.age[i]!;
      const fade = Math.min(1, Math.max(0, age) / 1.5) * (1 - Math.min(1, Math.max(0, age - 6.5) / 3.5));
      const k = this.sid[i]!;
      const [x, y] = this.onSphere(this.cx[k]!, this.cy[k]!, this.rad[i]!, this.ang[i]!);
      this.attrs[i * 4] = x + this.ox[i]!;
      this.attrs[i * 4 + 1] = y + this.oy[i]!;
      this.attrs[i * 4 + 2] = this.size[i]!;
      this.attrs[i * 4 + 3] = this.base[i]! * fade;
    }
  }
}
