import { firebaseConfig } from "./config.js";
import { SEED } from "./seed.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const DEMO = new URLSearchParams(location.search).has("demo");
const { LIB, ANIM, draw: drawFig, GROUPS } = window.FIG;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const rnd = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); const c = "abcdefghijkmnpqrstuvwxyz23456789"; return Array.from(a, (x) => c[x % c.length]).join(""); };
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const todayISO = () => iso(new Date());
const parseISO = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (s) => { if (!s) return "—"; const [, m, d] = s.split("-"); return d + "/" + m; };
const fmtDateY = (s) => { if (!s) return "—"; const [y, m, d] = s.split("-"); return d + "/" + m + "/" + y.slice(2); };
const fmtN = (n, dig) => (n == null || n === "" ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: dig ?? 1 }));
const num = (v) => { if (v === "" || v == null) return null; const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
const restSecs = (r) => { const m = String(r).match(/(\d+)\s*min/); if (m) return +m[1] * 60; const s = String(r).match(/(\d+)/); return s ? +s[1] : 60; };
const topReps = (r) => { const all = String(r).match(/\d+/g); return all ? +all[all.length - 1] : null; };
const daysBetween = (a, b) => Math.round((b - a) / 864e5);
const plusDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const show = (id) => { ["#loading", "#setup", "#admin", "#aluno"].forEach((x) => ($(x).hidden = x !== id)); };
const baseUrl = () => location.origin + location.pathname;
// Links sem "&" nem "=" (o WhatsApp corta nesses símbolos): #a-ESPACO-CHAVE e #p-ESPACO-PESSOA
const adminLink = (S, K) => baseUrl() + "#a-" + S + "-" + K;
const alunoLinkOf = (S, P) => baseUrl() + "#p-" + S + "-" + P;
function parseLink(str) {
  const i = String(str || "").indexOf("#"); const h = decodeURIComponent((i >= 0 ? String(str).slice(i + 1) : String(str)).trim());
  if (!h) return {};
  if (/^[ap]-/.test(h)) {
    const parts = h.split("-"), S = parts[1], rest = parts.slice(2).join("-");
    if (!S || !rest) return { S: S || null };
    return parts[0] === "a" ? { S, K: rest } : { S, P: rest };
  }
  const q = new URLSearchParams(h); return { S: q.get("s"), K: q.get("a"), P: q.get("p") };
}
let qrLib = null;
function loadQr() {
  if (qrLib) return qrLib;
  qrLib = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; sc.onload = () => (window.qrcode ? res(window.qrcode) : rej()); sc.onerror = rej; document.head.appendChild(sc); });
  qrLib.catch(() => (qrLib = null));
  return qrLib;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-qr]"); if (!b) return;
  const box = b.closest(".sheet").querySelector(".qrbox"); if (!box) return;
  if (!box.hidden) { box.hidden = true; b.textContent = "Mostrar QR code"; return; }
  b.textContent = "Carregando…";
  try {
    const qrcode = await loadQr(); const q = qrcode(0, "M"); q.addData(b.dataset.qr); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 3, scalable: true }) + '<p class="sub" style="margin:0">Aponte a câmera do celular pra este código e toque no link que aparecer.</p>';
    box.hidden = false; b.textContent = "Esconder QR code";
  } catch (err) { b.textContent = "Mostrar QR code"; toast("Não consegui gerar o QR code. Confira a internet.", true); }
});
function pasteBox() {
  return `<div class="sheet"><h3>Já tem um link?</h3><p class="sub" style="margin:0">Cole aqui o link que você recebeu (o seu de personal ou o do aluno).</p>
    <input class="txt" id="paste-link" placeholder="Cole o link aqui" autocomplete="off"><button class="btn" id="paste-go">Abrir</button></div>`;
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#paste-go")) return;
  const r = parseLink($("#paste-link").value);
  if (!r.S || (!r.K && !r.P)) { toast("Esse link não parece completo. Copie de novo, inteiro.", true); return; }
  location.hash = r.K ? "a-" + r.S + "-" + r.K : "p-" + r.S + "-" + r.P; location.reload();
});

// ============================================================
//  Banco de dados (Firebase, ou memória no modo demonstração)
// ============================================================
async function firebaseBackend(S) {
  const [{ initializeApp }, F, A] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-firestore.js"), import(FB + "firebase-auth.js")]);
  const app = initializeApp(firebaseConfig);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { db = F.getFirestore(app); }
  const auth = A.getAuth(app);
  const user = await new Promise((res, rej) => {
    const un = A.onAuthStateChanged(auth, (u) => { if (u) { un(); res(u); } else A.signInAnonymously(auth).catch(rej); }, rej);
  });
  const base = "espacos/" + S + "/";
  const col = (n) => F.collection(db, base + n);
  const dref = (n, id) => F.doc(db, base + n + "/" + id);
  const sub = (q, cb, err) => F.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), err || ((e) => console.warn(e)));
  return {
    uid: user.uid,
    createSpace: (K) => F.setDoc(dref("priv", "cfg"), { k: K }),
    claimAdmin: (K) => F.setDoc(dref("admins", user.uid), { k: K, ts: Date.now() }),
    pessoas: (cb, err) => sub(col("pessoas"), cb, err),
    pessoa: (id, cb, err) => F.onSnapshot(dref("pessoas", id), (d) => cb(d.exists() ? { id: d.id, ...d.data() } : null), err || (() => {})),
    sessoes: (cb) => sub(F.query(col("sessoes"), F.orderBy("ts", "desc"), F.limit(1000)), cb),
    sessoesDe: (pid, cb) => sub(F.query(col("sessoes"), F.where("pessoaId", "==", pid)), cb),
    avals: (cb) => sub(col("avaliacoes"), cb),
    avalsDe: (pid, cb) => sub(F.query(col("avaliacoes"), F.where("pessoaId", "==", pid)), cb),
    newId: (n) => F.doc(col(n)).id,
    set: (n, id, data) => F.setDoc(dref(n, id), data),
    del: (n, id) => F.deleteDoc(dref(n, id)),
  };
}

function demoBackend() {
  const store = { pessoas: {}, sessoes: {}, avaliacoes: {} };
  const subs = [];
  const emit = () => subs.forEach((f) => f());
  const all = (n) => Object.entries(store[n]).map(([id, d]) => ({ id, ...structuredClone(d) }));
  const back = (k) => plusDays(todayISO(), -k);
  store.pessoas.eu = structuredClone(SEED.eu); store.pessoas.pai = structuredClone(SEED.pai);
  [9, 6, 4, 2].forEach((k, i) => { store.sessoes["d" + i] = { pessoaId: "pai", treinoId: i % 2 ? "pB" : "pA", treinoNome: i % 2 ? "Treino B" : "Treino A", data: back(k), ts: Date.now() - k * 864e5, itens: { pa2: { nome: "Leg press", carga: 30 + i * 5, reps: null, feitas: 2 } } }; });
  store.avaliacoes.a1 = { pessoaId: "pai", data: back(20), peso: 82.4, cintura: 98 };
  store.avaliacoes.a2 = { pessoaId: "pai", data: back(5), peso: 81.1, cintura: 96.5 };
  const on = (fn) => { subs.push(fn); setTimeout(fn, 0); return () => {}; };
  return {
    uid: "demo",
    createSpace: async () => {}, claimAdmin: async () => {},
    pessoas: (cb) => on(() => cb(all("pessoas"))),
    pessoa: (id, cb) => on(() => cb(store.pessoas[id] ? { id, ...structuredClone(store.pessoas[id]) } : null)),
    sessoes: (cb) => on(() => cb(all("sessoes").sort((a, b) => b.ts - a.ts))),
    sessoesDe: (pid, cb) => on(() => cb(all("sessoes").filter((s) => s.pessoaId === pid))),
    avals: (cb) => on(() => cb(all("avaliacoes"))),
    avalsDe: (pid, cb) => on(() => cb(all("avaliacoes").filter((a) => a.pessoaId === pid))),
    newId: () => rnd(12),
    set: async (n, id, data) => { store[n][id] = structuredClone(data); emit(); },
    del: async (n, id) => { delete store[n][id]; emit(); },
  };
}

// ============================================================
//  Início: decide se é personal, aluno ou primeira vez
// ============================================================
let B = null;
const configOk = DEMO || (firebaseConfig.apiKey && !/COLE_AQUI/.test(firebaseConfig.apiKey) && !/COLE_AQUI/.test(firebaseConfig.projectId));

async function boot() {
  const h = parseLink(location.hash);
  let S = h.S || null, K = h.K || null, P = h.P || null;
  const saved = ls.get("ct.admin", null), savedAluno = ls.get("ct.aluno", null);
  if (!S && saved && saved.s) { S = saved.s; K = saved.k; }
  else if (!S && savedAluno && savedAluno.s) { S = savedAluno.s; P = savedAluno.p; }
  if (S && P && !K) ls.set("ct.aluno", { s: S, p: P });
  // deixa o link completo sempre visível na barra de endereço (assim copiar o endereço também funciona)
  if (!DEMO && S && (K || P)) { const full = K ? "#a-" + S + "-" + K : "#p-" + S + "-" + P; if (location.hash !== full) history.replaceState(null, "", full); }
  if (DEMO && !S) { S = "demo"; K = P ? null : "demo"; }

  if (!configOk) return setupMissingConfig();
  if (!S) return setupFirstRun();
  if (!K && !P) return fatal("Esse link chegou incompleto. Copie o link de novo, inteiro, ou cole abaixo.", null, true);

  try { B = DEMO ? demoBackend() : await firebaseBackend(S); }
  catch (e) { return fatal("Não consegui conectar. Confira a internet e tente de novo.", e); }

  if (K) {
    const flag = "ct.claimed." + S + "." + B.uid;
    if (!ls.get(flag, false)) {
      try { await B.claimAdmin(K); ls.set(flag, true); }
      catch (e) { if (!P) return fatal("Esse link de personal não vale pra este caderno. Confira se copiou o link inteiro.", e); K = null; }
    }
    if (K && !P) { ls.set("ct.admin", { s: S, k: K }); return startAdmin(S, K); }
  }
  if (P) return startAluno(S, P);
  return fatal("Esse link chegou incompleto. Copie o link de novo, inteiro, ou cole abaixo.", null, true);
}

function fatal(msg, e, paste) {
  if (e) console.error(e);
  show("#setup");
  $("#setup").innerHTML = `<h1>Caderno de Treino</h1><div class="care">${esc(msg)}</div>${paste ? pasteBox() : `<button class="btn" onclick="location.reload()">Tentar de novo</button>`}`;
}

function setupMissingConfig() {
  show("#setup");
  $("#setup").innerHTML = `
    <div class="label">Configuração</div>
    <h1>Falta ligar o banco de dados</h1>
    <p>O app está no ar, mas ainda não sabe qual é o seu projeto Firebase. Abra o arquivo <b>config.js</b>, cole a configuração do seu projeto e publique de novo.</p>
    <ol>
      <li>No console do Firebase, abra <b>Configurações do projeto</b>.</li>
      <li>Em <b>Seus apps</b>, copie o bloco <code>firebaseConfig</code>.</li>
      <li>Cole os valores no arquivo <b>config.js</b>, no lugar de <code>COLE_AQUI</code>.</li>
      <li>Publique a pasta de novo.</li>
    </ol>
    <p class="sub">Quer só ver como fica? <a href="?demo">Abrir a demonstração</a>.</p>`;
}

function setupFirstRun() {
  show("#setup");
  $("#setup").innerHTML = `
    <div class="label">Primeira vez</div>
    <h1>Criar seu caderno</h1>
    <p>Vou criar um caderno novo com os seus treinos e os do seu pai já prontos. No fim, você recebe dois links: o seu, de personal, e o do seu pai.</p>
    ${pasteBox()}
    <div class="sheet"><h3>Primeira vez?</h3><p class="sub" style="margin:0">Só crie se ainda não tiver um caderno. Cada caderno novo começa vazio, com links novos.</p>
    <button class="btn ghost" id="create">Criar meu caderno</button></div>`;
  $("#create").onclick = async (ev) => {
    const btn = ev.target; btn.disabled = true; btn.textContent = "Criando…";
    const S = rnd(20), K = rnd(28);
    try {
      B = await firebaseBackend(S);
      await B.createSpace(K);
      await B.claimAdmin(K);
      ls.set("ct.claimed." + S + "." + B.uid, true);
      const hoje = todayISO();
      for (const id of ["eu", "pai"]) {
        const p = structuredClone(SEED[id]);
        p.ficha = { ...p.ficha, inicio: hoje, troca: plusDays(hoje, 56) };
        await B.set("pessoas", id, p);
      }
      ls.set("ct.admin", { s: S, k: K });
      showLinks(S, K);
    } catch (e) {
      console.error(e);
      btn.disabled = false; btn.textContent = "Criar meu caderno";
      $("#setup").insertAdjacentHTML("beforeend", `<div class="care">Não deu certo: ${esc(e.code || e.message || e)}. Confira se o Firestore e o login anônimo estão ativados e se as regras foram publicadas.</div>`);
    }
  };
}

function showLinks(S, K) {
  const adm = adminLink(S, K), pai = alunoLinkOf(S, "pai");
  history.replaceState(null, "", "#a-" + S + "-" + K);
  show("#setup");
  $("#setup").innerHTML = `
    <div class="label">Pronto</div>
    <h1>Caderno criado</h1>
    <div class="sheet">
      <h3>Seu link de personal</h3>
      <p class="sub" style="margin:0">Com ele você monta e muda os treinos. Guarde num lugar seguro e não mande pra ninguém.</p>
      <div class="linkbox">${esc(adm)}</div>
      <button class="btn ghost sm" data-copy="${esc(adm)}">Copiar meu link</button>
    </div>
    <div class="sheet">
      <h3>Link do seu pai</h3>
      <p class="sub" style="margin:0">Com ele seu pai só vê o treino dele e marca as séries. Não precisa de conta nem senha.</p>
      <div class="linkbox">${esc(pai)}</div>
      <div class="row"><button class="btn ghost sm" data-copy="${esc(pai)}">Copiar</button><a class="btn sm" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent("Pai, esse é o seu treino. Toque no link pra abrir: " + pai)}">Mandar no WhatsApp</a></div>
    </div>
    <button class="btn" id="go">Abrir meu caderno</button>`;
  $("#go").onclick = () => startAdmin(S, K);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  const t = b.dataset.copy;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("Link copiado")).catch(() => {
    const box = b.closest(".sheet")?.querySelector(".linkbox");
    if (box) { const r = document.createRange(); r.selectNodeContents(box); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Link selecionado: copie pelo menu do celular"); }
  });
});

// ============================================================
//  Animação do boneco
// ============================================================
let COL = null;
function readCols() {
  const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue(n).trim();
  COL = { fig: g("--fig"), far: g("--fig-far"), muscle: g("--muscle"), muscleFar: g("--muscle-far"), prop: g("--prop"), floor: g("--floor"), bg: g("--stage") };
}
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(readCols, 50)); } catch (e) {}
const canv = new Set(); const visible = new WeakSet();
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)))) : null;
let maxDpr = 2;
function mountCanvases(root) {
  root.querySelectorAll("canvas[data-anim]").forEach((c) => {
    if (canv.has(c)) return;
    const r = c.getBoundingClientRect(), dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    const w = Math.max(60, Math.round(r.width || 104)), h = Math.max(44, Math.round(r.height || 78));
    c.width = w * dpr; c.height = h * dpr; c._w = w; c._h = h; c._dpr = dpr;
    canv.add(c); if (io) io.observe(c); else visible.add(c);
    paint(c, performance.now() / 1000);
  });
}
function paint(c, t) {
  if (!COL) readCols();
  const ctx = c.getContext("2d"); ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0);
  drawFig(ctx, c.dataset.anim, t, COL, c._w, c._h);
}
let lastFrame = 0, frameGap = 33, paused = false;
function loop(now) {
  requestAnimationFrame(loop);
  if (paused || document.hidden || now - lastFrame < frameGap) return;
  lastFrame = now; const t = now / 1000;
  canv.forEach((c) => { if (!c.isConnected) { canv.delete(c); if (io) io.unobserve(c); return; } if (visible.has(c)) paint(c, t); });
}
requestAnimationFrame(loop);

let toastT;
function toast(msg, bad) {
  const t = $("#toast"); t.textContent = msg; t.style.background = bad ? "var(--danger)" : "var(--good)"; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
}
const writeErr = (e) => { console.warn(e); toast(e && e.code === "permission-denied" ? "Sem permissão pra mudar isso" : "Não deu pra salvar. Tente de novo.", true); };


// ============================================================
//  Tipos de série: aquecimento, adaptação (reconhecimento) e válidas
// ============================================================
const TIPOS = {
  aquec: { curto: "AQ", nome: "Aquecimento", rest: "45s", reps: "12–15" },
  adapt: { curto: "AD", nome: "Adaptação", rest: "60s", reps: "4–6" },
  valida: { curto: "", nome: "Válida" },
};
const nInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
function planoSeries(ex) {
  const out = [], aq = nInt(ex.aquec, 0, 4, 0), ad = nInt(ex.adapt, 0, 4, 0), va = nInt(ex.series, 1, 8, 2);
  for (let i = 0; i < aq; i++) out.push({ tipo: "aquec", ord: i, reps: ex.repsAq || TIPOS.aquec.reps });
  for (let i = 0; i < ad; i++) out.push({ tipo: "adapt", ord: i, reps: ex.repsAd || TIPOS.adapt.reps });
  for (let i = 0; i < va; i++) out.push({ tipo: "valida", ord: i, reps: ex.reps });
  return out;
}
function doseTxt(ex) {
  const aq = nInt(ex.aquec, 0, 4, 0), ad = nInt(ex.adapt, 0, 4, 0), va = nInt(ex.series, 1, 8, 2);
  const vezes = /^\d+(–\d+)?$/.test(String(ex.reps)) ? " vezes" : "";
  if (!aq && !ad) return `${va} séries de ${ex.reps}${vezes}`;
  return [aq ? `${aq} aquec.` : "", ad ? `${ad} adapt.` : "", `${va} ${va === 1 ? "válida" : "válidas"} de ${ex.reps}${vezes}`].filter(Boolean).join(" + ");
}

// ============================================================
//  Semana: o que fazer em cada dia (treino, cardio ou descanso)
// ============================================================
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_C = ["D", "S", "T", "Q", "Q", "S", "S"];
const MOMENTOS = ["Manhã", "Almoço", "Tarde", "Noite", "Livre"];
const isCardio = (s) => s && s.tipo === "cardio";
const MODELOS = {
  completo: { nome: "Musculação + cardio (5x)", dias: {
    0: [{ tipo: "cardio", nome: "Cardio leve ou mobilidade", min: 30, momento: "Livre" }],
    1: [{ tipo: "cardio", nome: "Cardio moderado", min: 30, momento: "Almoço" }, { tipo: "treino", idx: 0, momento: "Noite" }],
    2: [{ tipo: "cardio", nome: "Cardio intervalado", min: 20, momento: "Almoço" }],
    3: [{ tipo: "cardio", nome: "Cardio leve", min: 30, momento: "Almoço" }, { tipo: "treino", idx: 1, momento: "Noite" }],
    4: [{ tipo: "cardio", nome: "Cardio intervalado", min: 20, momento: "Almoço" }],
    5: [{ tipo: "cardio", nome: "Cardio leve", min: 30, momento: "Almoço" }, { tipo: "treino", idx: 2, momento: "Noite" }],
    6: [{ tipo: "treino", idx: "auto", momento: "Livre" }],
  } },
  iniciante: { nome: "Iniciante 3x por semana", dias: {
    0: [],
    1: [{ tipo: "treino", idx: 0, momento: "Livre" }],
    2: [{ tipo: "cardio", nome: "Cardio leve", min: 20, momento: "Livre" }],
    3: [{ tipo: "treino", idx: 1, momento: "Livre" }],
    4: [{ tipo: "cardio", nome: "Cardio leve", min: 20, momento: "Livre" }],
    5: [{ tipo: "treino", idx: "auto", momento: "Livre" }],
    6: [{ tipo: "cardio", nome: "Cardio leve", min: 20, momento: "Livre" }],
  } },
};
function semanaDoModelo(key, treinos) {
  const m = MODELOS[key], out = {};
  for (let d = 0; d < 7; d++) out[d] = (m.dias[d] || []).map((it) => {
    const x = { id: rnd(6), tipo: it.tipo, momento: it.momento };
    if (it.tipo === "cardio") { x.nome = it.nome; x.min = it.min; }
    else x.treinoId = it.idx === "auto" || !treinos[it.idx] ? "auto" : treinos[it.idx].id;
    return x;
  });
  return out;
}
const temSemana = (p) => !!(p && p.semana && Object.values(p.semana).some((l) => Array.isArray(l) && l.length));
const diaDe = (p, d) => (p && p.semana && Array.isArray(p.semana[d]) ? p.semana[d] : []);
function streakDias(sess) {
  const days = new Set(sess.map((s) => s.data)); let n = 0; const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ============================================================
//  Peças de evolução usadas nas duas telas
// ============================================================
const PLATES = ["--p1", "--p2", "--p3", "--p4", "--p5"];
const plateVarG = (i) => "var(" + PLATES[i % PLATES.length] + ")";
function spark(vals) {
  const W = 110, H = 32, pad = 4;
  if (vals.length < 2) return `<svg class="spark" viewBox="0 0 ${W} ${H}"><circle cx="${W - pad}" cy="${H / 2}" r="3" fill="var(--accent)"/></svg>`;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => [pad + (i * (W - 2 * pad)) / (vals.length - 1), H - pad - ((v - min) / span) * (H - 2 * pad)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" "), e = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d} L${e[0].toFixed(1)} ${H - pad} L${pad} ${H - pad} Z" fill="var(--accent)" fill-opacity=".12"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3" fill="var(--accent)"/></svg>`;
}
function weightChart(av) {
  const pts = av.filter((a) => a.peso != null); if (!pts.length) return "";
  const W = 360, H = 170, L0 = 34, R0 = 10, T0 = 22, B0 = 24;
  const t0 = parseISO(pts[0].data).getTime(), t1 = parseISO(pts[pts.length - 1].data).getTime();
  let lo = Math.min(...pts.map((p) => p.peso)), hi = Math.max(...pts.map((p) => p.peso));
  const padv = Math.max(1, (hi - lo) * 0.25); lo = Math.floor(lo - padv); hi = Math.ceil(hi + padv);
  const x = (d) => (t1 === t0 ? (L0 + W - R0) / 2 : L0 + ((parseISO(d).getTime() - t0) / (t1 - t0)) * (W - L0 - R0));
  const y = (v) => T0 + (1 - (v - lo) / (hi - lo)) * (H - T0 - B0);
  const path = pts.map((p, i) => (i ? "L" : "M") + x(p.data).toFixed(1) + " " + y(p.peso).toFixed(1)).join(" "), last = pts[pts.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso ao longo do tempo">
    ${[lo, (lo + hi) / 2, hi].map((v) => `<line x1="${L0}" x2="${W - R0}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)"/><text x="${L0 - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="var(--muted)">${fmtN(v)}</text>`).join("")}
    ${pts.length > 1 ? `<path d="${path} L${x(last.data).toFixed(1)} ${H - B0} L${x(pts[0].data).toFixed(1)} ${H - B0} Z" fill="var(--accent)" fill-opacity=".10"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>` : ""}
    ${pts.map((p) => `<circle cx="${x(p.data).toFixed(1)}" cy="${y(p.peso).toFixed(1)}" r="${p === last ? 5 : 3.5}" fill="var(--accent)"/>`).join("")}
    <text x="${x(pts[0].data).toFixed(1)}" y="${H - 8}" text-anchor="${pts.length > 1 ? "start" : "middle"}" font-size="12" fill="var(--muted)">${fmtDate(pts[0].data)}</text>
    ${pts.length > 1 ? `<text x="${x(last.data).toFixed(1)}" y="${H - 8}" text-anchor="end" font-size="12" fill="var(--muted)">${fmtDate(last.data)}</text>` : ""}
    <text x="${Math.min(x(last.data), W - R0 - 4).toFixed(1)}" y="${(y(last.peso) - 10).toFixed(1)}" text-anchor="end" font-size="13" font-weight="700" fill="var(--ink)">${fmtN(last.peso)} kg</text></svg>`;
}
function calendarHtml(p, ss, month, prefix) {
  const now = new Date(), m = month || [now.getFullYear(), now.getMonth()];
  const first = new Date(m[0], m[1], 1), daysIn = new Date(m[0], m[1] + 1, 0).getDate();
  const byDay = {}, cardioDay = {};
  ss.forEach((s) => { if (isCardio(s)) cardioDay[s.data] = true; else byDay[s.data] = byDay[s.data] || s; });
  const tIdx = (id) => Math.max(0, ((p && p.treinos) || []).findIndex((t) => t.id === id));
  let cells = ["D", "S", "T", "Q", "Q", "S", "S"].map((w) => `<div class="wd">${w}</div>`).join(""), count = 0;
  for (let i = 0; i < first.getDay(); i++) cells += "<div></div>";
  for (let d = 1; d <= daysIn; d++) { const key = iso(new Date(m[0], m[1], d)), s = byDay[key]; if (s || cardioDay[key]) count++; cells += `<div class="d${s ? " on" : ""}${cardioDay[key] ? " cd" : ""}${key === todayISO() ? " today" : ""}"${s ? ` style="--dc:${plateVarG(tIdx(s.treinoId))}" title="${esc(s.treinoNome)}"` : ""}>${d}</div>`; }
  const nm = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const tr = (p && p.treinos) || [];
  return `<div class="cal"><div class="calhead"><button data-${prefix}="prev" aria-label="Mês anterior">‹</button><div style="text-align:center"><b>${esc(nm.charAt(0).toUpperCase() + nm.slice(1))}</b><div class="sub" style="margin:0">${count} ${count === 1 ? "dia treinado" : "dias treinados"}</div></div><button data-${prefix}="next" aria-label="Próximo mês">›</button></div>
    <div class="calgrid">${cells}</div><div class="callegend">${tr.map((t, i) => `<span><i style="--dc:${plateVarG(i)}"></i>${esc(t.nome)}</span>`).join("")}<span><i class="cdot"></i>Cardio</span></div></div>`;
}
function cargaRows(ss) {
  const series = {};
  ss.slice().sort((a, b) => a.ts - b.ts).forEach((s) => Object.entries(s.itens || {}).forEach(([id, it]) => { if (it.carga == null) return; (series[it.nome || id] = series[it.nome || id] || []).push(it.carga); }));
  return Object.entries(series).map(([nome, vals]) => { const g = vals[vals.length - 1] - vals[0]; return `<div class="prow"><div class="n">${esc(nome)}</div>${spark(vals)}<div class="v">${fmtN(vals[vals.length - 1])}<div class="g${g > 0 ? "" : " flat"}">${g > 0 ? "+" + fmtN(g) + " kg" : "kg"}</div></div></div>`; }).join("");
}
function sessRow(s, canDelete) {
  if (isCardio(s)) {
    const meta = [s.min ? s.min + " min" : "", s.intensidade || "", s.km ? fmtN(s.km) + " km" : ""].filter(Boolean).join(" · ");
    return `<details class="sess cardio"><summary><span class="d">${fmtDate(s.data)}</span><span class="t">${esc(s.nome || "Cardio")}<small>Cardio${meta ? " · " + esc(meta) : ""}</small></span>${canDelete ? `<button class="btn danger sm" data-act="del-sess" data-sid="${esc(s.id)}" data-arm="s-${esc(s.id)}">Apagar</button>` : ""}</summary>
      <div class="sessbody"><span class="${s.obs ? "sobs" : "sdet"}">${s.obs ? esc(s.obs) : "Sem anotações."}</span></div></details>`;
  }
  const its = Object.values(s.itens || {}), fe = its.reduce((a, it) => a + (it.feitas || 0), 0), n = its.length;
  const notes = its.filter((it) => it.obs).map((it) => `<span class="sobs"><b>${esc(it.nome)}:</b> ${esc(it.obs)}</span>`).join("");
  const det = its.filter((it) => Array.isArray(it.series) && it.series.some((x) => x.kg != null)).map((it) => { const v = it.series.filter((x) => !x.tipo || x.tipo === "valida"), o = it.series.length - v.length; return `<span class="sdet">${esc(it.nome)}: ${(v.length ? v : it.series).map((x) => `${x.kg != null ? fmtN(x.kg) : "—"}×${x.reps ?? "—"}`).join(" · ")}${o ? ` <small>(+${o} aquec./adapt.)</small>` : ""}</span>`; }).join("");
  return `<details class="sess"><summary><span class="d">${fmtDate(s.data)}</span><span class="t">${esc(s.treinoNome)}<small>${n} exercício${n === 1 ? "" : "s"}${fe ? " · " + fe + " séries" : ""}${notes ? " · com anotações" : ""}</small></span>${canDelete ? `<button class="btn danger sm" data-act="del-sess" data-sid="${esc(s.id)}" data-arm="s-${esc(s.id)}">Apagar</button>` : ""}</summary>
    ${det || notes ? `<div class="sessbody">${det}${notes}</div>` : `<div class="sessbody"><span class="sdet">Sem cargas anotadas.</span></div>`}</details>`;
}
function shiftMonth(m, delta) { const n = new Date(); const b = m || [n.getFullYear(), n.getMonth()]; const d = new Date(b[0], b[1] + delta, 1); return [d.getFullYear(), d.getMonth()]; }

// ============================================================
//  MODO PERSONAL (caderno completo)
// ============================================================
function startAdmin(S0, K0) {
  show("#admin");
  document.documentElement.classList.add("sport"); readCols();
  if (DEMO) { const b = $("#banner"); b.hidden = false; b.innerHTML = 'Demonstração: nada aqui é salvo de verdade. <a href="?demo#p-demo-pai">Ver como o aluno vê</a>.'; }
  const PLATES = ["--p1", "--p2", "--p3", "--p4", "--p5"];
  const RESTS = ["30s", "45s", "60s", "90s", "2 min", "3 min"];
  const MUSC = { quad: "Frente da coxa", post: "Posterior da coxa", glute: "Glúteos", calf: "Panturrilha", biceps: "Bíceps", triceps: "Tríceps", delt: "Ombros", peito: "Peito", costas: "Costas", abdomen: "Abdômen", lombar: "Lombar", glutmed: "Lateral do quadril" };
  const S = { loaded: false, pessoas: [], sessoes: [], avals: [], pid: ls.get("ct.pid", null), tab: ls.get("ct.tab", "montar") === "hist" ? "hist" : "montar", treinoSel: {}, drafts: ls.get("ct.drafts", {}), pendingRender: false, newPerson: false, calMonth: null, libTarget: null, libGroup: "Todos", libQuery: "" };

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  $("#today").textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);
  const hr = new Date().getHours();
  $("#hello").textContent = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";

  const libOf = (ex) => (ex && ex.lib && LIB[ex.lib]) || null;
  const exNome = (ex) => ex.nome || libOf(ex)?.nome || "Exercício";
  const exDicas = (ex) => (Array.isArray(ex.dicas) && ex.dicas.length ? ex.dicas : libOf(ex)?.dicas || []);
  const exCuidado = (ex) => ex.cuidado || libOf(ex)?.cuidado || "";
  const exAnim = (ex) => libOf(ex)?.anim || null;
  const thumb = (ex) => `<button class="thumb" data-how="${esc(ex.id)}" aria-label="Ver como fazer ${esc(exNome(ex))}"><canvas data-anim="${esc(exAnim(ex) || "none")}"></canvas><span class="play"></span></button>`;

  const saveTimers = {};
  function savePessoa(p, now) {
    clearTimeout(saveTimers[p.id]);
    const go = () => B.set("pessoas", p.id, { nome: p.nome, ordem: p.ordem || 0, simples: !!p.simples, aviso: p.aviso || "", ficha: p.ficha || {}, semana: p.semana || {}, treinos: p.treinos || [] }).catch(writeErr);
    if (now) return go();
    saveTimers[p.id] = setTimeout(go, 700);
  }

  B.pessoas((list) => {
    S.pessoas = list.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    S.loaded = true;
    if (!S.pessoas.find((p) => p.id === S.pid)) S.pid = S.pessoas[0]?.id || null;
    safeRender();
  }, (e) => fatal("Não consegui abrir o caderno. Confira as regras do Firestore.", e));
  B.sessoes((l) => { S.sessoes = l; safeRender(); });
  B.avals((l) => { S.avals = l; safeRender(); });

  function editing() { const a = document.activeElement; return a && $("#view").contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName); }
  function safeRender() { if (editing()) { S.pendingRender = true; return; } render(); }
  document.addEventListener("focusout", () => setTimeout(() => { if (S.pendingRender && !editing()) { S.pendingRender = false; render(); } }, 0));

  const pessoa = () => S.pessoas.find((p) => p.id === S.pid) || null;
  const sessoesDe = (pid) => S.sessoes.filter((s) => s.pessoaId === pid);
  const avalsDe = (pid) => S.avals.filter((a) => a.pessoaId === pid).sort((a, b) => (a.data < b.data ? -1 : 1));
  const plateVar = (i) => "var(" + PLATES[i % PLATES.length] + ")";
  const letter = (t, i) => { const m = (t.nome || "").match(/\b([A-Z])$/); return m ? m[1] : String.fromCharCode(65 + i); };
  const alunoLink = (p) => alunoLinkOf(S0, p.id);

  function render() {
    renderPeople();
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === S.tab ? "true" : "false"));
    const v = $("#view");
    if (!S.loaded) { v.innerHTML = '<div class="empty">Carregando os treinos…</div>'; return; }
    if (!pessoa()) { v.innerHTML = '<div class="empty"><b>Nenhuma pessoa ainda</b>Adicione quem vai treinar.<button class="btn" data-act="add-person">Adicionar pessoa</button></div>'; return; }
    if (S.tab === "hist") renderHist(v); else renderMontar(v);
    mountCanvases(v);
  }
  function renderPeople() {
    $("#people").innerHTML = S.pessoas.map((p) => `<button class="chip" data-pid="${esc(p.id)}" aria-pressed="${p.id === S.pid}"><span class="av">${esc((p.nome || "?").trim().charAt(0).toUpperCase())}</span>${esc(p.nome)}</button>`).join("") + '<button class="chip add" data-act="add-person">+ Pessoa</button>';
    $("#newPerson").hidden = !S.newPerson;
  }
  function fichaState(f) {
    if (!f || !f.troca) return null;
    const left = daysBetween(parseISO(todayISO()), parseISO(f.troca));
    if (left < 0) return { cls: "bad", txt: "Ficha vencida" };
    if (left <= 7) return { cls: "warn", txt: left === 0 ? "Trocar hoje" : "Trocar em " + left + (left === 1 ? " dia" : " dias") };
    return { cls: "ok", txt: "Em dia" };
  }
  function fichaCard(p) {
    const f = p.ficha || {};
    if (!f.objetivo && !f.troca && !f.obs) return "";
    const st = fichaState(f), left = f.troca ? daysBetween(parseISO(todayISO()), parseISO(f.troca)) : null;
    return `<div class="ficha"><div class="obj">${esc(f.objetivo || "Ficha de treino")}</div>${st ? `<span class="state ${st.cls}">${st.txt}</span>` : "<span></span>"}
      <div class="dates">${f.inicio ? "Início " + fmtDateY(f.inicio) : ""}${f.inicio && f.troca ? " · " : ""}${f.troca ? "Troca " + fmtDateY(f.troca) + (left > 7 ? " (faltam " + left + " dias)" : "") : ""}</div>
      ${f.obs ? `<div class="obs">${esc(f.obs)}</div>` : ""}</div>`;
  }
  function nextTreinoId(p) {
    const last = sessoesDe(p.id).find((x) => !isCardio(x));
    if (!last || !p.treinos.length) return p.treinos[0]?.id;
    const i = p.treinos.findIndex((t) => t.id === last.treinoId);
    return i < 0 ? p.treinos[0].id : p.treinos[(i + 1) % p.treinos.length].id;
  }
  function lastFor(pid, ex) {
    for (const s of sessoesDe(pid)) {
      const it = s.itens && (s.itens[ex.id] || Object.values(s.itens).find((x) => x.nome === exNome(ex)));
      if (it && (it.carga != null || it.reps != null || it.feitas)) return { ...it, data: s.data };
    }
    return null;
  }

  function renderTreinar(v) {
    const p = pessoa();
    if (!p.treinos || !p.treinos.length) { v.innerHTML = `<div class="col">${fichaCard(p)}<div class="empty"><b>${esc(p.nome)} ainda não tem treinos</b>Monte os treinos na aba Montar.<button class="btn" data-act="goto-montar">Montar treinos</button></div></div>`; return; }
    const nextId = nextTreinoId(p);
    let selId = S.treinoSel[p.id]; if (!p.treinos.find((t) => t.id === selId)) selId = nextId; S.treinoSel[p.id] = selId;
    const t = p.treinos.find((x) => x.id === selId), ti = p.treinos.indexOf(t);
    const draft = ((S.drafts[p.id] || {})[t.id]) || {};
    const simples = !!p.simples;
    const plates = p.treinos.map((tr, i) => `<button class="plate" data-treino="${esc(tr.id)}" aria-pressed="${tr.id === selId}" style="--pc:${plateVar(i)}" aria-label="${esc(tr.nome)}"><span class="disc">${esc(letter(tr, i))}</span><span class="pn">${esc(tr.nome)}</span>${tr.id === nextId ? '<span class="next-tag">Próximo</span>' : ""}</button>`).join("");
    const exs = t.exercicios.map((ex) => {
      const last = lastFor(p.id, ex), d = draft[ex.id] || {}, top = topReps(ex.reps);
      const subir = !simples && last && top && last.reps != null && last.reps >= top;
      const lastTxt = last ? (simples ? `Última vez (${fmtDate(last.data)}): <b>${last.carga != null ? fmtN(last.carga) + " kg" : (last.feitas || 0) + " séries feitas"}</b>` : `Última: <b>${fmtN(last.carga)} kg × ${last.reps ?? "—"}</b> · ${fmtDate(last.data)}`) : (simples ? "Primeira vez: comece com pouco peso" : "Primeira vez: comece leve e anote");
      const nSets = Math.max(1, Math.min(6, parseInt(ex.series, 10) || 2)), done = d.sets || [];
      const sets = simples ? `<div class="sets">${Array.from({ length: nSets }, (_, i) => `<button class="set" data-set="${i}" data-ex="${esc(ex.id)}" aria-pressed="${!!done[i]}">${done[i] ? "✓ Feita" : "Série " + (i + 1)}<small>${esc(ex.reps)}${/^\d+(–\d+)?$/.test(String(ex.reps)) ? " vezes" : ""}</small></button>`).join("")}</div>` : "";
      const anotado = d.carga || d.reps || (d.sets || []).some(Boolean);
      return `<div class="ex${anotado ? " done" : ""}">${thumb(ex)}<div class="info"><div class="name">${esc(exNome(ex))}</div><div class="meta">${esc(doseTxt(ex))} · descanso ${esc(ex.descanso)}</div></div>
        <button class="howbtn" data-how="${esc(ex.id)}">▸ Ver como fazer</button>
        <div class="last">${lastTxt}${subir ? '<span class="pill">Suba a carga</span>' : ""}</div>${sets}
        <div class="inputs"><div class="field"><label class="label" for="c-${esc(ex.id)}">${simples ? "Peso usado (kg, se tiver)" : "Carga (kg)"}</label><input id="c-${esc(ex.id)}" inputmode="decimal" data-draft="carga" data-ex="${esc(ex.id)}" value="${esc(d.carga ?? "")}" placeholder="${last && last.carga != null ? fmtN(last.carga) : "0"}"></div>
        ${simples ? "" : `<div class="field"><label class="label" for="r-${esc(ex.id)}">Reps</label><input id="r-${esc(ex.id)}" inputmode="numeric" data-draft="reps" data-ex="${esc(ex.id)}" value="${esc(d.reps ?? "")}" placeholder="${top ?? ""}"></div>`}
        <button class="rest-btn" data-rest="${restSecs(ex.descanso)}" data-exnome="${esc(exNome(ex))}">⏱ ${simples ? "Descansar " : ""}${esc(ex.descanso)}</button></div></div>`;
    }).join("");
    const feitos = t.exercicios.filter((ex) => { const d = draft[ex.id] || {}; return d.carga || d.reps || (d.sets || []).some(Boolean); }).length;
    const f = p.ficha || {}, st = fichaState(f), mins = Math.round(t.exercicios.reduce((a, ex) => a + planoSeries(ex).length * (restSecs(ex.descanso) + 45), 0) / 60 / 5) * 5;
    const pick = p.treinos.map((tr, i) => `<button data-treino="${esc(tr.id)}" aria-pressed="${tr.id === selId}" style="--pc:${plateVar(i)}"><i>${esc(letter(tr, i))}</i>${esc(tr.nome)}${tr.id === nextId && tr.id !== selId ? " <small>próximo</small>" : ""}</button>`).join("");
    const hero = `<section class="hero" style="--pc:${plateVar(ti)}">
        <div><div class="kicker">${selId === nextId ? "Treino de hoje" : "Treino escolhido"}</div><div class="title">${esc(t.nome)}</div><div class="meta2">${t.exercicios.length} exercícios · uns ${Math.max(10, mins)} min${f.objetivo ? " · " + esc(f.objetivo) : ""}</div></div>
        ${p.treinos.length > 1 ? `<div class="pick">${pick}</div>` : ""}
        <div class="prog2"><div class="track"><i style="width:${t.exercicios.length ? (feitos / t.exercicios.length) * 100 : 0}%"></i></div><span>${feitos} de ${t.exercicios.length} anotados</span></div>
        ${st ? `<div class="pillrow"><span class="state ${st.cls}">${st.txt}</span>${f.troca ? `<span style="opacity:.8">Ficha até ${fmtDateY(f.troca)}</span>` : ""}</div>` : ""}
      </section>`;
    v.innerHTML = `<div class="col">${hero}
      ${simples && p.aviso ? `<div class="care">${esc(p.aviso)}</div>` : ""}
      <div class="sec-title"><h2>Exercícios</h2><span>${simples ? "Marque cada série" : "Carga e reps da última série"}</span></div>
      <div class="list">${exs || '<div class="empty">Esse treino não tem exercícios ainda.</div>'}</div>
      ${t.exercicios.length ? `<div class="savebar"><button class="btn${simples ? " go" : ""}" data-act="save-session">Terminei o treino de hoje</button></div>` : ""}</div>`;
  }

  // ---------- editor da semana: escolha um dia e toque (ou arraste) as atividades ----------
  const PAL_CARDIO = [["Cardio leve", 30], ["Cardio moderado", 30], ["Cardio intervalado", 20]];
  const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  function tIndex(p, id) { return (p.treinos || []).findIndex((t) => t.id === id); }
  function chipHtml(p, it) {
    if (it.tipo === "treino") {
      const k = tIndex(p, it.treinoId), t = (p.treinos || [])[k];
      const lt = it.treinoId === "auto" ? "↻" : t ? letter(t, k) : "?", nm = it.treinoId === "auto" ? "Próximo treino" : t ? t.nome : "Treino apagado";
      return `<button class="wchip t${S.chipEd === it.id ? " on" : ""}" data-act="chip" data-iid="${esc(it.id)}" style="--pc:${k >= 0 ? plateVar(k) : "var(--muted)"}"><b>${esc(lt)}</b><span>${esc(nm)}</span><small>${esc(it.momento || "")}</small></button>`;
    }
    return `<button class="wchip c${S.chipEd === it.id ? " on" : ""}" data-act="chip" data-iid="${esc(it.id)}"><b>${it.min ? esc(it.min) + "′" : "♥"}</b><span>${esc(it.nome || "Cardio")}</span><small>${esc(it.momento || "")}</small></button>`;
  }
  function chipEditor(p, d, it) {
    const mom = `<div class="seg mom">${MOMENTOS.map((m) => `<button data-act="ch-mom" data-m="${m}"${m === it.momento ? ' class="on"' : ""}>${m}</button>`).join("")}</div>`;
    const body = it.tipo === "treino"
      ? `<div class="seg">${(p.treinos || []).map((t, k) => `<button data-act="ch-tre" data-t="${esc(t.id)}"${t.id === it.treinoId ? ' class="on"' : ""}>${esc(letter(t, k))}</button>`).join("")}<button data-act="ch-tre" data-t="auto"${it.treinoId === "auto" ? ' class="on"' : ""}>Próximo</button></div>`
      : `<div class="ce-row"><input data-edit="sem" data-f="nome" value="${esc(it.nome || "")}" aria-label="Atividade" placeholder="Ex.: Esteira"><input data-edit="sem" data-f="min" inputmode="numeric" value="${esc(it.min ?? "")}" aria-label="Minutos" placeholder="min" class="ce-min"><span class="ce-u">min</span></div>`;
    return `<div class="chip-ed" data-day="${d}" data-iid="${esc(it.id)}">${body}${mom}<div class="ce-act"><button class="btn danger sm" data-act="ch-del">Tirar do dia</button><button class="btn sm" data-act="ch-ok">Pronto</button></div></div>`;
  }
  function weekEditor(p) {
    if (S.wSel == null) S.wSel = new Date().getDay();
    const pal = (p.treinos || []).map((t, k) => `<button class="pal-it t" data-pal="t|${esc(t.id)}" style="--pc:${plateVar(k)}"><b>${esc(letter(t, k))}</b>${esc(t.nome)}</button>`).join("")
      + `<button class="pal-it t" data-pal="t|auto" style="--pc:var(--muted)"><b>↻</b>Próximo</button>`
      + PAL_CARDIO.map(([n, m]) => `<button class="pal-it c" data-pal="c|${n}|${m}"><b>${m}′</b>${n.replace("Cardio ", "")}</button>`).join("");
    const days = [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const its = diaDe(p, d), ed = its.find((x) => x.id === S.chipEd);
      return `<div class="wd${S.wSel === d ? " sel" : ""}" data-day="${d}">
        <button class="wd-h" data-act="wd-sel" aria-pressed="${S.wSel === d}">${DIA_CURTO[d]}</button>
        <div class="wd-items">${its.length ? its.map((it) => chipHtml(p, it)).join("") : `<span class="wd-rest">Descanso</span>`}</div>
      </div>${ed ? chipEditor(p, d, ed) : ""}`;
    }).join("");
    return `<div class="sheet wk-ed">
      <div class="pal-wrap"><div class="label">Adicionar em <b class="pal-day">${DIAS[S.wSel]}</b></div><div class="pal">${pal}</div>
        <p class="hint">Toque no dia e depois na atividade. Também dá pra arrastar. Toque num item pra mudar o horário ou tirar.</p></div>
      <div class="wdays">${days}</div>
      <details class="wk-more"><summary>Modelos prontos</summary><div class="row">${Object.entries(MODELOS).map(([k, m]) => `<button class="btn ghost sm" data-act="sem-tpl" data-tpl="${k}" data-arm="tpl-${k}">${esc(m.nome)}</button>`).join("")}<button class="btn danger sm" data-act="sem-clear" data-arm="tpl-clear">Limpar semana</button></div></details>
    </div>`;
  }
  function redrawWeek() { const el = document.querySelector(".wk-ed"); if (el) el.outerHTML = weekEditor(pessoa()); }
  function addToDay(p, d, spec) {
    const [tp, a, b] = spec.split("|"); p.semana = p.semana || {};
    const lst = (p.semana[d] = Array.isArray(p.semana[d]) ? p.semana[d] : []);
    lst.push(tp === "t" ? { id: rnd(6), tipo: "treino", treinoId: a, momento: "Noite" } : { id: rnd(6), tipo: "cardio", nome: a, min: +b || 30, momento: "Almoço" });
    savePessoa(p, true); redrawWeek();
    const row = document.querySelector(`.wd[data-day="${d}"]`); if (row) { row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 500); }
  }
  function moveItem(p, from, to, iid) {
    if (from === to) return; const src = diaDe(p, from), k = src.findIndex((x) => x.id === iid); if (k < 0) return;
    const [it] = src.splice(k, 1); p.semana[from] = src; p.semana[to] = (Array.isArray(p.semana[to]) ? p.semana[to] : []).concat(it);
    savePessoa(p, true); redrawWeek();
  }

  function renderMontar(v) {
    const p = pessoa(), f = p.ficha || {};
    const others = S.pessoas.filter((o) => o.id !== p.id && o.treinos && o.treinos.length);
    const link = alunoLink(p);
    const cards = (p.treinos || []).map((t, i) => `
      <div class="tcard" data-tid="${esc(t.id)}">
        <div class="thead"><span class="dot" style="--pc:${plateVar(i)}">${esc(letter(t, i))}</span><input class="txt" id="tn-${esc(t.id)}" data-edit="tnome" value="${esc(t.nome)}" aria-label="Nome do treino" maxlength="40"></div>
        ${t.exercicios.map((ex) => `
          <div class="erow" data-eid="${esc(ex.id)}">
            <div class="er-top">
              <button class="handle" aria-label="Segure e arraste pra mudar a ordem"><span class="er-n">${t.exercicios.indexOf(ex) + 1}</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
              ${thumb(ex)}
              <input class="er-name" id="en-${esc(ex.id)}" data-edit="nome" value="${esc(exNome(ex))}" maxlength="50" aria-label="Nome do exercício" placeholder="Nome do exercício">
              <div class="er-move"><button data-act="ex-up" aria-label="Subir"${t.exercicios.indexOf(ex) === 0 ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button data-act="ex-down" aria-label="Descer"${t.exercicios.indexOf(ex) === t.exercicios.length - 1 ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
            </div>
            <div class="er-fields">
              <div class="field"><label class="label" for="ea-${esc(ex.id)}">Aquec.</label><input id="ea-${esc(ex.id)}" data-edit="aquec" inputmode="numeric" value="${esc(ex.aquec ?? 0)}"></div>
              <div class="field"><label class="label" for="eb-${esc(ex.id)}">Adapt.</label><input id="eb-${esc(ex.id)}" data-edit="adapt" inputmode="numeric" value="${esc(ex.adapt ?? 0)}"></div>
              <div class="field"><label class="label" for="es-${esc(ex.id)}">Válidas</label><input id="es-${esc(ex.id)}" data-edit="series" inputmode="numeric" value="${esc(ex.series)}"></div>
              <div class="field"><label class="label" for="er-${esc(ex.id)}">Reps</label><input id="er-${esc(ex.id)}" data-edit="reps" value="${esc(ex.reps)}"></div>
              <div class="field f-desc"><label class="label" for="ed-${esc(ex.id)}">Descanso das válidas</label><select id="ed-${esc(ex.id)}" data-edit="descanso">${RESTS.concat(RESTS.includes(ex.descanso) ? [] : [ex.descanso]).map((r) => `<option${r === ex.descanso ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></div>
              <button class="x" data-act="del-ex" aria-label="Remover ${esc(exNome(ex))}">×</button>
            </div>
            <div class="er-sum">${esc(doseTxt(ex))}</div>
            <details class="extra"><summary>Mais opções: reps do aquecimento, passos e cuidado</summary>
              <div class="grid2"><div class="field"><label class="label" for="eq-${esc(ex.id)}">Reps do aquecimento</label><input id="eq-${esc(ex.id)}" data-edit="repsAq" value="${esc(ex.repsAq || "")}" placeholder="${TIPOS.aquec.reps}"></div>
              <div class="field"><label class="label" for="ew-${esc(ex.id)}">Reps da adaptação</label><input id="ew-${esc(ex.id)}" data-edit="repsAd" value="${esc(ex.repsAd || "")}" placeholder="${TIPOS.adapt.reps}"></div></div>
              <div class="field"><label class="label" for="eh-${esc(ex.id)}">Passos, um por linha</label><textarea id="eh-${esc(ex.id)}" data-edit="dicas" placeholder="${esc((libOf(ex)?.dicas || []).join("\n"))}">${esc((ex.dicas || []).join("\n"))}</textarea></div>
              <div class="field"><label class="label" for="ec-${esc(ex.id)}">Cuidado</label><input id="ec-${esc(ex.id)}" data-edit="cuidado" value="${esc(ex.cuidado || "")}" placeholder="${esc(libOf(ex)?.cuidado || "")}"></div>
            </details></div>`).join("")}
        <div class="tfoot"><div class="row"><button class="btn link" data-act="open-lib">+ Da biblioteca</button><button class="btn link" data-act="add-ex">+ Exercício livre</button></div><button class="btn danger" data-act="del-treino" data-arm="t-${esc(t.id)}">Excluir treino</button></div>
      </div>`).join("");
    v.innerHTML = `<div class="col">
      <section class="profile">
        <div class="profile-head"><span class="av big">${esc((p.nome || "?").trim().charAt(0).toUpperCase())}</span>
          <input id="pn-nome" class="txt pn-nome" data-edit="pnome" value="${esc(p.nome)}" maxlength="30" aria-label="Nome do perfil" placeholder="Nome">
          <label class="sw" for="pn-simples" title="Letras grandes e só marcar séries, sem anotar carga"><input type="checkbox" id="pn-simples" data-edit="simples"${p.simples ? " checked" : ""}><span>Modo simples</span></label></div>
        <div class="plink"><span class="label">Link do aluno</span>
          <div class="seg"><a target="_blank" rel="noopener" href="${esc(link)}">Abrir</a><button data-copy="${esc(link)}">Copiar</button><a target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent("Esse é o seu treino. Toque no link pra abrir: " + link)}">WhatsApp</a><button data-qr="${esc(link)}">QR</button></div>
          <div class="qrbox" hidden></div></div>
      </section>
      <div class="sec-h"><h2>Ficha</h2><span class="saved">Salva sozinha</span></div>
      <div class="sheet ficha-ed">
        <div class="field"><label class="label" for="f-obj">Objetivo</label><input id="f-obj" class="txt" data-edit="f-objetivo" value="${esc(f.objetivo || "")}" placeholder="Ex.: Força e equilíbrio"></div>
        <div class="fdates"><div class="field"><label class="label" for="f-ini">Início</label><input id="f-ini" type="date" data-edit="f-inicio" value="${esc(f.inicio || "")}"></div><div class="field"><label class="label" for="f-tro">Trocar em</label><input id="f-tro" type="date" data-edit="f-troca" value="${esc(f.troca || "")}"></div></div>
        <div class="fdur"><span class="label">Duração</span><div class="seg">${[4, 6, 8, 12].map((w) => { const on = f.inicio && f.troca === plusDays(f.inicio, 7 * w); return `<button data-act="ficha-weeks" data-w="${w}"${on ? ' class="on"' : ""}>${w} sem</button>`; }).join("")}</div></div>
        <div class="field"><label class="label" for="f-obs">Observações</label><textarea id="f-obs" rows="2" data-edit="f-obs" placeholder="Opcional">${esc(f.obs || "")}</textarea></div>
      </div>
      <div class="sec-h"><h2>Semana</h2></div>
      ${weekEditor(p)}
      ${cards || `<div class="empty"><b>Nenhum treino ainda</b>Crie do zero ou copie os treinos de outra pessoa e ajuste.</div>`}
      <button class="btn ghost" data-act="add-treino">+ Novo treino</button>
      ${others.length ? `<div class="sheet"><div class="label">Copiar de outra pessoa</div><div class="row">${others.map((o) => `<button class="btn ghost" data-act="copy-from" data-from="${esc(o.id)}">Copiar de ${esc(o.nome)}</button>`).join("")}</div></div>` : ""}
      <div class="sheet">
        <div class="field"><label class="label" for="pn-aviso">Recado no início do treino</label><input id="pn-aviso" class="txt" data-edit="aviso" value="${esc(p.aviso || "")}" placeholder="Ex.: Beba água e pare se sentir tontura"></div>
        <button class="btn danger" data-act="del-person" data-arm="p-${esc(p.id)}">Remover ${esc(p.nome)} e o histórico</button>
      </div>
      <div class="sheet"><h3>Seu link de personal</h3><p class="sub" style="margin:0">Use pra abrir o caderno em outro aparelho. Não mande pra ninguém.</p><div class="linkbox">${esc(adminLink(S0, K0))}</div><div class="row"><button class="btn ghost sm" data-copy="${esc(adminLink(S0, K0))}">Copiar meu link</button><button class="btn ghost sm" data-qr="${esc(adminLink(S0, K0))}">Mostrar QR code</button></div><div class="qrbox" hidden></div></div>
    </div>`;
  }

  function calendar(p) { return calendarHtml(p, sessoesDe(p.id), S.calMonth, "act-cal"); }
  function avalSection(p) {
    const av = avalsDe(p.id);
    const fields = [["peso", "Peso (kg)"], ["cintura", "Cintura (cm)"], ["quadril", "Quadril (cm)"], ["braco", "Braço (cm)"], ["coxa", "Coxa (cm)"], ["gordura", "Gordura (%)"]];
    const delta = (i, k) => { if (i === 0 || av[i][k] == null) return ""; let j = i - 1; while (j >= 0 && av[j][k] == null) j--; if (j < 0) return ""; const dv = av[i][k] - av[j][k]; if (!dv) return "<small>=</small>"; return `<small class="${dv > 0 ? "up" : "down"}">${dv > 0 ? "+" : ""}${fmtN(dv)}</small>`; };
    const used = fields.filter(([k]) => av.some((a) => a[k] != null));
    const table = av.length ? `<div class="tablewrap"><table><thead><tr><th>Data</th>${used.map(([, l]) => `<th>${l}</th>`).join("")}<th></th></tr></thead>
      <tbody>${av.map((a, i) => `<tr><td>${fmtDateY(a.data)}${a.obs ? `<small>${esc(a.obs)}</small>` : ""}</td>${used.map(([k]) => `<td>${fmtN(a[k])}${delta(i, k)}</td>`).join("")}<td><button class="btn danger sm" data-act="del-aval" data-aid="${esc(a.id)}" data-arm="a-${esc(a.id)}">Apagar</button></td></tr>`).reverse().join("")}</tbody></table></div>`
      : `<div class="empty">Nenhuma avaliação ainda. Registre o peso e as medidas de hoje pra ter o ponto de partida.</div>`;
    const form = `<details class="sheet"${av.length ? "" : " open"}><summary style="cursor:pointer;font-weight:700;color:var(--accent)">+ Nova avaliação</summary>
      <div class="field"><label class="label" for="av-data">Data</label><input id="av-data" type="date" value="${todayISO()}"></div>
      <div class="grid3">${fields.map(([k, l]) => `<div class="field"><label class="label" for="av-${k}">${l}</label><input id="av-${k}" inputmode="decimal"></div>`).join("")}</div>
      <div class="field"><label class="label" for="av-obs">Observação</label><input id="av-obs" placeholder="Ex.: Medido de manhã, em jejum"></div>
      <button class="btn" data-act="save-aval">Salvar avaliação</button></details>`;
    return `<h2>Avaliação física</h2>${av.some((a) => a.peso != null) ? `<div class="sheet">${weightChart(av)}</div>` : ""}${table}${form}`;
  }
  function renderHist(v) {
    const p = pessoa(), ss = sessoesDe(p.id);
    const wk = new Date(); wk.setDate(wk.getDate() - wk.getDay());
    const semana = ss.filter((s) => parseISO(s.data) >= parseISO(iso(wk)));
    const thisWeek = semana.filter((s) => !isCardio(s)).length;
    const cardioMin = semana.filter(isCardio).reduce((a, s) => a + (s.min || 0), 0);
    const seq = streakDias(ss);
    const rows = cargaRows(ss.filter((s) => !isCardio(s)));
    const sess = ss.slice(0, 30).map((s) => sessRow(s, true)).join("");
    v.innerHTML = `<div class="col">
      <div class="grid3"><div class="stat"><b>${thisWeek}</b><span class="label">Treinos na semana</span></div><div class="stat"><b>${cardioMin}</b><span class="label">Min de cardio na semana</span></div><div class="stat"><b>${seq}</b><span class="label">Dias seguidos</span></div></div>
      <h2>Frequência</h2>${calendar(p)}${avalSection(p)}
      <h2>Carga por exercício</h2><div class="prog">${rows || '<div class="prow"><div class="n" style="color:var(--muted);font-weight:500">Os pesos anotados nos treinos aparecem aqui.</div></div>'}</div>
      <h2>Treinos feitos</h2><div class="prog">${sess || '<div class="sess"><span class="t" style="color:var(--muted)">Nenhum treino salvo ainda.</span></div>'}</div></div>`;
  }

  // modais
  function findEx(eid) { for (const p of S.pessoas) for (const t of p.treinos || []) for (const ex of t.exercicios) if (ex.id === eid) return ex; return null; }
  let lastFocus = null;
  function openModal(id) { lastFocus = document.activeElement; $(id).hidden = false; document.body.classList.add("lock"); }
  function closeModal(id) { $(id).hidden = true; if ($("#howModal").hidden && $("#libModal").hidden) document.body.classList.remove("lock"); if (lastFocus && lastFocus.isConnected) lastFocus.focus(); }
  function showHow(ex) {
    const lib = libOf(ex), a = exAnim(ex), def = a && ANIM[a];
    const musc = def ? (def.hl || []).map((h) => MUSC[h]).filter(Boolean) : [];
    const dicas = exDicas(ex), cuidado = exCuidado(ex);
    const q = "como fazer " + exNome(ex) + (pessoa()?.simples ? " idosos" : "");
    $("#howPanel").innerHTML = `<div class="top"><div><h2 id="howTitle">${esc(exNome(ex))}</h2>${ex.series ? `<div class="sub">${esc(doseTxt(ex))} · descanso ${esc(ex.descanso)}</div>` : ""}</div><button class="close" data-close="#howModal">Fechar</button></div>
      <div class="stage"><canvas data-anim="${esc(a || "none")}"></canvas></div>
      <div class="tagrow">${lib ? `<span class="tag">${esc(lib.grupo)}</span>` : ""}${musc.length ? `<span class="musc"><i></i>${esc(musc.join(", "))}</span>` : ""}</div>
      ${dicas.length ? `<ol class="steps">${dicas.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : `<div class="sub">Sem passos cadastrados.</div>`}
      ${cuidado ? `<div class="care"><b>Cuidado:</b> ${esc(cuidado)}</div>` : ""}
      <a class="video" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener">Ver vídeos no YouTube</a>`;
    openModal("#howModal"); requestAnimationFrame(() => mountCanvases($("#howPanel")));
  }
  function renderLib() {
    const q = S.libQuery.trim().toLowerCase();
    const items = Object.entries(LIB).filter(([, l]) => (S.libGroup === "Todos" || l.grupo === S.libGroup) && (!q || l.nome.toLowerCase().includes(q)));
    $("#libPanel").innerHTML = `<div class="top"><div><h2 id="libTitle">Biblioteca de exercícios</h2><div class="sub">Toque no boneco pra ver como faz. Toque em Adicionar pra colocar no treino.</div></div><button class="close" data-close="#libModal">Fechar</button></div>
      <input class="txt" id="lib-q" placeholder="Buscar exercício" value="${esc(S.libQuery)}" aria-label="Buscar exercício">
      <div class="libgroups">${["Todos"].concat(GROUPS).map((g) => `<button class="chip" data-libg="${esc(g)}" aria-pressed="${g === S.libGroup}">${esc(g)}</button>`).join("")}</div>
      <div>${items.map(([id, l]) => `<div class="libitem"><button class="thumb" data-libhow="${esc(id)}" aria-label="Ver como fazer ${esc(l.nome)}"><canvas data-anim="${esc(l.anim)}"></canvas><span class="play"></span></button><div><div class="n">${esc(l.nome)}</div><div class="g">${esc(l.grupo)}</div></div><button class="btn sm" data-libadd="${esc(id)}">Adicionar</button></div>`).join("") || '<div class="sub">Nada encontrado.</div>'}</div>`;
    mountCanvases($("#libPanel"));
  }

  const armed = new Set();
  function arm(btn, label) {
    const k = btn.dataset.arm; if (armed.has(k)) return true;
    armed.add(k); btn.classList.add("armed"); btn.dataset.orig = btn.textContent; btn.textContent = label;
    setTimeout(() => { armed.delete(k); if (btn.isConnected) { btn.classList.remove("armed"); btn.textContent = btn.dataset.orig; } }, 4000);
    return false;
  }
  function draftFor(p, tid, eid) { S.drafts[p.id] = S.drafts[p.id] || {}; S.drafts[p.id][tid] = S.drafts[p.id][tid] || {}; return (S.drafts[p.id][tid][eid] = S.drafts[p.id][tid][eid] || {}); }

  document.addEventListener("click", async (e) => {
    if ($("#admin").hidden) return;
    if (e.target.classList && e.target.classList.contains("modal")) { closeModal("#" + e.target.id); return; }
    const b = e.target.closest("button"); if (!b) return;
    if (wDragEnd && Date.now() - wDragEnd < 400) return;
    if (b.dataset.pal) { addToDay(pessoa(), S.wSel, b.dataset.pal); return; }
    if (b.dataset.close) { closeModal(b.dataset.close); return; }
    if (b.dataset.how) { const ex = findEx(b.dataset.how); if (ex) showHow(ex); return; }
    if (b.dataset.libhow) { showHow({ id: "lib", lib: b.dataset.libhow }); return; }
    if (b.dataset.libg) { S.libGroup = b.dataset.libg; renderLib(); return; }
    if (b.dataset.libadd) {
      const p = pessoa(), t = p && p.treinos.find((x) => x.id === S.libTarget); if (!t) return;
      const l = LIB[b.dataset.libadd];
      t.exercicios.push({ id: rnd(8), lib: b.dataset.libadd, nome: l.nome, series: p.simples ? 2 : 3, reps: p.simples ? "10–12" : "8–12", descanso: "90s" });
      savePessoa(p, true); render(); toast(l.nome + " adicionado ao " + t.nome); return;
    }
    if (b.dataset.pid) { S.pid = b.dataset.pid; ls.set("ct.pid", S.pid); render(); return; }
    if (b.dataset.tab) { S.tab = b.dataset.tab; ls.set("ct.tab", S.tab); render(); return; }
    if (b.dataset.treino) { S.treinoSel[S.pid] = b.dataset.treino; render(); return; }
    if (b.dataset.rest) { startTimer(+b.dataset.rest, b.dataset.exnome); return; }
    if (b.dataset.actCal) { S.calMonth = shiftMonth(S.calMonth, b.dataset.actCal === "next" ? 1 : -1); render(); return; }
    if (b.dataset.set != null) {
      const p = pessoa(), tid = S.treinoSel[p.id], t = p.treinos.find((x) => x.id === tid), ex = t && t.exercicios.find((x) => x.id === b.dataset.ex);
      const d = draftFor(p, tid, b.dataset.ex); d.sets = d.sets || []; const i = +b.dataset.set; d.sets[i] = !d.sets[i]; ls.set("ct.drafts", S.drafts);
      const total = Math.max(1, Math.min(6, parseInt(ex && ex.series, 10) || 2)), feitas = d.sets.filter(Boolean).length;
      render(); if (d.sets[i] && ex && feitas < total) startTimer(restSecs(ex.descanso), exNome(ex)); return;
    }
    const act = b.dataset.act; if (!act) return;
    const p = pessoa();
    if (act === "add-person") { S.newPerson = true; renderPeople(); $("#np-nome").focus(); return; }
    if (act === "goto-montar") { S.tab = "montar"; render(); return; }
    if (act === "save-session") return saveSession(b);

    if (act === "save-aval") return saveAval(b);
    if (act === "del-aval") { if (!arm(b, "Confirmar")) return; B.del("avaliacoes", b.dataset.aid).catch(writeErr); return; }
    if (act === "del-sess") { if (!arm(b, "Confirmar")) return; B.del("sessoes", b.dataset.sid).catch(writeErr); return; }
    if (act === "ficha-weeks") { p.ficha = p.ficha || {}; if (!p.ficha.inicio) p.ficha.inicio = todayISO(); p.ficha.troca = plusDays(p.ficha.inicio, 7 * +b.dataset.w); savePessoa(p, true); render(); return; }
    if (act === "wd-sel") { S.wSel = +b.closest("[data-day]").dataset.day; S.chipEd = null; redrawWeek(); return; }
    if (act === "chip") { const id = b.dataset.iid; S.chipEd = S.chipEd === id ? null : id; S.wSel = +b.closest("[data-day]").dataset.day; redrawWeek(); return; }
    if (act === "ch-ok") { S.chipEd = null; redrawWeek(); return; }
    if (act === "ch-mom" || act === "ch-tre" || act === "ch-del") {
      const pe = b.closest(".chip-ed"), d = +pe.dataset.day, it = diaDe(p, d).find((x) => x.id === pe.dataset.iid); if (!it) return;
      if (act === "ch-mom") it.momento = b.dataset.m;
      if (act === "ch-tre") it.treinoId = b.dataset.t;
      if (act === "ch-del") { p.semana[d] = diaDe(p, d).filter((x) => x.id !== it.id); S.chipEd = null; }
      savePessoa(p, true); redrawWeek(); return;
    }
    if (act === "sem-add" || act === "sem-del") {
      const d = +b.closest("[data-day]").dataset.day; p.semana = p.semana || {}; const lst = (p.semana[d] = Array.isArray(p.semana[d]) ? p.semana[d] : []);
      if (act === "sem-add") lst.push(b.dataset.tipo === "treino" ? { id: rnd(6), tipo: "treino", treinoId: (p.treinos && p.treinos[0] && p.treinos[0].id) || "auto", momento: "Noite" } : { id: rnd(6), tipo: "cardio", nome: "Cardio", min: 30, momento: "Almoço" });
      else { const iid = b.closest("[data-iid]").dataset.iid; p.semana[d] = lst.filter((x) => x.id !== iid); }
      savePessoa(p, true); render(); return;
    }
    if (act === "sem-tpl") { if (!arm(b, "Toque de novo pra trocar a semana")) return; p.semana = semanaDoModelo(b.dataset.tpl, p.treinos || []); savePessoa(p, true); render(); toast("Semana atualizada"); return; }
    if (act === "sem-clear") { if (!arm(b, "Toque de novo pra limpar")) return; p.semana = {}; savePessoa(p, true); render(); return; }
    if (act === "add-treino") { p.treinos = p.treinos || []; p.treinos.push({ id: rnd(8), nome: "Treino " + String.fromCharCode(65 + p.treinos.length), exercicios: [] }); savePessoa(p, true); render(); return; }
    const tcard = b.closest("[data-tid]"), t = tcard && p.treinos.find((x) => x.id === tcard.dataset.tid);
    if (act === "open-lib" && t) { S.libTarget = t.id; renderLib(); openModal("#libModal"); return; }
    if (act === "add-ex" && t) { const id = rnd(8); t.exercicios.push({ id, nome: "", series: 3, reps: "8–12", descanso: "90s" }); render(); savePessoa(p); const inp = document.getElementById("en-" + id); if (inp) inp.focus(); return; }
    if ((act === "ex-up" || act === "ex-down") && t) {
      const eid = b.closest("[data-eid]").dataset.eid, k = t.exercicios.findIndex((x) => x.id === eid), to = act === "ex-up" ? k - 1 : k + 1;
      if (k < 0 || to < 0 || to >= t.exercicios.length) return;
      const [it] = t.exercicios.splice(k, 1); t.exercicios.splice(to, 0, it);
      savePessoa(p, true); render();
      const row = document.querySelector(`.erow[data-eid="${eid}"]`); if (row) { row.classList.add("moved"); row.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
      return;
    }
    if (act === "del-ex" && t) { const eid = b.closest("[data-eid]").dataset.eid; t.exercicios = t.exercicios.filter((x) => x.id !== eid); render(); savePessoa(p, true); return; }
    if (act === "del-treino" && t) { if (!arm(b, "Toque de novo pra excluir")) return; p.treinos = p.treinos.filter((x) => x.id !== t.id); render(); savePessoa(p, true); return; }
    if (act === "copy-from") {
      const from = S.pessoas.find((o) => o.id === b.dataset.from); if (!from) return;
      const copia = structuredClone(from.treinos).map((tr) => ({ ...tr, id: rnd(8), exercicios: tr.exercicios.map((x) => ({ ...x, id: rnd(8) })) }));
      p.treinos = (p.treinos || []).concat(copia); render(); savePessoa(p, true);
      toast(copia.length + (copia.length === 1 ? " treino copiado" : " treinos copiados") + " de " + from.nome); return;
    }
    if (act === "del-person") {
      if (!arm(b, "Toque de novo pra remover")) return;
      const id = p.id, nome = p.nome;
      try {
        for (const s of sessoesDe(id)) await B.del("sessoes", s.id);
        for (const a of avalsDe(id)) await B.del("avaliacoes", a.id);
        await B.del("pessoas", id); toast(nome + " removido");
      } catch (err) { writeErr(err); }
    }
  });

  // arrastar atividades da paleta (ou de um dia) pra outro dia da semana
  let wDrag = null, wDragEnd = 0;
  document.addEventListener("pointerdown", (e) => {
    if ($("#admin").hidden) return;
    const src = e.target.closest(".pal-it, .wchip"); if (!src) return;
    const from = src.closest("[data-day]");
    wDrag = { src, x: e.clientX, y: e.clientY, on: false, ghost: null, over: null, spec: src.dataset.pal || null, iid: src.dataset.iid || null, from: from ? +from.dataset.day : null };
  });
  document.addEventListener("pointermove", (e) => {
    if (!wDrag) return;
    if (!wDrag.on) {
      if (Math.hypot(e.clientX - wDrag.x, e.clientY - wDrag.y) < 10) return;
      wDrag.on = true; const g = wDrag.src.cloneNode(true); g.className += " drag-ghost"; document.body.appendChild(g); wDrag.ghost = g;
      wDrag.src.classList.add("lifted"); document.body.classList.add("is-dragging");
    }
    e.preventDefault();
    wDrag.ghost.style.transform = `translate(${e.clientX - 30}px, ${e.clientY - 22}px)`;
    const under = document.elementFromPoint(e.clientX, e.clientY), row = under && under.closest(".wd");
    if (wDrag.over !== row) { if (wDrag.over) wDrag.over.classList.remove("drop"); if (row) row.classList.add("drop"); wDrag.over = row; }
    if (e.clientY < 80) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 120) window.scrollBy(0, 12);
  }, { passive: false });
  const wEnd = () => {
    if (!wDrag) return; const d = wDrag; wDrag = null;
    if (!d.on) return;
    wDragEnd = Date.now(); d.ghost.remove(); d.src.classList.remove("lifted"); document.body.classList.remove("is-dragging");
    if (!d.over) return; d.over.classList.remove("drop");
    const to = +d.over.dataset.day, p = pessoa(); S.wSel = to;
    if (d.spec) addToDay(p, to, d.spec); else if (d.iid != null && d.from != null) { if (d.from === to) redrawWeek(); else moveItem(p, d.from, to, d.iid); }
  };
  document.addEventListener("pointerup", wEnd);
  document.addEventListener("pointercancel", () => { if (wDrag && wDrag.on) { wDrag.ghost.remove(); wDrag.src.classList.remove("lifted"); document.body.classList.remove("is-dragging"); if (wDrag.over) wDrag.over.classList.remove("drop"); } wDrag = null; });

  // arrastar exercícios pela alça (funciona com o dedo e com o mouse)
  let drag = null;
  document.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".handle"); if (!h || $("#admin").hidden) return;
    const row = h.closest(".erow"), card = row.closest(".tcard"); e.preventDefault();
    drag = { row, card, start: [...card.querySelectorAll(".erow")].map((r) => r.dataset.eid).join() };
    row.classList.add("dragging"); document.body.classList.add("is-dragging");
    try { h.setPointerCapture(e.pointerId); } catch (x) {}
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return; e.preventDefault();
    const y = e.clientY;
    for (const r of drag.card.querySelectorAll(".erow")) {
      if (r === drag.row) continue;
      const bx = r.getBoundingClientRect();
      if (y > bx.top && y < bx.bottom) { if (y < bx.top + bx.height / 2) r.before(drag.row); else r.after(drag.row); break; }
    }
    if (y < 90) window.scrollBy(0, -14); else if (y > window.innerHeight - 140) window.scrollBy(0, 14);
  }, { passive: false });
  const endDrag = () => {
    if (!drag) return;
    const { row, card, start } = drag; drag = null;
    row.classList.remove("dragging"); document.body.classList.remove("is-dragging");
    const ids = [...card.querySelectorAll(".erow")].map((r) => r.dataset.eid);
    if (ids.join() === start) return;
    const p = pessoa(), t = p && p.treinos.find((x) => x.id === card.dataset.tid); if (!t) return;
    t.exercicios.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    savePessoa(p, true); render(); toast("Ordem atualizada");
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#howModal").hidden) closeModal("#howModal"); else if (!$("#libModal").hidden) closeModal("#libModal"); } });
  document.addEventListener("input", (e) => {
    if ($("#admin").hidden) return;
    const el = e.target;
    if (el.id === "lib-q") { S.libQuery = el.value; const pos = el.selectionStart; renderLib(); const n = $("#lib-q"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} return; }
    const p = pessoa(); if (!p) return;
    if (el.dataset.draft) {
      const d = draftFor(p, S.treinoSel[p.id], el.dataset.ex); d[el.dataset.draft] = el.value; ls.set("ct.drafts", S.drafts);
      const card = el.closest(".ex"); if (card) card.classList.toggle("done", !!(d.carga || d.reps || (d.sets || []).some(Boolean)));
      const all = document.querySelectorAll("#view .ex").length, n = document.querySelectorAll("#view .ex.done").length;
      const bar = document.querySelector(".hero .track i"), lab = document.querySelector(".hero .prog2 span");
      if (bar && all) bar.style.width = (n / all) * 100 + "%"; if (lab) lab.textContent = n + " de " + all + " anotados";
      return;
    }
    const kind = el.dataset.edit; if (!kind) return;
    if (kind.startsWith("f-")) { p.ficha = p.ficha || {}; p.ficha[kind.slice(2)] = el.value; savePessoa(p); return; }
    if (kind === "pnome") { p.nome = el.value.trim() || "Sem nome"; renderPeople(); savePessoa(p); return; }
    if (kind === "simples") return;
    if (kind === "aviso") { p.aviso = el.value; savePessoa(p); return; }
    if (kind === "sem") {
      const d = +el.closest("[data-day]").dataset.day, iid = el.closest("[data-iid]").dataset.iid, it = diaDe(p, d).find((x) => x.id === iid); if (!it) return;
      it[el.dataset.f] = el.dataset.f === "min" ? (parseInt(el.value, 10) || null) : el.value; savePessoa(p); return;
    }
    const tcard = el.closest("[data-tid]"), t = tcard && p.treinos.find((x) => x.id === tcard.dataset.tid); if (!t) return;
    if (kind === "tnome") { t.nome = el.value; savePessoa(p); return; }
    const ex = t.exercicios.find((x) => x.id === el.closest("[data-eid]").dataset.eid); if (!ex) return;
    if (kind === "series") ex.series = parseInt(el.value, 10) || "";
    else if (kind === "aquec" || kind === "adapt") ex[kind] = nInt(el.value, 0, 4, 0);
    else if (kind === "dicas") ex.dicas = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
    else ex[kind] = el.value;
    savePessoa(p);
    if (["series", "aquec", "adapt", "reps"].includes(kind)) { const sm = el.closest(".erow")?.querySelector(".er-sum"); if (sm) sm.textContent = doseTxt(ex); }
  });
  document.addEventListener("change", (e) => {
    if ($("#admin").hidden) return;
    const k = e.target.dataset.edit;
    if (k === "descanso" || k === "f-inicio" || k === "f-troca" || (k === "sem" && e.target.tagName === "SELECT")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
    if (k === "simples") { const p = pessoa(); if (!p) return; p.simples = e.target.checked; savePessoa(p, true); render(); }
  });
  $("#np-cancel").addEventListener("click", () => { S.newPerson = false; renderPeople(); });
  $("#np-ok").addEventListener("click", addPerson);
  $("#np-nome").addEventListener("keydown", (e) => { if (e.key === "Enter") addPerson(); });
  function addPerson() {
    const nome = $("#np-nome").value.trim(); if (!nome) return;
    const id = nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 16) + "-" + rnd(4);
    const ordem = S.pessoas.reduce((m, p) => Math.max(m, p.ordem || 0), 0) + 1;
    S.newPerson = false; $("#np-nome").value = "";
    S.pid = id; ls.set("ct.pid", id); S.tab = "montar"; ls.set("ct.tab", "montar");
    B.set("pessoas", id, { nome, ordem, treinos: [], ficha: {}, simples: false, aviso: "" }).catch(writeErr);
  }
  function saveSession(btn) {
    const p = pessoa(), tid = S.treinoSel[p.id], t = p.treinos.find((x) => x.id === tid);
    const draft = ((S.drafts[p.id] || {})[tid]) || {}, itens = {};
    t.exercicios.forEach((ex) => { const d = draft[ex.id]; if (!d) return; const carga = num(d.carga), reps = num(d.reps), feitas = (d.sets || []).filter(Boolean).length; if (carga == null && reps == null && !feitas) return; itens[ex.id] = { nome: exNome(ex), carga, reps: reps == null ? null : Math.round(reps), feitas }; });
    if (!Object.keys(itens).length) { toast(p.simples ? "Marque pelo menos uma série antes" : "Anote ao menos uma carga ou rep antes de salvar", true); return; }
    B.set("sessoes", B.newId("sessoes"), { pessoaId: p.id, treinoId: t.id, treinoNome: t.nome, data: todayISO(), ts: Date.now(), itens }).catch(writeErr);
    delete S.drafts[p.id][tid]; ls.set("ct.drafts", S.drafts); S.treinoSel[p.id] = null;
    toast("Treino salvo. Bom trabalho!"); render();
  }
  function saveAval(btn) {
    const p = pessoa(), doc = { pessoaId: p.id, data: $("#av-data").value || todayISO(), ts: Date.now(), obs: $("#av-obs").value.trim() };
    let any = false; ["peso", "cintura", "quadril", "braco", "coxa", "gordura"].forEach((k) => { const v = num($("#av-" + k).value); doc[k] = v; if (v != null) any = true; });
    if (!any) { toast("Preencha pelo menos uma medida", true); return; }
    B.set("avaliacoes", B.newId("avaliacoes"), doc).catch(writeErr); toast("Avaliação salva");
  }

  // cronômetro do modo personal
  let tEnd = 0, tTotal = 0, tInt = null;
  function startTimer(secs, nome) { unlockAudio(); tTotal = secs; tEnd = Date.now() + secs * 1000; $("#timerLbl").textContent = "Descanso · " + nome; $("#timer").hidden = false; clearInterval(tInt); tick(); tInt = setInterval(tick, 250); }
  function tick() {
    const left = Math.max(0, Math.round((tEnd - Date.now()) / 1000));
    $("#timerClock").textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    $("#timerBar").style.width = 100 * (1 - left / tTotal) + "%";
    if (left <= 0) { clearInterval(tInt); $("#timerLbl").textContent = "Próxima série!"; beep(); vibrate(); setTimeout(() => { if (Date.now() >= tEnd) $("#timer").hidden = true; }, 4000); }
  }
  $("#timerAdd").addEventListener("click", () => { tEnd += 15000; tTotal += 15; clearInterval(tInt); tInt = setInterval(tick, 250); tick(); });
  $("#timerStop").addEventListener("click", () => { clearInterval(tInt); $("#timer").hidden = true; });

  render();
}

// som e vibração (compartilhado)
let actx = null;
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) {} }
function beep() { if (!actx) return; try { [0, 0.3, 0.6].forEach((o) => { const g = actx.createGain(), osc = actx.createOscillator(); osc.frequency.value = 880; g.gain.value = 0.2; osc.connect(g); g.connect(actx.destination); osc.start(actx.currentTime + o); osc.stop(actx.currentTime + o + 0.18); }); } catch (e) {} }
function vibrate() { try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) {} }

// ============================================================
//  TELA DE TREINO (aluno): abas Treino e Evolução
// ============================================================
function startAluno(S0, P) {
  show("#aluno");
  maxDpr = 1.5; frameGap = 40;
  const A = { p: null, sess: [], avals: [], screen: "home", tab: ls.get("al.tab." + P, "treino"), tIdx: null, exIdx: 0, marks: ls.get("al.marks." + P, {}), inputs: ls.get("al.inputs." + P, {}), loaded: false, savedOnce: false, err: null, calMonth: null };
  const lib = (ex) => LIB[ex.lib] || { nome: ex.nome || "Exercício", dicas: [], cuidado: "", anim: null };
  const exNome = (ex) => ex.nome || lib(ex).nome;
  const dose = (ex) => doseTxt(ex);
  const nSetsOf = (ex) => planoSeries(ex).length;
  const simples = () => !!(A.p && A.p.simples);
  const nomeCurto = () => { const n = (A.p && A.p.nome) || ""; return n && !/^(pai|mãe|mae|eu)$/i.test(n) ? n.split(" ")[0] : ""; };
  let wake = null;
  const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  const themeMode = () => ls.get("al.theme", null) || (simples() ? "claro" : "escuro");
  const themeBtn = () => `<button class="themebtn" data-theme-toggle aria-label="Mudar para aparência ${themeMode() === "escuro" ? "clara" : "escura"}">${themeMode() === "escuro" ? SUN : MOON}</button>`;

  $("#aluno").innerHTML = `<div id="aview"></div>
    <nav class="tabbar" id="atabs" aria-label="Seções">
      <button class="tab" data-atab="treino"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6.5 7v10M17.5 7v10M21 10v4M6.5 12h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Treino</span></button>
      <button class="tab" data-atab="evol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16M6.5 15.5l4-4.5 3 2.5 4.5-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="7.5" r="1.6" fill="currentColor"/></svg><span>Evolução</span></button>
    </nav>`;
  const V = () => $("#aview");

  B.pessoa(P, (p) => { A.p = p; A.err = null; A.loaded = true; if (A.screen === "home") render(); }, (e) => { console.warn(e); A.err = (e && e.code) || "erro"; A.loaded = true; render(); });
  B.sessoesDe(P, (l) => { A.sess = l.sort((a, b) => b.ts - a.ts); if (A.screen === "home") render(); });
  B.avalsDe(P, (l) => { A.avals = l.sort((a, b) => (a.data < b.data ? -1 : 1)); if (A.screen === "home" && A.tab === "evol") render(); });

  function nextIdx() {
    const tr = A.p.treinos || []; if (!tr.length) return 0;
    const last = A.sess.find((x) => !isCardio(x)); if (!last) return 0;
    const i = tr.findIndex((t) => t.id === last.treinoId); return i < 0 ? 0 : (i + 1) % tr.length;
  }
  function lastFor(ex) {
    for (const s of A.sess) { const it = s.itens && (s.itens[ex.id] || Object.values(s.itens).find((x) => x.nome === exNome(ex))); if (it && (it.carga != null || it.reps != null || it.feitas || it.obs)) return { ...it, data: s.data }; }
    return null;
  }
  function weekDots() {
    const days = new Set(A.sess.map((s) => s.data)), now = new Date(), start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return ["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => { const d = new Date(start); d.setDate(start.getDate() + i); const k = iso(d); return `<div>${l}<span class="${days.has(k) ? "on" : ""}${k === iso(now) ? " today" : ""}">${days.has(k) ? "✓" : ""}</span></div>`; }).join("");
  }
  const monthCount = () => { const m = todayISO().slice(0, 7); return new Set(A.sess.filter((s) => s.data.startsWith(m)).map((s) => s.data)).size; };

  function notReady() {
    const why = A.err ? `Não consegui ler o treino (código: ${esc(A.err)}).` : !A.p ? `Não encontrei o treino de "${esc(P)}" neste caderno (${esc(S0.slice(0, 6))}…).` : "Esse treino ainda não tem exercícios.";
    V().innerHTML = `<h1>Seu treino ainda não está pronto</h1><p>Peça pra quem monta seus treinos conferir o link.</p><p class="a-muted" style="font-size:15px">${why}</p>${pasteBox()}`;
  }

  // treino previsto pra hoje na semana (ou o próximo da sequência)
  function idxDoItem(it) { const tr = A.p.treinos || []; if (!it || it.treinoId === "auto") return nextIdx(); const k = tr.findIndex((t) => t.id === it.treinoId); return k < 0 ? nextIdx() : k; }
  function weekPlan() {
    const now = new Date(), start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const sem = temSemana(A.p);
    return `<div class="wk">${DIAS_C.map((l, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); const k = iso(d);
      const ss = A.sess.filter((x) => x.data === k), fezT = ss.some((x) => !isCardio(x)), fezC = ss.some(isCardio);
      const plan = sem ? diaDe(A.p, i) : [], pT = plan.some((x) => x.tipo === "treino"), pC = plan.some((x) => x.tipo === "cardio");
      const done = (pT || pC) ? ((!pT || fezT) && (!pC || fezC)) : (fezT || fezC);
      const sel = (A.selDate || iso(now)) === k;
      return `<button class="wkd${k === iso(now) ? " today" : ""}${done ? " done" : ""}${sel ? " sel" : ""}" data-wday="${k}" aria-label="Ver ${DIAS[i]}" aria-pressed="${sel}"><span class="wl">${l}</span><span class="wc">${done ? "✓" : d.getDate()}</span><span class="wi">${pT ? '<i class="it"></i>' : ""}${pC ? '<i class="ic"></i>' : ""}${!sem || pT || pC ? "" : '<i class="ir"></i>'}</span></button>`;
    }).join("")}</div>`;
  }
  function weekCard() {
    const mc = monthCount(), st = streakDias(A.sess);
    return `<div class="a-card"><div class="row" style="justify-content:space-between"><p><b>Esta semana</b> <span class="a-muted" style="font-weight:500;font-size:.85em">· toque num dia pra ver</span></p>${st > 1 ? `<span class="streak">${st} dias seguidos</span>` : ""}</div>${weekPlan()}
      ${temSemana(A.p) ? '<div class="wklegend"><span><i class="it"></i>Musculação</span><span><i class="ic"></i>Cardio</span><span><i class="ir"></i>Descanso</span></div>' : ""}
      <p class="a-muted" style="font-size:.85em">${mc ? `Você se mexeu em ${mc} ${mc === 1 ? "dia" : "dias"} este mês.` : "Seu primeiro treino do mês vai aparecer aqui."}</p></div>`;
  }
  function cardioCard(it, big) {
    const feito = A.sess.some((x) => isCardio(x) && x.data === todayISO() && (x.planId === it.id || !x.planId));
    return `<section class="cardio-card${feito ? " done" : ""}">
      <div class="cc-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M5.5 12h3l1.5-2.5 2 5 1.5-2.5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="cc-txt"><div class="kicker">${esc(it.momento || "Cardio")} · Cardio</div><div class="cc-t">${esc(it.nome || "Cardio")}</div><div class="cc-m">${it.min ? it.min + " minutos" : ""}</div></div>
      ${feito ? '<span class="cc-done">✓ Feito</span>' : big ? "" : `<button class="btn sm" data-cardio="${esc(it.id)}">Registrar</button>`}
    </section>${feito || !big ? "" : `<button class="a-big" data-cardio="${esc(it.id)}">Fiz o cardio</button>`}`;
  }


  function resumoDia(d) {
    const its = diaDe(A.p, d.getDay()), tr = A.p.treinos || [];
    if (!its.length) return "Descanso";
    return its.slice().sort((a, b) => MOMENTOS.indexOf(a.momento) - MOMENTOS.indexOf(b.momento)).map((x) => {
      if (x.tipo === "cardio") return `${esc(x.nome || "Cardio")}${x.min ? " " + x.min + " min" : ""}`;
      const t = x.treinoId === "auto" ? null : tr.find((y) => y.id === x.treinoId);
      return `<b>${t ? esc(t.nome) : "Próximo treino"}</b>`;
    }).join(" · ");
  }
  function proxDias() {
    if (!temSemana(A.p)) return "";
    const tr = A.p.treinos || [], tiles = [];
    for (let k = 1; k <= 7; k++) {
      const d = new Date(); d.setDate(d.getDate() + k);
      const its = diaDe(A.p, d.getDay()).slice().sort((a, b) => MOMENTOS.indexOf(a.momento) - MOMENTOS.indexOf(b.momento));
      const tags = its.length ? its.map((x) => {
        if (x.tipo === "cardio") return `<span class="ptag c"><i></i>Cardio${x.min ? " " + x.min + "′" : ""}</span>`;
        const ix = x.treinoId === "auto" ? -1 : tr.findIndex((y) => y.id === x.treinoId);
        return `<span class="ptag t" style="--pc:${ix >= 0 ? plateVarG(ix) : "var(--muted)"}"><i></i>${ix >= 0 ? esc(tr[ix].nome) : "Treino"}</span>`;
      }).join("") : `<span class="ptag r">Descanso</span>`;
      tiles.push(`<button class="ptile${its.length ? "" : " rest"}" data-wday="${iso(d)}"><span class="pdow">${k === 1 ? "Amanhã" : DIAS[d.getDay()].slice(0, 3)}</span><span class="pnum">${d.getDate()}</span><span class="ptags">${tags}</span></button>`);
    }
    return `<div class="a-card prox-card"><div class="row" style="justify-content:space-between"><p><b>Próximos dias</b></p><span class="a-muted" style="font-size:.8em">deslize ›</span></div><div class="prow2">${tiles.join("")}</div></div>`;
  }
  function seusTreinos() {
    const tr = A.p.treinos || [];
    return `<div class="a-card"><p><b>Seus treinos</b></p>${tr.map((t, i) => `<details class="tr-det"><summary><span class="tr-dot" style="--pc:${plateVarG(i)}">${esc((t.nome.match(/\b([A-Z])$/) || [0, String.fromCharCode(65 + i)])[1])}</span><span class="tr-n">${esc(t.nome)}<small>${t.exercicios.length} exercícios</small></span></summary>
      <ul class="a-list">${t.exercicios.map((ex, j) => { const l = lastFor(ex); return `<li><b>${j + 1}.</b><span style="flex:1">${esc(exNome(ex))}<br><small class="a-muted">${esc(doseTxt(ex))}${l && l.carga != null ? " · última: " + fmtN(l.carga) + " kg" : ""}</small></span></li>`; }).join("")}</ul>
      <button class="a-big soft" data-dostart="${i}">Fazer o ${esc(t.nome)} agora</button></details>`).join("")}</div>`;
  }
  function dayView(dt) {
    const dow = dt.getDay(), its = diaDe(A.p, dow).slice().sort((a, b) => MOMENTOS.indexOf(a.momento) - MOMENTOS.indexOf(b.momento));
    const tr = A.p.treinos || [], past = iso(dt) < todayISO();
    const feito = A.sess.filter((x) => x.data === iso(dt));
    const label = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const blocos = its.length ? its.map((x) => {
      if (x.tipo === "cardio") return `<section class="cardio-card"><div class="cc-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg></div><div class="cc-txt"><div class="kicker">${esc(x.momento || "")} · Cardio</div><div class="cc-t">${esc(x.nome || "Cardio")}</div><div class="cc-m">${x.min ? x.min + " minutos" : ""}</div></div>${feito.some(isCardio) ? '<span class="cc-done">✓ Feito</span>' : ""}</section>`;
      const k = x.treinoId === "auto" ? -1 : tr.findIndex((y) => y.id === x.treinoId);
      const t = k >= 0 ? tr[k] : null;
      if (!t) return `<section class="rest-card"><div class="kicker">${esc(x.momento || "")} · Musculação</div><div class="cc-t">Próximo treino da sequência</div><p class="a-muted" style="margin:0">O app escolhe o treino certo no dia, seguindo a ordem A, B, C.</p></section>`;
      return `<section class="plan-card" style="--pc:${plateVarG(k)}"><div class="kicker">${esc(x.momento || "")} · Musculação</div><div class="cc-t">${esc(t.nome)}</div>
        <ul class="a-list">${t.exercicios.map((ex, j) => `<li><b>${j + 1}.</b><span>${esc(exNome(ex))} <small class="a-muted">${esc(doseTxt(ex))}</small></span></li>`).join("")}</ul>
        ${feito.some((y) => !isCardio(y)) ? '<span class="cc-done">✓ Feito</span>' : `<button class="a-big soft" data-dostart="${k}">Fazer esse treino agora</button>`}</section>`;
    }).join("") : `<section class="rest-card"><div class="kicker">${DIAS[dow]}</div><div class="cc-t">Dia de descanso</div><p class="a-muted" style="margin:0">Nada planejado pra esse dia.</p></section>`;
    V().innerHTML = `
      <div class="a-headrow"><button class="a-link" data-go="today" style="padding:0">‹ Voltar pra hoje</button>${themeBtn()}</div>
      <div><div class="label">${past ? "Dia que passou" : "Planejado"}</div><h1 style="margin-top:4px">${esc(label.charAt(0).toUpperCase() + label.slice(1))}</h1></div>
      ${blocos}
      ${weekCard()}${proxDias()}${seusTreinos()}`;
  }
  function home() {
    if (!A.loaded) { V().innerHTML = `<p class="a-muted">Carregando seu treino…</p>`; return; }
    if (!A.p || !(A.p.treinos || []).length) return notReady();
    if (A.selDate && A.selDate !== todayISO()) return dayView(parseISO(A.selDate));
    const tr = A.p.treinos, dow = new Date().getDay(), sem = temSemana(A.p);
    const hoje = sem ? diaDe(A.p, dow) : [{ id: "x", tipo: "treino", treinoId: "auto" }];
    const tItem = hoje.find((x) => x.tipo === "treino"), cItems = hoje.filter((x) => x.tipo === "cardio");
    const descanso = sem && !hoje.length;
    if (A.tIdx == null || A.tIdx >= tr.length) A.tIdx = tItem ? idxDoItem(tItem) : nextIdx();
    const t = tr[A.tIdx], other = tr.length > 1 ? tr[(A.tIdx + 1) % tr.length] : null;
    const didT = A.sess.some((x) => x.data === todayISO() && !isCardio(x));
    const dateTxt = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const dateCap = dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1);
    const offline = navigator.onLine === false ? '<p class="offline">Sem internet agora. Pode treinar normalmente: o treino é enviado quando a internet voltar.</p>' : "";
    const showTreino = !!tItem || A.forceTreino || !sem;

    if (simples()) {
      const titulo = didT ? "Treino de hoje feito!" : showTreino ? (nomeCurto() ? "Olá, " + esc(nomeCurto()) + "! " : "") + "Hoje é dia do " + esc(t.nome) : cItems.length ? "Hoje é dia de cardio" : "Hoje é dia de descanso";
      V().innerHTML = `
        <div class="a-headrow"><p class="a-muted" style="font-size:18px">${dateCap}</p>${themeBtn()}</div>
        <div><h1>${titulo}</h1></div>
        ${cItems.map((c) => cardioCard(c, true)).join("")}
        ${showTreino ? `<div class="a-card"><p><b>${t.exercicios.length} exercícios</b> · mais ou menos 35 minutos</p>
          <ul class="a-list">${t.exercicios.map((ex, i) => `<li><b>${i + 1}.</b><span>${esc(exNome(ex))}</span></li>`).join("")}</ul></div>
          ${A.p.aviso ? `<div class="a-note">${esc(A.p.aviso)}</div>` : ""}
          <button class="a-big" data-go="start">${didT ? "Treinar de novo" : "Começar o treino"}</button>
          ${other ? `<button class="a-link" data-go="swap">Prefiro fazer o ${esc(other.nome)} hoje</button>` : ""}`
        : `<div class="a-card"><p>${cItems.length ? "Hoje não tem musculação. O cardio já é o treino do dia." : "Descansar também faz parte. Se tiver vontade, um cardio leve de 20 minutos faz bem."}</p></div>
           <button class="a-link" data-go="force">Quero treinar mesmo assim</button>`}
        ${weekCard()}${proxDias()}${offline}`;
      return;
    }
    const hr = new Date().getHours(), hello = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
    const mins = Math.round(t.exercicios.reduce((a, ex) => a + nSetsOf(ex) * (restSecs(ex.descanso) + 45), 0) / 60 / 5) * 5;
    const f = A.p.ficha || {};
    const pick = tr.length > 1 ? `<div class="pick">${tr.map((x, i) => `<button data-apick="${i}" aria-pressed="${i === A.tIdx}" style="--pc:${plateVarG(i)}"><i>${esc((x.nome.match(/\b([A-Z])$/) || [0, String.fromCharCode(65 + i)])[1])}</i>${esc(x.nome)}</button>`).join("")}</div>` : "";
    const hero = `<section class="hero">
        <div><div class="kicker">${didT ? "Treino de hoje feito" : (tItem && tItem.momento && tItem.momento !== "Livre" ? esc(tItem.momento) + " · " : "") + (tItem || !sem ? "Musculação de hoje" : "Treino extra")}</div><div class="title">${esc(t.nome)}</div><div class="meta2">${t.exercicios.length} exercícios · uns ${Math.max(10, mins)} min${f.objetivo ? " · " + esc(f.objetivo) : ""}</div></div>
        ${pick}
        <button class="a-big hero-go" data-go="start">${didT ? "Treinar de novo" : "Começar o treino"}</button>
      </section>`;
    // ordem do dia: o que tem horário mais cedo vem primeiro
    const ordem = hoje.slice().sort((a, b) => MOMENTOS.indexOf(a.momento) - MOMENTOS.indexOf(b.momento));
    let blocos = ordem.map((x) => (x.tipo === "cardio" ? cardioCard(x, false) : hero)).join("");
    if (!tItem && sem) blocos += descanso
      ? `<section class="rest-card"><div class="kicker">Hoje</div><div class="cc-t">Dia de descanso</div><p class="a-muted" style="margin:0">Recuperar também faz o músculo crescer. Durma bem e beba água.</p></section>${A.forceTreino ? hero : '<button class="a-link" data-go="force">Fazer um treino extra mesmo assim</button>'}`
      : (A.forceTreino ? hero : '<button class="a-link" data-go="force">Fazer musculação hoje também</button>');
    if (!sem) blocos = hero;
    V().innerHTML = `
      <header class="appbar"><div class="hello-box"><div class="hello">${hello}${nomeCurto() ? ", " + esc(nomeCurto()) : ""}</div><div class="sub">${dateCap}</div></div>${themeBtn()}</header>
      ${sem ? `<div class="label" style="margin-bottom:-8px">Hoje · ${DIAS[dow]}</div>` : ""}
      ${blocos}
      ${A.p.aviso ? `<div class="a-note">${esc(A.p.aviso)}</div>` : ""}
      ${showTreino ? `<div class="a-card"><p><b>Exercícios do ${esc(t.nome)}</b></p><ul class="a-list">${t.exercicios.map((ex, i) => { const l = lastFor(ex); return `<li><b>${i + 1}.</b><span style="flex:1">${esc(exNome(ex))}<br><small class="a-muted">${esc(doseTxt(ex))}${l && l.carga != null ? " · última: " + fmtN(l.carga) + " kg" : ""}</small></span></li>`; }).join("")}</ul></div>` : ""}
      ${weekCard()}${proxDias()}${seusTreinos()}${offline}`;
  }

  // registrar cardio
  function cardioScreen() {
    const it = A.cardio || {};
    const ints = ["Leve", "Moderado", "Forte"];
    V().innerHTML = `
      <div class="a-top"><span class="a-count">Registrar cardio</span><button class="a-link" data-go="home" style="padding:0">Cancelar</button></div>
      <h1>${esc(it.nome || "Cardio")}</h1>
      <div class="field"><label class="label" for="cd-nome">Atividade</label><input class="txt" id="cd-nome" value="${esc(it.nome || "")}" placeholder="Ex.: Esteira, bike, corrida"></div>
      <div class="a-inputs">
        <div class="field"><label class="label" for="cd-min">Minutos</label><input id="cd-min" inputmode="numeric" value="${esc(it.min || "")}" placeholder="30"></div>
        <div class="field"><label class="label" for="cd-km">Distância (km)</label><input id="cd-km" inputmode="decimal" placeholder="opcional"></div>
      </div>
      <div class="field"><span class="label">Intensidade</span><div class="seg three" role="group" aria-label="Intensidade">${ints.map((x) => `<button data-cint="${x}" aria-pressed="${(A.cInt || "Moderado") === x}">${x}</button>`).join("")}</div></div>
      <div class="field obsfield"><label class="label" for="cd-obs">Observações</label><textarea id="cd-obs" rows="2" placeholder="Ex.: inclinação 6, velocidade 6,5"></textarea></div>
      <button class="a-big" data-go="save-cardio">Salvar cardio</button>`;
    window.scrollTo(0, 0);
  }
  function saveCardio(quick) {
    const it = A.cardio || {};
    const doc = { pessoaId: P, tipo: "cardio", planId: it.id || null, data: todayISO(), ts: Date.now() };
    if (quick) { doc.nome = it.nome || "Cardio"; doc.min = it.min || null; doc.intensidade = "Leve"; doc.obs = ""; doc.km = null; }
    else {
      doc.nome = ($("#cd-nome").value || it.nome || "Cardio").trim();
      doc.min = num($("#cd-min").value); doc.km = num($("#cd-km").value);
      doc.intensidade = A.cInt || "Moderado"; doc.obs = $("#cd-obs").value.trim();
    }
    doc.treinoNome = doc.nome;
    B.set("sessoes", B.newId("sessoes"), doc).catch((e) => console.warn(e));
    A.screen = "home"; A.cardio = null; toast(quick ? "Cardio registrado. Muito bem!" : "Cardio registrado"); render();
  }

  function evol() {
    if (!A.loaded) { V().innerHTML = `<p class="a-muted">Carregando…</p>`; return; }
    if (!A.p) return notReady();
    const ss = A.sess;
    const wk = new Date(); wk.setDate(wk.getDate() - wk.getDay());
    const semana = ss.filter((s) => parseISO(s.data) >= parseISO(iso(wk)));
    const thisWeek = semana.filter((s) => !isCardio(s)).length;
    const cardioMin = semana.filter(isCardio).reduce((a, s) => a + (s.min || 0), 0);
    const seq = streakDias(ss);
    const rows = cargaRows(ss.filter((s) => !isCardio(s)));
    const av = A.avals, last = av.filter((a) => a.peso != null).slice(-1)[0], firstW = av.find((a) => a.peso != null);
    const sess = ss.slice(0, 15).map((s) => sessRow(s, false)).join("");
    V().innerHTML = `
      <h1 style="font-size:1.6em">Sua evolução</h1>
      <div class="grid3"><div class="stat"><b>${thisWeek}</b><span class="label">Treinos na semana</span></div><div class="stat"><b>${cardioMin}</b><span class="label">Min de cardio na semana</span></div><div class="stat"><b>${seq}</b><span class="label">Dias seguidos</span></div></div>
      <h2>Frequência</h2>
      ${calendarHtml(A.p, ss, A.calMonth, "acal")}
      ${last ? `<h2>Peso</h2><div class="sheet">${weightChart(av)}<p class="sub" style="margin:0">Última medida: <b>${fmtN(last.peso)} kg</b> em ${fmtDateY(last.data)}${firstW && firstW !== last ? ` · ${last.peso - firstW.peso > 0 ? "+" : ""}${fmtN(last.peso - firstW.peso)} kg desde ${fmtDateY(firstW.data)}` : ""}</p></div>` : ""}
      ${rows ? `<h2>Carga por exercício</h2><div class="prog">${rows}</div>` : ""}
      <h2>Treinos feitos</h2><div class="prog">${sess || '<div class="sess"><span class="t" style="color:var(--muted)">Seus treinos vão aparecer aqui.</span></div>'}</div>
      <h2>Aparência</h2>
      <div class="seg" role="group" aria-label="Aparência"><button data-theme-set="escuro" aria-pressed="${themeMode() === "escuro"}">${MOON}Escuro</button><button data-theme-set="claro" aria-pressed="${themeMode() === "claro"}">${SUN}Claro</button></div>`;
  }

  function exercise() {
    const t = A.p.treinos[A.tIdx], ex = t.exercicios[A.exIdx], L = lib(ex), n = t.exercicios.length;
    const plano = planoSeries(ex), ns = plano.length, m = A.marks[ex.id] || [];
    const allDone = plano.every((x, i) => x.tipo !== "valida" || m[i]);
    const dicas = Array.isArray(ex.dicas) && ex.dicas.length ? ex.dicas : L.dicas, cuidado = ex.cuidado || L.cuidado;
    const inp = A.inputs[ex.id] || {}, l = lastFor(ex), top = topReps(ex.reps);
    const sets = inp.sets || [];
    const lastSeries = (l && Array.isArray(l.series)) ? l.series : [];
    const lastBy = { aquec: [], adapt: [], valida: [] };
    lastSeries.forEach((x) => (lastBy[x.tipo && lastBy[x.tipo] ? x.tipo : "valida"]).push(x));
    const phKg = (i) => {
      const pi = plano[i];
      for (let j = i - 1; j >= 0; j--) if (plano[j].tipo === pi.tipo && sets[j] && sets[j].kg) return sets[j].kg;
      const lb = lastBy[pi.tipo][pi.ord]; if (lb && lb.kg != null) return fmtN(lb.kg);
      if (pi.tipo === "valida" && l && l.carga != null) return fmtN(l.carga);
      return "";
    };
    const phReps = (i) => { const pi = plano[i], lb = lastBy[pi.tipo][pi.ord]; if (lb && lb.reps != null) return String(lb.reps); const tp = topReps(pi.reps); return tp != null ? String(tp) : ""; };
    const subir = !simples() && l && top && l.reps != null && l.reps >= top;
    const lv = lastBy.valida;
    const lastTxt = l ? (lv.length ? lv.map((x) => `${x.kg != null ? fmtN(x.kg) : "—"}×${x.reps ?? "—"}`).join(" · ") : `${l.carga != null ? fmtN(l.carga) + " kg" : "—"} × ${l.reps ?? "—"}`) : "";
    const temTipos = plano.some((x) => x.tipo !== "valida");
    const setRows = simples() ? "" : `
      <div class="setrows">
        <div class="sethead"><span>Série</span><span>Carga (kg)</span><span>Reps</span><span></span></div>
        ${plano.map((pi, i) => { const st = sets[i] || {}; const tag = pi.tipo === "valida" ? String(pi.ord + 1) : TIPOS[pi.tipo].curto; return `<div class="setrow t-${pi.tipo}${m[i] ? " done" : ""}">
          <span class="sn" title="${TIPOS[pi.tipo].nome}"><b>${pi.tipo === "valida" ? tag : pi.ord + 1}</b><small>${pi.tipo === "valida" ? "Válida" : pi.tipo === "aquec" ? "Aquec." : "Adapt."}</small></span>
          <input inputmode="decimal" aria-label="Carga · ${TIPOS[pi.tipo].nome} ${pi.ord + 1}" data-skg="${i}" value="${esc(st.kg ?? "")}" placeholder="${esc(phKg(i))}">
          <input inputmode="numeric" aria-label="Repetições · ${TIPOS[pi.tipo].nome} ${pi.ord + 1}" data-sreps="${i}" value="${esc(st.reps ?? "")}" placeholder="${esc(phReps(i))}">
          <button class="setok" data-set="${i}" aria-pressed="${!!m[i]}" aria-label="${TIPOS[pi.tipo].nome} ${pi.ord + 1} feita">✓</button></div>`; }).join("")}
        ${temTipos ? `<div class="setlegend">${plano.some((x) => x.tipo === "aquec") ? `<span><b class="lg aquec">Aquec.</b> ${esc(ex.repsAq || TIPOS.aquec.reps)}, carga leve</span>` : ""}${plano.some((x) => x.tipo === "adapt") ? `<span><b class="lg adapt">Adapt.</b> ${esc(ex.repsAd || TIPOS.adapt.reps)}, perto da carga de trabalho</span>` : ""}<span><b class="lg valida">Válida</b> ${esc(ex.reps)}, pra valer</span></div>` : ""}
      </div>
      <p class="a-muted" style="font-size:.85em;margin:0">${l ? `Última vez (${fmtDate(l.data)}): <b>${lastTxt}</b>` : "Primeira vez: comece leve e anote"}${subir ? ' <span class="pill">Suba a carga</span>' : ""}</p>
      <div class="field obsfield"><label class="label" for="ai-obs">Observações</label>
        <textarea id="ai-obs" data-aobs rows="2" placeholder="Ex.: banco na posição 4, pegada aberta, senti o ombro">${esc(inp.obs || "")}</textarea>
        ${l && l.obs ? `<p class="a-muted lastobs">Sua anotação da última vez: “${esc(l.obs)}”</p>` : ""}</div>`;
    const inputs = setRows;
    V().innerHTML = `
      <div class="a-top"><span class="a-count">Exercício ${A.exIdx + 1} de ${n}</span><button class="a-link" data-go="quit" style="padding:0">Sair</button></div>
      <div class="a-bar"><i style="width:${(A.exIdx / n) * 100}%"></i></div>
      <h2>${esc(exNome(ex))}</h2>
      <div class="a-stage"><canvas data-anim="${esc(L.anim || "none")}" aria-label="Boneco mostrando o movimento"></canvas></div>
      <p class="a-dose">${esc(dose(ex))} · descanso ${esc(ex.descanso)}</p>
      ${simples() ? `<div class="a-sets${ns > 3 ? " many" : ""}">${plano.map((pi, i) => `<button class="a-set t-${pi.tipo}" data-set="${i}" aria-pressed="${!!m[i]}">${m[i] ? "✓ Feita" : pi.tipo === "valida" ? "Série " + (pi.ord + 1) : TIPOS[pi.tipo].nome}<small>${m[i] ? "muito bem" : esc(pi.reps) + (/^\d+(–\d+)?$/.test(String(pi.reps)) ? " vezes" : "")}</small></button>`).join("")}</div>` : ""}
      ${inputs}
      ${dicas.length ? `<details${A.exIdx === 0 && !ls.get("al.seen", false) ? " open" : ""}><summary>Como fazer</summary><ol class="a-steps">${dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ol></details>` : ""}
      ${cuidado ? `<div class="a-note"><b>Cuidado:</b> ${esc(cuidado)}</div>` : ""}
      <div class="a-nav">${A.exIdx > 0 ? `<button class="a-plain" data-go="prev">Voltar</button>` : "<span></span>"}<button class="a-big${allDone ? "" : " soft"}" data-go="next">${A.exIdx === n - 1 ? "Terminar treino" : allDone ? "Próximo exercício" : "Pular pro próximo"}</button></div>`;
    if (A.exIdx === 0) ls.set("al.seen", true);
    window.scrollTo(0, 0); mountCanvases(V());
  }

  function finish() {
    const t = A.p.treinos[A.tIdx];
    const itens = {}; let feitas = 0;
    t.exercicios.forEach((ex) => {
      const mk = A.marks[ex.id] || [], inp = A.inputs[ex.id] || {}, pl = planoSeries(ex);
      const c = pl.filter((x, i) => x.tipo === "valida" && mk[i]).length || mk.filter(Boolean).length;
      const series = pl.map((p, i) => { const x = (inp.sets || [])[i]; return { tipo: p.tipo, kg: num(x && x.kg), reps: (x && num(x.reps)) == null ? null : Math.round(num(x.reps)), ok: !!mk[i] }; }).filter((x) => x.kg != null || x.reps != null || x.ok);
      const vals = series.filter((x) => x.tipo === "valida"), base = vals.length ? vals : series;
      const kgs = base.map((x) => x.kg).filter((v) => v != null), withReps = base.filter((x) => x.reps != null);
      const carga = kgs.length ? Math.max(...kgs) : num(inp.carga), reps = withReps.length ? withReps[withReps.length - 1].reps : (num(inp.reps) == null ? null : Math.round(num(inp.reps)));
      const obs = (inp.obs || "").trim();
      if (c || carga != null || reps != null || obs) {
        itens[ex.id] = { nome: exNome(ex), carga, reps, feitas: c };
        if (series.length) itens[ex.id].series = series;
        if (obs) itens[ex.id].obs = obs;
        feitas += c;
      }
    });
    const any = Object.keys(itens).length > 0;
    if (any && !A.savedOnce) {
      A.savedOnce = true;
      B.set("sessoes", B.newId("sessoes"), { pessoaId: P, treinoId: t.id, treinoNome: t.nome, data: todayISO(), ts: Date.now(), itens, origem: "aluno" }).catch((e) => console.warn(e));
    }
    const mc = Math.max(monthCount(), any ? 1 : 0);
    const msg = `Fiz o ${t.nome} hoje: ${feitas} ${feitas === 1 ? "série" : "séries"} ✅`;
    V().innerHTML = `
      <div class="a-done" aria-hidden="true">✓</div>
      <h1 class="a-center">${any ? "Treino feito!" : "Tudo bem, fica pra próxima"}</h1>
      <p class="a-center" style="font-size:1.1em">${any ? `${feitas ? `Você fez ${feitas} ${feitas === 1 ? "série" : "séries"} hoje.` : "Treino registrado."}${mc > 1 ? ` Já são ${mc} dias de treino este mês.` : ""}` : "Qualquer movimento já conta. Volte quando puder."}</p>
      ${any ? `<div class="a-card"><p>Descanse e beba água. A evolução de hoje já aparece na aba Evolução.</p></div>
      <a class="a-big soft" style="text-align:center;text-decoration:none;display:block" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Contar no WhatsApp</a>` : ""}
      <button class="a-big" data-go="home">Voltar ao início</button>`;
    releaseWake(); window.scrollTo(0, 0);
  }

  function applyTheme() {
    if (!A.p && !ls.get("al.theme", null)) return;
    const root = document.documentElement, light = themeMode() === "claro";
    const before = root.className;
    root.classList.add("sport"); root.classList.toggle("light", light);
    if (root.className !== before) { readCols(); const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? "#F3F4EF" : "#0B0D0F"; }
  }
  function render() {
    $("#aluno").classList.toggle("simples", simples());
    $("#aluno").classList.toggle("normal", !simples());
    applyTheme();
    const onHome = A.screen === "home";
    $("#atabs").hidden = !onHome;
    document.querySelectorAll("[data-atab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.atab === A.tab ? "true" : "false"));
    if (A.screen === "ex") exercise(); else if (A.screen === "end") finish(); else if (A.screen === "cardio") cardioScreen(); else if (A.tab === "evol") evol(); else home();
  }

  // descanso em tela cheia
  let tEnd = 0, tTot = 0, tInt = 0;
  function rest(secs) { unlockAudio(); paused = true; tTot = secs; tEnd = Date.now() + secs * 1000; $("#rest").hidden = false; clearInterval(tInt); tick(); tInt = setInterval(tick, 250); }
  function tick() {
    const left = Math.max(0, Math.ceil((tEnd - Date.now()) / 1000));
    $("#clock").textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    $("#ringArc").setAttribute("stroke-dashoffset", (276.5 * (1 - left / tTot)).toFixed(1));
    if (left <= 0) { clearInterval(tInt); $("#restMsg").textContent = "Pronto! Vamos pra próxima série."; beep(); vibrate(); setTimeout(endRest, 1800); }
  }
  function endRest() { clearInterval(tInt); $("#rest").hidden = true; paused = false; $("#restMsg").textContent = "Respire fundo. Beba um gole de água."; }
  $("#skip").addEventListener("click", endRest);

  async function keepAwake() { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request("screen"); } catch (e) { wake = null; } }
  function releaseWake() { try { wake && wake.release(); } catch (e) {} wake = null; }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && A.screen === "ex") keepAwake(); });
  window.addEventListener("online", () => A.screen === "home" && render());
  window.addEventListener("offline", () => A.screen === "home" && render());

  document.addEventListener("input", (e) => {
    if ($("#aluno").hidden || A.screen !== "ex") return;
    const el = e.target, ds = el.dataset;
    if (ds.skg == null && ds.sreps == null && !("aobs" in ds)) return;
    const ex = A.p.treinos[A.tIdx].exercicios[A.exIdx];
    const d = (A.inputs[ex.id] = A.inputs[ex.id] || {}); d.sets = d.sets || [];
    if ("aobs" in ds) d.obs = el.value;
    else {
      const i = +(ds.skg ?? ds.sreps); d.sets[i] = d.sets[i] || {};
      if (ds.skg != null) {
        d.sets[i].kg = el.value;
        // a carga digitada vira sugestão pras séries seguintes ainda vazias
        document.querySelectorAll("[data-skg]").forEach((x) => { const j = +x.dataset.skg; if (j > i && !x.value && el.value) x.placeholder = el.value; });
      } else d.sets[i].reps = el.value;
    }
    ls.set("al.inputs." + P, A.inputs);
  });
  document.addEventListener("click", (e) => {
    if ($("#aluno").hidden) return;
    const b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-theme-toggle")) { ls.set("al.theme", themeMode() === "escuro" ? "claro" : "escuro"); render(); return; }
    if (b.dataset.themeSet) { ls.set("al.theme", b.dataset.themeSet); render(); return; }
    if (b.dataset.atab) { A.tab = b.dataset.atab; ls.set("al.tab." + P, A.tab); window.scrollTo(0, 0); render(); return; }
    if (b.dataset.acal) { A.calMonth = shiftMonth(A.calMonth, b.dataset.acal === "next" ? 1 : -1); render(); return; }
    if (b.dataset.apick != null) { A.tIdx = +b.dataset.apick; render(); return; }
    if (b.dataset.wday) { A.selDate = b.dataset.wday === todayISO() ? null : b.dataset.wday; window.scrollTo(0, 0); render(); return; }
    if (b.dataset.dostart != null) { A.tIdx = +b.dataset.dostart; A.selDate = null; A.screen = "ex"; A.exIdx = 0; A.marks = {}; A.inputs = {}; A.savedOnce = false; ls.set("al.marks." + P, {}); ls.set("al.inputs." + P, {}); keepAwake(); render(); return; }
    if (b.dataset.cardio) {
      const it = diaDe(A.p, new Date().getDay()).find((x) => x.id === b.dataset.cardio) || { id: b.dataset.cardio, nome: "Cardio" };
      A.cardio = it; A.cInt = "Moderado";
      if (simples()) { saveCardio(true); return; }
      A.screen = "cardio"; render(); return;
    }
    if (b.dataset.cint) { A.cInt = b.dataset.cint; document.querySelectorAll("[data-cint]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false")); return; }
    const t = A.p && A.p.treinos[A.tIdx];
    if (b.dataset.set != null) {
      const ex = t.exercicios[A.exIdx], m = (A.marks[ex.id] = A.marks[ex.id] || []), i = +b.dataset.set;
      m[i] = !m[i]; ls.set("al.marks." + P, A.marks);
      if (m[i] && !simples()) {
        const d = (A.inputs[ex.id] = A.inputs[ex.id] || {}); d.sets = d.sets || []; d.sets[i] = d.sets[i] || {};
        const kgEl = document.querySelector(`[data-skg="${i}"]`), rEl = document.querySelector(`[data-sreps="${i}"]`);
        if (kgEl && !kgEl.value && kgEl.placeholder) d.sets[i].kg = kgEl.placeholder;
        if (rEl && !rEl.value && rEl.placeholder) d.sets[i].reps = rEl.placeholder;
        const o = document.querySelector("[data-aobs]"); if (o) d.obs = o.value;
        ls.set("al.inputs." + P, A.inputs);
      }
      const done = m.filter(Boolean).length;
      const pl = planoSeries(ex);
      exercise(); if (m[i] && pl.some((_, k) => !m[k])) rest(restSecs(pl[i] && pl[i].tipo !== "valida" ? TIPOS[pl[i].tipo].rest : ex.descanso));
      return;
    }
    const go = b.dataset.go; if (!go) return;
    if (go === "today") { A.selDate = null; window.scrollTo(0, 0); render(); return; }
    if (go === "force") { A.forceTreino = true; A.tIdx = null; render(); return; }
    if (go === "save-cardio") { saveCardio(false); return; }
    if (go === "start") { A.screen = "ex"; A.exIdx = 0; A.marks = {}; A.inputs = {}; A.savedOnce = false; ls.set("al.marks." + P, {}); ls.set("al.inputs." + P, {}); keepAwake(); render(); }
    else if (go === "swap") { A.tIdx = (A.tIdx + 1) % A.p.treinos.length; render(); }
    else if (go === "next") { if (A.exIdx < t.exercicios.length - 1) { A.exIdx++; render(); } else { A.screen = "end"; render(); } }
    else if (go === "prev") { A.exIdx = Math.max(0, A.exIdx - 1); render(); }
    else if (go === "quit") { A.screen = "end"; render(); }
    else if (go === "home") { A.screen = "home"; A.tIdx = null; A.marks = {}; A.inputs = {}; ls.set("al.marks." + P, {}); ls.set("al.inputs." + P, {}); render(); }
  });

  render();
}

if ("serviceWorker" in navigator && !DEMO && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
boot();
