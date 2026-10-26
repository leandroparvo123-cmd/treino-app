// ============================================================
//  Manequim 3D de verdade (WebGL, sem bibliotecas).
//  Usa o mesmo esqueleto e os mesmos movimentos de fig3d.js.
//  Se o aparelho não tiver WebGL, o app continua com o desenho em 2D.
// ============================================================
(function () {
  "use strict";
  const F = window.FIG3D; if (!F) return;
  const { solve, expand, mix, camera, boundsOf, PAL, CACHE, B, mm, mv, Rx, norm, cross, sub, add, mul, dot } = F;
  let gl = null, cv = null, prog = null, progFlat = null, ok = false;

  // ---------- shaders ----------
  const VS = `attribute vec3 p; attribute vec3 n; attribute vec3 c;
    uniform mat4 M; uniform mat3 N; uniform mat4 VP; varying vec3 vN; varying vec3 vC; varying vec3 vW;
    void main(){ vec4 w = M * vec4(p,1.0); vW = w.xyz; vN = normalize(N * n); vC = c; gl_Position = VP * w; }`;
  const FS = `precision mediump float; varying vec3 vN; varying vec3 vC; varying vec3 vW;
    uniform vec3 eye; uniform vec3 L1; uniform vec3 L2; uniform float spec;
    void main(){
      vec3 Nn = normalize(vN); vec3 V = normalize(eye - vW);
      if (dot(Nn, V) < 0.0) Nn = -Nn;
      float d1 = max(dot(Nn, L1), 0.0), d2 = max(dot(Nn, L2), 0.0);
      float hemi = 0.5 + 0.5 * Nn.y;
      vec3 amb = mix(vec3(0.34,0.33,0.32), vec3(0.62,0.64,0.68), hemi);
      vec3 H = normalize(L1 + V); float s = pow(max(dot(Nn, H), 0.0), 28.0) * spec;
      float fr = 1.0 - max(dot(Nn, V), 0.0);
      float edge = mix(1.0, 0.62, pow(fr, 1.8));
      float rim = pow(fr, 3.0) * max(dot(Nn, normalize(vec3(0.3, 0.4, -1.0))), 0.0) * 0.55;
      float ao = 0.7 + 0.3 * hemi;
      vec3 col = vC * (amb * ao * 0.78 + d1 * vec3(0.95,0.93,0.88) + d2 * vec3(0.16,0.18,0.24)) * edge + vec3(s) + rim * vec3(0.9,0.93,1.0);
      gl_FragColor = vec4(pow(col, vec3(0.95)), 1.0);
    }`;
  const VSF = `attribute vec3 p; uniform mat4 M; uniform mat4 VP; uniform vec3 Ld; void main(){ vec4 w = M * vec4(p,1.0); float t = w.y / max(Ld.y, 0.2); vec3 q = w.xyz - Ld * t; q.y = 0.002; gl_Position = VP * vec4(q,1.0); }`;
  const FSF = `precision mediump float; uniform vec4 col; void main(){ gl_FragColor = col; }`;

  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function link(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
  function init() {
    try {
      cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
      gl = cv.getContext("webgl", { antialias: true, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
      if (!gl) return false;
      prog = link(VS, FS); progFlat = link(VSF, FSF);
      gl.enable(gl.DEPTH_TEST);
      ok = true;
    } catch (e) { console.warn("3D", e); ok = false; }
    return ok;
  }

  // ---------- malhas ----------
  const lerpKeys = (keys, vals, x) => { if (x <= keys[0]) return vals[0]; for (let i = 1; i < keys.length; i++) if (x <= keys[i]) { const t = (x - keys[i - 1]) / (keys[i] - keys[i - 1]); const s = t * t * (3 - 2 * t); return vals[i - 1] + (vals[i] - vals[i - 1]) * s; } return vals[vals.length - 1]; };
  const angd = (a, b) => { let d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };
  // superfície de revolução ao longo de Y (y0 → y1), seção elíptica rx/rz, calombos musculares e tampas redondas
  // shape(y) → [rx, rz]; bumps: {y, th, sy, sth, a, reg}; regFn(y,th) → [reg, w] para cor
  function revolve(y0, y1, shape, bumps, opt) {
    const R = opt.rings || 22, S = opt.seg || 22, cap = opt.cap ?? 0.16;
    const P = [], NR = R + 1;
    for (let i = 0; i <= R; i++) {
      const u = i / R; let y, k = 1;
      if (u < cap) { const q = 1 - u / cap; y = y0; k = Math.sqrt(Math.max(0, 1 - q * q)); }
      else if (u > 1 - cap) { const q = (u - (1 - cap)) / cap; y = y1; k = Math.sqrt(Math.max(0, 1 - q * q)); }
      else y = y0 + ((u - cap) / (1 - 2 * cap)) * (y1 - y0);
      const [rx, rz] = shape(y), ring = [];
      // deslocamento nas tampas pra ficarem arredondadas
      let yy = y; if (u < cap) yy = y0 - Math.sign(y1 - y0) * (1 - k) * 0 - Math.sign(y1 - y0) * Math.sqrt(Math.max(0, 1 - k * k)) * Math.min(rx, rz) * (opt.capScale ?? 0.9);
      if (u > 1 - cap) yy = y1 + Math.sign(y1 - y0) * Math.sqrt(Math.max(0, 1 - k * k)) * Math.min(rx, rz) * (opt.capScale ?? 0.9);
      for (let j = 0; j < S; j++) {
        const th = (j / S) * Math.PI * 2;
        let b = 0; for (const m of bumps) b += m.a * Math.exp(-(((y - m.y) / m.sy) ** 2) - ((angd(th, m.th) / m.sth) ** 2));
        const r = 1 + b / Math.max(0.03, Math.min(rx, rz));
        ring.push([Math.cos(th) * rx * r * k, yy, Math.sin(th) * rz * r * k, y, th]);
      }
      P.push(ring);
    }
    // normais por diferenças finitas
    const pos = [], nrm = [], col = [], idx = [];
    for (let i = 0; i <= R; i++) for (let j = 0; j < S; j++) {
      const a = P[Math.min(R, i + 1)][j], b2 = P[Math.max(0, i - 1)][j], c = P[i][(j + 1) % S], d = P[i][(j - 1 + S) % S];
      let du = sub(a, b2), dv = sub(c, d); let n = norm(cross(dv, du));
      if (len3(du) < 1e-6) n = [0, Math.sign(i < R / 2 ? y0 - y1 : y1 - y0), 0];
      const q = P[i][j]; pos.push(q[0], q[1], q[2]);
      // normal apontando pra fora
      if (q[0] * n[0] + q[2] * n[2] < -1e-5) n = mul(n, -1);
      nrm.push(n[0], n[1], n[2]);
      const [reg, w] = opt.regFn ? opt.regFn(q[3], q[4]) : [0, 0];
      col.push(reg, w, 0);
    }
    for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a = i * S + j, b2 = i * S + (j + 1) % S, c = (i + 1) * S + j, d = (i + 1) * S + (j + 1) % S; idx.push(a, c, b2, b2, c, d); }
    return { pos, nrm, col, idx };
  }
  const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
  function ellMesh(rx, ry, rz, reg) { return revolve(-ry, ry, (y) => { const k = Math.sqrt(Math.max(0.0001, 1 - (y / ry) ** 2)); return [rx * k, rz * k]; }, [], { rings: 18, seg: 20, cap: 0, regFn: () => [reg || 0, reg ? 1 : 0] }); }
  function boxMesh() { // cubo unitário (-1..1)
    const pos = [], nrm = [], col = [], idx = [];
    const F6 = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    F6.forEach(([n, u, w], f) => { [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { pos.push(n[0] + u[0] * a + w[0] * b, n[1] + u[1] * a + w[1] * b, n[2] + u[2] * a + w[2] * b); nrm.push(...n); col.push(0, 0, 0); }); const o = f * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); });
    return { pos, nrm, col, idx };
  }
  function cylMesh() { // cilindro unitário ao longo de Y (0..1), raio 1, com tampas
    const pos = [], nrm = [], col = [], idx = [], S = 20;
    for (let j = 0; j < S; j++) { const th = (j / S) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th); pos.push(c, 0, s, c, 1, s); nrm.push(c, 0, s, c, 0, s); col.push(0, 0, 0, 0, 0, 0); }
    for (let j = 0; j < S; j++) { const a = j * 2, b = ((j + 1) % S) * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    [0, 1].forEach((yv) => { const o = pos.length / 3; pos.push(0, yv, 0); nrm.push(0, yv ? 1 : -1, 0); col.push(0, 0, 0); for (let j = 0; j < S; j++) { const th = (j / S) * Math.PI * 2; pos.push(Math.cos(th), yv, Math.sin(th)); nrm.push(0, yv ? 1 : -1, 0); col.push(0, 0, 0); } for (let j = 0; j < S; j++) idx.push(o, o + 1 + j, o + 1 + ((j + 1) % S)); });
    return { pos, nrm, col, idx };
  }

  // regiões musculares → índice
  const REG = { quad: 1, post: 2, glute: 3, calf: 4, peito: 5, costas: 6, abdomen: 7, lombar: 8, delt: 9, biceps: 10, triceps: 11, glutmed: 12, shorts: 13 };
  const g = (y, th, y0, th0, sy, sth) => Math.exp(-(((y - y0) / sy) ** 2) - ((angd(th, th0) / sth) ** 2));
  const FRONT = Math.PI / 2, BACK = Math.PI * 1.5;
  // peças do corpo (em coordenadas locais da articulação), lado: +1 esquerda, -1 direita
  function buildParts(side) {
    const sg = side, LAT = sg > 0 ? 0 : Math.PI; // lado de fora
    const parts = {};
    // pelve (quadro M0, origem na pelve)
    parts.pelvis = revolve(-0.15, 0.09, (y) => [lerpKeys([-0.15, -0.08, 0.0, 0.09], [0.11, 0.16, 0.168, 0.15], y), lerpKeys([-0.15, -0.08, 0.0, 0.09], [0.08, 0.115, 0.118, 0.105], y)],
      [{ y: -0.05, th: BACK + 0.45, sy: 0.06, sth: 0.4, a: 0.028 }, { y: -0.05, th: BACK - 0.45, sy: 0.06, sth: 0.4, a: 0.028 }],
      { rings: 18, seg: 26, cap: 0.22, regFn: (y, th) => { const gl1 = Math.max(g(y, th, -0.05, BACK + 0.45, 0.07, 0.55), g(y, th, -0.05, BACK - 0.45, 0.07, 0.55)); const gm = Math.max(g(y, th, 0.02, 0, 0.06, 0.4), g(y, th, 0.02, Math.PI, 0.06, 0.4)); return gl1 > 0.25 ? [3, Math.min(1, gl1 * 1.6)] : gm > 0.3 ? [12, Math.min(1, gm * 1.5)] : [13, 1]; } });
    // tronco (quadro Mt, origem na pelve)
    const ty = [0.04, 0.1, 0.18, 0.26, 0.33, 0.4, 0.46, 0.52];
    parts.torso = revolve(0.04, 0.53, (y) => [lerpKeys(ty, [0.15, 0.135, 0.128, 0.142, 0.168, 0.19, 0.185, 0.12], y), lerpKeys(ty, [0.1, 0.092, 0.09, 0.098, 0.11, 0.116, 0.108, 0.075], y)],
      [{ y: 0.37, th: FRONT - 0.42, sy: 0.05, sth: 0.34, a: 0.032 }, { y: 0.37, th: FRONT + 0.42, sy: 0.05, sth: 0.34, a: 0.032 },
        ...[0.1, 0.165, 0.23].flatMap((yy) => [{ y: yy, th: FRONT - 0.17, sy: 0.022, sth: 0.13, a: 0.009 }, { y: yy, th: FRONT + 0.17, sy: 0.022, sth: 0.13, a: 0.009 }]),
        { y: 0.32, th: BACK - 0.75, sy: 0.08, sth: 0.35, a: 0.022 }, { y: 0.32, th: BACK + 0.75, sy: 0.08, sth: 0.35, a: 0.022 }, { y: 0.47, th: BACK, sy: 0.04, sth: 0.6, a: 0.012 }],
      { rings: 26, seg: 30, cap: 0.12, capScale: 0.35, regFn: (y, th) => {
        const pe = Math.max(g(y, th, 0.37, FRONT - 0.4, 0.06, 0.42), g(y, th, 0.37, FRONT + 0.4, 0.06, 0.42));
        const ab = g(y, th, 0.17, FRONT, 0.1, 0.42), la = Math.max(g(y, th, 0.3, BACK - 0.75, 0.1, 0.45), g(y, th, 0.3, BACK + 0.75, 0.1, 0.45)), lo = g(y, th, 0.1, BACK, 0.06, 0.35);
        const m = Math.max(pe, ab, la, lo); if (m < 0.2) return [0, 0];
        return m === pe ? [5, Math.min(1, pe * 1.5)] : m === ab ? [7, Math.min(1, ab * 1.4)] : m === la ? [6, Math.min(1, la * 1.5)] : [8, Math.min(1, lo * 1.5)]; } });
    parts.neck = revolve(0.0, 0.11, () => [0.048, 0.046], [], { rings: 8, seg: 16, cap: 0.0 });
    parts.head = revolve(-0.112, 0.112, (y) => { const k = Math.sqrt(Math.max(0.0001, 1 - (y / 0.112) ** 2)); return [0.084 * k, 0.098 * k]; }, [{ y: -0.06, th: FRONT, sy: 0.04, sth: 0.7, a: 0.01 }], { rings: 18, seg: 22, cap: 0 });
    // braço (quadro Ms, origem no ombro, para baixo)
    parts.upper = revolve(0.0, -B.upper, (y) => { const t = -y / B.upper, r = lerpKeys([0, 0.2, 0.5, 0.8, 1], [0.058, 0.062, 0.06, 0.05, 0.043], t); return [r, r * 0.95]; },
      [{ y: -B.upper * 0.5, th: FRONT, sy: 0.06, sth: 0.55, a: 0.017 }, { y: -B.upper * 0.42, th: BACK, sy: 0.07, sth: 0.6, a: 0.015 }],
      { rings: 20, seg: 22, cap: 0.14, regFn: (y, th) => { const bi = g(y, th, -B.upper * 0.5, FRONT, 0.08, 0.75), tr = g(y, th, -B.upper * 0.42, BACK, 0.09, 0.8); return bi > tr ? [10, Math.min(1, bi * 1.4)] : [11, Math.min(1, tr * 1.4)]; } });
    parts.delt = revolve(-0.09, 0.07, (y) => { const k = Math.sqrt(Math.max(0.0001, 1 - ((y + 0.01) / 0.085) ** 2)); return [0.08 * k, 0.078 * k]; }, [], { rings: 14, seg: 20, cap: 0, regFn: () => [9, 1] });
    parts.fore = revolve(0.0, -B.fore, (y) => { const t = -y / B.fore, r = lerpKeys([0, 0.18, 0.45, 0.8, 1], [0.044, 0.05, 0.046, 0.034, 0.03], t); return [r, r * 0.86]; }, [], { rings: 16, seg: 20, cap: 0.14 });
    parts.hand = revolve(-0.055, 0.04, (y) => { const k = Math.sqrt(Math.max(0.0001, 1 - ((y + 0.008) / 0.05) ** 2)); return [0.036 * k, 0.026 * k]; }, [], { rings: 12, seg: 16, cap: 0 });
    // coxa (quadro Mth, origem no quadril)
    parts.thigh = revolve(0.03, -B.thigh, (y) => { const t = -y / B.thigh, r = lerpKeys([0, 0.15, 0.45, 0.8, 1], [0.096, 0.1, 0.092, 0.072, 0.058], t); return [r, r * 1.02]; },
      [{ y: -B.thigh * 0.55, th: FRONT, sy: 0.1, sth: 0.65, a: 0.024 }, { y: -B.thigh * 0.8, th: FRONT - sg * 0.6, sy: 0.05, sth: 0.4, a: 0.016 }, { y: -B.thigh * 0.5, th: BACK, sy: 0.12, sth: 0.7, a: 0.016 }],
      { rings: 24, seg: 24, cap: 0.1, regFn: (y, th) => { const t = -y / B.thigh; if (t < 0.22) return [13, 1]; const q = Math.max(g(y, th, -B.thigh * 0.58, FRONT, 0.14, 0.95), g(y, th, -B.thigh * 0.8, FRONT - sg * 0.6, 0.06, 0.5)), p = g(y, th, -B.thigh * 0.58, BACK, 0.15, 0.95); return q > p ? [1, Math.min(1, q * 1.4)] : [2, Math.min(1, p * 1.4)]; } });
    parts.knee = revolve(-0.05, 0.05, (y) => { const k = Math.sqrt(Math.max(0.0001, 1 - (y / 0.05) ** 2)); return [0.056 * k, 0.056 * k]; }, [], { rings: 10, seg: 16, cap: 0 });
    parts.shin = revolve(0.0, -B.shin, (y) => { const t = -y / B.shin, r = lerpKeys([0, 0.2, 0.45, 0.8, 1], [0.056, 0.062, 0.056, 0.04, 0.034], t); return [r, r]; },
      [{ y: -B.shin * 0.28, th: BACK - 0.3, sy: 0.07, sth: 0.45, a: 0.022 }, { y: -B.shin * 0.28, th: BACK + 0.3, sy: 0.07, sth: 0.45, a: 0.02 }],
      { rings: 20, seg: 22, cap: 0.1, regFn: (y, th) => { const c = g(y, th, -B.shin * 0.3, BACK, 0.1, 0.8); return [4, Math.min(1, c * 1.4)]; } });
    parts.foot = revolve(-0.12, 0.12, (y) => { const k = Math.sqrt(Math.max(0.0001, 1 - (y / 0.12) ** 2)); return [0.045 * k, 0.032 * k]; }, [], { rings: 14, seg: 16, cap: 0 });
    return parts;
  }

  // ---------- buffers (uma vez por peça e por combinação de destaque) ----------
  const GEO = {};
  function upload(m) {
    const b = { n: m.idx.length };
    const mk = (arr) => { const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return bf; };
    b.p = mk(m.pos); b.nr = mk(m.nrm); b.c = mk(m.col); b.raw = m;
    b.i = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.idx), gl.STATIC_DRAW);
    return b;
  }
  function geo(key, build) { if (!GEO[key]) GEO[key] = upload(build()); return GEO[key]; }
  // cor por vértice conforme os músculos em destaque
  const colorBufs = {};
  function colored(key, part, hlKey, pal) {
    const ck = key + "|" + hlKey + "|" + pal.name;
    if (colorBufs[ck]) return colorBufs[ck];
    const raw = part.raw, hl = hlKey.split(","), out = new Float32Array(raw.col.length);
    const skin = pal.gskin, red = pal.ghl, shorts = pal.gshorts;
    for (let i = 0; i < raw.col.length; i += 3) {
      const reg = raw.col[i], w = raw.col[i + 1];
      let base = reg === 13 ? shorts : skin;
      const name = Object.keys(REG).find((k) => REG[k] === reg);
      let ww = name && name !== "shorts" && hl.includes(name) ? w : 0;
      if (reg === 3 && !hl.includes("glute")) base = shorts;
      if (reg === 12 && !hl.includes("glutmed")) base = shorts;
      ww = Math.min(1, Math.max(0, (ww - 0.15) / 0.55));
      out[i] = base[0] + (red[0] - base[0]) * ww; out[i + 1] = base[1] + (red[1] - base[1]) * ww; out[i + 2] = base[2] + (red[2] - base[2]) * ww;
    }
    const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, out, gl.STATIC_DRAW);
    colorBufs[ck] = bf; return bf;
  }
  const solidBufs = {};
  function solid(part, col) { const k = part.n + "|" + col.join(","); if (solidBufs[k + part.p]) return solidBufs[k + part.p]; const out = new Float32Array(part.raw.col.length); for (let i = 0; i < out.length; i += 3) { out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; } const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, out, gl.STATIC_DRAW); solidBufs[k + part.p] = bf; return bf; }

  // ---------- matemática de matrizes 4x4 (coluna) ----------
  function model(M3, o, s) { s = s || [1, 1, 1]; return new Float32Array([M3[0] * s[0], M3[3] * s[0], M3[6] * s[0], 0, M3[1] * s[1], M3[4] * s[1], M3[7] * s[1], 0, M3[2] * s[2], M3[5] * s[2], M3[8] * s[2], 0, o[0], o[1], o[2], 1]); }
  function nmat(M3, s) { s = s || [1, 1, 1]; const a = [M3[0] / s[0], M3[3] / s[0], M3[6] / s[0], M3[1] / s[1], M3[4] / s[1], M3[7] / s[1], M3[2] / s[2], M3[5] / s[2], M3[8] / s[2]]; return new Float32Array(a); }
  function viewProj(cam, w, h) {
    const r = cam.right, u = cam.up, f = cam.fwd, e = cam.eye;
    const V = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1];
    const n = 0.05, fa = 30, sx = cam.f / (w / 2), sy = cam.f / (h / 2);
    const P = [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, -(fa + n) / (fa - n), -1, 0, 0, (-2 * fa * n) / (fa - n), 0];
    const O = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + i] * V[j * 4 + k]; O[j * 4 + i] = s; }
    return O;
  }
  const frameOf = (a, b) => { // base com Y alinhado de a para b
    const y = norm(sub(b, a)), t = Math.abs(y[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], x = norm(cross(y, t)), z = cross(x, y);
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  };

  // ---------- desenho ----------
  const LIGHT1 = norm([-0.5, 0.9, 0.55]), LIGHT2 = norm([0.8, 0.2, -0.3]), SHADOW = norm([0.25, 1, 0.18]);
  function pals(theme) {
    const p = PAL[theme === "light" ? "light" : "dark"];
    if (!p.gskin) { p.name = theme; p.gskin = [0.8, 0.82, 0.85]; p.ghl = [0.96, 0.33, 0.2]; p.gshorts = [0.2, 0.22, 0.26]; }
    return p;
  }
  const PROPC = { prop: [0.42, 0.45, 0.5], pad: [0.2, 0.22, 0.26], metal: [0.62, 0.65, 0.7], plate: [0.16, 0.17, 0.19], rope: [0.8, 0.74, 0.6], cable: [0.55, 0.57, 0.6], skin: [0.86, 0.87, 0.89], hl: [0.95, 0.36, 0.22] };

  let PARTS = null;
  function draw(ctx, name, t, w, h, theme, dpr) {
    if (!ok && !init()) return false;
    const def = F.ANIM3[name] || F.ANIM3.parado, pal = pals(theme);
    if (!CACHE[name]) CACHE[name] = boundsOf(def);
    const cam = camera({ ...def, zoom: (def.zoom || 0.93) * 0.8 }, w, h, CACHE[name]);
    dpr = Math.min(2, dpr || 1);
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    if (cv.width < W || cv.height < H) { cv.width = Math.max(cv.width, W); cv.height = Math.max(cv.height, H); }
    if (!PARTS) PARTS = { L: buildParts(1), R: buildParts(-1) };
    const dur = def.dur || 2.6, ph = (t % dur) / dur, k = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
    const fr = def.frames.length > 1 ? mix(expand(def.frames[0]), expand(def.frames[1]), k) : expand(def.frames[0]);
    const J = solve(fr), hl = (def.hl || []).join(",");
    gl.viewport(0, cv.height - H, W, H); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, cv.height - H, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const VP = viewProj(cam, w, h);
    // lista de desenho: [geometria, matriz3, origem, escala, cor (buffer)]
    const L = [];
    const loc = (M, o, l) => add(o, mv(M, l));
    const body = (key, side, M3, o, s) => { const part = geo("b" + side + key, () => PARTS[side][key]); L.push({ g: part, M3, o, s, c: colored("b" + side + key, part, hl, pal) }); };
    body("pelvis", "L", J.M0, J.pelvis);
    body("torso", "L", J.Mt, J.pelvis);
    body("neck", "L", J.Mh, J.neck);
    body("head", "L", J.Mh, loc(J.Mh, J.head, [0, 0.005, 0.004]));
    for (const s of ["L", "R"]) {
      body("delt", s, J["Ms" + s], loc(J["Ms" + s], J["sh" + s], [(s === "L" ? 1 : -1) * 0.012, -0.012, 0]));
      body("upper", s, J["Ms" + s], J["sh" + s]);
      body("fore", s, J["Me" + s], J["el" + s]);
      body("hand", s, J["Me" + s], J["wr" + s]);
      body("thigh", s, J["Mth" + s], J["hip" + s]);
      body("knee", s, J["Msh" + s], J["kn" + s]);
      body("shin", s, J["Msh" + s], J["kn" + s]);
      const fm = frameOf(J["an" + s], J["toe" + s]); // pé: Y ao longo do pé
      body("foot", s, fm, add(mul(add(J["an" + s], J["toe" + s]), 0.5), [0, -0.012, 0]));
    }
    // aparelhos
    const pp = []; F.propPrims(J, def.props, pp);
    const BOX = geo("box", boxMesh), CYL = geo("cyl", cylMesh);
    for (const q of pp) {
      const col = PROPC[q.col] || PROPC.prop;
      if (q.t === "box") { const M3 = [q.ax[0], q.ay[0], q.az[0], q.ax[1], q.ay[1], q.az[1], q.ax[2], q.ay[2], q.az[2]]; L.push({ g: BOX, M3, o: q.c, s: q.h, c: solid(BOX, col) }); }
      else if (q.t === "cap" || q.t === "line") { const r = q.t === "line" ? 0.005 : (q.ra + (q.rb ?? q.ra)) / 2, d = len3(sub(q.b, q.a)); L.push({ g: CYL, M3: frameOf(q.a, q.b), o: q.a, s: [r, d, r], c: solid(CYL, col) }); }
      else if (q.t === "disc") { const nn = norm(q.n), a = sub(q.c, mul(nn, q.w / 2)); L.push({ g: CYL, M3: frameOf(a, add(a, nn)), o: a, s: [q.r, q.w, q.r], c: solid(CYL, col) }); }
    }
    // sombra no chão (silhueta projetada), sem escurecer duas vezes
    gl.useProgram(progFlat);
    gl.uniformMatrix4fv(gl.getUniformLocation(progFlat, "VP"), false, VP);
    gl.uniform3fv(gl.getUniformLocation(progFlat, "Ld"), SHADOW);
    gl.uniform4fv(gl.getUniformLocation(progFlat, "col"), theme === "light" ? [0, 0, 0, 0.16] : [0, 0, 0, 0.2]);
    gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    const aPf = gl.getAttribLocation(progFlat, "p");
    for (const d of L) { gl.uniformMatrix4fv(gl.getUniformLocation(progFlat, "M"), false, model(d.M3, d.o, d.s)); gl.bindBuffer(gl.ARRAY_BUFFER, d.g.p); gl.enableVertexAttribArray(aPf); gl.vertexAttribPointer(aPf, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.g.i); gl.drawElements(gl.TRIANGLES, d.g.n, gl.UNSIGNED_SHORT, 0); }
    gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    // corpo e aparelhos com luz
    gl.useProgram(prog);
    const U = (n) => gl.getUniformLocation(prog, n);
    gl.uniformMatrix4fv(U("VP"), false, VP); gl.uniform3fv(U("eye"), cam.eye); gl.uniform3fv(U("L1"), LIGHT1); gl.uniform3fv(U("L2"), LIGHT2);
    const aP = gl.getAttribLocation(prog, "p"), aN = gl.getAttribLocation(prog, "n"), aC = gl.getAttribLocation(prog, "c");
    for (const d of L) {
      gl.uniformMatrix4fv(U("M"), false, model(d.M3, d.o, d.s)); gl.uniformMatrix3fv(U("N"), false, nmat(d.M3, d.s)); gl.uniform1f(U("spec"), d.g === BOX || d.g === CYL ? 0.12 : 0.22);
      gl.bindBuffer(gl.ARRAY_BUFFER, d.g.p); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, d.g.nr); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, d.c); gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.g.i); gl.drawElements(gl.TRIANGLES, d.g.n, gl.UNSIGNED_SHORT, 0);
    }
    gl.disable(gl.SCISSOR_TEST);
    // fundo de estúdio (2D) + imagem 3D por cima
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.3, Math.min(w, h) * 0.05, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
    bg.addColorStop(0, pal.bg0); bg.addColorStop(1, pal.bg1); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const fc = cam.p([CACHE[name].c[0], 0, CACHE[name].c[2]]), fr0 = 1.2 * fc.s;
    ctx.save(); ctx.translate(fc.x, fc.y); ctx.scale(1, Math.max(0.2, Math.sin((def.el ?? 14) * Math.PI / 180) * 1.1));
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, fr0); fg.addColorStop(0, "rgba(255,255,255,.55)"); fg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, fr0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.drawImage(cv, 0, 0, W, H, 0, 0, w, h);
    return true;
  }
  window.FIG3DGL = { draw, available: () => ok || init() };
})();
