// The HUD: cash, health, wanted stars, speed, ammo, mission objective,
// message toasts, a live 2D minimap (roads, player, cars, police, marker),
// and the start / pause / busted / story-complete screens.
import { WANTED_MAX } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash'), healthEl = el('hud-health'), healthFill = el('health-fill');
  const starsEl = el('hud-stars'), speedEl = el('hud-speed'), ammoEl = el('hud-ammo');
  const objEl = el('hud-objective-text'), msgEl = el('hud-message'), clockEl = el('hud-clock');
  const screenEl = el('screen'), screenTitle = el('screen-title'), screenBody = el('screen-body');
  const screenHint = el('screen-hint'), districtEl = el('hud-district');
  const map = el('minimap');
  const mapCtx = map.getContext('2d');
  let msgTimer = null;
  let clock = 12 * 60 + 34; // in-game clock, minutes after midnight

  function showMessage(text, ms) {
    msgEl.textContent = text; msgEl.style.opacity = '1';
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msgEl.style.opacity = '0'; }, ms || 3200);
  }
  function showScreen(kind, title, body, hint) {
    screenEl.style.display = 'flex';
    screenEl.dataset.kind = kind;
    screenTitle.textContent = title; screenBody.innerHTML = body; screenHint.textContent = hint || '';
  }
  function hideScreen() { screenEl.style.display = 'none'; }
  function update(state, dt) {
    clock = (clock + dt * 2) % 1440;
    const hh = String(Math.floor(clock / 60)).padStart(2, '0');
    const mm = String(Math.floor(clock % 60)).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}`;
    cashEl.textContent = `$${state.cash.toLocaleString()}`;
    healthFill.style.width = `${Math.max(0, state.health)}%`;
    healthFill.style.background = state.health > 50 ? '#37d67a' : state.health > 25 ? '#f5a623' : '#e74c3c';
    healthEl.textContent = `HP ${Math.ceil(state.health)}`;
    starsEl.textContent = '★'.repeat(state.wanted) + '☆'.repeat(WANTED_MAX - state.wanted);
    starsEl.style.color = state.wanted > 0 ? '#ffcf3f' : '#888';
    speedEl.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 2.4)} mph` : state.onFoot ? 'ON FOOT' : '';
    ammoEl.textContent = state.inCar ? state.carName : `AMMO ${state.ammo} / ${state.reserve}`;
    objEl.textContent = state.objective;
    districtEl.textContent = state.district;
  }
  // Minimap: top-down roads + blips. worldHalf maps the city to the canvas.
  function drawMinimap(worldHalf, player, cars, policeCars, peds, marker, enemies) {
    const S = 150, c = mapCtx;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(10,18,28,0.85)'; c.fillRect(0, 0, S, S);
    const toMap = (x, z) => [S / 2 + (x / (worldHalf + 20)) * (S / 2), S / 2 + (z / (worldHalf + 20)) * (S / 2)];
    c.strokeStyle = '#5a6a7a'; c.lineWidth = 5;
    for (let i = -5; i <= 5; i++) {
      const p = i * 50;
      const [x1, y1] = toMap(p, -worldHalf); const [x2, y2] = toMap(p, worldHalf);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      const [x3, y3] = toMap(-worldHalf, p); const [x4, y4] = toMap(worldHalf, p);
      c.beginPath(); c.moveTo(x3, y3); c.lineTo(x4, y4); c.stroke();
    }
    c.fillStyle = '#2a7fa8'; c.fillRect(0, S - 14, S, 14); // sea
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      c.fillStyle = '#ff2d95'; c.beginPath(); c.arc(mx, my, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(mx, my, 9, 0, Math.PI * 2); c.stroke();
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      const [ex, ey] = toMap(e.x, e.z);
      c.fillStyle = '#ff2222'; c.fillRect(ex - 3, ey - 3, 6, 6);
    }
    for (const car of cars) {
      const [cx, cy] = toMap(car.x, car.z);
      c.fillStyle = '#ffd23f'; c.fillRect(cx - 2, cy - 2, 4, 4);
    }
    for (const pc of policeCars) {
      const [px, py] = toMap(pc.x, pc.z);
      c.fillStyle = '#3fa9ff'; c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill();
    }
    const [px, py] = toMap(player.x, player.z);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#37d67a'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 7, 0, Math.PI * 2); c.stroke();
    // View direction wedge.
    c.strokeStyle = '#37d67a'; c.beginPath(); c.moveTo(px, py);
    c.lineTo(px + Math.sin(player.angle) * 12, py + Math.cos(player.angle) * 12); c.stroke();
  }
  return { showMessage, showScreen, hideScreen, update, drawMinimap };
}
