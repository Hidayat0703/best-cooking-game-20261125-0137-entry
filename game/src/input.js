// Warung Kilat's input: WASD or arrows to move, E or Space to use the
// nearest station, P to pause, click to do the same as Space. Keys are
// tracked as a held set so movement is smooth; actions fire once per press.
export function createInput(canvas) {
  const keys = new Set();
  let actionQueued = false;
  let pauseQueued = false;

  const MOVE_KEYS = {
    ArrowUp: { x: 0, y: -1 },
    KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    KeyS: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    KeyD: { x: 1, y: 0 },
  };

  function onKeyDown(e) {
    if (MOVE_KEYS[e.code] !== undefined) {
      keys.add(e.code);
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyE' || e.code === 'Space') {
      if (!e.repeat) actionQueued = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyP') {
      if (!e.repeat) pauseQueued = true;
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onPointerDown() {
    actionQueued = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** The current movement direction, normalized (or 0, 0). */
    move() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const d = MOVE_KEYS[code];
        if (d !== undefined) {
          x += d.x;
          y += d.y;
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** True once per queued action press; clears on read. */
    takeAction() {
      const v = actionQueued;
      actionQueued = false;
      return v;
    },
    /** True once per P press; clears on read. */
    takePause() {
      const v = pauseQueued;
      pauseQueued = false;
      return v;
    },
  };
}
