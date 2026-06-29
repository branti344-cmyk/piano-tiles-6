# 🎹 Piano Tiles 6

A fully functional beat-synced piano tiles rhythm game featuring **Juice WRLD** and **Toxic Lyrikali** albums, with the ability to add custom songs that auto-generate tiles from their beat patterns.

---

## 📁 File Structure

```
piano-tiles-6/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← GitHub Actions CI/CD → GitHub Pages
├── .vscode/
│   ├── settings.json           ← vscodroid editor settings
│   ├── launch.json             ← Debug launch config
│   └── tasks.json              ← npm tasks (dev/build/deploy)
├── public/
│   └── index.html              ← HTML entry point
├── src/
│   ├── data/
│   │   └── songs.js            ← Default song library (Juice WRLD + Toxic Lyrikali)
│   ├── utils/
│   │   ├── audioEngine.js      ← Web Audio API engine + beat scheduler
│   │   ├── tileEngine.js       ← Tile generation, physics, hit detection
│   │   └── db.js               ← LocalStorage database (songs, scores, settings)
│   ├── styles/
│   │   └── main.css            ← Full dark neon theme
│   └── main.js                 ← App controller, game loop, UI rendering
├── package.json
├── vite.config.js
└── README.md
```

---

## 🎮 Features

| Feature | Detail |
|---|---|
| **Song Library** | 20 default songs across 6 albums (Juice WRLD + Toxic Lyrikali) |
| **Beat-Synced Tiles** | Tiles spawn in sync with each song's BPM + 16-step beat pattern |
| **Web Audio Engine** | Real-time synthesis — no audio files needed |
| **Add Custom Songs** | Full form: title, artist, BPM, key, color, beat pattern editor, melody notes |
| **Score System** | Perfect / Great / Good timing + combo multipliers (×1.5 → ×4) |
| **Star Rating** | 1–3 stars based on accuracy + max combo |
| **Lives System** | 5 lives, lose one per missed tile |
| **Bomb Tiles** | Avoid bomb tiles (spawn at high BPM/combos) |
| **Unlock System** | Complete songs with 2+ stars to unlock next song |
| **Persistence** | All scores, unlocks, and custom songs saved to LocalStorage |
| **Settings** | Volume, SFX, tile speed (1–10), lane count (2–6), particles toggle |
| **Keyboard** | ASDF / Arrow keys support for desktop play |
| **Particles** | Hit effect burst animations |
| **PWA-ready** | Mobile-first, touch-optimized, viewport locked |

---

## 🚀 Development Setup (vscodroid + GitHub)

### Step 1 — Install vscodroid (Android)
1. Open Play Store → search **"vscodroid"** and install
2. Open vscodroid → tap **"Open Folder"**

### Step 2 — Clone the Repository
Option A — Use the vscodroid terminal:
```bash
# In vscodroid terminal (tap the terminal icon)
pkg install nodejs git    # first time only
git clone https://github.com/YOUR_USERNAME/piano-tiles-6.git
cd piano-tiles-6
npm install
```

Option B — GitHub Desktop (or any Git client) then open folder in vscodroid.

### Step 3 — Run Development Server
```bash
npm run dev
```
- Opens at `http://localhost:5173`
- Also accessible on your LAN: `http://YOUR_LAN_IP:5173`
- Open in your phone browser for live preview
- Hot-reloads on file save ✅

### Step 4 — Open in vscodroid
- File → Open Folder → select `piano-tiles-6/`
- All VSCode keyboard shortcuts work
- Tap the **Run** button or use `Ctrl+Shift+P` → `Tasks: Run Task` → `npm: dev`

---

## 📦 Deployment

### Option A — GitHub Pages (Automatic CI/CD)

1. **Create GitHub repo**:
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/piano-tiles-6.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

2. **Enable GitHub Pages**:
   - Go to repo → **Settings** → **Pages**
   - Source: **GitHub Actions**

3. **Push to main** → GitHub Actions automatically:
   - Builds with Vite
   - Deploys to `https://YOUR_USERNAME.github.io/piano-tiles-6/`

### Option B — Manual Deploy
```bash
npm run deploy     # builds + pushes to gh-pages branch
```

### Option C — Local Production Preview
```bash
npm run build      # outputs to /dist
npm run preview    # serves dist at localhost:4173
```

---

## 🎵 Adding Custom Songs

### In-App (Recommended)
1. Open the game → **Play** → tap the **＋ (FAB)** button
2. Fill in:
   - **Title** and **Artist** (required)
   - **BPM** (40–300) — controls tile spawn speed
   - **Beat Pattern** — 16 cells = 16th notes per bar, click to toggle on/off
   - **Melody Notes** — comma-separated (e.g. `A4,C5,E5,G5,A5`)
   - **Tile Color**, **Difficulty**, **Key**, **Duration**
3. Tap **Add Song** — instantly appears in your library

### Via Code (src/data/songs.js)
```js
{
  id: "my_song_1",           // unique ID
  artist: "My Artist",
  album: "My Album",
  albumYear: 2024,
  title: "My Song",
  bpm: 120,                  // tiles spawn at this rate
  key: "Am",
  durationSec: 180,
  difficulty: "medium",      // easy | medium | hard
  color: "#8B5CF6",          // tile color + glow
  beatPattern: [             // 16 sixteenth-note steps
    1,0,0,1, 0,1,0,0,
    1,0,0,1, 0,0,1,0
  ],
  melodyNotes: [             // played when tiles are hit
    "A4","C5","E5","G5","A5","G5","E5","C5"
  ],
  cover: null,
  unlocked: true,
}
```

---

## 🗄️ Database / LocalStorage Schema

All data persists in the browser's LocalStorage under these keys:

| Key | Contents |
|---|---|
| `pt6_songs` | (not used — songs are in code) |
| `pt6_custom_songs` | Array of user-added custom songs |
| `pt6_scores` | `{ [songId]: { best, accuracy, maxCombo, stars, playedAt, totalPlays } }` |
| `pt6_settings` | `{ volume, sfxVolume, tileSpeed, laneCount, showParticles }` |
| `pt6_unlocks` | `{ [songId]: true }` — per-song unlock flags |

To inspect: DevTools → Application → Local Storage.
To reset: Settings screen → "Reset All Scores", or call `resetAllData()` from `db.js`.

---

## 🎹 Beat-Sync Architecture

```
Song BPM (e.g. 120)
    │
    ▼
audioEngine.startBeat()
    │ setInterval at (60/BPM * 1000) / 4 ms  ← 16th-note resolution
    │
    ├─ beatPattern[step] === 1?
    │       YES → spawn tile (generateTileFromBeat)
    │             play backing melody note softly
    │       NO  → skip frame
    │
    ▼
gameLoop (requestAnimationFrame)
    ├─ updateTiles() — move tiles down at speed × delta
    ├─ detectMissedTiles() — penalize skipped tiles
    ├─ drawGame() — Canvas 2D render
    └─ updateHUD()
```

---

## 🎮 Controls

| Input | Action |
|---|---|
| Tap lane | Hit tile |
| `A S D F` | Hit lanes 1 2 3 4 |
| `Arrow Keys` | Hit lanes 1 2 3 4 |
| `Space / Esc` | Pause / Resume |

---

## 🏆 Scoring

| Timing | Base Points | Trigger |
|---|---|---|
| ✦ PERFECT | 100 | Center of hit zone ±30% |
| GREAT | 70 | ±65% |
| GOOD | 40 | Edge of zone |
| MISS | 0 | Tile exits without hit |

**Combo Multipliers:**
- ×1 (combo 0–4)
- ×1.5 (combo 5–14)
- ×2 (combo 15–29)
- ×3 (combo 30–49)
- ×4 (combo 50+)

**Star Ratings:**
- ⭐⭐⭐ — Accuracy ≥95% + combo ≥90% of notes
- ⭐⭐ — Accuracy ≥75%
- ⭐ — Accuracy ≥40%

---

## 📱 Mobile Tips (vscodroid)

- Run `npm run dev` in the vscodroid terminal
- Open `http://localhost:5173` in Chrome on the same device
- Or use `http://LAN_IP:5173` on a different phone on the same WiFi
- Tap the Share icon → "Add to Home Screen" for a PWA-like experience

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature
# make changes
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature
# open Pull Request on GitHub
```

---

## 📄 License
MIT — free to use, modify, and distribute.
