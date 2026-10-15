/* CitySoul 本地持久化: 历史记录 / 草稿 / 设置 / 解锁状态
 * 默认仅使用 localStorage, 数据不出本机; 提供导出与彻底删除。
 */
window.Store = (function () {
  "use strict";
  const NS = "citysoul.";
  const K = {
    history: NS + "history.v1",
    draft: NS + "draft.v1",
    settings: NS + "settings.v1",
    unlock: NS + "unlock.v1",
    codes: NS + "redeem.v1",
  };
  let memFallback = {};
  function ls() {
    try {
      const t = NS + "__t";
      localStorage.setItem(t, "1"); localStorage.removeItem(t);
      return localStorage;
    } catch (e) { return null; }
  }
  function get(key, def) {
    const s = ls();
    try {
      if (!s) return key in memFallback ? memFallback[key] : def;
      const raw = s.getItem(key);
      return raw == null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  }
  function set(key, val) {
    const s = ls();
    try {
      if (!s) { memFallback[key] = val; return true; }
      s.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) { memFallback[key] = val; return false; }
  }
  function available() { return !!ls(); }

  /* ---- 历史记录 ---- */
  function saveRecord(rec) {
    const list = get(K.history, []);
    rec.id = "r" + Date.now().toString(36);
    rec.savedAt = new Date().toISOString();
    list.unshift(rec);
    while (list.length > 50) list.pop();
    set(K.history, list);
    return rec.id;
  }
  function listRecords() { return get(K.history, []); }
  function getRecord(id) { return listRecords().find(r => r.id === id) || null; }
  function deleteRecord(id) {
    set(K.history, listRecords().filter(r => r.id !== id));
  }
  function clearAll() {
    [K.history, K.draft, K.codes].forEach(k => set(k, k === K.history || k === K.codes ? [] : null));
  }
  function exportData() {
    return {
      exportedAt: new Date().toISOString(),
      history: listRecords(),
      settings: getSettings(),
    };
  }

  /* ---- 答题草稿 (暂存退出 / 继续测试) ---- */
  function saveDraft(draft) { set(K.draft, draft); }
  function loadDraft() { return get(K.draft, null); }
  function clearDraft() { set(K.draft, null); }

  /* ---- 设置 ---- */
  const DEFAULT_SETTINGS = {
    theme: "light",          // light | dark
    motion: "full",          // full | reduced
    customWeights: null,     // {dim: 0.2~2.0}
  };
  function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, get(K.settings, {})); }
  function saveSettings(patch) { set(K.settings, Object.assign(getSettings(), patch)); }

  /* ---- 解锁 (演示版: 本地状态, 非真实支付) ---- */
  function getUnlock() { return get(K.unlock, { level: "free", orders: [] }); }
  function unlock(level, via, detail) {
    const u = getUnlock();
    const rank = { free: 0, trial: 1, deep: 2, duo: 3 };
    if ((rank[level] || 0) > (rank[u.level] || 0)) u.level = level;
    u.orders.push({ level, via, detail: detail || null, at: new Date().toISOString() });
    set(K.unlock, u);
    return u;
  }
  function usedCodes() { return get(K.codes, []); }
  function markCode(code) {
    const c = usedCodes();
    if (!c.includes(code)) { c.push(code); set(K.codes, c); }
  }

  return {
    available, saveRecord, listRecords, getRecord, deleteRecord, clearAll, exportData,
    saveDraft, loadDraft, clearDraft,
    getSettings, saveSettings,
    getUnlock, unlock, usedCodes, markCode,
  };
})();
