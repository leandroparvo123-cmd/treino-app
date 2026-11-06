// ============================================================
//  Boneco 3D v2: X Bot (Mixamo) posado osso a osso por direções.
//  Cada exercício (FIG3DV.EX, em fig3dv-ex.js) diz pra onde aponta cada
//  parte do corpo no começo e no fim do movimento, a posição da palma,
//  o equipamento e os músculos. Aqui fica o motor: pose, pegada,
//  aparelhos, músculos pintados na pele, enquadramento e desenho.
//  Convenção: o boneco olha pra +Z, o lado esquerdo dele é +X, Y pra cima, metros.
// ============================================================
(function () {
  "use strict";
  const X = { status: "idle", onReady: null, EX: {} };
  window.FIG3DV = X;
  X.has = (n) => !!X.EX[n];
  let T = null, renderer = null, scene = null, cam = null, model = null, surfs = [], B = {}, key = null, floor = null;
  let regW = null, colCache = {}, curCol = null, rigs = {}, curRig = null, H0 = 1;

  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  X.start = async function (base) {
    if (X.status !== "idle") return;
    X.status = "loading";
    try {
      base = base || "";
      if (!window.THREE) await loadScript(base + "three.min.js");
      if (!window.THREE.GLTFLoader) await loadScript(base + "GLTFLoader.js");
      T = window.THREE;
      let ab;
      if (window.__XBOT_B64) { const bin = atob(window.__XBOT_B64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ab = u.buffer; }
      else { const r = await fetch(base + "xbot.glb"); if (!r.ok) throw new Error("xbot " + r.status); ab = await r.arrayBuffer(); }
      const gltf = await new Promise((res, rej) => new T.GLTFLoader().parse(ab, "", res, rej));
      setup(gltf);
      X.status = "ready";
      if (X.onReady) X.onReady();
    } catch (e) { console.warn("3D v2 indisponível", e); X.status = "fail"; }
  };

  // ---------- utilidades ----------
  let V3, Q4;
  const v = (a) => (a && a.isVector3 ? a.clone() : new V3(a[0], a[1], a[2]));
  const wp = (b) => b.getWorldPosition(new V3());
  const wq = (b) => b.getWorldQuaternion(new Q4());
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lin = (hex) => { const c = new T.Color(hex); return c; };

  // ---------- cena ----------
  function setup(gltf) {
    V3 = T.Vector3; Q4 = T.Quaternion;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xe2e8f2, 0x2a2826, 0.6));
    key = new T.DirectionalLight(0xffffff, 1.65); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.3, far: 9 });
    scene.add(key, key.target);
    const fill = new T.DirectionalLight(0xc9d6ff, 0.5); fill.position.set(2.2, 1.4, 1.8); scene.add(fill);
    const rim = new T.DirectionalLight(0xffffff, 1.1); rim.position.set(0.8, 2.6, -2.6); scene.add(rim);
    floor = new T.Mesh(new T.CircleGeometry(2.4, 48), new T.ShadowMaterial({ opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    cam = new T.PerspectiveCamera(28, 1, 0.05, 40);

    model = gltf.scene; scene.add(model);
    model.traverse((o) => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, "")] = o; });
    model.updateMatrixWorld(true);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; surfs.push(o); } });
    H0 = wp(B.Hips).y;
    // pose de referência e vetores auxiliares de cada osso (na pose T)
    Object.values(B).forEach((b) => { b.userData.q0 = b.quaternion.clone(); b.userData.p0 = b.position.clone(); });
    const sec = (name, w) => { const b = B[name]; if (b) b.userData.sec = w.clone().applyQuaternion(wq(b).invert()); };
    const pal = (name, w) => { const b = B[name]; if (b) b.userData.palm = w.clone().applyQuaternion(wq(b).invert()); };
    for (const n of ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"]) sec(n, new V3(0, 0, 1));
    for (const s of ["Left", "Right"]) {
      sec(s + "Arm", new V3(0, 0, 1)); sec(s + "ForeArm", new V3(0, 0, 1));
      pal(s + "ForeArm", new V3(0, -1, 0)); pal(s + "Hand", new V3(0, -1, 0));
      sec(s + "UpLeg", new V3(0, 0, -1)); sec(s + "Leg", new V3(0, 0, 1));
      sec(s + "Foot", new V3(0, 1, 0));
    }
    paintRegions();
    X.dims = dims();
  }
  function dims() {
    const d = (a, b) => wp(B[a]).distanceTo(wp(B[b]));
    return { hip: H0, thigh: d("LeftUpLeg", "LeftLeg"), shin: d("LeftLeg", "LeftFoot"), upper: d("LeftArm", "LeftForeArm"), fore: d("LeftForeArm", "LeftHand"), shoulderW: d("LeftArm", "RightArm"), torso: d("Hips", "Neck") };
  }

  // ---------- músculos: peso de cada região em cada vértice (pose T) ----------
  const REG = ["deltF", "deltL", "deltP", "trap", "peito", "peitoSup", "costas", "lombar", "abdomen", "obliquo", "biceps", "triceps", "antebraco", "gluteo", "glutmed", "quad", "post", "adutor", "calf"];
  function paintRegions() {
    regW = [];
    const wposB = (n) => wp(B[n]);
    const yHips = wposB("Hips").y, yChest = wposB("Spine2").y, yNeck = wposB("Neck").y, yKnee = wposB("LeftLeg").y, yAnk = wposB("LeftFoot").y;
    const sh = { L: wposB("LeftArm"), R: wposB("RightArm") }, el = { L: wposB("LeftForeArm"), R: wposB("RightForeArm") };
    for (const o of surfs) {
      const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const n = pos.count, W = {}; REG.forEach((r) => (W[r] = new Float32Array(n)));
      const names = o.skeleton.bones.map((b) => b.name.replace(/^mixamorig:?/, ""));
      const p = new V3(), q = new V3(), nn = new V3(), m = o.matrixWorld;
      const bt = (o.applyBoneTransform || o.boneTransform).bind(o);
      for (let i = 0; i < n; i++) {
        p.fromBufferAttribute(pos, i); q.copy(p).addScaledVector(new V3().fromBufferAttribute(nor, i), 0.5);
        bt(i, p); bt(i, q); p.applyMatrix4(m); q.applyMatrix4(m); nn.copy(q).sub(p).normalize();
        const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)]; let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (ws[k] > bw) { bw = ws[k]; best = is[k]; }
        const bn = names[best] || "", ax = Math.abs(p.x), side = p.x >= 0 ? "L" : "R", inward = -Math.sign(p.x || 1) * nn.x;
        const set = (r, w) => { if (w > W[r][i]) W[r][i] = w; };
        if (/UpLeg$/.test(bn)) {
          set("quad", ss(-0.05, 0.4, nn.z) * (1 - ss(0.35, 0.75, inward)));
          set("post", ss(0.0, 0.45, -nn.z) * (p.y < yHips - 0.1 ? 1 : 0.3));
          set("adutor", ss(0.35, 0.8, inward) * (p.y > yKnee + 0.12 ? 1 : 0));
          if (p.y > yHips - 0.13) { set("gluteo", ss(0.1, 0.5, -nn.z)); set("glutmed", ss(0.5, 0.85, -inward) * (p.y > yHips - 0.06 ? 1 : 0.5)); }
        } else if (/Leg$/.test(bn)) {
          if (p.y > yAnk + (yKnee - yAnk) * 0.3) set("calf", ss(-0.1, 0.4, -nn.z));
        } else if (bn === "Hips") {
          if (p.y < yHips + 0.04) set("gluteo", ss(0.05, 0.45, -nn.z));
          set("glutmed", ss(0.5, 0.85, Math.abs(nn.x)) * (p.y > yHips - 0.05 ? 1 : 0.3));
          if (p.y > yHips) set("abdomen", ss(0.3, 0.65, nn.z) * (ax < 0.12 ? 1 : 0));
        } else if (/^Spine/.test(bn)) {
          const front = nn.z, back = -nn.z;
          if (p.y > yChest - 0.1 && p.y < yNeck - 0.02 && ax < 0.19 && ax > 0.015) { set("peito", ss(0.1, 0.5, front)); if (p.y > yChest + 0.0) set("peitoSup", ss(0.1, 0.5, front)); }
          else if (p.y <= yChest - 0.1) { set("abdomen", ss(0.25, 0.6, front) * (1 - ss(0.09, 0.13, ax))); set("obliquo", ss(0.0, 0.5, front + 0.3) * ss(0.08, 0.13, ax)); }
          if (p.y > yChest - 0.02 && ax < 0.16) set("trap", ss(0.2, 0.6, back) * ss(yChest - 0.02, yChest + 0.06, p.y));
          if (p.y > yHips + 0.1 && p.y < yChest + 0.05 && ax > 0.05) set("costas", ss(0.0, 0.5, back + Math.abs(nn.x) * 0.6) * (ax > 0.07 ? 1 : 0.5));
          if (p.y < yHips + 0.18) set("lombar", ss(0.3, 0.7, back) * (1 - ss(0.07, 0.11, ax)));
        } else if (/Shoulder$/.test(bn)) {
          const s = sh[side];
          if (ax > Math.abs(s.x) - 0.035) { set("deltL", ss(0.2, 0.7, nn.y + Math.abs(nn.x))); set("deltF", ss(0.25, 0.6, nn.z)); set("deltP", ss(0.25, 0.6, -nn.z)); }
          else set("trap", ss(0.0, 0.5, nn.y - nn.z * 0.5));
        } else if (bn === "Neck") {
          set("trap", ss(0.1, 0.6, -nn.z) * (p.y < yNeck + 0.04 ? 1 : 0) * ss(0.02, 0.06, ax));
        } else if (/Arm$/.test(bn) && !/Fore/.test(bn)) {
          const s = sh[side], e = el[side], a = e.clone().sub(s), L = a.length(); a.normalize();
          const t = p.clone().sub(s).dot(a) / L;
          if (t < 0.48) { const k = 1 - ss(0.32, 0.48, t); set("deltL", k * ss(-0.2, 0.5, nn.y)); set("deltF", k * ss(0.2, 0.6, nn.z)); set("deltP", k * ss(0.2, 0.6, -nn.z)); }
          if (t > 0.3) { const k = ss(0.3, 0.45, t); set("biceps", k * ss(0.15, 0.55, nn.z)); set("triceps", k * ss(0.15, 0.55, -nn.z) + k * 0.6 * ss(0.4, 0.8, -nn.y)); }
        } else if (/ForeArm$/.test(bn)) set("antebraco", 0.9);
      }
      regW.push(W);
    }
  }
  const BASE = 0x9da1a8, MAIN = 0xff1a10, HELP = 0xff7a5a;
  function colorize(hl) {
    const k = JSON.stringify(hl); if (k === curCol) return; curCol = k;
    if (!colCache[k]) {
      colCache[k] = surfs.map((o, si) => {
        const n = o.geometry.attributes.position.count, col = new Float32Array(n * 3), W = regW[si];
        const base = lin(BASE), main = lin(MAIN), help = lin(HELP), c = new T.Color(), joint = /joint/i.test((o.material && o.material.name) || o.name);
        const mains = (hl.main || []).flatMap(expandReg), helps = (hl.help || []).flatMap(expandReg);
        for (let i = 0; i < n; i++) {
          let wm = 0, wh = 0; for (const r of mains) wm = Math.max(wm, W[r][i]); for (const r of helps) wh = Math.max(wh, W[r][i]);
          c.copy(base); if (joint) c.multiplyScalar(0.86);
          if (wh > 0.05) c.lerp(help, Math.min(1, wh * 1.25) * 0.8);
          if (wm > 0.05) c.lerp(main, Math.min(1, wm * 1.6));
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        return col;
      });
    }
    surfs.forEach((o, i) => {
      if (!o.geometry.attributes.color) { o.geometry.setAttribute("color", new T.BufferAttribute(new Float32Array(colCache[k][i]), 3)); const joint = /joint/i.test((o.material && o.material.name) || o.name); o.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: joint ? 0.45 : 0.55, metalness: 0 }); }
      else { o.geometry.attributes.color.array.set(colCache[k][i]); o.geometry.attributes.color.needsUpdate = true; }
    });
  }
  const GROUPS = { delt: ["deltF", "deltL", "deltP"], ombro: ["deltF", "deltL", "deltP"] };
  const expandReg = (r) => GROUPS[r] || [r];

  // ---------- pose ----------
  const qd = () => new Q4();
  function rollTo(b, dir, cur, want) {
    // gira o osso em torno do próprio eixo pra que "cur" fique o mais perto de "want"
    const a = cur.clone().addScaledVector(dir, -cur.dot(dir)), w = want.clone().addScaledVector(dir, -want.dot(dir));
    if (a.lengthSq() < 1e-4 || w.lengthSq() < 1e-4) return;
    a.normalize(); w.normalize();
    let ang = Math.acos(Math.max(-1, Math.min(1, a.dot(w)))); if (new V3().crossVectors(a, w).dot(dir) < 0) ang = -ang;
    const Qw = wq(b).premultiply(qd().setFromAxisAngle(dir, ang)); setW(b, Qw);
  }
  function setW(b, Qw) { const P = wq(b.parent).invert(); b.quaternion.copy(P.multiply(Qw)); b.updateMatrixWorld(true); }
  function aim(name, child, dir, secWant) {
    const b = B[name], c = B[child]; if (!b || !c || !dir) return;
    const d = v(dir).normalize(), cur = wp(c).sub(wp(b)).normalize();
    setW(b, wq(b).premultiply(qd().setFromUnitVectors(cur, d)));
    if (secWant && b.userData.sec) rollTo(b, d, b.userData.sec.clone().applyQuaternion(wq(b)), v(secWant));
  }
  function palmTo(name, dir, want) {
    const b = B[name]; if (!b || !want) return;
    rollTo(b, v(dir).normalize(), b.userData.palm.clone().applyQuaternion(wq(b)), v(want));
  }
  function curlFingers(S, amt) {
    if (!amt) return;
    const H = B[S + "Hand"], palm = H.userData.palm.clone().applyQuaternion(wq(H)), fd = wp(B[S + "HandMiddle1"]).sub(wp(H)).normalize();
    const axis = new V3().crossVectors(fd, palm).normalize();
    for (const f of ["Index", "Middle", "Ring", "Pinky"]) for (let j = 1; j <= 3; j++) { const b = B[S + "Hand" + f + j]; if (b) setW(b, wq(b).premultiply(qd().setFromAxisAngle(axis, amt * (j === 1 ? 0.9 : 1.05)))); }
    for (let j = 2; j <= 3; j++) { const b = B[S + "HandThumb" + j]; if (b) setW(b, wq(b).premultiply(qd().setFromAxisAngle(axis, amt * 0.35))); }
  }
  const mir = (a) => (a ? [-a[0], a[1], a[2]] : a);
  const D2R = Math.PI / 180;
  function rootQ(r) { return new Q4().setFromEuler(new T.Euler((r[0] || 0) * D2R, (r[1] || 0) * D2R, (r[2] || 0) * D2R, "YXZ")); }

  // um quadro: f = { root: { y | ground, x, z, rot:[x,y,z] }, spine, chest, head, face, arms:{up,fo,palm,grip} | armL/armR, legs:{th,sh,ft,knee} | legL/legR }
  function applyFrame(f) {
    Object.values(B).forEach((b) => { b.quaternion.copy(b.userData.q0); b.position.copy(b.userData.p0); });
    model.position.set(0, 0, 0); model.updateMatrixWorld(true);
    const rq = rootQ(f.rot || [0, 0, 0]), fwd = new V3(0, 0, 1).applyQuaternion(rq);
    setW(B.Hips, wq(B.Hips).premultiply(rq));
    // coluna
    const sp = f.spine ? v(f.spine) : new V3(0, 1, 0).applyQuaternion(rq), ch = f.chest ? v(f.chest) : sp, face = f.face ? v(f.face) : fwd;
    const front = f.front ? v(f.front) : fwd;
    aim("Spine", "Spine1", sp, front); aim("Spine1", "Spine2", sp.clone().add(ch).normalize(), front); aim("Spine2", "Neck", ch, front);
    const hd = f.head ? v(f.head) : ch.clone().addScaledVector(face, 0.12);
    aim("Neck", "Head", hd, face); aim("Head", "HeadTop_End", hd, face);
    // pernas
    for (const s of ["L", "R"]) {
      const S = s === "L" ? "Left" : "Right", g = f["leg" + s] || (f.legs && (s === "L" ? f.legs : mirLeg(f.legs)));
      if (!g) continue;
      const knee = g.knee ? v(g.knee) : fwd;
      aim(S + "UpLeg", S + "Leg", g.th, g.sh ? bendHint(v(g.th), v(g.sh), knee) : knee.clone().negate());
      if (g.sh) aim(S + "Leg", S + "Foot", g.sh, bendHint(v(g.sh), v(g.ft || [0, -0.3, 1]), knee.clone().negate()));
      aim(S + "Foot", S + "ToeBase", g.ft || [0, -0.35, 1], g.sole ? v(g.sole) : null);
    }
    // braços
    for (const s of ["L", "R"]) {
      const S = s === "L" ? "Left" : "Right", a = f["arm" + s] || (f.arms && (s === "L" ? f.arms : mirArm(f.arms)));
      if (!a) continue;
      if (a.sh) aim(S + "Shoulder", S + "Arm", a.sh);
      const elbowOut = a.elbow ? v(a.elbow) : null;
      aim(S + "Arm", S + "ForeArm", a.up, a.fo ? bendHint(v(a.up), v(a.fo), elbowOut) : (elbowOut ? elbowOut.clone().negate() : null));
      if (a.fo) { aim(S + "ForeArm", S + "Hand", a.fo); if (a.palm) palmTo(S + "ForeArm", a.fo, a.palm); }
      if (a.wrist) aim(S + "Hand", S + "HandMiddle1", a.wrist);
      curlFingers(S, a.grip == null ? 1.15 : a.grip);
    }
    model.updateMatrixWorld(true);
    // pé preso no chão (agachamento, afundo, step...) ou quadril preso (sentado, deitado)
    const pin = f.pin || (f.ground === false || f.y != null ? "hips" : "feet");
    const ank = (n) => wp(B[n]), mid = (a, b) => a.add(b).multiplyScalar(0.5);
    let pp = null, off = 0.075;
    if (pin === "feet") pp = mid(ank("LeftFoot"), ank("RightFoot"));
    else if (pin === "L" || pin === "R") pp = ank(pin === "L" ? "LeftFoot" : "RightFoot");
    else if (pin === "toes") { pp = mid(ank("LeftToeBase"), ank("RightToeBase")); off = 0.025; }
    else if (pin === "Lt" || pin === "Rt") { pp = ank(pin === "Lt" ? "LeftToeBase" : "RightToeBase"); off = 0.025; }
    if (f.y != null || f.ground === false) model.position.y = (f.y ?? H0) - wp(B.Hips).y;
    else if (pp && f.pinY != null) model.position.y = f.pinY + off - pp.y;
    else { let lo = Infinity; for (const n of ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"]) lo = Math.min(lo, wp(B[n]).y - (/Toe/.test(n) ? 0.025 : 0.075)); model.position.y = (f.floor || 0) - lo; }
    if (pp) { model.position.x = (f.px || 0) - pp.x; model.position.z = (f.pz || 0) - pp.z; }
    else { const h = wp(B.Hips); model.position.x = (f.x || 0) - h.x; model.position.z = (f.z || 0) - h.z; }
    model.updateMatrixWorld(true);
  }
  // direção pra onde a articulação dobra (cotovelo/joelho), a partir dos dois segmentos
  // "sec" de cada osso = lado pra onde o próximo segmento dobra; com o membro esticado usa a dica (cotovelo/joelho aponta pro lado oposto)
  function bendHint(a, b, hint) {
    const an = a.clone().normalize(), perp = b.clone().addScaledVector(an, -b.dot(an));
    if (perp.length() > 0.12) return perp.normalize();
    return hint ? hint.clone().negate() : null;
  }
  function mirArm(a) { return { ...a, sh: mir(a.sh), up: mir(a.up), fo: mir(a.fo), palm: mir(a.palm), wrist: mir(a.wrist), elbow: mir(a.elbow) }; }
  function mirLeg(g) { return { ...g, th: mir(g.th), sh: mir(g.sh), ft: mir(g.ft), knee: mir(g.knee), sole: mir(g.sole) }; }

  // mistura de quadros
  const lerpA = (a, b, k) => (a && b ? [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] : a || b);
  function mixObj(a, b, k) {
    if (!a || !b) return a || b;
    const o = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key], y = b[key];
      if (Array.isArray(x) && Array.isArray(y) && typeof x[0] === "number") o[key] = lerpA(x, y, k);
      else if (typeof x === "number" && typeof y === "number") o[key] = x + (y - x) * k;
      else if (x && y && typeof x === "object") o[key] = mixObj(x, y, k);
      else o[key] = k < 0.5 ? (x ?? y) : (y ?? x);
    }
    return o;
  }

  // ---------- ritmo ----------
  const ease = (t) => t * t * (3 - 2 * t);
  function phase(def, t) {
    const dur = def.dur || 3.2, c = ((t % dur) + dur) % dur / dur;
    if (def.loop) { const n = def.frames.length, x = c * n, i = Math.floor(x) % n; return { i, j: (i + 1) % n, k: ease(x - Math.floor(x)) }; }
    const [up, hold, down] = def.rhythm || [0.36, 0.12, 0.4];
    let k; if (c < up) k = ease(c / up); else if (c < up + hold) k = 1; else if (c < up + hold + down) k = 1 - ease((c - up - hold) / down); else k = 0;
    return { i: 0, j: 1, k };
  }
  // completa o quadro com os valores padrão (pra mistura não herdar do outro quadro)
  function fill(f) {
    const o = { ...f }, r = rootQ(o.rot || [0, 0, 0]), up = new V3(0, 1, 0).applyQuaternion(r), fw = new V3(0, 0, 1).applyQuaternion(r);
    o.rot = o.rot || [0, 0, 0]; o.spine = o.spine || up.toArray(); o.chest = o.chest || o.spine; o.front = o.front || fw.toArray(); o.face = o.face || o.front;
    // sempre lado a lado (esquerdo/direito), pra mistura entre quadros não se confundir
    if (o.arms) { o.armL = o.armL || o.arms; o.armR = o.armR || mirArm(o.arms); delete o.arms; }
    if (o.legs) { o.legL = o.legL || o.legs; o.legR = o.legR || mirLeg(o.legs); delete o.legs; }
    return o;
  }
  function frames(def) { return def._f || (def._f = def.frames.map(fill)); }
  function frameAt(def, t) {
    const F = frames(def); if (F.length === 1) return F[0];
    const { i, j, k } = phase(def, t); return mixObj(F[i], F[j], k);
  }

  // ---------- aparelhos ----------
  const MAT = {};
  function mat(n) {
    if (MAT[n]) return MAT[n];
    const spec = { metal: [0x30343a, 0.32, 0.85], chrome: [0x8a9099, 0.25, 0.9], frame: [0x22262c, 0.55, 0.35], pad: [0x3a3f47, 0.8, 0], padL: [0x8a8f96, 0.75, 0], plate: [0x17191c, 0.5, 0.4], cable: [0x9aa0a8, 0.4, 0.6], rope: [0xb9a27a, 0.9, 0], box: [0x5a6068, 0.7, 0.1], mat: [0x2a3a34, 0.95, 0] }[n] || [0x666a70, 0.6, 0.2];
    return (MAT[n] = new T.MeshStandardMaterial({ color: spec[0], roughness: spec[1], metalness: spec[2] }));
  }
  const GEO = {};
  const boxG = () => GEO.box || (GEO.box = new T.BoxGeometry(1, 1, 1));
  const cylG = () => { if (!GEO.cyl) { GEO.cyl = new T.CylinderGeometry(1, 1, 1, 24); GEO.cyl.translate(0, 0.5, 0); } return GEO.cyl; };
  function mesh(g, m) { const o = new T.Mesh(g, mat(m)); o.castShadow = true; o.receiveShadow = true; return o; }
  // caixa: centro, tamanho, giro (graus, em X/Y/Z)
  function box(grp, c, s, m, rot) { const o = mesh(boxG(), m || "pad"); o.position.copy(v(c)); o.scale.set(s[0], s[1], s[2]); if (rot) o.rotation.set((rot[0] || 0) * D2R, (rot[1] || 0) * D2R, (rot[2] || 0) * D2R, "YXZ"); grp.add(o); return o; }
  // cilindro entre dois pontos
  function rod(o, a, b, r) {
    a = v(a); b = v(b); const d = b.clone().sub(a), L = d.length() || 1e-4;
    o.position.copy(a); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); o.scale.set(r, L, r); return o;
  }
  function cyl(grp, a, b, r, m) { const o = mesh(cylG(), m || "metal"); rod(o, a, b, r); grp.add(o); return o; }

  // halter/barra montados num grupo local: eixo X = pegador
  function dumbbellG(len, plateR) {
    const g = new T.Group(); len = len || 0.15; plateR = plateR || 0.055;
    cyl(g, [-len / 2 - 0.06, 0, 0], [len / 2 + 0.06, 0, 0], 0.016, "chrome");
    for (const s of [-1, 1]) { cyl(g, [s * len / 2, 0, 0], [s * (len / 2 + 0.05), 0, 0], plateR, "plate"); cyl(g, [s * (len / 2 + 0.05), 0, 0], [s * (len / 2 + 0.065), 0, 0], plateR * 0.75, "metal"); }
    return g;
  }
  function barbellG(len, plates) {
    const g = new T.Group(); len = len || 1.5;
    cyl(g, [-len / 2, 0, 0], [len / 2, 0, 0], 0.014, "chrome");
    const pr = typeof plates === "number" ? plates : 0.2, pw = pr > 0.15 ? 0.06 : 0.035;
    if (plates !== false) for (const s of [-1, 1]) { const x0 = len / 2 - (pr > 0.15 ? 0.27 : 0.14); cyl(g, [s * x0, 0, 0], [s * (x0 + pw), 0, 0], pr, "plate"); cyl(g, [s * (x0 - 0.03), 0, 0], [s * x0, 0, 0], 0.03, "metal"); }
    return g;
  }
  const handP = (S, out) => { const H = B[S + "Hand"], M = B[S + "HandMiddle1"]; const h = wp(H), m = wp(M), d = m.clone().sub(h).normalize(), palm = H.userData.palm.clone().applyQuaternion(wq(H)); return { c: h.clone().addScaledVector(d, 0.06).addScaledVector(palm, out ?? 0.03), d, palm, across: new V3().crossVectors(d, palm).normalize() }; };
  // pega o objeto do grupo e põe ele atravessando a mão (pegador = eixo X local)
  function placeInHand(o, S, out) {
    const h = handP(S, out); o.position.copy(h.c);
    const x = h.across.clone(), y = h.d.clone().addScaledVector(x, -h.d.dot(x)).normalize(), z = new V3().crossVectors(x, y);
    o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z)); return h;
  }
  function placeBetween(o, a, b) {
    const c = a.clone().add(b).multiplyScalar(0.5), x = a.clone().sub(b).normalize();
    const up = Math.abs(x.y) > 0.9 ? new V3(0, 0, 1) : new V3(0, 1, 0), z = new V3().crossVectors(x, up).normalize(), y = new V3().crossVectors(z, x);
    o.position.copy(c); o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  }
  const bp = (n) => wp(B[n]);
  X.bp = bp; X.handP = (S) => handP(S);

  // o exercício monta os aparelhos via def.build(kit) e devolve atualizações por quadro
  function kit(grp) {
    return {
      T, V: (a, b, c) => new V3(a, b, c), bp, handP, dims: X.dims,
      box: (c, s, m, rot) => box(grp, c, s, m, rot),
      cyl: (a, b, r, m) => cyl(grp, a, b, r, m),
      rodMesh: (m) => { const o = mesh(cylG(), m || "cable"); grp.add(o); return o; },
      rod,
      dumbbell: (len, r) => { const o = dumbbellG(len, r); grp.add(o); return o; },
      barbell: (len, pl) => { const o = barbellG(len, pl); grp.add(o); return o; },
      group: () => { const o = new T.Group(); grp.add(o); return o; },
      inGroup: (g) => ({ box: (c, s, m, rot) => box(g, c, s, m, rot), cyl: (a, b, r, m) => cyl(g, a, b, r, m) }),
      placeInHand, placeBetween,
      // banco/assento padrão
      seat: (c, o) => { o = o || {}; const w = o.w || 0.38, d = o.d || 0.4, h = c[1]; box(grp, [c[0], h - 0.035, c[2]], [w, 0.07, d], "pad"); cyl(grp, [c[0], 0, c[2] - (o.post ?? 0.05)], [c[0], h - 0.07, c[2] - (o.post ?? 0.05)], 0.03, "frame"); box(grp, [c[0], 0.02, c[2] - (o.post ?? 0.05)], [0.5, 0.04, 0.08], "frame");
        if (o.back != null) { const L = o.backL || 0.8, a = o.back * D2R, by = h + Math.cos(a) * L / 2, bz = c[2] - d / 2 + 0.02 - Math.sin(a) * L / 2; box(grp, [c[0], by, bz - 0.03], [w * 0.85, L, 0.07], "pad", [-o.back, 0, 0]); cyl(grp, [c[0], h - 0.06, c[2] - d / 2 + 0.02], [c[0], by + Math.cos(a) * L * 0.3, bz - 0.07 - Math.sin(a) * L * 0.3], 0.025, "frame"); } },
      bench: (c, o) => { o = o || {}; const L = o.l || 1.2, w = o.w || 0.3, h = c[1]; box(grp, [c[0], h - 0.04, c[2]], [w, 0.08, L], "pad"); for (const s of [-1, 1]) { cyl(grp, [c[0], 0, c[2] + s * (L / 2 - 0.12)], [c[0], h - 0.08, c[2] + s * (L / 2 - 0.12)], 0.028, "frame"); box(grp, [c[0], 0.02, c[2] + s * (L / 2 - 0.12)], [0.42, 0.04, 0.07], "frame"); } },
      tower: (c, h, o) => { o = o || {}; box(grp, [c[0], h / 2, c[2]], [0.09, h, 0.09], "frame"); box(grp, [c[0], 0.02, c[2]], [0.5, 0.04, 0.5], "frame"); if (o.stack !== false) box(grp, [c[0] + (o.sx || 0), 0.45, c[2] + (o.sz || 0)], [0.2, 0.55, 0.12], "plate"); },
      pulley: (c) => { cyl(grp, [c[0] - 0.02, c[1], c[2]], [c[0] + 0.02, c[1], c[2]], 0.045, "metal"); },
    };
  }
  function getRig(name, def) {
    if (rigs[name]) return rigs[name];
    const grp = new T.Group(); scene.add(grp);
    // monta na pose de começo pra poder ancorar os aparelhos no corpo
    applyFrame(frames(def)[0]);
    const upd = def.build ? def.build(kit(grp)) : null;
    // limites do movimento (enquadramento): pontos do corpo + aparelhos, no começo e no meio/fim
    const box3 = new T.Box3();
    const pts = ["Head", "HeadTop_End", "LeftHand", "RightHand", "LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase", "Hips", "LeftForeArm", "RightForeArm", "LeftLeg", "RightLeg", "LeftArm", "RightArm"];
    const ks = def.loop ? def.frames.map((_, i) => i) : [0, 1];
    for (const i of ks) { applyFrame(frames(def)[Math.min(i, def.frames.length - 1)]); if (upd) upd(); for (const n of pts) if (B[n]) box3.expandByPoint(bp(n)); }
    const pb = new T.Box3().setFromObject(grp); if (!pb.isEmpty()) { box3.union(pb.intersect(new T.Box3(box3.min.clone().addScalar(-0.35), box3.max.clone().addScalar(0.35)))); }
    box3.min.y = Math.min(box3.min.y, 0);
    rigs[name] = { grp, upd, bounds: box3 };
    return rigs[name];
  }

  // ---------- desenho ----------
  const PAL = { light: ["#f4f5f7", "#d9dce1"], dark: ["#1b1e23", "#0c0d10"] };
  X.draw = function (ctx, name, t, w, h, theme, dpr, opts) {
    if (X.status !== "ready") return false;
    const def = X.EX[name]; if (!def) return false;
    const rig = getRig(name, def);
    if (curRig !== rig) { Object.values(rigs).forEach((r) => (r.grp.visible = r === rig)); curRig = rig; }
    colorize(def.hl || {});
    applyFrame(frameAt(def, t)); if (rig.upd) rig.upd();
    // câmera: gira em volta do centro do movimento e afasta até caber
    const bb = rig.bounds, ctr = bb.getCenter(new V3()), size = bb.getSize(new V3());
    const yaw = ((opts && opts.yaw) ?? def.yaw ?? 35) * D2R, pitch = ((opts && opts.pitch) ?? def.pitch ?? 8) * D2R;
    const dir = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    cam.fov = 28; cam.aspect = w / h; cam.updateProjectionMatrix();
    const vf = Math.tan((cam.fov * D2R) / 2), hf = vf * cam.aspect;
    const corners = []; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners.push(new V3(x, y, z));
    const right = new V3().crossVectors(new V3(0, 1, 0), dir).normalize(), up = new V3().crossVectors(dir, right);
    let dist = 0.5; for (const p of corners) { const q = p.clone().sub(ctr), x = Math.abs(q.dot(right)), y = Math.abs(q.dot(up)), z = q.dot(dir); dist = Math.max(dist, z + x / hf, z + y / vf); }
    dist *= (def.zoom ? 1 / def.zoom : 1) * 1.06;
    cam.position.copy(ctr).addScaledVector(dir, dist); cam.lookAt(ctr);
    key.position.set(ctr.x - 1.4, 3.6, ctr.z + 2.2); key.target.position.copy(ctr); floor.position.set(ctr.x, 0, ctr.z);
    dpr = Math.min(2, dpr || 1);
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr)), cv = renderer.domElement;
    if (cv.width < W || cv.height < H) renderer.setSize(Math.max(cv.width, W), Math.max(cv.height, H), false);
    renderer.setViewport(0, cv.height - H, W, H); renderer.setScissor(0, cv.height - H, W, H); renderer.setScissorTest(true);
    renderer.clear(); renderer.render(scene, cam);
    const pal = PAL[theme === "light" ? "light" : "dark"];
    const g = ctx.createRadialGradient(w * 0.5, h * 0.32, Math.min(w, h) * 0.05, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(cv, 0, 0, W, H, 0, 0, w, h);
    return true;
  };
  X.frameText = (name, t) => { const def = X.EX[name]; if (!def || !def.cue) return ""; const { k } = phase(def, t); return k > 0.5 ? def.cue[1] : def.cue[0]; };
})();
