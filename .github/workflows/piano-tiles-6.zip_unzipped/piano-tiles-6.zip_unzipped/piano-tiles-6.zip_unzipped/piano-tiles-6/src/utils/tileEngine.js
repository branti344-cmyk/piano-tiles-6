// ============================================================
// tileEngine.js — Tile Generation & Game Logic
// Beat-synced tile spawning for Piano Tiles 6
// ============================================================

export const TILE_TYPES = {
  NORMAL: "normal",
  LONG: "long",
  DOUBLE: "double",
  BOMB: "bomb",
};

export const LANE_COUNT = 4;
export const TILE_HEIGHT = 120; // px
export const TILE_GAP = 4;

let _lastLane = -1;

// ─── GENERATE TILE FROM BEAT ───────────────────────────────
export function generateTileFromBeat(beat, patternStep, song, settings = {}) {
  const lanes = settings.laneCount || LANE_COUNT;
  const bpm = song?.bpm || 120;

  // Ensure no two consecutive tiles in same lane
  let lane;
  do {
    lane = Math.floor(Math.random() * lanes);
  } while (lane === _lastLane && lanes > 1);
  _lastLane = lane;

  // Determine tile type based on BPM and beat position
  let type = TILE_TYPES.NORMAL;
  if (bpm > 120 && Math.random() < 0.08) type = TILE_TYPES.LONG;
  if (bpm > 100 && patternStep % 4 === 0 && Math.random() < 0.05) type = TILE_TYPES.DOUBLE;
  if (beat > 32 && Math.random() < 0.04) type = TILE_TYPES.BOMB;

  // Note to play when hit
  const noteIndex = beat % (song?.melodyNotes?.length || 8);
  const noteName = song?.melodyNotes?.[noteIndex] || "A4";

  return {
    id: `tile_${beat}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
    lane,
    type,
    noteName,
    noteIndex,
    y: -TILE_HEIGHT,          // starts above screen
    height: type === TILE_TYPES.LONG ? TILE_HEIGHT * 2.5 : TILE_HEIGHT,
    hit: false,
    missed: false,
    color: song?.color || "#8B5CF6",
    spawnedAt: performance.now(),
    beat,
  };
}

// ─── TILE STREAM GENERATOR ────────────────────────────────
// Returns a list of initial tiles for a song before beat starts
export function generateInitialTiles(song, count = 8, laneCount = 4) {
  const tiles = [];
  const spacing = TILE_HEIGHT + TILE_GAP + 20;
  _lastLane = -1;

  let tempLane = -1;
  for (let i = 0; i < count; i++) {
    let lane;
    do { lane = Math.floor(Math.random() * laneCount); }
    while (lane === tempLane && laneCount > 1);
    tempLane = lane;

    const noteIndex = i % (song?.melodyNotes?.length || 8);
    tiles.push({
      id: `init_${i}_${Date.now()}`,
      lane,
      type: TILE_TYPES.NORMAL,
      noteName: song?.melodyNotes?.[noteIndex] || "A4",
      noteIndex,
      y: -(spacing * (count - i)),
      height: TILE_HEIGHT,
      hit: false,
      missed: false,
      color: song?.color || "#8B5CF6",
      spawnedAt: performance.now() - (count - i) * 200,
      beat: i,
    });
  }
  return tiles;
}

// ─── UPDATE TILE POSITIONS ─────────────────────────────────
export function updateTiles(tiles, deltaMs, speed, canvasHeight) {
  const pxPerMs = (speed * 0.3); // speed 1-10 → 0.3–3 px/ms
  return tiles
    .map((tile) => ({
      ...tile,
      y: tile.y + pxPerMs * deltaMs,
    }))
    .filter((tile) => {
      // Remove tiles that passed the bottom without being hit
      return tile.y < canvasHeight + tile.height + 20;
    });
}

// ─── DETECT MISS ──────────────────────────────────────────
export function detectMissedTiles(tiles, canvasHeight, hitZoneBottom) {
  const missed = [];
  const remaining = [];
  for (const tile of tiles) {
    if (!tile.hit && tile.y > hitZoneBottom + tile.height) {
      missed.push({ ...tile, missed: true });
    } else {
      remaining.push(tile);
    }
  }
  return { missed, remaining };
}

// ─── HIT DETECTION ────────────────────────────────────────
// Returns { tile, timing } or null
export function detectHit(tiles, lane, hitZoneTop, hitZoneBottom) {
  // Find the first unhit tile in the given lane within hit zone
  const candidates = tiles
    .filter(
      (t) =>
        !t.hit &&
        !t.missed &&
        t.lane === lane &&
        t.y + t.height >= hitZoneTop &&
        t.y <= hitZoneBottom
    )
    .sort((a, b) => a.y - b.y);

  if (!candidates.length) return null;

  const tile = candidates[0];
  const center = tile.y + tile.height / 2;
  const zoneCenter = (hitZoneTop + hitZoneBottom) / 2;
  const offset = Math.abs(center - zoneCenter);
  const zoneSize = (hitZoneBottom - hitZoneTop) / 2;

  let timing;
  if (offset < zoneSize * 0.3) timing = "perfect";
  else if (offset < zoneSize * 0.65) timing = "great";
  else timing = "good";

  return { tile, timing };
}

// ─── SCORING ──────────────────────────────────────────────
export const TIMING_SCORES = {
  perfect: 100,
  great: 70,
  good: 40,
};

export const TIMING_COLORS = {
  perfect: "#FFD700",
  great: "#00E5FF",
  good: "#A8FF78",
  miss: "#FF4444",
};

export function calcComboMultiplier(combo) {
  if (combo >= 50) return 4;
  if (combo >= 30) return 3;
  if (combo >= 15) return 2;
  if (combo >= 5) return 1.5;
  return 1;
}

export function calcStars(accuracy, maxCombo, totalNotes) {
  if (accuracy >= 95 && maxCombo >= totalNotes * 0.9) return 3;
  if (accuracy >= 75) return 2;
  if (accuracy >= 40) return 1;
  return 0;
}
