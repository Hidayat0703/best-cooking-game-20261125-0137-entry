// Warung Kilat: every tuning number, colour and layout in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };
export const HUD_H = 56;
export const BOARD_Y = 60;
export const BOARD_H = 76;
export const FLOOR_Y = 144;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How long one shift lasts, in seconds. */
export const SHIFT_SECONDS = 150;
/** Orders (stars) lost when an order expires. */
export const STARS = 3;

export const COOK = {
  radius: 20,
  speed: 330,
  /** How close the cook must be to a station's edge to use it. */
  reach: 84,
};

export const PROCESS = {
  chopSeconds: 1.6,
  frySeconds: 2.4,
};

export const ORDERS = {
  maxConcurrent: 3,
  firstAtSeconds: 2,
  spawnEverySeconds: 12,
  spawnShrinkPerLevel: 0.7,
  minSpawnSeconds: 7,
  timeSeconds: 48,
  timeShrinkPerLevel: 2,
  minTimeSeconds: 28,
};

/** Seconds of play per level; timers and spawn rates stop growing at the last level. */
export const LEVEL = { seconds: 30, max: 6 };

/** Raw ingredient kinds and what the kitchen does to each. */
export const INGREDIENTS = {
  ayam: { name: 'Ayam', needs: ['chop', 'fry'], cooked: 'ayamGoreng' },
  sayur: { name: 'Sayur', needs: ['chop', 'fry'], cooked: 'sayurTumis' },
  telur: { name: 'Telur', needs: ['fry'], cooked: 'telurDadar' },
  nasi: { name: 'Nasi', needs: [], cooked: 'nasi' },
};

/** The finished dish an ingredient becomes once processed. */
export const DISH_ITEMS = {
  ayamGoreng: { name: 'Ayam Goreng', color: '#c46a2b' },
  sayurTumis: { name: 'Sayur Tumis', color: '#5da244' },
  telurDadar: { name: 'Telur Dadar', color: '#e8b93b' },
  nasi: { name: 'Nasi', color: '#f5f0e1' },
};

/** The menu: three recipes built from the same four ingredients. */
export const RECIPES = [
  { id: 'nasi-ayam', name: 'Nasi Ayam Geprek', items: ['nasi', 'ayamGoreng'], price: 60 },
  { id: 'sayur-telur', name: 'Tumis Sayur Telur', items: ['sayurTumis', 'telurDadar'], price: 55 },
  { id: 'nasi-telur', name: 'Nasi Telur Dadar', items: ['nasi', 'telurDadar'], price: 45 },
];

/** Stations: id, rect, what it does. Approach points are computed in cook.js. */
export const STATIONS = [
  { id: 'ayam', kind: 'supply', item: 'ayam', x: 16, y: 150, w: 168, h: 96, label: 'Ayam', sub: 'ambil ayam mentah' },
  { id: 'sayur', kind: 'supply', item: 'sayur', x: 16, y: 256, w: 168, h: 96, label: 'Sayur', sub: 'ambil sayur segar' },
  { id: 'telur', kind: 'supply', item: 'telur', x: 16, y: 362, w: 168, h: 96, label: 'Telur', sub: 'ambil telur' },
  { id: 'stove', kind: 'stove', x: 1096, y: 150, w: 168, h: 120, label: 'Kompor', sub: 'goreng di sini' },
  { id: 'rice', kind: 'supply', item: 'nasi', x: 1096, y: 280, w: 168, h: 96, label: 'Rice Cooker', sub: 'ambil nasi' },
  { id: 'serve', kind: 'serve', x: 1096, y: 386, w: 168, h: 140, label: 'Jendela Saji', sub: 'antar pesanan' },
  { id: 'board', kind: 'board', x: 470, y: 300, w: 340, h: 90, label: 'Talenan', sub: 'potong di sini' },
  { id: 'plate', kind: 'plate', x: 470, y: 470, w: 340, h: 90, label: 'Meja Saji', sub: 'rakit piring di sini' },
  { id: 'trash', kind: 'trash', x: 16, y: 590, w: 140, h: 90, label: 'Tong Sampah', sub: 'buang bahan' },
];

/** A decorative counter with bowls of ingredients (not a station). */
export const DECOR_COUNTER = { x: 470, y: 170, w: 340, h: 60 };

export const PALETTE = {
  hud: '#3a2a1e',
  hudText: '#f7ead0',
  board: '#f7ead0',
  floorA: '#e8b48a',
  floorB: '#dfa273',
  grout: '#c98a5e',
  wood: '#a9743f',
  woodDark: '#8d5a2b',
  panel: '#fff8e1',
  text: '#2e2118',
  muted: '#8a6f5a',
  gold: '#e8b93b',
  green: '#5da244',
  red: '#d84a35',
  amber: '#e8862e',
  cook: '#ffffff',
  skin: '#f2c89b',
  hatBand: '#d84a35',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'warung-kilat.best';
