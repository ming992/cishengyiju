/* CitySoul 海报渲染: 城市灵魂身份证 / 命定城市机票 / 双城人生海报
 * 纯 Canvas 生成 PNG, 无外部图片依赖 (自制图形, 不盗用素材)。
 * 矩阵码为结果码的确定性可视化编码, 配合明文结果码使用, 非标准 QR。
 */
window.Poster = (function () {
  "use strict";

  const FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
  const PALETTE = {
    cream: "#faf6ef", navy: "#0f2d4e", blue: "#2e5fa3",
    lavender: "#a48fd4", coral: "#f2805a", gold: "#d9a441", ink: "#22304a",
  };

  function setup(canvas, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return ctx;
  }

  /* 确定性点阵码: 由字符串散列生成, 作为结果码的视觉化呈现 */
  function drawMatrix(ctx, code, x, y, size, fg, bg) {
    const cells = 21, cell = size / cells;
    ctx.fillStyle = bg; ctx.fillRect(x, y, size, size);
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < code.length; i++) {
      h1 = ((h1 * 33) ^ code.charCodeAt(i)) >>> 0;
      h2 = ((h2 * 31) + code.charCodeAt(i)) >>> 0;
    }
    function randBit(r, c) {
      const v = (h1 * (r + 31) * (c + 17) + h2 * (r * c + 7)) >>> 0;
      return (v ^ (v >> 13)) & 1;
    }
    ctx.fillStyle = fg;
    // 定位角
    [[0, 0], [cells - 7, 0], [0, cells - 7]].forEach(([cx, cy]) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (edge || core) ctx.fillRect(x + (cx + c) * cell, y + (cy + r) * cell, cell * 0.92, cell * 0.92);
      }
    });
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      const inCorner = (r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8);
      if (!inCorner && randBit(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell * 0.92, cell * 0.92);
    }
  }

  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    let line = "", lines = 0;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) {
        ctx.fillText(line, x, y); y += lineH; line = ch; lines++;
        if (maxLines && lines >= maxLines - 1) {
          while (ctx.measureText(line + "…").width > maxW && line.length) line = line.slice(0, -1);
          ctx.fillText(line + "…", x, y);
          return y + lineH;
        }
      } else line += ch;
    }
    if (line) { ctx.fillText(line, x, y); y += lineH; }
    return y;
  }

  /* 装饰: 城市天际线剪影 */
  function skyline(ctx, W, baseY, color, seedStr) {
    let seed = 7;
    for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
    ctx.fillStyle = color;
    let x = 0;
    while (x < W) {
      const w = 24 + rnd() * 52;
      const h = 30 + rnd() * 110;
      ctx.fillRect(x, baseY - h, w, h);
      if (rnd() > 0.6) ctx.fillRect(x + w * 0.3, baseY - h - 16, w * 0.4, 16); // 塔尖
      x += w + 4 + rnd() * 14;
    }
    // 太阳
    ctx.beginPath();
    ctx.arc(W * 0.78, baseY - 150, 34, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.coral; ctx.fill();
  }

  function stamp(ctx, x, y, r, text, color) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.28);
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r - 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.font = `bold ${Math.round(r * 0.42)}px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /* 1) 城市灵魂身份证 9:16 */
  function soulIdCard(canvas, d) {
    const W = 750, H = 1334;
    const ctx = setup(canvas, W, H);
    // 背景
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, PALETTE.cream);
    grad.addColorStop(0.55, "#efe7f7");
    grad.addColorStop(1, "#dfe8f5");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // 边框
    ctx.strokeStyle = PALETTE.navy; ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.strokeStyle = "rgba(15,45,78,.25)"; ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    ctx.textAlign = "center"; ctx.fillStyle = PALETTE.navy;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText("此生宜居 · CitySoul", W / 2, 104);
    ctx.font = `20px ${FONT}`; ctx.fillStyle = PALETTE.blue;
    ctx.fillText("城 市 灵 魂 身 份 证", W / 2, 142);
    // 分隔线
    ctx.strokeStyle = PALETTE.coral; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 60, 166); ctx.lineTo(W / 2 + 60, 166); ctx.stroke();

    // 天际线
    skyline(ctx, W, 480, "rgba(46,95,163,.85)", d.cityName || "city");

    ctx.fillStyle = PALETTE.coral; ctx.font = `600 26px ${FONT}`;
    ctx.fillText(d.scope === "gl" ? "你的世界灵魂城市" : "你的中国灵魂城市", W / 2, 560);
    ctx.fillStyle = PALETTE.navy; ctx.font = `bold 96px ${FONT}`;
    ctx.fillText(d.cityName, W / 2, 668);
    if (d.cityNameEn) {
      ctx.font = `26px ${FONT}`; ctx.fillStyle = "#6a7a95";
      ctx.fillText(d.cityNameEn, W / 2, 712);
    }
    // 适配指数
    ctx.fillStyle = PALETTE.blue; ctx.font = `600 30px ${FONT}`;
    ctx.fillText("模型适配指数", W / 2, 792);
    ctx.fillStyle = PALETTE.coral; ctx.font = `bold 84px ${FONT}`;
    ctx.fillText(String(d.score), W / 2, 884);
    // 人格昵称
    ctx.fillStyle = PALETTE.navy; ctx.font = `600 34px ${FONT}`;
    ctx.fillText(`「${d.nick}」`, W / 2, 962);
    // 标签
    ctx.font = `22px ${FONT}`; ctx.fillStyle = "#54658a";
    ctx.fillText((d.tags || []).slice(0, 4).join(" · "), W / 2, 1014);
    // 简介
    ctx.font = `20px ${FONT}`; ctx.fillStyle = "#5a6a86"; ctx.textAlign = "left";
    wrapText(ctx, d.intro || "", 96, 1064, W - 192, 32, 2);

    // 底部: 结果码 + 点阵
    ctx.textAlign = "left"; ctx.fillStyle = PALETTE.ink; ctx.font = `18px ${FONT}`;
    ctx.fillText("结果码 (好友合拍 / 盲盒用)", 70, 1216);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = PALETTE.blue;
    ctx.fillText((d.code || "").slice(0, 26) + "…", 70, 1246);
    drawMatrix(ctx, d.code || "citysoul", W - 216, 1156, 140, PALETTE.navy, "#ffffff");
    stamp(ctx, 130, 210, 62, "CitySoul", PALETTE.coral);
    return canvas;
  }

  /* 2) 命定城市机票 (登机牌 横版) */
  function boardingPass(canvas, d) {
    const W = 1080, H = 480;
    const ctx = setup(canvas, W, H);
    ctx.fillStyle = PALETTE.cream; ctx.fillRect(0, 0, W, H);
    // 左侧主票
    ctx.fillStyle = PALETTE.navy; ctx.fillRect(0, 0, W * 0.68, H);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "left";
    ctx.font = `600 24px ${FONT}`; ctx.fillText("CITYSOUL AIRLINES · 命定城市航班", 40, 52);
    ctx.font = `bold 88px ${FONT}`;
    ctx.fillText(d.from || "此刻", 40, 170);
    ctx.fillStyle = PALETTE.coral;
    ctx.fillText("→", 40 + ctx.measureText(d.from || "此刻").width + 30, 170);
    ctx.fillStyle = "#ffd9c9";
    ctx.fillText(d.cityName, 40 + ctx.measureText(d.from || "此刻").width + 100, 170);
    ctx.fillStyle = "#bcd0ee"; ctx.font = `22px ${FONT}`;
    ctx.fillText(`乘客 PASSENGER: ${d.userName || "一位城市探索者"}`, 40, 236);
    ctx.fillText(`人格舱位 CLASS: ${d.nick}`, 40, 272);
    ctx.fillText(`适配指数 MATCH: ${d.score}`, 40, 308);
    ctx.fillText(`日期 DATE: ${d.date}`, 40, 344);
    // 虚线撕裂
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(W * 0.68, 0); ctx.lineTo(W * 0.68, H); ctx.stroke();
    ctx.setLineDash([]);
    // 右侧副券
    const rx = W * 0.68 + 30;
    ctx.fillStyle = PALETTE.ink; ctx.font = `600 22px ${FONT}`;
    ctx.fillText("登机副券 STUB", rx, 52);
    drawMatrix(ctx, d.code || "citysoul", rx, 80, 180, PALETTE.navy, "#ffffff");
    ctx.fillStyle = "#54658a"; ctx.font = `18px ${FONT}`;
    (d.tags || []).slice(0, 3).forEach((t, i) => ctx.fillText("· " + t, rx, 300 + i * 30));
    ctx.fillStyle = PALETTE.coral; ctx.font = `600 20px ${FONT}`;
    ctx.fillText("GATE " + (d.gate || "CS-12"), rx, 420);
    stamp(ctx, W * 0.6, H - 92, 52, "已值机", "#ffffff");
    return canvas;
  }

  /* 3) 双城人生海报 9:16 */
  function dualCity(canvas, d) {
    const W = 750, H = 1334;
    const ctx = setup(canvas, W, H);
    ctx.fillStyle = PALETTE.cream; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.fillStyle = PALETTE.navy;
    ctx.font = `600 34px ${FONT}`; ctx.fillText("双城人生", W / 2, 84);
    ctx.font = `20px ${FONT}`; ctx.fillStyle = "#6a7a95";
    ctx.fillText("一座安放当下, 一座盛放远方", W / 2, 122);

    function panel(y, h, bg1, bg2, label, city, score, color) {
      const g = ctx.createLinearGradient(40, y, W - 40, y + h);
      g.addColorStop(0, bg1); g.addColorStop(1, bg2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(40, y, W - 80, h, 26); ctx.fill();
      skyline(ctx, W, y + h - 30, "rgba(255,255,255,.22)", city);
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = `600 24px ${FONT}`;
      ctx.fillText(label, W / 2, y + 52);
      ctx.fillStyle = "#ffffff"; ctx.font = `bold 76px ${FONT}`;
      ctx.fillText(city, W / 2, y + 150);
      ctx.font = `600 30px ${FONT}`; ctx.fillStyle = color;
      ctx.fillText(`适配指数 ${score}`, W / 2, y + 206);
    }
    panel(160, 380, "#2e5fa3", "#1b3d6b", "中国灵魂城市", d.cn.name, d.cn.score, "#ffd9c9");
    panel(580, 380, "#a48fd4", "#5c4a8f", "世界灵魂城市", d.gl.name, d.gl.score, "#fff3d6");

    ctx.fillStyle = PALETTE.navy; ctx.font = `600 30px ${FONT}`;
    ctx.fillText(`「${d.nick}」`, W / 2, 1030);
    ctx.font = `20px ${FONT}`; ctx.fillStyle = "#54658a";
    wrapTextCentered(ctx, d.lifestyle || "", W / 2, 1078, W - 160, 30, 3);
    drawMatrix(ctx, d.code || "citysoul", W / 2 - 65, H - 190, 130, PALETTE.navy, "#ffffff");
    ctx.fillStyle = "#8a97b0"; ctx.font = `16px ${FONT}`;
    ctx.fillText("扫码玩法见结果码 · 此生宜居 CitySoul", W / 2, H - 34);
    return canvas;
  }
  function wrapTextCentered(ctx, text, cx, y, maxW, lineH, maxLines) {
    let line = "", lines = 0;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) {
        ctx.fillText(line, cx, y); y += lineH; line = ch; lines++;
        if (lines >= (maxLines || 99)) return y;
      } else line += ch;
    }
    if (line) ctx.fillText(line, cx, y);
    return y + lineH;
  }

  /* 4) 城市反差卡 */
  function contrastCard(canvas, d) {
    const W = 750, H = 1000;
    const ctx = setup(canvas, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1b3d6b"); g.addColorStop(1, "#a48fd4");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.fillStyle = "#ffffff";
    ctx.font = `28px ${FONT}`; ctx.fillText("我住在", W / 2, 200);
    ctx.font = `bold 88px ${FONT}`; ctx.fillText(d.current, W / 2, 300);
    ctx.font = `28px ${FONT}`; ctx.fillStyle = "#ffd9c9";
    ctx.fillText("但我的灵魂可能属于", W / 2, 430);
    ctx.fillStyle = "#ffffff"; ctx.font = `bold 96px ${FONT}`;
    ctx.fillText(d.soul, W / 2, 560);
    ctx.font = `600 30px ${FONT}`; ctx.fillStyle = "#fff3d6";
    ctx.fillText(`适配指数 ${d.score} · ${d.nick}`, W / 2, 650);
    skyline(ctx, W, H - 120, "rgba(255,255,255,.25)", d.soul);
    ctx.font = `20px ${FONT}`; ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillText("此生宜居 CitySoul · 世界这么大, 哪座城市才真正适合你", W / 2, H - 60);
    return canvas;
  }

  function download(canvas, filename) {
    const a = document.createElement("a");
    a.download = filename;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return { soulIdCard, boardingPass, dualCity, contrastCard, download, drawMatrix };
})();
