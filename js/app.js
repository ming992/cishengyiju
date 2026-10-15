/* CitySoul 应用主逻辑 */
(function () {
"use strict";
const CN = window.CITYSOUL_CN, GL = window.CITYSOUL_GLOBAL, QB = window.CITYSOUL_QUESTIONS;
const S = Scoring, R = Reports, P = Poster, ST = Store;

const PRODUCTS = [
  { id:"trial", name:"体验报告", price:9.9, desc:"解锁中国 & 海外 TOP10 完整排行榜", level:1 },
  { id:"deep", name:"深度报告", price:19.9, desc:"排行榜 + 预算模拟 + 人生阶段模拟 + 全部海报", level:2 },
  { id:"duo", name:"双人匹配报告", price:39.9, desc:"深度报告 + 合拍维度详解与共同城市建议", level:3 },
];
const REDEEM = { "SOUL2026":"trial", "DEEP2026":"deep", "DUO2026":"duo" };
const LEVEL_RANK = { free:0, trial:1, deep:2, duo:3 };

const state = {
  mode: null, questions: [], idx: 0, answers: {},
  constraints: null, settings: ST.getSettings(), result: null,
  rankOrder: [],
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- 工具 ---------- */
function toast(msg, ms) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(t._tm); t._tm = setTimeout(() => { t.hidden = true; }, ms || 2200);
}
function openModal(html) { $("#modal-body").innerHTML = html; $("#modal").hidden = false; }
function closeModal() { $("#modal").hidden = true; }
function show(id) {
  $$(".screen").forEach(s => s.classList.toggle("active", s.id === "screen-" + id));
  window.scrollTo({ top: 0, behavior: state.settings.motion === "reduced" ? "auto" : "smooth" });
}
function unlockLevel() { return LEVEL_RANK[ST.getUnlock().level] || 0; }
function reduced() {
  return state.settings.motion === "reduced" ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/* ---------- 初始化 ---------- */
function init() {
  applySettings();
  $("#fact-cn").textContent = CN.cities.length + "+";
  $("#fact-gl").textContent = GL.cities.length + "+";
  $("#data-version").textContent = CN.meta.dataVersion + " / " + GL.meta.dataVersion + " / " + QB.meta.version;
  renderSampleCards(); renderWall(); drawMaps();
  renderProducts(); renderWeights(); renderHistory(); renderMyCodes(); renderUnlockStatus();
  wireEvents();
  document.addEventListener("keydown", onKey);
}

function applySettings() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.motion = state.settings.motion;
  $$("#seg-theme button").forEach(b => b.classList.toggle("on", b.dataset.theme === state.settings.theme));
  $$("#seg-motion button").forEach(b => b.classList.toggle("on", b.dataset.motion === state.settings.motion));
}

/* ---------- 首页内容 ---------- */
const GRADS = [
  ["#2e5fa3","#0f2d4e"], ["#f2805a","#b84a2b"], ["#a48fd4","#5c4a8f"],
  ["#3e8e7e","#14524a"], ["#d9a441","#8a5f14"], ["#5b8dd9","#2b4d8f"],
];
function gradFor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return GRADS[h % GRADS.length]; }

function renderSampleCards() {
  const picks = [
    { n: "成都", s: 91, t: "安逸 · 茶馆 · 新经济" },
    { n: "青岛", s: 87, t: "啤酒 · 海岸 · 红瓦绿树" },
    { n: "哥本哈根", s: 89, t: "hygge · 自行车 · 设计" },
    { n: "清迈", s: 85, t: "古城 · 咖啡 · 数字游民" },
  ];
  $("#sample-cards").innerHTML = picks.map(p => {
    const [a, b] = gradFor(p.n);
    return `<div class="sample-card">
      <div class="sc-visual" style="background:linear-gradient(150deg,${a},${b})">${esc(p.n)}</div>
      <div class="sc-body"><div class="sc-score">适配指数 ${p.s}</div><div class="sc-tags">${esc(p.t)}</div></div>
    </div>`;
  }).join("");
}

function renderWall() {
  const names = ["成都","杭州","厦门","重庆","西安","昆明","东京","里斯本","墨尔本","清迈","大理","泉州"];
  const all = CN.cities.concat(GL.cities);
  const picks = names.map(n => all.find(c => c.name === n)).filter(Boolean);
  $("#postcard-wall").innerHTML = picks.map(c => {
    const [a, b] = gradFor(c.name);
    return `<div class="postcard" tabindex="0" role="button" aria-label="翻转 ${esc(c.name)} 明信片">
      <div class="pc-inner">
        <div class="pc-face pc-front" style="--pc-a:${a};--pc-b:${b}">
          ${esc(c.name)}<small>${esc(c.nameEn)} · ${esc(c.tags[0])}</small>
        </div>
        <div class="pc-face pc-back"><b>${esc(c.name)}</b><span>${esc(c.intro)}</span><span>适合: ${esc(c.suitableFor)}</span></div>
      </div></div>`;
  }).join("");
  $$(".postcard").forEach(el => {
    const flip = () => el.classList.toggle("flipped");
    el.addEventListener("click", flip);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
  });
}

/* 示意投影光点图 (非精确地图) */
function drawMaps() {
  drawDotMap($("#world-map"), GL.cities, [-180, 180, -60, 85], "世界城市样本 " + GL.cities.length + " 座");
  drawDotMap($("#cn-map"), CN.cities, [73, 136, 17, 54], "中国城市样本 " + CN.cities.length + " 座");
}
function drawDotMap(canvas, cities, box, label) {
  const W = 640, H = 380, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const dark = state.settings.theme === "dark";
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = dark ? "rgba(255,255,255,.07)" : "rgba(15,45,78,.07)";
  for (let x = 0; x < W; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const [lo, hi, la, lb] = box;
  cities.forEach(c => {
    const x = (c.lng - lo) / (hi - lo) * (W - 40) + 20;
    const y = (1 - (c.lat - la) / (lb - la)) * (H - 40) + 20;
    if (x < 6 || x > W - 6 || y < 6 || y > H - 6) return;
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(242,128,90,.85)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(242,128,90,.18)"; ctx.fill();
  });
  ctx.fillStyle = dark ? "#c9d4e6" : "#40506b";
  ctx.font = "14px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillText(label, 16, H - 14);
}

/* ---------- 答题流程 ---------- */
function pickQuestions(mode) {
  const ids = mode === "quick" ? QB.quickIds : QB.deepIds;
  const map = {}; QB.questions.forEach(q => { map[q.id] = q; });
  return ids.map(id => map[id]).filter(Boolean);
}
function groupName(gid) {
  const g = QB.groups.find(x => x.id === gid);
  return g ? `第${"一二三四五六"[gid - 1]}组 · ${g.name}` : "";
}
function startQuiz(mode, resume) {
  state.mode = mode;
  state.questions = pickQuestions(mode);
  state.answers = {}; state.idx = 0; state.rankOrder = [];
  if (!resume) {
    const draft = ST.loadDraft();
    if (draft && draft.mode === mode && draft.answers && Object.keys(draft.answers).length) {
      openModal(`<h3>发现未完成的测试</h3><p class="muted">你有一份「${esc(QB.meta.modes[mode].name)}」的暂存进度 (${Object.keys(draft.answers).length} 题), 要继续吗?</p>
        <div class="row-gap"><button class="btn btn-primary btn-sm" id="m-resume">继续上次进度</button>
        <button class="btn btn-ghost btn-sm" id="m-fresh">重新开始</button></div>`);
      $("#m-resume").onclick = () => { closeModal(); state.answers = draft.answers; state.idx = draft.idx || 0; enterQuiz(); };
      $("#m-fresh").onclick = () => { closeModal(); ST.clearDraft(); enterQuiz(); };
      return;
    }
  }
  enterQuiz();
}
function enterQuiz() { show("quiz"); renderQuestion(); }

function renderQuestion() {
  const q = state.questions[state.idx];
  const total = state.questions.length;
  $("#quiz-chapter").textContent = groupName(q.group);
  $("#quiz-count").textContent = `${state.idx + 1} / ${total}`;
  $("#quiz-progress").style.width = (state.idx / total * 100) + "%";
  $("#btn-prev").disabled = state.idx === 0;
  $("#btn-next").textContent = state.idx === total - 1 ? (state.mode === "reality" ? "填写现实条件" : "查看结果") : "下一题";

  const card = $("#question-card");
  const cur = state.answers[q.id];
  let html = `<h2>${esc(q.title)}</h2><p class="q-note">${esc(q.note || "")}</p>`;

  if (q.type === "multi") {
    const sel = Array.isArray(cur) ? cur : [];
    html += q.options.map(o => `
      <button class="opt ${sel.includes(o.key) ? "selected" : ""}" data-opt="${o.key}" data-kind="multi">
        <span class="opt-key">${o.key}</span><span>${esc(o.text)}</span></button>`).join("");
    html += `<p class="q-note">已选 ${sel.length} / ${q.maxSelect} 项</p>`;
  } else if (q.type === "ranking") {
    const order = Array.isArray(cur) ? cur : [];
    state.rankOrder = order.slice();
    html += q.options.map(o => {
      const pos = order.indexOf(o.key);
      return `<button class="opt ${pos >= 0 ? "selected" : ""}" data-opt="${o.key}" data-kind="ranking">
        <span class="opt-key ${pos >= 0 ? "rank-badge" : ""}">${pos >= 0 ? pos + 1 : o.key}</span><span>${esc(o.text)}</span></button>`;
    }).join("");
    html += `<p class="q-note">按重视程度从高到低依次点击, 再次点击可取消 · 已排 ${order.length} / ${q.options.length}</p>`;
  } else {
    html += q.options.map(o => `
      <button class="opt ${cur === o.key ? "selected" : ""}" data-opt="${o.key}" data-kind="single">
        <span class="opt-key">${o.key}</span><span>${esc(o.text)}</span></button>`).join("");
  }
  card.innerHTML = html;
  card.querySelectorAll(".opt").forEach(btn => btn.addEventListener("click", () => onOpt(q, btn.dataset.opt, btn.dataset.kind)));
  updateNext();
}

function onOpt(q, key, kind) {
  if (kind === "single") {
    state.answers[q.id] = key;
    renderQuestion();
    if (!reduced()) setTimeout(nextQuestion, 180);
    return;
  }
  if (kind === "multi") {
    let sel = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
    const i = sel.indexOf(key);
    if (i >= 0) sel.splice(i, 1);
    else if (sel.length < q.maxSelect) sel.push(key);
    else { toast(`最多选择 ${q.maxSelect} 项`); return; }
    state.answers[q.id] = sel;
    renderQuestion();
    return;
  }
  // ranking
  let order = state.rankOrder.slice();
  const i = order.indexOf(key);
  if (i >= 0) order.splice(i, 1); else order.push(key);
  state.rankOrder = order;
  state.answers[q.id] = order.length === state.questions[state.idx].options.length ? order.slice() : order;
  renderQuestion();
}

function answered(q) {
  const a = state.answers[q.id];
  if (a == null) return false;
  if (q.type === "multi") return Array.isArray(a) && a.length >= 1;
  if (q.type === "ranking") return Array.isArray(a) && a.length === q.options.length;
  return typeof a === "string";
}
function updateNext() { $("#btn-next").disabled = !answered(state.questions[state.idx]); }

function nextQuestion() {
  const q = state.questions[state.idx];
  if (!answered(q)) { toast("先选择一个答案再继续"); return; }
  if (state.idx < state.questions.length - 1) { state.idx++; renderQuestion(); }
  else if (state.mode === "reality") { show("constraints"); }
  else finishQuiz(null);
}
function prevQuestion() { if (state.idx > 0) { state.idx--; renderQuestion(); } }
function exitQuiz() {
  if (Object.keys(state.answers).length) {
    ST.saveDraft({ mode: state.mode, idx: state.idx, answers: state.answers, savedAt: new Date().toISOString() });
    toast("进度已暂存, 下次可继续");
  }
  show("home");
}

function readConstraints() {
  const f = $("#constraints-form");
  return {
    budget: +f.budget.value,
    occupation: f.occupation.value,
    family: f.family.value,
    langWilling: +f.langWilling.value,
    currentCity: f.currentCity.value.trim(),
    noCold: f.noCold.checked, noHeat: f.noHeat.checked,
    strictness: +f.strictness.value,
  };
}

/* ---------- 计算与结果 ---------- */
function computeAll(answers, mode, constraints) {
  const bank = mode === "quick" ? pickQuestions("quick") : QB.questions;
  const profile = S.computeProfile(answers, bank);
  const weights = S.mergeWeights(profile.importance, state.settings.customWeights);
  const cnTop = S.rankCities(profile.dims, weights, CN.cities, constraints, false);
  const glTop = S.rankCities(profile.dims, weights, GL.cities, constraints, true);
  const currentCityRow = constraints && constraints.currentCity
    ? CN.cities.find(c => c.name === constraints.currentCity || c.name.includes(constraints.currentCity) || constraints.currentCity.includes(c.name)) || null
    : null;
  const stabCn = S.stability(profile.dims, weights, CN.cities, constraints, false);
  const stabGl = S.stability(profile.dims, weights, GL.cities, constraints, true);
  const report = R.buildReport({
    profile, weights, cnTop, glTop, mode, constraints, currentCityRow,
    stabilityCn: stabCn, stabilityGl: stabGl,
  });
  const payload = {
    v: CN.meta.dataVersion + "|" + GL.meta.dataVersion + "|" + QB.meta.version,
    m: mode, d: roundDims(profile.dims),
    c: [cnTop[0].id, glTop[0].id], n: report.nick,
  };
  return {
    profile, weights, cnTop, glTop, report, currentCityRow,
    code: S.encodeResult(payload),
    blindCode: S.encodeResult(Object.assign({ b: 1 }, payload)),
  };
}
function roundDims(d) { const o = {}; S.DIM_KEYS.forEach(k => { o[k] = Math.round(d[k]); }); return o; }

function finishQuiz(constraints) {
  state.constraints = constraints;
  ST.clearDraft();
  const res = computeAll(state.answers, state.mode, constraints);
  state.result = res;
  const recordId = ST.saveRecord({
    mode: state.mode, answers: state.answers, constraints,
    summary: {
      nick: res.report.nick,
      cn: { name: res.cnTop[0].name, score: res.cnTop[0].score },
      gl: { name: res.glTop[0].name, score: res.glTop[0].score },
    },
    code: res.code, blindCode: res.blindCode,
    dataVersion: CN.meta.dataVersion + "/" + GL.meta.dataVersion + "/" + QB.meta.version,
  });
  state.result.recordId = recordId;
  renderMyCodes();
  runReveal();
}

/* ---------- 揭晓动画 ---------- */
let revealRAF = null;
function runReveal() {
  show("reveal");
  const box = $("#reveal-cards"); box.hidden = true; box.innerHTML = "";
  $("#reveal-skip").hidden = false;
  const canvas = $("#reveal-canvas");
  if (reduced()) { stopReveal(); return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 460;
  canvas.width = size * dpr; canvas.height = size * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const dark = state.settings.theme === "dark";
  const cities = CN.cities.concat(GL.cities);
  let t0 = performance.now();
  const DUR = 2400;
  function frame(t) {
    const el = t - t0;
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, R = 150;
    // 地球光点
    cities.forEach((c, i) => {
      const th = ((c.lng + 180) / 360) * Math.PI * 2 + el / 1400;
      const ph = ((c.lat + 90) / 180) * Math.PI;
      const x = cx + R * Math.sin(ph) * Math.cos(th);
      const y = cy - R * Math.cos(ph);
      const z = Math.sin(ph) * Math.sin(th);
      if (z < -0.15) return;
      ctx.beginPath(); ctx.arc(x, y, 1.6 + z * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(242,128,90,${0.25 + z * 0.6})`; ctx.fill();
    });
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? "rgba(255,255,255,.2)" : "rgba(46,95,163,.25)"; ctx.stroke();
    ctx.fillStyle = dark ? "#e8eefb" : "#0f2d4e";
    ctx.font = "600 22px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.textAlign = "center";
    const pct = Math.min(99, Math.round(el / DUR * 100));
    ctx.fillText(`正在匹配 ${CN.cities.length + GL.cities.length} 座城市… ${pct}%`, cx, size - 24);
    if (el < DUR) revealRAF = requestAnimationFrame(frame);
    else stopReveal();
  }
  revealRAF = requestAnimationFrame(frame);
}
function stopReveal() {
  if (revealRAF) cancelAnimationFrame(revealRAF); revealRAF = null;
  $("#reveal-canvas").style.display = "none";
  $("#reveal-skip").hidden = true;
  const res = state.result;
  const box = $("#reveal-cards");
  box.hidden = false;
  const mk = (row, label) => {
    const [a, b] = gradFor(row.name);
    return `<div class="reveal-card">
      <div class="rc-visual" style="background:linear-gradient(150deg,${a},${b})"><small>${label}</small><h3>${esc(row.name)}</h3></div>
      <div class="rc-body">
        <div class="rc-score">适配指数 ${row.score}</div>
        <div class="rc-nick">「${esc(res.report.nick)}」</div>
        <div class="muted">${esc(row.tags.slice(0, 3).join(" · "))}</div>
      </div></div>`;
  };
  box.innerHTML =
    mk(res.cnTop[0], "你的中国灵魂城市") + mk(res.glTop[0], "你的世界灵魂城市") +
    `<div class="reveal-card" style="display:flex;align-items:center;justify-content:center">
      <button class="btn btn-primary btn-lg" data-action="view-report">查看完整报告</button></div>`;
}

/* ---------- 报告 ---------- */
function lockHtml(title, need) {
  return `<div class="lock-mask"><b>${esc(title)}</b><span class="muted">解锁「${need}」后可见</span>
    <button class="btn btn-primary btn-sm" data-nav="settings">查看解锁方案</button></div>`;
}
function lockedSection(title, inner, level, needName) {
  const locked = unlockLevel() < level;
  return `<div class="rcard ${locked ? "locked" : ""}"><h3>${esc(title)}</h3>${inner}${locked ? lockHtml(title, needName) : ""}</div>`;
}

function renderReport(res) {
  const r = res.report;
  const lvl = unlockLevel();
  const root = $("#report-root");
  const modeName = QB.meta.modes[res.mode || state.mode] ? QB.meta.modes[res.mode || state.mode].name : "";

  const hero = `<div class="report-hero">
    <p class="hero-eyebrow">${esc(modeName)} · 报告</p>
    <h2>你是「${esc(r.nick)}」</h2>
    <div class="kw-row" style="justify-content:center;margin:.8rem 0">${r.keywords.map(k => `<span class="kw">${esc(k)}</span>`).join("")}</div>
    <p class="muted">${esc(r.lifestyle)}</p>
  </div>`;

  const topCard = (side, label, path) => {
    const t = r[side].top;
    const [a, b] = gradFor(t.name);
    const ex = r[side].explain;
    return `<div class="rcard">
      <div class="rc-visual" style="background:linear-gradient(150deg,${a},${b});border-radius:14px;margin-bottom:1rem">
        <small>${label}</small><h3>${esc(t.name)} <span style="font-size:.55em;font-weight:400">${esc(t.nameEn)}</span></h3>
      </div>
      <div class="rc-score">模型适配指数 ${t.score}</div>
      <p class="stab">结果稳定性: <b>${r[side].stability.label}</b> (权重扰动下波动 ${r[side].stability.std} 分; 复测榜首 ${esc(r[side].stability.retestTop1)})</p>
      <p class="muted" style="margin:.5rem 0">${esc(t.intro)}</p>
      <h4>为什么是它</h4><ul class="reason-list">${ex.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>现实挑战</h4><ul class="reason-list">${ex.challenges.concat(t.penaltyNotes || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${path ? `<p class="muted">迁居信息提示: ${esc(t.relocatePath || "")}<br>签证与工作许可仅为一般信息, 不构成资格保证。</p>` : ""}
    </div>`;
  };

  const listHtml = (list) => `<div class="rank-list">${list.map((c, i) =>
    `<div class="rank-item ${i === 0 ? "top" : ""}"><span class="no">${i + 1}</span>
      <span class="nm">${esc(c.name)} <small>${esc(c.region)} · ${esc(c.tags.slice(0, 2).join(" / "))}</small></span>
      <span class="sc">${c.score}</span></div>`).join("")}</div>`;

  const radarId = "radar-" + Date.now();

  const budgetRows = () => {
    const sims = S.budgetSimulation(res.profile.dims, res.weights, CN.cities, false, [30, 50, 70, 90]);
    const label = { 30: "≤8万/年", 50: "8–15万/年", 70: "15–30万/年", 90: "30万+/年" };
    return `<table class="sim-table"><tr><th>预算条件</th><th>中国城市 TOP3</th></tr>${sims.map(s =>
      `<tr><td>${label[s.budget]}</td><td>${s.top.map(t => `${esc(t.name)} (${t.score})`).join(" · ")}</td></tr>`).join("")}</table>`;
  };

  const stages = [
    { key: "solo", name: "独居探索期", w: { d10: 0.6, d11: 1.3, d12: 1.2 } },
    { key: "career", name: "职业冲刺期", w: { d02: 1.8, d01: 1.2, d10: 0.7 } },
    { key: "family", name: "家庭经营期", w: { d10: 1.9, d08: 1.2, d11: 0.5 } },
    { key: "semi", name: "半退休生活", w: { d01: 0.5, d06: 1.5, d03: 0.8, d12: 1.3 } },
  ];
  const stageRows = () => `<table class="sim-table"><tr><th>人生阶段</th><th>中国 TOP1</th><th>海外 TOP1</th></tr>${stages.map(st => {
    const w = {}; S.DIM_KEYS.forEach(d => { w[d] = (res.weights[d] || 1) * (st.w[d] || 1); });
    const cn = S.rankCities(res.profile.dims, w, CN.cities, res.constraints, false)[0];
    const gl = S.rankCities(res.profile.dims, w, GL.cities, res.constraints, true)[0];
    return `<tr><td>${st.name}</td><td>${esc(cn.name)} (${cn.score})</td><td>${esc(gl.name)} (${gl.score})</td></tr>`;
  }).join("")}</table>`;

  root.innerHTML = hero + `<div class="report-grid">
    ${topCard("cn", "你的中国灵魂城市", false)}
    ${topCard("gl", "你的世界灵魂城市", true)}
    <div class="rcard"><h3>12 维城市人格画像</h3>
      <p class="sub">蓝色为你, 橙色为中国第一匹配城市</p>
      <div class="radar-wrap"><canvas id="${radarId}" role="img" aria-label="12维人格雷达图"></canvas></div>
    </div>
    ${lockedSection("中国 TOP10 排行榜", listHtml(r.cn.list), 1, "体验报告")}
    ${lockedSection("海外 TOP10 排行榜", listHtml(r.gl.list), 1, "体验报告")}
    ${lockedSection("不同预算下的匹配变化", budgetRows(), 2, "深度报告")}
    ${lockedSection("人生阶段模拟", stageRows(), 2, "深度报告")}
    ${lockedSection("五年后的你", `<p>${esc(r.cn.fiveYear)}</p>`, 2, "深度报告")}
    ${r.cn.compare ? lockedSection("与现居城市对照", `<p>${esc(r.cn.compare.text)}</p>`, 2, "深度报告") : ""}
    ${lockedSection("迁居核实清单", `<h4>${esc(r.cn.top.name)} (国内)</h4><ul class="reason-list">${r.cnChecklist.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4 style="margin-top:.8rem">${esc(r.gl.top.name)} (海外)</h4><ul class="reason-list">${r.gl.checklist.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`, 2, "深度报告")}
    <div class="rcard"><h3>分享与海报</h3>
      <p class="sub">海报在本机 Canvas 实时生成, 可保存为 PNG</p>
      <div class="poster-row">
        <button class="btn btn-outline btn-sm" data-action="poster" data-kind="soul-cn">灵魂身份证 (国内)</button>
        <button class="btn btn-outline btn-sm" data-action="poster" data-kind="soul-gl">灵魂身份证 (海外)</button>
        <button class="btn btn-outline btn-sm" data-action="poster" data-kind="ticket">命定城市机票</button>
        <button class="btn btn-outline btn-sm" data-action="poster" data-kind="dual">双城人生海报</button>
        <button class="btn btn-outline btn-sm" data-action="poster" data-kind="contrast">城市反差卡</button>
      </div>
      <h4 style="margin-top:1.2rem">我的结果码</h4>
      <span class="code-chip" data-copy="${esc(res.code)}" title="点击复制">${esc(res.code)}</span>
      <h4>盲盒码 (朋友先猜后揭晓)</h4>
      <span class="code-chip" data-copy="${esc(res.blindCode)}" title="点击复制">${esc(res.blindCode)}</span>
    </div>
    <div class="rcard"><h3>再测与反馈</h3>
      <div class="row-gap">
        <button class="btn btn-outline btn-sm" data-action="choose-mode">换一种模式再测</button>
        <button class="btn btn-ghost btn-sm" data-action="feedback">这次推荐准吗?</button>
      </div>
    </div>
    <p class="muted" style="text-align:center">模型适配指数为偏好相似度, 非"适合概率"; 城市特征含编辑性评估成分 · 数据版本 ${esc(CN.meta.dataVersion)}/${esc(GL.meta.dataVersion)}/${esc(QB.meta.version)}</p>
  </div>`;

  show("report");
  R.drawRadar(document.getElementById(radarId), res.profile.dims, res.cnTop[0].vector,
    { theme: state.settings.theme, size: Math.min(340, window.innerWidth - 60) });
  root.querySelectorAll("[data-copy]").forEach(el =>
    el.addEventListener("click", () => copyText(el.dataset.copy)));
}

/* ---------- 海报 ---------- */
function makePoster(kind) {
  const res = state.result; if (!res) return;
  const r = res.report;
  const lvl = unlockLevel();
  if ((kind === "dual" || kind === "contrast") && lvl < 2) {
    openModal(`<h3>该海报属于深度报告</h3><p class="muted">解锁深度报告后可使用全部海报模板。</p>
      <div class="row-gap"><button class="btn btn-primary btn-sm" data-nav="settings" onclick="document.querySelector('[data-action=modal-close]').click()">查看解锁方案</button></div>`);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const canvas = document.createElement("canvas");
  let fname = "citysoul.png";
  if (kind === "soul-cn" || kind === "soul-gl") {
    const t = kind === "soul-cn" ? res.cnTop[0] : res.glTop[0];
    P.soulIdCard(canvas, { cityName: t.name, cityNameEn: t.nameEn, score: t.score, nick: r.nick, tags: t.tags, intro: t.intro, code: res.code, scope: kind === "soul-gl" ? "gl" : "cn" });
    fname = `citysoul-id-${t.nameEn}.png`;
  } else if (kind === "ticket") {
    P.boardingPass(canvas, { from: (res.constraints && res.constraints.currentCity) || "此刻", cityName: res.cnTop[0].name, userName: "城市探索者", nick: r.nick, score: res.cnTop[0].score, date: today, code: res.code, tags: res.cnTop[0].tags, gate: "CS-12" });
    fname = "citysoul-ticket.png";
  } else if (kind === "dual") {
    P.dualCity(canvas, { cn: { name: res.cnTop[0].name, score: res.cnTop[0].score }, gl: { name: res.glTop[0].name, score: res.glTop[0].score }, nick: r.nick, lifestyle: r.lifestyle, code: res.code });
    fname = "citysoul-dual.png";
  } else {
    P.contrastCard(canvas, { current: (res.constraints && res.constraints.currentCity) || "现在的城市", soul: res.cnTop[0].name, score: res.cnTop[0].score, nick: r.nick });
    fname = "citysoul-contrast.png";
  }
  openModal(`<h3>海报预览</h3>
    <div style="text-align:center;margin:.6rem 0"><img src="${canvas.toDataURL("image/png")}" style="max-width:100%;max-height:56vh;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.2)" alt="海报预览"></div>
    <div class="row-gap" style="justify-content:center"><button class="btn btn-primary btn-sm" id="m-dl">保存 PNG</button></div>`);
  $("#m-dl").onclick = () => P.download(canvas, fname);
}

/* ---------- 好友合拍 / 盲盒 ---------- */
function doCompare(kind) {
  const code = $("#compare-code").value.trim();
  const obj = S.decodeResult(code);
  const out = $("#compare-result");
  if (!obj) { out.innerHTML = `<p class="empty">无法识别该结果码, 请检查是否完整复制。</p>`; return; }
  const mine = state.result ? state.result.profile.dims : null;
  const theirDims = obj.d;
  const w = {}; S.DIM_KEYS.forEach(d => { w[d] = 1; });
  const cnT = S.rankCities(theirDims, w, CN.cities, null, false).slice(0, 3);
  const glT = S.rankCities(theirDims, w, GL.cities, null, true).slice(0, 3);
  let html = `<div class="rcard" style="margin-top:1.2rem"><h3>TA 是「${esc(obj.n || "城市探索者")}」</h3>
    <p class="sub">TA 的中国 TOP3: ${cnT.map(c => esc(c.name)).join(" · ")} ｜ 世界 TOP3: ${glT.map(c => esc(c.name)).join(" · ")}</p>`;
  if (!mine) {
    html += `<p class="muted">你还没有本地测试结果 —— 先完成一次测试, 才能计算两人的合拍度。</p></div>`;
  } else if (kind === "soul") {
    const score = S.compatibility(mine, theirDims);
    const common = cnT.map(c => c.name).filter(n => state.result.cnTop.slice(0, 10).some(x => x.name === n));
    html += `<div class="rc-score">灵魂合拍度 ${score}</div>
      <p class="muted">${score >= 75 ? "你们对城市生活的想象高度重合, 很适合一起规划旅行甚至做邻居。" : score >= 50 ? "你们有不少共同点, 也有互补的部分 —— 正好可以互相安利城市。" : "你们的偏好差异挺大, 恰好可以组成'一个负责热闹一个负责安静'的旅行搭子。"}</p>
      <p>共同心仪城市: ${common.length ? common.map(esc).join("、") : "暂无交集, 各自美丽"}</p></div>`;
  } else {
    const keys = ["d01", "d03", "d05", "d12"];
    const rows = keys.map(d => {
      const gap = Math.abs((mine[d] || 0) - (theirDims[d] || 0));
      return `<tr><td>${S.DIM_LABELS[d]}</td><td>${Math.round(mine[d])} vs ${Math.round(theirDims[d])}</td><td>${gap <= 12 ? "合拍" : gap <= 28 ? "需磨合" : "差异大"}</td></tr>`;
    }).join("");
    const score = Math.round(100 - keys.reduce((a, d) => a + Math.abs(mine[d] - theirDims[d]), 0) / keys.length);
    const detail = unlockLevel() >= 3
      ? `<table class="sim-table"><tr><th>室友关键维度</th><th>你 vs TA</th><th>判断</th></tr>${rows}</table>`
      : `<p class="muted">维度详解属于双人匹配报告内容。</p>`;
    html += `<div class="rc-score">室友适配度 ${score}</div>${detail}</div>`;
  }
  out.innerHTML = html;
}

function blindReveal() {
  const code = $("#blind-code").value.trim();
  const guess = $("#blind-guess").value.trim();
  const obj = S.decodeResult(code);
  const out = $("#compare-result");
  if (!obj || !obj.b) { out.innerHTML = `<p class="empty">这不是有效的盲盒码。</p>`; return; }
  const all = CN.cities.concat(GL.cities);
  const cn = all.find(c => c.id === obj.c[0]);
  const gl = all.find(c => c.id === obj.c[1]);
  const hit = guess && (cn.name.includes(guess) || gl.name.includes(guess) || guess.includes(cn.name) || guess.includes(gl.name));
  out.innerHTML = `<div class="rcard" style="margin-top:1.2rem">
    <h3>盲盒揭晓</h3>
    <p>你猜的是「${esc(guess || "(没猜)")}」 —— ${hit ? "<b style='color:var(--coral)'>猜中了!</b>" : "没猜中~"}</p>
    <p>TA 的中国灵魂城市: <b>${esc(cn.name)}</b> ｜ 世界灵魂城市: <b>${esc(gl.name)}</b></p>
    <p class="muted">TA 是「${esc(obj.n)}」 · 数据版本 ${esc(obj.v)}</p></div>`;
}

/* ---------- 历史 / 设置 / 产品 ---------- */
function renderHistory() {
  const list = ST.listRecords();
  const box = $("#history-list");
  if (!list.length) { box.innerHTML = `<p class="empty">还没有测试记录, 去首页开始第一次匹配吧。</p>`; return; }
  box.innerHTML = list.map(r => `<div class="history-item">
    <div class="info"><b>「${esc(r.summary.nick)}」</b> · ${esc(QB.meta.modes[r.mode] ? QB.meta.modes[r.mode].name : r.mode)}
      <small>中国: ${esc(r.summary.cn.name)} ${r.summary.cn.score} ｜ 世界: ${esc(r.summary.gl.name)} ${r.summary.gl.score} · ${esc((r.savedAt || "").slice(0, 16).replace("T", " "))}</small></div>
    <button class="btn btn-outline btn-sm" data-action="hist-view" data-id="${r.id}">查看</button>
    <button class="btn btn-danger btn-sm" data-action="hist-del" data-id="${r.id}">删除</button>
  </div>`).join("");
}
function viewRecord(id) {
  const rec = ST.getRecord(id); if (!rec) return;
  state.mode = rec.mode;
  const res = computeAll(rec.answers, rec.mode, rec.constraints || null);
  res.recordId = id;
  state.result = res;
  renderMyCodes();
  renderReport(res);
}
function renderMyCodes() {
  const box = $("#my-code-box");
  const rec = ST.listRecords()[0];
  if (!rec) { box.hidden = true; return; }
  box.hidden = false;
  $("#my-codes").innerHTML =
    `<p class="muted">最近一次测试:</p>
     <span class="code-chip" data-copy="${esc(rec.code)}">${esc(rec.code)}</span>
     <p class="muted">盲盒码:</p>
     <span class="code-chip" data-copy="${esc(rec.blindCode)}">${esc(rec.blindCode)}</span>`;
  $$("#my-codes .code-chip").forEach(el => el.addEventListener("click", () => copyText(el.dataset.copy)));
}
function renderProducts() {
  $("#product-grid").innerHTML = PRODUCTS.map(p => `
    <div class="product"><b>${esc(p.name)}</b><div class="price">¥${p.price}</div><p>${esc(p.desc)}</p>
      <button class="btn btn-primary btn-sm" data-action="demo-pay" data-pid="${p.id}">演示购买</button></div>`).join("");
}
function renderUnlockStatus() {
  const u = ST.getUnlock();
  const names = { free: "免费版", trial: "体验报告", deep: "深度报告", duo: "双人匹配报告" };
  $("#unlock-status").textContent = `当前权限: ${names[u.level] || "免费版"} (本地演示状态, 共 ${u.orders.length} 笔演示订单)`;
}
function renderWeights() {
  const w = state.settings.customWeights || {};
  $("#weight-sliders").innerHTML = S.DIM_KEYS.map(d => {
    const v = w[d] || 1;
    return `<div class="w-slider"><label>${S.DIM_LABELS[d]}</label>
      <input type="range" min="0.2" max="2" step="0.1" value="${v}" data-dim="${d}"><output>${v.toFixed(1)}</output></div>`;
  }).join("");
  $$("#weight-sliders input").forEach(inp => inp.addEventListener("input", () => {
    inp.nextElementSibling.textContent = (+inp.value).toFixed(1);
    const cw = Object.assign({}, state.settings.customWeights || {});
    cw[inp.dataset.dim] = +inp.value;
    state.settings.customWeights = cw;
    ST.saveSettings({ customWeights: cw });
  }));
}

function copyText(t) {
  const done = () => toast("已复制到剪贴板");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  else fallbackCopy(t, done);
}
function fallbackCopy(t, done) {
  const ta = document.createElement("textarea");
  ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { toast("复制失败, 请手动选择"); }
  ta.remove();
}

function privacyHtml() {
  return `<h3>隐私说明</h3>
  <ul class="reason-list" style="margin-top:.6rem">
    <li>本产品的测试数据默认仅保存在你自己的浏览器 localStorage 中, 不上传任何服务器。</li>
    <li>测试不需要手机号、真实姓名、身份证、精确住址或收入证明。</li>
    <li>结果码 / 盲盒码只包含 12 维画像分数、TOP 城市 ID 与昵称, 不含逐题答案; 分享给朋友前请知悉。</li>
    <li>你可以在「设置」或「历史测试」页随时导出或彻底删除全部本地数据。</li>
    <li>若未来接入账户、支付或跨设备同步, 将另行提供独立隐私政策。</li>
    <li>测试结果仅供自我探索与生活方式参考, 不构成专业心理评估、签证建议、投资建议或迁居保证。未成年人使用请在监护人陪同下进行。</li>
  </ul>`;
}

function feedbackModal() {
  openModal(`<h3>这次推荐准吗?</h3>
    <p class="muted">你的反馈仅保存在本机, 用于校准维度判断。</p>
    <div class="row-gap" style="margin-top:1rem">
      <button class="btn btn-outline btn-sm" id="fb-yes">挺准的</button>
      <button class="btn btn-outline btn-sm" id="fb-mid">部分符合</button>
      <button class="btn btn-outline btn-sm" id="fb-no">完全不像我</button>
    </div>
    <div id="fb-dims" style="margin-top:1rem"></div>`);
  const save = v => {
    const key = "citysoul.feedback.v1";
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
    arr.push({ v, at: new Date().toISOString(), nick: state.result ? state.result.report.nick : null });
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
    if (v === "no" || v === "mid") {
      $("#fb-dims").innerHTML = `<p class="muted">哪个维度判断得最离谱? (可多选, 选完即保存)</p>
        <div class="kw-row">${S.DIM_KEYS.map(d => `<span class="kw" style="cursor:pointer" data-fd="${d}">${S.DIM_LABELS[d]}</span>`).join("")}</div>`;
      $$("#fb-dims [data-fd]").forEach(el => el.addEventListener("click", () => {
        arr[arr.length - 1]["bad_" + el.dataset.fd] = true;
        try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
        el.style.background = "var(--coral-soft)";
        toast("已记录, 感谢反馈");
      }));
    } else { closeModal(); toast("感谢反馈!"); }
  };
  $("#fb-yes").onclick = () => save("yes");
  $("#fb-mid").onclick = () => save("mid");
  $("#fb-no").onclick = () => save("no");
}

/* ---------- 事件 ---------- */
function onKey(e) {
  if (!$("#screen-quiz").classList.contains("active")) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const q = state.questions[state.idx];
  if (e.key === "Enter") { e.preventDefault(); nextQuestion(); return; }
  if (e.key === "Backspace") { e.preventDefault(); prevQuestion(); return; }
  const k = e.key.toUpperCase();
  const map = { "1":"A","2":"B","3":"C","4":"D","5":"E","6":"F" };
  const key = /^[A-F]$/.test(k) ? k : map[k];
  if (key && q.options.some(o => o.key === key)) {
    const kind = q.type === "multi" ? "multi" : q.type === "ranking" ? "ranking" : "single";
    onOpt(q, key, kind);
  }
}

function wireEvents() {
  document.body.addEventListener("click", e => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      const t = nav.dataset.nav;
      if (t === "home") show("home");
      else if (t === "history") { renderHistory(); show("history"); }
      else if (t === "compare") { renderMyCodes(); show("compare"); }
      else if (t === "settings") { renderUnlockStatus(); show("settings"); }
      return;
    }
    const act = e.target.closest("[data-action]");
    if (!act) return;
    const a = act.dataset.action;
    if (a === "choose-mode") { show("home"); setTimeout(() => $("#modes").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }), 50); }
    else if (a === "start" || a === "start-default") startQuiz(act.dataset.mode || "deep", false);
    else if (a === "prev") prevQuestion();
    else if (a === "next") nextQuestion();
    else if (a === "quiz-exit") exitQuiz();
    else if (a === "reveal-skip") stopReveal();
    else if (a === "view-report") renderReport(state.result);
    else if (a === "poster") makePoster(act.dataset.kind);
    else if (a === "do-compare") doCompare(act.dataset.kind);
    else if (a === "blind-reveal") blindReveal();
    else if (a === "modal-close") closeModal();
    else if (a === "privacy") openModal(privacyHtml());
    else if (a === "feedback") feedbackModal();
    else if (a === "hist-view") viewRecord(act.dataset.id);
    else if (a === "hist-del") { ST.deleteRecord(act.dataset.id); renderHistory(); toast("已删除该记录"); }
    else if (a === "export-data") {
      const blob = new Blob([JSON.stringify(ST.exportData(), null, 2)], { type: "application/json" });
      const aEl = document.createElement("a");
      aEl.href = URL.createObjectURL(blob);
      aEl.download = "citysoul-my-data.json";
      aEl.click();
      URL.revokeObjectURL(aEl.href);
    }
    else if (a === "clear-data") {
      openModal(`<h3>⚠️ 删除全部本地数据</h3><p class="muted">将删除本机保存的全部测试历史、暂存进度与兑换记录, 且不可恢复。建议先导出备份。</p>
        <div class="row-gap"><button class="btn btn-danger btn-sm" id="m-clear">确认删除</button>
        <button class="btn btn-ghost btn-sm" data-action="modal-close">取消</button></div>`);
      $("#m-clear").onclick = () => { ST.clearAll(); renderHistory(); renderMyCodes(); closeModal(); toast("已删除全部本地数据"); };
    }
    else if (a === "demo-pay") {
      const p = PRODUCTS.find(x => x.id === act.dataset.pid);
      openModal(`<h3>演示支付 (非真实交易)</h3>
        <p>商品: ${esc(p.name)} · ¥${p.price}</p>
        <p class="muted">这是本地演示支付流程, 不会发起真实扣款; 正式版需接入真实支付回调与服务器端权限校验。</p>
        <div class="row-gap"><button class="btn btn-primary btn-sm" id="m-pay">模拟支付 ¥${p.price}</button>
        <button class="btn btn-ghost btn-sm" data-action="modal-close">取消</button></div>
        <div id="pay-state" style="margin-top:.6rem"></div>`);
      $("#m-pay").onclick = () => {
        $("#pay-state").innerHTML = `<p class="muted">模拟支付中…</p>`;
        setTimeout(() => {
          ST.unlock(p.id, "demo-pay", { price: p.price });
          renderUnlockStatus();
          $("#pay-state").innerHTML = `<p style="color:var(--coral);font-weight:600">已解锁「${esc(p.name)}」(演示)</p>`;
          if (state.result) renderReport(state.result);
        }, 900);
      };
    }
    else if (a === "redeem") {
      const code = $("#redeem-input").value.trim().toUpperCase();
      if (!code) return;
      if (ST.usedCodes().includes(code)) { toast("该兑换码已使用过"); return; }
      const level = REDEEM[code];
      if (!level) { toast("兑换码无效"); return; }
      ST.markCode(code); ST.unlock(level, "redeem", { code });
      renderUnlockStatus(); toast(`已解锁「${PRODUCTS.find(p => p.id === level).name}」`);
      if (state.result) renderReport(state.result);
    }
    else if (a === "reset-weights") {
      state.settings.customWeights = null;
      ST.saveSettings({ customWeights: null });
      renderWeights(); toast("已恢复默认权重");
    }
  });

  $$("#seg-theme button").forEach(b => b.addEventListener("click", () => {
    state.settings.theme = b.dataset.theme;
    ST.saveSettings({ theme: b.dataset.theme });
    applySettings(); drawMaps();
  }));
  $$("#seg-motion button").forEach(b => b.addEventListener("click", () => {
    state.settings.motion = b.dataset.motion;
    ST.saveSettings({ motion: b.dataset.motion });
    applySettings();
  }));
  $("#constraints-form").addEventListener("submit", e => {
    e.preventDefault();
    finishQuiz(readConstraints());
  });
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
}

init();
})();
