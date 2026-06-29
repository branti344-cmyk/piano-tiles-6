// ============================================================
// db.js — Local Storage Database Layer
// Piano Tiles 6 — Persistent Storage Utilities
// ============================================================

const DB_KEYS = {
  SONGS: "pt6_songs",
  SCORES: "pt6_scores",
  SETTINGS: "pt6_settings",
  UNLOCKS: "pt6_unlocks",
  CUSTOM_SONGS: "pt6_custom_songs",
};

// ─── SONGS ────────────────────────────────────────────────
export function getAllSongs(defaultSongs) {
  try {
    const custom = JSON.parse(localStorage.getItem(DB_KEYS.CUSTOM_SONGS) || "[]");
    const unlocks = JSON.parse(localStorage.getItem(DB_KEYS.UNLOCKS) || "{}");
    const merged = [...defaultSongs, ...custom].map((s) => ({
      ...s,
      unlocked: unlocks[s.id] !== undefined ? unlocks[s.id] : s.unlocked,
    }));
    return merged;
  } catch {
    return defaultSongs;
  }
}

export function addCustomSong(song) {
  try {
    const existing = JSON.parse(localStorage.getItem(DB_KEYS.CUSTOM_SONGS) || "[]");
    const newSong = {
      ...song,
      id: `custom_${Date.now()}`,
      unlocked: true,
      isCustom: true,
    };
    existing.push(newSong);
    localStorage.setItem(DB_KEYS.CUSTOM_SONGS, JSON.stringify(existing));
    return newSong;
  } catch (e) {
    console.error("Failed to save custom song", e);
    return null;
  }
}

export function deleteCustomSong(id) {
  try {
    const existing = JSON.parse(localStorage.getItem(DB_KEYS.CUSTOM_SONGS) || "[]");
    const updated = existing.filter((s) => s.id !== id);
    localStorage.setItem(DB_KEYS.CUSTOM_SONGS, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export function updateCustomSong(id, changes) {
  try {
    const existing = JSON.parse(localStorage.getItem(DB_KEYS.CUSTOM_SONGS) || "[]");
    const idx = existing.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    existing[idx] = { ...existing[idx], ...changes };
    localStorage.setItem(DB_KEYS.CUSTOM_SONGS, JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

// ─── SCORES ───────────────────────────────────────────────
export function getScores() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEYS.SCORES) || "{}");
  } catch {
    return {};
  }
}

export function saveScore(songId, score) {
  try {
    const scores = getScores();
    const prev = scores[songId];
    scores[songId] = {
      best: prev ? Math.max(prev.best, score.points) : score.points,
      lastPoints: score.points,
      accuracy: score.accuracy,
      maxCombo: score.maxCombo,
      stars: score.stars,
      playedAt: new Date().toISOString(),
      totalPlays: (prev?.totalPlays || 0) + 1,
    };
    localStorage.setItem(DB_KEYS.SCORES, JSON.stringify(scores));

    // Unlock next song on 2-star completion
    if (score.stars >= 2) unlockNextSong(songId);
    return scores[songId];
  } catch (e) {
    console.error("Failed to save score", e);
    return null;
  }
}

function unlockNextSong(completedId) {
  try {
    const unlocks = JSON.parse(localStorage.getItem(DB_KEYS.UNLOCKS) || "{}");
    // Simple sequential unlock — caller can override with better logic
    unlocks[completedId + "_next"] = true;
    localStorage.setItem(DB_KEYS.UNLOCKS, JSON.stringify(unlocks));
  } catch {}
}

export function unlockSong(id) {
  try {
    const unlocks = JSON.parse(localStorage.getItem(DB_KEYS.UNLOCKS) || "{}");
    unlocks[id] = true;
    localStorage.setItem(DB_KEYS.UNLOCKS, JSON.stringify(unlocks));
  } catch {}
}

// ─── SETTINGS ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  volume: 0.8,
  sfxVolume: 1.0,
  tileSpeed: 5,        // 1–10
  laneCount: 4,
  showParticles: true,
  colorTheme: "dark",
  hapticFeedback: true,
  showFPS: false,
};

export function getSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(DB_KEYS.SETTINGS) || "{}"),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

// ─── LEADERBOARD (local) ──────────────────────────────────
export function getLeaderboard(songId, limit = 10) {
  const scores = getScores();
  const entry = scores[songId];
  if (!entry) return [];
  return [{ rank: 1, name: "You", points: entry.best, stars: entry.stars }];
}

// ─── RESET ────────────────────────────────────────────────
export function resetAllData() {
  Object.values(DB_KEYS).forEach((k) => localStorage.removeItem(k));
}
