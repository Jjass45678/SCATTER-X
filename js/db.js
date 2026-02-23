/**
 * SCATTERX — GitHub Cloud Database (FREE)
 * ============================================================
 * Each user = one JSON file in your GitHub repo's database/ folder.
 *
 * HOW IT WORKS:
 *   - Register → creates database/{userId}.json on GitHub
 *   - Login → saves user data to GitHub
 *   - Every 3 seconds → auto-pushes current user data to GitHub
 *   - New users get their own file automatically
 *
 * SETUP:
 *   1. Go to https://github.com/settings/tokens
 *   2. Generate new token (classic) → check "repo" scope
 *   3. Paste token below + your username + repo name
 * ============================================================ */

const GITHUB_DB_CONFIG = {
  GITHUB_TOKEN: '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',           // paste your NEW token here: 'ghp_xxxx...'
  GITHUB_OWNER: 'Jjass45678',
  GITHUB_REPO: 'SCATTER-X',
  DATA_PATH: 'database',
  BRANCH: 'main'
};

/* ============================================================ */
const CloudDB = (() => {
  const API = 'https://api.github.com';
  let ready = false;
  let timer = null;
  let writing = false;          // lock to prevent overlapping writes
  const shaMap = {};            // path → sha cache

  // ── helpers ──
  const hdr = () => ({
    'Authorization': 'token ' + GITHUB_DB_CONFIG.GITHUB_TOKEN,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  });
  const fp = id => GITHUB_DB_CONFIG.DATA_PATH + '/' + id + '.json';
  const apiUrl = p => API + '/repos/' + GITHUB_DB_CONFIG.GITHUB_OWNER + '/' + GITHUB_DB_CONFIG.GITHUB_REPO + '/contents/' + p;
  const enc = s => btoa(unescape(encodeURIComponent(s)));
  const dec = b => decodeURIComponent(escape(atob(b.replace(/\n/g, ''))));

  // ══════════════════════════════════════════════════════════════
  //  INIT — call once on page load
  // ══════════════════════════════════════════════════════════════
  function init() {
    const c = GITHUB_DB_CONFIG;
    if (!c.GITHUB_TOKEN || !c.GITHUB_OWNER || !c.GITHUB_REPO) {
      console.warn('[CloudDB] Not configured — local only mode.');
      _banner(true);
      return false;
    }

    // test connection
    fetch(apiUrl(c.DATA_PATH), { headers: hdr() })
      .then(r => {
        if (r.status === 401) {
          console.error('[CloudDB] ❌ Token rejected! Generate a NEW token at https://github.com/settings/tokens');
          ready = false;
          _banner(true);
        } else {
          console.log('[CloudDB] ✅ Connected to GitHub!');
          ready = true;
          _banner(false);
        }
      })
      .catch(() => { _banner(true); });

    ready = true;  // optimistic

    // auto-save every 3 seconds
    if (timer) clearInterval(timer);
    timer = setInterval(_autoSave, 3000);
    return true;
  }

  function available() {
    return ready && !!GITHUB_DB_CONFIG.GITHUB_TOKEN;
  }

  // ══════════════════════════════════════════════════════════════
  //  LOW-LEVEL: GitHub file read / write / delete
  // ══════════════════════════════════════════════════════════════

  /** Read a JSON file from the repo. Returns parsed object or null. */
  async function _get(path) {
    try {
      const r = await fetch(apiUrl(path), { headers: hdr() });
      if (!r.ok) return null;
      const d = await r.json();
      shaMap[path] = d.sha;          // cache sha for future writes
      return JSON.parse(dec(d.content));
    } catch (e) { console.error('[CloudDB] GET error:', path, e); return null; }
  }

  /** Write (create or update) a JSON file. Returns true/false. */
  async function _put(path, obj, msg) {
    try {
      // fetch sha if not cached (needed to update existing files)
      if (!shaMap[path]) {
        const chk = await fetch(apiUrl(path), { headers: hdr() });
        if (chk.ok) { const j = await chk.json(); shaMap[path] = j.sha; }
      }

      const body = {
        message: msg || 'update ' + path,
        content: enc(JSON.stringify(obj, null, 2)),
        branch: GITHUB_DB_CONFIG.BRANCH
      };
      if (shaMap[path]) body.sha = shaMap[path];

      const r = await fetch(apiUrl(path), {
        method: 'PUT', headers: hdr(), body: JSON.stringify(body)
      });

      if (r.ok || r.status === 201) {
        const j = await r.json();
        shaMap[path] = j.content.sha;   // update cache
        return true;
      }

      // SHA conflict (someone else updated the file) → retry once
      if (r.status === 409 || r.status === 422) {
        console.warn('[CloudDB] SHA conflict, retrying:', path);
        delete shaMap[path];
        const rc = await fetch(apiUrl(path), { headers: hdr() });
        if (rc.ok) {
          const j2 = await rc.json();
          shaMap[path] = j2.sha;
          body.sha = j2.sha;
          const r2 = await fetch(apiUrl(path), {
            method: 'PUT', headers: hdr(), body: JSON.stringify(body)
          });
          if (r2.ok || r2.status === 201) {
            const j3 = await r2.json();
            shaMap[path] = j3.content.sha;
            return true;
          }
        }
      }

      console.error('[CloudDB] PUT failed:', r.status, path);
      return false;
    } catch (e) { console.error('[CloudDB] PUT error:', path, e); return false; }
  }

  /** Delete a file from the repo. */
  async function _del(path, msg) {
    try {
      if (!shaMap[path]) {
        const chk = await fetch(apiUrl(path), { headers: hdr() });
        if (!chk.ok) return false;
        shaMap[path] = (await chk.json()).sha;
      }
      const r = await fetch(apiUrl(path), {
        method: 'DELETE', headers: hdr(),
        body: JSON.stringify({ message: msg || 'delete', sha: shaMap[path], branch: GITHUB_DB_CONFIG.BRANCH })
      });
      if (r.ok) { delete shaMap[path]; return true; }
      return false;
    } catch (e) { console.error('[CloudDB] DEL error:', path, e); return false; }
  }

  // ══════════════════════════════════════════════════════════════
  //  PUBLIC METHODS (same names so auth.js works without changes)
  // ══════════════════════════════════════════════════════════════

  /** Save full user object → database/{userId}.json */
  async function saveUser(userId, userData) {
    if (!available()) return false;
    const clean = { ...userData, lastSync: new Date().toISOString() };
    if (clean.transactions && clean.transactions.length > 50) clean.transactions = clean.transactions.slice(0, 50);
    return await _put(fp(userId), clean, 'save ' + userId);
  }

  /** Partial update: reads current cloud data, merges updates, writes back */
  async function updateUser(userId, updates) {
    if (!available()) return false;
    const cur = await _get(fp(userId)) || {};
    Object.assign(cur, updates, { lastSync: new Date().toISOString() });
    return await _put(fp(userId), cur, 'update ' + userId);
  }

  /** Get single user from GitHub */
  async function getUser(userId) {
    if (!available()) return null;
    return await _get(fp(userId));
  }

  /** Get ALL users (admin panel). Fetches directory listing then each file. */
  async function getAllUsers() {
    if (!available()) return {};
    try {
      const r = await fetch(apiUrl(GITHUB_DB_CONFIG.DATA_PATH), { headers: hdr() });
      if (!r.ok) return {};
      const files = await r.json();
      if (!Array.isArray(files)) return {};
      const users = {};
      const jsons = files.filter(f => f.name.endsWith('.json'));
      for (let i = 0; i < jsons.length; i += 5) {
        const batch = jsons.slice(i, i + 5);
        const results = await Promise.all(batch.map(f =>
          _get(GITHUB_DB_CONFIG.DATA_PATH + '/' + f.name)
        ));
        results.forEach(u => { if (u && u.id) users[u.id] = u; });
      }
      return users;
    } catch (e) { console.error('[CloudDB] getAllUsers error:', e); return {}; }
  }

  /** Delete user file from GitHub */
  async function deleteUser(userId) {
    if (!available()) return false;
    return await _del(fp(userId), 'delete ' + userId);
  }

  /** Update balance fields on cloud */
  async function updateBalance(userId, demoBalance, realBalance) {
    if (!available()) return false;
    // Auto-save will push full user data every 3s anyway.
    // This is for explicit balance updates (admin etc.)
    const cur = await _get(fp(userId));
    if (!cur) return false;
    cur.demoBalance = demoBalance;
    cur.realBalance = realBalance;
    cur.lastSync = new Date().toISOString();
    return await _put(fp(userId), cur, 'balance ' + userId);
  }

  /** Admin direct cash-in */
  async function adminCashIn(userId, amount, type) {
    if (!available()) return { success: false, error: 'Cloud not connected' };
    try {
      const user = await _get(fp(userId));
      if (!user) return { success: false, error: 'User not found in cloud' };
      const field = type === 'real' ? 'realBalance' : 'demoBalance';
      user[field] = (user[field] || 0) + amount;
      if (type === 'real') user.totalDeposited = (user.totalDeposited || 0) + amount;
      user.lastSync = new Date().toISOString();
      if (!user.transactions) user.transactions = [];
      user.transactions.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'admin_cashin', amount,
        method: 'Admin Cash-In (' + type + ')',
        status: 'success', date: new Date().toISOString()
      });
      if (user.transactions.length > 50) user.transactions.length = 50;
      const ok = await _put(fp(userId), user, 'admin cashin ' + userId);
      return ok
        ? { success: true, userName: user.displayName || 'Unknown', newBalance: user[field] }
        : { success: false, error: 'GitHub write failed' };
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function blockUser(userId, reason) {
    if (!available()) return false;
    return await updateUser(userId, { blocked: true, blockedAt: new Date().toISOString(), blockReason: reason || 'Blocked by admin' });
  }

  async function unblockUser(userId) {
    if (!available()) return false;
    return await updateUser(userId, { blocked: false, blockedAt: null, blockReason: null });
  }

  async function isBlocked(userId) {
    if (!available()) return false;
    try { const u = await _get(fp(userId)); return u ? u.blocked === true : false; } catch { return false; }
  }

  // ── Sync methods ──

  /** Push current local user data to GitHub (overwrite) */
  async function pushToCloud(userId) {
    if (!available() || !userId) return;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    if (users[userId]) await saveUser(userId, users[userId]);
  }

  /** Pull cloud data → merge into localStorage */
  async function pullFromCloud(userId) {
    if (!available() || !userId) return null;
    const cloud = await getUser(userId);
    if (!cloud) return null;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    users[userId] = _merge(users[userId], cloud);
    localStorage.setItem('scatterx_users', JSON.stringify(users));
    return users[userId];
  }

  /** Full sync: pull from cloud → merge → push back */
  async function syncUser(userId) {
    if (!available() || !userId) return;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    const local = users[userId];
    const cloud = await getUser(userId);

    if (local && !cloud) { await saveUser(userId, local); return; }
    if (!local && cloud) { users[userId] = cloud; localStorage.setItem('scatterx_users', JSON.stringify(users)); return; }
    if (!local && !cloud) return;

    const merged = _merge(local, cloud);
    users[userId] = merged;
    localStorage.setItem('scatterx_users', JSON.stringify(users));
    await saveUser(userId, merged);
  }

  /** Push ALL local users to cloud (admin) */
  async function syncAllUsersToCloud() {
    if (!available()) return 0;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    let n = 0;
    for (const [id, data] of Object.entries(users)) {
      if (await saveUser(id, data)) n++;
    }
    return n;
  }

  // ══════════════════════════════════════════════════════════════
  //  AUTO-SAVE: every 3 seconds push current logged-in user
  // ══════════════════════════════════════════════════════════════
  async function _autoSave() {
    if (!available() || writing) return;
    try {
      const sess = JSON.parse(localStorage.getItem('scatterx_session') || 'null');
      if (!sess || !sess.userId) return;
      const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
      const user = users[sess.userId];
      if (!user) return;

      writing = true;
      await saveUser(sess.userId, user);
      writing = false;
    } catch (e) {
      writing = false;
      console.error('[CloudDB] auto-save error:', e);
    }
  }

  // ── merge helper ──
  function _merge(local, cloud) {
    if (!local) return cloud;
    if (!cloud) return local;
    const m = { ...local };
    const ct = new Date(cloud.lastSync || cloud.lastLogin || 0).getTime();
    const lt = new Date(local.lastSync || local.lastLogin || 0).getTime();
    if (ct >= lt) {
      m.realBalance = cloud.realBalance;
      m.demoBalance = cloud.demoBalance;
      m.totalDeposited = cloud.totalDeposited;
      m.totalWithdrawn = cloud.totalWithdrawn;
    }
    m.blocked = cloud.blocked || false;
    m.blockedAt = cloud.blockedAt || null;
    m.blockReason = cloud.blockReason || null;
    m.gamesPlayed = Math.max(local.gamesPlayed || 0, cloud.gamesPlayed || 0);
    m.totalWagered = Math.max(local.totalWagered || 0, cloud.totalWagered || 0);
    m.totalWon = Math.max(local.totalWon || 0, cloud.totalWon || 0);
    m.level = Math.max(local.level || 1, cloud.level || 1);
    m.xp = Math.max(local.xp || 0, cloud.xp || 0);
    m.lastSync = new Date().toISOString();
    return m;
  }

  // ── offline banner ──
  function _banner(show) {
    const id = 'cloudSyncBanner';
    if (!show) { const b = document.getElementById(id); if (b) b.remove(); return; }
    if (document.getElementById(id)) return;
    const b = document.createElement('div');
    b.id = id;
    b.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(255,150,0,.15);border:1px solid rgba(255,150,0,.3);color:#ffa726;padding:6px 16px;border-radius:20px;font-size:.68rem;font-weight:600;z-index:99999;pointer-events:none;backdrop-filter:blur(6px)';
    b.textContent = '⚠️ Cloud Sync Offline — Local Only';
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) { b.style.transition = 'opacity 1s'; b.style.opacity = '0'; setTimeout(() => b.remove(), 1000); } }, 6000);
  }

  // ── return public API ──
  return {
    init, available,
    saveUser, updateUser, getUser, getAllUsers, deleteUser,
    updateBalance, adminCashIn,
    blockUser, unblockUser, isBlocked,
    pushToCloud, pullFromCloud, syncUser, syncAllUsersToCloud
  };
})();

// Start on page load
document.addEventListener('DOMContentLoaded', () => CloudDB.init());
