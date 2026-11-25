// A tiny seeded random source (mulberry32): the same seed always gives the
// same stream, so a screenshot scene replays identically every run.

export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    /** A float in [0, 1). */
    next,
    /** An integer in [0, n). */
    int(n) {
      return Math.floor(next() * n);
    },
    /** One element of `list`, uniformly. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
  };
}
