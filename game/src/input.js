// Keyboard and mouse input. WASD/arrows move, Shift runs, E enters/exits a car,
// Space brakes / handbrakes, F punches, R reloads, M mutes, P/Esc pauses.
// Mouse drag orbits the camera; click shoots when on foot or fires the horn in a car.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0, mouseDY = 0;
  let clicked = false;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let pointerLocked = false;

  function key(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }
  window.addEventListener('keydown', (e) => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    const k = key(e);
    if (!e.repeat) {
      if (k === ' ' || k === 'Enter') actions |= ACTION_CONFIRM;
      if (k === 'p' || k === 'Escape') actions |= ACTION_PAUSE;
      if (k === 'e') actions |= ACTION_ENTER;
      if (k === 'f') actions |= ACTION_PUNCH;
      if (k === 'r') actions |= ACTION_RELOAD;
    }
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(key(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    clicked = true;
    if (e.button === 0 && !pointerLocked) {
      try { canvas.requestPointerLock(); } catch { /* pointer lock is optional */ }
    }
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (pointerLocked) { mouseDX += e.movementX; mouseDY += e.movementY; return; }
    if (dragging) { mouseDX += e.clientX - lastX; mouseDY += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; }
  });
  document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });

  function axis(neg, pos) { return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0); }
  return {
    // Forward/back and strafe/steer in [-1, 1].
    move() { return { f: axis('s', 'w') + axis('ArrowDown', 'ArrowUp'), s: axis('a', 'd') + axis('ArrowLeft', 'ArrowRight') }; },
    get run() { return keys.has('Shift'); },
    get brake() { return keys.has(' '); },
    get muted() { return keys.has('m'); },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    takeClick() { const c = clicked; clicked = false; return c; },
    takeActions() { const a = actions; actions = 0; return a; },
  };
}
