// Seeded random numbers, so a ?seed=N run (and every screenshot) is reproducible.
export function createRandom(seed) {
  let s = (seed >>> 0) || 1;
  function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  }
  function range(a, b) { return a + (b - a) * next(); }
  function int(a, b) { return Math.floor(range(a, b + 1)); }
  function pick(list) { return list[Math.floor(next() * list.length)]; }
  function chance(p) { return next() < p; }
  return { next, range, int, pick, chance };
}
