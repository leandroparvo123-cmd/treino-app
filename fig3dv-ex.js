// ============================================================
//  Movimentos do boneco 3D v2 (um por exercício).
//  Direções no mundo: o boneco olha pra +Z, o lado esquerdo dele é +X, Y pra cima.
//  arms/legs valem pro lado esquerdo e são espelhados pro direito (armL/armR, legL/legR pra lados diferentes).
//  palm = pra onde a palma da mão aponta. hl.main = músculo principal (vermelho), hl.help = músculos que ajudam.
// ============================================================
(function () {
  "use strict";
  const X = window.FIG3DV; if (!X) return;
  const E = X.EX;

  // ---------- peças comuns ----------
  const LEG_SIT = { th: [0.2, -0.04, 1], sh: [0.08, -1, 0.14], ft: [0.12, -0.35, 1] };
  const LEG_STAND = { th: [0.08, -1, 0.02], sh: [0.04, -1, 0.0], ft: [0.16, -0.3, 1] };
  const LEG_SOFT = { th: [0.08, -1, -0.05], sh: [0.04, -1, 0.07], ft: [0.16, -0.3, 1] };
  const HANG = { up: [0.12, -1, 0.02], fo: [0.1, -1, 0.06], palm: [-1, 0, 0], grip: 0.35 };
  const rot = (v, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }; // gira em X (inclina pra frente)
  const flip = (f) => { const o = { ...f }; const m = (a) => a && [-a[0], a[1], a[2]]; const ma = (a) => a && { ...a, sh: m(a.sh), up: m(a.up), fo: m(a.fo), palm: m(a.palm), wrist: m(a.wrist), elbow: m(a.elbow) }; const ml = (g) => g && { ...g, th: m(g.th), sh: m(g.sh), ft: m(g.ft), knee: m(g.knee) };
    o.armL = ma(f.armR); o.armR = ma(f.armL); o.legL = ml(f.legR); o.legR = ml(f.legL); return o; };
  // assento sob o quadril (na pose de começo)
  const seatUnder = (k, o) => { const h = k.bp("Hips"); k.seat([0, h.y - (o && o.drop || 0.1), h.z + (o && o.dz != null ? o.dz : 0.1)], o); return h; };
  // halteres seguindo as mãos
  const twoDB = (k, len) => { const a = k.dumbbell(len), b = k.dumbbell(len); return () => { k.placeInHand(a, "Left"); k.placeInHand(b, "Right"); }; };
  const barHands = (k, len, plates, out) => { const bar = k.barbell(len, plates); return () => { const a = k.handP("Left"), b = k.handP("Right"); k.placeBetween(bar, a.c.addScaledVector(a.palm, out || 0), b.c.addScaledVector(b.palm, out || 0)); }; };
  const cableTo = (k, from, anchor) => { const c = k.rodMesh("cable"); return () => k.rod(c, from(), anchor, 0.006); };
  const midHands = (k) => () => k.handP("Left").c.add(k.handP("Right").c).multiplyScalar(0.5);

  // ============================================================
  //  OMBRO
  // ============================================================
  E.desenvolvimento = {
    hl: { main: ["deltF", "deltL"], help: ["triceps", "peitoSup", "trap"] }, yaw: 28, pitch: 6,
    frames: [
      { rot: [-10, 0, 0], spine: [0, 1, -0.12], chest: [0, 1, -0.15], legs: LEG_SIT, arms: { up: [0.93, -0.08, 0.3], fo: [0.04, 1, 0.03], palm: [0, 0, 1] } },
      { rot: [-10, 0, 0], spine: [0, 1, -0.12], chest: [0, 1, -0.15], legs: LEG_SIT, arms: { up: [0.36, 0.93, 0.06], fo: [-0.13, 1, 0.02], palm: [0, 0, 1] } },
    ],
    build: (k) => { seatUnder(k, { back: 10, backL: 0.85 }); return twoDB(k); },
  };

  // ============================================================
  //  BÍCEPS
  // ============================================================
  E.rosca = {
    hl: { main: ["biceps"], help: ["antebraco", "deltF"] }, yaw: 40,
    frames: [
      { legs: LEG_SOFT, arms: { up: [0.12, -1, 0.02], fo: [0.1, -1, 0.06], palm: [0, 0.06, 1] } },
      { legs: LEG_SOFT, arms: { up: [0.1, -1, 0.14], fo: [0.06, 0.9, 0.45], palm: [0, 0.45, -0.9] } },
    ],
    build: (k) => barHands(k, 1.2, 0.11),
  };

  // ============================================================
  //  PERNAS
  // ============================================================
  E.agachamento = {
    hl: { main: ["quad", "gluteo"], help: ["adutor", "post", "lombar"] }, yaw: 58, pitch: 6,
    frames: [
      { legs: { th: [0.12, -1, 0.02], sh: [0.06, -1, 0.0], ft: [0.22, -0.3, 1] }, face: [0, 0, 1],
        arms: { up: [0.55, -0.6, -0.58], fo: [0.37, 0.85, 0.3], palm: [0, -0.3, 0.95] } },
      { rot: [36, 0, 0], legs: { th: [0.34, -0.26, 0.9], sh: [0.14, -0.88, 0.45], ft: [0.22, -0.3, 1] }, spine: rot([0, 1, 0], 36), face: [0, -0.15, 1],
        arms: { up: rot([0.55, -0.6, -0.58], 36), fo: rot([0.37, 0.85, 0.3], 36), palm: rot([0, -0.3, 0.95], 36) } },
    ],
    build: (k) => barHands(k, 1.6, true, -0.01),
  };

  E.legpress = {
    hl: { main: ["quad", "gluteo"], help: ["post", "adutor"] }, yaw: 68, pitch: 10,
    frames: [
      { ground: false, y: 0.5, rot: [-50, 0, 0], spine: rot([0, 1, 0], -50), face: [0, 0.5, 1],
        legs: { th: [0.22, 0.9, 0.36], sh: [0.08, -0.12, 0.99], ft: [0.1, 0.7, -0.7] }, arms: { up: [0.3, -0.85, 0.45], fo: [0.1, -0.6, 0.8], palm: [-1, 0, 0] } },
      { ground: false, y: 0.5, rot: [-50, 0, 0], spine: rot([0, 1, 0], -50), face: [0, 0.5, 1],
        legs: { th: [0.18, 0.66, 0.73], sh: [0.1, 0.64, 0.76], ft: [0.1, 0.7, -0.7] }, arms: { up: [0.3, -0.85, 0.45], fo: [0.1, -0.6, 0.8], palm: [-1, 0, 0] } },
    ],
    build: (k) => {
      const h = k.bp("Hips");
      k.box([0, h.y - 0.13, h.z + 0.05], [0.46, 0.08, 0.46], "pad", [-12, 0, 0]);               // assento
      k.box([0, h.y + 0.22, h.z - 0.3], [0.44, 0.75, 0.08], "pad", [-50, 0, 0]);                 // encosto
      k.box([0, 0.12, h.z - 0.1], [0.42, 0.24, 0.62], "frame");                                  // base
      const R = k.V(0, 0.7, 0.71).normalize(), dn = k.V(0, -R.z, R.y).multiplyScalar(-1);          // trilho: ao longo do caminho da plataforma, por baixo
      const f0 = k.bp("LeftFoot").add(k.bp("RightFoot")).multiplyScalar(0.5);
      for (const s of [-1, 1]) { const a = f0.clone().addScaledVector(dn, 0.2).addScaledVector(R, -0.05).setX(s * 0.24); k.cyl(a, a.clone().addScaledVector(R, 0.95), 0.022, "chrome"); }
      k.cyl([0, 0.24, h.z + 0.15], f0.clone().addScaledVector(dn, 0.2).setX(0), 0.03, "frame");
      const plate = k.box([0, 0, 0], [0.62, 0.62, 0.05], "frame");
      const sled = k.cyl([0, 0, 0], [0, 1, 0], 0.03, "metal");
      return () => {
        const a = k.bp("LeftFoot").add(k.bp("LeftToeBase")).multiplyScalar(0.5), b = k.bp("RightFoot").add(k.bp("RightToeBase")).multiplyScalar(0.5), c = a.add(b).multiplyScalar(0.5);
        c.addScaledVector(R, 0.06); plate.position.copy(c); plate.quaternion.setFromUnitVectors(k.V(0, 0, 1), R);
        k.rod(sled, k.V(0.32, c.y - 0.05, c.z - 0.06), k.V(-0.32, c.y - 0.05, c.z - 0.06), 0.03);
      };
    },
  };

  E.mesaflexora = {
    hl: { main: ["post"], help: ["calf", "gluteo"] }, yaw: 72, pitch: 16,
    frames: [
      { ground: false, y: 0.78, rot: [90, 0, 0], spine: [0, 0.06, 1], face: [0, -0.6, 0.8], front: [0, -1, 0],
        legs: { th: [0.06, -0.06, -1], sh: [0.03, -0.06, -1], ft: [0, -0.9, -0.4], knee: [0, -1, 0] }, arms: { up: [0.45, -0.85, 0.3], fo: [0.1, -0.2, 1], palm: [0, -1, 0] } },
      { ground: false, y: 0.78, rot: [90, 0, 0], spine: [0, 0.06, 1], face: [0, -0.6, 0.8], front: [0, -1, 0],
        legs: { th: [0.06, -0.06, -1], sh: [0.03, 0.94, -0.33], ft: [0, 0.3, -0.95], knee: [0, -1, 0] }, arms: { up: [0.45, -0.85, 0.3], fo: [0.1, -0.2, 1], palm: [0, -1, 0] } },
    ],
    build: (k) => {
      const h = k.bp("Hips"), kn = k.bp("LeftLeg");
      k.bench([0, h.y - 0.11, (kn.z + k.bp("Head").z) / 2 + 0.02], { l: k.bp("Head").z - kn.z + 0.05, w: 0.36 });
      const roller = k.cyl([0, 0, 0], [0, 1, 0], 0.045, "pad"), lever = k.rodMesh("frame"), piv = k.V(0.26, kn.y, kn.z);
      return () => {
        const a = k.bp("LeftFoot"), sd = a.clone().sub(k.bp("LeftLeg")).normalize(), back = k.V(0, 0, 0).crossVectors(k.V(1, 0, 0), sd).normalize();
        if (back.y < -0.2) back.negate();
        const c = a.addScaledVector(back, 0.065).addScaledVector(sd, -0.02); c.x = 0;
        k.rod(roller, k.V(-0.24, c.y, c.z), k.V(0.24, c.y, c.z), 0.045); k.rod(lever, k.V(0.26, c.y, c.z), piv, 0.02);
      };
    },
  };

  // ============================================================
  //  PEITO
  // ============================================================
  E.supino = {
    hl: { main: ["peito"], help: ["triceps", "deltF"] }, yaw: 52, pitch: 24,
    frames: [
      { ground: false, y: 0.56, rot: [-90, 0, 0], spine: [0, 0.05, -1], chest: [0, 0.12, -1], face: [0, 1, 0], front: [0, 1, 0],
        legs: { th: [0.25, -0.3, 0.92], sh: [0.06, -0.86, 0.5], ft: [0.12, -0.3, 1] }, arms: { up: [0.85, -0.25, 0.45], fo: [0.02, 1, 0.05], palm: [0, 0, 1] } },
      { ground: false, y: 0.56, rot: [-90, 0, 0], spine: [0, 0.05, -1], chest: [0, 0.12, -1], face: [0, 1, 0], front: [0, 1, 0],
        legs: { th: [0.25, -0.3, 0.92], sh: [0.06, -0.86, 0.5], ft: [0.12, -0.3, 1] }, arms: { up: [0.32, 0.94, 0.12], fo: [0.12, 1, 0.04], palm: [0, 0, 1] } },
    ],
    build: (k) => {
      const h = k.bp("Hips"), hd = k.bp("Head");
      k.bench([0, 0.45, (h.z + hd.z) / 2 - 0.05], { l: 1.25, w: 0.3 });
      for (const s of [-1, 1]) { k.cyl([s * 0.5, 0, hd.z - 0.12], [s * 0.5, 1.15, hd.z - 0.12], 0.025, "frame"); k.box([s * 0.5, 0.02, hd.z - 0.12], [0.08, 0.04, 0.5], "frame"); k.box([s * 0.5, 1.08, hd.z - 0.06], [0.04, 0.04, 0.12], "metal"); }
      return barHands(k, 1.6, true);
    },
  };

  // ---------- aparelhos de alavanca: pegador em cada mão + braço até o eixo ----------
  const levers = (k, piv, o) => {
    o = o || {};
    const parts = ["Left", "Right"].map((S, i) => ({ S, h: k.rodMesh("chrome"), lv: k.rodMesh("frame"), p: k.V(i ? -piv[0] : piv[0], piv[1], piv[2]) }));
    return () => parts.forEach((q) => {
      const hp = k.handP(q.S), L = o.len || 0.075, a = hp.c.clone().addScaledVector(hp.across, -L), b = hp.c.clone().addScaledVector(hp.across, L);
      k.rod(q.h, a, b, 0.019); k.rod(q.lv, a.distanceTo(q.p) < b.distanceTo(q.p) ? a : b, q.p, 0.022);
    });
  };
  const all = (...fs) => () => fs.forEach((f) => f && f());
  const sh0 = (k) => k.bp("LeftArm"), hip0 = (k) => k.bp("Hips");
  // barra de apoio na frente (idosos)
  const railFront = (k, z, y, w) => { w = w || 0.9; k.cyl([-w / 2, y, z], [w / 2, y, z], 0.02, "chrome"); for (const s of [-1, 1]) { k.cyl([s * w / 2, 0, z], [s * w / 2, y, z], 0.025, "frame"); k.box([s * w / 2, 0.02, z], [0.08, 0.04, 0.4], "frame"); } };
  const railSide = (k, x, y, z, L) => { L = L || 1.2; k.cyl([x, y, z - L / 2], [x, y, z + L / 2], 0.02, "chrome"); for (const s of [-1, 1]) { k.cyl([x, 0, z + s * L / 2], [x, y, z + s * L / 2], 0.025, "frame"); k.box([x, 0.02, z + s * L / 2], [0.4, 0.04, 0.08], "frame"); } };
  const rope = (k) => { const a = k.rodMesh("rope"), b = k.rodMesh("rope"), c = k.rodMesh("cable"); return (anchor, ahead) => { const l = k.handP("Left").c, r = k.handP("Right").c, m = l.clone().add(r).multiplyScalar(0.5).addScaledVector(ahead, 0.1); k.rod(a, l, m, 0.012); k.rod(b, r, m, 0.012); k.rod(c, m, anchor, 0.006); }; };

  // ============================================================
  //  OMBRO (continua)
  // ============================================================
  E.desenvmaq = {
    hl: { main: ["deltF", "deltL"], help: ["triceps", "trap"] }, yaw: 32, pitch: 6,
    frames: [
      { rot: [-6, 0, 0], legs: LEG_SIT, arms: { up: [0.9, -0.15, 0.35], fo: [0.05, 1, 0.08], palm: [0, 0, 1] } },
      { rot: [-6, 0, 0], legs: LEG_SIT, arms: { up: [0.4, 0.9, 0.16], fo: [0.0, 1, 0.1], palm: [0, 0, 1] } },
    ],
    build: (k) => { const h = seatUnder(k, { back: 6, backL: 0.9 }), s = sh0(k); k.tower([0, 0, h.z - 0.5], 2.0); return levers(k, [0.3, s.y + 0.05, h.z - 0.42]); },
  };
  E.elevacao = {
    hl: { main: ["deltL"], help: ["deltF", "trap"] }, yaw: 16, pitch: 6,
    frames: [
      { legs: LEG_SOFT, arms: { up: [0.16, -1, 0.06], fo: [0.2, -1, 0.15], palm: [-1, 0, 0.1] } },
      { legs: LEG_SOFT, arms: { up: [1, 0.06, 0.16], fo: [1, 0.04, 0.26], palm: [0, -1, 0] } },
    ],
    build: (k) => twoDB(k),
  };
  E.crucinverso = {
    hl: { main: ["deltP"], help: ["trap", "costas"] }, yaw: -145, pitch: 16,
    frames: [
      { legs: LEG_SIT, arms: { up: [0.32, 0.0, 0.95], fo: [-0.12, 0, 1], palm: [-1, 0, 0] } },
      { legs: LEG_SIT, arms: { up: [0.98, 0.05, -0.12], fo: [0.97, 0.0, 0.22], palm: [0, 0, 1] } },
    ],
    build: (k) => { const h = seatUnder(k, { dz: 0.06 }), c = k.bp("Spine2"), s = sh0(k); k.box([0, c.y - 0.08, c.z + 0.17], [0.36, 0.62, 0.08], "pad"); k.cyl([0, h.y - 0.2, c.z + 0.22], [0, c.y - 0.3, c.z + 0.22], 0.03, "frame"); k.tower([0, 0, c.z + 0.7], 2.1); return levers(k, [0.16, s.y + 0.42, s.z + 0.08]); },
  };
  E.facepull = {
    hl: { main: ["deltP"], help: ["trap", "costas"] }, yaw: -38, pitch: 6,
    frames: [
      { legs: LEG_SOFT, arms: { up: [0.2, 0.08, 0.97], fo: [0.08, 0.05, 1], palm: [-1, 0, 0] } },
      { legs: LEG_SOFT, arms: { up: [0.95, 0.12, -0.28], fo: [0.12, 0.85, 0.5], palm: [-0.5, 0, 0.86] } },
    ],
    build: (k) => { const hz = k.handP("Left").c.z, P = k.V(0, 1.6, hz + 0.7); k.tower([0, 0, P.z + 0.07], 2.15); k.pulley([0, P.y, P.z]); const r = rope(k); return () => r(P, k.V(0, 0, 1)); },
  };

  // ============================================================
  //  BRAÇOS (continua)
  // ============================================================
  E.martelo = {
    hl: { main: ["biceps", "antebraco"], help: [] }, yaw: 38,
    frames: [
      { legs: LEG_SOFT, arms: { up: [0.14, -1, 0.02], fo: [0.12, -1, 0.06], palm: [-1, 0, 0] } },
      { legs: LEG_SOFT, arms: { up: [0.12, -1, 0.14], fo: [0.08, 0.9, 0.45], palm: [-1, 0, 0] } },
    ],
    build: (k) => twoDB(k),
  };
  E.roscasentado = {
    hl: { main: ["biceps"], help: ["antebraco"] }, yaw: 34,
    frames: [
      { legs: LEG_SIT, arms: { up: [0.2, -1, 0.02], fo: [0.18, -1, 0.06], palm: [0, 0.06, 1] } },
      { legs: LEG_SIT, arms: { up: [0.16, -1, 0.14], fo: [0.08, 0.9, 0.45], palm: [0, 0.45, -0.9] } },
    ],
    build: (k) => { seatUnder(k, {}); return twoDB(k); },
  };
  E.roscamaq = {
    hl: { main: ["biceps"], help: ["antebraco"] }, yaw: 58, pitch: 10,
    frames: [
      { rot: [10, 0, 0], legs: LEG_SIT, arms: { up: [0.18, -0.5, 0.85], fo: [0.12, -0.62, 0.78], palm: [0, 0.78, 0.62] } },
      { rot: [10, 0, 0], legs: LEG_SIT, arms: { up: [0.18, -0.5, 0.85], fo: [0.06, 0.8, 0.6], palm: [0, 0.6, -0.8] } },
    ],
    build: (k) => {
      seatUnder(k, { dz: 0.04 }); const S = k.bp("LeftArm"), Eb = k.bp("LeftForeArm");
      k.box([0, (S.y + Eb.y) / 2 - 0.075, (S.z + Eb.z) / 2 + 0.02], [0.52, 0.06, 0.4], "pad", [30, 0, 0]);
      k.cyl([0, 0, Eb.z + 0.05], [0, (S.y + Eb.y) / 2 - 0.12, (S.z + Eb.z) / 2 + 0.06], 0.035, "frame"); k.box([0, 0.02, Eb.z + 0.05], [0.5, 0.04, 0.1], "frame");
      const bar = k.barbell(0.62, false), lv = [k.rodMesh("frame"), k.rodMesh("frame")], piv = (s) => k.V(s * 0.3, Eb.y - 0.03, Eb.z + 0.02);
      return () => { const a = k.handP("Left").c, b = k.handP("Right").c; k.placeBetween(bar, a, b); k.rod(lv[0], a.clone().setX(0.3), piv(1), 0.02); k.rod(lv[1], b.clone().setX(-0.3), piv(-1), 0.02); };
    },
  };
  E.triceps = {
    hl: { main: ["triceps"], help: ["antebraco"] }, yaw: 42, pitch: 6,
    frames: [
      { rot: [8, 0, 0], legs: LEG_SOFT, arms: { up: [0.12, -1, 0.12], fo: [0.06, 0.35, 0.94], palm: [0, -0.94, 0.35] } },
      { rot: [8, 0, 0], legs: LEG_SOFT, arms: { up: [0.12, -1, 0.1], fo: [0.05, -1, 0.1], palm: [0, -0.1, -1] } },
    ],
    build: (k) => { const z = k.handP("Left").c.z + 0.2, P = k.V(0, 2.05, z); k.tower([0, 0, z + 0.08], 2.15); k.pulley([0, P.y, P.z]); const bar = barHands(k, 0.5, false), c = cableTo(k, midHands(k), P); return all(bar, c); },
  };
  E.francespolia = {
    hl: { main: ["triceps"], help: [] }, yaw: 62, pitch: 6,
    frames: [
      { rot: [20, 0, 0], legs: { th: [0.1, -1, 0.05], sh: [0.05, -1, 0.03], ft: [0.16, -0.3, 1] }, arms: { up: [0.12, 0.82, 0.55], fo: [0.05, -0.55, -0.83], palm: [-1, 0, 0] } },
      { rot: [20, 0, 0], legs: { th: [0.1, -1, 0.05], sh: [0.05, -1, 0.03], ft: [0.16, -0.3, 1] }, arms: { up: [0.12, 0.82, 0.55], fo: [0.08, 0.78, 0.62], palm: [-1, 0, 0] } },
    ],
    build: (k) => { const h = hip0(k), P = k.V(0, 1.15, h.z - 0.75); k.tower([0, 0, P.z - 0.07], 2.1); k.pulley([0, P.y, P.z]); const r = rope(k); return () => r(P, k.V(0, -0.3, -1).normalize()); },
  };

  // ============================================================
  //  PEITO (continua)
  // ============================================================
  E.supinomaq = {
    hl: { main: ["peito"], help: ["triceps", "deltF"] }, yaw: 34, pitch: 8,
    frames: [
      { rot: [-8, 0, 0], legs: LEG_SIT, arms: { up: [0.8, -0.35, -0.45], fo: [0.12, 0.0, 1], palm: [-1, 0, 0] } },
      { rot: [-8, 0, 0], legs: LEG_SIT, arms: { up: [0.28, -0.1, 0.95], fo: [0.15, -0.05, 1], palm: [-1, 0, 0] } },
    ],
    build: (k) => { const h = seatUnder(k, { back: 8, backL: 0.9 }), s = sh0(k); k.tower([0, 0, h.z - 0.45], 2.05); return levers(k, [0.33, s.y + 0.48, s.z + 0.0]); },
  };
  E.supinoincmaq = {
    hl: { main: ["peitoSup", "peito"], help: ["deltF", "triceps"] }, yaw: 40, pitch: 8,
    frames: [
      { rot: [-22, 0, 0], legs: LEG_SIT, arms: { up: [0.82, -0.42, -0.36], fo: [0.1, 0.42, 0.9], palm: [-1, 0, 0] } },
      { rot: [-22, 0, 0], legs: LEG_SIT, arms: { up: [0.28, 0.42, 0.86], fo: [0.14, 0.46, 0.88], palm: [-1, 0, 0] } },
    ],
    build: (k) => { const h = seatUnder(k, { back: 22, backL: 0.9 }), s = sh0(k); k.tower([0, 0, h.z - 0.6], 2.05); return levers(k, [0.33, s.y + 0.55, s.z - 0.1]); },
  };
  E.supinoinc = {
    hl: { main: ["peitoSup", "peito"], help: ["deltF", "triceps"] }, yaw: 46, pitch: 16,
    frames: [
      { rot: [-55, 0, 0], legs: LEG_SIT, face: [0, 0.6, 0.8], arms: { up: [0.85, -0.42, 0.08], fo: [0.03, 0.82, 0.57], palm: [0, -0.57, 0.82] } },
      { rot: [-55, 0, 0], legs: LEG_SIT, face: [0, 0.6, 0.8], arms: { up: [0.25, 0.8, 0.55], fo: [0.12, 0.82, 0.57], palm: [0, -0.57, 0.82] } },
    ],
    build: (k) => { seatUnder(k, { back: 55, backL: 0.95, drop: 0.11, dz: 0.12 }); return twoDB(k); },
  };
  E.voador = {
    hl: { main: ["peito"], help: ["deltF"] }, yaw: 22, pitch: 10,
    frames: [
      { legs: LEG_SIT, arms: { up: [0.97, 0.02, -0.22], fo: [0.82, 0.0, 0.57], palm: [0, 0, 1] } },
      { legs: LEG_SIT, arms: { up: [0.4, 0.02, 0.92], fo: [-0.2, 0.0, 0.98], palm: [-1, 0, 0.15] } },
    ],
    build: (k) => { const h = seatUnder(k, { back: 0, backL: 0.9 }), s = sh0(k); k.tower([0, 0, h.z - 0.42], 2.1); return levers(k, [0.18, s.y + 0.4, s.z - 0.02]); },
  };

  // ============================================================
  //  COSTAS
  // ============================================================
  E.puxada = {
    hl: { main: ["costas"], help: ["biceps", "deltP", "trap"] }, yaw: -32, pitch: 4,
    frames: [
      { rot: [-12, 0, 0], legs: LEG_SIT, face: [0, 0.25, 1], arms: { up: [0.38, 0.92, 0.05], fo: [0.18, 1, 0.02], palm: [0, 0, 1] } },
      { rot: [-12, 0, 0], legs: LEG_SIT, face: [0, 0.15, 1], arms: { up: [0.88, -0.42, -0.2], fo: [0.12, 1, 0.08], palm: [0, 0, 1] } },
    ],
    build: (k) => {
      const h = seatUnder(k, { dz: 0.08 }), kn = k.bp("LeftLeg"), hz = k.handP("Left").c.z, P = k.V(0, 2.4, hz);
      k.cyl([-0.24, kn.y + 0.09, kn.z - 0.06], [0.24, kn.y + 0.09, kn.z - 0.06], 0.05, "pad"); k.cyl([0, h.y - 0.2, kn.z - 0.06], [0, kn.y + 0.05, kn.z - 0.06], 0.025, "frame");
      k.box([0, 1.25, h.z - 0.45], [0.1, 2.5, 0.1], "frame"); k.box([0, 2.45, (h.z - 0.45 + P.z) / 2], [0.08, 0.08, P.z - h.z + 0.5], "frame"); k.box([0, 0.45, h.z - 0.4], [0.2, 0.55, 0.12], "plate"); k.pulley([0, P.y - 0.05, P.z]);
      return all(barHands(k, 1.25, false), cableTo(k, midHands(k), P));
    },
  };
  E.remadamaq = {
    hl: { main: ["costas"], help: ["biceps", "deltP", "trap"] }, yaw: -50, pitch: 10,
    frames: [
      { legs: LEG_SIT, arms: { up: [0.16, -0.12, 0.98], fo: [0.1, -0.06, 1], palm: [-1, 0, 0] } },
      { legs: LEG_SIT, arms: { up: [0.35, -0.4, -0.85], fo: [0.06, 0.0, 1], palm: [-1, 0, 0] } },
    ],
    build: (k) => { const h = seatUnder(k, { dz: 0.05 }), c = k.bp("Spine2"), hz = k.handP("Left").c.z; k.box([0, c.y - 0.1, c.z + 0.17], [0.34, 0.5, 0.08], "pad"); k.tower([0, 0, hz + 0.25], 1.9); return levers(k, [0.3, 0.45, hz + 0.12]); },
  };
  E.remadabaixa = {
    hl: { main: ["costas"], help: ["biceps", "deltP", "lombar"] }, yaw: -62, pitch: 10,
    frames: [
      { ground: false, y: 0.52, rot: [10, 0, 0], legs: { th: [0.14, 0.02, 1], sh: [0.06, -0.32, 1], ft: [0.1, 0.75, 0.65] }, arms: { up: [0.06, -0.3, 0.95], fo: [-0.08, -0.25, 1], palm: [-1, 0, 0] } },
      { ground: false, y: 0.52, rot: [-6, 0, 0], legs: { th: [0.14, 0.02, 1], sh: [0.06, -0.32, 1], ft: [0.1, 0.75, 0.65] }, arms: { up: [0.28, -0.58, -0.77], fo: [-0.05, 0.05, 1], palm: [-1, 0, 0] } },
    ],
    build: (k) => {
      const h = hip0(k), f = k.bp("LeftFoot"), fz = f.z + 0.12;
      k.bench([0, 0.42, h.z + 0.15], { l: 0.7, w: 0.32 });
      k.box([0, f.y + 0.02, fz], [0.5, 0.36, 0.05], "frame", [-30, 0, 0]);
      const P = k.V(0, 0.32, fz + 0.32); k.box([0, 0.6, P.z + 0.1], [0.16, 1.2, 0.12], "frame"); k.box([0, 0.45, P.z + 0.22], [0.2, 0.55, 0.12], "plate"); k.pulley([0, P.y, P.z]);
      const v = k.rodMesh("chrome");
      return all(() => { const a = k.handP("Left").c, b = k.handP("Right").c; k.rod(v, a, b, 0.016); }, cableTo(k, midHands(k), P));
    },
  };
  E.remadauni = {
    hl: { main: ["costas"], help: ["biceps", "deltP", "trap"] }, yaw: -58, pitch: 16,
    frames: [
      { pin: "R", rot: [80, 0, 0], face: [0, -0.75, 0.66],
        legL: { th: [0.02, -1, 0.05], sh: [0.0, -0.05, -1], ft: [0, -0.5, -0.85] }, legR: { th: [-0.18, -0.95, -0.22], sh: [-0.06, -1, 0.05], ft: [-0.12, -0.3, 1] },
        armL: { up: [0.04, -1, 0.12], fo: [0.02, -1, 0.04], palm: [0, 0, -1], wrist: [0, -0.15, 1], grip: 0 }, armR: { up: [-0.06, -1, 0.06], fo: [-0.04, -1, 0.06], palm: [1, 0, 0] } },
      { pin: "R", rot: [80, 0, 0], face: [0, -0.75, 0.66],
        legL: { th: [0.02, -1, 0.05], sh: [0.0, -0.05, -1], ft: [0, -0.5, -0.85] }, legR: { th: [-0.18, -0.95, -0.22], sh: [-0.06, -1, 0.05], ft: [-0.12, -0.3, 1] },
        armL: { up: [0.04, -1, 0.12], fo: [0.02, -1, 0.04], palm: [0, 0, -1], wrist: [0, -0.15, 1], grip: 0 }, armR: { up: [-0.2, 0.3, -0.93], fo: [-0.04, -1, 0.15], palm: [1, 0, 0] } },
    ],
    build: (k) => {
      const kn = k.bp("LeftLeg"), hd = k.bp("LeftHand"), top = Math.min(kn.y - 0.06, hd.y - 0.03);
      k.bench([kn.x + 0.02, top, (kn.z + hd.z) / 2], { l: Math.abs(hd.z - kn.z) + 0.5, w: 0.3 });
      const db = k.dumbbell(); return () => k.placeInHand(db, "Right");
    },
  };

  // ============================================================
  //  PERNAS (continua)
  // ============================================================
  E.hack = {
    hl: { main: ["quad", "gluteo"], help: ["adutor"] }, yaw: 64, pitch: 8,
    frames: [
      { rot: [-18, 0, 0], legs: { th: [0.14, -0.96, 0.22], sh: [0.06, -0.97, 0.22], ft: [0.22, -0.3, 1] }, arms: { up: [0.55, -0.6, 0.58], fo: [-0.25, 0.95, 0.1], palm: [0, 0, -1] } },
      { rot: [-18, 0, 0], legs: { th: [0.34, -0.1, 0.93], sh: [0.14, -0.95, 0.28], ft: [0.22, -0.3, 1] }, arms: { up: [0.55, -0.6, 0.58], fo: [-0.25, 0.95, 0.1], palm: [0, 0, -1] } },
    ],
    build: (k) => {
      const pad = k.box([0, 0, 0], [0.42, 0.85, 0.08], "pad"), sp = [k.box([0, 0, 0], [0.12, 0.08, 0.2], "pad"), k.box([0, 0, 0], [0.12, 0.08, 0.2], "pad")];
      const f = k.bp("LeftFoot"); k.box([0, 0.03, f.z + 0.03], [0.7, 0.06, 0.5], "frame", [-8, 0, 0]);
      const a0 = k.bp("Hips"), b0 = k.bp("Neck"), d0 = b0.clone().sub(a0).normalize(), fr0 = k.V(0, -d0.z, d0.y);
      for (const s of [-1, 1]) { const st = a0.clone().addScaledVector(fr0, -0.24).setX(s * 0.27).addScaledVector(d0, -0.75); k.cyl([st.x, Math.max(0.05, st.y), st.z], st.clone().addScaledVector(d0, 1.55), 0.03, "chrome"); }
      return () => {
        const a = k.bp("Hips"), b = k.bp("Neck"), d = b.clone().sub(a).normalize(), fr = k.V(0, -d.z, d.y);
        pad.position.copy(a.clone().add(b).multiplyScalar(0.5).addScaledVector(fr, -0.15)); pad.quaternion.setFromUnitVectors(k.V(0, 1, 0), d);
        ["Left", "Right"].forEach((S, i) => { const p = k.bp(S + "Shoulder").addScaledVector(d, 0.06).addScaledVector(fr, -0.02); sp[i].position.copy(p); sp[i].quaternion.copy(pad.quaternion); });
      };
    },
  };
  E.extensora = {
    hl: { main: ["quad"], help: [] }, yaw: 66, pitch: 8,
    frames: [
      { ground: false, y: 0.66, rot: [-10, 0, 0], legs: { th: [0.12, -0.02, 1], sh: [0.03, -1, -0.12], ft: [0.08, -0.25, 1] }, arms: { up: [0.32, -0.95, -0.02], fo: [0.15, -0.45, 0.88], palm: [-1, 0, 0] } },
      { ground: false, y: 0.66, rot: [-10, 0, 0], legs: { th: [0.12, -0.02, 1], sh: [0.03, 0.06, 1], ft: [0.06, 0.85, 0.5] }, arms: { up: [0.32, -0.95, -0.02], fo: [0.15, -0.45, 0.88], palm: [-1, 0, 0] } },
    ],
    build: (k) => {
      seatUnder(k, { back: 10, backL: 0.8, dz: 0.06 }); const kn = k.bp("LeftLeg"), piv = k.V(0.27, kn.y, kn.z);
      k.cyl([0.27, kn.y, kn.z], [0.2, kn.y, kn.z], 0.05, "metal");
      const roller = k.rodMesh("pad"), lever = k.rodMesh("frame");
      return () => { const a = k.bp("LeftFoot"), sd = a.clone().sub(k.bp("LeftLeg")).normalize(), calf = k.V(0, 0, 0).crossVectors(k.V(1, 0, 0), sd).normalize(); const c = a.addScaledVector(calf, -0.07).addScaledVector(sd, -0.03); k.rod(roller, k.V(-0.24, c.y, c.z), k.V(0.24, c.y, c.z), 0.045); k.rod(lever, k.V(0.26, c.y, c.z), piv, 0.02); };
    },
  };
  E.flexora = {
    hl: { main: ["post"], help: ["calf"] }, yaw: 66, pitch: 8,
    frames: [
      { ground: false, y: 0.66, rot: [-12, 0, 0], legs: { th: [0.12, 0.04, 1], sh: [0.04, -0.05, 1], ft: [0.06, 0.85, 0.5] }, arms: { up: [0.32, -0.95, -0.02], fo: [0.15, -0.45, 0.88], palm: [-1, 0, 0] } },
      { ground: false, y: 0.66, rot: [-12, 0, 0], legs: { th: [0.12, 0.04, 1], sh: [0.03, -1, -0.3], ft: [0.06, -0.15, 1] }, arms: { up: [0.32, -0.95, -0.02], fo: [0.15, -0.45, 0.88], palm: [-1, 0, 0] } },
    ],
    build: (k) => {
      seatUnder(k, { back: 12, backL: 0.8, dz: 0.06 }); const kn = k.bp("LeftLeg"), piv = k.V(0.27, kn.y, kn.z);
      k.cyl([-0.24, kn.y + 0.1, kn.z - 0.06], [0.24, kn.y + 0.1, kn.z - 0.06], 0.05, "pad"); k.cyl([0.27, kn.y, kn.z], [0.2, kn.y, kn.z], 0.05, "metal");
      const roller = k.rodMesh("pad"), lever = k.rodMesh("frame");
      return () => { const a = k.bp("LeftFoot"), sd = a.clone().sub(k.bp("LeftLeg")).normalize(), calf = k.V(0, 0, 0).crossVectors(k.V(1, 0, 0), sd).normalize(); const c = a.addScaledVector(calf, 0.07).addScaledVector(sd, -0.03); k.rod(roller, k.V(-0.24, c.y, c.z), k.V(0.24, c.y, c.z), 0.045); k.rod(lever, k.V(0.26, c.y, c.z), piv, 0.02); };
    },
  };
  E.stiff = {
    hl: { main: ["post", "gluteo"], help: ["lombar"] }, yaw: 72, pitch: 6,
    frames: [
      { legs: { th: [0.08, -1, -0.04], sh: [0.04, -1, 0.05], ft: [0.16, -0.3, 1] }, arms: { up: [0.06, -1, 0.08], fo: [0.04, -1, 0.05], palm: [0, 0, -1] } },
      { rot: [62, 0, 0], spine: [0, 0.48, 0.88], chest: [0, 0.5, 0.87], face: [0, -0.3, 0.95], legs: { th: [0.08, -0.96, 0.28], sh: [0.04, -1, -0.06], ft: [0.16, -0.3, 1] }, arms: { sh: [1, 0.32, 0.02], up: [0.1, -1, 0.04], fo: [0.05, -1, 0.0], palm: [0, 0, -1] } },
    ],
    build: (k) => twoDB(k),
  };
  E.terra = {
    hl: { main: ["post", "gluteo"], help: ["lombar", "trap"] }, yaw: 72, pitch: 6,
    frames: [
      { legs: { th: [0.08, -1, -0.04], sh: [0.04, -1, 0.05], ft: [0.16, -0.3, 1] }, arms: { up: [0.14, -1, 0.08], fo: [0.1, -1, 0.05], palm: [0, 0, -1] } },
      { rot: [62, 0, 0], spine: [0, 0.48, 0.88], chest: [0, 0.5, 0.87], face: [0, -0.3, 0.95], legs: { th: [0.08, -0.96, 0.28], sh: [0.04, -1, -0.06], ft: [0.16, -0.3, 1] }, arms: { sh: [1, 0.32, 0.02], up: [0.16, -1, 0.04], fo: [0.1, -1, 0.0], palm: [0, 0, -1] } },
    ],
    build: (k) => barHands(k, 1.6, true, 0.0),
  };
  E.afundo = {
    hl: { main: ["quad", "gluteo"], help: ["post", "adutor"] }, yaw: 70, pitch: 6,
    frames: [
      { pin: "L", legL: { th: [0.1, -0.95, 0.3], sh: [0.05, -1, -0.05], ft: [0.12, -0.3, 1] }, legR: { th: [-0.1, -0.94, -0.33], sh: [-0.05, -0.9, -0.42], ft: [-0.05, -0.7, 0.7] }, arms: HANG },
      { pin: "L", legL: { th: [0.1, -0.22, 0.97], sh: [0.05, -1, 0.06], ft: [0.12, -0.3, 1] }, legR: { th: [-0.08, -1, -0.12], sh: [-0.04, -0.16, -0.99], ft: [-0.05, -0.75, 0.66] }, arms: HANG },
    ],
    build: (k) => twoDB(k),
  };
  E.sentar = {
    hl: { main: ["quad", "gluteo"], help: ["post", "calf"] }, yaw: 62, pitch: 6,
    frames: [
      { rot: [28, 0, 0], face: [0, -0.1, 1], legs: { th: [0.15, -0.04, 1], sh: [0.06, -1, -0.08], ft: [0.16, -0.3, 1] }, arms: { up: [0.12, -0.15, 1], fo: [0.06, -0.05, 1], palm: [0, -1, 0], grip: 0.2 } },
      { legs: LEG_STAND, arms: { up: [0.12, -0.15, 1], fo: [0.06, -0.05, 1], palm: [0, -1, 0], grip: 0.2 } },
    ],
    build: (k) => { const h = k.bp("Hips"); k.seat([0, h.y - 0.1, h.z + 0.08], { back: 4, backL: 0.5, w: 0.44, d: 0.42, post: 0.0 }); },
  };
  E.step = {
    hl: { main: ["quad", "gluteo"], help: ["calf"] }, yaw: 58, pitch: 8,
    frames: [
      { pin: "L", pinY: 0.18, pz: 0.25, legL: { th: [0.1, -0.5, 0.86], sh: [0.05, -1, 0.04], ft: [0.12, -0.3, 1] }, legR: { th: [-0.08, -1, 0.0], sh: [-0.04, -1, 0.0], ft: [-0.16, -0.3, 1] }, rot: [12, 0, 0],
        armL: { up: [0.3, -0.75, 0.6], fo: [0.12, -0.2, 1], palm: [0, -1, 0], grip: 0.9 }, armR: { up: [-0.12, -1, 0.05], fo: [-0.1, -0.9, 0.3], grip: 0.4 } },
      { pin: "L", pinY: 0.18, pz: 0.25, legL: { th: [0.08, -1, 0.02], sh: [0.04, -1, 0.0], ft: [0.12, -0.3, 1] }, legR: { th: [-0.08, -0.85, 0.5], sh: [-0.04, -1, -0.2], ft: [-0.16, -0.5, 1] }, rot: [2, 0, 0],
        armL: { up: [0.3, -0.75, 0.6], fo: [0.12, -0.2, 1], palm: [0, -1, 0], grip: 0.9 }, armR: { up: [-0.12, -1, 0.05], fo: [-0.1, -0.9, 0.3], grip: 0.4 } },
    ],
    build: (k) => { k.box([0, 0.09, 0.3], [0.6, 0.18, 0.4], "box"); const hd = k.handP("Left").c; railSide(k, hd.x + 0.03, hd.y, hd.z, 1.1); },
  };
  E.panturrilha = {
    hl: { main: ["calf"], help: [] }, yaw: 60, pitch: 4,
    frames: [
      { pin: "toes", legs: { th: [0.08, -1, 0.0], sh: [0.04, -1, 0.0], ft: [0.16, -0.25, 1] }, arms: { up: [0.16, -0.5, 0.85], fo: [0.1, -0.2, 1], palm: [0, -1, 0], grip: 0.9 } },
      { pin: "toes", legs: { th: [0.08, -1, 0.0], sh: [0.04, -1, 0.0], ft: [0.14, -0.85, 0.5] }, arms: { up: [0.16, -0.7, 0.7], fo: [0.1, -0.45, 0.89], palm: [0, -1, 0], grip: 0.9 } },
    ],
    build: (k) => { const hd = k.handP("Left").c; railFront(k, hd.z + 0.03, hd.y, 0.8); },
  };
  E.pantsentado = {
    hl: { main: ["calf"], help: [] }, yaw: 64, pitch: 8,
    frames: [
      { ground: false, y: 0.56, legs: { th: [0.14, -0.05, 1], sh: [0.05, -1, 0.04], ft: [0.12, 0.2, 0.98] }, arms: { up: [0.2, -0.85, 0.5], fo: [0.06, -0.4, 0.92], palm: [0, -1, 0], grip: 0.9 } },
      { ground: false, y: 0.56, legs: { th: [0.14, 0.06, 1], sh: [0.05, -1, 0.04], ft: [0.12, -0.35, 0.93] }, arms: { up: [0.2, -0.82, 0.54], fo: [0.06, -0.35, 0.94], palm: [0, -1, 0], grip: 0.9 } },
    ],
    build: (k) => {
      seatUnder(k, { dz: 0.06 }); const t0 = k.bp("LeftToeBase"), kn0 = k.bp("LeftLeg");
      k.box([0, t0.y - 0.06, t0.z - 0.02], [0.42, 0.06, 0.16], "frame"); k.cyl([0, 0, t0.z + 0.1], [0, kn0.y + 0.2, t0.z + 0.1], 0.04, "frame"); k.box([0, 0.02, t0.z + 0.1], [0.5, 0.04, 0.1], "frame");
      const pad = k.rodMesh("pad"), arm = k.rodMesh("frame");
      return () => { const a = k.bp("LeftLeg"), b = k.bp("RightLeg"), y = a.y + 0.09, z = a.z - 0.02; k.rod(pad, k.V(-0.25, y, z), k.V(0.25, y, z), 0.05); k.rod(arm, k.V(0, y, z), k.V(0, y + 0.02, t0.z + 0.1), 0.025); };
    },
  };
  E.abdutora = {
    hl: { main: ["glutmed"], help: ["gluteo"] }, yaw: 18, pitch: 14,
    frames: [
      { rot: [-16, 0, 0], legs: { th: [0.12, -0.02, 1], sh: [0.04, -1, 0.1], ft: [0.12, -0.3, 1] }, arms: { up: [0.3, -0.95, 0.05], fo: [0.15, -0.5, 0.85], palm: [-1, 0, 0] } },
      { rot: [-16, 0, 0], legs: { th: [0.62, -0.02, 0.78], sh: [0.14, -1, 0.1], ft: [0.4, -0.3, 0.9] }, arms: { up: [0.3, -0.95, 0.05], fo: [0.15, -0.5, 0.85], palm: [-1, 0, 0] } },
    ],
    build: (k) => {
      const h = seatUnder(k, { back: 16, backL: 0.8, w: 0.42 }), piv = [k.V(0.1, h.y - 0.2, h.z + 0.05), k.V(-0.1, h.y - 0.2, h.z + 0.05)];
      const pads = [k.box([0, 0, 0], [0.06, 0.2, 0.3], "pad"), k.box([0, 0, 0], [0.06, 0.2, 0.3], "pad")], arms = [k.rodMesh("frame"), k.rodMesh("frame")];
      return () => ["Left", "Right"].forEach((S, i) => { const kn = k.bp(S + "Leg"), th = kn.clone().sub(k.bp(S + "UpLeg")).normalize(), out = k.V(i ? -1 : 1, 0, 0), side = out.clone().addScaledVector(th, -out.dot(th)).normalize(); const c = kn.clone().addScaledVector(side, 0.08).addScaledVector(th, -0.06); pads[i].position.copy(c); pads[i].quaternion.setFromUnitVectors(k.V(0, 0, 1), th); k.rod(arms[i], c.clone().addScaledVector(side, 0.03), piv[i], 0.02); });
    },
  };

  // ============================================================
  //  EQUILÍBRIO E MOBILIDADE (idosos)
  // ============================================================
  const holdFront = { up: [0.2, -0.55, 0.81], fo: [0.06, -0.15, 1], palm: [0, -1, 0], grip: 0.9 };
  E.caminhada = {
    hl: { main: ["glutmed"], help: ["gluteo", "adutor"] }, yaw: 14, pitch: 8, dur: 2.6,
    frames: [
      { legs: LEG_STAND, arms: holdFront },
      { legL: { th: [0.42, -0.9, 0.02], sh: [0.4, -0.92, 0.0], ft: [0.2, -0.3, 1] }, legR: { th: [-0.06, -1, 0.02], sh: [-0.04, -1, 0.0], ft: [-0.16, -0.3, 1] }, rot: [0, 0, -5], arms: holdFront },
    ],
    build: (k) => { const hd = k.handP("Left").c; railFront(k, hd.z + 0.03, hd.y, 1.1); },
  };
  E.marcha = {
    hl: { main: ["quad"], help: ["abdomen", "glutmed"] }, yaw: 50, pitch: 6, loop: true, dur: 2.4,
    frames: [
      { legL: { th: [0.08, -0.22, 0.97], sh: [0.04, -1, 0.06], ft: [0.12, -0.45, 1] }, legR: LEG_STAND, arms: holdFront },
      { legs: LEG_STAND, arms: holdFront },
      { legR: { th: [-0.08, -0.22, 0.97], sh: [-0.04, -1, 0.06], ft: [-0.12, -0.45, 1] }, legL: LEG_STAND, arms: holdFront },
      { legs: LEG_STAND, arms: holdFront },
    ],
    build: (k) => { const hd = k.handP("Left").c; railFront(k, hd.z + 0.03, hd.y, 0.9); },
  };
  const OPEN = { up: [0.75, -0.66, 0.08], fo: [0.8, -0.55, 0.2], palm: [0, -1, 0], grip: 0.25 };
  E.tandem = {
    hl: { main: ["glutmed", "calf"], help: ["abdomen"] }, yaw: 40, pitch: 10, loop: true, dur: 3.2,
    frames: [
      { legL: { th: [-0.05, -0.98, 0.17], sh: [-0.03, -1, 0.0], ft: [0, -0.3, 1] }, legR: { th: [0.05, -0.98, -0.17], sh: [0.03, -0.97, -0.24], ft: [0, -0.5, 0.86] }, arms: OPEN },
      { legL: { th: [-0.05, -1, 0.0], sh: [-0.03, -1, 0.0], ft: [0, -0.3, 1] }, legR: { th: [0.05, -0.92, 0.38], sh: [0.03, -1, -0.15], ft: [0, -0.35, 1] }, arms: OPEN },
      { legR: { th: [0.05, -0.98, 0.17], sh: [0.03, -1, 0.0], ft: [0, -0.3, 1] }, legL: { th: [-0.05, -0.98, -0.17], sh: [-0.03, -0.97, -0.24], ft: [0, -0.5, 0.86] }, arms: OPEN },
      { legR: { th: [0.05, -1, 0.0], sh: [0.03, -1, 0.0], ft: [0, -0.3, 1] }, legL: { th: [-0.05, -0.92, 0.38], sh: [-0.03, -1, -0.15], ft: [0, -0.35, 1] }, arms: OPEN },
    ],
    build: (k) => { k.box([0, 0.004, 0], [0.04, 0.008, 2.4], "chrome"); },
  };
  E.equilibrio = {
    hl: { main: ["glutmed"], help: ["quad", "calf", "abdomen"] }, yaw: 30, pitch: 6, dur: 4,
    frames: [
      { pin: "R", legL: { th: [0.1, -0.85, 0.5], sh: [0.04, -1, -0.15], ft: [0.12, -0.6, 0.8] }, legR: LEG_STAND,
        armR: { up: [-0.62, -0.75, 0.2], fo: [-0.5, -0.4, 0.75], palm: [0, -1, 0], grip: 0.6 }, armL: { up: [0.2, -1, 0.05], fo: [0.15, -0.9, 0.3], grip: 0.4 } },
      { pin: "R", legL: { th: [0.1, -0.55, 0.83], sh: [0.04, -1, -0.05], ft: [0.12, -0.5, 0.86] }, legR: LEG_STAND,
        armR: { up: [-0.62, -0.75, 0.2], fo: [-0.5, -0.4, 0.75], palm: [0, -1, 0], grip: 0.6 }, armL: { up: [0.25, -0.95, 0.1], fo: [0.2, -0.85, 0.35], grip: 0.4 } },
    ],
    build: (k) => { const hd = k.handP("Right").c; railSide(k, hd.x - 0.02, hd.y, hd.z, 1.0); },
  };

  // ============================================================
  //  ABDÔMEN
  // ============================================================
  E.prancha = {
    hl: { main: ["abdomen"], help: ["obliquo", "deltF", "gluteo"] }, yaw: 58, pitch: 12, dur: 4,
    frames: [
      { ground: false, y: 0.27, rot: [80, 0, 0], face: [0, -0.9, 0.4], legs: { th: [0.06, -0.2, -1], sh: [0.03, -0.2, -1], ft: [0, -1, 0.1], knee: [0, -1, 0] }, arms: { up: [0.12, -1, 0.05], fo: [0.06, -0.05, 1], palm: [0, -1, 0], grip: 0.6 } },
      { ground: false, y: 0.285, rot: [80, 0, 0], face: [0, -0.9, 0.4], legs: { th: [0.06, -0.21, -1], sh: [0.03, -0.21, -1], ft: [0, -1, 0.1], knee: [0, -1, 0] }, arms: { up: [0.12, -1, 0.05], fo: [0.06, -0.05, 1], palm: [0, -1, 0], grip: 0.6 } },
    ],
    build: (k) => { const h = k.bp("Hips"); k.box([0, 0.005, h.z + 0.05], [0.75, 0.01, 2.0], "mat"); },
  };
  E.pranchalat = {
    hl: { main: ["obliquo"], help: ["abdomen", "glutmed", "deltL"] }, yaw: 4, pitch: 10, dur: 4,
    frames: [
      { ground: false, y: 0.25, rot: [0, 0, 75], front: [0, 0, 1], face: [0, 0.15, 1],
        legL: { th: [0.97, -0.21, 0], sh: [0.97, -0.21, 0], ft: [0.1, 0, 1], knee: [0, 0, 1] }, legR: { th: [0.97, -0.21, 0], sh: [0.97, -0.21, 0], ft: [0.1, 0, 1], knee: [0, 0, 1] },
        armR: { up: [0, -1, 0.0], fo: [0.0, 0.0, 1], palm: [0, -1, 0], grip: 0.5 }, armL: { up: [0.05, 1, 0], fo: [0.05, 1, 0], palm: [0, 0, 1], grip: 0.1 } },
      { ground: false, y: 0.275, rot: [0, 0, 77], front: [0, 0, 1], face: [0, 0.15, 1],
        legL: { th: [0.97, -0.24, 0], sh: [0.97, -0.24, 0], ft: [0.1, 0, 1], knee: [0, 0, 1] }, legR: { th: [0.97, -0.24, 0], sh: [0.97, -0.24, 0], ft: [0.1, 0, 1], knee: [0, 0, 1] },
        armR: { up: [0, -1, 0.0], fo: [0.0, 0.0, 1], palm: [0, -1, 0], grip: 0.5 }, armL: { up: [0.05, 1, 0], fo: [0.05, 1, 0], palm: [0, 0, 1], grip: 0.1 } },
    ],
    build: (k) => { const h = k.bp("Hips"); k.box([h.x + 0.2, 0.005, h.z], [2.0, 0.01, 0.75], "mat"); },
  };
  E.abdpolia = {
    hl: { main: ["abdomen"], help: ["obliquo"] }, yaw: 62, pitch: 8,
    frames: [
      { rot: [8, 0, 0], legs: { th: [0.1, -1, 0.06], sh: [0.04, -0.02, -1], ft: [0, -0.55, -0.85] }, arms: { up: [0.22, 0.6, 0.77], fo: [-0.3, 0.2, -0.93], palm: [-1, 0, 0] } },
      { rot: [48, 0, 0], spine: [0, 0.55, 0.83], chest: [0, -0.05, 1], face: [0, -0.95, 0.3], legs: { th: [0.1, -1, 0.06], sh: [0.04, -0.02, -1], ft: [0, -0.55, -0.85] }, arms: { up: [0.2, -0.25, 0.95], fo: [-0.3, 0.85, -0.43], palm: [-1, 0, 0] } },
    ],
    build: (k) => { const h = hip0(k), P = k.V(0, 2.0, h.z + 0.6); k.tower([0, 0, P.z + 0.07], 2.15); k.pulley([0, P.y, P.z]); k.box([0, 0.005, h.z - 0.15], [0.6, 0.01, 0.6], "mat"); const r = rope(k); return () => r(P, k.V(0, 1, 0.4).normalize()); },
  };

  E.parado = { hl: {}, yaw: 30, frames: [{ legs: LEG_STAND, arms: { up: [0.15, -1, 0.0], fo: [0.12, -1, 0.08], palm: [-1, 0, 0], grip: 0.3 } }] };
})();
