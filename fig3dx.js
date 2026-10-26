// ============================================================
//  Boneco 3D profissional (X Bot, Mixamo) renderizado com Three.js.
//  As poses vêm do mesmo esqueleto de fig3d.js; os músculos-alvo são
//  pintados direto na superfície. Enquanto carrega (ou se falhar),
//  o app usa o boneco desenhado em fig3dgl.js.
// ============================================================
(function () {
  "use strict";
  const F = window.FIG3D; if (!F) return;
  const X = { status: "idle", onReady: null };
  window.FIG3DX = X;
  let T = null, renderer = null, scene = null, cam = null, model = null, surf = null, rig = null, regions = null, curHl = null, sc = 1;
  let hipOff = null, pool = { box: [], cyl: [] }, used = { box: 0, cyl: 0 }, mats = {}, key = null, catcher = null;

  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  X.start = async function (base) {
    if (X.status !== "idle") return;
    X.status = "loading";
    try {
      if (!window.THREE) await loadScript((base || "") + "three.min.js");
      if (!window.THREE.GLTFLoader) await loadScript((base || "") + "GLTFLoader.js");
      T = window.THREE;
      let gltf;
      if (window.__XBOT_B64) { // prévia: boneco embutido na página, lido sem rede
        const bin = atob(window.__XBOT_B64), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        gltf = await new Promise((res, rej) => new T.GLTFLoader().parse(buf.buffer, "", res, rej));
      } else {
        const r = await fetch((base || "") + "xbot.glb"); if (!r.ok) throw new Error("xbot " + r.status);
        const ab = await r.arrayBuffer();
        gltf = await new Promise((res, rej) => new T.GLTFLoader().parse(ab, "", res, rej));
      }
      setup(gltf);
      X.status = "ready";
      if (X.onReady) X.onReady();
    } catch (e) { console.warn("3D profissional indisponível", e); X.status = "fail"; }
  };

  // ---------- cena ----------
  const lin = (c) => c.map((v) => Math.pow(v, 2.2));
  function setup(gltf) {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xe8eef6, 0x5a544e, 0.75));
    key = new T.DirectionalLight(0xffffff, 1.9); key.position.set(-0.8, 5, 1.4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 7; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 0.5, far: 9 });
    scene.add(key); scene.add(key.target);
    const fill = new T.DirectionalLight(0xd8e2ff, 0.45); fill.position.set(2.5, 1.2, 1.5); scene.add(fill);
    const rim = new T.DirectionalLight(0xffffff, 0.9); rim.position.set(0.6, 2.2, -3); scene.add(rim);
    catcher = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ opacity: 0.16 }));
    catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true; scene.add(catcher);
    cam = new T.PerspectiveCamera(30, 1, 0.05, 30);

    model = gltf.scene; scene.add(model);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const isJoint = /joint/i.test((o.material && o.material.name) || "");
      if (isJoint) o.material = new T.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.42, metalness: 0.35 });
      else { o.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.04 }); surf = o; }
    });
    // ossos
    const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/, "")] = o; });
    model.updateMatrixWorld(true);
    // escala: perna do boneco = perna do nosso esqueleto
    const wp = (b) => b.getWorldPosition(new T.Vector3());
    const legLen = wp(bones.LeftUpLeg).distanceTo(wp(bones.LeftLeg)) + wp(bones.LeftLeg).distanceTo(wp(bones.LeftFoot));
    sc = (F.B.thigh + F.B.shin) / legLen; model.scale.multiplyScalar(sc); model.updateMatrixWorld(true);
    // guarda a pose de referência
    rig = {};
    const want = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"];
    const child = { LeftArm: "LeftForeArm", LeftForeArm: "LeftHand", LeftHand: "LeftHandMiddle1", RightArm: "RightForeArm", RightForeArm: "RightHand", RightHand: "RightHandMiddle1", LeftUpLeg: "LeftLeg", LeftLeg: "LeftFoot", LeftFoot: "LeftToeBase", RightUpLeg: "RightLeg", RightLeg: "RightFoot", RightFoot: "RightToeBase", Neck: "Head", Spine: "Spine1", Spine1: "Spine2", Spine2: "Neck" };
    const myDir = { LeftArm: [0, -1, 0], LeftForeArm: [0, -1, 0], LeftHand: [0, -1, 0], RightArm: [0, -1, 0], RightForeArm: [0, -1, 0], RightHand: [0, -1, 0], LeftUpLeg: [0, -1, 0], LeftLeg: [0, -1, 0], RightUpLeg: [0, -1, 0], RightLeg: [0, -1, 0], LeftFoot: [0, -0.2, 1], RightFoot: [0, -0.2, 1] };
    Object.values(bones).forEach((b) => { b.userData.q0 = b.quaternion.clone(); b.userData.p0 = b.position.clone(); });
    for (const n of want) {
      const b = bones[n]; if (!b) continue;
      const Qb = b.getWorldQuaternion(new T.Quaternion());
      let qa = new T.Quaternion();
      if (myDir[n] && bones[child[n]]) { const db = wp(bones[child[n]]).sub(wp(b)).normalize(); qa.setFromUnitVectors(db, new T.Vector3(...myDir[n]).normalize()); }
      rig[n] = { b, Qb, qa };
    }
    const mid = wp(bones.LeftUpLeg).add(wp(bones.RightUpLeg)).multiplyScalar(0.5);
    hipOff = wp(bones.Hips).sub(mid);
    regions = paintRegions(bones);
  }

  // ---------- regiões musculares na superfície ----------
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function paintRegions(bones) {
    const g = surf.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, sk = surf.skeleton.bones;
    const n = pos.count, reg = new Uint8Array(n), wt = new Float32Array(n);
    const wpos = (b) => b.getWorldPosition(new T.Vector3());
    const yHips = wpos(bones.Hips).y, yChest = wpos(bones.Spine2).y, yNeck = wpos(bones.Neck).y, yKnee = wpos(bones.LeftLeg).y, yAnkle = wpos(bones.LeftFoot).y;
    const shL = wpos(bones.LeftArm), shR = wpos(bones.RightArm);
    const v = new T.Vector3(), nn = new T.Vector3(), nm = new T.Matrix3().getNormalMatrix(surf.matrixWorld);
    const names = sk.map((b) => b.name.replace(/^mixamorig:?/, ""));
    g.setAttribute("color", new T.BufferAttribute(new Float32Array(n * 3), 3));
    for (let i = 0; i < n; i++) {
      const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (ws[k] > bw) { bw = ws[k]; best = is[k]; }
      const bn = names[best] || "";
      v.fromBufferAttribute(pos, i).multiplyScalar(sc); nn.fromBufferAttribute(nor, i).normalize();
      let r = 0, w = 0;
      const set = (rr, ww) => { if (ww > w) { r = rr; w = ww; } };
      if (/UpLeg$/.test(bn)) { set(1, ss(0.05, 0.45, nn.z)); set(2, ss(0.05, 0.45, -nn.z)); if (v.y > yHips - 0.06) { set(3, ss(0.1, 0.5, -nn.z) * 0.9); } }
      else if (/Leg$/.test(bn)) { if (v.y > yAnkle + (yKnee - yAnkle) * 0.35) set(4, ss(0.0, 0.4, -nn.z)); }
      else if (bn === "Hips") { if (v.y < yHips + 0.02) set(3, ss(0.1, 0.5, -nn.z)); set(12, ss(0.55, 0.85, Math.abs(nn.x)) * (v.y > yHips - 0.06 ? 1 : 0)); set(7, ss(0.3, 0.6, nn.z) * (v.y > yHips + 0.03 ? 1 : 0)); }
      else if (bn === "Spine" || bn === "Spine1" || bn === "Spine2") {
        if (v.y > yChest - 0.09 && v.y < yNeck - 0.03 && Math.abs(v.x) < 0.17) set(5, ss(0.15, 0.5, nn.z)); else set(7, ss(0.25, 0.6, nn.z) * (Math.abs(v.x) < 0.13 ? 1 : 0.4));
        if (v.y > yHips + 0.12) set(6, ss(0.15, 0.5, -nn.z) * (v.y < yNeck - 0.05 ? 1 : 0)); else set(8, ss(0.25, 0.6, -nn.z));
      }
      else if (/Shoulder$/.test(bn)) { const sh = bn.startsWith("Left") ? shL : shR; if (Math.abs(v.x) > Math.abs(sh.x) - 0.03 && v.y > sh.y - 0.12) set(9, 1); }
      else if (/Arm$/.test(bn) && !/Fore/.test(bn)) {
        const sh = bn.startsWith("Left") ? shL : shR, d = Math.abs(v.x - sh.x);
        if (d < 0.13) set(9, 1 - ss(0.09, 0.13, d)); set(10, ss(0.2, 0.55, nn.z) * ss(0.09, 0.13, d)); set(11, ss(0.2, 0.55, -nn.z) * ss(0.09, 0.13, d));
      }
      reg[i] = r; wt[i] = w;
    }
    return { reg, wt };
  }
  const REGN = { quad: 1, post: 2, glute: 3, calf: 4, peito: 5, costas: 6, abdomen: 7, lombar: 8, delt: 9, biceps: 10, triceps: 11, glutmed: 12 };
  function colorize(hl) {
    const k = hl.join(","); if (k === curHl) return; curHl = k;
    const on = new Set(hl.map((h) => REGN[h]).filter(Boolean)), col = surf.geometry.attributes.color;
    const base = lin([0.84, 0.86, 0.89]), red = lin([0.97, 0.34, 0.2]);
    if (X.debug) { const HUE = [[0.85, 0.85, 0.85], [1, 0, 0], [0, 0, 1], [1, 0.5, 0], [0, 0.8, 0], [1, 0, 1], [0, 1, 1], [1, 1, 0], [0.5, 0.25, 0], [0.6, 0, 1], [0, 0.4, 0.2], [0.4, 0.4, 1], [1, 0.6, 0.8]]; for (let i = 0; i < regions.reg.length; i++) { const c = lin(HUE[regions.reg[i]] || HUE[0]), t = regions.wt[i] > 0.3 ? 1 : 0; col.setXYZ(i, base[0] + (c[0] - base[0]) * t, base[1] + (c[1] - base[1]) * t, base[2] + (c[2] - base[2]) * t); } col.needsUpdate = true; return; }
    for (let i = 0; i < regions.reg.length; i++) {
      const w = on.has(regions.reg[i]) ? regions.wt[i] : 0, t = Math.min(1, Math.max(0, (w - 0.1) / 0.6));
      col.setXYZ(i, base[0] + (red[0] - base[0]) * t, base[1] + (red[1] - base[1]) * t, base[2] + (red[2] - base[2]) * t);
    }
    col.needsUpdate = true;
  }

  // ---------- pose ----------
  const qOf = (M) => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().set(M[0], M[1], M[2], 0, M[3], M[4], M[5], 0, M[6], M[7], M[8], 0, 0, 0, 0, 1));
  function setWorldQ(name, Qw) {
    const r = rig[name]; if (!r) return;
    const b = r.b, pq = b.parent.getWorldQuaternion(new T.Quaternion());
    b.quaternion.copy(pq.invert().multiply(Qw));
    b.updateMatrixWorld(true);
  }
  function pose(J) {
    Object.values(rig).forEach((r) => { r.b.quaternion.copy(r.b.userData.q0); r.b.position.copy(r.b.userData.p0); });
    model.updateMatrixWorld(true);
    const q0 = qOf(J.M0), qt = qOf(J.Mt), qh = qOf(J.Mh);
    // quadril: posição e giro
    const hips = rig.Hips.b, off = hipOff.clone().applyQuaternion(q0);
    const target = new T.Vector3(J.pelvis[0], J.pelvis[1], J.pelvis[2]).add(off);
    setWorldQ("Hips", q0.clone().multiply(rig.Hips.qa).multiply(rig.Hips.Qb));
    hips.parent.updateMatrixWorld(true);
    hips.position.copy(hips.parent.worldToLocal(target)); hips.updateMatrixWorld(true);
    // coluna: o giro do tronco vai sendo distribuído
    [["Spine", 0.34], ["Spine1", 0.67], ["Spine2", 1]].forEach(([n, f]) => setWorldQ(n, q0.clone().slerp(qt, f).multiply(rig[n].qa).multiply(rig[n].Qb)));
    setWorldQ("Neck", qt.clone().slerp(qh, 0.5).multiply(rig.Neck.qa).multiply(rig.Neck.Qb));
    setWorldQ("Head", qh.clone().multiply(rig.Head.qa).multiply(rig.Head.Qb));
    for (const s of ["L", "R"]) {
      const S = s === "L" ? "Left" : "Right";
      setWorldQ(S + "Arm", qOf(J["Ms" + s]).multiply(rig[S + "Arm"].qa).multiply(rig[S + "Arm"].Qb));
      setWorldQ(S + "ForeArm", qOf(J["Me" + s]).multiply(rig[S + "ForeArm"].qa).multiply(rig[S + "ForeArm"].Qb));
      setWorldQ(S + "Hand", qOf(J["Me" + s]).multiply(rig[S + "Hand"].qa).multiply(rig[S + "Hand"].Qb));
      setWorldQ(S + "UpLeg", qOf(J["Mth" + s]).multiply(rig[S + "UpLeg"].qa).multiply(rig[S + "UpLeg"].Qb));
      setWorldQ(S + "Leg", qOf(J["Msh" + s]).multiply(rig[S + "Leg"].qa).multiply(rig[S + "Leg"].Qb));
      setWorldQ(S + "Foot", qOf(J["Mf" + s]).multiply(rig[S + "Foot"].qa).multiply(rig[S + "Foot"].Qb));
    }
  }

  // ---------- aparelhos ----------
  const PC = { prop: [0.42, 0.45, 0.5], pad: [0.17, 0.19, 0.23], metal: [0.66, 0.69, 0.73], plate: [0.13, 0.14, 0.16], rope: [0.82, 0.75, 0.58], cable: [0.6, 0.62, 0.66], skin: [0.84, 0.86, 0.89], hl: [0.97, 0.34, 0.2] };
  function mat(c) { if (!mats[c]) { const v = lin(PC[c] || PC.prop); mats[c] = new T.MeshStandardMaterial({ color: new T.Color(v[0], v[1], v[2]), roughness: c === "metal" ? 0.3 : 0.6, metalness: c === "metal" ? 0.7 : 0.05 }); } return mats[c]; }
  function get(kind) {
    if (used[kind] < pool[kind].length) return pool[kind][used[kind]++];
    const g = kind === "box" ? new T.BoxGeometry(2, 2, 2) : new T.CylinderGeometry(1, 1, 1, 24);
    if (kind === "cyl") g.translate(0, 0.5, 0);
    const m = new T.Mesh(g, mat("prop")); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); pool[kind].push(m); used[kind]++; return m;
  }
  const basis = (a, b) => { const y = new T.Vector3(...b).sub(new T.Vector3(...a)).normalize(), t = Math.abs(y.y) < 0.95 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0), x = new T.Vector3().crossVectors(y, t).normalize(), z = new T.Vector3().crossVectors(x, y); return [x, y, z]; };
  function props(J, def) {
    used.box = 0; used.cyl = 0;
    const pp = []; F.propPrims(J, def.props, pp);
    for (const q of pp) {
      if (q.t === "box") { const m = get("box"); m.material = mat(q.col); m.matrix.makeBasis(new T.Vector3(...q.ax).multiplyScalar(q.h[0]), new T.Vector3(...q.ay).multiplyScalar(q.h[1]), new T.Vector3(...q.az).multiplyScalar(q.h[2])).setPosition(...q.c); m.visible = true; }
      else if (q.t === "cap" || q.t === "line" || q.t === "disc") {
        let a = q.a, b = q.b, r = q.t === "line" ? 0.005 : ((q.ra || 0) + (q.rb ?? q.ra ?? 0)) / 2;
        if (q.t === "disc") { const nn = F.norm(q.n); a = F.sub(q.c, F.mul(nn, q.w / 2)); b = F.add(q.c, F.mul(nn, q.w / 2)); r = q.r; }
        const [x, y, z] = basis(a, b), L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const m = get("cyl"); m.material = mat(q.col === "cable" ? "cable" : q.col); m.matrix.makeBasis(x.multiplyScalar(r), y.multiplyScalar(L), z.multiplyScalar(r)).setPosition(...a); m.visible = true;
      }
    }
    for (const k of ["box", "cyl"]) for (let i = used[k]; i < pool[k].length; i++) pool[k][i].visible = false;
  }

  // ---------- desenho ----------
  X.draw = function (ctx, name, t, w, h, theme, dpr) {
    if (X.status !== "ready") return false;
    const def = F.ANIM3[name] || F.ANIM3.parado;
    if (!F.CACHE[name]) F.CACHE[name] = F.boundsOf(def);
    const c3 = F.camera({ ...def, zoom: (def.zoom || 0.93) * 0.9 }, w, h, F.CACHE[name]);
    const dur = def.dur || 2.6, ph = (t % dur) / dur, k = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
    const fr = def.frames.length > 1 ? F.mix(F.expand(def.frames[0]), F.expand(def.frames[1]), k) : F.expand(def.frames[0]);
    const J = F.solve(fr);
    colorize(def.hl || []);
    pose(J); props(J, def);
    const ctr = F.CACHE[name].c; key.target.position.set(ctr[0], 0.5, ctr[2]); key.position.set(ctr[0] - 0.8, 5, ctr[2] + 1.4); catcher.position.set(ctr[0], 0, ctr[2]);
    dpr = Math.min(2, dpr || 1);
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    const cv = renderer.domElement;
    if (cv.width < W || cv.height < H) renderer.setSize(Math.max(cv.width, W), Math.max(cv.height, H), false);
    cam.fov = (2 * Math.atan(h / 2 / c3.f) * 180) / Math.PI; cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(...c3.eye); cam.up.set(...c3.up); cam.lookAt(c3.eye[0] + c3.fwd[0], c3.eye[1] + c3.fwd[1], c3.eye[2] + c3.fwd[2]);
    renderer.setViewport(0, cv.height - H, W, H); renderer.setScissor(0, cv.height - H, W, H); renderer.setScissorTest(true);
    renderer.clear(); renderer.render(scene, cam);
    const pal = F.PAL[theme === "light" ? "light" : "dark"];
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.3, Math.min(w, h) * 0.05, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
    bg.addColorStop(0, pal.bg0); bg.addColorStop(1, pal.bg1); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(cv, 0, 0, W, H, 0, 0, w, h);
    return true;
  };
})();
