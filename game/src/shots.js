// Shot staging: each screenshot is one frame of a real autopilot run, so the
// cover, the chop close-up and the rush hour all come from the same rules
// the player meets. Every scene is fixed-step and seeded, so it replays
// identically on every machine.
import { STEP } from './config.js';
import { EVENT_SERVE } from './world.js';
import { createAutopilot } from './autopilot.js';

function runSteps(world, ap, n) {
  let events = 0;
  for (let i = 0; i < n; i++) {
    const m = ap.decide(world.state);
    events |= world.step(STEP, { x: m.mx, y: m.my }, m.interact, m.station);
    if (world.state.over) break;
  }
  return events;
}

/**
 * Stage one shot, then hand back the screen to draw ('play').
 * ctx carries the autopilot; render is unused here (drawing happens after).
 */
export function stageShot(ctx, world, render, shot) {
  const ap = ctx.autopilot;
  world.reset();
  if (shot === 'cover') {
    // The cover frame, all in one shot: the kitchen, the order board, the
    // ingredient bowls on the counter, one dish mid-assembly on a plate,
    // the timers, and a finished plate glowing ready to serve. A human
    // player reaches this by plating the next dish before serving the
    // finished one, so the cover autopilot defers the pickup until the
    // second plate has its first item.
    const coverAp = createAutopilot({ deferPickup: true });
    for (let i = 0; i < 60 * 60; i++) {
      const m = coverAp.decide(world.state);
      world.step(STEP, { x: m.mx, y: m.my }, m.interact, m.station);
      const slots = world.state.plates;
      const ready = slots.some((s) => s.ready);
      const midAssembly = slots.some((s) => !s.ready && s.items.length > 0);
      if (ready && midAssembly) break;
      if (world.state.over) break;
    }
    return 'play';
  }
  if (shot === 'chop') {
    // Stop the moment the board is mid-chop, knife down.
    for (let i = 0; i < 20 * 60; i++) {
      const m = ap.decide(world.state);
      world.step(STEP, { x: m.mx, y: m.my }, m.interact, m.station);
      const b = world.state.board;
      if (b.item !== null && b.item.stage === 'raw' && b.progress >= 0.45 && b.progress <= 0.6) break;
      if (world.state.over) break;
    }
    return 'play';
  }
  if (shot === 'rush') {
    // 95 seconds in: late shift, board full, timers low.
    runSteps(world, ap, 95 * 60);
    return 'play';
  }
  if (shot === 'serve') {
    // Stop just after a dish is served, while the coin popup is still up.
    for (let i = 0; i < 150 * 60; i++) {
      const m = ap.decide(world.state);
      const events = world.step(STEP, { x: m.mx, y: m.my }, m.interact, m.station);
      if ((events & EVENT_SERVE) !== 0) {
        runSteps(world, ap, 8);
        break;
      }
      if (world.state.over) break;
    }
    return 'play';
  }
  return 'play';
}
