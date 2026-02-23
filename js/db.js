/**
 * SCATTERX — Cloud Database (Supabase — 100% FREE)
 * ============================================================
 * Uses Supabase free tier as your database.
 * No tokens get revoked, no base64 encoding, just simple JSON.
 *
 * FREE TIER INCLUDES:
 *   - 500 MB database
 *   - Unlimited API requests
 *   - 50,000 monthly active users
 *   - Free forever (no credit card needed)
 *
 * ════════════════════════════════════════════════════════════
 *  SETUP (takes 3 minutes):
 * ════════════════════════════════════════════════════════════
 *
 *  STEP 1: Create a Supabase account
 *    → Go to https://supabase.com
 *    → Sign up with GitHub (free)
 *    → Click "New Project"
 *    → Name: ScatterX, set a database password, pick a region
 *    → Wait ~2 minutes for it to finish creating
 *
 *  STEP 2: Create the users table
 *    → In your Supabase dashboard, click "SQL Editor" (left sidebar)
 *    → Click "New Query"
 *    → Paste this ENTIRE block and click "Run":
 *
 *    ┌──────────────────────────────────────────────────────┐
 *    │  CREATE TABLE IF NOT EXISTS users (                  │
 *    │    id TEXT PRIMARY KEY,                              │
 *    │    data JSONB NOT NULL DEFAULT '{}'::jsonb,          │
 *    │    updated_at TIMESTAMPTZ DEFAULT NOW()              │
 *    │  );                                                  │
 *    │                                                      │
 *    │  CREATE TABLE IF NOT EXISTS deposits (               │
 *    │    id TEXT PRIMARY KEY,                              │
 *    │    user_id TEXT NOT NULL,                            │
 *    │    data JSONB NOT NULL DEFAULT '{}'::jsonb,          │
 *    │    created_at TIMESTAMPTZ DEFAULT NOW()              │
 *    │  );                                                  │
 *    │                                                      │
 *    │  CREATE TABLE IF NOT EXISTS promo_codes (            │
 *    │    id TEXT PRIMARY KEY,                              │
 *    │    data JSONB NOT NULL DEFAULT '{}'::jsonb,          │
 *    │    updated_at TIMESTAMPTZ DEFAULT NOW()              │
 *    │  );                                                  │
 *    │                                                      │
 *    │  CREATE TABLE IF NOT EXISTS promo_redemptions (      │
 *    │    id TEXT PRIMARY KEY,                              │
 *    │    user_id TEXT NOT NULL,                            │
 *    │    code TEXT NOT NULL,                               │
 *    │    data JSONB NOT NULL DEFAULT '{}'::jsonb,          │
 *    │    created_at TIMESTAMPTZ DEFAULT NOW()              │
 *    │  );                                                  │
 *    │                                                      │
 *    │  CREATE TABLE IF NOT EXISTS withdrawals (            │
 *    │    id TEXT PRIMARY KEY,                              │
 *    │    user_id TEXT NOT NULL,                            │
 *    │    data JSONB NOT NULL DEFAULT '{}'::jsonb,          │
 *    │    created_at TIMESTAMPTZ DEFAULT NOW()              │
 *    │  );                                                  │
 *    │                                                      │
 *    │  ALTER TABLE users ENABLE ROW LEVEL SECURITY;        │
 *    │  ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;     │
 *    │  ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;  │
 *    │  ALTER TABLE promo_redemptions                       │
 *    │    ENABLE ROW LEVEL SECURITY;                        │
 *    │  ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;  │
 *    │                                                      │
 *    │  CREATE POLICY "Allow all operations" ON users       │
 *    │    FOR ALL USING (true) WITH CHECK (true);           │
 *    │                                                      │
 *    │  CREATE POLICY "Allow all ops deposits" ON deposits  │
 *    │    FOR ALL USING (true) WITH CHECK (true);           │
 *    │                                                      │
 *    │  CREATE POLICY "Allow all ops promo" ON promo_codes  │
 *    │    FOR ALL USING (true) WITH CHECK (true);           │
 *    │                                                      │
 *    │  CREATE POLICY "Allow all ops redemp"                │
 *    │    ON promo_redemptions                              │
 *    │    FOR ALL USING (true) WITH CHECK (true);           │
 *    │                                                      │
 *    │  CREATE POLICY "Allow all ops withdraw"              │
 *    │    ON withdrawals                                    │
 *    │    FOR ALL USING (true) WITH CHECK (true);           │
 *    └──────────────────────────────────────────────────────┘
 *
 *  STEP 3: Get your project URL and API key
 *    → Click "Project Settings" (gear icon, bottom of left sidebar)
 *    → Click "API" tab
 *    → Copy "Project URL" → paste below in SUPABASE_URL
 *    → Copy "anon public" key → paste below in SUPABASE_KEY
 *
 *  STEP 4: Done! Users will auto-save every 3 seconds.
 *
 * ============================================================ */

const SUPABASE_CONFIG = {
  // ⚠️ PASTE YOUR VALUES HERE ⚠️
  SUPABASE_URL: 'https://fiwdkkxtkpeizmfkobln.supabase.co',    // e.g. 'https://xyzabcdef.supabase.co'
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpd2Rra3h0a3BlaXptZmtvYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDQ1ODEsImV4cCI6MjA4NzQyMDU4MX0.P2FMKYQWAFFD7cubfKNHkagCRJaS3NxryCEkcMDGu00'     // e.g. 'eyJhbGciOiJI...' (the "anon public" key)
};

/* ============================================================
   CLOUD DATABASE MODULE — Supabase Backend
   ============================================================ */
const CloudDB = (() => {
  let ready = false;
  let timer = null;
  let saving = false;  // prevents overlapping auto-saves

  // ── helpers ──
  function headers() {
    return {
      'apikey': SUPABASE_CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  function restUrl(query) {
    return SUPABASE_CONFIG.SUPABASE_URL + '/rest/v1/users' + (query || '');
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════
  function init() {
    if (!SUPABASE_CONFIG.SUPABASE_URL || !SUPABASE_CONFIG.SUPABASE_KEY) {
      console.warn('[CloudDB] Supabase not configured — running in LOCAL-ONLY mode.');
      console.warn('[CloudDB] Edit js/db.js and fill in SUPABASE_URL and SUPABASE_KEY.');
      _banner(true);
      return false;
    }

    // Quick connection test — check both users and deposits tables
    fetch(restUrl('?select=id&limit=1'), { headers: headers() })
      .then(r => {
        if (r.ok) {
          console.log('[CloudDB] ✅ Supabase connected! Auto-save active.');
          ready = true;
          _banner(false);
        } else if (r.status === 401) {
          console.error('[CloudDB] ❌ Bad Supabase key! Check SUPABASE_KEY in db.js.');
          ready = false;
          _banner(true);
        } else {
          r.text().then(t => console.error('[CloudDB] Supabase error:', r.status, t));
          _banner(true);
        }
      })
      .catch(err => {
        console.error('[CloudDB] Connection failed:', err);
        _banner(true);
      });

    // Also verify critical tables exist
    const criticalTables = ['deposits', 'withdrawals', 'promo_codes', 'promo_redemptions'];
    criticalTables.forEach(table => {
      fetch(tableUrl(table, '?select=id&limit=1'), { headers: headers() })
        .then(r => {
          if (r.ok) {
            console.log('[CloudDB] ✅ Table "' + table + '" exists');
          } else if (r.status === 404 || r.status === 400) {
            console.error('[CloudDB] ❌ Table "' + table + '" NOT FOUND! Run the SQL setup in Supabase SQL Editor. See comments in db.js.');
          }
        })
        .catch(() => {});
    });

    ready = true;  // optimistic start

    // Auto-save every 3 seconds
    if (timer) clearInterval(timer);
    timer = setInterval(_autoSave, 3000);
    return true;
  }

  function available() {
    return ready && !!SUPABASE_CONFIG.SUPABASE_URL && !!SUPABASE_CONFIG.SUPABASE_KEY;
  }

  // ══════════════════════════════════════════════════════════════
  //  LOW-LEVEL: Supabase REST operations
  // ══════════════════════════════════════════════════════════════

  /**
   * Upsert (insert or update) a user row.
   * id = text primary key, data = jsonb blob with all user info
   */
  async function _upsert(userId, userData) {
    try {
      const r = await fetch(restUrl(''), {
        method: 'POST',
        headers: {
          ...headers(),
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          id: userId,
          data: userData,
          updated_at: new Date().toISOString()
        })
      });
      if (r.ok) return true;
      const t = await r.text();
      console.error('[CloudDB] upsert failed:', r.status, t);
      return false;
    } catch (e) {
      console.error('[CloudDB] upsert error:', e);
      return false;
    }
  }

  /** Get a single user's data by userId */
  async function _getOne(userId) {
    try {
      const r = await fetch(restUrl('?id=eq.' + encodeURIComponent(userId) + '&select=data'), {
        headers: headers()
      });
      if (!r.ok) return null;
      const rows = await r.json();
      if (rows.length === 0) return null;
      return rows[0].data;
    } catch (e) {
      console.error('[CloudDB] getOne error:', e);
      return null;
    }
  }

  /** Get all user rows */
  async function _getAll() {
    try {
      const r = await fetch(restUrl('?select=id,data'), { headers: headers() });
      if (!r.ok) return {};
      const rows = await r.json();
      const users = {};
      rows.forEach(row => {
        if (row.data && row.data.id) {
          users[row.data.id] = row.data;
        }
      });
      return users;
    } catch (e) {
      console.error('[CloudDB] getAll error:', e);
      return {};
    }
  }

  /** Delete a user row by userId */
  async function _deleteOne(userId) {
    try {
      const r = await fetch(restUrl('?id=eq.' + encodeURIComponent(userId)), {
        method: 'DELETE',
        headers: headers()
      });
      return r.ok;
    } catch (e) {
      console.error('[CloudDB] delete error:', e);
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  PUBLIC METHODS (same API so auth.js works without changes)
  // ══════════════════════════════════════════════════════════════

  /** Save full user object to Supabase */
  async function saveUser(userId, userData) {
    if (!available()) return false;
    const clean = { ...userData, lastSync: new Date().toISOString() };
    if (clean.transactions && clean.transactions.length > 50) {
      clean.transactions = clean.transactions.slice(0, 50);
    }
    return await _upsert(userId, clean);
  }

  /** Partial update — read, merge, write back */
  async function updateUser(userId, updates) {
    if (!available()) return false;
    let cur = await _getOne(userId) || {};
    Object.assign(cur, updates, { lastSync: new Date().toISOString() });
    return await _upsert(userId, cur);
  }

  /** Get single user from Supabase */
  async function getUser(userId) {
    if (!available()) return null;
    return await _getOne(userId);
  }

  /** Get ALL users (for admin panel) */
  async function getAllUsers() {
    if (!available()) return {};
    return await _getAll();
  }

  /** Delete user from Supabase */
  async function deleteUser(userId) {
    if (!available()) return false;
    return await _deleteOne(userId);
  }

  /** Update balance fields */
  async function updateBalance(userId, demoBalance, realBalance) {
    if (!available()) return false;
    let cur = await _getOne(userId);
    if (!cur) return false;
    cur.demoBalance = demoBalance;
    cur.realBalance = realBalance;
    cur.lastSync = new Date().toISOString();
    return await _upsert(userId, cur);
  }

  /** Admin direct cash-in */
  async function adminCashIn(userId, amount, type) {
    if (!available()) return { success: false, error: 'Cloud not connected' };
    try {
      let user = await _getOne(userId);
      if (!user) return { success: false, error: 'User not found in cloud' };

      const field = type === 'real' ? 'realBalance' : 'demoBalance';
      user[field] = (user[field] || 0) + amount;
      if (type === 'real') user.totalDeposited = (user.totalDeposited || 0) + amount;
      user.lastSync = new Date().toISOString();

      if (!user.transactions) user.transactions = [];
      user.transactions.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'admin_cashin',
        amount,
        method: 'Admin Cash-In (' + type + ')',
        status: 'success',
        date: new Date().toISOString()
      });
      if (user.transactions.length > 50) user.transactions.length = 50;

      const ok = await _upsert(userId, user);
      return ok
        ? { success: true, userName: user.displayName || 'Unknown', newBalance: user[field] }
        : { success: false, error: 'Database write failed' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /** Block a user */
  async function blockUser(userId, reason) {
    if (!available()) return false;
    return await updateUser(userId, {
      blocked: true,
      blockedAt: new Date().toISOString(),
      blockReason: reason || 'Blocked by admin'
    });
  }

  /** Unblock a user */
  async function unblockUser(userId) {
    if (!available()) return false;
    return await updateUser(userId, {
      blocked: false,
      blockedAt: null,
      blockReason: null
    });
  }

  /** Check if user is blocked */
  async function isBlocked(userId) {
    if (!available()) return false;
    try {
      const u = await _getOne(userId);
      return u ? u.blocked === true : false;
    } catch { return false; }
  }

  // ── Sync methods ──

  /** Push local user data → cloud */
  async function pushToCloud(userId) {
    if (!available() || !userId) return;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    if (users[userId]) await saveUser(userId, users[userId]);
  }

  /** Pull cloud data → localStorage */
  async function pullFromCloud(userId) {
    if (!available() || !userId) return null;
    const cloud = await getUser(userId);
    if (!cloud) return null;
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    users[userId] = _merge(users[userId], cloud);
    localStorage.setItem('scatterx_users', JSON.stringify(users));
    return users[userId];
  }

  /** Full sync: pull → merge → push */
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
    if (!available() || saving) return;
    try {
      const sess = JSON.parse(localStorage.getItem('scatterx_session') || 'null');
      if (!sess || !sess.userId) return;
      const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
      const local = users[sess.userId];
      if (!local) return;

      saving = true;

      // CRITICAL: Pull cloud data first, merge, then push.
      // This prevents overwriting admin balance changes (deposits, cash-ins, etc.)
      const cloud = await _getOne(sess.userId);
      let toSave = local;

      if (cloud) {
        const merged = _merge(local, cloud);
        const balanceChanged =
          (merged.realBalance !== local.realBalance) ||
          (merged.demoBalance !== local.demoBalance) ||
          (merged.totalDeposited !== local.totalDeposited);

        users[sess.userId] = merged;
        localStorage.setItem('scatterx_users', JSON.stringify(users));
        toSave = merged;

        // If balance changed (admin added money), refresh the user's UI
        if (balanceChanged) {
          console.log('[CloudDB] ☁️ Balance updated from cloud — real:',
            local.realBalance, '→', merged.realBalance,
            'demo:', local.demoBalance, '→', merged.demoBalance);
          try {
            if (typeof Wallet !== 'undefined' && Wallet._broadcast) Wallet._broadcast();
            if (typeof updateAuthUI === 'function') updateAuthUI();
          } catch (e2) { /* UI refresh is non-critical */ }
        }
      }

      await saveUser(sess.userId, toSave);
      saving = false;
    } catch (e) {
      saving = false;
      console.error('[CloudDB] auto-save error:', e);
    }
  }

  // ── merge helper ──
  // Merges local and cloud user data safely.
  // Key principle: NEVER lose admin-added balance. 
  // Admin cash-ins, deposit approvals, etc. only exist in cloud.
  // User gameplay changes (wagering, winning) only exist locally first.
  // We take the HIGHER balance to prevent overwriting either side.
  function _merge(local, cloud) {
    if (!local) return cloud;
    if (!cloud) return local;

    const m = { ...local };

    // BALANCES: Always take the HIGHER value.
    // Admin can only ADD money (cash-in, deposit approval).
    // User can spend money (wagering), but that reduces balance locally first.
    // If cloud balance > local → admin added money → take cloud.
    // If local balance > cloud → user won money → keep local.
    m.realBalance = Math.max(local.realBalance || 0, cloud.realBalance || 0);
    m.demoBalance = Math.max(local.demoBalance || 0, cloud.demoBalance || 0);
    m.totalDeposited = Math.max(local.totalDeposited || 0, cloud.totalDeposited || 0);
    m.totalWithdrawn = Math.max(local.totalWithdrawn || 0, cloud.totalWithdrawn || 0);

    // TRANSACTIONS: Merge both sets, deduplicate by id, keep latest 50
    const localTxns = local.transactions || [];
    const cloudTxns = cloud.transactions || [];
    const txnMap = {};
    // Cloud transactions first (includes admin cash-ins)
    cloudTxns.forEach(t => { if (t && t.id) txnMap[t.id] = t; });
    // Local transactions override if same id (they're from the same device)
    localTxns.forEach(t => { if (t && t.id) txnMap[t.id] = t; });
    m.transactions = Object.values(txnMap)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 50);

    // PENDING DEPOSITS: merge both sets
    const localDeps = local.pendingDeposits || [];
    const cloudDeps = cloud.pendingDeposits || [];
    const depMap = {};
    cloudDeps.forEach(d => { if (d && d.id) depMap[d.id] = d; });
    localDeps.forEach(d => { if (d && d.id) depMap[d.id] = d; });
    m.pendingDeposits = Object.values(depMap);

    // Always respect cloud block/unblock status
    m.blocked = cloud.blocked || false;
    m.blockedAt = cloud.blockedAt || null;
    m.blockReason = cloud.blockReason || null;

    // Stats: take the max
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
    setTimeout(() => {
      if (b.parentNode) { b.style.transition = 'opacity 1s'; b.style.opacity = '0'; setTimeout(() => b.remove(), 1000); }
    }, 6000);
  }

  // ══════════════════════════════════════════════════════════════
  //  GENERIC TABLE HELPERS
  // ══════════════════════════════════════════════════════════════

  function tableUrl(table, query) {
    return SUPABASE_CONFIG.SUPABASE_URL + '/rest/v1/' + table + (query || '');
  }

  async function _tableUpsert(table, row) {
    if (!available()) {
      console.warn('[CloudDB] _tableUpsert(' + table + '): not available, skipping');
      return false;
    }
    try {
      console.log('[CloudDB] Upserting to ' + table + ':', row.id || '(no id)');
      const r = await fetch(tableUrl(table, ''), {
        method: 'POST',
        headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row)
      });
      if (r.ok) {
        console.log('[CloudDB] ✅ Upsert ' + table + ' success:', row.id || '');
        return true;
      }
      const errText = await r.text();
      console.error('[CloudDB] ❌ upsert ' + table + ' failed:', r.status, errText);
      // Common errors:
      if (r.status === 404) console.error('[CloudDB] 💡 Table "' + table + '" does not exist! Run the SQL setup in Supabase SQL Editor.');
      if (r.status === 400) console.error('[CloudDB] 💡 Bad request — check if all required columns exist in table "' + table + '"');
      if (r.status === 401 || r.status === 403) console.error('[CloudDB] 💡 Auth error — check RLS policies on table "' + table + '"');
      return false;
    } catch (e) { console.error('[CloudDB] upsert ' + table + ' error:', e); return false; }
  }

  async function _tableGetAll(table, query) {
    if (!available()) {
      console.warn('[CloudDB] _tableGetAll(' + table + '): not available');
      return [];
    }
    try {
      const r = await fetch(tableUrl(table, query || '?select=*'), { headers: headers() });
      if (!r.ok) {
        const errText = await r.text();
        console.error('[CloudDB] ❌ getAll ' + table + ' failed:', r.status, errText);
        if (r.status === 404 || r.status === 400) console.error('[CloudDB] 💡 Table "' + table + '" may not exist! Run the SQL setup in Supabase.');
        return [];
      }
      const data = await r.json();
      console.log('[CloudDB] getAll ' + table + ': ' + data.length + ' rows');
      return data;
    } catch (e) { console.error('[CloudDB] getAll ' + table + ' error:', e); return []; }
  }

  async function _tableDelete(table, query) {
    if (!available()) return false;
    try {
      const r = await fetch(tableUrl(table, query), { method: 'DELETE', headers: headers() });
      return r.ok;
    } catch (e) { console.error('[CloudDB] delete ' + table + ' error:', e); return false; }
  }

  // ══════════════════════════════════════════════════════════════
  //  DEPOSIT REQUESTS — stored in 'deposits' table
  // ══════════════════════════════════════════════════════════════

  async function saveDeposit(deposit) {
    return _tableUpsert('deposits', {
      id: deposit.id,
      user_id: deposit.userId,
      data: deposit,
      created_at: new Date().toISOString()
    });
  }

  async function getAllDeposits() {
    const rows = await _tableGetAll('deposits', '?select=id,user_id,data&order=created_at.desc');
    return rows.map(row => row.data).filter(Boolean);
  }

  async function deleteDeposit(depositId) {
    return _tableDelete('deposits', '?id=eq.' + encodeURIComponent(depositId));
  }

  // ══════════════════════════════════════════════════════════════
  //  PROMO CODES — stored in 'promo_codes' table
  // ══════════════════════════════════════════════════════════════

  async function savePromoCode(promo) {
    return _tableUpsert('promo_codes', {
      id: promo.id,
      data: promo,
      updated_at: new Date().toISOString()
    });
  }

  async function getAllPromoCodes() {
    const rows = await _tableGetAll('promo_codes', '?select=id,data&order=updated_at.desc');
    return rows.map(row => row.data).filter(Boolean);
  }

  async function deletePromoCode(promoId) {
    return _tableDelete('promo_codes', '?id=eq.' + encodeURIComponent(promoId));
  }

  // ══════════════════════════════════════════════════════════════
  //  PROMO REDEMPTIONS — stored in 'promo_redemptions' table
  // ══════════════════════════════════════════════════════════════

  async function saveRedemption(redemption) {
    const id = (redemption.code || '') + '_' + (redemption.userId || '') + '_' + Date.now();
    return _tableUpsert('promo_redemptions', {
      id: id,
      user_id: redemption.userId,
      code: redemption.code,
      data: redemption,
      created_at: new Date().toISOString()
    });
  }

  async function getRedemptionsForCode(code) {
    const rows = await _tableGetAll('promo_redemptions', '?select=data&code=eq.' + encodeURIComponent(code));
    return rows.map(row => row.data).filter(Boolean);
  }

  async function getAllRedemptions() {
    const rows = await _tableGetAll('promo_redemptions', '?select=data&order=created_at.desc');
    return rows.map(row => row.data).filter(Boolean);
  }

  async function getUserRedemptions(userId) {
    const rows = await _tableGetAll('promo_redemptions', '?select=data&user_id=eq.' + encodeURIComponent(userId));
    return rows.map(row => row.data).filter(Boolean);
  }

  // ══════════════════════════════════════════════════════════════
  //  WITHDRAWALS — stored in 'withdrawals' table
  // ══════════════════════════════════════════════════════════════

  async function saveWithdrawal(withdrawal) {
    return _tableUpsert('withdrawals', {
      id: withdrawal.id,
      user_id: withdrawal.userId,
      data: withdrawal,
      created_at: new Date().toISOString()
    });
  }

  async function getAllWithdrawals() {
    const rows = await _tableGetAll('withdrawals', '?select=id,user_id,data&order=created_at.desc');
    return rows.map(row => row.data).filter(Boolean);
  }

  async function updateWithdrawal(withdrawalId, updates) {
    const rows = await _tableGetAll('withdrawals', '?select=data&id=eq.' + encodeURIComponent(withdrawalId));
    if (!rows.length) return false;
    const data = { ...rows[0].data, ...updates };
    return _tableUpsert('withdrawals', {
      id: withdrawalId,
      user_id: data.userId,
      data: data,
      created_at: data.createdAt || new Date().toISOString()
    });
  }

  async function deleteWithdrawal(withdrawalId) {
    return _tableDelete('withdrawals', '?id=eq.' + encodeURIComponent(withdrawalId));
  }

  // ── public API ──
  return {
    init, available,
    saveUser, updateUser, getUser, getAllUsers, deleteUser,
    updateBalance, adminCashIn,
    blockUser, unblockUser, isBlocked,
    pushToCloud, pullFromCloud, syncUser, syncAllUsersToCloud,
    saveDeposit, getAllDeposits, deleteDeposit,
    savePromoCode, getAllPromoCodes, deletePromoCode,
    saveRedemption, getRedemptionsForCode, getAllRedemptions, getUserRedemptions,
    saveWithdrawal, getAllWithdrawals, updateWithdrawal, deleteWithdrawal
  };
})();

// Start on page load
document.addEventListener('DOMContentLoaded', () => CloudDB.init());
