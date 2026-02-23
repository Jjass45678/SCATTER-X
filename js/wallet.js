/**
 * SCATTERX — Enhanced Wallet, GCash Integration, Discord Webhook & Utility Module
 * Dual currency: Demo Credits (free) + Real Money (GCash deposits)
 * Discord webhook for deposit verification
 */

/* ============================================================
   CONFIG
   ============================================================ */
const CONFIG = {
  GCASH_NUMBER: '0917 123 4567',
  GCASH_NAME: 'ScatterX Gaming',
  DISCORD_WEBHOOK: 'https://discordapp.com/api/webhooks/1475398175371300866/y31pd9CZ57-x8bL3A7Jt6km1XxRTOSEZp14Vf8TeJGkRsu46zCm9LI1AUuZHL84IsJdZ',
  MIN_DEPOSIT: 50,
  MIN_WITHDRAW: 100,
  WITHDRAW_FEE: 0.02,
  DEMO_DEFAULT: 1000
};

/* ============================================================
   SVG ICON SYSTEM
   ============================================================ */
const GAME_SVG = {
  mines: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="14" r="7"/><path d="M12 7V3M15 5l2-2"/></svg>',
  crash: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 2L9 17h6L12 2z"/><path d="M9 17l-2 5M15 17l2 5"/><circle cx="12" cy="11" r="2"/></svg>',
  slots: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14"/></svg>',
  plinko: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>',
  roulette: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>',
  color: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="#ff3b5c"/><circle cx="15.5" cy="8.5" r="1.5" fill="#4a90e2"/><circle cx="8.5" cy="15.5" r="1.5" fill="#00f5a0"/><circle cx="15.5" cy="15.5" r="1.5" fill="#f5c842"/><circle cx="12" cy="12" r="1.5" fill="#9b7fd4"/></svg>',
  tower: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 6h6M9 10h6M9 14h6M9 18h6"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M6 3h12l4 6-10 13L2 9zM2 9h20"/></svg>',
  coins: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="9" r="7"/><path d="M15 15a7 7 0 10-6-12"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>',
};

function gameIcon(name, size) {
  size = size || '';
  return '<span class="game-icon game-icon-' + (size ? size + ' ' : '') + 'game-icon-' + name + '">' + (GAME_SVG[name] || '') + '</span>';
}

/* ============================================================
   WALLET — Works with Auth system
   ============================================================ */
const Wallet = (() => {
  // Legacy keys for backward compat
  const KEY = 'scatter_balance';
  const TXN_KEY = 'scatter_txns';

  function get() {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      return Auth.getBalance();
    }
    const v = parseFloat(localStorage.getItem(KEY));
    return isNaN(v) ? CONFIG.DEMO_DEFAULT : v;
  }

  function getReal() {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      return Auth.getBalance('real');
    }
    return 0;
  }

  function getDemo() {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      return Auth.getBalance('demo');
    }
    const v = parseFloat(localStorage.getItem(KEY));
    return isNaN(v) ? CONFIG.DEMO_DEFAULT : v;
  }

  function getMode() {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      return Auth.getBalanceMode();
    }
    return 'demo';
  }

  function set(amount) {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.setBalance(amount);
    } else {
      localStorage.setItem(KEY, Math.max(0, parseFloat(amount.toFixed(2))));
    }
    _broadcast();
  }

  function add(amount) { set(get() + amount); }

  function subtract(amount) {
    if (amount > get()) return false;
    set(get() - amount);
    return true;
  }

  function addReal(amount) {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.addBalance(amount, 'real');
      _broadcast();
    }
  }

  function subtractReal(amount) {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      return Auth.subtractBalance(amount, 'real');
    }
    return false;
  }

  function addDemo(amount) {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.addBalance(amount, 'demo');
      _broadcast();
    } else {
      const v = parseFloat(localStorage.getItem(KEY)) || CONFIG.DEMO_DEFAULT;
      localStorage.setItem(KEY, (v + amount).toFixed(2));
      _broadcast();
    }
  }

  function reset() {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.setBalance(CONFIG.DEMO_DEFAULT, 'demo');
    } else {
      localStorage.setItem(KEY, CONFIG.DEMO_DEFAULT);
    }
    _broadcast();
  }

  function _broadcast() {
    document.querySelectorAll('.bal-val').forEach(el => {
      el.textContent = fmt(get());
    });
    if (typeof updateAuthUI === 'function') {
      updateAuthUI();
    }
  }

  function fmt(n) {
    return '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtUSD(n) {
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Transaction history
  function getTxns() {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      return Auth.getTransactions();
    }
    try { return JSON.parse(localStorage.getItem(TXN_KEY)) || []; } catch { return []; }
  }

  function addTxn(type, amount, method, status = 'success', extra = {}) {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.addTransaction(type, amount, method, status, extra);
    } else {
      const txns = getTxns();
      txns.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type, amount, method, status,
        date: new Date().toISOString(),
        ...extra
      });
      if (txns.length > 50) txns.length = 50;
      localStorage.setItem(TXN_KEY, JSON.stringify(txns));
    }
  }

  function init() {
    _broadcast();
    setInterval(_broadcast, 2000);
  }

  return { get, getReal, getDemo, getMode, set, add, subtract, addReal, subtractReal, addDemo, reset, fmt, fmtUSD, init, getTxns, addTxn, _broadcast };
})();

/* ============================================================
   AUDIO ENGINE
   ============================================================ */
const SFX = (() => {
  let ctx = null;
  function _ctx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function play(type) {
    try {
      const c = _ctx();
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      const t = c.currentTime;
      if (type === 'gem') {
        o.type = 'sine'; o.frequency.setValueAtTime(880, t);
        o.frequency.exponentialRampToValueAtTime(1320, t + .12);
        g.gain.setValueAtTime(.14, t); g.gain.exponentialRampToValueAtTime(.001, t + .25);
        o.start(); o.stop(t + .25);
      } else if (type === 'mine') {
        o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(40, t + .45);
        g.gain.setValueAtTime(.28, t); g.gain.exponentialRampToValueAtTime(.001, t + .45);
        o.start(); o.stop(t + .45);
      } else if (type === 'win') {
        [0,.08,.16,.24].forEach((d, i) => {
          const oo = c.createOscillator(), gg = c.createGain();
          oo.connect(gg); gg.connect(c.destination);
          oo.type = 'sine'; oo.frequency.value = 523 + i * 131;
          gg.gain.setValueAtTime(.12, t+d); gg.gain.exponentialRampToValueAtTime(.001, t+d+.22);
          oo.start(t+d); oo.stop(t+d+.22);
        });
      } else if (type === 'click') {
        o.type = 'sine'; o.frequency.setValueAtTime(440, t);
        g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .08);
        o.start(); o.stop(t + .08);
      } else if (type === 'spin') {
        o.type = 'triangle'; o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(110, t + .3);
        g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.001, t + .3);
        o.start(); o.stop(t + .3);
      } else if (type === 'crash') {
        o.type = 'sawtooth'; o.frequency.setValueAtTime(440, t);
        o.frequency.exponentialRampToValueAtTime(55, t + .6);
        g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .6);
        o.start(); o.stop(t + .6);
      } else if (type === 'tick') {
        o.type = 'square'; o.frequency.setValueAtTime(880, t);
        g.gain.setValueAtTime(.04, t); g.gain.exponentialRampToValueAtTime(.001, t + .05);
        o.start(); o.stop(t + .05);
      } else if (type === 'plinko') {
        o.type = 'sine'; o.frequency.setValueAtTime(600 + Math.random()*400, t);
        g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.001, t + .12);
        o.start(); o.stop(t + .12);
      } else if (type === 'cashout') {
        [0,.06,.12,.18,.24,.3].forEach((d, i) => {
          const oo = c.createOscillator(), gg = c.createGain();
          oo.connect(gg); gg.connect(c.destination);
          oo.type = 'sine'; oo.frequency.value = 440 + i * 110;
          gg.gain.setValueAtTime(.1, t+d); gg.gain.exponentialRampToValueAtTime(.001, t+d+.15);
          oo.start(t+d); oo.stop(t+d+.15);
        });
      } else if (type === 'deposit') {
        [0,.05,.1,.15,.2,.25,.3,.35].forEach((d, i) => {
          const oo = c.createOscillator(), gg = c.createGain();
          oo.connect(gg); gg.connect(c.destination);
          oo.type = 'sine'; oo.frequency.value = 330 + i * 80;
          gg.gain.setValueAtTime(.08, t+d); gg.gain.exponentialRampToValueAtTime(.001, t+d+.12);
          oo.start(t+d); oo.stop(t+d+.12);
        });
      }
    } catch(e) {}
  }
  return { play };
})();

/* ============================================================
   PARTICLES
   ============================================================ */
const FX = (() => {
  function burst(x, y, color = '#00f5a0', count = 12) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = (Math.PI * 2 * i) / count + Math.random() * .4;
      const dist = 40 + Math.random() * 60;
      p.style.cssText = `
        left:${x}px;top:${y}px;
        width:${3+Math.random()*6}px;height:${3+Math.random()*6}px;
        background:${color};
        --tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;
        animation-duration:${.4+Math.random()*.4}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }
  function fireworks() {
    const cols = ['#f5c842','#00f5a0','#00d9e8','#ff3b5c','#fff','#7b5ea7'];
    for (let j = 0; j < 5; j++) {
      setTimeout(() => {
        burst(
          window.innerWidth * (.15 + Math.random() * .7),
          window.innerHeight * (.1 + Math.random() * .45),
          cols[Math.floor(Math.random()*cols.length)], 20
        );
      }, j * 160);
    }
  }
  return { burst, fireworks };
})();

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
const Toast = (() => {
  let container = null;
  function _container() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }
  function show(icon, title, message, type = 'info', duration = 4000) {
    const c = _container();
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-msg"><strong>${title}</strong><span>${message}</span></div>
    `;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add('removing');
      setTimeout(() => t.remove(), 300);
    }, duration);
  }
  return { show };
})();

/* ============================================================
   HELPERS
   ============================================================ */
function shakeEl(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function elCenter(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/* ============================================================
   MOBILE MENU TOGGLE
   ============================================================ */
function toggleMobileMenu() {
  const btn = document.querySelector('.nav-hamburger');
  const menu = document.querySelector('.mobile-menu');
  if (!btn || !menu) return;
  btn.classList.toggle('open');
  menu.classList.toggle('show');
  document.body.style.overflow = menu.classList.contains('show') ? 'hidden' : '';
}

/* ============================================================
   DISCORD WEBHOOK — Send deposit screenshot for verification
   ============================================================ */
async function sendToDiscordWebhook(imageFile, depositInfo) {
  const formData = new FormData();
  
  const user = Auth.getCurrentUser();
  const userName = user ? user.displayName : 'Unknown';
  const userId = user ? user.id : 'N/A';
  const userIdentifier = user ? user.identifier : 'N/A';
  
  const embed = {
    title: '💳 New Deposit Request',
    color: 0x007bff,
    fields: [
      { name: '👤 Player', value: userName, inline: true },
      { name: '🆔 User ID', value: userId, inline: true },
      { name: '📧 Contact', value: userIdentifier, inline: true },
      { name: '💰 Amount', value: `₱${depositInfo.amount.toLocaleString()}`, inline: true },
      { name: '📋 Reference', value: depositInfo.refCode, inline: true },
      { name: '📅 Date', value: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }), inline: true },
    ],
    footer: { text: 'Reply YES to approve this deposit | ScatterX Gaming' },
    timestamp: new Date().toISOString()
  };

  const payload = {
    content: `**🔔 DEPOSIT REQUEST** from **${userName}** (${userIdentifier})\nAmount: **₱${depositInfo.amount.toLocaleString()}** | Ref: **${depositInfo.refCode}**\nUser ID: \`${userId}\`\n\n⚠️ **Reply YES to approve and add ₱${depositInfo.amount.toLocaleString()} to this account**`,
    embeds: [embed]
  };

  formData.append('payload_json', JSON.stringify(payload));
  formData.append('file', imageFile, 'deposit_proof_' + depositInfo.refCode + '.png');

  try {
    const response = await fetch(CONFIG.DISCORD_WEBHOOK, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      const text = await response.text();
      console.error('Discord webhook error:', text);
      return { success: false, error: 'Failed to send to Discord' };
    }
  } catch (err) {
    console.error('Discord webhook error:', err);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/* ============================================================
   GCASH INTEGRATION — Cash In / Cash Out / Demo / History
   ============================================================ */
function generateRefCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SX-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    Toast.show('📋', 'Copied!', text, 'success', 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    Toast.show('📋', 'Copied!', text, 'success', 2000);
  });
}

function getDepositModalHTML() {
  const isLoggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
  const mode = isLoggedIn ? Auth.getBalanceMode() : 'demo';
  const demoBalance = isLoggedIn ? Wallet.fmt(Auth.getBalance('demo')) : Wallet.fmt(Wallet.get());
  const realBalance = isLoggedIn ? Wallet.fmt(Auth.getBalance('real')) : '₱0.00';
  
  return `
<div class="modal-backdrop" id="depositModal" onclick="if(event.target===this)closeDepositModal()">
  <div class="modal" style="position:relative;max-width:520px;padding:24px 28px">
    <button class="modal-close" onclick="closeDepositModal()">✕</button>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div>
        <div style="background:linear-gradient(135deg,var(--gem),var(--gem2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:900">Wallet</div>
        <div style="font-size:.75rem;color:var(--text2)">Demo credits & real money</div>
      </div>
      <div style="display:flex;gap:8px">
        <div style="background:var(--card);border:1px solid ${mode === 'demo' ? 'var(--gem)' : 'var(--border)'};border-radius:8px;padding:6px 12px;text-align:center">
          <div style="font-size:.55rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Demo</div>
          <div style="font-family:'Orbitron',sans-serif;font-size:.75rem;font-weight:700;color:var(--gem)" id="walletDemoBalance">${demoBalance}</div>
        </div>
        <div style="background:var(--card);border:1px solid ${mode === 'real' ? 'var(--gold)' : 'var(--border)'};border-radius:8px;padding:6px 12px;text-align:center">
          <div style="font-size:.55rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Real</div>
          <div style="font-family:'Orbitron',sans-serif;font-size:.75rem;font-weight:700;color:var(--gold)" id="walletRealBalance">${realBalance}</div>
        </div>
      </div>
    </div>

    <div class="modal-tabs" id="walletTabs">
      <button class="modal-tab active-gcash" onclick="switchWalletTab('cashin')">💳 Cash In</button>
      <button class="modal-tab" onclick="switchWalletTab('cashout')">💸 Cash Out</button>
      <button class="modal-tab" onclick="switchWalletTab('topup')">🎟️ Top-Up</button>
      <button class="modal-tab" onclick="switchWalletTab('demo')">🎮 Demo</button>
      <button class="modal-tab" onclick="switchWalletTab('promo')">🎁 Promo</button>
      <button class="modal-tab" onclick="switchWalletTab('history')">📋 History</button>
    </div>

    <!-- CASH IN TAB -->
    <div class="tab-panel active" id="tabCashin">
      ${!isLoggedIn ? `
        <div style="text-align:center;padding:30px 10px">
          <div style="font-size:2rem;margin-bottom:10px">🔒</div>
          <div style="font-size:.92rem;font-weight:600;color:var(--text);margin-bottom:6px">Login Required</div>
          <div style="font-size:.78rem;color:var(--text2);margin-bottom:16px">You need to login or create an account to deposit real money</div>
          <button class="btn-primary" onclick="closeDepositModal();openAuthModal()" style="max-width:200px;margin:0 auto">🔑 Login / Register</button>
        </div>
      ` : `
      <div class="gcash-header" style="padding:12px;margin-bottom:10px">
        <div class="gcash-logo" style="width:36px;height:36px;font-size:.6rem">G</div>
        <div class="gcash-header-info">
          <h3 style="font-size:.85rem">Cash In via GCash</h3>
          <p style="font-size:.7rem">Send money & upload proof of payment</p>
        </div>
      </div>

      <div class="field-group" style="margin-bottom:8px">
        <div class="field-label">Amount (₱) — Min ₱${CONFIG.MIN_DEPOSIT}</div>
        <input type="number" class="field-input" id="cashinAmount" placeholder="Enter amount" min="${CONFIG.MIN_DEPOSIT}" style="padding:10px 14px" />
        <div class="quick-amounts" style="margin:8px 0;gap:6px">
          <div class="quick-amt" onclick="setCashinAmt(100)" style="padding:7px">₱100</div>
          <div class="quick-amt" onclick="setCashinAmt(500)" style="padding:7px">₱500</div>
          <div class="quick-amt" onclick="setCashinAmt(1000)" style="padding:7px">₱1K</div>
          <div class="quick-amt" onclick="setCashinAmt(2000)" style="padding:7px">₱2K</div>
          <div class="quick-amt" onclick="setCashinAmt(5000)" style="padding:7px">₱5K</div>
          <div class="quick-amt" onclick="setCashinAmt(10000)" style="padding:7px">₱10K</div>
        </div>
      </div>

      <button class="btn-gcash" onclick="processCashIn()" style="margin-bottom:10px" id="cashinProceedBtn">
        Proceed with GCash →
      </button>

      <div id="cashinInstructions" style="display:none">
        <div class="gcash-number-display">
          <div class="label">Send to this GCash Number</div>
          <div class="number">${CONFIG.GCASH_NUMBER}</div>
          <div style="font-size:.72rem;color:var(--text2);margin-top:4px">${CONFIG.GCASH_NAME}</div>
          <button class="copy-btn" onclick="copyToClipboard('${CONFIG.GCASH_NUMBER.replace(/\s/g, '')}')" style="margin-top:8px;background:var(--gcash);color:#fff;border:none;border-radius:6px;padding:6px 16px;font-size:.72rem;font-weight:600;cursor:pointer">📋 Copy Number</button>
        </div>

        <div class="ref-code">
          <div>
            <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Reference Code</div>
            <div class="code" id="cashinRefCode">—</div>
          </div>
          <button class="copy-btn" onclick="copyToClipboard(document.getElementById('cashinRefCode').textContent)">Copy</button>
        </div>

        <div class="gcash-steps">
          <div class="gcash-step">
            <div class="gcash-step-num">1</div>
            <div class="gcash-step-text">Open your <strong>GCash app</strong> and tap <strong>Send Money</strong></div>
          </div>
          <div class="gcash-step">
            <div class="gcash-step-num">2</div>
            <div class="gcash-step-text">Send <strong>exact amount</strong> to <strong>${CONFIG.GCASH_NUMBER}</strong></div>
          </div>
          <div class="gcash-step">
            <div class="gcash-step-num">3</div>
            <div class="gcash-step-text">Put reference code <strong id="refCodeStep">—</strong> in the message</div>
          </div>
          <div class="gcash-step">
            <div class="gcash-step-num">4</div>
            <div class="gcash-step-text"><strong>Take a screenshot</strong> of the GCash receipt and upload it below</div>
          </div>
        </div>

        <div class="upload-area" id="uploadArea" onclick="document.getElementById('proofUpload').click()">
          <input type="file" id="proofUpload" accept="image/*" style="display:none" onchange="handleProofUpload(event)" />
          <div class="upload-icon" id="uploadIcon">📸</div>
          <div class="upload-text" id="uploadText">Click to upload GCash receipt screenshot</div>
          <div class="upload-sub" id="uploadSub">JPG, PNG — Max 10MB</div>
          <img id="proofPreview" style="display:none;max-width:100%;max-height:200px;border-radius:10px;margin-top:10px" />
        </div>

        <button class="btn-primary" onclick="submitDeposit()" style="margin-top:12px" id="submitDepositBtn" disabled>
          📤 Submit Deposit for Verification
        </button>

        <div class="dep-note" style="margin-top:10px">
          <strong>⏳ Processing:</strong> Your deposit will be verified by our team. Once approved, <strong>real money credits</strong> will be added to your account within <strong>1-5 minutes</strong>.
        </div>
      </div>
      `}
    </div>

    <!-- CASH OUT TAB -->
    <div class="tab-panel" id="tabCashout">
      ${!isLoggedIn ? `
        <div style="text-align:center;padding:30px 10px">
          <div style="font-size:2rem;margin-bottom:10px">🔒</div>
          <div style="font-size:.92rem;font-weight:600;color:var(--text);margin-bottom:6px">Login Required</div>
          <div style="font-size:.78rem;color:var(--text2);margin-bottom:16px">You need to login to withdraw real money</div>
          <button class="btn-primary" onclick="closeDepositModal();openAuthModal()" style="max-width:200px;margin:0 auto">🔑 Login / Register</button>
        </div>
      ` : `
      <div class="gcash-header">
        <div class="gcash-logo">G</div>
        <div class="gcash-header-info">
          <h3>Cash Out to GCash</h3>
          <p>Withdraw your <strong>real money</strong> winnings to GCash</p>
        </div>
      </div>

      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;text-align:center;margin-bottom:14px">
        <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Real Money Balance</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.4rem;font-weight:900;color:var(--gold)">${realBalance}</div>
        <div style="font-size:.68rem;color:var(--text2);margin-top:4px">Only real money can be withdrawn (not demo credits)</div>
      </div>

      <div class="field-group" style="margin-bottom:10px">
        <div class="field-label">Your GCash Number</div>
        <input type="tel" class="field-input" id="cashoutGcashNum" placeholder="09XX XXX XXXX" maxlength="13" style="font-family:'Inter',sans-serif" />
      </div>
      <div class="field-group" style="margin-bottom:10px">
        <div class="field-label">Account Name</div>
        <input type="text" class="field-input" id="cashoutName" placeholder="Juan Dela Cruz" style="font-family:'Inter',sans-serif" />
      </div>
      <div class="field-group" style="margin-bottom:12px">
        <div class="field-label">Amount to Withdraw (₱)</div>
        <input type="number" class="field-input" id="cashoutAmount" placeholder="Enter amount" min="${CONFIG.MIN_WITHDRAW}" />
        <div class="quick-amounts">
          <div class="quick-amt" onclick="setCashoutAmt(500)">₱500</div>
          <div class="quick-amt" onclick="setCashoutAmt(1000)">₱1,000</div>
          <div class="quick-amt" onclick="setCashoutAmt(0)" style="color:var(--gold);border-color:rgba(245,200,66,.3)">All</div>
        </div>
      </div>

      <div class="dep-note" style="margin-bottom:14px">
        <strong>⚠️ Min ₱${CONFIG.MIN_WITHDRAW}</strong> withdrawal. Processing takes <strong>5-30 minutes</strong>. A <strong>${(CONFIG.WITHDRAW_FEE * 100)}% fee</strong> applies. <strong>Demo credits cannot be withdrawn.</strong>
      </div>

      <button class="btn-gold" onclick="processCashOut()">
        💸 Withdraw to GCash
      </button>
      `}
    </div>

    <!-- DEMO TAB -->
    <div class="tab-panel" id="tabDemo">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:2.5rem;margin-bottom:8px">🎮</div>
        <div style="font-size:.92rem;font-weight:600;color:var(--text);margin-bottom:4px">Demo Credits</div>
        <div style="font-size:.78rem;color:var(--text2)">Free play money for testing — <strong>cannot be withdrawn</strong></div>
      </div>

      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;text-align:center;margin-bottom:14px">
        <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Demo Balance</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:1.4rem;font-weight:900;color:var(--gem)">${demoBalance}</div>
      </div>

      <div class="dep-note" style="margin-bottom:14px">
        <strong>ℹ️ Demo credits</strong> are separate from real money. They are for practice only and <strong>cannot be converted to real money or withdrawn</strong>.
      </div>

      <div class="field-group" style="margin-bottom:12px">
        <div class="field-label">Amount to Add</div>
        <input type="number" class="field-input" id="demoAmount" placeholder="Enter amount" min="1" value="1000" />
        <div class="quick-amounts">
          <div class="quick-amt" onclick="document.getElementById('demoAmount').value=500">₱500</div>
          <div class="quick-amt" onclick="document.getElementById('demoAmount').value=1000">₱1,000</div>
          <div class="quick-amt" onclick="document.getElementById('demoAmount').value=5000">₱5,000</div>
          <div class="quick-amt" onclick="document.getElementById('demoAmount').value=10000">₱10,000</div>
          <div class="quick-amt" onclick="document.getElementById('demoAmount').value=50000">₱50,000</div>
          <div class="quick-amt" onclick="document.getElementById('demoAmount').value=100000">₱100,000</div>
        </div>
      </div>

      <button class="btn-primary" onclick="addDemoCredits()">
        + Add Demo Credits
      </button>

      <button class="btn-outline" onclick="resetDemoBalance()" style="margin-top:8px;font-size:.78rem">
        🔄 Reset to ₱${CONFIG.DEMO_DEFAULT.toLocaleString()}
      </button>
    </div>

    <!-- PROMO CODE TAB -->
    <div class="tab-panel" id="tabPromo">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:2.5rem;margin-bottom:8px">🎁</div>
        <div style="font-size:.92rem;font-weight:600;color:var(--text);margin-bottom:4px">Redeem Promo Code</div>
        <div style="font-size:.78rem;color:var(--text2)">Enter a promo code to receive free credits or real money bonus</div>
      </div>

      ${!isLoggedIn ? `
        <div style="text-align:center;padding:20px 10px">
          <div style="font-size:.92rem;font-weight:600;color:var(--text);margin-bottom:6px">Login Required</div>
          <div style="font-size:.78rem;color:var(--text2);margin-bottom:16px">You need an account to redeem promo codes</div>
          <button class="btn-primary" onclick="closeDepositModal();openAuthModal()" style="max-width:200px;margin:0 auto">🔑 Login / Register</button>
        </div>
      ` : `
      <div class="field-group" style="margin-bottom:14px">
        <div class="field-label">Promo Code</div>
        <div style="display:flex;gap:8px">
          <input type="text" class="field-input" id="promoCodeInput" placeholder="Enter code (e.g. WELCOME100)" style="text-transform:uppercase;font-family:'Orbitron',sans-serif;letter-spacing:2px" />
          <button class="btn-primary" onclick="redeemPromoCode()" style="white-space:nowrap;padding:10px 20px">REDEEM</button>
        </div>
      </div>

      <div id="promoResult" style="display:none;margin-bottom:14px"></div>

      <div class="dep-note" style="margin-bottom:14px">
        <strong>ℹ️ How promo codes work:</strong><br>
        • Promo codes add bonus credits to your account<br>
        • Each code can only be used once per account<br>
        • Codes may have expiration dates<br>
        • Check our Discord or social media for new codes!
      </div>

      <div style="font-size:.78rem;font-weight:600;color:var(--text);margin-bottom:8px">My Redeemed Codes</div>
      <div id="redeemedList" style="max-height:150px;overflow-y:auto"></div>
      `}
    </div>

    <!-- HISTORY TAB -->
    <div class="tab-panel" id="tabHistory">
      <div style="font-size:.82rem;font-weight:600;color:var(--text);margin-bottom:12px">Recent Transactions</div>
      <div class="txn-list" id="txnList">
        <div style="text-align:center;padding:30px;color:var(--muted);font-size:.82rem">No transactions yet</div>
      </div>
    </div>

    <!-- TOP-UP REDEMPTION TAB -->
    <div class="tab-panel" id="tabTopup">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:2.5rem;margin-bottom:8px">🎟️</div>
        <div style="font-size:.92rem;font-weight:600;color:var(--text);margin-bottom:4px">Redeem Top-Up Code</div>
        <div style="font-size:.78rem;color:var(--text2)">Enter a top-up code from the admin to add funds</div>
      </div>

      ${!isLoggedIn ? `
        <div style="text-align:center;padding:20px 10px">
          <div style="font-size:.92rem;font-weight:600;color:var(--text);margin-bottom:6px">Login Required</div>
          <div style="font-size:.78rem;color:var(--text2);margin-bottom:16px">You need an account to redeem top-up codes</div>
          <button class="btn-primary" onclick="closeDepositModal();openAuthModal()" style="max-width:200px;margin:0 auto">🔑 Login / Register</button>
        </div>
      ` : `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:.7rem;color:var(--muted)">Your User ID:</span>
          <button onclick="copyUserId()" style="background:var(--gold);color:#000;border:none;border-radius:4px;padding:3px 8px;font-size:.6rem;font-weight:700;cursor:pointer">📋 Copy</button>
        </div>
        <div style="font-family:'Orbitron',sans-serif;font-size:.72rem;font-weight:700;color:var(--gold);word-break:break-all" id="topupMyUserId">${typeof Auth !== 'undefined' && Auth.getCurrentUserId() ? Auth.getCurrentUserId() : ''}</div>
        <div style="font-size:.58rem;color:var(--text2);margin-top:4px">Send this ID to admin to receive a top-up code</div>
      </div>

      <div class="field-group" style="margin-bottom:14px">
        <div class="field-label">Top-Up Code</div>
        <div style="display:flex;gap:8px">
          <input type="text" class="field-input" id="topupCodeInput" placeholder="Paste SX-... code here" style="font-family:'Courier New',monospace;font-size:.75rem;letter-spacing:1px" />
          <button class="btn-primary" onclick="redeemTopUpCode()" style="white-space:nowrap;padding:10px 20px">REDEEM</button>
        </div>
      </div>

      <div id="topupRedeemResult" style="display:none;margin-bottom:14px"></div>

      <div class="dep-note" style="margin-bottom:14px">
        <strong>💡 How Top-Up Codes work:</strong><br>
        1. Share your User ID with the admin<br>
        2. Admin generates a code for your account<br>
        3. Paste the code above and click REDEEM<br>
        4. Funds are added to your balance instantly!
      </div>

      <div style="font-size:.78rem;font-weight:600;color:var(--text);margin-bottom:8px">My Top-Up History</div>
      <div id="topupRedeemedList" style="max-height:150px;overflow-y:auto"></div>
      `}
    </div>
  </div>
</div>`;
}

function openDepositModal() {
  // Remove existing modal first
  const existing = document.getElementById('depositModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', getDepositModalHTML());
  const modal = document.getElementById('depositModal');
  modal.classList.add('show');
  renderTxnHistory();
}

function closeDepositModal() {
  const modal = document.getElementById('depositModal');
  if (modal) modal.classList.remove('show');
}

function switchWalletTab(tab) {
  const tabs = document.querySelectorAll('#walletTabs .modal-tab');
  const names = ['cashin', 'cashout', 'topup', 'demo', 'promo', 'history'];

  tabs.forEach((t, i) => {
    t.className = 'modal-tab';
    if (names[i] === tab) {
      if (tab === 'cashout') t.classList.add('active-cashout');
      else if (tab === 'cashin') t.classList.add('active-gcash');
      else t.classList.add('active');
    }
  });

  const map = { cashin: 'tabCashin', cashout: 'tabCashout', topup: 'tabTopup', demo: 'tabDemo', promo: 'tabPromo', history: 'tabHistory' };
  Object.values(map).forEach(id => {
    const p = document.getElementById(id);
    if (p) p.className = 'tab-panel' + (id === map[tab] ? ' active' : '');
  });

  if (tab === 'history') renderTxnHistory();
  if (tab === 'promo') renderRedeemedCodes();
  if (tab === 'topup') renderTopUpRedeemed();
}

function setCashinAmt(amt) {
  document.getElementById('cashinAmount').value = amt;
  document.querySelectorAll('#tabCashin .quick-amt').forEach(el => el.classList.remove('selected'));
  if (event && event.target) event.target.classList.add('selected');
}

function setCashoutAmt(amt) {
  if (amt === 0) amt = Math.floor(Wallet.getReal());
  document.getElementById('cashoutAmount').value = amt;
}

// Store uploaded file globally
let _uploadedProofFile = null;

function handleProofUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    Toast.show('⚠️', 'Invalid File', 'Please upload an image file (JPG, PNG)', 'error');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    Toast.show('⚠️', 'File Too Large', 'Maximum file size is 10MB', 'error');
    return;
  }

  _uploadedProofFile = file;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('proofPreview');
    const uploadIcon = document.getElementById('uploadIcon');
    const uploadText = document.getElementById('uploadText');
    const uploadSub = document.getElementById('uploadSub');
    const uploadArea = document.getElementById('uploadArea');
    const submitBtn = document.getElementById('submitDepositBtn');
    
    preview.src = e.target.result;
    preview.style.display = 'block';
    uploadIcon.textContent = '✅';
    uploadText.textContent = file.name;
    uploadSub.textContent = `${(file.size / 1024).toFixed(1)} KB — Click to change`;
    uploadArea.classList.add('has-file');
    submitBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

function processCashIn() {
  if (!Auth.isLoggedIn()) {
    Toast.show('🔒', 'Login Required', 'Please login to deposit real money', 'error');
    closeDepositModal();
    openAuthModal();
    return;
  }

  const amt = parseFloat(document.getElementById('cashinAmount').value);
  if (!amt || amt < CONFIG.MIN_DEPOSIT) {
    shakeEl(document.getElementById('cashinAmount'));
    Toast.show('⚠️', 'Invalid Amount', `Minimum cash-in is ₱${CONFIG.MIN_DEPOSIT}`, 'error');
    return;
  }
  
  const ref = generateRefCode();
  document.getElementById('cashinRefCode').textContent = ref;
  const refStep = document.getElementById('refCodeStep');
  if (refStep) refStep.textContent = ref;
  document.getElementById('cashinInstructions').style.display = 'block';
  document.getElementById('cashinProceedBtn').style.display = 'none';
  
  // Store pending info
  localStorage.setItem('scatter_pending_cashin', JSON.stringify({ ref, amount: amt, time: Date.now() }));
  SFX.play('click');
}

async function submitDeposit() {
  if (!_uploadedProofFile) {
    Toast.show('⚠️', 'No Screenshot', 'Please upload your GCash receipt screenshot', 'error');
    return;
  }

  const pending = JSON.parse(localStorage.getItem('scatter_pending_cashin') || 'null');
  if (!pending) {
    Toast.show('⚠️', 'No Pending Request', 'Please enter an amount first', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitDepositBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Sending to verification...';

  // Send to Discord webhook
  const result = await sendToDiscordWebhook(_uploadedProofFile, {
    amount: pending.amount,
    refCode: pending.ref
  });

  if (result.success) {
    // Record as pending deposit
    const currentUser = Auth.getCurrentUser();
    const currentUserId = Auth.getCurrentUserId() || 'unknown_' + Date.now();
    const depositData = {
      id: pending.ref,
      amount: pending.amount,
      status: 'pending',
      date: new Date().toISOString(),
      proofSent: true,
      userId: currentUserId,
      userName: currentUser ? currentUser.displayName : 'Unknown',
      userIdentifier: currentUser ? currentUser.identifier : 'N/A'
    };
    console.log('[Deposit] Submitting deposit:', depositData.id, '₱' + depositData.amount, 'userId:', currentUserId);

    Auth.addPendingDeposit(depositData);

    // Save to cloud database so admin can see from any device
    let cloudSaved = false;
    if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.saveDeposit) {
      try {
        cloudSaved = await CloudDB.saveDeposit(depositData);
        if (cloudSaved) {
          console.log('[Deposit] ✅ Saved to cloud database:', depositData.id);
        } else {
          console.error('[Deposit] ❌ Cloud save returned false for:', depositData.id);
          Toast.show('⚠️', 'Cloud Save Failed', 'Deposit saved locally but not to cloud. Admin may not see it from other devices.', 'error', 5000);
        }
      } catch (e) {
        console.error('[Deposit] ❌ Cloud save error:', e);
        Toast.show('⚠️', 'Cloud Error', 'Deposit saved locally but cloud sync failed: ' + e.message, 'error', 5000);
      }
    } else {
      console.warn('[Deposit] CloudDB not available — deposit saved locally only');
    }
    
    Wallet.addTxn('deposit_pending', pending.amount, 'GCash', 'pending', { ref: pending.ref });
    
    localStorage.removeItem('scatter_pending_cashin');
    _uploadedProofFile = null;

    Toast.show('📤', 'Deposit Submitted!', `₱${pending.amount.toLocaleString()} deposit is being verified. Credits will be added once approved.${cloudSaved ? ' ☁️' : ''}`, 'success', 6000);
    SFX.play('deposit');
    closeDepositModal();
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = '📤 Submit Deposit for Verification';
    Toast.show('❌', 'Submission Failed', result.error || 'Please try again', 'error');
  }
}

function processCashOut() {
  if (!Auth.isLoggedIn()) {
    Toast.show('🔒', 'Login Required', 'Please login to withdraw', 'error');
    return;
  }

  const num = document.getElementById('cashoutGcashNum').value.trim();
  const name = document.getElementById('cashoutName').value.trim();
  const amt = parseFloat(document.getElementById('cashoutAmount').value);

  if (!num || num.replace(/\s/g, '').length < 11) {
    shakeEl(document.getElementById('cashoutGcashNum'));
    Toast.show('⚠️', 'Invalid Number', 'Enter a valid 11-digit GCash number', 'error');
    return;
  }
  if (!name || name.length < 2) {
    shakeEl(document.getElementById('cashoutName'));
    Toast.show('⚠️', 'Missing Name', 'Enter the GCash account name', 'error');
    return;
  }
  if (!amt || amt < CONFIG.MIN_WITHDRAW) {
    shakeEl(document.getElementById('cashoutAmount'));
    Toast.show('⚠️', 'Invalid Amount', `Minimum withdrawal is ₱${CONFIG.MIN_WITHDRAW}`, 'error');
    return;
  }
  
  const fee = amt * CONFIG.WITHDRAW_FEE;
  const total = amt + fee;
  const realBal = Wallet.getReal();
  
  if (total > realBal) {
    shakeEl(document.getElementById('cashoutAmount'));
    Toast.show('⚠️', 'Insufficient Real Balance', `Need ${Wallet.fmt(total)} (includes ₱${fee.toFixed(2)} fee). Your real balance: ${Wallet.fmt(realBal)}`, 'error');
    return;
  }

  const user = Auth.getCurrentUser();

  // Process withdrawal from real balance
  Auth.subtractBalance(total, 'real');
  Wallet.addTxn('cashout', amt, 'GCash → ' + num, 'processing');

  // Send withdrawal request to Discord
  sendWithdrawalToDiscord(name, num, amt, fee);

  // Save withdrawal to cloud database (so admin can see from any device)
  const withdrawalData = {
    id: 'wd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: user ? user.id : 'unknown',
    userName: user ? user.displayName : 'Unknown',
    userIdentifier: user ? user.identifier : 'N/A',
    gcashNumber: num,
    gcashName: name,
    amount: amt,
    fee: fee,
    total: total,
    status: 'pending',
    date: new Date().toISOString()
  };
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.saveWithdrawal) {
    CloudDB.saveWithdrawal(withdrawalData);
  }

  document.getElementById('cashoutGcashNum').value = '';
  document.getElementById('cashoutName').value = '';
  document.getElementById('cashoutAmount').value = '';

  Toast.show('💸', 'Withdrawal Submitted!', `₱${amt.toLocaleString()} will be sent to ${num} within 5-30 mins`, 'success', 6000);
  SFX.play('cashout');
  Wallet._broadcast();
  closeDepositModal();
}

async function sendWithdrawalToDiscord(name, number, amount, fee) {
  const user = Auth.getCurrentUser();
  const payload = {
    content: `**💸 WITHDRAWAL REQUEST**\n👤 Player: **${user ? user.displayName : 'Unknown'}** (${user ? user.identifier : 'N/A'})\n📱 GCash: **${number}** (${name})\n💰 Amount: **₱${amount.toLocaleString()}** (Fee: ₱${fee.toFixed(2)})\n🆔 User ID: \`${user ? user.id : 'N/A'}\``,
    embeds: [{
      title: '💸 Withdrawal Request',
      color: 0xf5c842,
      fields: [
        { name: '👤 Player', value: user ? user.displayName : 'Unknown', inline: true },
        { name: '📱 GCash Number', value: number, inline: true },
        { name: '📛 GCash Name', value: name, inline: true },
        { name: '💰 Amount', value: `₱${amount.toLocaleString()}`, inline: true },
        { name: '💳 Fee', value: `₱${fee.toFixed(2)}`, inline: true },
        { name: '📅 Date', value: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }), inline: true },
      ],
      footer: { text: 'ScatterX Gaming — Withdrawal Request' },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    await fetch(CONFIG.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Failed to send withdrawal to Discord:', err);
  }
}

function addDemoCredits() {
  const amt = parseFloat(document.getElementById('demoAmount').value);
  if (!amt || amt < 1) {
    shakeEl(document.getElementById('demoAmount'));
    return;
  }
  
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    Auth.addBalance(amt, 'demo');
  } else {
    Wallet.addDemo(amt);
  }
  
  Wallet.addTxn('demo', amt, 'Demo Credits', 'success');
  Toast.show('🎮', 'Demo Credits Added!', `${Wallet.fmt(amt)} demo credits added (not real money)`, 'success');
  SFX.play('gem');
  FX.fireworks();
  Wallet._broadcast();
  closeDepositModal();
}

function resetDemoBalance() {
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    Auth.setBalance(CONFIG.DEMO_DEFAULT, 'demo');
  } else {
    Wallet.reset();
  }
  Wallet.addTxn('demo', CONFIG.DEMO_DEFAULT, 'Balance Reset', 'success');
  Toast.show('🔄', 'Demo Balance Reset', `Demo balance reset to ₱${CONFIG.DEMO_DEFAULT.toLocaleString()}`, 'info');
  Wallet._broadcast();
  closeDepositModal();
}

function renderTxnHistory() {
  const list = document.getElementById('txnList');
  if (!list) return;
  const txns = Wallet.getTxns();
  if (!txns.length) {
    list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:.82rem">No transactions yet</div>';
    return;
  }
  list.innerHTML = txns.map(t => {
    const iconMap = { cashin: '📥', cashout: '📤', demo: '🎮', deposit_pending: '⏳', deposit_approved: '✅', promo: '🎁' };
    const icon = iconMap[t.type] || '📋';
    const iconClass = t.type.includes('cashin') || t.type.includes('deposit') ? 'cashin' : t.type === 'cashout' ? 'cashout' : t.type === 'promo' ? 'cashin' : 'demo';
    const labelMap = { cashin: 'Cash In', cashout: 'Cash Out', demo: 'Demo Credit', deposit_pending: 'Deposit (Pending)', deposit_approved: 'Deposit (Approved)', promo: 'Promo Code' };
    const label = labelMap[t.type] || t.type;
    const sign = t.type === 'cashout' ? '-' : '+';
    const amtClass = t.type === 'cashout' ? 'negative' : 'positive';
    const statusBadge = t.status === 'pending' ? '<span class="txn-status pending">PENDING</span>' : 
                        t.status === 'processing' ? '<span class="txn-status processing">PROCESSING</span>' : '';
    const date = new Date(t.date);
    const dateStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="txn-item">
        <div class="txn-left">
          <div class="txn-icon ${iconClass}">${icon}</div>
          <div>
            <div class="txn-type">${label} ${statusBadge}</div>
            <div class="txn-date">${dateStr} · ${t.method || ''}</div>
          </div>
        </div>
        <div class="txn-amount ${amtClass}">${sign}${Wallet.fmt(t.amount)}</div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   PROMO CODE SYSTEM
   ============================================================ */
const PROMO_STORAGE_KEY = 'scatterx_promo_codes';
const PROMO_REDEMPTIONS_KEY = 'scatterx_promo_redemptions';

function getPromoCodes() {
  try { return JSON.parse(localStorage.getItem(PROMO_STORAGE_KEY)) || []; }
  catch { return []; }
}
function savePromoCodes(codes) {
  localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(codes));
}
function getRedemptions() {
  try { return JSON.parse(localStorage.getItem(PROMO_REDEMPTIONS_KEY)) || []; }
  catch { return []; }
}
function saveRedemptions(r) {
  localStorage.setItem(PROMO_REDEMPTIONS_KEY, JSON.stringify(r));
}

/* ============================================================
   TOP-UP CODE REDEMPTION (user-side)
   ============================================================ */
const TOPUP_REDEEMED_KEY = 'scatterx_topup_redeemed';

function getTopUpRedeemed() {
  try { return JSON.parse(localStorage.getItem(TOPUP_REDEEMED_KEY)) || []; }
  catch { return []; }
}
function saveTopUpRedeemed(list) {
  localStorage.setItem(TOPUP_REDEEMED_KEY, JSON.stringify(list));
}

function redeemTopUpCode() {
  const inp = document.getElementById('topupCodeInput');
  const resultDiv = document.getElementById('topupRedeemResult');
  if (!inp || !resultDiv) return;

  const code = inp.value.trim();
  if (!code) {
    showTopUpResult(resultDiv, 'error', '⚠️ Please paste a top-up code.');
    return;
  }

  if (!code.startsWith('SX-')) {
    showTopUpResult(resultDiv, 'error', '❌ Invalid code format. Codes start with "SX-"');
    return;
  }

  // Check login
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) {
    showTopUpResult(resultDiv, 'error', '⚠️ You must be logged in to redeem codes.');
    return;
  }

  // Decode using auth.js function
  const payload = decodeTopUpCode(code);
  if (!payload) {
    showTopUpResult(resultDiv, 'error', '❌ Invalid or tampered code. Please check and try again.');
    return;
  }

  // Check user ID matches
  const currentUserId = Auth.getCurrentUserId();
  if (payload.u !== currentUserId) {
    showTopUpResult(resultDiv, 'error', '🚫 This code was generated for a different user account.');
    return;
  }

  // Check if already redeemed
  const redeemed = getTopUpRedeemed();
  if (redeemed.find(r => r.code === code)) {
    showTopUpResult(resultDiv, 'error', '⚠️ This code has already been redeemed.');
    return;
  }

  // Check code age (expire after 30 days)
  const codeAge = Date.now() - payload.ts;
  if (codeAge > 30 * 24 * 60 * 60 * 1000) {
    showTopUpResult(resultDiv, 'error', '⏰ This code has expired (older than 30 days).');
    return;
  }

  // Apply the top-up
  const amount = parseFloat(payload.a) || 0;
  const type = payload.t || 'real';

  if (amount <= 0) {
    showTopUpResult(resultDiv, 'error', '❌ Invalid code amount.');
    return;
  }

  if (type === 'real') {
    Wallet.addReal(amount);
  } else {
    Wallet.addDemo(amount);
  }

  // Record redemption
  redeemed.unshift({
    code: code,
    amount: amount,
    type: type,
    redeemedAt: new Date().toISOString()
  });
  saveTopUpRedeemed(redeemed);

  // Update user data
  const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
  const user = users[currentUserId];
  if (user) {
    if (type === 'real') {
      user.realBalance = (user.realBalance || 0) + amount;
      user.totalDeposited = (user.totalDeposited || 0) + amount;
    } else {
      user.demoBalance = (user.demoBalance || 0) + amount;
    }
    const txns = user.transactions || [];
    txns.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'topup_redeemed',
      amount: amount,
      method: 'Admin Top-Up (' + type + ')',
      status: 'success',
      date: new Date().toISOString()
    });
    user.transactions = txns;
    users[currentUserId] = user;
    localStorage.setItem('scatterx_users', JSON.stringify(users));
  }

  const typeIcon = type === 'real' ? '💰' : '🎮';
  const typeLabel = type === 'real' ? 'Real Money' : 'Demo Credits';

  showTopUpResult(resultDiv, 'success', `✅ ${typeIcon} ₱${amount.toLocaleString()} ${typeLabel} added to your account!`);
  inp.value = '';

  Toast.show('🎉', 'Top-Up Redeemed!', `₱${amount.toLocaleString()} ${typeLabel} added to your balance`, 'success', 5000);
  if (typeof SFX !== 'undefined') SFX.play('deposit');
  if (typeof FX !== 'undefined') FX.fireworks();

  // Refresh displays
  if (typeof updateAuthUI === 'function') updateAuthUI();
  renderTopUpRedeemed();
  Wallet._broadcast();
}

function showTopUpResult(el, type, msg) {
  el.style.display = 'block';
  el.innerHTML = `<div style="background:${type === 'success' ? 'rgba(56,239,125,.08)' : 'rgba(255,59,92,.08)'};border:1px solid ${type === 'success' ? 'rgba(56,239,125,.3)' : 'rgba(255,59,92,.3)'};border-radius:8px;padding:10px;font-size:.78rem;color:${type === 'success' ? 'var(--gem)' : '#ff5252'};text-align:center">${msg}</div>`;
}

function renderTopUpRedeemed() {
  const el = document.getElementById('topupRedeemedList');
  if (!el) return;

  const redeemed = getTopUpRedeemed();
  if (!redeemed.length) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--muted);font-size:.75rem">No top-ups redeemed yet</div>`;
    return;
  }

  el.innerHTML = redeemed.slice(0, 20).map(r => {
    const typeIcon = r.type === 'real' ? '💰' : '🎮';
    const date = new Date(r.redeemedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:.72rem;color:var(--text)">${typeIcon} ₱${(r.amount || 0).toLocaleString()}</div>
        <div style="font-size:.6rem;color:var(--muted)">${date}</div>
      </div>
      <span style="font-size:.6rem;font-weight:700;color:var(--gem);background:rgba(56,239,125,.1);padding:2px 6px;border-radius:4px">REDEEMED</span>
    </div>`;
  }).join('');
}

async function redeemPromoCode() {
  const inp = document.getElementById('promoCodeInput');
  const resultDiv = document.getElementById('promoResult');
  if (!inp || !resultDiv) return;

  const code = inp.value.trim().toUpperCase();
  if (!code) {
    showPromoResult(resultDiv, 'error', '⚠️ Please enter a promo code.');
    return;
  }

  const user = Auth.isLoggedIn() ? Auth.getCurrentUser() : null;
  if (!user) {
    showPromoResult(resultDiv, 'error', '⚠️ You must be logged in to redeem codes.');
    return;
  }

  // Merge local + cloud promo codes so codes created on another device work
  let promoCodes = getPromoCodes();
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.getAllPromoCodes) {
    try {
      const cloudCodes = await CloudDB.getAllPromoCodes();
      const localMap = {};
      promoCodes.forEach(c => { localMap[c.id] = c; });
      cloudCodes.forEach(c => {
        if (localMap[c.id]) {
          // cloud wins for usedCount (higher = more accurate)
          if ((c.usedCount || 0) > (localMap[c.id].usedCount || 0)) localMap[c.id].usedCount = c.usedCount;
          if (c.active === false) localMap[c.id].active = false;
        } else {
          promoCodes.push(c);
        }
      });
      savePromoCodes(promoCodes);
    } catch (e) {}
  }

  const promo = promoCodes.find(p => p.code === code && p.active);

  if (!promo) {
    showPromoResult(resultDiv, 'error', '❌ Invalid or inactive promo code.');
    return;
  }

  // Check expiration
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    showPromoResult(resultDiv, 'error', '⏰ This promo code has expired.');
    return;
  }

  // Check max uses
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    showPromoResult(resultDiv, 'error', '🚫 This promo code has reached its usage limit.');
    return;
  }

  // Check if user already redeemed (local check)
  let redemptions = getRedemptions();
  let alreadyRedeemed = redemptions.find(r => r.code === code && r.userId === user.id);

  // Also check cloud to prevent cross-device duplicate redemptions
  if (!alreadyRedeemed && typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.getUserRedemptions) {
    try {
      const cloudUserRedemptions = await CloudDB.getUserRedemptions(user.id);
      alreadyRedeemed = cloudUserRedemptions.find(r => r.code === code);
    } catch (e) {}
  }

  if (alreadyRedeemed) {
    showPromoResult(resultDiv, 'error', '⚠️ You have already redeemed this code.');
    return;
  }

  // Apply the promo
  const amount = parseFloat(promo.amount) || 0;
  if (amount <= 0) {
    showPromoResult(resultDiv, 'error', '❌ Invalid promo code amount.');
    return;
  }

  if (promo.type === 'real') {
    Wallet.addReal(amount);
  } else {
    Wallet.addDemo(amount);
  }

  // Record redemption
  const redemptionRecord = {
    code: code,
    userId: user.id,
    username: user.displayName || user.username,
    amount: amount,
    type: promo.type,
    redeemedAt: new Date().toISOString()
  };
  redemptions.push(redemptionRecord);
  saveRedemptions(redemptions);

  // Save redemption to cloud
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.saveRedemption) {
    CloudDB.saveRedemption(redemptionRecord);
  }

  // Update usage count
  promo.usedCount = (promo.usedCount || 0) + 1;
  savePromoCodes(promoCodes);

  // Update promo in cloud with new usedCount
  if (typeof CloudDB !== 'undefined' && CloudDB.available() && CloudDB.savePromoCode) {
    CloudDB.savePromoCode(promo);
  }

  // Record as transaction
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    const users = JSON.parse(localStorage.getItem('scatterx_users') || '{}');
    const curUser = users[user.id];
    if (curUser) {
      if (!curUser.transactions) curUser.transactions = [];
      curUser.transactions.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'promo',
        amount: amount,
        method: 'Promo Code: ' + code + ' (' + promo.type + ')',
        status: 'success',
        date: new Date().toISOString()
      });
      localStorage.setItem('scatterx_users', JSON.stringify(users));
    }
  }

  // Show success
  const typeLabel = promo.type === 'real' ? 'Real Balance' : 'Demo Balance';
  showPromoResult(resultDiv, 'success', `🎉 Code redeemed! +₱${Wallet.fmt(amount)} added to ${typeLabel}`);
  inp.value = '';
  Wallet.refreshUI();
  renderRedeemedCodes();
  showToast(`🎁 Promo code ${code} redeemed! +₱${Wallet.fmt(amount)}`, 'success');
}

function showPromoResult(el, type, msg) {
  el.style.display = 'block';
  el.style.padding = '12px';
  el.style.borderRadius = '10px';
  el.style.fontSize = '.84rem';
  el.style.fontWeight = '600';
  el.style.textAlign = 'center';
  if (type === 'success') {
    el.style.background = 'rgba(0,200,100,.15)';
    el.style.color = '#38ef7d';
    el.style.border = '1px solid rgba(0,200,100,.3)';
  } else {
    el.style.background = 'rgba(255,60,60,.15)';
    el.style.color = '#ff5252';
    el.style.border = '1px solid rgba(255,60,60,.3)';
  }
  el.textContent = msg;
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function renderRedeemedCodes() {
  const el = document.getElementById('redeemedList');
  if (!el) return;

  const user = JSON.parse(localStorage.getItem('scatterx_user') || 'null');
  if (!user) { el.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:.78rem;padding:10px">Login to see redeemed codes</div>'; return; }

  const redemptions = getRedemptions().filter(r => r.userId === user.id);
  if (!redemptions.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:.78rem;padding:10px">No codes redeemed yet</div>';
    return;
  }

  el.innerHTML = redemptions.map(r => {
    const d = new Date(r.redeemedAt);
    const dateStr = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const typeIcon = r.type === 'real' ? '💰' : '🎮';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--card2);border-radius:8px;margin-bottom:6px">
        <div>
          <div style="font-size:.82rem;font-weight:700;color:var(--text);font-family:'Orbitron',sans-serif;letter-spacing:1px">${typeIcon} ${r.code}</div>
          <div style="font-size:.7rem;color:var(--text2)">${dateStr}</div>
        </div>
        <div style="font-size:.84rem;font-weight:700;color:#38ef7d">+₱${Wallet.fmt(r.amount)}</div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   NAV HTML INJECTION (for game pages)
   ============================================================ */
function injectNav(activePage) {
  const pages = [
    { href: '../games/mines.html', name: 'Mines', icon: 'mines' },
    { href: '../games/scatter.html', name: 'Slots', icon: 'slots' },
    { href: '../games/crash.html', name: 'Crash', icon: 'crash' },
    { href: '../games/plinko.html', name: 'Plinko', icon: 'plinko' },
    { href: '../games/roulette.html', name: 'Roulette', icon: 'roulette' },
    { href: '../games/color.html', name: 'Dice', icon: 'color' },
    { href: '../games/tower.html', name: 'Tower', icon: 'tower' },
  ];
  const links = pages.map(p =>
    `<a class="nav-link${p.name === activePage ? ' active' : ''}" href="${p.href}">${gameIcon(p.icon, 'sm')} ${p.name}</a>`
  ).join('');
  return `
  <nav class="nav">
    <a href="../index.html" class="nav-logo">SCATTER<span>X</span></a>
    <div class="nav-links">${links}</div>
    <button class="nav-hamburger" onclick="toggleMobileMenu()">
      <span></span><span></span><span></span>
    </button>
    <div class="nav-right">
      <div class="nav-balance" onclick="openDepositModal()">
        <span class="bal-icon" style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f5c842,#e8984a);border-radius:50%;font-size:.6rem;color:#06070d;font-weight:900">₱</span>
        <div><div class="bal-lbl">Balance</div><div class="bal-val">₱0.00</div></div>
      </div>
      <button class="nav-deposit-btn" onclick="openDepositModal()">+ DEPOSIT</button>
    </div>
  </nav>
  <div class="mobile-menu">
    ${pages.map(p => `<a class="nav-link${p.name === activePage ? ' active' : ''}" href="${p.href}">${gameIcon(p.icon, 'sm')} ${p.name}</a>`).join('')}
    <div class="mobile-actions">
      <button class="btn-gcash" onclick="openDepositModal();toggleMobileMenu()">Cash In via GCash</button>
      <button class="btn-gold" onclick="openDepositModal();switchWalletTab('cashout');toggleMobileMenu()">Cash Out</button>
    </div>
  </div>`;
}
