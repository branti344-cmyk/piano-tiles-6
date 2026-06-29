// ============================================================
// main.js — Piano Tiles 6 Application Bootstrap
// ============================================================
import { DEFAULT_SONGS, DIFFICULTY_COLORS } from "./data/songs.js";
import { audioEngine } from "./utils/audioEngine.js";
import {
  getAllSongs, addCustomSong, deleteCustomSong,
  getScores, saveScore, getSettings, saveSettings, unlockSong,
} from "./utils/db.js";
import {
  generateTileFromBeat, generateInitialTiles,
  updateTiles, detectMissedTiles, detectHit,
  TIMING_SCORES, TIMING_COLORS, TILE_HEIGHT,
  calcComboMultiplier, calcStars,
} from "./utils/tileEngine.js";

// ─── APP STATE ────────────────────────────────────────────
const state = {
  screen: "home",          // home | songs | game | results | settings
  songs: [],
  selectedSong: null,
  settings: getSettings(),
  scores: getScores(),

  // game runtime
  gameRunning: false,
  gamePaused: false,
  gameOver: false,
  countdown: 0,
  tiles: [],
  score: 0,
  combo: 0,
  maxCombo: 0,
  totalHits: 0,
  totalMisses: 0,
  lives: 5,
  gameProgress: 0,
  songStartTime: 0,
  lastFrameTime: 0,
  animFrame: null,
  noteHitIndex: 0,
  timingMessage: { text: "", color: "#fff", show: false, timer: null },

  // results
  lastResult: null,
};

// ─── DOM REFS ─────────────────────────────────────────────
const root = document.getElementById("root");

// ─── INIT ─────────────────────────────────────────────────
async function init() {
  state.songs = getAllSongs(DEFAULT_SONGS);
  state.scores = getScores();
  renderApp();
  showScreen("home");
}

// ─── SCREEN ROUTER ────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add("active");
  state.screen = name;
}

// ─── RENDER APP SHELL ─────────────────────────────────────
function renderApp() {
  root.innerHTML = `
    ${renderHomeScreen()}
    ${renderSongSelectScreen()}
    ${renderGameScreen()}
    ${renderResultsScreen()}
    ${renderSettingsScreen()}
    ${renderAddSongModal()}
  `;
  bindEvents();
}

// ─── HOME SCREEN ──────────────────────────────────────────
function renderHomeScreen() {
  return `
  <div id="screen-home" class="screen home-screen">
    <div class="home-logo">Piano<span>Tiles</span><span class="six">6</span></div>
    <div class="home-tagline">Tap the beat. Feel the music.</div>
    <div class="home-keys">
      <div class="home-key white"></div>
      <div class="home-key black"></div>
      <div class="home-key purple"></div>
      <div class="home-key black"></div>
      <div class="home-key cyan"></div>
      <div class="home-key black"></div>
      <div class="home-key white"></div>
    </div>
    <div class="home-nav">
      <button class="btn btn-primary" id="btn-play">▶ Play</button>
      <button class="btn btn-secondary" id="btn-settings">⚙ Settings</button>
    </div>
    <div style="margin-top:28px; font-family:var(--font-mono); font-size:0.65rem; color:var(--text3); text-align:center;">
      ${state.songs.length} songs · ${Object.keys(state.scores).length} completed
    </div>
  </div>`;
}

// ─── SONG SELECT SCREEN ───────────────────────────────────
function renderSongSelectScreen() {
  const artists = [...new Set(state.songs.map((s) => s.artist))];
  const albums = [...new Set(state.songs.map((s) => s.album))];

  const groupedByArtistAlbum = {};
  state.songs.forEach((s) => {
    const key = `${s.artist}|||${s.album}`;
    if (!groupedByArtistAlbum[key]) groupedByArtistAlbum[key] = [];
    groupedByArtistAlbum[key].push(s);
  });

  const scoreMap = state.scores;

  const albumsHtml = Object.entries(groupedByArtistAlbum).map(([key, songs]) => {
    const [artist, album] = key.split("|||");
    const color = songs[0].color;
    const year = songs[0].albumYear;

    const songsHtml = songs.map((s) => {
      const sc = scoreMap[s.id];
      const stars = sc ? "★".repeat(sc.stars) + "☆".repeat(3 - sc.stars) : "☆☆☆";
      const diffColor = DIFFICULTY_COLORS[s.difficulty];
      const locked = !s.unlocked;
      return `
        <div class="song-card ${locked ? "locked" : ""}"
             data-song-id="${s.id}" ${locked ? "" : 'data-action="select-song"'}>
          <div class="song-color-bar" style="background:${color}"></div>
          <div class="song-info">
            <div class="song-title">${s.title}</div>
            <div class="song-meta">${s.bpm} BPM · ${s.key} · ${fmtDuration(s.durationSec)}</div>
          </div>
          <div class="song-right">
            <span class="difficulty-badge"
                  style="background:${diffColor}22;color:${diffColor};border:1px solid ${diffColor}44">
              ${s.difficulty}
            </span>
            <span class="stars">${stars}</span>
            ${locked ? '<span class="lock-icon">🔒</span>' : ""}
            ${s.isCustom ? `<button class="btn btn-ghost btn-sm" data-action="delete-song" data-id="${s.id}" style="margin-top:2px;padding:2px 6px;font-size:0.65rem">✕</button>` : ""}
          </div>
        </div>`;
    }).join("");

    return `
      <div class="album-section">
        <div class="album-header">
          <div class="album-dot" style="background:${color}"></div>
          <span class="album-title">${album}</span>
          <span class="album-year">${year} · ${artist}</span>
        </div>
        ${songsHtml}
      </div>`;
  }).join("");

  return `
  <div id="screen-songs" class="screen song-select-screen">
    <div class="screen-header">
      <button class="btn btn-ghost btn-sm" data-action="go-home">← Back</button>
      <h2>Song Library</h2>
    </div>
    <div class="song-list">${albumsHtml}</div>
    <button class="fab" id="btn-add-song" title="Add Custom Song">＋</button>
  </div>`;
}

// ─── GAME SCREEN ──────────────────────────────────────────
function renderGameScreen() {
  const lanes = state.settings.laneCount;
  const laneBtns = Array.from({ length: lanes }, (_, i) =>
    `<button class="lane-btn" data-lane="${i}"></button>`
  ).join("");

  return `
  <div id="screen-game" class="screen game-screen">
    <div class="game-hud">
      <div class="hud-score">
        <div class="hud-score-val" id="hud-score">0</div>
        <div class="hud-score-label">Score</div>
      </div>
      <div class="hud-combo">
        <div class="hud-combo-val" id="hud-combo">×1</div>
        <div class="hud-combo-label">Combo</div>
      </div>
      <div class="hud-accuracy">
        <div class="hud-acc-val" id="hud-acc">—%</div>
        <div class="hud-acc-label">Accuracy</div>
      </div>
      <div id="hud-lives" style="font-size:1rem;letter-spacing:2px">❤❤❤❤❤</div>
      <button class="btn btn-ghost btn-sm" id="btn-pause">⏸</button>
    </div>
    <div class="game-stage" id="game-stage">
      <canvas id="gameCanvas"></canvas>
      <div class="progress-bar" id="progress-bar" style="width:0%"></div>
      <div class="song-info-banner" id="song-banner"></div>
      <div class="timing-display" id="timing-display"></div>
      <div class="lane-buttons" id="lane-buttons">${laneBtns}</div>
      <div class="countdown-overlay" id="countdown" style="display:none"></div>
      <div class="pause-overlay" id="pause-overlay" style="display:none">
        <h2>⏸ Paused</h2>
        <button class="btn btn-primary" id="btn-resume">▶ Resume</button>
        <button class="btn btn-secondary" id="btn-restart-game">↺ Restart</button>
        <button class="btn btn-ghost" id="btn-quit-game">✕ Quit</button>
      </div>
    </div>
  </div>`;
}

// ─── RESULTS SCREEN ───────────────────────────────────────
function renderResultsScreen() {
  return `
  <div id="screen-results" class="screen results-screen">
    <div id="results-content"></div>
    <div style="display:flex;gap:10px;width:100%;max-width:360px;margin-top:8px">
      <button class="btn btn-primary" id="btn-play-again" style="flex:1">↺ Play Again</button>
      <button class="btn btn-secondary" id="btn-back-songs" style="flex:1">Song List</button>
    </div>
  </div>`;
}

// ─── SETTINGS SCREEN ──────────────────────────────────────
function renderSettingsScreen() {
  const s = state.settings;
  return `
  <div id="screen-settings" class="screen settings-screen">
    <div class="screen-header">
      <button class="btn btn-ghost btn-sm" data-action="go-home">← Back</button>
      <h2>Settings</h2>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Audio</div>
      <div class="settings-row">
        <div><div>Music Volume</div><div class="sub">Background melody</div></div>
        <input type="range" class="slider" id="set-vol" min="0" max="1" step="0.05" value="${s.volume}">
      </div>
      <div class="settings-row">
        <div><div>SFX Volume</div><div class="sub">Tile hit sounds</div></div>
        <input type="range" class="slider" id="set-sfx" min="0" max="1" step="0.05" value="${s.sfxVolume}">
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Gameplay</div>
      <div class="settings-row">
        <div><div>Tile Speed</div><div class="sub">Level 1–10</div></div>
        <input type="range" class="slider" id="set-speed" min="1" max="10" step="1" value="${s.tileSpeed}">
      </div>
      <div class="settings-row">
        <div><div>Lane Count</div></div>
        <select id="set-lanes" style="background:var(--surface);border:1px solid var(--border);
          border-radius:6px;padding:6px 10px;color:var(--text);font-family:var(--font-display)">
          <option value="2" ${s.laneCount===2?"selected":""}>2 Lanes</option>
          <option value="3" ${s.laneCount===3?"selected":""}>3 Lanes</option>
          <option value="4" ${s.laneCount===4?"selected":""}>4 Lanes</option>
          <option value="5" ${s.laneCount===5?"selected":""}>5 Lanes</option>
          <option value="6" ${s.laneCount===6?"selected":""}>6 Lanes</option>
        </select>
      </div>
      <div class="settings-row">
        <div><div>Particles</div><div class="sub">Hit effects</div></div>
        <div class="toggle ${s.showParticles?"on":""}" id="toggle-particles"></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Data</div>
      <div class="settings-row">
        <div><div>Reset All Scores</div><div class="sub text-muted">Cannot be undone</div></div>
        <button class="btn btn-danger btn-sm" id="btn-reset-scores">Reset</button>
      </div>
    </div>
    <div style="padding:16px;text-align:center">
      <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text3)">
        Piano Tiles 6 · v1.0.0 · vscodroid + GitHub
      </div>
    </div>
  </div>`;
}

// ─── ADD SONG MODAL ───────────────────────────────────────
function renderAddSongModal() {
  const colors = ["#8B5CF6","#EF4444","#F59E0B","#10B981","#3B82F6","#EC4899","#06B6D4","#84CC16"];
  const colorSwatches = colors.map((c, i) =>
    `<div class="color-swatch ${i===0?"selected":""}" style="background:${c}" data-color="${c}"></div>`
  ).join("");

  const patternCells = Array.from({length:16}, (_,i) =>
    `<div class="pattern-cell ${[0,4,8,12].includes(i)?"active":""}" data-beat="${i}"></div>`
  ).join("");

  const noteOptions = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5"].map(n =>
    `<option value="${n}">${n}</option>`).join("");

  return `
  <div class="modal-overlay" id="add-song-modal">
    <div class="modal">
      <h3>＋ Add Custom Song</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Song Title *</label>
          <input type="text" id="new-title" placeholder="My Song" />
        </div>
        <div class="form-group">
          <label>Artist *</label>
          <input type="text" id="new-artist" placeholder="Artist Name" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Album</label>
          <input type="text" id="new-album" placeholder="Album Name" />
        </div>
        <div class="form-group">
          <label>Year</label>
          <input type="number" id="new-year" placeholder="2024" min="1900" max="2099" value="2024" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>BPM</label>
          <input type="number" id="new-bpm" placeholder="120" min="40" max="300" value="120" />
        </div>
        <div class="form-group">
          <label>Difficulty</label>
          <select id="new-diff">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div class="form-group">
          <label>Key</label>
          <select id="new-key">
            ${["Am","Cm","Dm","Em","Fm","Gm","Bm","C","D","E","F","G","A"].map(k=>`<option value="${k}">${k}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Tile Color</label>
        <div class="color-picker-row" id="color-picker">${colorSwatches}</div>
      </div>
      <div class="form-group">
        <label>Beat Pattern (16 steps — click to toggle)</label>
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text3);margin-bottom:6px">
          Each step = 1 sixteenth note at your BPM
        </div>
        <div class="pattern-editor" id="pattern-editor">${patternCells}</div>
      </div>
      <div class="form-group">
        <label>Melody Notes (comma separated)</label>
        <input type="text" id="new-notes" placeholder="A4,C5,E5,G5,A5" value="A4,C5,E5,G5,A5" />
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text3);margin-top:4px">
          Available: C3–A5, including sharps (C#4, Bb4, etc.)
        </div>
      </div>
      <div class="form-group">
        <label>Duration (seconds)</label>
        <input type="number" id="new-duration" placeholder="180" min="10" max="600" value="180" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-song">Cancel</button>
        <button class="btn btn-primary" id="btn-save-song">Add Song</button>
      </div>
    </div>
  </div>`;
}

// ─── BIND EVENTS ──────────────────────────────────────────
function bindEvents() {
  // Home
  document.getElementById("btn-play")?.addEventListener("click", () => {
    state.songs = getAllSongs(DEFAULT_SONGS);
    state.scores = getScores();
    renderSongList();
    showScreen("songs");
  });
  document.getElementById("btn-settings")?.addEventListener("click", () => showScreen("settings"));

  // Global delegated
  document.addEventListener("click", handleDelegatedClick);
  document.addEventListener("touchstart", handleDelegatedClick, { passive: true });

  // Settings
  bindSettings();

  // Modal
  bindModal();

  // Game
  bindGameControls();
}

function handleDelegatedClick(e) {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "go-home") {
    stopGame();
    showScreen("home");
  } else if (action === "select-song") {
    const id = target.closest("[data-song-id]")?.dataset.songId;
    const song = state.songs.find((s) => s.id === id);
    if (song && song.unlocked) startGame(song);
  } else if (action === "delete-song") {
    e.stopPropagation();
    if (confirm("Delete this custom song?")) {
      deleteCustomSong(target.dataset.id);
      state.songs = getAllSongs(DEFAULT_SONGS);
      renderSongList();
    }
  }
}

function renderSongList() {
  const screen = document.getElementById("screen-songs");
  if (!screen) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = renderSongSelectScreen();
  const newScreen = tmp.firstElementChild;
  screen.replaceWith(newScreen);
  // Re-add FAB listener
  document.getElementById("btn-add-song")?.addEventListener("click", openAddSongModal);
}

// ─── SETTINGS ─────────────────────────────────────────────
function bindSettings() {
  document.getElementById("set-vol")?.addEventListener("input", (e) => {
    state.settings.volume = +e.target.value;
    audioEngine.setVolume(state.settings.volume);
    saveSettings(state.settings);
  });
  document.getElementById("set-sfx")?.addEventListener("input", (e) => {
    state.settings.sfxVolume = +e.target.value;
    audioEngine.setSfxVolume(state.settings.sfxVolume);
    saveSettings(state.settings);
  });
  document.getElementById("set-speed")?.addEventListener("input", (e) => {
    state.settings.tileSpeed = +e.target.value;
    saveSettings(state.settings);
  });
  document.getElementById("set-lanes")?.addEventListener("change", (e) => {
    state.settings.laneCount = +e.target.value;
    saveSettings(state.settings);
  });
  document.getElementById("toggle-particles")?.addEventListener("click", function () {
    state.settings.showParticles = !state.settings.showParticles;
    this.classList.toggle("on", state.settings.showParticles);
    saveSettings(state.settings);
  });
  document.getElementById("btn-reset-scores")?.addEventListener("click", () => {
    if (confirm("Reset all scores? This cannot be undone.")) {
      localStorage.removeItem("pt6_scores");
      state.scores = {};
    }
  });
}

// ─── MODAL ────────────────────────────────────────────────
function openAddSongModal() {
  document.getElementById("add-song-modal").classList.add("open");
}
function closeAddSongModal() {
  document.getElementById("add-song-modal").classList.remove("open");
}

function bindModal() {
  document.getElementById("add-song-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "add-song-modal") closeAddSongModal();
  });
  document.getElementById("btn-cancel-song")?.addEventListener("click", closeAddSongModal);
  document.getElementById("btn-add-song")?.addEventListener("click", openAddSongModal);

  // Color swatches
  document.getElementById("color-picker")?.addEventListener("click", (e) => {
    const swatch = e.target.closest(".color-swatch");
    if (!swatch) return;
    document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
    swatch.classList.add("selected");
  });

  // Pattern cells
  document.getElementById("pattern-editor")?.addEventListener("click", (e) => {
    const cell = e.target.closest(".pattern-cell");
    if (!cell) return;
    cell.classList.toggle("active");
  });

  // Save
  document.getElementById("btn-save-song")?.addEventListener("click", saveCustomSong);
}

function saveCustomSong() {
  const title = document.getElementById("new-title").value.trim();
  const artist = document.getElementById("new-artist").value.trim();
  if (!title || !artist) { alert("Title and artist are required."); return; }

  const pattern = Array.from(document.querySelectorAll(".pattern-cell")).map(
    (c) => (c.classList.contains("active") ? 1 : 0)
  );
  const notesRaw = document.getElementById("new-notes").value;
  const notes = notesRaw.split(",").map((n) => n.trim()).filter(Boolean);
  const color = document.querySelector(".color-swatch.selected")?.dataset.color || "#8B5CF6";

  const newSong = {
    title,
    artist,
    album: document.getElementById("new-album").value.trim() || "Custom",
    albumYear: +document.getElementById("new-year").value || 2024,
    bpm: Math.min(300, Math.max(40, +document.getElementById("new-bpm").value || 120)),
    key: document.getElementById("new-key").value,
    durationSec: Math.min(600, Math.max(10, +document.getElementById("new-duration").value || 180)),
    difficulty: document.getElementById("new-diff").value,
    color,
    beatPattern: pattern,
    melodyNotes: notes.length ? notes : ["A4","C5","E5","G5"],
    cover: null,
    unlocked: true,
  };

  addCustomSong(newSong);
  state.songs = getAllSongs(DEFAULT_SONGS);
  closeAddSongModal();
  renderSongList();
  showScreen("songs");
}

// ─── GAME ─────────────────────────────────────────────────
let canvas, ctx, stageEl, laneCount;

async function startGame(song) {
  state.selectedSong = song;
  state.gameRunning = false;
  state.gamePaused = false;
  state.gameOver = false;
  state.tiles = [];
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.totalHits = 0;
  state.totalMisses = 0;
  state.lives = 5;
  state.gameProgress = 0;
  state.noteHitIndex = 0;
  state.songStartTime = 0;
  laneCount = state.settings.laneCount;

  showScreen("game");

  // Update banner
  const banner = document.getElementById("song-banner");
  if (banner) {
    banner.innerHTML = `<h3>${song.title}</h3><p>${song.artist} · ${song.album}</p>`;
  }

  await audioEngine.init();
  audioEngine.setVolume(state.settings.volume);
  audioEngine.setSfxVolume(state.settings.sfxVolume);
  audioEngine.resume();

  setupCanvas();
  await runCountdown();
  beginGame();
}

function setupCanvas() {
  stageEl = document.getElementById("game-stage");
  canvas = document.getElementById("gameCanvas");
  const laneButtonsEl = document.getElementById("lane-buttons");

  // Rebuild lane buttons with correct count
  laneButtonsEl.innerHTML = Array.from({ length: laneCount }, (_, i) =>
    `<button class="lane-btn" data-lane="${i}"></button>`
  ).join("");

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  if (!canvas || !stageEl) return;
  const laneH = 80;
  canvas.width = stageEl.clientWidth;
  canvas.height = stageEl.clientHeight - laneH;
  ctx = canvas.getContext("2d");
}

async function runCountdown() {
  const overlay = document.getElementById("countdown");
  for (const num of [3, 2, 1]) {
    overlay.style.display = "flex";
    overlay.textContent = num;
    audioEngine.playCountdown(num);
    await delay(800);
    overlay.style.display = "none";
    await delay(100);
  }
  overlay.style.display = "flex";
  overlay.textContent = "GO!";
  overlay.style.color = "var(--accent2)";
  audioEngine.playCountdown(0);
  await delay(600);
  overlay.style.display = "none";
}

function beginGame() {
  state.gameRunning = true;
  state.songStartTime = performance.now();
  state.lastFrameTime = performance.now();

  // Seed initial tiles
  state.tiles = generateInitialTiles(state.selectedSong, 6, laneCount);

  // Start beat-synced audio and tile spawner
  audioEngine.startBeat(state.selectedSong, onBeat);

  // Bind lane buttons
  document.getElementById("lane-buttons")?.addEventListener("pointerdown", onLanePress);

  // Keyboard support
  document.addEventListener("keydown", onKeyDown);

  // Pause button
  document.getElementById("btn-pause")?.addEventListener("click", togglePause);
  document.getElementById("btn-resume")?.addEventListener("click", togglePause);
  document.getElementById("btn-restart-game")?.addEventListener("click", () => startGame(state.selectedSong));
  document.getElementById("btn-quit-game")?.addEventListener("click", () => { stopGame(); showScreen("songs"); });

  requestAnimationFrame(gameLoop);
}

let _beatTileCounter = 0;
function onBeat(beat, step, isActive) {
  if (!state.gameRunning || state.gamePaused) return;
  if (isActive) {
    const tile = generateTileFromBeat(beat, step, state.selectedSong, state.settings);
    state.tiles.push(tile);
    _beatTileCounter++;
  }
}

function gameLoop(now) {
  if (!state.gameRunning) return;
  if (state.gamePaused) { state.animFrame = requestAnimationFrame(gameLoop); return; }

  const delta = now - state.lastFrameTime;
  state.lastFrameTime = now;

  // Update progress
  const elapsed = (now - state.songStartTime) / 1000;
  state.gameProgress = Math.min(1, elapsed / state.selectedSong.durationSec);

  // End game when song finishes
  if (elapsed >= state.selectedSong.durationSec + 2) {
    endGame();
    return;
  }

  // Update tiles
  const speed = state.settings.tileSpeed;
  state.tiles = updateTiles(state.tiles, delta, speed, canvas.height);

  // Detect misses
  const hitZoneBottom = canvas.height - 20;
  const hitZoneTop = canvas.height - TILE_HEIGHT - 20;
  const { missed, remaining } = detectMissedTiles(state.tiles, canvas.height, hitZoneBottom);
  state.tiles = remaining;

  missed.forEach(() => {
    state.totalMisses++;
    state.combo = 0;
    state.lives = Math.max(0, state.lives - 1);
    audioEngine.playMissSound();
    showTimingText("MISS", TIMING_COLORS.miss);
    if (state.lives <= 0) { endGame(); return; }
    updateHUD();
  });

  // Draw
  drawGame(hitZoneTop, hitZoneBottom);

  // Progress bar
  const pb = document.getElementById("progress-bar");
  if (pb) pb.style.width = `${state.gameProgress * 100}%`;

  state.animFrame = requestAnimationFrame(gameLoop);
}

function drawGame(hitZoneTop, hitZoneBottom) {
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const song = state.selectedSong;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0a0a0f");
  bg.addColorStop(1, "#111118");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Lane dividers
  const laneW = w / laneCount;
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 1; i < laneCount; i++) {
    ctx.beginPath();
    ctx.moveTo(i * laneW, 0);
    ctx.lineTo(i * laneW, h);
    ctx.stroke();
  }

  // Hit zone
  const grad = ctx.createLinearGradient(0, hitZoneTop, 0, hitZoneBottom);
  grad.addColorStop(0, "rgba(139,92,246,0.0)");
  grad.addColorStop(0.5, "rgba(139,92,246,0.08)");
  grad.addColorStop(1, "rgba(139,92,246,0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, hitZoneTop, w, hitZoneBottom - hitZoneTop);

  // Hit zone line
  ctx.strokeStyle = `${song.color}55`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, hitZoneBottom - 10);
  ctx.lineTo(w, hitZoneBottom - 10);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tiles
  state.tiles.forEach((tile) => {
    if (tile.hit || tile.missed) return;
    const x = tile.lane * laneW + 4;
    const tw = laneW - 8;
    const y = tile.y;
    const th = tile.height;

    // Tile body
    const tg = ctx.createLinearGradient(x, y, x, y + th);
    tg.addColorStop(0, tile.color);
    tg.addColorStop(1, shadeColor(tile.color, -40));
    ctx.fillStyle = tg;
    ctx.beginPath();
    roundRect(ctx, x, y, tw, th, 8);
    ctx.fill();

    // Glow effect
    ctx.shadowColor = tile.color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = tile.color + "aa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, x, y, tw, th, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Note name label
    if (th >= 60) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `bold ${Math.min(14, tw * 0.25)}px 'Space Mono'`;
      ctx.textAlign = "center";
      ctx.fillText(tile.noteName, x + tw / 2, y + th / 2 + 5);
    }

    // Bomb indicator
    if (tile.type === "bomb") {
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("💣", x + tw / 2, y + th / 2 + 6);
    }
  });
}

// Lane press handler
function onLanePress(e) {
  if (!state.gameRunning || state.gamePaused) return;
  const btn = e.target.closest("[data-lane]");
  if (!btn) return;
  const lane = +btn.dataset.lane;
  handleTap(lane);
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 100);
}

// Keyboard
function onKeyDown(e) {
  if (!state.gameRunning || state.gamePaused) return;
  const map = { "a": 0, "s": 1, "d": 2, "f": 3, "j": 0, "k": 1, "l": 2, ";": 3 };
  const keyMap = {
    "KeyA": 0, "KeyS": 1, "KeyD": 2, "KeyF": 3,
    "ArrowLeft": 0, "ArrowDown": 1, "ArrowUp": 2, "ArrowRight": 3,
  };
  const lane = keyMap[e.code];
  if (lane !== undefined) handleTap(lane);
  if (e.code === "Escape" || e.code === "Space") togglePause();
}

function handleTap(lane) {
  if (!canvas) return;
  const laneH = 80;
  const hitZoneBottom = canvas.height - 20;
  const hitZoneTop = canvas.height - TILE_HEIGHT - 20;

  const result = detectHit(state.tiles, lane, hitZoneTop, hitZoneBottom);

  if (!result) {
    // Miss tap — no penalty, just no reward
    return;
  }

  const { tile, timing } = result;

  if (tile.type === "bomb") {
    // Bomb hit = life loss
    state.tiles = state.tiles.map((t) => (t.id === tile.id ? { ...t, hit: true } : t));
    state.lives = Math.max(0, state.lives - 1);
    audioEngine.playMissSound();
    showTimingText("💣 BOOM!", "#FF4444");
    if (state.lives <= 0) endGame();
    updateHUD();
    return;
  }

  // Normal hit
  state.tiles = state.tiles.map((t) => (t.id === tile.id ? { ...t, hit: true } : t));
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.totalHits++;

  const mult = calcComboMultiplier(state.combo);
  const pts = Math.round(TIMING_SCORES[timing] * mult);
  state.score += pts;

  audioEngine.playHitSound(tile.noteIndex, state.selectedSong);
  if (state.combo > 1 && state.combo % 10 === 0) audioEngine.playComboSound(state.combo);

  showTimingText(
    timing === "perfect" ? "✦ PERFECT" : timing === "great" ? "GREAT" : "GOOD",
    TIMING_COLORS[timing]
  );

  if (state.settings.showParticles) spawnParticles(tile.lane, tile.color);

  updateHUD();
}

function showTimingText(text, color) {
  const el = document.getElementById("timing-display");
  if (!el) return;
  if (state.timingMessage.timer) clearTimeout(state.timingMessage.timer);
  el.textContent = text;
  el.style.color = color;
  el.classList.remove("show");
  void el.offsetWidth; // reflow
  el.classList.add("show");
  state.timingMessage.timer = setTimeout(() => el.classList.remove("show"), 600);
}

function spawnParticles(lane, color) {
  const stage = document.getElementById("game-stage");
  if (!stage || !canvas) return;
  const laneW = canvas.width / laneCount;
  const cx = lane * laneW + laneW / 2;
  const cy = canvas.height + 30;

  for (let i = 0; i < 8; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = 4 + Math.random() * 6;
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
    const dist = 30 + Math.random() * 50;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      background:${color};
      left:${cx - size / 2}px; top:${cy - size / 2}px;
      --dx:${Math.cos(angle) * dist}px;
      --dy:${Math.sin(angle) * dist - 60}px;
      box-shadow: 0 0 6px ${color};
    `;
    stage.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

function updateHUD() {
  const total = state.totalHits + state.totalMisses;
  const acc = total > 0 ? Math.round((state.totalHits / total) * 100) : 100;

  const scoreEl = document.getElementById("hud-score");
  const comboEl = document.getElementById("hud-combo");
  const accEl = document.getElementById("hud-acc");
  const livesEl = document.getElementById("hud-lives");

  if (scoreEl) scoreEl.textContent = state.score.toLocaleString();
  if (comboEl) {
    comboEl.textContent = `×${state.combo}`;
    comboEl.classList.toggle("fire", state.combo >= 20);
  }
  if (accEl) {
    accEl.textContent = `${acc}%`;
    accEl.style.color = acc >= 90 ? "var(--success)" : acc >= 70 ? "var(--accent3)" : "var(--danger)";
  }
  if (livesEl) {
    livesEl.textContent = "❤".repeat(state.lives) + "🖤".repeat(Math.max(0, 5 - state.lives));
  }
}

function togglePause() {
  state.gamePaused = !state.gamePaused;
  const overlay = document.getElementById("pause-overlay");
  if (overlay) overlay.style.display = state.gamePaused ? "flex" : "none";
  if (state.gamePaused) {
    audioEngine.stopBeat();
  } else {
    audioEngine.startBeat(state.selectedSong, onBeat);
  }
}

function endGame() {
  state.gameRunning = false;
  audioEngine.stopBeat();
  cancelAnimationFrame(state.animFrame);
  document.removeEventListener("keydown", onKeyDown);

  const total = state.totalHits + state.totalMisses;
  const acc = total > 0 ? Math.round((state.totalHits / total) * 100) : 0;
  const stars = calcStars(acc, state.maxCombo, total || 1);

  const result = {
    song: state.selectedSong,
    points: state.score,
    accuracy: acc,
    maxCombo: state.maxCombo,
    totalHits: state.totalHits,
    totalMisses: state.totalMisses,
    stars,
  };
  state.lastResult = result;

  const savedScore = saveScore(state.selectedSong.id, result);

  // Unlock next song if available
  const idx = state.songs.findIndex((s) => s.id === state.selectedSong.id);
  if (stars >= 2 && idx < state.songs.length - 1) {
    unlockSong(state.songs[idx + 1].id);
    state.songs = getAllSongs(DEFAULT_SONGS);
  }

  showResults(result, savedScore);
}

function stopGame() {
  state.gameRunning = false;
  audioEngine.stopBeat();
  cancelAnimationFrame(state.animFrame);
  document.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("resize", resizeCanvas);
}

function showResults(result, savedScore) {
  const starsStr = "★".repeat(result.stars) + "☆".repeat(3 - result.stars);
  const gradeLabel = result.accuracy >= 95 ? "S" : result.accuracy >= 85 ? "A" : result.accuracy >= 70 ? "B" : result.accuracy >= 50 ? "C" : "D";
  const isNewBest = savedScore && savedScore.totalPlays === 1 || (savedScore?.best === result.points);

  document.getElementById("results-content").innerHTML = `
    <div class="results-title">${result.stars === 3 ? "🏆 Perfect!" : result.stars >= 2 ? "🎹 Great!" : result.stars >= 1 ? "👍 Good!" : "Keep Trying!"}</div>
    <div class="results-stars">${starsStr}</div>
    <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text2);margin-bottom:8px">
      ${result.song.title} — ${result.song.artist}
    </div>
    <div class="results-card">
      <div class="results-row">
        <label>Score</label>
        <value style="color:var(--accent2);font-size:1.3rem">${result.points.toLocaleString()}</value>
      </div>
      <div class="results-row">
        <label>Grade</label>
        <value style="color:var(--accent3);font-size:1.5rem">${gradeLabel}</value>
      </div>
      <div class="results-row">
        <label>Accuracy</label>
        <value>${result.accuracy}%</value>
      </div>
      <div class="results-row">
        <label>Max Combo</label>
        <value>×${result.maxCombo}</value>
      </div>
      <div class="results-row">
        <label>Hits</label>
        <value style="color:var(--success)">${result.totalHits}</value>
      </div>
      <div class="results-row">
        <label>Misses</label>
        <value style="color:var(--danger)">${result.totalMisses}</value>
      </div>
      ${isNewBest ? `<div class="results-row"><label>Personal Best</label><value style="color:var(--accent3)">🏆 New!</value></div>` : ""}
      ${savedScore ? `<div class="results-row"><label>Best Score</label><value>${savedScore.best.toLocaleString()}</value></div>` : ""}
    </div>`;

  showScreen("results");

  document.getElementById("btn-play-again")?.addEventListener("click", () => startGame(result.song));
  document.getElementById("btn-back-songs")?.addEventListener("click", () => {
    state.songs = getAllSongs(DEFAULT_SONGS);
    state.scores = getScores();
    renderSongList();
    showScreen("songs");
  });
}

// ─── HELPERS ──────────────────────────────────────────────
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function fmtDuration(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shadeColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─── BOOT ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", init);
