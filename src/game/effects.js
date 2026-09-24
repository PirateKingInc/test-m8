// Render-only "juice": tracers, sparks, death bursts, floating text and screen
// shake, spawned from sim events. Never touches sim state, so it can use
// Math.random freely without affecting determinism.
const LIFE = { tracer: 0.14, spark: 0.18, burst: 0.7, text: 0.9, ring: 0.5 };
const TRACER_COLORS = { bolt: 0x9fe8ff, lance: 0xffc24a };
const MAX_EFFECTS = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.texts = [];
  }

  add(events, now) {
    for (const e of events) {
      if (e.type === 'attack') {
        if (e.attack === 'bolt' || e.attack === 'lance') {
          this.push({ kind: 'tracer', t: now, x: e.x, y: e.y, tx: e.tx, ty: e.ty, color: TRACER_COLORS[e.attack], w: e.attack === 'lance' ? 4 : 2 });
        }
        this.push({ kind: 'spark', t: now, x: e.tx + (Math.random() - 0.5) * 10, y: e.ty + (Math.random() - 0.5) * 10, big: e.attack === 'crush' || e.attack === 'lance' });
      } else if (e.type === 'death') {
        const n = e.kind === 'building' ? 28 : 12;
        const parts = Array.from({ length: n }, () => {
          const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * (e.kind === 'building' ? 160 : 90);
          return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.5 + Math.random() * 3 };
        });
        this.push({ kind: 'burst', t: now, x: e.x, y: e.y, parts, color: e.team === 1 ? 0x39d3c3 : 0xff7a45 });
        this.push({ kind: 'ring', t: now, x: e.x, y: e.y, r: e.kind === 'building' ? 70 : 26 });
        if (e.kind === 'building') this.scene.cameras.main.shake(260, 0.008);
      } else if (e.type === 'dropoff' && e.team === 1) {
        this.floatText(e.x, e.y - 14, `+${e.amount}`, '#c9b6ff');
      } else if (e.type === 'built') {
        const b = this.scene.world.get(e.id);
        if (b) this.push({ kind: 'ring', t: now, x: b.x, y: b.y, r: Math.max(b.pw, b.ph) * 0.8, color: 0x7dffb0 });
      } else if (e.type === 'trained') {
        const u = this.scene.world.get(e.id);
        if (u) this.push({ kind: 'ring', t: now, x: u.x, y: u.y, r: 18, color: 0x7dffb0 });
      }
    }
  }

  push(fx) {
    if (this.list.length < MAX_EFFECTS) this.list.push(fx);
  }

  floatText(x, y, str, color) {
    const t = this.scene.add.text(x, y, str, { fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color })
      .setOrigin(0.5).setStroke('#0b0f17', 3).setDepth(10);
    this.scene.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: LIFE.text * 1000, onComplete: () => t.destroy() });
  }

  draw(g, now) {
    this.list = this.list.filter((fx) => {
      const age = now - fx.t, life = LIFE[fx.kind], k = 1 - age / life;
      if (k <= 0) return false;
      if (fx.kind === 'tracer') {
        g.lineStyle(fx.w, fx.color, k);
        g.lineBetween(fx.x, fx.y, fx.tx, fx.ty);
        g.fillStyle(0xffffff, k);
        g.fillCircle(fx.tx, fx.ty, fx.w + 1);
      } else if (fx.kind === 'spark') {
        g.fillStyle(0xfff3c4, k);
        g.fillCircle(fx.x, fx.y, (fx.big ? 7 : 4) * k + 1);
      } else if (fx.kind === 'burst') {
        for (const p of fx.parts) {
          g.fillStyle(fx.color, k);
          g.fillCircle(fx.x + p.vx * age, fx.y + p.vy * age, p.r * k + 0.5);
        }
      } else if (fx.kind === 'ring') {
        g.lineStyle(3, fx.color ?? 0xffe0b0, k);
        g.strokeCircle(fx.x, fx.y, fx.r * (1.2 - k * 0.7));
      }
      return true;
    });
  }
}
