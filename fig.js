/* Boneco anatômico animado + biblioteca de exercícios */
(function () {
  const L = { torso: 54, thigh: 46, shin: 44, ua: 32, fa: 30, neck: 8, head: 12, foot: 14 };
  const GROUND = 200;
  const rad = (d) => (d * Math.PI) / 180;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const dirA = (ang, len) => [Math.sin(rad(ang)) * len, Math.cos(rad(ang)) * len];

  function ik(root, target, a, b, sign) {
    const dx = target[0] - root[0], dy = target[1] - root[1];
    let d = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx);
    d = Math.max(Math.abs(a - b) + 0.5, Math.min(a + b - 0.01, d));
    const ca = (a * a + d * d - b * b) / (2 * a * d);
    const al = Math.acos(Math.max(-1, Math.min(1, ca)));
    const ang = base + sign * al;
    const j = [root[0] + Math.cos(ang) * a, root[1] + Math.sin(ang) * a];
    const e = [root[0] + Math.cos(base) * d, root[1] + Math.sin(base) * d];
    return [j, e];
  }
  function lerp(a, b, k) {
    if (typeof a === "number") return a + (b - a) * k;
    if (Array.isArray(a)) return a.map((v, i) => lerp(v, b[i], k));
    if (a && typeof a === "object") { const o = {}; for (const key in a) o[key] = b && key in b ? lerp(a[key], b[key], k) : a[key]; return o; }
    return a;
  }
  function toeOf(knee, ankle) {
    const dx = ankle[0] - knee[0], dy = ankle[1] - knee[1], n = Math.hypot(dx, dy) || 1;
    const ux = dx / n, uy = dy / n;
    if (uy > 0.7 && ankle[1] > 184) return [ankle[0] + 13, GROUND - 1.5];
    return [ankle[0] + uy * L.foot, ankle[1] - ux * L.foot];
  }
  function leg(hip, s) {
    let knee, ankle;
    if (Array.isArray(s)) [knee, ankle] = ik(hip, s, L.thigh, L.shin, -1);
    else { knee = add(hip, dirA(s.th, L.thigh)); ankle = add(knee, dirA(s.sh, L.shin)); }
    return { hip, knee, ankle, toe: toeOf(knee, ankle) };
  }
  function arm(sh, hip, s) {
    if (s.ua != null) { const el = add(sh, dirA(s.ua, L.ua)); return { sh, el, hand: add(el, dirA(s.fa, L.fa)) }; }
    let p, e = 1;
    if (Array.isArray(s)) p = s;
    else { e = s.e || 1; p = s.p ? s.p : s.s ? add(sh, s.s) : add(hip, s.h); }
    const [el, hand] = ik(sh, p, L.ua, L.fa, e);
    return { sh, el, hand };
  }
  function solve(f) {
    const hip = f.hip, t = rad(f.t);
    const d = [Math.sin(t), -Math.cos(t)];
    const sh = [hip[0] + d[0] * L.torso, hip[1] + d[1] * L.torso];
    const head = [sh[0] + d[0] * (L.neck + L.head), sh[1] + d[1] * (L.neck + L.head)];
    const front = [-d[1], d[0]];
    const ls = f.L.map((s) => leg(hip, s));
    if (ls.length === 1) ls.push(leg(hip, f.L[0]));
    const as = f.A.map((s) => arm(sh, hip, s));
    if (as.length === 1) as.push(arm(sh, hip, f.A[0]));
    return { hip, sh, head, front, legs: ls, arms: as, far1: f.L.length === 1, far2: f.A.length === 1 };
  }

  // ---------- desenho ----------
  function seg(c, p, q, w1, w2, fill) {
    const dx = q[0] - p[0], dy = q[1] - p[1], n = Math.hypot(dx, dy) || 1, nx = -dy / n, ny = dx / n;
    c.beginPath();
    c.moveTo(p[0] + (nx * w1) / 2, p[1] + (ny * w1) / 2);
    c.lineTo(q[0] + (nx * w2) / 2, q[1] + (ny * w2) / 2);
    c.arc(q[0], q[1], w2 / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
    c.lineTo(p[0] - (nx * w1) / 2, p[1] - (ny * w1) / 2);
    c.arc(p[0], p[1], w1 / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
    c.closePath();
    c.fillStyle = fill; c.fill();
  }
  function dot(c, p, r, fill) { c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
  // músculo sobre um segmento: side +1 frente, -1 trás
  function muscle(c, p, q, w, side, a, b, fill) {
    const dx = q[0] - p[0], dy = q[1] - p[1], n = Math.hypot(dx, dy) || 1;
    const fx = dy / n, fy = -dx / n; // frente para membro
    const o = (w / 4) * side;
    const p2 = [p[0] + dx * a + fx * o, p[1] + dy * a + fy * o];
    const q2 = [p[0] + dx * b + fx * o, p[1] + dy * b + fy * o];
    seg(c, p2, q2, w * 0.5, w * 0.42, fill);
  }
  function torsoMuscle(c, P, side, a, b, fill) {
    const hip = P.hip, sh = P.sh, dx = sh[0] - hip[0], dy = sh[1] - hip[1];
    const o = 6 * side;
    const p2 = [hip[0] + dx * a + P.front[0] * o, hip[1] + dy * a + P.front[1] * o];
    const q2 = [hip[0] + dx * b + P.front[0] * o, hip[1] + dy * b + P.front[1] * o];
    seg(c, p2, q2, 11, 12, fill);
  }

  function drawLeg(c, g, col, hl, isNear) {
    const fig = isNear ? col.fig : col.far;
    seg(c, g.hip, g.knee, 15, 11, fig);
    seg(c, g.knee, g.ankle, 11, 8, fig);
    seg(c, g.ankle, g.toe, 7, 5, fig);
    const m = isNear ? col.muscle : col.muscleFar;
    if (hl.quad) muscle(c, g.hip, g.knee, 15, 1, 0.12, 0.85, m);
    if (hl.post) muscle(c, g.hip, g.knee, 15, -1, 0.15, 0.85, m);
    if (hl.calf) muscle(c, g.knee, g.ankle, 11, -1, 0.1, 0.6, m);
  }
  function drawArm(c, g, col, hl, isNear) {
    const fig = isNear ? col.fig : col.far;
    seg(c, g.sh, g.el, 10, 8, fig);
    seg(c, g.el, g.hand, 8, 6, fig);
    dot(c, g.hand, 4, fig);
    const m = isNear ? col.muscle : col.muscleFar;
    if (hl.biceps) muscle(c, g.sh, g.el, 10, 1, 0.2, 0.85, m);
    if (hl.triceps) muscle(c, g.sh, g.el, 10, -1, 0.15, 0.85, m);
  }
  function outline(c, col, fn) {
    c.save(); c.shadowColor = col.bg; c.shadowBlur = 0;
    fn(); c.restore();
  }

  // ---------- acessórios ----------
  function drawProp(c, pr, P, col, layer) {
    const k = pr.k, at = (name) => {
      if (name === "hand1") return P.arms[0].hand; if (name === "hand2") return P.arms[1].hand;
      if (name === "foot1") return P.legs[0].ankle; if (name === "shoulder") return P.sh; if (name === "hip") return P.hip;
      return [0, 0];
    };
    const pc = col.prop;
    c.save();
    if (layer === "back") {
      if (k === "bench") { roundRect(c, pr.x1, pr.y, pr.x2 - pr.x1, 7, 3, pc); bar(c, pr.x1 + 10, pr.y, pr.x1 + 10, GROUND, 4, pc); bar(c, pr.x2 - 10, pr.y, pr.x2 - 10, GROUND, 4, pc); }
      if (k === "seat") { roundRect(c, pr.x1, pr.y, pr.x2 - pr.x1, 7, 3, pc); bar(c, (pr.x1 + pr.x2) / 2, pr.y, (pr.x1 + pr.x2) / 2, GROUND, 5, pc); bar(c, (pr.x1 + pr.x2) / 2 - 18, GROUND - 1, (pr.x1 + pr.x2) / 2 + 18, GROUND - 1, 4, pc); if (pr.back) seg(c, [pr.back[0], pr.back[1]], [pr.back[2], pr.back[3]], 8, 8, pc); }
      if (k === "chair") { roundRect(c, pr.x1, pr.y, pr.x2 - pr.x1, 6, 2, pc); bar(c, pr.x1 + 3, pr.y, pr.x1 + 3, GROUND, 3.5, pc); bar(c, pr.x2 - 3, pr.y, pr.x2 - 3, GROUND, 3.5, pc); bar(c, pr.x1 + 3, pr.y, pr.bx, pr.by, 4, pc); }
      if (k === "rail") { bar(c, pr.x, GROUND, pr.x, pr.y, 5, pc); dot(c, [pr.x, pr.y], 4, pc); }
      if (k === "track") bar(c, pr.p[0], pr.p[1], pr.q[0], pr.q[1], 3, pc);
      if (k === "footplate") bar(c, pr.x, pr.y1, pr.x, pr.y2, 6, pc);
      if (k === "chestpad") roundRect(c, pr.x - 5, pr.y1, 10, pr.y2 - pr.y1, 4, pc);
      if (k === "mat") roundRect(c, pr.x1, GROUND - 3, pr.x2 - pr.x1, 4, 2, pc);
      if (k === "cable") {
        const h = at(pr.at); c.strokeStyle = pc; c.lineWidth = 1.4; c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(pr.to[0], pr.to[1]); c.stroke();
        dot(c, pr.to, 5, pc); dot(c, pr.to, 2, col.bg);
      }
    } else {
      if (k === "kneepad") dot(c, [pr.x, pr.y], 7, pc);
      if (k === "dumbbell") { const h = at(pr.at); dot(c, h, 7.5, pc); dot(c, h, 3, col.bg); }
      if (k === "barbell") { const h = at(pr.at); const o = pr.off || [0, 0]; const p = add(h, o); dot(c, p, 16, pc); dot(c, p, 11, col.bg); dot(c, p, 8, pc); dot(c, p, 2.5, col.bg); }
      if (k === "barh") { const h = at(pr.at); roundRect(c, h[0] - 16, h[1] - 2, 32, 4, 2, pc); }
      if (k === "grip") { const h = at(pr.at); roundRect(c, h[0] - 2.5, h[1] - 8, 5, 16, 2, pc); }
      if (k === "rope") { const h = at(pr.at); c.strokeStyle = pc; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(h[0], h[1] - 6); c.lineTo(h[0], h[1] + 7); c.stroke(); }
      if (k === "pad") {
        const g = P.legs[0]; const dx = g.ankle[0] - g.knee[0], dy = g.ankle[1] - g.knee[1], n = Math.hypot(dx, dy) || 1;
        const s = pr.side || 1; const p = [g.ankle[0] - (dx / n) * 6 + (dy / n) * 9 * s, g.ankle[1] - (dy / n) * 6 - (dx / n) * 9 * s];
        dot(c, p, 6.5, pc);
      }
      if (k === "plate45") {
        const g = P.legs[0]; const dx = g.ankle[0] - g.hip[0], dy = g.ankle[1] - g.hip[1], n = Math.hypot(dx, dy) || 1;
        const ux = dx / n, uy = dy / n, cx = g.ankle[0] + ux * 6, cy = g.ankle[1] + uy * 6;
        c.save(); c.translate(cx, cy); c.rotate(Math.atan2(uy, ux)); roundRect(c, 0, -24, 6, 48, 2, pc); c.restore();
      }
    }
    c.restore();
  }
  function bar(c, x1, y1, x2, y2, w, fill) { c.strokeStyle = fill; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function roundRect(c, x, y, w, h, r, fill) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y); c.closePath(); c.fillStyle = fill; c.fill();
  }

  function drawSide(c, def, P, col) {
    const hl = {}; (def.hl || []).forEach((h) => (hl[h] = 1));
    (def.props || []).forEach((p) => drawProp(c, p, P, col, "back"));
    // membros do fundo
    c.save(); if (P.far1) c.translate(-3, -1); drawLeg(c, P.legs[1], col, hl, false); c.restore();
    c.save(); if (P.far2) c.translate(-3, -1); drawArm(c, P.arms[1], col, hl, false); c.restore();
    (def.props || []).filter((p) => p.at === "hand2").forEach((p) => drawProp(c, p, P, col, "front"));
    // tronco
    const neckBase = P.sh;
    seg(c, P.hip, P.sh, 22, 25, col.fig);
    dot(c, P.hip, 11, col.fig);
    seg(c, neckBase, P.head, 9, 9, col.fig);
    dot(c, P.head, L.head, col.fig);
    dot(c, [P.head[0] + P.front[0] * 11, P.head[1] + P.front[1] * 11], 2.6, col.fig);
    if (hl.glute) dot(c, [P.hip[0] - P.front[0] * 6, P.hip[1] - P.front[1] * 6], 7.5, col.muscle);
    if (hl.peito) torsoMuscle(c, P, 1, 0.58, 0.88, col.muscle);
    if (hl.abdomen) torsoMuscle(c, P, 1, 0.12, 0.55, col.muscle);
    if (hl.costas) torsoMuscle(c, P, -1, 0.35, 0.9, col.muscle);
    if (hl.lombar) torsoMuscle(c, P, -1, 0.08, 0.4, col.muscle);
    // perna e braço da frente, com contorno pra separar do tronco
    c.save(); c.lineJoin = "round";
    drawLeg(c, P.legs[0], col, hl, true);
    edge(c, P.arms[0], col);
    drawArm(c, P.arms[0], col, hl, true);
    c.restore();
    if (hl.delt) dot(c, P.sh, 7, col.muscle);
    (def.props || []).filter((p) => p.at !== "hand2").forEach((p) => drawProp(c, p, P, col, "front"));
  }
  function edge(c, g, col) { seg(c, g.sh, g.el, 13, 11, col.bg); seg(c, g.el, g.hand, 11, 9, col.bg); }

  function drawFront(c, def, f, col) {
    const hl = {}; (def.hl || []).forEach((h) => (hl[h] = 1));
    const cx = f.cx, hy = f.hy, sy = hy - 54;
    (def.props || []).forEach((p) => drawProp(c, p, null, col, "back"));
    for (const s of [-1, 1]) {
      const hj = [cx + s * 9, hy];
      if (!f.seated) {
        const extra = s > 0 ? f.fR : f.fL;
        const foot = [cx + s * 9 + s * Math.sin(rad(f.open)) * 88 + extra, hy + Math.cos(rad(f.open)) * 88];
        const knee = [(hj[0] + foot[0]) / 2, (hj[1] + foot[1]) / 2];
        seg(c, hj, knee, 15, 11, col.fig); seg(c, knee, foot, 11, 8, col.fig);
        seg(c, foot, [foot[0] + s * 5, foot[1] + 2], 8, 7, col.fig);
        if (hl.quad) muscle(c, hj, knee, 15, 0, 0.12, 0.85, col.muscle);
      } else {
        const knee = [cx + s * (10 + f.open), hy + 4];
        seg(c, hj, knee, 16, 14, col.fig);
        const foot = [knee[0] + s * 2, GROUND - 4];
        seg(c, knee, foot, 11, 8, col.fig);
        if (def.pads) dot(c, [knee[0] + s * 11, knee[1] + 2], 6, col.prop);
      }
    }
    // tronco
    c.beginPath(); c.moveTo(cx - 14, hy + 4); c.lineTo(cx - 22, sy + 6); c.quadraticCurveTo(cx - 22, sy, cx - 16, sy);
    c.lineTo(cx + 16, sy); c.quadraticCurveTo(cx + 22, sy, cx + 22, sy + 6); c.lineTo(cx + 14, hy + 4); c.closePath(); c.fillStyle = col.fig; c.fill();
    seg(c, [cx, sy], [cx, sy - 10], 9, 9, col.fig);
    dot(c, [cx, sy - 20], L.head, col.fig);
    if (hl.glutmed) { dot(c, [cx - 14, hy - 2], 6.5, col.muscle); dot(c, [cx + 14, hy - 2], 6.5, col.muscle); }
    for (const s of [-1, 1]) {
      const sh = [cx + s * 20, sy + 5];
      if (f.hands) { // mãos na cintura
        const el = [cx + s * 34, sy + 30], hand = [cx + s * 15, hy - 6];
        seg(c, sh, el, 10, 8, col.fig); seg(c, el, hand, 8, 6, col.fig);
      } else {
        const el = [sh[0] + s * Math.sin(rad(f.arm)) * L.ua, sh[1] + Math.cos(rad(f.arm)) * L.ua];
        const hand = [el[0] + s * Math.sin(rad(f.arm + f.bend)) * L.fa, el[1] + Math.cos(rad(f.arm + f.bend)) * L.fa];
        seg(c, sh, el, 10, 8, col.fig); seg(c, el, hand, 8, 6, col.fig);
        if (def.dumbbells) roundRect(c, hand[0] - 3, hand[1] - 9, 6, 18, 2, col.prop);
      }
      if (hl.delt) dot(c, sh, 7, col.muscle);
    }
  }

  // ---------- poses ----------
  const ST = [150, 107];
  const SEAT = (x, y, back) => ({ k: "seat", x1: x - 34, x2: x + 22, y: y + 8, back });
  const ANIM = {
    agachamento: { hl: ["quad", "glute"], props: [{ k: "barbell", at: "shoulder", off: [-3, -1] }],
      frames: [{ hip: ST, t: 6, L: [[152, 196]], A: [{ s: [-6, -2], e: -1 }] }, { hip: [116, 152], t: 40, L: [[152, 196]], A: [{ s: [-6, -2], e: -1 }] }] },
    legpress: { hl: ["quad", "glute"], props: [{ k: "track", p: [140, 150], q: [232, 72] }, { k: "seat", x1: 84, x2: 132, y: 177, back: [104, 177, 55, 150] }, { k: "plate45" }],
      frames: [{ hip: [112, 168], t: -52, L: [[149, 137]], A: [{ p: [122, 172] }] }, { hip: [112, 168], t: -52, L: [[176, 114]], A: [{ p: [122, 172] }] }] },
    extensora: { hl: ["quad"], props: [SEAT(128, 150, [116, 156, 108, 98]), { k: "pad", side: 1 }],
      frames: [{ hip: [128, 150], t: -8, L: [{ th: 90, sh: 4 }], A: [{ p: [140, 160] }] }, { hip: [128, 150], t: -8, L: [{ th: 90, sh: 84 }], A: [{ p: [140, 160] }] }] },
    flexora: { hl: ["post"], props: [SEAT(128, 150, [114, 156, 104, 98]), { k: "kneepad", x: 166, y: 134 }, { k: "pad", side: -1 }],
      frames: [{ hip: [128, 150], t: -12, L: [{ th: 88, sh: 84 }], A: [{ p: [140, 160] }] }, { hip: [128, 150], t: -12, L: [{ th: 88, sh: -8 }], A: [{ p: [140, 160] }] }] },
    mesaflexora: { hl: ["post"], props: [{ k: "bench", x1: 70, x2: 236, y: 160 }, { k: "pad", side: -1 }],
      frames: [{ hip: [140, 150], t: 90, L: [{ th: -90, sh: -90 }], A: [{ p: [236, 162] }] }, { hip: [140, 150], t: 90, L: [{ th: -90, sh: -168 }], A: [{ p: [236, 162] }] }] },
    stiff: { hl: ["post", "glute"], props: [{ k: "dumbbell", at: "hand1" }],
      frames: [{ hip: ST, t: 2, L: [[152, 196]], A: [{ ua: 0, fa: 0 }] }, { hip: [134, 112], t: 78, L: [[152, 196]], A: [{ ua: 0, fa: 0 }] }] },
    terra: { hl: ["post", "glute", "lombar"], props: [{ k: "barbell", at: "hand1", off: [0, 0] }],
      frames: [{ hip: ST, t: 2, L: [[152, 196]], A: [{ ua: 0, fa: 0 }] }, { hip: [134, 112], t: 72, L: [[152, 196]], A: [{ ua: 0, fa: 0 }] }] },
    afundo: { hl: ["quad", "glute"], props: [],
      frames: [{ hip: [150, 108], t: 2, L: [[176, 196], [122, 196]], A: [{ h: [8, 2] }] }, { hip: [148, 148], t: 4, L: [[176, 196], [122, 196]], A: [{ h: [8, 2] }] }] },
    sentar: { hl: ["quad", "glute"], props: [{ k: "chair", x1: 98, x2: 140, y: 152, bx: 96, by: 96 }],
      frames: [{ hip: [122, 146], t: 26, L: [[160, 196]], A: [{ s: [14, 16] }] }, { hip: [154, 107], t: 4, L: [[160, 196]], A: [{ s: [14, 16] }] }] },
    panturrilha: { hl: ["calf"], props: [{ k: "rail", x: 182, y: 96 }],
      frames: [{ hip: ST, t: 0, L: [[152, 196]], A: [{ p: [178, 104] }] }, { hip: [150, 98], t: 0, L: [[152, 187]], A: [{ p: [178, 104] }] }], hold: [0.3, 0.6] },
    equilibrio: { hl: ["glute", "quad"], props: [{ k: "rail", x: 182, y: 96 }],
      frames: [{ hip: [150, 107], t: 0, L: [[154, 196], [147, 196]], A: [{ p: [178, 106] }] }, { hip: [151, 107], t: 0, L: [[154, 196], [170, 150]], A: [{ p: [178, 106] }] }], hold: [0.6, 1.6] },
    marcha: { hl: ["quad"], props: [{ k: "rail", x: 182, y: 96 }],
      frames: [{ hip: [150, 107], t: 0, L: [[153, 196], [170, 150]], A: [{ p: [178, 106] }] }, { hip: [150, 107], t: 0, L: [[170, 150], [148, 196]], A: [{ p: [178, 106] }] }], hold: [0.2, 0.2] },
    supino: { hl: ["peito", "triceps"], props: [{ k: "bench", x1: 84, x2: 192, y: 154 }, { k: "barbell", at: "hand1" }],
      frames: [{ hip: [178, 145], t: -90, L: [[212, 196]], A: [{ p: [126, 86] }] }, { hip: [178, 145], t: -90, L: [[212, 196]], A: [{ p: [128, 124] }] }] },
    supinoinc: { hl: ["peito", "delt"], props: [{ k: "seat", x1: 150, x2: 196, y: 164, back: [168, 166, 118, 134] }, { k: "dumbbell", at: "hand1" }],
      frames: [{ hip: [176, 156], t: -58, L: [[216, 196]], A: [{ p: [134, 68] }] }, { hip: [176, 156], t: -58, L: [[216, 196]], A: [{ p: [124, 110] }] }] },
    supinomaq: { hl: ["peito", "triceps"], props: [SEAT(118, 150, [106, 156, 100, 96]), { k: "grip", at: "hand1" }],
      frames: [{ hip: [118, 150], t: -6, L: [{ th: 84, sh: 2 }], A: [{ p: [172, 100] }] }, { hip: [118, 150], t: -6, L: [{ th: 84, sh: 2 }], A: [{ p: [136, 104] }] }] },
    remadabaixa: { hl: ["costas", "biceps"], props: [{ k: "bench", x1: 74, x2: 150, y: 180 }, { k: "footplate", x: 186, y1: 148, y2: 184 }, { k: "cable", at: "hand1", to: [268, 150] }, { k: "grip", at: "hand1" }],
      frames: [{ hip: [112, 172], t: 18, L: [[178, 166]], A: [{ p: [184, 138] }] }, { hip: [112, 172], t: -6, L: [[178, 166]], A: [{ p: [136, 134] }] }] },
    remadamaq: { hl: ["costas", "biceps"], props: [SEAT(120, 150, null), { k: "chestpad", x: 154, y1: 86, y2: 128 }, { k: "grip", at: "hand1" }],
      frames: [{ hip: [120, 150], t: 4, L: [{ th: 84, sh: 4 }], A: [{ p: [184, 104] }] }, { hip: [120, 150], t: 4, L: [{ th: 84, sh: 4 }], A: [{ p: [140, 108] }] }] },
    remadauni: { hl: ["costas", "biceps"], props: [{ k: "bench", x1: 182, x2: 256, y: 150 }, { k: "dumbbell", at: "hand1" }],
      frames: [{ hip: [118, 108], t: 72, L: [[134, 196], [100, 196]], A: [{ p: [169, 152] }, { p: [206, 146] }] }, { hip: [118, 108], t: 72, L: [[134, 196], [100, 196]], A: [{ p: [148, 114] }, { p: [206, 146] }] }] },
    puxada: { hl: ["costas", "biceps"], props: [SEAT(128, 160, null), { k: "kneepad", x: 160, y: 150 }, { k: "cable", at: "hand1", to: [144, 6] }, { k: "barh", at: "hand1" }],
      frames: [{ hip: [128, 160], t: -8, L: [{ th: 84, sh: 2 }], A: [{ s: [16, -60] }] }, { hip: [128, 160], t: -8, L: [{ th: 84, sh: 2 }], A: [{ s: [12, 8] }] }] },
    desenvolvimento: { hl: ["delt", "triceps"], props: [SEAT(128, 156, [116, 162, 110, 100]), { k: "dumbbell", at: "hand1" }],
      frames: [{ hip: [128, 156], t: -6, L: [{ th: 86, sh: 2 }], A: [{ s: [8, -60] }] }, { hip: [128, 156], t: -6, L: [{ th: 86, sh: 2 }], A: [{ s: [10, -4] }] }] },
    elevacao: { view: "front", hl: ["delt"], dumbbells: true,
      frames: [{ cx: 150, hy: 112, arm: 8, bend: 0, open: 3, fL: 0, fR: 0 }, { cx: 150, hy: 112, arm: 82, bend: 0, open: 3, fL: 0, fR: 0 }] },
    abdutora: { view: "front", hl: ["glutmed"], pads: true, props: [{ k: "seatfront" }],
      frames: [{ cx: 150, hy: 150, seated: 1, open: 2, arm: 20, bend: 0, fL: 0, fR: 0 }, { cx: 150, hy: 150, seated: 1, open: 30, arm: 20, bend: 0, fL: 0, fR: 0 }] },
    caminhada: { view: "front", hl: ["glutmed"],
      frames: [{ cx: 150, hy: 112, hands: 1, open: 3, arm: 0, bend: 0, fL: 0, fR: 0 }, { cx: 162, hy: 115, hands: 1, open: 3, arm: 0, bend: 0, fL: -12, fR: 12 }] },
    facepull: { hl: ["delt", "costas"], props: [{ k: "cable", at: "hand1", to: [272, 58] }, { k: "rope", at: "hand1" }],
      frames: [{ hip: [140, 107], t: -4, L: [[152, 196], [126, 196]], A: [{ s: [60, 4] }] }, { hip: [140, 107], t: -4, L: [[152, 196], [126, 196]], A: [{ s: [18, -12], e: -1 }] }] },
    rosca: { hl: ["biceps"], props: [{ k: "barbell", at: "hand1" }],
      frames: [{ hip: ST, t: 0, L: [[152, 196]], A: [{ ua: 2, fa: 6 }] }, { hip: ST, t: 0, L: [[152, 196]], A: [{ ua: 4, fa: 148 }] }] },
    roscasentado: { hl: ["biceps"], props: [SEAT(128, 152, [116, 158, 110, 98]), { k: "dumbbell", at: "hand1" }],
      frames: [{ hip: [128, 152], t: -4, L: [{ th: 86, sh: 2 }], A: [{ ua: 2, fa: 6 }] }, { hip: [128, 152], t: -4, L: [{ th: 86, sh: 2 }], A: [{ ua: 4, fa: 148 }] }] },
    triceps: { hl: ["triceps"], props: [{ k: "cable", at: "hand1", to: [182, 6] }, { k: "rope", at: "hand1" }],
      frames: [{ hip: [140, 107], t: 10, L: [[150, 196]], A: [{ ua: -4, fa: 128 }] }, { hip: [140, 107], t: 10, L: [[150, 196]], A: [{ ua: -4, fa: 4 }] }] },
    prancha: { hl: ["abdomen"], props: [{ k: "mat", x1: 30, x2: 240 }], hold: [1, 1], dur: 1.6,
      frames: [{ hip: [128, 168], t: 85, L: [[42, 196]], A: [{ ua: 0, fa: 90 }] }, { hip: [128, 166], t: 86, L: [[42, 196]], A: [{ ua: 0, fa: 90 }] }] },
    abdpolia: { hl: ["abdomen"], props: [{ k: "cable", at: "hand1", to: [178, 6] }, { k: "rope", at: "hand1" }],
      frames: [{ hip: [150, 152], t: 12, L: [{ th: 0, sh: -90 }], A: [{ s: [6, -10] }] }, { hip: [150, 152], t: 66, L: [{ th: 0, sh: -90 }], A: [{ s: [6, -10] }] }] },
  };

  const ease = (x) => x * x * (3 - 2 * x);
  function phase(def, time) {
    const hA = (def.hold || [0.35, 0.35])[0], hB = (def.hold || [0.35, 0.35])[1], m = def.dur || 1.1;
    const T = hA + m + hB + m, x = time % T;
    if (x < hA) return 0; if (x < hA + m) return ease((x - hA) / m);
    if (x < hA + m + hB) return 1; return 1 - ease((x - hA - m - hB) / m);
  }

  function draw(c, key, time, col, W, H) {
    const def = ANIM[key];
    c.clearRect(0, 0, W, H);
    const s = Math.min(W / 300, H / 220);
    c.save(); c.translate((W - 300 * s) / 2, (H - 220 * s) / 2); c.scale(s, s);
    // chão
    c.fillStyle = col.floor; c.fillRect(10, GROUND, 280, 2.5);
    if (!def) { c.fillStyle = col.far; c.font = "600 15px sans-serif"; c.textAlign = "center"; c.fillText("Sem animação", 150, 110); c.restore(); return; }
    const k = phase(def, time);
    const f = lerp(def.frames[0], def.frames[1], k);
    if (def.view === "front") {
      if (def.props && def.props.some((p) => p.k === "seatfront")) { roundRect(c, 112, 154, 76, 8, 3, col.prop); bar(c, 150, 160, 150, GROUND, 6, col.prop); }
      drawFront(c, def, f, col);
    } else drawSide(c, def, solve(f), col);
    c.restore();
  }

  const G = { pernas: "Pernas", peito: "Peito", costas: "Costas", ombros: "Ombros", bracos: "Braços", abdomen: "Abdômen", equilibrio: "Equilíbrio" };
  const LIB = {
    agachamento: { nome: "Agachamento livre", grupo: G.pernas, anim: "agachamento",
      dicas: ["Barra apoiada no alto das costas, pés na largura dos ombros.", "Desça levando o quadril pra trás e dobrando os joelhos.", "Vá até a coxa ficar paralela ao chão, peito aberto.", "Suba empurrando o chão com o pé inteiro."],
      cuidado: "Joelhos seguem a direção dos pés. Não arredonde a lombar." },
    legpress: { nome: "Leg press", grupo: G.pernas, anim: "legpress",
      dicas: ["Ajuste o banco pra que os joelhos fiquem dobrados em ângulo reto.", "Pés no meio da plataforma, na largura dos ombros.", "Empurre devagar, sem travar totalmente os joelhos.", "Volte devagar, sem deixar o joelho chegar perto do peito."],
      cuidado: "Solte o ar ao empurrar. Costas e quadril sempre encostados no banco." },
    extensora: { nome: "Cadeira extensora", grupo: G.pernas, anim: "extensora",
      dicas: ["Ajuste o encosto pra que o joelho fique bem na beirada do banco.", "O rolo fica logo acima do tornozelo.", "Estique as pernas devagar.", "Volte devagar, sem deixar o peso bater."],
      cuidado: "Use peso leve. Se doer o joelho, diminua o peso ou o movimento." },
    flexora: { nome: "Cadeira flexora (sentado)", grupo: G.pernas, anim: "flexora",
      dicas: ["Sente com o joelho alinhado ao eixo da máquina.", "Prenda bem o apoio de cima das coxas.", "Puxe os calcanhares pra baixo e pra trás.", "Volte devagar."],
      cuidado: "Mais fácil de entrar e sair do que a versão deitada." },
    mesaflexora: { nome: "Mesa flexora", grupo: G.pernas, anim: "mesaflexora",
      dicas: ["Deite de bruços com o joelho logo depois da beirada do banco.", "O rolo fica logo acima do calcanhar.", "Dobre os joelhos trazendo os calcanhares em direção ao bumbum.", "Volte devagar até quase esticar."],
      cuidado: "Quadril colado no banco. Não levante o bumbum pra ajudar." },
    stiff: { nome: "Stiff com halteres", grupo: G.pernas, anim: "stiff",
      dicas: ["Em pé, um halter em cada mão, joelhos levemente dobrados.", "Leve o quadril pra trás, descendo os halteres rente às pernas.", "Desça até sentir alongar atrás da coxa.", "Suba contraindo o bumbum."],
      cuidado: "Coluna sempre reta. O movimento é do quadril, não das costas." },
    terra: { nome: "Terra romeno", grupo: G.pernas, anim: "terra",
      dicas: ["Barra na frente das coxas, pés na largura do quadril.", "Joelhos levemente dobrados e travados nessa posição.", "Leve o quadril pra trás, com a barra rente às pernas.", "Suba empurrando o quadril pra frente."],
      cuidado: "Barra sempre colada no corpo. Pare antes da lombar arredondar." },
    afundo: { nome: "Afundo", grupo: G.pernas, anim: "afundo",
      dicas: ["Dê um passo largo pra frente, pés na largura do quadril.", "Desça o joelho de trás em direção ao chão.", "Tronco reto, joelho da frente sobre o pé.", "Suba empurrando com a perna da frente."],
      cuidado: "Se o equilíbrio faltar, faça segurando num apoio." },
    sentar: { nome: "Sentar e levantar da cadeira", grupo: G.pernas, anim: "sentar",
      dicas: ["Use uma cadeira firme, encostada na parede.", "Sente na pontinha, pés afastados na largura do quadril.", "Incline o corpo pra frente e levante, empurrando o chão com os pés.", "Sente devagar, controlando a descida."],
      cuidado: "Se precisar, apoie as mãos nas coxas ou nos braços da cadeira." },
    panturrilha: { nome: "Panturrilha em pé com apoio", grupo: G.pernas, anim: "panturrilha",
      dicas: ["De frente pra uma barra ou parede, segurando com as mãos.", "Suba na ponta dos pés devagar.", "Segure 1 segundo lá em cima.", "Desça devagar até apoiar o calcanhar."],
      cuidado: "Sempre segurando em algo firme." },
    equilibrio: { nome: "Equilíbrio num pé só (com apoio)", grupo: G.equilibrio, anim: "equilibrio",
      dicas: ["Fique ao lado de uma barra ou cadeira firme, segurando com uma mão.", "Tire um pé do chão, levantando o joelho um pouco.", "Fique parado contando até 20.", "Troque de perna. Com o tempo, segure só com um dedo."],
      cuidado: "Nunca faça longe de um apoio. Olhe pra um ponto fixo à frente." },
    marcha: { nome: "Marcha no lugar com apoio", grupo: G.equilibrio, anim: "marcha",
      dicas: ["Segure numa barra ou bancada firme.", "Levante um joelho até a altura do quadril, se conseguir.", "Desça e levante o outro, como se marchasse.", "Mantenha o ritmo calmo e o corpo reto."],
      cuidado: "Comece levantando pouco o joelho e vá aumentando." },
    caminhada: { nome: "Caminhada lateral com apoio", grupo: G.equilibrio, anim: "caminhada",
      dicas: ["De frente pra uma barra ou bancada, segurando com as mãos.", "Dê passos de lado, abrindo uma perna e trazendo a outra.", "Corpo reto e pés apontando pra frente.", "Volte pro outro lado."],
      cuidado: "Passos curtos e controlados. Sem cruzar as pernas." },
    abdutora: { nome: "Cadeira abdutora", grupo: G.pernas, anim: "abdutora",
      dicas: ["Sente com as costas encostadas e as pernas juntas nos apoios.", "Abra as pernas devagar.", "Segure 1 segundo aberto.", "Feche devagar, sem deixar o peso bater."],
      cuidado: "Fortalece o quadril, que ajuda muito no equilíbrio. Use peso leve." },
    supino: { nome: "Supino reto", grupo: G.peito, anim: "supino",
      dicas: ["Deite no banco com os olhos embaixo da barra e pés firmes no chão.", "Pegue a barra um pouco mais aberto que os ombros.", "Desça a barra até tocar de leve o meio do peito.", "Empurre de volta até esticar os braços."],
      cuidado: "Escápulas juntas e apoiadas no banco. Use alguém pra ajudar nas cargas altas." },
    supinoinc: { nome: "Supino inclinado com halteres", grupo: G.peito, anim: "supinoinc",
      dicas: ["Banco inclinado em uns 30°, um halter em cada mão.", "Halteres na altura do peito, cotovelos um pouco abaixo dos ombros.", "Empurre pra cima, aproximando os halteres.", "Desça devagar até a altura do peito."],
      cuidado: "Não deixe os cotovelos abrirem demais pros lados." },
    supinomaq: { nome: "Supino na máquina (sentado)", grupo: G.peito, anim: "supinomaq",
      dicas: ["Ajuste o banco pra que as alças fiquem na altura do meio do peito.", "Costas bem encostadas.", "Empurre pra frente até quase esticar os braços.", "Volte devagar, sem deixar o peso bater."],
      cuidado: "Se sentir algo no ombro, diminua o peso ou o caminho do movimento." },
    remadabaixa: { nome: "Remada baixa", grupo: G.costas, anim: "remadabaixa",
      dicas: ["Sente com os pés na plataforma e joelhos levemente dobrados.", "Segure o triângulo com os braços esticados e o tronco reto.", "Puxe até a barriga, levando os cotovelos pra trás.", "Volte devagar, alongando as costas."],
      cuidado: "Não balance o tronco pra puxar. Coluna reta o tempo todo." },
    remadamaq: { nome: "Remada sentada na máquina", grupo: G.costas, anim: "remadamaq",
      dicas: ["Sente com o peito no apoio e pés firmes no chão.", "Segure as alças com os braços esticados.", "Puxe os cotovelos pra trás, juntando as escápulas.", "Volte devagar até esticar os braços."],
      cuidado: "Coluna reta, sem jogar o corpo pra trás." },
    remadauni: { nome: "Remada unilateral", grupo: G.costas, anim: "remadauni",
      dicas: ["Apoie uma mão no banco, tronco quase paralelo ao chão.", "Halter na outra mão, braço esticado.", "Puxe o halter em direção ao quadril, cotovelo rente ao corpo.", "Desça devagar."],
      cuidado: "Não gire o tronco pra puxar. Costas retas." },
    puxada: { nome: "Puxada frente", grupo: G.costas, anim: "puxada",
      dicas: ["Sente com as coxas presas no apoio.", "Segure a barra um pouco mais aberto que os ombros.", "Puxe a barra até a altura do queixo, levando os cotovelos pra baixo.", "Suba devagar até esticar os braços."],
      cuidado: "Puxe sempre pela frente, nunca atrás da cabeça." },
    desenvolvimento: { nome: "Desenvolvimento com halteres", grupo: G.ombros, anim: "desenvolvimento",
      dicas: ["Sente com as costas apoiadas, halteres na altura dos ombros.", "Empurre os halteres pra cima até quase esticar os braços.", "Desça devagar até a altura das orelhas.", "Mantenha o abdômen firme."],
      cuidado: "Não arqueie a lombar. Se o ombro incomodar, desça menos." },
    elevacao: { nome: "Elevação lateral", grupo: G.ombros, anim: "elevacao",
      dicas: ["Em pé, um halter leve em cada mão ao lado do corpo.", "Cotovelos levemente dobrados.", "Suba os braços pros lados até a altura dos ombros.", "Desça devagar."],
      cuidado: "Não suba acima dos ombros nem balance o corpo." },
    facepull: { nome: "Face pull", grupo: G.ombros, anim: "facepull",
      dicas: ["Corda na polia na altura do rosto.", "Segure com as palmas viradas uma pra outra.", "Puxe em direção ao rosto, abrindo os cotovelos pra cima.", "Volte devagar."],
      cuidado: "Peso leve. O foco é a parte de trás do ombro." },
    rosca: { nome: "Rosca direta", grupo: G.bracos, anim: "rosca",
      dicas: ["Em pé, barra nas mãos com as palmas pra frente.", "Cotovelos colados ao corpo.", "Suba a barra dobrando os cotovelos.", "Desça devagar até esticar."],
      cuidado: "Não jogue o corpo pra trás pra subir a barra." },
    roscasentado: { nome: "Rosca com halteres sentado", grupo: G.bracos, anim: "roscasentado",
      dicas: ["Sente num banco com encosto, um halter leve em cada mão.", "Cotovelos colados no corpo.", "Suba os halteres dobrando o cotovelo.", "Desça devagar."],
      cuidado: "Não balance o corpo. Comece com 1 a 2 kg." },
    triceps: { nome: "Tríceps na polia", grupo: G.bracos, anim: "triceps",
      dicas: ["De frente pra polia alta, segurando a barra ou corda.", "Cotovelos colados ao lado do corpo.", "Estique os braços empurrando pra baixo.", "Volte devagar até a altura do peito."],
      cuidado: "Só o antebraço se mexe. Cotovelos parados." },
    prancha: { nome: "Prancha", grupo: G.abdomen, anim: "prancha",
      dicas: ["Apoie os antebraços no chão, cotovelos embaixo dos ombros.", "Estique as pernas, apoiando nas pontas dos pés.", "Corpo reto da cabeça aos pés.", "Segure o tempo indicado respirando normalmente."],
      cuidado: "Não deixe o quadril cair nem subir demais." },
    abdpolia: { nome: "Abdominal na polia", grupo: G.abdomen, anim: "abdpolia",
      dicas: ["Ajoelhe de frente pra polia alta, segurando a corda ao lado da cabeça.", "Quadril parado.", "Enrole o tronco pra baixo, aproximando os cotovelos das coxas.", "Volte devagar."],
      cuidado: "O movimento vem do abdômen, não dos braços." },

    voador: { nome: "Voador (crucifixo na máquina)", grupo: G.peito, anim: "voador",
      dicas: ["Sente com as costas apoiadas, pegadores na altura do peito.", "Cotovelos levemente dobrados e fixos.", "Feche os braços à frente, como num abraço.", "Volte devagar até sentir o peito alongar."],
      cuidado: "Não deixe os braços irem muito pra trás dos ombros." },
    supinoincmaq: { nome: "Supino inclinado na máquina", grupo: G.peito, anim: "supinoincmaq",
      dicas: ["Banco ajustado pra os pegadores ficarem na altura do peito alto.", "Costas inteiras no encosto.", "Empurre pra frente e pra cima sem travar os cotovelos.", "Volte devagar."],
      cuidado: "Ombros encaixados pra trás, sem subir em direção às orelhas." },
    hack: { nome: "Agachamento no hack", grupo: G.pernas, anim: "hack",
      dicas: ["Costas e ombros apoiados no encosto, pés no meio da plataforma.", "Destrave e desça dobrando os joelhos.", "Desça até a coxa ficar paralela à plataforma.", "Suba empurrando com o pé inteiro."],
      cuidado: "Joelhos na direção dos pés. Não tire o quadril do encosto." },
    desenvmaq: { nome: "Desenvolvimento na máquina", grupo: G.ombros, anim: "desenvmaq",
      dicas: ["Banco ajustado pra os pegadores ficarem na altura dos ombros.", "Costas apoiadas.", "Empurre pra cima sem travar os cotovelos.", "Desça devagar até a altura das orelhas."],
      cuidado: "Não arqueie a lombar pra empurrar." },
    roscamaq: { nome: "Rosca na máquina (Scott)", grupo: G.bracos, anim: "roscamaq",
      dicas: ["Braços apoiados no banco inclinado, axilas encostadas.", "Segure os pegadores com as palmas pra cima.", "Suba dobrando os cotovelos.", "Desça devagar até quase esticar."],
      cuidado: "Não estique o braço de uma vez lá embaixo." },
    martelo: { nome: "Rosca martelo", grupo: G.bracos, anim: "martelo",
      dicas: ["Halteres com as palmas viradas uma pra outra.", "Cotovelos colados ao corpo.", "Suba sem girar o punho.", "Desça devagar."],
      cuidado: "Sem balançar o corpo." },
    francespolia: { nome: "Tríceps francês na polia", grupo: G.bracos, anim: "francespolia",
      dicas: ["De costas pra polia, corda atrás da cabeça.", "Cotovelos apontando pra frente, parados.", "Estique os braços pra frente e pra cima.", "Volte devagar."],
      cuidado: "Os cotovelos não abrem. Só o antebraço se mexe." },
    crucinverso: { nome: "Crucifixo inverso na máquina", grupo: G.ombros, anim: "crucinverso",
      dicas: ["Sente de frente pro encosto, peito apoiado.", "Pegadores na altura dos ombros, braços quase esticados.", "Abra os braços pra trás.", "Volte devagar."],
      cuidado: "Peso leve. Não encolha os ombros." },
    pantsentado: { nome: "Panturrilha sentado", grupo: G.pernas, anim: "pantsentado",
      dicas: ["Sente com a almofada em cima dos joelhos, pontas dos pés na plataforma.", "Desça os calcanhares o máximo que der.", "Suba ficando na ponta dos pés.", "Segure 1 segundo lá em cima."],
      cuidado: "Movimento completo e devagar, sem quicar." },
    step: { nome: "Subida no step", grupo: G.pernas, anim: "step",
      dicas: ["Fique de frente pra um degrau baixo (15 a 20 cm), segurando num apoio.", "Suba com uma perna, apoiando o pé inteiro no degrau.", "Traga a outra perna pra cima.", "Desça devagar, uma perna de cada vez."],
      cuidado: "Sempre com algo pra segurar. Olhe pra frente, não pros pés." },
    tandem: { nome: "Caminhada calcanhar na ponta", grupo: G.equilibrio, anim: "tandem",
      dicas: ["Fique ao lado de uma parede ou barra.", "Ande em linha reta encostando o calcanhar de um pé na ponta do outro.", "Olhe pra frente, braços soltos ou abertos.", "Dê 10 passos, vire e volte."],
      cuidado: "Se desequilibrar, apoie na parede. Sem pressa." },
  };

  window.FIG = { LIB, ANIM, draw, GROUPS: Object.values(G) };
})();
