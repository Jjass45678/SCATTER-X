/**
 * SCATTERX — Authentication System
 * Login/Register with Email or Phone Number
 * Uses localStorage for demo (production would use a backend)
 */

const Auth = (() => {
  const USERS_KEY = 'scatterx_users';
  const SESSION_KEY = 'scatterx_session';
  const PENDING_DEPOSITS_KEY = 'scatterx_pending_deposits';

  // Get all registered users
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  // Get current session
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  // Check if user is logged in
  function isLoggedIn() {
    return getSession() !== null;
  }

  // Get current user data
  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const users = getUsers();
    return users[session.userId] || null;
  }

  // Get current user ID
  function getCurrentUserId() {
    const session = getSession();
    return session ? session.userId : null;
  }

  // Register a new account
  function register(identifier, password, displayName) {
    const users = getUsers();
    
    // Normalize identifier (email lowercase, phone strip spaces)
    const normalizedId = normalizeIdentifier(identifier);
    
    // Check if already exists
    const existingUser = Object.values(users).find(u => u.identifier === normalizedId);
    if (existingUser) {
      return { success: false, error: 'An account with this email/number already exists' };
    }

    // Validate
    if (!isValidIdentifier(normalizedId)) {
      return { success: false, error: 'Please enter a valid email or phone number (09XXXXXXXXX)' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    if (!displayName || displayName.trim().length < 2) {
      return { success: false, error: 'Display name must be at least 2 characters' };
    }

    const userId = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    
    users[userId] = {
      id: userId,
      identifier: normalizedId,
      identifierType: getIdentifierType(normalizedId),
      password: simpleHash(password),
      displayName: displayName.trim(),
      avatar: generateAvatar(displayName.trim()),
      demoBalance: 1000,
      realBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalWagered: 0,
      totalWon: 0,
      gamesPlayed: 0,
      joinDate: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      transactions: [],
      pendingDeposits: [],
      level: 1,
      xp: 0,
      achievements: [],
      settings: {
        sound: true,
        notifications: true,
        balanceMode: 'demo' // 'demo' or 'real'
      }
    };

    saveUsers(users);
    
    // Auto login
    saveSession({ userId, loginTime: new Date().toISOString() });

    // Sync new user to cloud
    if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
      CloudDB.saveUser(userId, users[userId]);
    }
    
    return { success: true, userId };
  }

  // Login
  function login(identifier, password) {
    let users = getUsers();
    const normalizedId = normalizeIdentifier(identifier);
    
    let user = Object.values(users).find(u => u.identifier === normalizedId);
    if (!user) {
      return { success: false, error: 'No account found with this email/number' };
    }
    
    if (user.password !== simpleHash(password)) {
      return { success: false, error: 'Incorrect password' };
    }

    // Check if blocked (from local data)
    if (user.blocked) {
      return { success: false, error: '🚫 Your account has been blocked. Reason: ' + (user.blockReason || 'Contact admin') };
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    users[user.id] = user;
    saveUsers(users);

    saveSession({ userId: user.id, loginTime: new Date().toISOString() });

    // Sync from cloud (pull latest data including admin cash-ins)
    if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
      CloudDB.syncUser(user.id).then(() => {
        // Re-read after sync in case cloud had updated balances
        const refreshed = getUsers();
        const refreshedUser = refreshed[user.id];
        if (refreshedUser && refreshedUser.blocked) {
          // If blocked in cloud, force logout
          logout();
          if (typeof Toast !== 'undefined') Toast.show('🚫', 'Account Blocked', refreshedUser.blockReason || 'Contact admin', 'error', 8000);
          if (typeof updateAuthUI === 'function') updateAuthUI();
          return;
        }
        if (typeof updateAuthUI === 'function') updateAuthUI();
        if (typeof Wallet !== 'undefined') Wallet._broadcast();
      });
    }
    
    return { success: true, userId: user.id };
  }

  // Logout
  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  // Update user data
  function updateUser(updates) {
    const session = getSession();
    if (!session) return false;
    const users = getUsers();
    const user = users[session.userId];
    if (!user) return false;
    
    Object.assign(user, updates);
    users[session.userId] = user;
    saveUsers(users);

    // Sync balance changes to cloud
    if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
      if ('realBalance' in updates || 'demoBalance' in updates || 'totalDeposited' in updates) {
        CloudDB.updateBalance(session.userId, user.demoBalance, user.realBalance);
      }
    }
    return true;
  }

  // Get user balance (demo or real based on mode)
  function getBalance(mode) {
    const user = getCurrentUser();
    if (!user) return 0;
    if (mode === 'real') return user.realBalance;
    if (mode === 'demo') return user.demoBalance;
    return user.settings.balanceMode === 'real' ? user.realBalance : user.demoBalance;
  }

  // Set balance
  function setBalance(amount, mode) {
    const user = getCurrentUser();
    if (!user) return;
    if (mode === 'real' || (!mode && user.settings.balanceMode === 'real')) {
      updateUser({ realBalance: Math.max(0, parseFloat(amount.toFixed(2))) });
    } else {
      updateUser({ demoBalance: Math.max(0, parseFloat(amount.toFixed(2))) });
    }
  }

  // Add to balance
  function addBalance(amount, mode) {
    const current = getBalance(mode);
    setBalance(current + amount, mode);
  }

  // Subtract from balance
  function subtractBalance(amount, mode) {
    const current = getBalance(mode);
    if (amount > current) return false;
    setBalance(current - amount, mode);
    return true;
  }

  // Get balance mode
  function getBalanceMode() {
    const user = getCurrentUser();
    return user ? user.settings.balanceMode : 'demo';
  }

  // Set balance mode
  function setBalanceMode(mode) {
    const user = getCurrentUser();
    if (!user) return;
    user.settings.balanceMode = mode;
    updateUser({ settings: user.settings });
  }

  // Add transaction
  function addTransaction(type, amount, method, status = 'success', extra = {}) {
    const user = getCurrentUser();
    if (!user) return;
    const txns = user.transactions || [];
    txns.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type, amount, method, status,
      date: new Date().toISOString(),
      ...extra
    });
    if (txns.length > 100) txns.length = 100;
    updateUser({ transactions: txns });
  }

  // Get transactions
  function getTransactions() {
    const user = getCurrentUser();
    return user ? (user.transactions || []) : [];
  }

  // Add pending deposit
  function addPendingDeposit(deposit) {
    const user = getCurrentUser();
    if (!user) return;
    const pending = user.pendingDeposits || [];
    pending.unshift(deposit);
    updateUser({ pendingDeposits: pending });
  }

  // Get pending deposits
  function getPendingDeposits() {
    const user = getCurrentUser();
    return user ? (user.pendingDeposits || []) : [];
  }

  // Add XP and check level up
  function addXP(amount) {
    const user = getCurrentUser();
    if (!user) return;
    let xp = (user.xp || 0) + amount;
    let level = user.level || 1;
    const xpNeeded = level * 500;
    
    if (xp >= xpNeeded) {
      xp -= xpNeeded;
      level++;
      Toast.show('🎉', 'Level Up!', `You reached Level ${level}!`, 'success', 4000);
    }
    
    updateUser({ xp, level });
  }

  // Update game stats
  function updateGameStats(wagered, won) {
    const user = getCurrentUser();
    if (!user) return;
    updateUser({
      totalWagered: (user.totalWagered || 0) + wagered,
      totalWon: (user.totalWon || 0) + won,
      gamesPlayed: (user.gamesPlayed || 0) + 1
    });
    addXP(Math.floor(wagered / 10));
  }

  // Helper functions
  function normalizeIdentifier(id) {
    id = id.trim();
    if (id.includes('@')) return id.toLowerCase();
    return id.replace(/[\s\-()]/g, '');
  }

  function getIdentifierType(id) {
    return id.includes('@') ? 'email' : 'phone';
  }

  function isValidIdentifier(id) {
    if (id.includes('@')) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    }
    return /^09\d{9}$/.test(id) || /^\+63\d{10}$/.test(id);
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }

  function generateAvatar(name) {
    const colors = ['#00f5a0', '#f5c842', '#ff3b5c', '#7b5ea7', '#4a90e2', '#00d9e8'];
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const colorIndex = name.charCodeAt(0) % colors.length;
    return { initials, color: colors[colorIndex] };
  }

  return {
    isLoggedIn, getCurrentUser, getCurrentUserId,
    register, login, logout, updateUser,
    getBalance, setBalance, addBalance, subtractBalance,
    getBalanceMode, setBalanceMode,
    addTransaction, getTransactions,
    addPendingDeposit, getPendingDeposits,
    addXP, updateGameStats,
    getSession
  };
})();

/* ============================================================
   AUTH UI — Login/Register Modal
   ============================================================ */
function getAuthModalHTML() {
  return `
<div class="modal-backdrop" id="authModal" onclick="if(event.target===this)closeAuthModal()">
  <div class="modal auth-modal" style="max-width:440px">
    <button class="modal-close" onclick="closeAuthModal()">✕</button>
    
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:2.5rem;margin-bottom:8px">🎰</div>
      <div style="background:linear-gradient(135deg,var(--gem),var(--gem2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Orbitron',sans-serif;font-size:1.4rem;font-weight:900">
        SCATTER<span style="-webkit-text-fill-color:var(--mine)">X</span>
      </div>
      <div style="font-size:.82rem;color:var(--text2);margin-top:4px">Play & Win Real Money</div>
    </div>

    <div class="modal-tabs" id="authTabs">
      <button class="modal-tab active" onclick="switchAuthTab('login')">🔑 Login</button>
      <button class="modal-tab" onclick="switchAuthTab('register')">📝 Register</button>
    </div>

    <!-- LOGIN TAB -->
    <div class="tab-panel active" id="tabLogin">
      <div class="field-group" style="margin-bottom:12px">
        <div class="field-label">Email or Phone Number</div>
        <input type="text" class="field-input" id="loginIdentifier" placeholder="email@gmail.com or 09XXXXXXXXX" style="font-family:'Inter',sans-serif" />
      </div>
      <div class="field-group" style="margin-bottom:16px">
        <div class="field-label">Password</div>
        <div style="position:relative">
          <input type="password" class="field-input" id="loginPassword" placeholder="Enter your password" style="font-family:'Inter',sans-serif;padding-right:44px" />
          <button onclick="togglePasswordVisibility('loginPassword', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">👁️</button>
        </div>
      </div>
      <button class="btn-primary" onclick="handleLogin()" id="loginBtn">
        🔑 Login
      </button>
      <div style="text-align:center;margin-top:12px">
        <span style="font-size:.78rem;color:var(--text2)">Don't have an account? </span>
        <a href="#" onclick="switchAuthTab('register');return false" style="font-size:.78rem;color:var(--gem);text-decoration:none;font-weight:600">Register here</a>
      </div>
    </div>

    <!-- REGISTER TAB -->
    <div class="tab-panel" id="tabRegister">
      <div class="field-group" style="margin-bottom:10px">
        <div class="field-label">Display Name</div>
        <input type="text" class="field-input" id="regName" placeholder="Your display name" style="font-family:'Inter',sans-serif" maxlength="20" />
      </div>
      <div class="field-group" style="margin-bottom:10px">
        <div class="field-label">Email or Phone Number</div>
        <input type="text" class="field-input" id="regIdentifier" placeholder="email@gmail.com or 09XXXXXXXXX" style="font-family:'Inter',sans-serif" />
      </div>
      <div class="field-group" style="margin-bottom:10px">
        <div class="field-label">Password</div>
        <div style="position:relative">
          <input type="password" class="field-input" id="regPassword" placeholder="Min 6 characters" style="font-family:'Inter',sans-serif;padding-right:44px" />
          <button onclick="togglePasswordVisibility('regPassword', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">👁️</button>
        </div>
      </div>
      <div class="field-group" style="margin-bottom:16px">
        <div class="field-label">Confirm Password</div>
        <div style="position:relative">
          <input type="password" class="field-input" id="regConfirm" placeholder="Confirm your password" style="font-family:'Inter',sans-serif;padding-right:44px" />
          <button onclick="togglePasswordVisibility('regConfirm', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">👁️</button>
        </div>
      </div>
      <button class="btn-primary" onclick="handleRegister()" id="regBtn">
        📝 Create Account
      </button>
      <div style="text-align:center;margin-top:12px">
        <span style="font-size:.78rem;color:var(--text2)">Already have an account? </span>
        <a href="#" onclick="switchAuthTab('login');return false" style="font-size:.78rem;color:var(--gem);text-decoration:none;font-weight:600">Login here</a>
      </div>
    </div>

    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);text-align:center">
      <div style="font-size:.7rem;color:var(--muted);line-height:1.5">
        By continuing, you agree to our Terms of Service and Privacy Policy. Must be 18+ to play.
      </div>
    </div>
  </div>
</div>`;
}

function openAuthModal() {
  let modal = document.getElementById('authModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', getAuthModalHTML());
    modal = document.getElementById('authModal');
  }
  modal.classList.add('show');
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
}

function switchAuthTab(tab) {
  const tabs = document.querySelectorAll('#authTabs .modal-tab');
  const panels = { login: 'tabLogin', register: 'tabRegister' };
  
  tabs.forEach((t, i) => {
    t.className = 'modal-tab' + ((['login', 'register'][i] === tab) ? ' active' : '');
  });
  
  Object.entries(panels).forEach(([key, id]) => {
    const p = document.getElementById(id);
    if (p) p.className = 'tab-panel' + (key === tab ? ' active' : '');
  });
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

function handleLogin() {
  const identifier = document.getElementById('loginIdentifier').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!identifier) {
    shakeEl(document.getElementById('loginIdentifier'));
    Toast.show('⚠️', 'Missing Info', 'Enter your email or phone number', 'error');
    return;
  }
  if (!password) {
    shakeEl(document.getElementById('loginPassword'));
    Toast.show('⚠️', 'Missing Info', 'Enter your password', 'error');
    return;
  }

  const result = Auth.login(identifier, password);
  if (result.success) {
    Toast.show('✅', 'Welcome Back!', `Logged in as ${Auth.getCurrentUser().displayName}`, 'success');
    SFX.play('win');
    closeAuthModal();
    updateAuthUI();
    if (typeof Wallet !== 'undefined') Wallet.init();
  } else {
    Toast.show('❌', 'Login Failed', result.error, 'error');
    SFX.play('mine');
  }
}

function handleRegister() {
  const name = document.getElementById('regName').value.trim();
  const identifier = document.getElementById('regIdentifier').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (!name) {
    shakeEl(document.getElementById('regName'));
    Toast.show('⚠️', 'Missing Info', 'Enter a display name', 'error');
    return;
  }
  if (!identifier) {
    shakeEl(document.getElementById('regIdentifier'));
    Toast.show('⚠️', 'Missing Info', 'Enter your email or phone number', 'error');
    return;
  }
  if (!password) {
    shakeEl(document.getElementById('regPassword'));
    Toast.show('⚠️', 'Missing Info', 'Enter a password', 'error');
    return;
  }
  if (password !== confirm) {
    shakeEl(document.getElementById('regConfirm'));
    Toast.show('⚠️', 'Password Mismatch', 'Passwords do not match', 'error');
    return;
  }

  const result = Auth.register(identifier, password, name);
  if (result.success) {
    Toast.show('🎉', 'Account Created!', `Welcome to ScatterX, ${name}! You got ₱1,000 demo credits.`, 'success', 5000);
    SFX.play('win');
    FX.fireworks();
    closeAuthModal();
    updateAuthUI();
    if (typeof Wallet !== 'undefined') Wallet.init();
  } else {
    Toast.show('❌', 'Registration Failed', result.error, 'error');
    SFX.play('mine');
  }
}

function handleLogout() {
  Auth.logout();
  Toast.show('👋', 'Logged Out', 'See you next time!', 'info');
  updateAuthUI();
  if (typeof Wallet !== 'undefined') Wallet.init();
}

/* ============================================================
   PROFILE DROPDOWN
   ============================================================ */
function getProfileDropdownHTML() {
  const user = Auth.getCurrentUser();
  if (!user) return '';
  
  const mode = user.settings.balanceMode;
  const demoBalance = Wallet.fmt(user.demoBalance);
  const realBalance = Wallet.fmt(user.realBalance);
  const level = user.level || 1;
  const xp = user.xp || 0;
  const xpNeeded = level * 500;
  const xpPercent = Math.min(100, (xp / xpNeeded) * 100);
  
  return `
  <div class="profile-dropdown" id="profileDropdown">
    <div class="pd-header">
      <div class="pd-avatar" style="background:${user.avatar.color}">${user.avatar.initials}</div>
      <div class="pd-info">
        <div class="pd-name">${user.displayName}</div>
        <div class="pd-id">${user.identifier}</div>
      </div>
    </div>

    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:0 16px 4px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Your User ID</div>
          <div style="font-family:'Orbitron',sans-serif;font-size:.7rem;font-weight:700;color:var(--gold);word-break:break-all" id="pdUserId">${user.id}</div>
        </div>
        <button onclick="copyUserId()" style="background:var(--gold);color:#000;border:none;border-radius:6px;padding:5px 10px;font-size:.65rem;font-weight:700;cursor:pointer;white-space:nowrap" title="Copy User ID">📋 Copy</button>
      </div>
      <div style="font-size:.58rem;color:var(--text2);margin-top:4px">Share this ID with admin to receive top-ups</div>
    </div>
    
    <div class="pd-level">
      <div class="pd-level-info">
        <span>Level ${level}</span>
        <span>${xp}/${xpNeeded} XP</span>
      </div>
      <div class="pd-xp-bar">
        <div class="pd-xp-fill" style="width:${xpPercent}%"></div>
      </div>
    </div>

    <div class="pd-balances">
      <div class="pd-bal-item ${mode === 'demo' ? 'active' : ''}" onclick="switchBalanceMode('demo')">
        <div class="pd-bal-icon">🎮</div>
        <div class="pd-bal-info">
          <div class="pd-bal-label">Demo Credits</div>
          <div class="pd-bal-value">${demoBalance}</div>
        </div>
        ${mode === 'demo' ? '<div class="pd-bal-active">ACTIVE</div>' : ''}
      </div>
      <div class="pd-bal-item ${mode === 'real' ? 'active' : ''}" onclick="switchBalanceMode('real')">
        <div class="pd-bal-icon">💰</div>
        <div class="pd-bal-info">
          <div class="pd-bal-label">Real Money</div>
          <div class="pd-bal-value">${realBalance}</div>
        </div>
        ${mode === 'real' ? '<div class="pd-bal-active real">ACTIVE</div>' : ''}
      </div>
    </div>

    <div class="pd-stats">
      <div class="pd-stat">
        <div class="pd-stat-val">${user.gamesPlayed || 0}</div>
        <div class="pd-stat-lbl">Games</div>
      </div>
      <div class="pd-stat">
        <div class="pd-stat-val">${Wallet.fmt(user.totalWon || 0)}</div>
        <div class="pd-stat-lbl">Won</div>
      </div>
      <div class="pd-stat">
        <div class="pd-stat-val">${Wallet.fmt(user.totalDeposited || 0)}</div>
        <div class="pd-stat-lbl">Deposited</div>
      </div>
    </div>

    <div class="pd-actions">
      <button class="pd-action" onclick="openDepositModal();closeProfileDropdown()">💳 Deposit</button>
      <button class="pd-action" onclick="openDepositModal();setTimeout(()=>switchWalletTab('topup'),100);closeProfileDropdown()">🎟️ Redeem Top-Up</button>
      <button class="pd-action" onclick="openDepositModal();setTimeout(()=>switchWalletTab('cashout'),100);closeProfileDropdown()">💸 Withdraw</button>
      <button class="pd-action logout" onclick="handleLogout();closeProfileDropdown()">🚪 Logout</button>
    </div>
  </div>`;
}

function toggleProfileDropdown() {
  let dd = document.getElementById('profileDropdown');
  if (dd) {
    dd.remove();
    return;
  }
  document.body.insertAdjacentHTML('beforeend', getProfileDropdownHTML());
  dd = document.getElementById('profileDropdown');
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeDD(e) {
      if (!dd.contains(e.target) && !e.target.closest('.nav-profile')) {
        dd.remove();
        document.removeEventListener('click', closeDD);
      }
    });
  }, 10);
}

function closeProfileDropdown() {
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.remove();
}

function switchBalanceMode(mode) {
  Auth.setBalanceMode(mode);
  Toast.show(mode === 'real' ? '💰' : '🎮', 
    mode === 'real' ? 'Real Money Mode' : 'Demo Mode',
    mode === 'real' ? 'You are now playing with real money' : 'You are now playing with demo credits',
    'info', 3000);
  updateAuthUI();
  closeProfileDropdown();
  if (typeof Wallet !== 'undefined') Wallet.init();
}

/* ============================================================
   AUTH UI UPDATE
   ============================================================ */
function updateAuthUI() {
  const navRight = document.querySelectorAll('.nav-right');
  
  navRight.forEach(nr => {
    if (Auth.isLoggedIn()) {
      const user = Auth.getCurrentUser();
      if (!user) return;
      const mode = user.settings.balanceMode;
      const balance = mode === 'real' ? user.realBalance : user.demoBalance;
      const modeIcon = mode === 'real' ? '💰' : '🎮';
      const modeLabel = mode === 'real' ? 'Real' : 'Demo';
      
      nr.innerHTML = `
        <div class="balance-mode-toggle" onclick="switchBalanceMode('${mode === 'real' ? 'demo' : 'real'}')">
          <span class="bmt-icon">${modeIcon}</span>
          <span class="bmt-label">${modeLabel}</span>
        </div>
        <div class="nav-balance" onclick="openDepositModal()">
          <span class="bal-icon">${modeIcon}</span>
          <div>
            <div class="bal-lbl">${modeLabel} Balance</div>
            <div class="bal-val">${Wallet.fmt(balance)}</div>
          </div>
        </div>
        <div class="nav-profile" onclick="toggleProfileDropdown()">
          <div class="nav-avatar" style="background:${user.avatar.color}">${user.avatar.initials}</div>
        </div>
      `;
    } else {
      nr.innerHTML = `
        <button class="nav-login-btn" onclick="openAuthModal()">🔑 Login</button>
        <button class="nav-deposit-btn" onclick="openAuthModal()">📝 Register</button>
      `;
    }
  });

  // Update all balance displays
  document.querySelectorAll('.bal-val').forEach(el => {
    if (Auth.isLoggedIn()) {
      const user = Auth.getCurrentUser();
      const mode = user.settings.balanceMode;
      el.textContent = Wallet.fmt(mode === 'real' ? user.realBalance : user.demoBalance);
    } else {
      el.textContent = '₱0.00';
    }
  });
}

// Check auth on page load and show login if needed
function checkAuthOnLoad() {
  if (!Auth.isLoggedIn()) {
    // Show login prompt after a short delay
    setTimeout(() => {
      openAuthModal();
    }, 500);
  } else {
    // Check if user is blocked (local first, then cloud)
    const user = Auth.getCurrentUser();
    if (user && user.blocked) {
      Auth.logout();
      Toast.show('🚫', 'Account Blocked', user.blockReason || 'Your account has been blocked. Contact admin.', 'error', 10000);
      setTimeout(() => openAuthModal(), 500);
    }
    // Also check cloud block status
    if (typeof CloudDB !== 'undefined' && CloudDB.available() && user) {
      CloudDB.isBlocked(user.id).then(blocked => {
        if (blocked) {
          // Update local
          const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
          if (users[user.id]) {
            users[user.id].blocked = true;
            localStorage.setItem('scatterx_users', JSON.stringify(users));
          }
          Auth.logout();
          Toast.show('🚫', 'Account Blocked', 'Your account has been blocked by admin', 'error', 10000);
          updateAuthUI();
          setTimeout(() => openAuthModal(), 500);
        }
      });
    }
  }
  updateAuthUI();
}

/**
 * requireLogin — Returns true if logged in, otherwise shows auth modal and a toast.
 * Use at the top of game functions: if (!requireLogin()) return;
 */
function requireLogin() {
  if (Auth.isLoggedIn()) return true;
  Toast.show('🔒', 'Login Required', 'Please login or register to play', 'error');
  openAuthModal();
  return false;
}

/* ============================================================
   ADMIN DEPOSIT APPROVAL SYSTEM
   ============================================================
   Since Discord webhooks are one-way (send only, can't receive replies),
   this provides an in-app admin panel to approve pending deposits.
   
   Admin access: Press Ctrl+Shift+A or click the admin link.
   Admin PIN: 1234 (change in CONFIG below)
   ============================================================ */
const ADMIN_PIN = '1234';

function openAdminPanel() {
  const existing = document.getElementById('adminModal');
  if (existing) existing.remove();

  const html = `
<div class="modal-backdrop" id="adminModal" onclick="if(event.target===this)closeAdminPanel()">
  <div class="modal" style="max-width:560px;padding:24px 28px">
    <button class="modal-close" onclick="closeAdminPanel()">✕</button>
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:2rem;margin-bottom:6px">🔐</div>
      <div style="font-family:'Orbitron',sans-serif;font-size:1rem;font-weight:900;color:var(--gold)">Admin Panel</div>
      <div style="font-size:.75rem;color:var(--text2)">Approve pending deposits</div>
    </div>

    <div id="adminAuth" style="text-align:center">
      <div class="field-group" style="max-width:200px;margin:0 auto 12px">
        <div class="field-label">Admin PIN</div>
        <input type="password" class="field-input" id="adminPin" placeholder="Enter PIN" maxlength="10" style="text-align:center;font-family:'Orbitron',sans-serif;letter-spacing:4px" />
      </div>
      <button class="btn-primary" onclick="verifyAdminPin()" style="max-width:200px;margin:0 auto">Unlock</button>
    </div>

    <div id="adminContent" style="display:none">
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn-primary" id="adminTabDeposits" onclick="switchAdminTab('deposits')" style="flex:1;padding:8px;font-size:.72rem">📋 Deposits</button>
        <button class="btn-primary" id="adminTabWithdrawals" onclick="switchAdminTab('withdrawals')" style="flex:1;padding:8px;font-size:.72rem;opacity:.5">💸 Withdrawals</button>
        <button class="btn-primary" id="adminTabTopup" onclick="switchAdminTab('topup')" style="flex:1;padding:8px;font-size:.72rem;opacity:.5">🎟️ Top-Up</button>
        <button class="btn-primary" id="adminTabUsers" onclick="switchAdminTab('users')" style="flex:1;padding:8px;font-size:.72rem;opacity:.5">👥 Users</button>
        <button class="btn-primary" id="adminTabPromo" onclick="switchAdminTab('promo')" style="flex:1;padding:8px;font-size:.72rem;opacity:.5">🎁 Promo</button>
      </div>

      <div id="adminDepositsPanel">
        <div id="pendingList"></div>
      </div>

      <div id="adminWithdrawalsPanel" style="display:none">
        <div style="font-size:.82rem;font-weight:700;color:var(--gold);margin-bottom:10px">Pending Withdrawal Requests</div>
        <div id="withdrawalList"></div>
      </div>

      <div id="adminTopupPanel" style="display:none">
        <div style="font-size:.82rem;font-weight:700;color:var(--gold);margin-bottom:10px">Generate Top-Up Code</div>
        <div class="dep-note" style="margin-bottom:12px;font-size:.72rem">
          <strong>💡 How it works:</strong><br>
          1. User tells you their User ID<br>
          2. You enter their ID + amount here<br>
          3. Copy the generated code and send it to the user<br>
          4. User redeems the code in their Wallet → Top-Up tab
        </div>
        <div class="field-group" style="margin-bottom:8px">
          <div class="field-label">User ID</div>
          <input type="text" class="field-input" id="adminTopupUserId" placeholder="e.g. user_m1abc123xyz" style="font-family:'Orbitron',sans-serif;font-size:.75rem;letter-spacing:1px" />
        </div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <div class="field-group" style="flex:1">
            <div class="field-label">Amount (₱)</div>
            <input type="number" class="field-input" id="adminTopupAmount" placeholder="100" min="1" />
          </div>
          <div class="field-group" style="flex:1">
            <div class="field-label">Type</div>
            <select class="field-input" id="adminTopupType" style="background:var(--card2);color:var(--text);border:1px solid var(--border)">
              <option value="real">💰 Real Money</option>
              <option value="demo">🎮 Demo Credits</option>
            </select>
          </div>
        </div>
        <button class="btn-primary" onclick="adminGenerateTopUp()" style="width:100%;padding:12px;font-size:.82rem;margin-bottom:14px">🔑 GENERATE TOP-UP CODE</button>
        <div id="adminTopupResult" style="display:none"></div>
        <div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:8px;margin-top:10px">Recent Top-Up Codes</div>
        <div id="adminTopupHistory" style="max-height:250px;overflow-y:auto"></div>
      </div>

      <div id="adminUsersPanel" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:.82rem;font-weight:700;color:var(--gold)">All Registered Users</div>
          <div style="display:flex;gap:6px">
            <button class="btn-primary" onclick="adminSyncAllToCloud()" style="padding:5px 10px;font-size:.62rem" id="adminSyncBtn">☁️ Sync to Cloud</button>
            <button class="btn-primary" onclick="adminLoadCloudUsers()" style="padding:5px 10px;font-size:.62rem">🔄 Load Cloud</button>
          </div>
        </div>
        <div class="field-group" style="margin-bottom:10px">
          <input type="text" class="field-input" id="adminUserSearch" placeholder="🔍 Search by name, ID, or email..." oninput="renderAdminUsers()" />
        </div>
        <div style="font-size:.68rem;color:var(--text2);margin-bottom:8px" id="adminUserCount"></div>
        <div id="adminUserList" style="max-height:400px;overflow-y:auto"></div>
      </div>

      <div id="adminPromoPanel" style="display:none">
        <div style="font-size:.82rem;font-weight:700;color:var(--gold);margin-bottom:10px">Create Promo Code</div>
        <div class="field-group" style="margin-bottom:8px">
          <div class="field-label">Code</div>
          <input type="text" class="field-input" id="adminPromoCode" placeholder="e.g. WELCOME100" style="text-transform:uppercase;font-family:'Orbitron',sans-serif;letter-spacing:2px" />
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <div class="field-group" style="flex:1">
            <div class="field-label">Amount (₱)</div>
            <input type="number" class="field-input" id="adminPromoAmount" placeholder="100" min="1" />
          </div>
          <div class="field-group" style="flex:1">
            <div class="field-label">Type</div>
            <select class="field-input" id="adminPromoType" style="background:var(--card2);color:var(--text);border:1px solid var(--border)">
              <option value="demo">🎮 Demo</option>
              <option value="real">💰 Real</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <div class="field-group" style="flex:1">
            <div class="field-label">Max Uses (0 = unlimited)</div>
            <input type="number" class="field-input" id="adminPromoMaxUses" placeholder="0" min="0" value="0" />
          </div>
          <div class="field-group" style="flex:1">
            <div class="field-label">Expires (optional)</div>
            <input type="date" class="field-input" id="adminPromoExpires" style="color:var(--text)" />
          </div>
        </div>
        <button class="btn-primary" onclick="adminCreatePromoCode()" style="width:100%;padding:10px;font-size:.8rem;margin-bottom:16px">➕ CREATE CODE</button>

        <div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:8px">Active Promo Codes</div>
        <div id="adminPromoList" style="max-height:320px;overflow-y:auto"></div>
      </div>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('adminModal').classList.add('show');
  document.getElementById('adminPin').addEventListener('keydown', e => {
    if (e.key === 'Enter') verifyAdminPin();
  });
}

function closeAdminPanel() {
  const m = document.getElementById('adminModal');
  if (m) m.classList.remove('show');
}

function verifyAdminPin() {
  const pin = document.getElementById('adminPin').value;
  if (pin === ADMIN_PIN) {
    document.getElementById('adminAuth').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    switchAdminTab('deposits');
  } else {
    shakeEl(document.getElementById('adminPin'));
    Toast.show('❌', 'Wrong PIN', 'Incorrect admin PIN', 'error');
  }
}

function getAllPendingDeposits() {
  // This now returns local deposits only (cloud deposits are loaded separately)
  const users = Auth.isLoggedIn() ? JSON.parse(localStorage.getItem('scatterx_users') || '{}') : {};
  const pending = [];
  Object.values(users).forEach(u => {
    (u.pendingDeposits || []).forEach(d => {
      if (d.status === 'pending') {
        pending.push({ ...d, userId: u.id, userName: u.displayName, userIdentifier: u.identifier });
      }
    });
  });
  try {
    const standalone = JSON.parse(localStorage.getItem('scatterx_pending_deposits') || '[]');
    standalone.forEach(d => {
      if (d.status === 'pending' && !pending.find(p => p.id === d.id)) {
        pending.push(d);
      }
    });
  } catch {}
  return pending.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function renderPendingDeposits() {
  const list = document.getElementById('pendingList');
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem">⏳ Loading deposits...</div>';

  // Get local deposits
  const localPending = getAllPendingDeposits();
  console.log('[Admin] Local pending deposits:', localPending.length);

  // Get cloud deposits
  let cloudPending = [];
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.getAllDeposits) {
    try {
      cloudPending = await CloudDB.getAllDeposits();
      console.log('[Admin] Cloud pending deposits:', cloudPending.length);
    } catch (e) { console.error('[Admin] Failed to load cloud deposits:', e); }
  } else {
    console.warn('[Admin] CloudDB not available for loading deposits');
  }

  // Merge: cloud deposits take priority, deduplicate by id
  const allMap = {};
  localPending.forEach(d => { allMap[d.id] = d; });
  cloudPending.forEach(d => { if (d.status === 'pending') allMap[d.id] = d; });
  const pending = Object.values(allMap).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (pending.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:30px;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:8px">✅</div>
        <div style="font-size:.85rem">No pending deposits</div>
      </div>`;
    return;
  }

  list.innerHTML = pending.map(d => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px" id="deposit_${d.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:.88rem;color:var(--text)">${d.userName || 'Unknown'}</div>
          <div style="font-size:.7rem;color:var(--muted)">${d.userIdentifier || ''} · ${d.id}</div>
        </div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:900;color:var(--gold)">₱${(d.amount || 0).toLocaleString()}</div>
      </div>
      <div style="font-size:.72rem;color:var(--text2);margin-bottom:10px">${new Date(d.date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="approveDeposit('${d.userId}','${d.id}',${d.amount})" style="flex:1;padding:10px;font-size:.78rem">✅ APPROVE</button>
        <button class="btn-red" onclick="rejectDeposit('${d.userId}','${d.id}')" style="flex:1;padding:10px;font-size:.78rem">❌ REJECT</button>
      </div>
    </div>
  `).join('');
}

async function approveDeposit(userId, depositId, amount) {
  const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
  let user = users[userId];

  // If user not found locally, try to get from cloud
  if (!user && typeof CloudDB !== 'undefined' && CloudDB.available()) {
    user = await CloudDB.getUser(userId);
  }
  if (!user) {
    Toast.show('❌', 'User Not Found', 'Cannot find this user account', 'error');
    return;
  }

  // Add real balance
  user.realBalance = (user.realBalance || 0) + amount;
  user.totalDeposited = (user.totalDeposited || 0) + amount;

  // Update pending deposit status
  if (user.pendingDeposits) {
    const dep = user.pendingDeposits.find(d => d.id === depositId);
    if (dep) dep.status = 'approved';
  }

  // Add transaction record
  const txns = user.transactions || [];
  txns.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: 'deposit_approved',
    amount: amount,
    method: 'GCash (Approved)',
    status: 'success',
    date: new Date().toISOString(),
    ref: depositId
  });
  user.transactions = txns;

  users[userId] = user;
  localStorage.setItem('scatterx_users', JSON.stringify(users));

  // Save updated user to cloud + delete the deposit request
  if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
    CloudDB.saveUser(userId, user);
    if (CloudDB.deleteDeposit) CloudDB.deleteDeposit(depositId);
  }

  // Refresh UI
  Toast.show('✅', 'Deposit Approved!', `₱${amount.toLocaleString()} added to ${user.displayName}'s real balance`, 'success', 5000);
  SFX.play('deposit');
  FX.fireworks();
  
  // Remove from DOM
  const el = document.getElementById('deposit_' + depositId);
  if (el) el.remove();
  
  // Re-render
  renderPendingDeposits();
  
  // Refresh wallet display if this is the current user
  if (Auth.isLoggedIn() && Auth.getCurrentUserId() === userId) {
    Wallet._broadcast();
    updateAuthUI();
  }
}

async function rejectDeposit(userId, depositId) {
  const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
  const user = users[userId];
  if (user) {
    // Update pending deposit status
    if (user.pendingDeposits) {
      const dep = user.pendingDeposits.find(d => d.id === depositId);
      if (dep) dep.status = 'rejected';
    }

    // Add transaction record
    const txns = user.transactions || [];
    txns.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'deposit_rejected',
      amount: 0,
      method: 'GCash (Rejected)',
      status: 'rejected',
      date: new Date().toISOString(),
      ref: depositId
    });
    user.transactions = txns;

    users[userId] = user;
    localStorage.setItem('scatterx_users', JSON.stringify(users));

    // Save to cloud
    if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
      CloudDB.saveUser(userId, user);
    }
  }

  // Delete deposit request from cloud
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.deleteDeposit) {
    CloudDB.deleteDeposit(depositId);
  }

  Toast.show('❌', 'Deposit Rejected', `Deposit ${depositId} has been rejected`, 'error');
  
  const el = document.getElementById('deposit_' + depositId);
  if (el) el.remove();
  renderPendingDeposits();
}

/* ============================================================
   ADMIN: TAB SWITCH
   ============================================================ */
function switchAdminTab(tab) {
  const tabs = ['deposits', 'withdrawals', 'topup', 'users', 'promo'];
  const btnMap = { deposits: 'adminTabDeposits', withdrawals: 'adminTabWithdrawals', topup: 'adminTabTopup', users: 'adminTabUsers', promo: 'adminTabPromo' };
  const panelMap = { deposits: 'adminDepositsPanel', withdrawals: 'adminWithdrawalsPanel', topup: 'adminTopupPanel', users: 'adminUsersPanel', promo: 'adminPromoPanel' };

  tabs.forEach(t => {
    const btn = document.getElementById(btnMap[t]);
    const panel = document.getElementById(panelMap[t]);
    if (btn) btn.style.opacity = t === tab ? '1' : '.5';
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });

  if (tab === 'deposits') renderPendingDeposits();
  if (tab === 'withdrawals') renderPendingWithdrawals();
  if (tab === 'promo') renderAdminPromoCodes();
  if (tab === 'topup') renderAdminTopUpHistory();
  if (tab === 'users') renderAdminUsers();
}

/* ============================================================
   ADMIN: WITHDRAWAL REQUESTS (cloud-synced)
   ============================================================ */
async function renderPendingWithdrawals() {
  const list = document.getElementById('withdrawalList');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem">⏳ Loading withdrawals...</div>';

  let withdrawals = [];
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.getAllWithdrawals) {
    try {
      withdrawals = await CloudDB.getAllWithdrawals();
    } catch (e) { console.error('Failed to load withdrawals:', e); }
  }

  // Only show pending ones
  const pending = withdrawals.filter(w => w.status === 'pending');

  if (pending.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:30px;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:8px">✅</div>
        <div style="font-size:.85rem">No pending withdrawals</div>
      </div>`;
    return;
  }

  list.innerHTML = pending.map(w => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px" id="withdrawal_${w.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:.88rem;color:var(--text)">${w.userName || 'Unknown'}</div>
          <div style="font-size:.7rem;color:var(--muted)">${w.userIdentifier || ''}</div>
        </div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:900;color:#f5c842">₱${(w.amount || 0).toLocaleString()}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.68rem;margin-bottom:8px">
        <div style="color:var(--text2)">📱 GCash: <strong>${w.gcashNumber || 'N/A'}</strong></div>
        <div style="color:var(--text2)">📛 Name: <strong>${w.gcashName || 'N/A'}</strong></div>
        <div style="color:var(--muted)">💳 Fee: ₱${(w.fee || 0).toFixed(2)}</div>
        <div style="color:var(--muted)">📅 ${new Date(w.date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="approveWithdrawal('${w.id}')" style="flex:1;padding:10px;font-size:.78rem">✅ MARK SENT</button>
        <button class="btn-red" onclick="rejectWithdrawal('${w.id}','${w.userId}',${w.total || w.amount})" style="flex:1;padding:10px;font-size:.78rem">❌ REJECT & REFUND</button>
      </div>
    </div>
  `).join('');
}

async function approveWithdrawal(withdrawalId) {
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.updateWithdrawal) {
    await CloudDB.updateWithdrawal(withdrawalId, { status: 'completed', completedAt: new Date().toISOString() });
  }
  Toast.show('✅', 'Withdrawal Processed', 'Marked as sent', 'success');
  const el = document.getElementById('withdrawal_' + withdrawalId);
  if (el) el.remove();
  renderPendingWithdrawals();
}

async function rejectWithdrawal(withdrawalId, userId, refundAmount) {
  // Refund the user
  const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
  if (users[userId]) {
    users[userId].realBalance = (users[userId].realBalance || 0) + refundAmount;
    localStorage.setItem('scatterx_users', JSON.stringify(users));
  }

  // Refund in cloud
  if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
    const cloudUser = await CloudDB.getUser(userId);
    if (cloudUser) {
      cloudUser.realBalance = (cloudUser.realBalance || 0) + refundAmount;
      await CloudDB.saveUser(userId, cloudUser);
    }
    // Delete the withdrawal request
    if (CloudDB.deleteWithdrawal) await CloudDB.deleteWithdrawal(withdrawalId);
  }

  Toast.show('💰', 'Withdrawal Rejected', `₱${refundAmount.toLocaleString()} refunded to user`, 'success');
  const el = document.getElementById('withdrawal_' + withdrawalId);
  if (el) el.remove();
  renderPendingWithdrawals();

  if (Auth.isLoggedIn() && Auth.getCurrentUserId() === userId) {
    Wallet._broadcast();
    updateAuthUI();
  }
}

/* ============================================================
   ADMIN: PROMO CODE MANAGEMENT (cloud-synced)
   ============================================================ */
async function adminCreatePromoCode() {
  const codeEl = document.getElementById('adminPromoCode');
  const amountEl = document.getElementById('adminPromoAmount');
  const typeEl = document.getElementById('adminPromoType');
  const maxUsesEl = document.getElementById('adminPromoMaxUses');
  const expiresEl = document.getElementById('adminPromoExpires');

  const code = (codeEl.value || '').trim().toUpperCase();
  const amount = parseFloat(amountEl.value) || 0;
  const type = typeEl.value || 'demo';
  const maxUses = parseInt(maxUsesEl.value) || 0;
  const expires = expiresEl.value || '';

  if (!code) { Toast.show('⚠️', 'Missing Code', 'Enter a promo code name', 'error'); return; }
  if (code.length < 3) { Toast.show('⚠️', 'Too Short', 'Code must be at least 3 characters', 'error'); return; }
  if (amount <= 0) { Toast.show('⚠️', 'Invalid Amount', 'Amount must be greater than 0', 'error'); return; }

  const codes = getPromoCodes();
  if (codes.find(c => c.code === code && c.active)) {
    Toast.show('⚠️', 'Duplicate', 'An active code with this name already exists', 'error');
    return;
  }

  const newPromo = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    code: code,
    amount: amount,
    type: type,
    maxUses: maxUses,
    usedCount: 0,
    expiresAt: expires ? new Date(expires + 'T23:59:59').toISOString() : null,
    active: true,
    createdAt: new Date().toISOString()
  };

  codes.push(newPromo);
  savePromoCodes(codes);

  // Save to cloud
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.savePromoCode) {
    await CloudDB.savePromoCode(newPromo);
  }

  // Clear form
  codeEl.value = '';
  amountEl.value = '';
  maxUsesEl.value = '0';
  expiresEl.value = '';

  Toast.show('✅', 'Code Created!', `Promo code ${code} created successfully`, 'success');
  renderAdminPromoCodes();
}

async function adminDeletePromoCode(id) {
  const codes = getPromoCodes();
  const idx = codes.findIndex(c => c.id === id);
  if (idx === -1) return;

  const code = codes[idx];
  codes.splice(idx, 1);
  savePromoCodes(codes);

  // Delete from cloud
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.deletePromoCode) {
    await CloudDB.deletePromoCode(id);
  }

  Toast.show('🗑️', 'Code Deleted', `Promo code ${code.code} removed`, 'error');
  renderAdminPromoCodes();
}

async function adminTogglePromoCode(id) {
  const codes = getPromoCodes();
  const promo = codes.find(c => c.id === id);
  if (!promo) return;

  promo.active = !promo.active;
  savePromoCodes(codes);

  // Update in cloud
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.savePromoCode) {
    await CloudDB.savePromoCode(promo);
  }

  Toast.show(promo.active ? '✅' : '⏸️', promo.active ? 'Activated' : 'Deactivated', `Code ${promo.code} is now ${promo.active ? 'active' : 'inactive'}`, promo.active ? 'success' : 'error');
  renderAdminPromoCodes();
}

async function renderAdminPromoCodes() {
  const el = document.getElementById('adminPromoList');
  if (!el) return;

  // Merge local + cloud promo codes
  let codes = getPromoCodes();
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.getAllPromoCodes) {
    try {
      const cloudCodes = await CloudDB.getAllPromoCodes();
      const localMap = {};
      codes.forEach(c => { localMap[c.id] = c; });
      cloudCodes.forEach(c => { if (!localMap[c.id]) codes.push(c); });
      // Save merged set locally
      savePromoCodes(codes);
    } catch (e) { console.error('Failed to load cloud promo codes:', e); }
  }

  // Load redemptions (merge local + cloud)
  let redemptions = getRedemptions();
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.getAllRedemptions) {
    try {
      const cloudRedemptions = await CloudDB.getAllRedemptions();
      const localIds = new Set(redemptions.map(r => r.code + '_' + r.userId));
      cloudRedemptions.forEach(r => {
        if (!localIds.has(r.code + '_' + r.userId)) redemptions.push(r);
      });
    } catch (e) {}
  }

  if (!codes.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--muted)">
        <div style="font-size:1.8rem;margin-bottom:6px">🎁</div>
        <div style="font-size:.82rem">No promo codes yet</div>
        <div style="font-size:.72rem;color:var(--text2)">Create one above!</div>
      </div>`;
    return;
  }

  el.innerHTML = codes.map(c => {
    const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
    const isFull = c.maxUses > 0 && c.usedCount >= c.maxUses;
    const codeRedemptions = redemptions.filter(r => r.code === c.code);
    const statusColor = !c.active ? '#888' : isExpired ? '#ff5252' : isFull ? '#ffa726' : '#38ef7d';
    const statusText = !c.active ? 'INACTIVE' : isExpired ? 'EXPIRED' : isFull ? 'LIMIT REACHED' : 'ACTIVE';
    const typeIcon = c.type === 'real' ? '💰' : '🎮';
    const created = new Date(c.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    const expiresStr = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';

    return `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;${ !c.active ? 'opacity:.6' : '' }">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-family:'Orbitron',sans-serif;font-size:.82rem;font-weight:900;color:var(--gold);letter-spacing:2px">${c.code}</div>
        <span style="font-size:.62rem;font-weight:700;color:${statusColor};background:${statusColor}18;padding:2px 8px;border-radius:4px;text-transform:uppercase">${statusText}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text2);margin-bottom:6px">
        <span>${typeIcon} ₱${(c.amount || 0).toLocaleString()} · ${c.type}</span>
        <span>Uses: ${c.usedCount || 0}${c.maxUses > 0 ? '/' + c.maxUses : '/∞'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-bottom:8px">
        <span>Created: ${created}</span>
        <span>Expires: ${expiresStr}</span>
      </div>
      ${codeRedemptions.length > 0 ? `
        <details style="margin-bottom:8px">
          <summary style="font-size:.72rem;color:var(--text2);cursor:pointer">👥 ${codeRedemptions.length} redemption${codeRedemptions.length > 1 ? 's' : ''}</summary>
          <div style="max-height:100px;overflow-y:auto;margin-top:4px">
            ${codeRedemptions.map(r => `
              <div style="font-size:.68rem;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border)">
                ${r.username || r.userId} · ${new Date(r.redeemedAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
              </div>
            `).join('')}
          </div>
        </details>
      ` : ''}
      <div style="display:flex;gap:6px">
        <button class="btn-primary" onclick="adminTogglePromoCode('${c.id}')" style="flex:1;padding:7px;font-size:.7rem">${c.active ? '⏸️ Disable' : '▶️ Enable'}</button>
        <button class="btn-red" onclick="adminDeletePromoCode('${c.id}')" style="flex:1;padding:7px;font-size:.7rem">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   ADMIN: TOP-UP CODE SYSTEM
   ============================================================
   Generates encoded top-up codes that work across devices.
   Admin generates code → sends to user → user redeems.
   ============================================================ */
const TOPUP_SECRET = 'SX_TOPUP_2026';
const TOPUP_HISTORY_KEY = 'scatterx_topup_history';

function topUpSignature(userId, amount, type, ts) {
  const str = userId + '|' + amount + '|' + type + '|' + ts + '|' + TOPUP_SECRET;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function generateTopUpCode(userId, amount, type) {
  const ts = Date.now();
  const sig = topUpSignature(userId, amount, type, ts);
  const payload = { u: userId, a: amount, t: type, ts: ts, s: sig };
  return 'SX-' + btoa(JSON.stringify(payload)).replace(/=/g, '');
}

function decodeTopUpCode(code) {
  if (!code || !code.startsWith('SX-')) return null;
  try {
    let b64 = code.slice(3);
    // Re-add padding
    while (b64.length % 4 !== 0) b64 += '=';
    const payload = JSON.parse(atob(b64));
    if (!payload.u || !payload.a || !payload.t || !payload.ts || !payload.s) return null;
    // Verify signature
    const expectedSig = topUpSignature(payload.u, payload.a, payload.t, payload.ts);
    if (payload.s !== expectedSig) return null;
    return payload;
  } catch {
    return null;
  }
}

function adminGenerateTopUp() {
  const userIdEl = document.getElementById('adminTopupUserId');
  const amountEl = document.getElementById('adminTopupAmount');
  const typeEl = document.getElementById('adminTopupType');
  const resultEl = document.getElementById('adminTopupResult');

  const userId = (userIdEl.value || '').trim();
  const amount = parseFloat(amountEl.value) || 0;
  const type = typeEl.value || 'real';

  if (!userId) { Toast.show('⚠️', 'Missing User ID', 'Enter the user\'s ID', 'error'); return; }
  if (!userId.startsWith('user_')) { Toast.show('⚠️', 'Invalid User ID', 'User IDs start with "user_"', 'error'); return; }
  if (amount <= 0) { Toast.show('⚠️', 'Invalid Amount', 'Amount must be greater than 0', 'error'); return; }

  const code = generateTopUpCode(userId, amount, type);
  const typeIcon = type === 'real' ? '💰' : '🎮';
  const typeLabel = type === 'real' ? 'Real Money' : 'Demo Credits';

  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(56,239,125,.08),rgba(0,245,160,.04));border:1px solid rgba(56,239,125,.3);border-radius:12px;padding:16px;text-align:center">
      <div style="font-size:1.4rem;margin-bottom:6px">✅</div>
      <div style="font-size:.82rem;font-weight:700;color:var(--gem);margin-bottom:4px">Code Generated!</div>
      <div style="font-size:.72rem;color:var(--text2);margin-bottom:10px">${typeIcon} ₱${amount.toLocaleString()} ${typeLabel} → ${userId.slice(0, 18)}...</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;word-break:break-all;font-family:'Courier New',monospace;font-size:.68rem;color:var(--gold);user-select:all;cursor:text" id="topupCodeOutput">${code}</div>
      <button class="btn-primary" onclick="copyTopUpCode()" style="width:100%;padding:10px;font-size:.78rem">📋 COPY CODE</button>
    </div>`;

  // Save to history
  const history = getTopUpHistory();
  history.unshift({
    code: code,
    userId: userId,
    amount: amount,
    type: type,
    createdAt: new Date().toISOString(),
    redeemed: false
  });
  saveTopUpHistory(history.slice(0, 50)); // Keep last 50

  // Clear form
  userIdEl.value = '';
  amountEl.value = '';

  Toast.show('✅', 'Top-Up Code Created', `₱${amount.toLocaleString()} code generated for ${userId.slice(0, 15)}...`, 'success');
  renderAdminTopUpHistory();
}

function copyTopUpCode() {
  const el = document.getElementById('topupCodeOutput');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    Toast.show('📋', 'Copied!', 'Top-up code copied to clipboard', 'success', 2000);
  }).catch(() => {
    // Fallback
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    Toast.show('📋', 'Copied!', 'Top-up code copied to clipboard', 'success', 2000);
  });
}

function copyUserId() {
  const el = document.getElementById('pdUserId');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    Toast.show('📋', 'Copied!', 'Your User ID has been copied', 'success', 2000);
  }).catch(() => {
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    Toast.show('📋', 'Copied!', 'Your User ID has been copied', 'success', 2000);
  });
}

function getTopUpHistory() {
  try { return JSON.parse(localStorage.getItem(TOPUP_HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveTopUpHistory(h) {
  localStorage.setItem(TOPUP_HISTORY_KEY, JSON.stringify(h));
}

function renderAdminTopUpHistory() {
  const el = document.getElementById('adminTopupHistory');
  if (!el) return;
  const history = getTopUpHistory();

  if (!history.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--muted)">
        <div style="font-size:1.6rem;margin-bottom:6px">🎟️</div>
        <div style="font-size:.78rem">No top-up codes generated yet</div>
      </div>`;
    return;
  }

  el.innerHTML = history.map(h => {
    const typeIcon = h.type === 'real' ? '💰' : '🎮';
    const date = new Date(h.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:.72rem;color:var(--text)">${h.userId.slice(0, 20)}...</span>
        <span style="font-family:'Orbitron',sans-serif;font-size:.78rem;font-weight:700;color:var(--gold)">${typeIcon} ₱${(h.amount || 0).toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.62rem;color:var(--muted)">${date}</span>
        <button onclick="navigator.clipboard.writeText('${h.code}');Toast.show('📋','Copied','Code copied','success',1500)" style="background:var(--card2);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:.6rem;color:var(--text2);cursor:pointer">📋 Copy</button>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   ADMIN: ALL USERS LIST — With Direct Cash-In & Block
   ============================================================ */
let _adminUserSource = 'local'; // 'local' or 'cloud'
let _adminCloudUsers = null;

async function adminLoadCloudUsers() {
  if (typeof CloudDB === 'undefined' || !CloudDB.available()) {
    Toast.show('⚠️', 'Cloud Offline', 'Supabase not configured. See js/db.js', 'error');
    return;
  }
  Toast.show('☁️', 'Loading...', 'Fetching users from cloud...', 'info', 2000);
  _adminCloudUsers = await CloudDB.getAllUsers();
  _adminUserSource = 'cloud';
  renderAdminUsers();
  const count = Object.keys(_adminCloudUsers).length;
  Toast.show('✅', 'Cloud Loaded', `${count} user${count !== 1 ? 's' : ''} loaded from cloud`, 'success');
}

async function adminSyncAllToCloud() {
  if (typeof CloudDB === 'undefined' || !CloudDB.available()) {
    Toast.show('⚠️', 'Cloud Offline', 'Supabase not configured. See js/db.js', 'error');
    return;
  }
  const btn = document.getElementById('adminSyncBtn');
  if (btn) btn.textContent = '⏳ Syncing...';
  const count = await CloudDB.syncAllUsersToCloud();
  Toast.show('✅', 'Sync Complete', `${count} user${count !== 1 ? 's' : ''} synced to cloud`, 'success');
  if (btn) btn.textContent = '☁️ Sync to Cloud';
}

function renderAdminUsers() {
  const listEl = document.getElementById('adminUserList');
  const countEl = document.getElementById('adminUserCount');
  const searchEl = document.getElementById('adminUserSearch');
  if (!listEl) return;

  // Get users from selected source
  let usersObj;
  if (_adminUserSource === 'cloud' && _adminCloudUsers) {
    usersObj = _adminCloudUsers;
  } else {
    usersObj = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
  }

  const search = (searchEl ? searchEl.value : '').toLowerCase().trim();

  let userList = Object.values(usersObj);
  if (search) {
    userList = userList.filter(u =>
      (u.displayName || '').toLowerCase().includes(search) ||
      (u.id || '').toLowerCase().includes(search) ||
      (u.identifier || '').toLowerCase().includes(search)
    );
  }

  userList.sort((a, b) => new Date(b.lastLogin || b.joinDate) - new Date(a.lastLogin || a.joinDate));

  const srcLabel = _adminUserSource === 'cloud' ? ' (☁️ Cloud)' : ' (💾 Local)';
  if (countEl) countEl.textContent = `${userList.length} user${userList.length !== 1 ? 's' : ''} found${srcLabel}`;

  if (!userList.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--muted)">
        <div style="font-size:1.6rem;margin-bottom:6px">👤</div>
        <div style="font-size:.78rem">${search ? 'No matching users' : 'No registered users'}</div>
      </div>`;
    return;
  }

  listEl.innerHTML = userList.map(u => {
    const joined = new Date(u.joinDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';
    const isBlocked = u.blocked === true;
    const blockedStyle = isBlocked ? 'border-color:#ff5252;opacity:.7;' : '';
    const blockedBadge = isBlocked ? `<span style="font-size:.58rem;font-weight:700;color:#ff5252;background:rgba(255,82,82,.12);padding:2px 6px;border-radius:4px;margin-left:6px">🚫 BLOCKED</span>` : '';

    return `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;${blockedStyle}" id="adminUser_${u.id}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:${u.avatar ? u.avatar.color : '#555'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78rem;color:#fff;flex-shrink:0">${u.avatar ? u.avatar.initials : '?'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:700;color:var(--text)">${u.displayName || 'Unknown'}${blockedBadge}</div>
          <div style="font-size:.65rem;color:var(--muted);word-break:break-all">${u.identifier || ''}</div>
        </div>
      </div>

      <div style="background:var(--card2);border-radius:6px;padding:6px 10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:.6rem;color:var(--muted)">User ID:</span>
        <span style="font-family:'Courier New',monospace;font-size:.62rem;color:var(--gold);word-break:break-all">${u.id}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.65rem;margin-bottom:8px">
        <div style="color:var(--text2)">🎮 Demo: <strong style="color:var(--gem)">₱${(u.demoBalance || 0).toLocaleString()}</strong></div>
        <div style="color:var(--text2)">💰 Real: <strong style="color:var(--gold)">₱${(u.realBalance || 0).toLocaleString()}</strong></div>
        <div style="color:var(--muted)">Joined: ${joined}</div>
        <div style="color:var(--muted)">Last: ${lastLogin}</div>
        <div style="color:var(--text2)">Games: ${u.gamesPlayed || 0}</div>
        <div style="color:var(--text2)">Deposited: ₱${(u.totalDeposited || 0).toLocaleString()}</div>
      </div>

      <!-- DIRECT CASH-IN -->
      <div style="background:var(--card2);border-radius:8px;padding:8px;margin-bottom:6px">
        <div style="font-size:.65rem;font-weight:700;color:var(--gold);margin-bottom:6px">💸 Direct Cash-In</div>
        <div style="display:flex;gap:6px">
          <input type="number" id="adminCashIn_${u.id}" placeholder="Amount" min="1" style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text);font-size:.72rem;font-family:'Orbitron',sans-serif" />
          <select id="adminCashInType_${u.id}" style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:.68rem">
            <option value="real">💰 Real</option>
            <option value="demo">🎮 Demo</option>
          </select>
          <button onclick="adminDirectCashIn('${u.id}')" style="background:linear-gradient(135deg,#38ef7d,#11998e);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:.68rem;font-weight:700;cursor:pointer;white-space:nowrap">+ ADD</button>
        </div>
      </div>

      <!-- ACTION BUTTONS -->
      <div style="display:flex;gap:6px">
        <button onclick="document.getElementById('adminTopupUserId').value='${u.id}';switchAdminTab('topup');Toast.show('✅','User ID Set','Now enter the amount','success',2000)" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:6px;padding:7px;font-size:.65rem;font-weight:700;cursor:pointer">🎟️ Top-Up</button>
        <button onclick="adminToggleBlock('${u.id}',${isBlocked})" style="flex:1;background:${isBlocked ? 'linear-gradient(135deg,#38ef7d,#11998e)' : 'linear-gradient(135deg,#ff5252,#d32f2f)'};color:#fff;border:none;border-radius:6px;padding:7px;font-size:.65rem;font-weight:700;cursor:pointer">${isBlocked ? '✅ Unblock' : '🚫 Block'}</button>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   ADMIN: DIRECT CASH-IN (add money directly)
   ============================================================ */
async function adminDirectCashIn(userId) {
  const amtEl = document.getElementById('adminCashIn_' + userId);
  const typeEl = document.getElementById('adminCashInType_' + userId);
  if (!amtEl || !typeEl) return;

  const amount = parseFloat(amtEl.value) || 0;
  const type = typeEl.value || 'real';

  if (amount <= 0) {
    Toast.show('⚠️', 'Invalid Amount', 'Enter an amount greater than 0', 'error');
    return;
  }

  let userName = 'Unknown';
  let success = false;

  // Build the transaction record once
  const txn = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: 'admin_cashin',
    amount: amount,
    method: 'Admin Direct Cash-In (' + type + ')',
    status: 'success',
    date: new Date().toISOString()
  };

  // Try cloud FIRST (single source of truth)
  if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
    const result = await CloudDB.adminCashIn(userId, amount, type);
    if (result.success) {
      userName = result.userName || userName;
      success = true;

      // Also update local storage to keep in sync (no cloud call — auto-save handles it)
      const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
      if (users[userId]) {
        const field = type === 'real' ? 'realBalance' : 'demoBalance';
        users[userId][field] = (users[userId][field] || 0) + amount;
        if (type === 'real') users[userId].totalDeposited = (users[userId].totalDeposited || 0) + amount;
        if (!users[userId].transactions) users[userId].transactions = [];
        users[userId].transactions.unshift(txn);
        users[userId].lastSync = new Date().toISOString();
        localStorage.setItem('scatterx_users', JSON.stringify(users));
      }
    } else {
      Toast.show('⚠️', 'Cloud Error', result.error || 'Cloud write failed, trying local...', 'error', 3000);
    }
  }

  // Fallback: local-only if cloud failed or offline
  if (!success) {
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    const user = users[userId];
    if (!user) {
      Toast.show('❌', 'User Not Found', 'User not in local storage and cloud is offline', 'error');
      return;
    }
    userName = user.displayName || 'Unknown';
    const field = type === 'real' ? 'realBalance' : 'demoBalance';
    user[field] = (user[field] || 0) + amount;
    if (type === 'real') user.totalDeposited = (user.totalDeposited || 0) + amount;
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(txn);
    users[userId] = user;
    localStorage.setItem('scatterx_users', JSON.stringify(users));
    success = true;
  }

  if (success) {
    const typeIcon = type === 'real' ? '💰' : '🎮';
    const typeLabel = type === 'real' ? 'real balance' : 'demo credits';
    Toast.show('✅', 'Cash-In Success!', `${typeIcon} ₱${amount.toLocaleString()} added to ${userName}'s ${typeLabel}`, 'success', 5000);
    if (typeof SFX !== 'undefined') SFX.play('deposit');
    amtEl.value = '';
  }

  // Refresh admin user list (reload from cloud if in cloud mode)
  if (_adminUserSource === 'cloud' && typeof CloudDB !== 'undefined' && CloudDB.available()) {
    _adminCloudUsers = await CloudDB.getAllUsers();
  }
  renderAdminUsers();

  if (Auth.isLoggedIn() && Auth.getCurrentUserId() === userId) {
    Wallet._broadcast();
    updateAuthUI();
  }
}

/* ============================================================
   ADMIN: BLOCK / UNBLOCK USERS
   ============================================================ */
async function adminToggleBlock(userId, currentlyBlocked) {
  if (currentlyBlocked) {
    // Unblock
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    if (users[userId]) {
      users[userId].blocked = false;
      users[userId].blockedAt = null;
      users[userId].blockReason = null;
      localStorage.setItem('scatterx_users', JSON.stringify(users));
    }

    if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
      await CloudDB.unblockUser(userId);
    }

    Toast.show('✅', 'User Unblocked', `${users[userId]?.displayName || userId} has been unblocked`, 'success');
    renderAdminUsers();
  } else {
    // Block — show reason prompt
    const reason = prompt('Block reason (optional):') || 'Blocked by admin';

    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    if (users[userId]) {
      users[userId].blocked = true;
      users[userId].blockedAt = new Date().toISOString();
      users[userId].blockReason = reason;
      localStorage.setItem('scatterx_users', JSON.stringify(users));
    }

    if (typeof CloudDB !== 'undefined' && CloudDB.available()) {
      await CloudDB.blockUser(userId, reason);
    }

    Toast.show('🚫', 'User Blocked', `${users[userId]?.displayName || userId} has been blocked`, 'error');
    renderAdminUsers();

    // If this user is currently logged in on this device, force logout
    if (Auth.isLoggedIn() && Auth.getCurrentUserId() === userId) {
      Auth.logout();
      updateAuthUI();
      Toast.show('🚫', 'Session Ended', 'Your account has been blocked', 'error', 8000);
    }
  }
}

// Keyboard shortcut: Right Alt + Right Shift + T to open admin panel 
document.addEventListener('keydown', function(e) {
  if (e.getModifierState('AltGraph') && e.shiftKey && (e.key === 'T' || e.key === 't' || e.code === 'KeyT')) {
    e.preventDefault();
    openAdminPanel();
  }
  // Fallback: Right Alt + Right Shift detection via location
  if (e.altKey && e.shiftKey && (e.key === 'T' || e.key === 't' || e.code === 'KeyT') && e.location !== 1) {
    e.preventDefault();
    openAdminPanel();
  }
});
