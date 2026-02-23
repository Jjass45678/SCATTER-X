# ScatterX — Play & Win Real Money via GCash

Premium casino gaming platform with 5 provably fair games. Features dual currency system (demo credits + real money), GCash integration with Discord webhook verification, and full authentication system.

## 🎮 Features

### Authentication System
- **Login/Register** with email (Gmail) or phone number (09XXXXXXXXX)
- Password-protected accounts with display names
- User profiles with avatars, levels, and XP system
- Persistent sessions via localStorage
- Profile dropdown with balance overview and stats

### Dual Currency System
- **Demo Credits** — Free play money for practice (₱1,000 on registration)
  - Unlimited free credits
  - Cannot be withdrawn
  - Not real money
- **Real Money** — Deposit via GCash, win real cash
  - Deposit via GCash with screenshot verification
  - Withdraw winnings to GCash
  - Completely separate from demo credits

### GCash Integration
- **Cash In**: Send money to designated GCash number
- **Screenshot Upload**: Upload GCash receipt as proof of payment
- **Discord Webhook**: Receipt screenshots sent to Discord for admin verification
- **Admin Approval**: Admin replies "YES" on Discord to approve deposits
- **Cash Out**: Withdraw real money winnings to your GCash account
- **Transaction History**: Full history of all deposits, withdrawals, and demo credits

### Discord Webhook Verification
- Deposit screenshots automatically sent to Discord channel
- Rich embed with player info, amount, reference code
- Admin can verify and approve deposits
- Withdrawal requests also sent to Discord for processing

### Games (5 Premium Games)
1. **💣 Mines** — Navigate a 5×5 minefield, reveal gems, avoid mines
2. **🎰 Scatter Slots** — 5-reel slots with Scatters, Wilds & free spins
3. **📈 Crash** — Rocket multiplier climbs, cash out before it crashes
4. **🎯 Plinko** — Drop balls through pegs into multiplier slots
5. **🎡 Roulette** — European roulette with numbers, colours, dozens

### UI/UX Improvements
- Responsive design for all screen sizes
- Dark theme with neon accents
- Animated ticker with live wins
- Toast notifications for all actions
- Particle effects and fireworks on wins
- Sound effects for all game actions
- Profile dropdown with stats and quick actions
- Balance mode toggle (Demo/Real) in navigation
- Welcome banner for logged-in users
- Promotions section with welcome bonus info
- Dual currency comparison cards

## 🛠 Tech Stack

- **Frontend**: Pure HTML, CSS, JavaScript (no frameworks)
- **Storage**: localStorage for user data and sessions
- **Payments**: GCash integration with manual verification
- **Notifications**: Discord Webhooks for deposit/withdrawal alerts
- **Audio**: Web Audio API for sound effects
- **Animations**: CSS animations + JavaScript particle system

## 📁 Project Structure

```
SCATTER PROJECT/
├── index.html          # Homepage with hero, games grid, promotions
├── README.md           # This file
├── css/
│   └── shared.css      # Global styles, components, responsive design
├── js/
│   ├── auth.js         # Authentication system (login/register/profile)
│   └── wallet.js       # Wallet, GCash, Discord webhook, utilities
└── games/
    ├── mines.html      # Mines game
    ├── scatter.html    # Scatter Slots game
    ├── crash.html      # Crash game
    ├── plinko.html     # Plinko game
    └── roulette.html   # Roulette game
```

## ⚙️ Configuration

Edit the `CONFIG` object in `js/wallet.js` to customize:

```javascript
const CONFIG = {
  GCASH_NUMBER: '0917 123 4567',        // Your GCash number
  GCASH_NAME: 'ScatterX Gaming',         // Display name
  DISCORD_WEBHOOK: 'https://discord...',  // Your Discord webhook URL
  MIN_DEPOSIT: 50,                        // Minimum deposit amount
  MIN_WITHDRAW: 100,                      // Minimum withdrawal amount
  WITHDRAW_FEE: 0.02,                     // 2% withdrawal fee
  DEMO_DEFAULT: 1000                      // Default demo credits
};
```

## 🔄 How Deposits Work

1. User logs in and opens the Wallet → Cash In tab
2. Selects amount and clicks "Proceed with GCash"
3. GCash number and reference code are displayed
4. User sends money via GCash app
5. User takes a screenshot of the GCash receipt
6. User uploads the screenshot in the deposit form
7. Screenshot is sent to Discord webhook with player info
8. Admin sees the deposit request on Discord
9. Admin replies "YES" to approve the deposit
10. Real money credits are added to the user's account

## 🔄 How Withdrawals Work

1. User opens Wallet → Cash Out tab
2. Enters GCash number, name, and amount
3. Withdrawal request is sent to Discord webhook
4. Admin processes the withdrawal manually
5. Money is sent to user's GCash account

## 🎯 Game Features

All games support:
- Bet amount selection with quick buttons (½, 2×, Min, Max)
- Real-time balance updates
- Win/lose overlays with animations
- Sound effects
- Works with both demo credits and real money

## 📱 Responsive Design

- Desktop: Full layout with sidebar controls
- Tablet: Stacked layout
- Mobile: Compact layout with hamburger menu

## ⚠️ Disclaimer

This is a demo/educational project. Gambling involves risk. Play responsibly. Must be 18+ to play. Demo credits are for practice only and have no real value.
