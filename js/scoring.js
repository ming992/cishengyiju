/* CitySoul 计分与城市匹配引擎
 * 纯函数、确定性: 相同答案 + 相同数据版本 => 完全相同的结果。
 * 浏览器: window.Scoring; Node: module.exports (供自动化测试)。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Scoring = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DIM_KEYS = ["d01","d02","d03","d04","d05","d06","d07","d08","d09","d10","d11","d12"];
  const DIM_LABELS = {
    d01:"城市节奏", d02:"职业机会", d03:"成本承受", d04:"气候温暖",
    d05:"社交密度", d06:"自然环境", d07:"文化探索", d08:"城市便利",
    d09:"国际化", d10:"家庭稳定", d11:"新鲜刺激", d12:"个人空间",
  };
  const RANK_FACTORS = [1.0, 0.7, 0.45, 0.25]; // 排序题位次衰减
  const NEUTRAL = 50;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---- 单题贡献提取: 返回 {dim: value} ---- */
  function questionContrib(question, answer) {
    if (answer == null) return null;
    const opts = question.options;
    const byKey = {};
    opts.forEach(o => { byKey[o.key] = o; });
    if (question.type === "multi") {
      const keys = Array.isArray(answer) ? answer : [];
      const chosen = keys.map(k => byKey[k]).filter(Boolean);
      if (!chosen.length) return null;
      const acc = {};
      chosen.forEach(o => {
        Object.entries(o.scores).forEach(([d, v]) => {
          acc[d] = (acc[d] || 0) + v / chosen.length;
        });
      });
      return acc;
    }
    if (question.type === "ranking") {
      const keys = Array.isArray(answer) ? answer : [];
      if (!keys.length) return null;
      const acc = {};
      keys.forEach((k, idx) => {
        const o = byKey[k];
        if (!o) return;
        const f = RANK_FACTORS[Math.min(idx, RANK_FACTORS.length - 1)];
        Object.entries(o.scores).forEach(([d, v]) => {
          // 排名靠前 => 该维度得分趋近选项值; 靠后 => 衰减
          acc[d] = (acc[d] || 0) + v * f;
        });
      });
      return acc;
    }
    // single / scale / dilemma
    const o = byKey[answer];
    return o ? o.scores : null;
  }

  /* ---- 计算 12 维用户画像 ----
   * answers: {qid: answerValue}; bank: questions 数组
   * 返回 {dims, importance, coverage, answered}
   */
  function computeProfile(answers, bank) {
    const sum = {}, wsum = {};
    DIM_KEYS.forEach(d => { sum[d] = 0; wsum[d] = 0; });
    const importance = {};
    DIM_KEYS.forEach(d => { importance[d] = 1.0; });
    let answered = 0;

    bank.forEach(q => {
      const a = answers[q.id];
      const contrib = questionContrib(q, a);
      if (!contrib) return;
      answered += 1;
      Object.entries(contrib).forEach(([d, v]) => {
        sum[d] += v; wsum[d] += 1;
      });
      // 排序题同时表达"重视程度": 位次越靠前, 维度权重越高
      if (q.type === "ranking" && Array.isArray(a)) {
        const byKey = {};
        q.options.forEach(o => { byKey[o.key] = o; });
        a.forEach((k, idx) => {
          const o = byKey[k];
          if (!o) return;
          const boost = [0.5, 0.3, 0.15, 0][Math.min(idx, 3)];
          Object.keys(o.scores).forEach(d => {
            importance[d] = Math.min(2.0, importance[d] + boost);
          });
        });
      }
    });

    const dims = {}, coverage = {};
    DIM_KEYS.forEach(d => {
      dims[d] = wsum[d] > 0 ? Math.round(sum[d] / wsum[d] * 10) / 10 : NEUTRAL;
      coverage[d] = wsum[d];
    });
    return { dims, importance, coverage, answered };
  }

  /* ---- 用户自定义权重合成: custom = {dim: 0.2~2.0} ---- */
  function mergeWeights(importance, custom) {
    const w = {};
    DIM_KEYS.forEach(d => {
      const c = custom && typeof custom[d] === "number" ? clamp(custom[d], 0.2, 2.0) : 1.0;
      w[d] = Math.round(importance[d] * c * 1000) / 1000;
    });
    return w;
  }

  /* ---- 硬约束惩罚 ----
   * constraints: {
   *   budget: 0-100 可承受成本水平 (reality 模式),
   *   langWilling: 0-100 语言适应意愿,
   *   noCold/noHeat: bool 气候禁区,
   *   family: "solo"|"couple"|"kids",
   *   strictness: 0-1 约束强度 (迁居意愿: 好奇0.3/考虑0.7/认真1.0)
   * }
   * 返回 {penalty, notes[]}
   */
  function constraintPenalty(city, constraints, isGlobal) {
    const out = { penalty: 0, notes: [] };
    if (!constraints) return out;
    const s = typeof constraints.strictness === "number" ? clamp(constraints.strictness, 0, 1) : 1;
    const v = city.vector;
    if (typeof constraints.budget === "number") {
      const gap = v.d03 - (constraints.budget + 10);
      if (gap > 0) {
        const p = Math.min(25, gap * 0.55) * s;
        out.penalty += p;
        out.notes.push(`生活成本超出预算承受范围 (-${p.toFixed(1)})`);
      }
    }
    if (isGlobal && typeof constraints.langWilling === "number" && typeof city.languageReq === "number") {
      const gap = city.languageReq - (constraints.langWilling + 15);
      if (gap > 0) {
        const p = Math.min(20, gap * 0.5) * s;
        out.penalty += p;
        out.notes.push(`当地语言要求超出你的适应意愿 (-${p.toFixed(1)})`);
      }
    }
    if (constraints.noCold && v.d04 < 25) {
      const p = 15 * s;
      out.penalty += p;
      out.notes.push(`冬季严寒与你勾选的气候禁区冲突 (-${p.toFixed(1)})`);
    }
    if (constraints.noHeat && v.d04 > 85) {
      const p = 15 * s;
      out.penalty += p;
      out.notes.push(`常年炎热与你勾选的气候禁区冲突 (-${p.toFixed(1)})`);
    }
    if (constraints.family === "kids" && v.d10 < 45) {
      const p = 12 * s;
      out.penalty += p;
      out.notes.push(`家庭定居友好度偏低, 与带娃场景存在落差 (-${p.toFixed(1)})`);
    }
    out.penalty = Math.round(out.penalty * 10) / 10;
    return out;
  }

  /* ---- 单城匹配分: 加权欧氏距离 -> 0-100 模型适配指数 ---- */
  function matchScore(dims, weights, city, constraints, isGlobal) {
    let num = 0, den = 0;
    DIM_KEYS.forEach(d => {
      const w = weights[d] || 1;
      const diff = (dims[d] || 0) - city.vector[d];
      num += w * diff * diff;
      den += w;
    });
    const dist = Math.sqrt(num / (den || 1));
    const c = constraintPenalty(city, constraints, isGlobal);
    const raw = 100 - dist - c.penalty;
    return {
      score: Math.round(clamp(raw, 0, 100) * 10) / 10,
      distance: Math.round(dist * 10) / 10,
      penaltyNotes: c.notes,
    };
  }

  /* ---- 排名 (确定性: 分数相同按城市 id 字典序) ---- */
  function rankCities(dims, weights, cities, constraints, isGlobal, opts) {
    const minCompleteness = (opts && opts.minCompleteness) || 0.7;
    const rows = cities
      .filter(c => (c.completeness == null ? 1 : c.completeness) >= minCompleteness)
      .map(c => {
        const m = matchScore(dims, weights, c, constraints, isGlobal);
        return {
          id: c.id, name: c.name, nameEn: c.nameEn,
          region: c.region || c.country || "",
          tags: c.tags || [], intro: c.intro || "",
          strengths: c.strengths || [], challenges: c.challenges || [],
          vector: c.vector, completeness: c.completeness == null ? 1 : c.completeness,
          score: m.score, distance: m.distance, penaltyNotes: m.penaltyNotes,
          relocatePath: c.relocatePath || null,
          languageReq: c.languageReq, costLevel: c.costLevel,
        };
      });
    rows.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1));
    return rows;
  }

  /* ---- 稳定性分析: 对权重做固定 ±10% 扰动, 观察 TOP1 得分波动 ---- */
  function stability(dims, weights, cities, constraints, isGlobal) {
    const base = rankCities(dims, weights, cities, constraints, isGlobal);
    if (!base.length) return { label: "数据不足", std: 0, top1: null };
    const topId = base[0].id;
    const topDims = DIM_KEYS.slice().sort((a, b) => weights[b] - weights[a]).slice(0, 3);
    const scores = [base[0].score];
    [0.9, 1.1].forEach(f => {
      topDims.forEach(d => {
        const w = Object.assign({}, weights);
        w[d] = w[d] * f;
        const r = rankCities(dims, w, cities, constraints, isGlobal);
        const hit = r.find(x => x.id === topId);
        if (hit) scores.push(hit.score);
      });
    });
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - mean) * (b - mean), 0) / scores.length;
    const std = Math.round(Math.sqrt(variance) * 100) / 100;
    const top1Still = rankCities(dims, jitter(weights, topDims[0], 1.1), cities, constraints, isGlobal)[0];
    const label = std < 1.5 ? "稳定" : std < 3.5 ? "较稳定" : "较敏感";
    return { label, std, top1: base[0].name, top1Id: topId, retestTop1: top1Still.name };
  }
  function jitter(w, d, f) { const c = Object.assign({}, w); c[d] = c[d] * f; return c; }

  /* ---- 匹配理由与挑战: 基于加权得分贡献 ---- */
  function explain(dims, weights, cityRow) {
    const contrib = DIM_KEYS.map(d => {
      const diff = Math.abs((dims[d] || 0) - cityRow.vector[d]);
      return { d, diff, w: weights[d] || 1, value: (weights[d] || 1) * (100 - diff) };
    });
    const sorted = contrib.slice().sort((a, b) => b.value - a.value);
    const reasons = sorted.slice(0, 3).map(x =>
      `${DIM_LABELS[x.d]}高度契合 (你的偏好 ${Math.round(dims[x.d])} / 城市特征 ${Math.round(cityRow.vector[x.d])})`
    );
    const gaps = contrib.slice().sort((a, b) => (b.diff * b.w) - (a.diff * a.w)).slice(0, 2);
    const challenges = gaps
      .filter(x => x.diff >= 15)
      .map(x => `${DIM_LABELS[x.d]}存在落差 (你 ${Math.round(dims[x.d])} vs 城市 ${Math.round(cityRow.vector[x.d])})`);
    if (!challenges.length) challenges.push("未发现显著维度冲突, 建议进一步核实生活成本与具体社区");
    return { reasons, challenges };
  }

  /* ---- 人格昵称: 由画像派生, 不参与匹配 ---- */
  const NICKNAMES = [
    { name: "松弛浪漫探索家", test: d => d.d01 <= 40 && d.d07 >= 60 },
    { name: "海风自由主义者", test: d => d.d06 >= 75 && d.d01 <= 45 },
    { name: "高能城市进化者", test: d => d.d01 >= 75 && d.d02 >= 75 },
    { name: "安静生活建筑师", test: d => d.d12 >= 70 && d.d05 <= 40 },
    { name: "文化漫游收藏家", test: d => d.d07 >= 75 },
    { name: "秩序感生活策展人", test: d => d.d08 >= 70 && d.d10 >= 60 },
    { name: "山海旷野追光者", test: d => d.d06 >= 70 && d.d11 >= 55 },
    { name: "世界公民实验员", test: d => d.d09 >= 70 && d.d11 >= 55 },
    { name: "烟火人间品鉴师", test: d => d.d05 >= 70 && d.d01 >= 40 && d.d01 < 75 },
    { name: "安稳幸福规划师", test: d => d.d10 >= 70 },
    { name: "新鲜刺激捕手", test: d => d.d11 >= 75 },
    { name: "平衡生活艺术家", test: () => true },
  ];
  function nickname(dims) {
    for (const n of NICKNAMES) if (n.test(dims)) return n.name;
    return "平衡生活艺术家";
  }

  /* ---- 结果码 (脱敏: 仅画像 + TOP 城市 id + 昵称 + 数据版本) ---- */
  function encodeResult(payload) {
    const json = JSON.stringify(payload);
    if (typeof Buffer !== "undefined") return Buffer.from(json, "utf-8").toString("base64url");
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeResult(code) {
    try {
      let json;
      if (typeof Buffer !== "undefined") json = Buffer.from(String(code), "base64url").toString("utf-8");
      else json = decodeURIComponent(escape(atob(String(code).replace(/-/g, "+").replace(/_/g, "/"))));
      const obj = JSON.parse(json);
      if (!obj || !obj.d) return null;
      return obj;
    } catch (e) { return null; }
  }

  /* ---- 两人兼容度: 基于画像距离 + 共同城市 ---- */
  function compatibility(dimsA, dimsB) {
    let num = 0;
    DIM_KEYS.forEach(d => { const x = (dimsA[d] || 0) - (dimsB[d] || 0); num += x * x; });
    const dist = Math.sqrt(num / DIM_KEYS.length);
    return Math.round(clamp(100 - dist * 1.6, 0, 100) * 10) / 10;
  }

  /* ---- 预算情景模拟 ---- */
  function budgetSimulation(dims, weights, cities, isGlobal, budgets) {
    return budgets.map(b => {
      const r = rankCities(dims, weights, cities, { budget: b, strictness: 1 }, isGlobal);
      return { budget: b, top: r.slice(0, 3).map(x => ({ name: x.name, score: x.score })) };
    });
  }

  return {
    DIM_KEYS, DIM_LABELS, NEUTRAL,
    computeProfile, mergeWeights, matchScore, rankCities,
    stability, explain, nickname,
    encodeResult, decodeResult, compatibility, budgetSimulation,
    _questionContrib: questionContrib,
  };
});
