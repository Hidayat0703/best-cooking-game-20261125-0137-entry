// Warung Kilat's world: orders, processing, plating, scoring. Pure logic —
// no DOM, no canvas — so the autopilot and the screenshots run the real rules.
import {
  COOK, FIELD, FLOOR_Y, INGREDIENTS, LEVEL, ORDERS, PROCESS, RECIPES,
  SHIFT_SECONDS, STARS, STATIONS,
} from './config.js';
import { moveCook, nearestStation } from './cook.js';

export const EVENT_SERVE = 1;
export const EVENT_EXPIRE = 2;
export const EVENT_OVER = 4;
export const EVENT_PICKUP = 8;
export const EVENT_PLACE = 16;
export const EVENT_CHOP_DONE = 32;
export const EVENT_FRY_DONE = 64;
export const EVENT_TRASH = 128;

/** The finished-dish id a carried item counts as on a plate, or null. */
export function dishIdOf(item) {
  if (item === null || item === undefined) return null;
  if (item.stage === 'cooked') return INGREDIENTS[item.kind].cooked;
  if (item.stage === 'ready') return 'nasi';
  return null;
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

function orderForPlate(state, items) {
  return state.orders.find((o) => sameSet(o.recipe.items, items)) ?? null;
}

function refreshPlates(state) {
  for (const slot of state.plates) {
    const match = slot.items.length > 0 ? orderForPlate(state, slot.items) : null;
    slot.ready = match !== null;
    slot.orderId = match === null ? null : match.id;
  }
  const carried = state.cook.carrying;
  if (carried !== null && carried !== undefined && carried.plate === true) {
    const match = orderForPlate(state, carried.items);
    carried.ready = match !== null;
    carried.orderId = match === null ? null : match.id;
  }
}

function spawnInterval(level) {
  return Math.max(
    ORDERS.minSpawnSeconds,
    ORDERS.spawnEverySeconds - (level - 1) * ORDERS.spawnShrinkPerLevel,
  );
}

function orderTime(level) {
  return Math.max(
    ORDERS.minTimeSeconds,
    ORDERS.timeSeconds - (level - 1) * ORDERS.timeShrinkPerLevel,
  );
}

export function createWorld(rng) {
  const state = {
    rng,
    time: 0,
    level: 1,
    coins: 0,
    served: 0,
    stars: STARS,
    over: false,
    overReason: null,
    spawnIn: ORDERS.firstAtSeconds,
    nextOrderId: 1,
    orders: [],
    cook: { x: FIELD.width / 2, y: 640, carrying: null },
    board: { item: null, progress: 0 },
    stove: { slots: [null, null], progress: [0, 0] },
    plates: [{ items: [], ready: false, orderId: null }, { items: [], ready: false, orderId: null }],
    popups: [],
  };

  function popup(x, y, text, color) {
    state.popups.push({ x, y, text, ttl: 1.4, color: color ?? '#2e2118' });
  }

  function spawnOrder() {
    const recipe = rng.pick(RECIPES);
    const total = orderTime(state.level);
    state.orders.push({ id: state.nextOrderId, recipe, timeLeft: total, total });
    state.nextOrderId += 1;
  }

  function addToPlate(dishId) {
    // Prefer a slot where this dish keeps the plate a subset of an open order.
    let slot = null;
    for (const s of state.plates) {
      if (s.ready || s.items.length >= 2 || s.items.includes(dishId)) continue;
      const trial = [...s.items, dishId];
      if (state.orders.some((o) => trial.every((d) => o.recipe.items.includes(d)))) {
        slot = s;
        break;
      }
    }
    if (slot === null) {
      slot = state.plates.find((s) => !s.ready && s.items.length < 2 && !s.items.includes(dishId)) ?? null;
    }
    if (slot === null) return false;
    slot.items.push(dishId);
    refreshPlates(state);
    return true;
  }

  function interact(stationId) {
    let station = null;
    if (stationId !== undefined && stationId !== null) {
      // Aimed: use exactly the station asked for, but only if it is in reach.
      const wanted = STATIONS.find((s) => s.id === stationId);
      if (wanted === undefined) return 0;
      const dx = Math.max(wanted.x - state.cook.x, 0, state.cook.x - (wanted.x + wanted.w));
      const dy = Math.max(wanted.y - state.cook.y, 0, state.cook.y - (wanted.y + wanted.h));
      if (Math.hypot(dx, dy) >= COOK.reach) return 0;
      station = wanted;
    } else {
      station = nearestStation(state);
    }
    if (station === null) return 0;
    const cook = state.cook;
    let event = 0;
    if (station.kind === 'supply') {
      if (cook.carrying === null) {
        cook.carrying = { kind: station.item, stage: station.item === 'nasi' ? 'ready' : 'raw' };
        event = EVENT_PICKUP;
      }
      return event;
    }
    if (station.kind === 'board') {
      if (cook.carrying !== null && cook.carrying.plate !== true) {
        const item = cook.carrying;
        if (item.stage === 'raw' && INGREDIENTS[item.kind].needs.includes('chop') && state.board.item === null) {
          state.board.item = item;
          state.board.progress = 0;
          cook.carrying = null;
          event = EVENT_PLACE;
        }
      } else if (cook.carrying === null && state.board.item !== null && state.board.item.stage === 'chopped') {
        cook.carrying = state.board.item;
        state.board.item = null;
        state.board.progress = 0;
        event = EVENT_PICKUP;
      }
      return event;
    }
    if (station.kind === 'stove') {
      if (cook.carrying !== null && cook.carrying.plate !== true) {
        const item = cook.carrying;
        const fryable =
          (item.stage === 'chopped' && INGREDIENTS[item.kind].needs.includes('fry')) ||
          (item.stage === 'raw' && item.kind === 'telur');
        if (fryable) {
          const free = state.stove.slots.findIndex((s) => s === null);
          if (free >= 0) {
            state.stove.slots[free] = item;
            state.stove.progress[free] = 0;
            cook.carrying = null;
            event = EVENT_PLACE;
          }
        }
      } else if (cook.carrying === null) {
        const done = state.stove.slots.findIndex((s) => s !== null && s.stage === 'cooked');
        if (done >= 0) {
          cook.carrying = state.stove.slots[done];
          state.stove.slots[done] = null;
          state.stove.progress[done] = 0;
          event = EVENT_PICKUP;
        }
      }
      return event;
    }
    if (station.kind === 'plate') {
      if (cook.carrying !== null && cook.carrying.plate !== true) {
        const dish = dishIdOf(cook.carrying);
        if (dish !== null && addToPlate(dish)) {
          cook.carrying = null;
          event = EVENT_PLACE;
        }
      } else if (cook.carrying !== null && cook.carrying.plate === true) {
        const free = state.plates.find((s) => s.items.length === 0);
        if (free !== undefined) {
          free.items = [...cook.carrying.items];
          cook.carrying = null;
          refreshPlates(state);
          event = EVENT_PLACE;
        }
      } else if (cook.carrying === null) {
        const ready = state.plates.find((s) => s.ready);
        if (ready !== undefined) {
          cook.carrying = { plate: true, items: [...ready.items], ready: true, orderId: ready.orderId };
          ready.items = [];
          ready.ready = false;
          ready.orderId = null;
          event = EVENT_PICKUP;
        } else {
          const wrong = state.plates.find((s) => s.items.length > 0);
          if (wrong !== undefined) {
            wrong.items = [];
            wrong.ready = false;
            wrong.orderId = null;
            popup(station.x + station.w / 2, station.y - 12, 'Dibuang', '#d84a35');
            event = EVENT_TRASH;
          }
        }
      }
      return event;
    }
    if (station.kind === 'trash') {
      if (cook.carrying !== null) {
        cook.carrying = null;
        popup(station.x + station.w / 2, station.y - 12, 'Dibuang', '#d84a35');
        event = EVENT_TRASH;
      }
      return event;
    }
    if (station.kind === 'serve') {
      if (cook.carrying !== null && cook.carrying.plate === true) {
        const carried = cook.carrying;
        if (carried.ready) {
          const order = state.orders.find((o) => o.id === carried.orderId);
          if (order !== undefined) {
            state.coins += order.recipe.price;
            state.served += 1;
            state.orders = state.orders.filter((o) => o.id !== order.id);
            // Under the window, on open floor: y - 12 landed on the Rice
            // Cooker card above, and y + 10 sat on the window's own yellow
            // card (gold-on-yellow was unreadable). Below the card is empty.
            popup(station.x + station.w / 2, station.y + station.h + 28, `+${order.recipe.price}`, '#e8b93b');
            cook.carrying = null;
            refreshPlates(state);
            event = EVENT_SERVE;
          }
        } else {
          popup(station.x + station.w / 2, station.y + station.h + 28, 'Bukan pesanan!', '#d84a35');
          cook.carrying = null;
          event = EVENT_TRASH;
        }
      }
      return event;
    }
    return event;
  }

  function step(dt, move, interactPressed, stationId) {
    if (state.over) return 0;
    let events = 0;
    state.time += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.time / LEVEL.seconds));

    state.spawnIn -= dt;
    if (state.spawnIn <= 0 && state.orders.length < ORDERS.maxConcurrent) {
      spawnOrder();
      state.spawnIn = spawnInterval(state.level);
    }

    for (const order of [...state.orders]) {
      order.timeLeft -= dt;
      if (order.timeLeft <= 0) {
        state.orders = state.orders.filter((o) => o.id !== order.id);
        state.stars -= 1;
        events |= EVENT_EXPIRE;
        popup(640, 150, 'Pesanan hangus!', '#d84a35');
        refreshPlates(state);
        if (state.stars <= 0) {
          state.over = true;
          state.overReason = 'stars';
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    if (state.board.item !== null && state.board.item.stage === 'raw') {
      state.board.progress += dt / PROCESS.chopSeconds;
      if (state.board.progress >= 1) {
        state.board.item.stage = 'chopped';
        state.board.progress = 0;
        events |= EVENT_CHOP_DONE;
      }
    }
    state.stove.slots.forEach((slot, i) => {
      if (slot === null) return;
      const cooking = (slot.stage === 'chopped' && INGREDIENTS[slot.kind].needs.includes('fry'))
        || (slot.stage === 'raw' && slot.kind === 'telur');
      if (!cooking) return;
      state.stove.progress[i] += dt / PROCESS.frySeconds;
      if (state.stove.progress[i] >= 1) {
        slot.stage = 'cooked';
        state.stove.progress[i] = 0;
        events |= EVENT_FRY_DONE;
      }
    });

    moveCook(state, dt, move.x, move.y);
    if (interactPressed) events |= interact(stationId);

    for (const p of state.popups) p.ttl -= dt;
    state.popups = state.popups.filter((p) => p.ttl > 0);

    if (state.time >= SHIFT_SECONDS) {
      state.over = true;
      state.overReason = 'shift';
      events |= EVENT_OVER;
    }
    return events;
  }

  function reset() {
    state.time = 0;
    state.level = 1;
    state.coins = 0;
    state.served = 0;
    state.stars = STARS;
    state.over = false;
    state.overReason = null;
    state.spawnIn = ORDERS.firstAtSeconds;
    state.nextOrderId = 1;
    state.orders = [];
    state.cook = { x: FIELD.width / 2, y: 640, carrying: null };
    state.board = { item: null, progress: 0 };
    state.stove = { slots: [null, null], progress: [0, 0] };
    state.plates = [{ items: [], ready: false, orderId: null }, { items: [], ready: false, orderId: null }];
    state.popups = [];
  }

  return { state, step, reset, interact, refreshPlates };
}
