// A scripted cook for the screenshot scenes: it plays the real rules, one
// decision per tick, by priority — serve what is ready, take what is done,
// route what is carried, fetch what the oldest order still needs. It never
// keeps a plan across ticks, so an expired order cannot leave it holding a
// stale job. Deterministic: the same seed always gives the same frame. If it
// cannot move for a second it sidesteps, so it never wedges itself against
// a counter.
import { COOK, INGREDIENTS, STATIONS } from './config.js';
import { distToRectOf, stationApproach } from './cook.js';
import { dishIdOf } from './world.js';

function stationById(id) {
  return STATIONS.find((s) => s.id === id);
}

/** The finished-dish id a raw kind becomes, e.g. ayam -> ayamGoreng. */
function cookedDishOf(kind) {
  return INGREDIENTS[kind].cooked;
}

/** Which dish ids are already on a plate slot that belongs to `order`. */
function platedFor(state, order) {
  const dishes = new Set();
  for (const slot of state.plates) {
    if (slot.items.every((d) => order.recipe.items.includes(d))) {
      for (const d of slot.items) dishes.add(d);
    }
  }
  return dishes;
}

/** Dish ids currently being processed or carried (as their cooked form). */
function inFlight(state) {
  const dishes = new Set();
  const carrying = state.cook.carrying;
  if (carrying !== null && carrying !== undefined && carrying.plate !== true) {
    const dish = dishIdOf(carrying) ?? cookedDishOf(carrying.kind);
    dishes.add(dish);
  }
  if (state.board.item !== null) dishes.add(cookedDishOf(state.board.item.kind));
  for (const slot of state.stove.slots) {
    if (slot !== null) dishes.add(cookedDishOf(slot.kind));
  }
  return dishes;
}

export function createAutopilot(options) {
  const deferPickup = options !== undefined && options.deferPickup === true;
  let stuckTicks = 0;
  let lastX = 0;
  let lastY = 0;
  let sidestepTicks = 0;
  let sideSign = 1;

  function decide(state) {
    const cook = state.cook;
    const carrying = cook.carrying;
    let stationId = null;
    let interact = false;

    if (carrying !== null && carrying !== undefined && carrying.plate === true) {
      // A finished plate in hand: take it to the window.
      stationId = 'serve';
      interact = true;
    } else if (carrying === null && state.plates.some((s) => s.ready)) {
      // A finished plate is waiting on the counter: pick it up — unless the
      // cover scene wants it left there while the next dish starts.
      const otherSlotStarted = state.plates.some((s) => !s.ready && s.items.length > 0);
      if (!deferPickup || otherSlotStarted) {
        stationId = 'plate';
        interact = true;
      }
    } else if (carrying === null) {
      // Finished dishes first: a cooked item on the stove blocks the next
      // fry, so take it before touching the board — even if it ends up
      // binned, the burners stay free for what the order actually wants.
      const cooked = state.stove.slots.findIndex((s) => s !== null && s.stage === 'cooked');
      if (cooked >= 0) {
        stationId = 'stove';
        interact = true;
      } else if (state.board.item !== null && state.board.item.stage === 'chopped') {
        // Chopped and waiting on the board: take it to the stove, or bin it
        // if no open order wants it any more.
        stationId = 'board';
        interact = true;
      }
    }
    if (stationId === null && carrying !== null && carrying !== undefined && carrying.plate !== true) {
      const dish = dishIdOf(carrying) ?? cookedDishOf(carrying.kind);
      if (carrying.stage === 'raw' && INGREDIENTS[carrying.kind].needs.includes('chop')) {
        // Raw and needs chopping: to the board (bin it if the board is jammed).
        stationId = state.board.item === null ? 'board' : 'trash';
        interact = true;
      } else if (carrying.stage === 'raw' || carrying.stage === 'chopped') {
        // Needs the stove: to a free burner, or bin it if the burners are
        // blocked by finished dishes nobody can take right now.
        const free = state.stove.slots.some((s) => s === null);
        const blocked = state.stove.slots.some((s) => s !== null && s.stage === 'cooked');
        stationId = free ? 'stove' : blocked ? 'trash' : 'stove';
        interact = stationId !== 'stove' || free;
      } else {
        // Cooked or ready: to the counter if an open order wants it, else bin it.
        const wanted = state.orders.some((o) => o.recipe.items.includes(dish));
        stationId = wanted ? 'plate' : 'trash';
        interact = true;
      }
    }
    if (stationId === null && carrying === null) {
      // Hands empty, nothing waiting: fetch the oldest order that still has
      // a missing dish, unless it is already being processed.
      for (const order of state.orders) {
        const plated = platedFor(state, order);
        const flying = inFlight(state);
        const missing = order.recipe.items.find((d) => !plated.has(d) && !flying.has(d));
        if (missing === undefined) continue;
        const kind = Object.keys(INGREDIENTS).find((k) => INGREDIENTS[k].cooked === missing);
        const supply = kind === 'nasi' ? 'rice' : kind;
        const needsBoard = INGREDIENTS[kind].needs.includes('chop');
        const needsStove = INGREDIENTS[kind].needs.includes('fry');
        const boardFree = !needsBoard || state.board.item === null;
        const stoveFree = !needsStove || state.stove.slots.some((s) => s === null);
        if (boardFree && stoveFree) {
          stationId = supply;
          interact = true;
        } else {
          // Its next station is busy: wait beside it.
          stationId = needsBoard && !boardFree ? 'board' : 'stove';
          interact = false;
        }
        break;
      }
    }
    if (stationId === null) {
      // Nothing to do: idle by the plating counter.
      const target = { x: 640, y: 640 };
      return moveToward(state, target, false);
    }
    const station = stationById(stationId);
    const target = stationApproach(station);
    const arrived = moveToward(state, target, interact, station);
    return arrived;
  }

  function moveToward(state, target, interact, station) {
    const cook = state.cook;
    const dx = target.x - cook.x;
    const dy = target.y - cook.y;
    const dist = Math.hypot(dx, dy);

    // Stuck detection: barely moved while chasing a target.
    if (Math.hypot(cook.x - lastX, cook.y - lastY) < 0.5 && dist > 24) {
      stuckTicks += 1;
    } else {
      stuckTicks = 0;
    }
    lastX = cook.x;
    lastY = cook.y;
    if (stuckTicks > 60) {
      sidestepTicks = 30;
      sideSign = -sideSign;
      stuckTicks = 0;
    }

    let mx = 0;
    let my = 0;
    if (dist > 12) {
      if (sidestepTicks > 0) {
        sidestepTicks -= 1;
        const len = Math.max(1, dist);
        mx = (-dy / len) * sideSign;
        my = (dx / len) * sideSign;
      } else {
        mx = dx / dist;
        my = dy / dist;
      }
    }
    const inReach = station !== undefined && distToRectOf(cook.x, cook.y, station) < COOK.reach;
    return { mx, my, interact: interact && inReach, station: station === undefined ? null : station.id };
  }

  return { decide };
}
