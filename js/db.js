/**
 * SCATTERX — Cloud Database (GitHub as FREE Database)
 * ============================================================
 * Stores each user as a JSON file in your GitHub repo.
 * 100% FREE — no Firebase, no paid servers needed.
 *
 * SETUP (takes 2 minutes):
 * 1. Go to https://github.com/settings/tokens
 * 2. Click "Generate new token (classic)"
 * 3. Name: "ScatterX DB"
 * 4. Check these scopes: ✅ repo (Full control of private repositories)
 * 5. Click "Generate token" → COPY the token (starts with ghp_)
 * 6. Paste it below in GITHUB_TOKEN
 * 7. Set GITHUB_OWNER to your GitHub username
 * 8. Set GITHUB_REPO to your repository name
 * 9. Push to GitHub — done! User data auto-saves as files.
 *
 * Data is stored in: data/users/{userId}.json
 * ============================================================ */

const GITHUB_DB_CONFIG = {
  // ⚠️ FILL THESE IN ⚠️
  GITHUB_TOKEN: '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',           // e.g. 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  GITHUB_OWNER: 'Jjass45678',           // e.g. 'your-username'
  GITHUB_REPO: 'SCATTER-X',            // e.g. 'scatter-project'
  DATA_PATH: 'database',   // folder in repo where user files go
  BRANCH: 'main'             // branch name
};

/* ============================================================
   CLOUD DATABASE MODULE — GitHub API Backend
   ============================================================ */
const CloudDB = (() => {
  let isReady = false;
  let syncInterval = null;
  const SYNC_INTERVAL_MS = 8000;
  const API = 'https://api.github.com';
  const _shaCache = {};

  /* ---------- HELPERS ---------- */
  function _headers() {
    return {
      'Authorization': 'token ' + GITHUB_DB_CONFIG.GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }
  function _filePath(userId) {
    return GITHUB_DB_CONFIG.DATA_PATH + '/' + userId + '.json';
  }
  function _apiUrl(path) {
    return API + '/repos/' + GITHUB_DB_CONFIG.GITHUB_OWNER + '/' + GITHUB_DB_CONFIG.GITHUB_REPO + '/contents/' + path;
  }
  function _b64Encode(str) { return btoa(unescape(encodeURIComponent(str))); }
  function _b64Decode(b64) { return decodeURIComponent(escape(atob(b64))); }

  /* ---------- INITIALIZATION ---------- */
  function init() {
    if (!GITHUB_DB_CONFIG.GITHUB_TOKEN || !GITHUB_DB_CONFIG.GITHUB_OWNER || !GITHUB_DB_CONFIG.GITHUB_REPO) {
      console.warn('[CloudDB] GitHub not configured. Running in LOCAL-ONLY mode.');
      console.warn('[CloudDB] Edit js/db.js and fill in GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO.');
      _startOfflineBanner();
      return false;
    }
    fetch(_apiUrl(GITHUB_DB_CONFIG.DATA_PATH), { headers: _headers() })
      .then(r => {
        if (r.status === 404) {
          console.log('[CloudDB] ✅ GitHub connected. Data folder will be created on first save.');
          isReady = true; _removeBanner();
        } else if (r.ok) {
          console.log('[CloudDB] ✅ GitHub connected! Cloud sync active.');
          isReady = true; _removeBanner();
        } else if (r.status === 401) {
          console.error('[CloudDB] ❌ Bad GitHub token. Check GITHUB_TOKEN in db.js.');
          _startOfflineBanner();
        } else {
          isReady = true; _removeBanner();
        }
      })
      .catch(err => { console.error('[CloudDB] GitHub connection failed:', err); _startOfflineBanner(); });

    isReady = true;
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(_autoSync, SYNC_INTERVAL_MS);
    return true;
  }

  function available() {
    return isReady && !!GITHUB_DB_CONFIG.GITHUB_TOKEN && !!GITHUB_DB_CONFIG.GITHUB_OWNER && !!GITHUB_DB_CONFIG.GITHUB_REPO;
  }

  /* ---------- LOW-LEVEL GITHUB FILE OPS ---------- */
  async function _readFile(path) {
    try {
      const res = await fetch(_apiUrl(path), { headers: _headers() });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const data = await res.json();
      _shaCache[path] = data.sha;
      return JSON.parse(_b64Decode(data.content.replace(/\n/g, '')));
    } catch (err) { console.error('[CloudDB] _readFile error:', err); return null; }
  }

  async function _writeFile(path, content, message) {
    try {
      if (!_shaCache[path]) {
        const check = await fetch(_apiUrl(path), { headers: _headers() });
        if (check.ok) { const ex = await check.json(); _shaCache[path] = ex.sha; }
      }
      const body = {
        message: message || 'Update ' + path,
        content: _b64Encode(JSON.stringify(content, null, 2)),
        branch: GITHUB_DB_CONFIG.BRANCH
      };
      if (_shaCache[path]) body.sha = _shaCache[path];

      const res = await fetch(_apiUrl(path), { method: 'PUT', headers: _headers(), body: JSON.stringify(body) });
      if (res.ok || res.status === 201) {
        const result = await res.json(); _shaCache[path] = result.content.sha; return true;
      }
      if (res.status === 409 || res.status === 422) {
        delete _shaCache[path];
        const rc = await fetch(_apiUrl(path), { headers: _headers() });
        if (rc.ok) { const ex = await rc.json(); _shaCache[path] = ex.sha; body.sha = ex.sha;
          const retry = await fetch(_apiUrl(path), { method: 'PUT', headers: _headers(), body: JSON.stringify(body) });
          if (retry.ok || retry.status === 201) { const rr = await retry.json(); _shaCache[path] = rr.content.sha; return true; }
        }
      }
      console.error('[CloudDB] _writeFile failed:', res.status); return false;
    } catch (err) { console.error('[CloudDB] _writeFile error:', err); return false; }
  }

  async function _deleteFile(path, message) {
    try {
      if (!_shaCache[path]) {
        const check = await fetch(_apiUrl(path), { headers: _headers() });
        if (!check.ok) return false;
        const ex = await check.json(); _shaCache[path] = ex.sha;
      }
      const res = await fetch(_apiUrl(path), {
        method: 'DELETE', headers: _headers(),
        body: JSON.stringify({ message: message || 'Delete ' + path, sha: _shaCache[path], branch: GITHUB_DB_CONFIG.BRANCH })
      });
      if (res.ok) { delete _shaCache[path]; return true; }
      return false;
    } catch (err) { console.error('[CloudDB] _deleteFile error:', err); return false; }
  }

  /* ---------- USER CRUD OPERATIONS ---------- */
  async function saveUser(userId, userData) {
    if (!available()) return false;
    return await _writeFile(_filePath(userId), _sanitizeUser(userData), 'Save user ' + userId);
  }

  async function updateUser(userId, updates) {
    if (!available()) return false;
    try {
      let user = await _readFile(_filePath(userId));
      if (!user) user = {};
      Object.assign(user, updates);
      user.lastSync = new Date().toISOString();
      return await _writeFile(_filePath(userId), user, 'Update user ' + userId);
    } catch (err) { console.error('[CloudDB] updateUser failed:', err); return false; }
  }

  async function getUser(userId) {
    if (!available()) return null;
    return await _readFile(_filePath(userId));
  }

  async function getAllUsers() {
    if (!available()) return {};
    try {
      const res = await fetch(_apiUrl(GITHUB_DB_CONFIG.DATA_PATH), { headers: _headers() });
      if (!res.ok) return {};
      const files = await res.json();
      if (!Array.isArray(files)) return {};
      const users = {};
      const jsonFiles = files.filter(f => f.name.endsWith('.json'));
      for (let i = 0; i < jsonFiles.length; i += 5) {
        const batch = jsonFiles.slice(i, i + 5);
        const results = await Promise.all(batch.map(async f => {
          const ud = await _readFile(GITHUB_DB_CONFIG.DATA_PATH + '/' + f.name);
          return { data: ud };
        }));
        results.forEach(r => { if (r.data && r.data.id) users[r.data.id] = r.data; });
      }
      return users;
    } catch (err) { console.error('[CloudDB] getAllUsers failed:', err); return {}; }
  }

  async function deleteUser(userId) {
    if (!available()) return false;
    return await _deleteFile(_filePath(userId), 'Delete user ' + userId);
  }

  /* ---------- BALANCE OPERATIONS ---------- */
  async function updateBalance(userId, demoBalance, realBalance) {
    if (!available()) return false;
    try {
      let user = await _readFile(_filePath(userId));
      if (!user) return false;
      user.demoBalance = demoBalance;
      user.realBalance = realBalance;
      user.lastSync = new Date().toISOString();
      return await _writeFile(_filePath(userId), user, 'Balance update ' + userId);
    } catch (err) { console.error('[CloudDB] updateBalance failed:', err); return false; }
  }

  async function adminCashIn(userId, amount, type) {
    if (!available()) return { success: false, error: 'Cloud not connected' };
    try {
      let user = await _readFile(_filePath(userId));
      if (!user) return { success: false, error: 'User not found in cloud database' };
      const field = type === 'real' ? 'realBalance' : 'demoBalance';
      user[field] = (user[field] || 0) + amount;
      if (type === 'real') user.totalDeposited = (user.totalDeposited || 0) + amount;
      user.lastSync = new Date().toISOString();
      if (!user.transactions) user.transactions = [];
      user.transactions.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'admin_cashin', amount: amount,
        method: 'Admin Cash-In (' + type + ')',
        status: 'success', date: new Date().toISOString()
      });
      if (user.transactions.length > 50) user.transactions.length = 50;
      const ok = await _writeFile(_filePath(userId), user, 'Admin cash-in ' + userId);
      if (ok) return { success: true, userName: user.displayName || 'Unknown', newBalance: user[field] };
      return { success: false, error: 'Failed to write to GitHub' };
    } catch (err) { console.error('[CloudDB] adminCashIn failed:', err); return { success: false, error: err.message }; }
  }

  /* ---------- BLOCK / UNBLOCK ---------- */
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
    try { const user = await _readFile(_filePath(userId)); return user ? user.blocked === true : false; } catch { return false; }
  }

  /* ---------- SYNC LOGIC ---------- */

  // Push local user data to cloud
  async function pushToCloud(userId) {
    if (!available() || !userId) return;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    const user = users[userId];
    if (!user) return;

    await saveUser(userId, user);
  }

  // Pull cloud data to local (for login on new device)
  async function pullFromCloud(userId) {
    if (!available() || !userId) return null;
    try {
      const cloudUser = await getUser(userId);
      if (!cloudUser) return null;

      // Merge into local storage
      const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
      users[userId] = _mergeUser(users[userId], cloudUser);
      localStorage.setItem('scatterx_users', JSON.stringify(users));

      return users[userId];
    } catch (err) {
      console.error('[CloudDB] pullFromCloud failed:', err);
      return null;
    }
  }

  // Full sync: push local → cloud, pull cloud → local (takes higher balance)
  async function syncUser(userId) {
    if (!available() || !userId) return;
    try {
      const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
      const local = users[userId];
      const cloud = await getUser(userId);

      if (!local && !cloud) return;

      if (local && !cloud) {
        // Local only → push to cloud
        await saveUser(userId, local);
        return;
      }

      if (!local && cloud) {
        // Cloud only → pull to local
        users[userId] = cloud;
        localStorage.setItem('scatterx_users', JSON.stringify(users));
        return;
      }

      // Both exist → merge (cloud wins for balances if higher or more recent)
      const merged = _mergeUser(local, cloud);
      users[userId] = merged;
      localStorage.setItem('scatterx_users', JSON.stringify(users));
      await saveUser(userId, merged);
    } catch (err) {
      console.error('[CloudDB] syncUser failed:', err);
    }
  }

  // Auto-sync current user periodically
  async function _autoSync() {
    if (!available()) return;
    try {
      const session = JSON.parse(localStorage.getItem('scatterx_session') || 'null');
      if (!session || !session.userId) return;
      await syncUser(session.userId);
    } catch {}
  }

  /* ---------- ADMIN: SYNC ALL USERS TO CLOUD ---------- */

  async function syncAllUsersToCloud() {
    if (!available()) return 0;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    let count = 0;
    for (const [userId, userData] of Object.entries(users)) {
      await saveUser(userId, userData);
      count++;
    }
    return count;
  }

  /* ---------- HELPERS ---------- */

  function _sanitizeUser(user) {
    // Create a clean copy for cloud storage
    const clean = { ...user };
    // Limit transaction history in cloud to save space
    if (clean.transactions && clean.transactions.length > 50) {
      clean.transactions = clean.transactions.slice(0, 50);
    }
    if (clean.pendingDeposits && clean.pendingDeposits.length > 20) {
      clean.pendingDeposits = clean.pendingDeposits.slice(0, 20);
    }
    clean.lastSync = new Date().toISOString();
    return clean;
  }

  function _mergeUser(local, cloud) {
    if (!local) return cloud;
    if (!cloud) return local;

    // Cloud wins for core fields that admin might have changed
    const merged = { ...local };

    // Use the most recent sync/update time to determine priority
    const cloudTime = new Date(cloud.lastSync || cloud.lastLogin || 0).getTime();
    const localTime = new Date(local.lastSync || local.lastLogin || 0).getTime();

    // Balance: take whichever was updated more recently, or the cloud if admin modified
    if (cloudTime >= localTime) {
      merged.realBalance = cloud.realBalance;
      merged.demoBalance = cloud.demoBalance;
      merged.totalDeposited = cloud.totalDeposited;
      merged.totalWithdrawn = cloud.totalWithdrawn;
    }

    // Always respect cloud block status
    merged.blocked = cloud.blocked || false;
    merged.blockedAt = cloud.blockedAt || null;
    merged.blockReason = cloud.blockReason || null;

    // Take higher game stats
    merged.gamesPlayed = Math.max(local.gamesPlayed || 0, cloud.gamesPlayed || 0);
    merged.totalWagered = Math.max(local.totalWagered || 0, cloud.totalWagered || 0);
    merged.totalWon = Math.max(local.totalWon || 0, cloud.totalWon || 0);
    merged.level = Math.max(local.level || 1, cloud.level || 1);
    merged.xp = Math.max(local.xp || 0, cloud.xp || 0);

    merged.lastSync = new Date().toISOString();
    return merged;
  }

  function _startOfflineBanner() {
    // Show a small indicator that cloud sync is offline
    if (document.getElementById('cloudSyncBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'cloudSyncBanner';
    banner.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(255,150,0,.15);border:1px solid rgba(255,150,0,.3);color:#ffa726;padding:6px 16px;border-radius:20px;font-size:.68rem;font-weight:600;z-index:99999;pointer-events:none;backdrop-filter:blur(6px)';
    banner.textContent = '⚠️ Cloud Sync Offline — Local Only Mode';
    document.body.appendChild(banner);
    // Fade out after 6 seconds
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.transition = 'opacity 1s';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 1000);
      }
    }, 6000);
  }

  function _removeBanner() {
    const b = document.getElementById('cloudSyncBanner');
    if (b) b.remove();
  }

  /* ---------- PUBLIC API ---------- */
  return {
    init,
    available,
    saveUser,
    updateUser,
    getUser,
    getAllUsers,
    deleteUser,
    updateBalance,
    adminCashIn,
    blockUser,
    unblockUser,
    isBlocked,
    pushToCloud,
    pullFromCloud,
    syncUser,
    syncAllUsersToCloud
  };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  CloudDB.init();
});
