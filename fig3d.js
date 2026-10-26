// ============================================================
//  Manequim 3D (desenhado em canvas 2D, sem bibliotecas)
//  Cinza liso, músculo trabalhado em vermelho, em perspectiva.
// ============================================================
(function () {
  "use strict";
  const D = Math.PI / 180;
  // ---------- vetores e matrizes 3x3 ----------
  const v = (x, y, z) => [x, y, z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const mm = (A, B) => { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R; };
  const mv = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2], M[3] * p[0] + M[4] * p[1] + M[5] * p[2], M[6] * p[0] + M[7] * p[1] + M[8] * p[2]];
  const Rx = (a) => { const c = Math.cos(a * D), s = Math.sin(a * D); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const Ry = (a) => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const Rz = (a) => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const R3 = (r) => (r ? mm(mm(Ry(r[1] || 0), Rx(r[0] || 0)), Rz(r[2] || 0)) : I3());

  // ---------- medidas do corpo (metros) ----------
  const B = { hipW: 0.095, thigh: 0.43, shin: 0.42, foot: 0.2, spine: 0.5, shW: 0.185, shY: 0.44, upper: 0.29, fore: 0.26, neck: 0.08, head: 0.105 };

  // pose: P posição da pelve, R rotação do corpo todo, T inclinação do tronco, TS lateral, TT giro, H cabeça,
  // S/SL/SR ombro [flexão, abdução, rotação], E/EL/ER cotovelo, HP/HL/HR quadril [flexão, abdução], K/KL/KR joelho, A tornozelo
  function solve(p) {
    const M0 = R3(p.R), P0 = p.P || [0, 0.95, 0];
    const at = (M, o, l) => add(o, mv(M, l));
    const Mt = mm(M0, mm(mm(Rx(p.T || 0), Rz(-(p.TS || 0))), Ry(p.TT || 0)));
    const J = { M0, Mt, pelvis: P0 };
    J.chest = at(Mt, P0, [0, B.spine * 0.78, 0]);
    J.neck = at(Mt, P0, [0, B.spine, 0]);
    const Mh = mm(Mt, Rx(p.H || 0)); J.Mh = Mh;
    J.head = at(Mh, J.neck, [0, B.neck + B.head * 0.9, 0]);
    J.ab = at(Mt, P0, [0, 0.16, 0]);
    for (const side of ["L", "R"]) {
      const sg = side === "L" ? 1 : -1;
      const S = p["S" + side] || p.S || [0, 6, 0], E = p["E" + side] ?? p.E ?? 8;
      const Ms = mm(Mt, mm(mm(Rx(-S[0]), Rz(sg * S[1])), Ry(sg * (S[2] || 0))));
      const sh = at(Mt, P0, [sg * B.shW, B.shY, 0]);
      const el = at(Ms, sh, [0, -B.upper, 0]);
      const Me = mm(Ms, Rx(-E));
      const wr = at(Me, el, [0, -B.fore, 0]);
      J["sh" + side] = sh; J["el" + side] = el; J["wr" + side] = wr; J["Ms" + side] = Ms; J["Me" + side] = Me;
      J["hand" + side] = at(Me, el, [0, -B.fore - 0.06, 0]);
      const H = p["H" + side] || p.HP || [0, 4], K = p["K" + side] ?? p.K ?? 0;
      const Mth = mm(M0, mm(Rx(-H[0]), Rz(sg * (H[1] || 0))));
      const hip = at(M0, P0, [sg * B.hipW, 0, 0]);
      const kn = at(Mth, hip, [0, -B.thigh, 0]);
      const Msh = mm(Mth, Rx(K));
      const an = at(Msh, kn, [0, -B.shin, 0]);
      const A = p["A" + side] ?? p.A ?? 0;
      const Mf = mm(M0, Rx(-A));
      const toe = at(Mf, an, [0, -0.04, B.foot]);
      J["hip" + side] = hip; J["kn" + side] = kn; J["an" + side] = an; J["toe" + side] = toe; J["Mth" + side] = Mth; J["Msh" + side] = Msh; J["Mf" + side] = Mf;
    }
    return J;
  }
  function mix(a, b, t) {
    const o = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((k) => {
      const x = a[k] ?? b[k], y = b[k] ?? a[k];
      if (Array.isArray(x)) o[k] = x.map((q, i) => lerp(q || 0, (y && y[i]) || 0, t)); else if (typeof x === "number") o[k] = lerp(x, y, t); else o[k] = x;
    });
    // valores herdados (S vale pros dois lados se SL/SR faltar em um dos quadros)
    return o;
  }
  function expand(p) {
    const q = { ...p };
    ["S", "E", "HP", "K", "A"].forEach((k) => { const L = k === "HP" ? "HL" : k + "L", R = k === "HP" ? "HR" : k + "R"; if (q[k] != null) { if (q[L] == null) q[L] = q[k]; if (q[R] == null) q[R] = q[k]; } });
    if (q.SL == null) q.SL = [0, 6, 0]; if (q.SR == null) q.SR = [0, 6, 0];
    if (q.EL == null) q.EL = 8; if (q.ER == null) q.ER = 8;
    if (q.HL == null) q.HL = [0, 4]; if (q.HR == null) q.HR = [0, 4];
    if (q.KL == null) q.KL = 0; if (q.KR == null) q.KR = 0;
    if (q.AL == null) q.AL = 0; if (q.AR == null) q.AR = 0;
    delete q.S; delete q.E; delete q.HP; delete q.K; delete q.A;
    return q;
  }

  // ---------- primitivas ----------
  // cap: cápsula (a, b, ra, rb, cor), sph: esfera, box: caixa orientada, line, disc
  function bodyPrims(J, hl, out) {
    const C = "skin";
    const cap = (a, b, ra, rb, col, k) => out.push({ t: "cap", a, b, ra, rb: rb ?? ra, col: col || C, k });
    const sph = (c, r, col) => out.push({ t: "sph", c, r, col: col || C });
    const loc = (M, o, l) => add(o, mv(M, l));
    // tronco
    cap(J.pelvis, J.ab, 0.135, 0.13);
    cap(loc(J.Mt, J.pelvis, [0, 0.2, 0.0]), loc(J.Mt, J.pelvis, [0, 0.37, 0.005]), 0.155, 0.165);
    cap(J.shL, J.shR, 0.07);
    cap(loc(J.M0, J.pelvis, [B.hipW * 0.9, -0.02, 0]), loc(J.M0, J.pelvis, [-B.hipW * 0.9, -0.02, 0]), 0.11);
    cap(J.neck, loc(J.Mh, J.neck, [0, B.neck, 0.01]), 0.045);
    cap(loc(J.Mh, J.head, [0, -0.035, 0.012]), loc(J.Mh, J.head, [0, 0.03, -0.005]), B.head * 0.92);
    for (const s of ["L", "R"]) {
      const sg = s === "L" ? 1 : -1;
      sph(J["sh" + s], 0.07);
      cap(J["sh" + s], J["el" + s], 0.058, 0.046);
      sph(J["el" + s], 0.045);
      cap(J["el" + s], J["wr" + s], 0.046, 0.034);
      cap(J["wr" + s], J["hand" + s], 0.034, 0.03);
      cap(J["hip" + s], J["kn" + s], 0.09, 0.062);
      sph(J["kn" + s], 0.06);
      cap(J["kn" + s], J["an" + s], 0.06, 0.038);
      cap(J["an" + s], J["toe" + s], 0.038, 0.032);
      // músculos em destaque
      const th = (f0, f1, off, r) => cap(loc(J["Mth" + s], J["hip" + s], [off[0] * sg, -B.thigh * f0, off[1]]), loc(J["Mth" + s], J["hip" + s], [off[0] * sg, -B.thigh * f1, off[1]]), r, r * 0.85, "hl", 1);
      const sh = (f0, f1, off, r) => cap(loc(J["Msh" + s], J["kn" + s], [0, -B.shin * f0, off]), loc(J["Msh" + s], J["kn" + s], [0, -B.shin * f1, off]), r, r * 0.7, "hl", 1);
      const ua = (f0, f1, off, r) => cap(loc(J["Ms" + s], J["sh" + s], [0, -B.upper * f0, off]), loc(J["Ms" + s], J["sh" + s], [0, -B.upper * f1, off]), r, r * 0.8, "hl", 1);
      const tr = (a, b, r) => cap(loc(J.Mt, J.pelvis, [a[0] * sg, a[1], a[2]]), loc(J.Mt, J.pelvis, [b[0] * sg, b[1], b[2]]), r, r, "hl", 1);
      if (hl.includes("quad")) th(0.2, 0.78, [0.005, 0.042], 0.058);
      if (hl.includes("post")) th(0.2, 0.8, [0, -0.04], 0.055);
      if (hl.includes("calf")) sh(0.12, 0.5, -0.03, 0.048);
      if (hl.includes("glute")) out.push({ t: "sph", c: loc(J.M0, J.pelvis, [sg * 0.075, -0.035, -0.085]), r: 0.08, col: "hl", k: 1 });
      if (hl.includes("glutmed")) out.push({ t: "sph", c: loc(J.M0, J.pelvis, [sg * 0.15, 0.03, -0.02]), r: 0.055, col: "hl", k: 1 });
      if (hl.includes("biceps")) ua(0.2, 0.78, 0.028, 0.042);
      if (hl.includes("triceps")) ua(0.15, 0.8, -0.03, 0.043);
      if (hl.includes("delt")) out.push({ t: "sph", c: loc(J["Ms" + s], J["sh" + s], [0, -0.025, 0]), r: 0.07, col: "hl", k: 1 });
      if (hl.includes("peito")) tr([0.025, 0.37, 0.085], [0.12, 0.38, 0.06], 0.07);
      if (hl.includes("costas")) tr([0.1, 0.4, -0.07], [0.07, 0.2, -0.085], 0.07);
    }
    if (hl.includes("abdomen")) cap(loc(J.Mt, J.pelvis, [0, 0.04, 0.095]), loc(J.Mt, J.pelvis, [0, 0.3, 0.115]), 0.075, 0.07, "hl", 1);
    if (hl.includes("lombar")) cap(loc(J.Mt, J.pelvis, [0, 0.04, -0.09]), loc(J.Mt, J.pelvis, [0, 0.2, -0.1]), 0.065, 0.06, "hl", 1);
  }

  // props: caixas orientadas e barras
  function box(out, c, ax, ay, az, h, col) { out.push({ t: "box", c, ax: norm(ax), ay: norm(ay), az: norm(az), h, col: col || "prop" }); }
  function propPrims(J, props, out) {
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    const mid = (a, b) => mul(add(a, b), 0.5);
    for (const pr of props || []) {
      const k = pr.k;
      if (k === "box") box(out, pr.c, pr.ax || X, pr.ay || Y, pr.az || Z, pr.s.map((x) => x / 2), pr.col);
      else if (k === "bench") { // banco reto: tampo + 2 pés
        const [x, y, z] = pr.c, L = pr.l || 1.2, w = pr.w || 0.3, R = pr.r ? Ry(pr.r) : I3();
        const ax = mv(R, X), az = mv(R, Z);
        box(out, [x, y - 0.03, z], ax, Y, az, [w / 2, 0.035, L / 2], "pad");
        [-1, 1].forEach((sgn) => box(out, add([x, (y - 0.06) / 2, z], mul(az, sgn * (L / 2 - 0.12))), ax, Y, az, [w * 0.35, (y - 0.06) / 2, 0.03], "metal"));
      } else if (k === "seat") { // assento com encosto (máquina); c = centro do assento
        const [x, y, z] = pr.c, back = pr.back ?? 12, bh = pr.bh || 0.62;
        box(out, [x, y - 0.035, z], X, Y, Z, [0.2, 0.035, 0.2], "pad");
        box(out, [x, (y - 0.07) / 2, z], X, Y, Z, [0.04, (y - 0.07) / 2, 0.04], "metal");
        if (back !== false) { const Mb = Rx(-back), ayb = mv(Mb, Y), azb = mv(Mb, Z); box(out, add([x, y, z - 0.22], mul(ayb, bh / 2 + 0.04)), X, ayb, azb, [0.19, bh / 2, 0.035], "pad"); }
      } else if (k === "chair") {
        const [x, y, z] = pr.c;
        box(out, [x, y - 0.025, z], X, Y, Z, [0.22, 0.025, 0.21], "metal");
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(out, [x + a * 0.19, (y - 0.05) / 2, z + b * 0.18], X, Y, Z, [0.015, (y - 0.05) / 2, 0.015], "metal"));
        box(out, [x, y + 0.24, z - 0.2], X, Y, Z, [0.21, 0.2, 0.015], "metal");
      } else if (k === "bar") { // barra entre as mãos com anilhas
        const a = J.handL, b = J.handR, d = norm(sub(a, b)), c = mid(a, b), L = pr.l || 0.75;
        out.push({ t: "cap", a: add(c, mul(d, L)), b: add(c, mul(d, -L)), ra: 0.016, rb: 0.016, col: "metal" });
        if (pr.plates !== false) [1, -1].forEach((sg) => { const pc = add(c, mul(d, sg * (L - 0.1))); out.push({ t: "disc", c: pc, n: d, r: pr.pr || 0.15, w: 0.05, col: "plate" }); });
      } else if (k === "db") { // halteres
        for (const s of ["L", "R"]) { if (pr.only && pr.only !== s) continue; const h = J["hand" + s], M = J["Me" + s], ax = norm(mv(M, pr.axis || [1, 0, 0])); out.push({ t: "cap", a: add(h, mul(ax, 0.11)), b: add(h, mul(ax, -0.11)), ra: 0.014, rb: 0.014, col: "metal" }); [1, -1].forEach((sg) => out.push({ t: "disc", c: add(h, mul(ax, sg * 0.1)), n: ax, r: pr.r || 0.055, w: 0.04, col: "plate" })); }
      } else if (k === "handles") { // pegadores de máquina
        for (const s of ["L", "R"]) { const h = J["hand" + s], ax = norm(mv(J["Me" + s], [1, 0, 0])); out.push({ t: "cap", a: add(h, mul(ax, 0.07)), b: add(h, mul(ax, -0.07)), ra: 0.022, rb: 0.022, col: "metal" }); }
      } else if (k === "cable") { // cabo até a polia
        const from = pr.both ? mid(J.handL, J.handR) : J["hand" + (pr.side || "L")];
        out.push({ t: "line", a: from, b: pr.to, col: "cable" });
        out.push({ t: "disc", c: pr.to, n: pr.n || [1, 0, 0], r: 0.05, w: 0.025, col: "metal" });
        if (pr.rope) out.push({ t: "cap", a: J.handL, b: J.handR, ra: 0.016, rb: 0.016, col: "rope" });
      } else if (k === "footplate") { // plataforma presa aos pés (leg press)
        const c = mid(mid(J.anL, J.toeL), mid(J.anR, J.toeR)), fd = norm(sub(mid(J.toeL, J.toeR), mid(J.anL, J.anR)));
        const n = norm(cross(fd, X)), down = dot(n, sub(J.knL, J.anL)) > 0 ? mul(n, -1) : n;
        box(out, add(c, mul(down, 0.05)), X, fd, down, [0.3, 0.26, 0.018], "metal");
      } else if (k === "roller") { // rolo de espuma num ponto do corpo
        const p0 = typeof pr.at === "string" ? mid(J[pr.at + "L"], J[pr.at + "R"]) : pr.at;
        const c = add(p0, pr.off ? mv(pr.frame ? J[pr.frame] : I3(), pr.off) : [0, 0, 0]);
        out.push({ t: "cap", a: add(c, [0.2, 0, 0]), b: add(c, [-0.2, 0, 0]), ra: 0.05, rb: 0.05, col: "pad" });
      } else if (k === "pad") { // almofada presa a um quadro do corpo (encosto de peito etc.)
        const Mf = J[pr.frame || "Mt"], o = J[pr.from || "pelvis"], c = add(o, mv(Mf, pr.off));
        box(out, c, mv(Mf, X), mv(Mf, Y), mv(Mf, Z), pr.s.map((x) => x / 2), "pad");
      }
    }
  }

  // ---------- câmera e desenho ----------
  const PAL = {
    dark: { bg0: "#1b2026", bg1: "#0f1215", floor: "rgba(255,255,255,.05)", grid: "rgba(255,255,255,.07)", shadow: "rgba(0,0,0,.55)", skin: [170, 178, 188], hl: [236, 68, 64], prop: [72, 80, 92], pad: [52, 58, 68], metal: [128, 136, 148], plate: [40, 44, 50], cable: "rgba(200,206,214,.7)", rope: [210, 200, 170] },
    light: { bg0: "#f4f5f7", bg1: "#e3e6ea", floor: "rgba(0,0,0,.04)", grid: "rgba(0,0,0,.06)", shadow: "rgba(0,0,0,.18)", skin: [176, 183, 192], hl: [226, 52, 48], prop: [150, 156, 166], pad: [70, 76, 86], metal: [120, 126, 136], plate: [52, 56, 62], cable: "rgba(60,64,70,.6)", rope: [170, 150, 110] },
  };
  const LIGHT = norm([-0.45, 0.85, 0.55]);
  const rgb = (c, f) => `rgb(${Math.max(0, Math.min(255, c[0] * f)) | 0},${Math.max(0, Math.min(255, c[1] * f)) | 0},${Math.max(0, Math.min(255, c[2] * f)) | 0})`;

  function camera(def, w, h, bounds) {
    const az = (def.az ?? 55) * D, el = (def.el ?? 14) * D;
    const fwd = norm([-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)]);
    const right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
    const tgt = bounds.c, rad = bounds.r;
    const fov = 34 * D, dist = (rad / Math.sin(fov / 2)) * (def.zoom || 0.97);
    const eye = sub(tgt, mul(fwd, dist));
    const f = (Math.min(w, h) / 2) / Math.tan(fov / 2);
    return { eye, fwd, right, up, f, cx: w / 2, cy: h / 2 + (def.dy || 0) * h, dist,
      p(pt) { const d = sub(pt, eye), z = dot(d, fwd); return { x: this.cx + (dot(d, right) * f) / z, y: this.cy - (dot(d, up) * f) / z, z, s: f / z }; } };
  }
  function boundsOf(def) {
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const fr of def.frames) { const J = solve(expand(fr)); for (const k in J) { const q = J[k]; if (Array.isArray(q) && q.length === 3) { mn = mn.map((m, i) => Math.min(m, q[i])); mx = mx.map((m, i) => Math.max(m, q[i])); } } }
    for (const pr of def.props || []) if (pr.c) { const c = pr.c, e = pr.s ? pr.s.map((x) => x / 2) : [0.2, 0.2, 0.2]; mn = mn.map((m, i) => Math.min(m, c[i] - e[i])); mx = mx.map((m, i) => Math.max(m, c[i] + e[i])); }
    mn[1] = Math.min(mn[1], 0);
    const c = mul(add(mn, mx), 0.5), r = len(sub(mx, mn)) / 2 + 0.06;
    return { c, r };
  }

  function drawCap(ctx, cam, pr, pal) {
    const A = cam.p(pr.a), Bp = cam.p(pr.b), ra = pr.ra * A.s, rb = pr.rb * Bp.s;
    const dx = Bp.x - A.x, dy = Bp.y - A.y, L = Math.hypot(dx, dy);
    const base = pal[pr.col] || pal.skin;
    if (L < 0.5) { drawSph(ctx, { x: A.x, y: A.y, r: Math.max(ra, rb) }, base, pr.col === "hl" ? 1.05 : 1); return; }
    const nx = -dy / L, ny = dx / L, ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.arc(A.x, A.y, ra, ang + Math.PI / 2, ang - Math.PI / 2, false);
    ctx.arc(Bp.x, Bp.y, rb, ang - Math.PI / 2, ang + Math.PI / 2, false);
    ctx.closePath();
    // sombreado cilíndrico: lado claro virado pra luz (cima/esquerda)
    let sx = nx, sy = ny; if (sx * -0.55 + sy * -0.83 < 0) { sx = -sx; sy = -sy; }
    const r = (ra + rb) / 2, mx = (A.x + Bp.x) / 2, my = (A.y + Bp.y) / 2;
    const g = ctx.createLinearGradient(mx + sx * r, my + sy * r, mx - sx * r, my - sy * r);
    g.addColorStop(0, rgb(base, 1.08)); g.addColorStop(0.28, rgb(base, 1.22)); g.addColorStop(0.62, rgb(base, 0.86)); g.addColorStop(1, rgb(base, 0.52));
    ctx.fillStyle = g; ctx.fill();
  }
  function drawSph(ctx, s, base, k) {
    const g = ctx.createRadialGradient(s.x - s.r * 0.35, s.y - s.r * 0.4, s.r * 0.1, s.x, s.y, s.r);
    g.addColorStop(0, rgb(base, 1.28 * (k || 1))); g.addColorStop(0.55, rgb(base, 0.95)); g.addColorStop(1, rgb(base, 0.55));
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0.5, s.r), 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  }
  function drawBox(ctx, cam, pr, pal) {
    const base = pal[pr.col] || pal.prop, { c, ax, ay, az, h } = pr;
    const faces = [[ax, ay, az, h[0], h[1], h[2]], [mul(ax, -1), ay, az, h[0], h[1], h[2]], [ay, az, ax, h[1], h[2], h[0]], [mul(ay, -1), az, ax, h[1], h[2], h[0]], [az, ax, ay, h[2], h[0], h[1]], [mul(az, -1), ax, ay, h[2], h[0], h[1]]];
    const fs = [];
    for (const [n, u, w, hn, hu, hw] of faces) {
      const fc = add(c, mul(n, hn));
      if (dot(n, sub(fc, cam.eye)) >= 0) continue;
      const pts = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => cam.p(add(fc, add(mul(u, a * hu), mul(w, b * hw)))));
      fs.push({ pts, sh: 0.55 + 0.6 * Math.max(0, dot(n, LIGHT)) });
    }
    for (const f of fs) { ctx.beginPath(); f.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fillStyle = rgb(base, f.sh); ctx.fill(); ctx.strokeStyle = rgb(base, f.sh * 0.75); ctx.lineWidth = 0.6; ctx.stroke(); }
  }
  function drawDisc(ctx, cam, pr, pal) { // disco (anilha) visto em perspectiva
    const base = pal[pr.col] || pal.plate, n = norm(pr.n), u = norm(Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0])), w = cross(n, u);
    const ring = (o) => { const pts = []; for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push(cam.p(add(add(pr.c, mul(n, o)), add(mul(u, Math.cos(a) * pr.r), mul(w, Math.sin(a) * pr.r))))); } return pts; };
    const r1 = ring(pr.w / 2), r2 = ring(-pr.w / 2), front = dot(n, sub(pr.c, cam.eye)) < 0 ? r1 : r2, back = front === r1 ? r2 : r1;
    const poly = (pts, col) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    poly(back, rgb(base, 0.6));
    for (let i = 0; i < 20; i++) { const j = (i + 1) % 20; ctx.beginPath(); ctx.moveTo(back[i].x, back[i].y); ctx.lineTo(back[j].x, back[j].y); ctx.lineTo(front[j].x, front[j].y); ctx.lineTo(front[i].x, front[i].y); ctx.closePath(); ctx.fillStyle = rgb(base, 0.75); ctx.fill(); }
    poly(front, rgb(base, 1.1));
  }

  const CACHE = {};
  function draw(ctx, name, t, w, h, theme) {
    const def = ANIM3[name] || ANIM3.parado;
    const pal = PAL[theme === "light" ? "light" : "dark"];
    if (!CACHE[name]) CACHE[name] = boundsOf(def);
    const cam = camera(def, w, h, CACHE[name]);
    // fundo
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, pal.bg0); g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // quadro do movimento: vai e volta com suavidade
    const dur = def.dur || 2.6, ph = ((t % dur) / dur), k = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
    const fr = def.frames.length > 1 ? mix(expand(def.frames[0]), expand(def.frames[1]), k) : expand(def.frames[0]);
    const J = solve(fr);
    // chão: grade em perspectiva + sombra
    const c0 = CACHE[name].c, fl = 1.3;
    ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) { const a = cam.p([c0[0] + i * fl / 4, 0, c0[2] - fl]), b = cam.p([c0[0] + i * fl / 4, 0, c0[2] + fl]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const e = cam.p([c0[0] - fl, 0, c0[2] + i * fl / 4]), f = cam.p([c0[0] + fl, 0, c0[2] + i * fl / 4]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(f.x, f.y); ctx.stroke(); }
    const sc = cam.p([J.pelvis[0], 0, J.pelvis[2] + 0.05]), sr = 0.42 * sc.s;
    const sg = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, sr); sg.addColorStop(0, pal.shadow); sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.translate(sc.x, sc.y); ctx.scale(1, 0.38); ctx.translate(-sc.x, -sc.y); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sc.x, sc.y, sr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // primitivas, do fundo pra frente
    const prims = [];
    propPrims(J, def.props, prims);
    bodyPrims(J, def.hl || [], prims);
    prims.forEach((p) => {
      const c = p.t === "cap" || p.t === "line" ? mul(add(p.a, p.b), 0.5) : p.c;
      p.z = dot(sub(c, cam.eye), cam.fwd) - (p.k ? 0.03 : 0) + (p.t === "box" ? 0.06 : 0);
    });
    prims.sort((a, b) => b.z - a.z);
    for (const p of prims) {
      if (p.t === "cap") drawCap(ctx, cam, p, pal);
      else if (p.t === "sph") { const q = cam.p(p.c); drawSph(ctx, { x: q.x, y: q.y, r: p.r * q.s }, pal[p.col] || pal.skin); }
      else if (p.t === "box") drawBox(ctx, cam, p, pal);
      else if (p.t === "disc") drawDisc(ctx, cam, p, pal);
      else if (p.t === "line") { const a = cam.p(p.a), b = cam.p(p.b); ctx.strokeStyle = pal.cable; ctx.lineWidth = Math.max(1, 0.008 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
  }

  // ============================================================
  //  Movimentos (quadro 0 = início, quadro 1 = fim)
  // ============================================================
  const SEAT = (z, back, y) => ({ k: "seat", c: [0, y || 0.47, z || 0], back });
  const ANIM3 = {
    parado: { hl: [], frames: [{}] },
    agachamento: { hl: ["quad", "glute"], az: 62, props: [{ k: "bar", l: 0.8 }],
      frames: [{ P: [0, 0.95, 0], HP: [0, 9], S: [-30, 85, 60], E: 150, T: 4 }, { P: [0, 0.5, -0.24], HP: [88, 14], K: 112, T: 34, H: -20, S: [-30, 85, 60], E: 150 }] },
    legpress: { hl: ["quad", "glute"], az: 72, el: 12, props: [{ k: "box", c: [0, 0.32, -0.12], s: [0.42, 0.08, 0.5], col: "pad" }, { k: "pad", frame: "Mt", off: [0, 0.32, -0.16], s: [0.42, 0.7, 0.07] }, { k: "footplate" }, { k: "box", c: [0, 0.16, -0.1], s: [0.1, 0.32, 0.1], col: "metal" }],
      frames: [{ P: [0, 0.42, 0], R: [-52, 0, 0], HP: [128, 12], K: 112, A: 20, S: [30, 22], E: 20 }, { P: [0, 0.42, 0], R: [-52, 0, 0], HP: [78, 12], K: 12, A: 64, S: [30, 22], E: 20 }] },
    extensora: { hl: ["quad"], az: 70, props: [SEAT(0, 8), { k: "roller", at: "an", off: [0, 0, 0.07] }],
      frames: [{ P: [0, 0.56, 0], T: -6, HP: [90, 5], K: 88, A: 0, S: [8, 18], E: 20 }, { P: [0, 0.56, 0], T: -6, HP: [90, 5], K: 4, A: 70, S: [8, 18], E: 20 }] },
    flexora: { hl: ["post"], az: 70, props: [SEAT(0, 14), { k: "roller", at: "an", off: [0, 0, -0.07] }, { k: "roller", at: "kn", off: [0, 0.08, 0] }],
      frames: [{ P: [0, 0.56, 0], T: -10, HP: [88, 5], K: 2, A: 70, S: [8, 18], E: 20 }, { P: [0, 0.56, 0], T: -10, HP: [88, 5], K: 92, A: 0, S: [8, 18], E: 20 }] },
    mesaflexora: { hl: ["post"], az: 76, el: 20, props: [{ k: "bench", c: [0, 0.66, 0.15], l: 1.5, w: 0.36 }, { k: "roller", at: "an", off: [0, 0.06, 0] }],
      frames: [{ P: [0, 0.78, -0.1], R: [90, 0, 0], HP: [-4, 4], K: 0, A: 90, S: [165, 18], E: 20, H: -25 }, { P: [0, 0.78, -0.1], R: [90, 0, 0], HP: [-4, 4], K: 100, A: 60, S: [165, 18], E: 20, H: -25 }] },
    stiff: { hl: ["post", "glute"], az: 74, props: [{ k: "db", axis: [1, 0, 0] }],
      frames: [{ P: [0, 0.94, 0], T: 2, K: 8, HP: [0, 6], S: [0, 4], E: 4 }, { P: [0, 0.9, -0.12], T: 78, K: 14, HP: [0, 6], S: [76, 4], E: 4, H: -50 }] },
    terra: { hl: ["post", "glute", "lombar"], az: 70, props: [{ k: "bar", l: 0.8 }],
      frames: [{ P: [0, 0.94, 0], T: 2, K: 6, HP: [0, 8], S: [0, 12], E: 4 }, { P: [0, 0.88, -0.14], T: 76, K: 18, HP: [0, 8], S: [74, 12], E: 4, H: -48 }] },
    afundo: { hl: ["quad", "glute"], az: 80, props: [{ k: "db", axis: [0, 0, 1] }],
      frames: [{ P: [0, 0.92, 0], HL: [22, 4], KL: 4, HR: [-16, 4], KR: 8, AR: -18, S: [0, 6], E: 4 }, { P: [0, 0.57, 0.02], HL: [80, 4], KL: 88, HR: [-12, 4], KR: 96, AR: -55, S: [0, 6], E: 4, T: 4 }] },
    sentar: { hl: ["quad", "glute"], az: 68, props: [{ k: "chair", c: [0, 0.46, -0.24] }],
      frames: [{ P: [0, 0.55, -0.18], T: 26, HP: [90, 8], K: 90, S: [55, -12], E: 130, H: -10 }, { P: [0, 0.95, 0.24], T: 2, HP: [0, 8], K: 0, S: [55, -12], E: 130 }] },
    step: { hl: ["quad", "glute"], az: 68, props: [{ k: "box", c: [0, 0.09, 0.28], s: [0.5, 0.18, 0.36], col: "pad" }, { k: "box", c: [0.42, 0.55, 0.15], s: [0.05, 1.1, 0.05], col: "metal" }],
      frames: [{ P: [0, 0.97, 0], HL: [62, 4], KL: 82, HR: [0, 4], KR: 0, SL: [20, 30], EL: 50, AL: 0 }, { P: [0, 1.13, 0.22], HL: [8, 4], KL: 6, HR: [-10, 4], KR: 30, AR: -25, SL: [20, 30], EL: 50, T: 4 }] },
    panturrilha: { hl: ["calf"], az: 70, props: [{ k: "box", c: [0, 0.5, 0.42], s: [0.6, 1.0, 0.06], col: "metal" }],
      frames: [{ P: [0, 0.95, 0], S: [52, 12], E: 30, A: 0 }, { P: [0, 1.03, 0], S: [52, 12], E: 38, A: -32 }] },
    pantsentado: { hl: ["calf"], az: 68, props: [SEAT(0, false), { k: "roller", at: "kn", off: [0, 0.07, 0] }, { k: "box", c: [0, 0.08, 0.42], s: [0.4, 0.06, 0.18], col: "metal" }],
      frames: [{ P: [0, 0.55, 0], HP: [90, 6], K: 88, A: 18, S: [30, 12], E: 40 }, { P: [0, 0.55, 0], HP: [86, 6], K: 92, A: -24, S: [30, 12], E: 40 }] },
    equilibrio: { hl: ["glute", "quad"], az: 40, props: [{ k: "box", c: [0.48, 0.55, 0], s: [0.05, 1.1, 0.05], col: "metal" }],
      frames: [{ P: [0, 0.95, 0], SL: [10, 30], EL: 30 }, { P: [0.02, 0.95, 0], SL: [10, 30], EL: 30, HR: [32, 2], KR: 72, TS: -2 }] },
    marcha: { hl: ["quad"], az: 50, props: [{ k: "box", c: [0.48, 0.55, 0], s: [0.05, 1.1, 0.05], col: "metal" }],
      frames: [{ P: [0, 0.95, 0], HL: [55, 3], KL: 70, SL: [10, 30], EL: 30, SR: [-20, 6], ER: 30 }, { P: [0, 0.95, 0], HR: [55, 3], KR: 70, SL: [10, 30], EL: 30, SR: [25, 6], ER: 30 }] },
    caminhada: { hl: ["glutmed"], az: 20, props: [{ k: "box", c: [0, 0.55, 0.5], s: [1.4, 0.05, 0.05], col: "metal" }],
      frames: [{ P: [-0.06, 0.95, 0], HL: [0, 3], HR: [0, 14], S: [40, 12], E: 30 }, { P: [0.06, 0.95, 0], HL: [0, 14], HR: [0, 3], S: [40, 12], E: 30 }] },
    tandem: { hl: ["glutmed", "calf"], az: 70, props: [{ k: "box", c: [-0.5, 0.5, 0], s: [0.05, 1.0, 1.6], col: "prop" }],
      frames: [{ P: [0, 0.95, -0.12], HL: [16, 1], KL: 2, HR: [-14, -1], KR: 10, AR: -10, S: [8, 30], E: 20 }, { P: [0, 0.95, 0.12], HR: [16, 1], KR: 2, HL: [-14, -1], KL: 10, AL: -10, S: [8, 30], E: 20 }] },
    abdutora: { hl: ["glutmed"], az: 22, el: 18, props: [SEAT(0, 14), { k: "roller", at: "kn", off: [0, 0.02, 0] }],
      frames: [{ P: [0, 0.56, 0], T: -10, HP: [88, 4], K: 88, A: 0, S: [8, 20], E: 20 }, { P: [0, 0.56, 0], T: -10, HP: [88, 32], K: 88, A: 0, S: [8, 20], E: 20 }] },
    supino: { hl: ["peito", "triceps"], az: 62, el: 22, props: [{ k: "bench", c: [0, 0.48, -0.25], l: 1.25, w: 0.32 }, { k: "bar", l: 0.85 }],
      frames: [{ P: [0, 0.6, 0.2], R: [-90, 0, 0], HP: [-8, 14], K: 88, A: -90, S: [90, 12], E: 2 }, { P: [0, 0.6, 0.2], R: [-90, 0, 0], HP: [-8, 14], K: 88, A: -90, S: [30, 62, 70], E: 92 }] },
    supinoinc: { hl: ["peito", "delt"], az: 64, el: 18, props: [{ k: "box", c: [0, 0.45, 0.02], s: [0.32, 0.07, 0.38], col: "pad" }, { k: "pad", frame: "Mt", off: [0, 0.32, -0.14], s: [0.34, 0.7, 0.06] }, { k: "db", axis: [1, 0, 0] }],
      frames: [{ P: [0, 0.57, 0.02], R: [-40, 0, 0], HP: [50, 14], K: 50, A: -40, S: [92, 10], E: 2 }, { P: [0, 0.57, 0.02], R: [-40, 0, 0], HP: [50, 14], K: 50, A: -40, S: [30, 62, 70], E: 92 }] },
    supinoincmaq: { hl: ["peito", "delt"], az: 64, props: [SEAT(0, 30), { k: "handles" }],
      frames: [{ P: [0, 0.56, 0], T: -28, HP: [90, 8], K: 88, S: [42, 55, 70], E: 92 }, { P: [0, 0.56, 0], T: -28, HP: [90, 8], K: 88, S: [118, 14], E: 6 }] },
    supinomaq: { hl: ["peito", "triceps"], az: 64, props: [SEAT(0, 8), { k: "handles" }],
      frames: [{ P: [0, 0.56, 0], T: -4, HP: [90, 8], K: 88, S: [20, 62, 75], E: 92 }, { P: [0, 0.56, 0], T: -4, HP: [90, 8], K: 88, S: [86, 14], E: 6 }] },
    voador: { hl: ["peito"], az: 30, el: 20, props: [SEAT(0, 8), { k: "handles" }],
      frames: [{ P: [0, 0.56, 0], T: -4, HP: [90, 8], K: 88, S: [4, 84, 0], E: 18 }, { P: [0, 0.56, 0], T: -4, HP: [90, 8], K: 88, S: [84, 12, 0], E: 18 }] },
    remadabaixa: { hl: ["costas", "biceps"], az: 72, props: [{ k: "box", c: [0, 0.2, -0.05], s: [0.32, 0.08, 0.7], col: "pad" }, { k: "box", c: [0, 0.18, 0.62], s: [0.4, 0.3, 0.05], col: "metal" }, { k: "cable", both: true, to: [0, 0.32, 0.9] }, { k: "handles" }],
      frames: [{ P: [0, 0.32, 0], T: 20, HP: [80, 8], K: 26, A: 75, S: [78, 8], E: 2 }, { P: [0, 0.32, 0], T: -6, HP: [80, 8], K: 26, A: 75, S: [-20, 18], E: 100 }] },
    remadamaq: { hl: ["costas", "biceps"], az: 72, props: [SEAT(0, false), { k: "pad", frame: "M0", off: [0, 0.32, 0.22], s: [0.3, 0.32, 0.06] }, { k: "handles" }],
      frames: [{ P: [0, 0.56, 0], T: 6, HP: [90, 8], K: 88, S: [84, 10], E: 2 }, { P: [0, 0.56, 0], T: 2, HP: [90, 8], K: 88, S: [-12, 22], E: 100 }] },
    remadauni: { hl: ["costas", "biceps"], az: 80, props: [{ k: "bench", c: [0.18, 0.5, 0.18], l: 1.0, w: 0.3 }, { k: "db", only: "R", axis: [0, 0, 1] }],
      frames: [{ P: [-0.05, 0.92, -0.1], T: 74, HL: [0, 4], KL: 12, HR: [0, 4], KR: 10, SL: [76, 6], EL: 4, SR: [74, 6], ER: 2, H: -40 }, { P: [-0.05, 0.92, -0.1], T: 74, HL: [0, 4], KL: 12, HR: [0, 4], KR: 10, SL: [76, 6], EL: 4, SR: [6, 16], ER: 96, H: -40 }] },
    puxada: { hl: ["costas", "biceps"], az: 32, el: 6, props: [SEAT(0, false), { k: "roller", at: "kn", off: [0, 0.08, 0] }, { k: "bar", l: 0.65, plates: false }, { k: "cable", both: true, to: [0, 2.15, 0.06] }],
      frames: [{ P: [0, 0.56, 0], T: -10, HP: [90, 8], K: 88, S: [0, 158, 0], E: 12 }, { P: [0, 0.56, 0], T: -16, HP: [90, 8], K: 88, S: [0, 48, 90], E: 118 }] },
    desenvolvimento: { hl: ["delt", "triceps"], az: 26, el: 10, props: [SEAT(0, 6), { k: "db", axis: [0, 0, 1] }],
      frames: [{ P: [0, 0.56, 0], HP: [90, 8], K: 88, S: [8, 86, 88], E: 92 }, { P: [0, 0.56, 0], HP: [90, 8], K: 88, S: [8, 164, 88], E: 12 }] },
    desenvmaq: { hl: ["delt", "triceps"], az: 26, el: 10, props: [SEAT(0, 6), { k: "handles" }],
      frames: [{ P: [0, 0.56, 0], HP: [90, 8], K: 88, S: [8, 86, 88], E: 92 }, { P: [0, 0.56, 0], HP: [90, 8], K: 88, S: [8, 164, 88], E: 12 }] },
    elevacao: { hl: ["delt"], az: 20, el: 8, props: [{ k: "db", axis: [0, 0, 1] }],
      frames: [{ P: [0, 0.95, 0], S: [6, 8], E: 14, T: 3 }, { P: [0, 0.95, 0], S: [6, 84], E: 18, T: 3 }] },
    facepull: { hl: ["delt", "costas"], az: 58, el: 10, props: [{ k: "cable", both: true, to: [0, 1.5, 0.95], rope: true }],
      frames: [{ P: [0, 0.95, 0], T: -4, S: [86, 10], E: 4 }, { P: [0, 0.95, 0], T: -4, S: [18, 84, 82], E: 100 }] },
    crucinverso: { hl: ["delt", "costas"], az: 20, el: 26, props: [SEAT(0, false), { k: "pad", frame: "M0", off: [0, 0.34, 0.2], s: [0.3, 0.38, 0.06] }, { k: "handles" }],
      frames: [{ P: [0, 0.56, 0], T: 4, HP: [90, 8], K: 88, S: [86, 10, 0], E: 12 }, { P: [0, 0.56, 0], T: 4, HP: [90, 8], K: 88, S: [10, 86, 0], E: 12 }] },
    rosca: { hl: ["biceps"], az: 62, props: [{ k: "bar", l: 0.6, pr: 0.12 }],
      frames: [{ P: [0, 0.95, 0], S: [4, 10], E: 6 }, { P: [0, 0.95, 0], S: [10, 10], E: 136 }] },
    roscasentado: { hl: ["biceps"], az: 58, props: [SEAT(0, 6), { k: "db", axis: [1, 0, 0] }],
      frames: [{ P: [0, 0.56, 0], HP: [90, 8], K: 88, S: [2, 12], E: 6 }, { P: [0, 0.56, 0], HP: [90, 8], K: 88, S: [8, 12], E: 136 }] },
    martelo: { hl: ["biceps"], az: 58, props: [{ k: "db", axis: [0, 0, 1] }],
      frames: [{ P: [0, 0.95, 0], S: [2, 8], E: 6 }, { P: [0, 0.95, 0], S: [8, 8], E: 132 }] },
    roscamaq: { hl: ["biceps"], az: 70, props: [SEAT(-0.05, false), { k: "pad", frame: "M0", off: [0, 0.32, 0.26], s: [0.4, 0.06, 0.3] }, { k: "bar", l: 0.4, plates: false }],
      frames: [{ P: [0, 0.56, -0.05], T: 18, HP: [90, 8], K: 88, S: [62, 14], E: 10 }, { P: [0, 0.56, -0.05], T: 18, HP: [90, 8], K: 88, S: [62, 14], E: 128 }] },
    triceps: { hl: ["triceps"], az: 62, props: [{ k: "cable", both: true, to: [0, 2.05, 0.32] }, { k: "bar", l: 0.22, plates: false }],
      frames: [{ P: [0, 0.95, 0], T: 10, S: [18, 6], E: 112 }, { P: [0, 0.95, 0], T: 10, S: [12, 6], E: 4 }] },
    francespolia: { hl: ["triceps"], az: 66, props: [{ k: "cable", both: true, to: [0, 0.45, -0.5], rope: true }],
      frames: [{ P: [0, 0.95, 0], T: 26, HL: [20, 4], KL: 14, HR: [-12, 4], KR: 10, S: [158, 10], E: 128 }, { P: [0, 0.95, 0], T: 26, HL: [20, 4], KL: 14, HR: [-12, 4], KR: 10, S: [158, 10], E: 8 }] },
    prancha: { hl: ["abdomen"], az: 70, el: 18, dur: 3.2,
      frames: [{ P: [0, 0.34, 0], R: [92, 0, 0], S: [88, 10], E: 92, K: 0, A: 88, H: -10 }, { P: [0, 0.36, 0], R: [90, 0, 0], S: [86, 10], E: 92, K: 0, A: 88, H: -10 }] },
    abdpolia: { hl: ["abdomen"], az: 66, props: [{ k: "cable", both: true, to: [0, 2.05, 0.42], rope: true }, { k: "box", c: [0, 0.03, -0.15], s: [0.5, 0.06, 0.55], col: "pad" }],
      frames: [{ P: [0, 0.54, 0], HP: [4, 8], K: 92, A: -88, T: 10, S: [150, 24, 0], E: 128 }, { P: [0, 0.54, 0], HP: [12, 8], K: 92, A: -88, T: 70, S: [150, 24, 0], E: 128, H: -20 }] },
    hack: { hl: ["quad", "glute"], az: 70, props: [{ k: "pad", frame: "Mt", off: [0, 0.32, -0.14], s: [0.4, 0.75, 0.06] }, { k: "box", c: [0, 0.03, 0.12], s: [0.6, 0.06, 0.5], col: "metal" }],
      frames: [{ P: [0, 0.98, -0.05], T: -14, HP: [8, 12], K: 10, S: [20, 30], E: 120 }, { P: [0, 0.56, -0.3], T: -14, HP: [90, 14], K: 104, S: [20, 30], E: 120 }] },
  };
  // nomes da biblioteca que reaproveitam movimentos
  window.FIG3D = { draw, ANIM3, solve, expand, has: (n) => !!ANIM3[n] };
})();
