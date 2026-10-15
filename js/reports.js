/* CitySoul 结果解释与报告生成 (依赖 scoring.js) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./scoring.js"));
  } else root.Reports = factory(root.Scoring);
})(typeof self !== "undefined" ? self : this, function (S) {
  "use strict";

  /* 关键词: 取画像中最突出的 4 个维度 */
  function keywords(dims) {
    const KW = {
      d01: ["慢节奏", "快节奏"], d02: ["事业次要", "事业驱动"], d03: ["精打细算", "成本不敏感"],
      d04: ["耐寒", "喜暖"], d05: ["独处充电", "社交达人"], d06: ["城市动物", "自然依赖"],
      d07: ["文化随缘", "艺术成瘾"], d08: ["不怕折腾", "便利至上"],
      d09: ["本土安心", "国际视野"], d10: ["漂泊自由", "安稳定居"], d11: ["平静就好", "新鲜感成瘾"],
      d12: ["不怕拥挤", "空间刚需"],
    };
    const arr = S.DIM_KEYS.map(d => ({ d, v: dims[d], dev: Math.abs(dims[d] - 50) }))
      .sort((a, b) => b.dev - a.dev).slice(0, 4);
    return arr.map(x => KW[x.d][x.v >= 50 ? 1 : 0]);
  }

  /* 生活方式描述 */
  function lifestyleText(dims, nick) {
    const pace = dims.d01 >= 65 ? "快节奏、高密度的城市脉搏" : dims.d01 <= 40 ? "缓慢、从容的生活步调" : "张弛有度的中等节奏";
    const social = dims.d05 >= 65 ? "丰富的社交与人群" : dims.d05 <= 35 ? "充足独处与低干扰" : "有选择的社交";
    const nature = dims.d06 >= 65 ? "并且离不开山海绿地的滋养" : dims.d06 <= 35 ? "自然环境对你而言可有可无" : "偶尔亲近自然就足够";
    return `作为「${nick}」, 你向往${pace}, 需要${social}, ${nature}。对你来说, 城市不只是谋生之地, 而是生活方式的容器。`;
  }

  /* 五年后情境想象 (模板化, 不使用虚构数据) */
  function fiveYearText(dims, cityName) {
    const m = dims.d01 >= 60 ? "工作日依然忙碌, 但你知道自己在为什么而忙" : "早晨不再被闹钟驱赶, 而是被光线和胃口叫醒";
    const w = dims.d06 >= 60 ? "周末的第一站永远是城外最近的山或海" : dims.d07 >= 60 ? "周末被展览、演出和书店填得满满当当" : "周末约三五好友, 或者干脆什么也不安排";
    const f = dims.d10 >= 60 ? "你开始认真考虑在这里长久地扎下根来" : "你依然保留随时出发的自由, 但这座城市成了你最常回来的地方";
    return `五年后的某个秋天, 你在${cityName}。${m}。${w}。${f}。`;
  }

  /* 与原居住城市对照 */
  function compareWithCurrent(dims, currentCityRow, topCityRow) {
    if (!currentCityRow) return null;
    const better = [], worse = [];
    S.DIM_KEYS.forEach(d => {
      const diffA = Math.abs(dims[d] - currentCityRow.vector[d]);
      const diffB = Math.abs(dims[d] - topCityRow.vector[d]);
      if (diffB < diffA - 8) better.push(S.DIM_LABELS[d]);
      else if (diffB > diffA + 8) worse.push(S.DIM_LABELS[d]);
    });
    return {
      better: better.slice(0, 4),
      worse: worse.slice(0, 3),
      text: better.length
        ? `相比你现在居住的${currentCityRow.name}, ${topCityRow.name}在「${better.slice(0, 3).join("、")}」上更贴近你的偏好` +
          (worse.length ? `; 但「${worse.slice(0, 2).join("、")}」可能不如现在` : "。")
        : `${topCityRow.name}与你现居的${currentCityRow.name}整体气质相近, 差异更多在细节。`,
    };
  }

  /* 迁居核实清单 */
  function checklist(isGlobal, cityRow) {
    const common = ["目标区域近 12 个月租金与房价", "通勤时间实测 (工作日早晚高峰)", "本地社保 / 医保衔接政策", "目标行业岗位的真实招聘数量"];
    const g = ["签证 / 居留许可类型与续签条件", "当地语言达到日常生活水平的成本", "税务居民身份与双重征税协定", "医疗体系与商业保险覆盖"];
    const list = isGlobal ? common.concat(g) : common;
    if (cityRow && cityRow.relocatePath) list.unshift(cityRow.relocatePath);
    return list;
  }

  /* 组装完整报告对象 */
  function buildReport(opts) {
    const { profile, cnTop, glTop, mode, constraints, currentCityRow, stabilityCn, stabilityGl, weights } = opts;
    const cn1 = cnTop[0], gl1 = glTop[0];
    const nick = S.nickname(profile.dims);
    return {
      nick,
      keywords: keywords(profile.dims),
      lifestyle: lifestyleText(profile.dims, nick),
      cn: {
        top: cn1, list: cnTop.slice(0, 10),
        explain: S.explain(profile.dims, weights, cn1),
        stability: stabilityCn,
        fiveYear: fiveYearText(profile.dims, cn1.name),
        compare: compareWithCurrent(profile.dims, currentCityRow, cn1),
      },
      gl: {
        top: gl1, list: glTop.slice(0, 10),
        explain: S.explain(profile.dims, weights, gl1),
        stability: stabilityGl,
        checklist: checklist(true, gl1),
      },
      cnChecklist: checklist(false, cn1),
      mode,
      constraints: constraints || null,
    };
  }

  /* ---- 12 维雷达图 (纯 Canvas, 无外部依赖) ---- */
  function drawRadar(canvas, dims, cityVector, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const size = opts.size || 320;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = size + "px"; canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2, R = size / 2 - 42;
    const n = S.DIM_KEYS.length;
    const theme = opts.theme || "light";
    const gridColor = theme === "dark" ? "rgba(255,255,255,.14)" : "rgba(15,45,78,.12)";
    const labelColor = theme === "dark" ? "#c9d4e6" : "#40506b";

    ctx.clearRect(0, 0, size, size);
    // 网格
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + (i % n) * 2 * Math.PI / n;
        const r = R * ring / 4;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = gridColor; ctx.lineWidth = 1; ctx.stroke();
    }
    // 轴与标签
    ctx.font = "11px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillStyle = labelColor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
      ctx.strokeStyle = gridColor; ctx.stroke();
      const lx = cx + (R + 22) * Math.cos(a), ly = cy + (R + 18) * Math.sin(a);
      ctx.fillText(S.DIM_LABELS[S.DIM_KEYS[i]], lx, ly);
    }
    function poly(values, stroke, fill) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const k = S.DIM_KEYS[i % n];
        const a = -Math.PI / 2 + (i % n) * 2 * Math.PI / n;
        const r = R * clamp01(values[k] / 100);
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    if (cityVector) poly(cityVector, "#f2805a", "rgba(242,128,90,.12)");
    poly(dims, "#2e5fa3", "rgba(46,95,163,.20)");
    return canvas;
  }

  return { keywords, lifestyleText, fiveYearText, compareWithCurrent, checklist, buildReport, drawRadar };
});
