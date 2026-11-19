// Missions and story: a six-job chain with four objective types (goto, pickup,
// combat, deliver, escape). The mission manager owns the current objective,
// its timer, the target marker and the payout; main.js drives the player.
import { MISSIONS } from './config.js';

export function createMissions(onEvent) {
  let index = 0;
  let state = 'idle'; // idle | active | done
  let timer = 0;
  let killsLeft = 0;
  let pickedUp = false;
  let elapsed = 0;

  function current() { return MISSIONS[index] || null; }
  function start() {
    const m = current();
    if (!m) { state = 'done'; return null; }
    state = 'active'; timer = m.timeLimit || m.survive || 0; elapsed = 0;
    killsLeft = m.enemies || 0; pickedUp = false;
    onEvent('start', m);
    return m;
  }
  function complete(cash) {
    const m = current();
    state = 'idle'; index += 1;
    onEvent('complete', m, cash);
    return m;
  }
  function fail(reason) {
    state = 'idle';
    onEvent('fail', current(), reason);
  }
  // Called every frame while a mission is active. Returns 'complete' | 'fail' | null.
  function step(dt, ctx) {
    const m = current();
    if (!m || state !== 'active') return null;
    elapsed += dt;
    if (m.timeLimit) { timer -= dt; if (timer <= 0) { fail('Out of time'); return 'fail'; } }
    const dist = Math.hypot(ctx.x - m.target.x, ctx.z - m.target.z);
    if (m.type === 'goto' || m.type === 'deliver') {
      if (dist < 6) return 'complete';
    } else if (m.type === 'pickup') {
      if (!pickedUp && dist < 4) { pickedUp = true; onEvent('pickup', m); }
      else if (pickedUp && Math.hypot(ctx.x - m.returnTo.x, ctx.z - m.returnTo.z) < 6) return 'complete';
    } else if (m.type === 'combat') {
      if (killsLeft <= 0 && dist < 6) return 'complete';
    } else if (m.type === 'escape') {
      if (m.survive) {
        timer -= dt;
        if (timer <= 0 && ctx.wanted === 0) return 'complete';
        if (timer <= 0 && ctx.wanted > 0) { timer = 5; onEvent('still-wanted', m); }
      }
    }
    return null;
  }
  function registerKill() { killsLeft = Math.max(0, killsLeft - 1); onEvent('kill', current(), killsLeft); }
  function objectiveText() {
    const m = current();
    if (!m) return 'Story complete. Free roam Neon Bay.';
    if (state !== 'active') return `Next job: ${m.title} — press M to start (or walk to the marker).`;
    if (m.type === 'pickup') return pickedUp ? 'Return the package to Dana at the garage.' : `${m.title}: grab the package at the pink marker.`;
    if (m.type === 'combat') return `${m.title}: rivals left ${killsLeft}. Then reach the marker.`;
    if (m.type === 'escape') return `${m.title}: lose the cops — ${Math.max(0, Math.ceil(timer))}s left.`;
    if (m.timeLimit) return `${m.title}: ${Math.max(0, Math.ceil(timer))}s left. Reach the marker.`;
    return `${m.title}: reach the pink marker.`;
  }
  return {
    get index() { return index; },
    set index(v) { index = v; },
    get state() { return state; },
    get killsLeft() { return killsLeft; },
    get pickedUp() { return pickedUp; },
    get timer() { return timer; },
    current, start, complete, fail, step, registerKill, objectiveText,
  };
}
