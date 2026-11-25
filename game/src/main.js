// Warung Kilat: boot, the fixed-step loop, screens, and screenshot staging.
// A shot (?shot=cover|chop|rush|serve) plays the autopilot from a seeded
// world and draws one frame; a normal visit starts on the title screen.
import { createAudio } from './audio.js';
import { createAutopilot } from './autopilot.js';
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createInput } from './input.js';
import { createRandom } from './random.js';
import { draw } from './render.js';
import { stageShot } from './shots.js';
import {
  createWorld,
  EVENT_CHOP_DONE,
  EVENT_EXPIRE,
  EVENT_FRY_DONE,
  EVENT_PICKUP,
  EVENT_PLACE,
  EVENT_SERVE,
  EVENT_TRASH,
} from './world.js';

const SEED = 20261125;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const rng = createRandom(SEED);
const world = createWorld(rng);
const autopilot = createAutopilot();
const input = createInput(canvas);
const audio = createAudio();

let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
} catch {
  best = 0;
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
let screen = 'title';

if (shot !== null) {
  screen = stageShot({ autopilot }, world, draw, shot);
  draw(ctx, world.state, screen, { best });
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (input.takePause() && (screen === 'play' || screen === 'paused')) {
      screen = screen === 'play' ? 'paused' : 'play';
    }
    if (screen === 'play') {
      acc += dt;
      let events = 0;
      while (acc >= STEP) {
        const move = input.move();
        events |= world.step(STEP, move, input.takeAction());
        acc -= STEP;
      }
      if ((events & EVENT_PICKUP) !== 0) audio.pickup();
      if ((events & EVENT_PLACE) !== 0) audio.place();
      if ((events & EVENT_CHOP_DONE) !== 0) audio.chop();
      if ((events & EVENT_FRY_DONE) !== 0) audio.fryDone();
      if ((events & EVENT_SERVE) !== 0) audio.serve();
      if ((events & EVENT_EXPIRE) !== 0) audio.expire();
      if ((events & EVENT_TRASH) !== 0) audio.trash();
      const sizzling = world.state.stove.slots.some((s) => s !== null && s.stage !== 'cooked');
      audio.setSizzle(sizzling);
      if (world.state.over) {
        screen = 'gameover';
        audio.setSizzle(false);
        if (world.state.coins > best) {
          best = world.state.coins;
          try {
            window.localStorage.setItem(BEST_KEY, String(best));
          } catch {
            // Private mode: the score just does not persist.
          }
        }
      }
    } else if (screen === 'title' || screen === 'gameover') {
      if (input.takeAction()) {
        audio.unlock();
        world.reset();
        screen = 'play';
      }
    }
    draw(ctx, world.state, screen, { best });
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
