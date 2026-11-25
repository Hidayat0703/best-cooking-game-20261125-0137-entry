// The cook: movement on the open floor, collision with station counters,
// and finding the station in reach. The floor is open except for the
// station rectangles, so steering toward an approach point never traps
// the cook behind a counter.
import { COOK, FIELD, FLOOR_Y, STATIONS } from './config.js';

/** Where the cook stands to use a station: just off its open side. */
export function stationApproach(station) {
  if (station.id === 'board' || station.id === 'plate') {
    return { x: station.x + station.w / 2, y: station.y + station.h + 52 };
  }
  if (station.x < FIELD.width / 2) {
    return { x: station.x + station.w + 56, y: station.y + station.h / 2 };
  }
  return { x: station.x - 56, y: station.y + station.h / 2 };
}

export function distToRectOf(x, y, r) {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  return Math.hypot(x - cx, y - cy);
}

/** The nearest station whose edge is within reach of the cook, or null. */
export function nearestStation(state) {
  let best = null;
  let bestDist = Infinity;
  for (const station of STATIONS) {
    const d = distToRectOf(state.cook.x, state.cook.y, station);
    if (d < COOK.reach && d < bestDist) {
      best = station;
      bestDist = d;
    }
  }
  return best;
}

function collide(state) {
  const cook = state.cook;
  const r = COOK.radius;
  cook.x = Math.max(r, Math.min(FIELD.width - r, cook.x));
  cook.y = Math.max(FLOOR_Y + r, Math.min(FIELD.height - r, cook.y));
  for (const station of STATIONS) {
    const nearestX = Math.max(station.x, Math.min(cook.x, station.x + station.w));
    const nearestY = Math.max(station.y, Math.min(cook.y, station.y + station.h));
    const dx = cook.x - nearestX;
    const dy = cook.y - nearestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) {
      cook.y = station.y + station.h + r;
      continue;
    }
    const d = Math.sqrt(d2);
    cook.x = nearestX + (dx / d) * r;
    cook.y = nearestY + (dy / d) * r;
  }
}

/** Move the cook one step: `move` is a normalized direction (or 0, 0). */
export function moveCook(state, dt, mx, my) {
  const cook = state.cook;
  if (mx === 0 && my === 0) return;
  const len = Math.hypot(mx, my);
  const nx = mx / len;
  const ny = my / len;
  cook.x += nx * COOK.speed * dt;
  cook.y += ny * COOK.speed * dt;
  collide(state);
}
