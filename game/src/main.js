// Neon Bay: boot and the one loop. The player walks the streets of a neon
// grid city, steals cars, runs from the police and works through six story
// missions for Dana and Marco. Fixed 1/60 s steps, third-person camera,
// mouse-drag orbit, and ?shot= scenes that stage a reproducible screenshot.
import * as THREE from 'three';
import { STEP, CITY, PLAYER, START_CASH, MISSIONS, districtAt } from './config.js';
import { createRandom } from './random.js';
import { createCity, clampToCity, moveCircle } from './city.js';
import { createCar, driveCar, nearestCar, randomCarColor, randomCarName, carDistance } from './vehicles.js';
import { createTraffic, createPedestrians } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createSave } from './save.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;
const rand = createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight));

const city = createCity(rand);

// Mission targets are hand-placed at block centres, but a tower can cover
// one: with the default seed the first job's marker sat inside a building
// whose nearest reachable point is 6.25 units away, outside the 6-unit
// completion radius, so the job could never be completed. Snap any target
// (or return point) that is not open ground to the nearest open point, so
// every job is completable on any seed. The beacon, HUD and mission logic
// all read the same coordinates, so they follow automatically.
function snapTargets() {
  const CLEAR = 1.5; // marker clearance from building faces, in units
  const blocked = (x, z) => city.colliders.some((c) =>
    x > c.minX - CLEAR && x < c.maxX + CLEAR && z > c.minZ - CLEAR && z < c.maxZ + CLEAR);
  function snap(p) {
    if (!blocked(p.x, p.z)) return p;
    for (let r = 1; r <= 40; r++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r;
        if (!blocked(x, z)) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
      }
    }
    return p;
  }
  for (const m of MISSIONS) {
    m.target = snap(m.target);
    if (m.returnTo) m.returnTo = snap(m.returnTo);
  }
}
snapTargets();
const scene = city.scene;
const traffic = createTraffic(scene, rand, city.colliders, 14);
const peds = createPedestrians(scene, rand, 22, city.colliders);
const police = createPolice(scene, rand);
const combat = createCombat(scene, rand);
const audio = createAudio();
const hud = createHud();
const save = createSave();
const input = createInput(canvas);

// Parked cars the player can steal. Spots are shuffled (seeded) so the ten
// cars spread across the whole city instead of clustering in one corner,
// and one is always near the spawn so the first mission starts fast.
const parkedSpots = [...city.parkedSpots];
for (let i = parkedSpots.length - 1; i > 0; i--) {
  const j = Math.floor(rand.next() * (i + 1));
  [parkedSpots[i], parkedSpots[j]] = [parkedSpots[j], parkedSpots[i]];
}
parkedSpots.sort((a, b) => (Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)));
const chosenSpots = [parkedSpots[0], ...parkedSpots.slice(1).filter((_, i) => i % 5 === 0).slice(0, 9)];
const parkedCars = [];
chosenSpots.forEach((s, i) => {
  const car = createCar(`parked-${i}`, s.x, s.z, s.angle, randomCarColor(rand), randomCarName(rand), false);
  car.isParked = true; scene.add(car.mesh); parkedCars.push(car);
});
const allCars = () => [...parkedCars, ...traffic.cars, ...police.cars];

// The player, on foot: a simple figure with a jacket, head and legs.
function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.15, 10),
    new THREE.MeshLambertMaterial({ color: 0xff2d95 }));
  jacket.position.y = 0.9; g.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.7; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 1.92; g.add(cap);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x223344 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), legMat);
  legL.position.set(-0.16, 0.3, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

const player = {
  x: 0, z: 8, angle: 0, health: PLAYER.health, inCar: false, car: null,
  mesh: buildPlayerMesh(), walkPhase: 0, invulnerable: 0,
};
player.mesh.position.set(player.x, 0, player.z);
scene.add(player.mesh);

const game = {
  cash: START_CASH, missionIndex: 0, missionsDone: 0, kills: 0, carsStolen: 0,
  bestCash: START_CASH, screen: 'title', camYaw: 0, camPitch: 0.32,
  player, police, traffic, peds, combat, city, scene, parkedCars,
  get wanted() { return police.wanted; },
};
let missions = createMissions(onMissionEvent);
let autosaveTimer = 0;

function announce(text) { status.textContent = text; }

function missionTarget() {
  const m = missions.current();
  if (!m || missions.state !== 'active') return null;
  if (m.type === 'pickup' && missions.pickedUp) return m.returnTo;
  return m.target;
}

function onMissionEvent(kind, mission, extra) {
  if (kind === 'start') {
    if (mission.type === 'combat') combat.spawnEnemies(mission.target, mission.enemies);
    if (mission.wanted) police.setWanted(mission.wanted, 'mission');
    city.moveBeacon(mission.target.x, mission.target.z);
    hud.showMessage(`${mission.title} — ${mission.brief}`, 5000);
    announce(`${mission.title}. ${mission.brief}`);
  } else if (kind === 'pickup') {
    hud.showMessage('Package grabbed. Bring it back to Dana.', 3500);
    audio.pickup();
    city.moveBeacon(mission.returnTo.x, mission.returnTo.z);
  } else if (kind === 'kill') {
    game.kills += 1;
    hud.showMessage(`Rival down. ${extra} left.`, 2000);
    audio.pickup();
  } else if (kind === 'still-wanted') {
    hud.showMessage('Still wanted! Break line of sight and lay low.', 3000);
  } else if (kind === 'complete') {
    const reward = mission.reward;
    game.cash += reward; game.missionsDone += 1; game.bestCash = Math.max(game.bestCash, game.cash);
    // The story index lives on the missions object, not on game: game
    // .missionIndex was initialised to 0 and never updated, so every save
    // wrote missionIndex 0 and Continue always restarted the story at
    // job 1 (replaying it farmed the reward again). Sync it first.
    game.missionIndex = missions.index;
    combat.clearEnemies(); police.clear(); city.hideBeacon();
    audio.missionDone(); audio.cash();
    hud.showMessage(`${mission.title} complete! +$${reward}`, 4500);
    save.write(game);
    if (missions.index >= 6) {
      game.screen = 'complete';
      hud.showScreen('complete', 'NEON BAY', storyCompleteHtml(), 'Press Enter to keep roaming free.');
    } else {
      startMission();
    }
  } else if (kind === 'fail') {
    combat.clearEnemies(); police.clear(); city.hideBeacon();
    hud.showMessage(`Job failed: ${extra}. Try again.`, 4000);
    audio.busted();
    startMission();
  }
}

function startMission() {
  const m = missions.start();
  if (m) { /* beacon and briefing come from onMissionEvent('start') */ }
}

function applySave(data) {
  game.cash = data.cash ?? START_CASH;
  game.missionsDone = data.missionsDone ?? 0;
  game.kills = data.kills ?? 0;
  game.carsStolen = data.carsStolen ?? 0;
  game.bestCash = data.bestCash ?? game.cash;
  missions.index = data.missionIndex ?? 0;
}

function storyIntroHtml() {
  return `<p><b>Ray "Vex" Marlowe</b> is out of lockup and owes the harbour crew
  $5,000. One city, six jobs, and every cop in <b>Neon Bay</b> watching.</p>
  <p>Walk the streets, steal a car with <b>E</b>, outrun the police, and work the
  jobs for <b>Dana</b> and <b>Marco</b> — from a first set of wheels to the big getaway.</p>
  <p><b>WASD</b> move / drive &nbsp;·&nbsp; <b>Mouse drag</b> camera &nbsp;·&nbsp; <b>Click</b> shoot
  &nbsp;·&nbsp; <b>F</b> punch &nbsp;·&nbsp; <b>Space</b> brake &nbsp;·&nbsp; <b>R</b> reload &nbsp;·&nbsp; <b>P</b> pause</p>
  <p>Your progress saves automatically. Wanted stars bring the police — lose them by breaking line of sight.</p>`;
}
function storyCompleteHtml() {
  return `<p><b>You did it.</b> Six jobs, the harbour crew paid off, and Neon Bay is yours.
  Final haul: <b>$${game.cash.toLocaleString()}</b>, ${game.kills} rivals down, ${game.carsStolen} cars borrowed.</p>
  <p>Free roam continues: steal cars, dodge the police and chase your best cash.</p>`;
}

function showTitle() {
  game.screen = 'title';
  const saved = save.read();
  const primary = document.getElementById('btn-primary');
  const secondary = document.getElementById('btn-secondary');
  primary.textContent = saved ? 'Continue' : 'Start the Story';
  secondary.textContent = saved ? 'New Game' : 'Free Roam';
  secondary.style.display = '';
  hud.showScreen('title', 'NEON BAY', storyIntroHtml() +
    (saved ? `<p>Save found: <b>$${saved.cash.toLocaleString()}</b>, job ${Math.min(saved.missionIndex + 1, 6)} of 6.</p>` : ''),
    'Click Start, or press Enter.');
  primary.onclick = () => { audio.unlock(); if (saved) applySave(saved); beginPlay(); };
  secondary.onclick = () => { audio.unlock(); save.clear(); beginPlay(); };
}

function beginPlay() {
  hud.hideScreen();
  game.screen = 'play';
  audio.startMusic();
  if (missions.state === 'idle' && missions.index < 6) startMission();
  announce('Playing Neon Bay.');
}

function bustPlayer(reason) {
  const fine = Math.min(200, game.cash);
  game.cash -= fine;
  police.clear(); combat.clearEnemies(); city.hideBeacon();
  player.health = PLAYER.health;
  if (player.inCar) { player.inCar = false; player.car = null; }
  player.x = 0; player.z = 8; player.angle = 0;
  game.screen = 'busted';
  audio.busted(); audio.stopMusic();
  save.write(game);
  hud.showScreen('busted', 'BUSTED', `<p>${reason}</p><p>The Neon Bay police took <b>$${fine}</b> and dropped you back at the garage. Your jobs are still waiting.</p>`, 'Press Enter to get back out there.');
  const primary = document.getElementById('btn-primary');
  primary.textContent = 'Back on the Streets';
  primary.onclick = () => { audio.unlock(); audio.startMusic(); hud.hideScreen(); game.screen = 'play'; startMission(); };
  document.getElementById('btn-secondary').style.display = 'none';
}

function wastedPlayer() {
  game.cash = Math.max(0, game.cash - 150);
  police.clear(); combat.clearEnemies(); city.hideBeacon();
  player.health = PLAYER.health;
  if (player.inCar) { player.inCar = false; player.car = null; }
  player.x = 0; player.z = 8;
  game.screen = 'busted';
  audio.busted();
  save.write(game);
  hud.showScreen('busted', 'WASTED', '<p>You got taken down on the streets of Neon Bay. The crew patched you up — $150 for the hospital.</p>', 'Press Enter to get back out there.');
  const primary = document.getElementById('btn-primary');
  primary.textContent = 'Back on the Streets';
  primary.onclick = () => { audio.unlock(); hud.hideScreen(); game.screen = 'play'; startMission(); };
  document.getElementById('btn-secondary').style.display = 'none';
}

// --- movement -------------------------------------------------------------
function stepOnFoot(dt, move) {
  const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const fx = Math.sin(game.camYaw), fz = Math.cos(game.camYaw);
  const rx = Math.cos(game.camYaw), rz = -Math.sin(game.camYaw);
  let mx = fx * move.f + rx * move.s;
  let mz = fz * move.f + rz * move.s;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    player.angle = Math.atan2(mx, mz);
    const moved = moveCircle(city.colliders, player.x, player.z, mx * speed * dt, mz * speed * dt, PLAYER.radius);
    player.x = moved.x; player.z = moved.z;
    player.walkPhase += dt * speed * 1.6;
  }
  const clamped = clampToCity(player.x, player.z);
  player.x = clamped.x; player.z = clamped.z;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.angle;
  const swing = len > 0.01 ? Math.sin(player.walkPhase) * 0.5 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  // Bump into pedestrians: they scatter.
  for (const p of peds.peds) {
    if (p.alive && Math.hypot(p.x - player.x, p.z - player.z) < 1.2) p.panic = 2;
  }
}

function enterCar(car) {
  player.inCar = true; player.car = car;
  car.stolen = true; car.isParked = false;
  if (car.isParked || !car.driver) {
    game.carsStolen += 1;
    if (police.wanted === 0) {
      police.addCrime(1);
      hud.showMessage(`Stole a ${car.name}! The cops noticed.`, 3000);
    }
  }
  player.mesh.visible = false;
  audio.pickup();
}
function exitCar() {
  if (!player.car) return;
  const car = player.car;
  player.inCar = false; player.car = null;
  player.x = car.x - Math.cos(car.angle) * 2.2;
  player.z = car.z + Math.sin(car.angle) * 2.2;
  player.angle = car.angle;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
}

function checkCarCrime(dt) {
  const car = player.car;
  if (!car) return;
  for (const t of traffic.cars) {
    if (carDistance(car, t) < 3.4 && Math.abs(car.speed) > 12) {
      car.speed *= 0.5; t.speed = 0;
      audio.crash();
      police.addCrime(1);
      hud.showMessage('You rammed traffic! Wanted level up.', 2500);
    }
  }
  for (const p of peds.peds) {
    if (!p.alive) continue;
    if (Math.hypot(p.x - car.x, p.z - car.z) < 1.8 && Math.abs(car.speed) > 4) {
      p.alive = false; p.mesh.rotation.x = Math.PI / 2; p.mesh.position.y = 0.3;
      audio.crash();
      police.addCrime(2);
      hud.showMessage('Pedestrian hit! Wanted level up.', 3000);
    }
  }
}

function step(dt) {
  const move = input.move();
  const mouse = input.takeMouse();
  game.camYaw -= mouse.dx * 0.004;
  game.camPitch = Math.max(0.05, Math.min(1.1, game.camPitch + mouse.dy * 0.003));
  const actions = input.takeActions();

  if (actions & ACTION_PAUSE) {
    if (game.screen === 'play') {
      game.screen = 'paused';
      hud.showScreen('paused', 'PAUSED', '<p>Neon Bay waits for no one — except right now.</p><p><b>WASD</b> move · <b>E</b> enter car · <b>Click</b> shoot · <b>F</b> punch · <b>Space</b> brake · <b>R</b> reload</p>', 'Press P or Enter to resume.');
      document.getElementById('btn-primary').textContent = 'Resume';
      document.getElementById('btn-primary').onclick = () => { hud.hideScreen(); game.screen = 'play'; };
      document.getElementById('btn-secondary').style.display = '';
      document.getElementById('btn-secondary').textContent = 'Save & Quit to Title';
      document.getElementById('btn-secondary').onclick = () => { save.write(game); showTitle(); };
      save.write(game);
    } else if (game.screen === 'paused') { hud.hideScreen(); game.screen = 'play'; }
    return;
  }
  if (game.screen !== 'play') {
    if (actions & ACTION_CONFIRM) {
      const primary = document.getElementById('btn-primary');
      if (primary && document.getElementById('screen').style.display !== 'none') primary.click();
    }
    return;
  }

  // Enter / exit cars.
  if (actions & ACTION_ENTER) {
    if (player.inCar) exitCar();
    else {
      const car = nearestCar(allCars(), player.x, player.z, 4.5);
      if (car && !police.cars.includes(car)) enterCar(car);
    }
  }
  // Punch: nearest pedestrian or rival within reach.
  if (actions & ACTION_PUNCH && !player.inCar) {
    let hitSomething = false;
    for (const e of combat.enemies) {
      if (e.alive && Math.hypot(e.x - player.x, e.z - player.z) < 2.4) {
        e.health -= 1; hitSomething = true;
        if (e.health <= 0) { e.alive = false; scene.remove(e.mesh); missions.registerKill(); }
      }
    }
    for (const p of peds.peds) {
      if (p.alive && Math.hypot(p.x - player.x, p.z - player.z) < 2) {
        p.alive = false; p.mesh.rotation.x = Math.PI / 2; p.mesh.position.y = 0.3;
        hitSomething = true; police.addCrime(2);
        hud.showMessage('You attacked a pedestrian! Wanted level up.', 3000);
      }
    }
    if (hitSomething) audio.punch();
  }
  if (actions & ACTION_RELOAD) { if (combat.reload()) hud.showMessage('Reloaded.', 1200); }

  // Shooting: click fires from the camera's aim while on foot. The shot
  // direction is horizontal along the camera yaw, from chest height: using
  // the camera's world direction pitched the ray down (the camera sits 3.2
  // high looking down at the player), so beyond ~6 units the ray passed
  // under the rivals' feet and the pistol could never hit them. Verified:
  // 5 aimed shots at 13-21 units, 0 hits, ammo 12 -> 7.
  if (input.takeClick() && !player.inCar) {
    audio.unlock();
    const origin = new THREE.Vector3(player.x, 1.0, player.z);
    const dir = new THREE.Vector3(Math.sin(game.camYaw), 0, Math.cos(game.camYaw));
    combat.playerShoot(origin, dir, (enemy, killed) => {
      if (killed) { missions.registerKill(); game.kills += 1; }
    });
    audio.shoot();
    // Shooting in public attracts the police, except on the combat job:
    // there the rivals ARE the job, and summoning a 2-star chase on the
    // first shot turned the shootout into a bust-or-be-shot trap (the
    // player fights 4 armed rivals while police cars close in on foot).
    if (missions.current()?.type !== 'combat') police.addCrime(2);
  }

  // Movement.
  if (player.inCar && player.car) {
    const wasHit = driveCar(player.car, move, dt, city.colliders, input.brake);
    if (wasHit && Math.abs(player.car.speed) > 8) audio.crash();
    checkCarCrime(dt);
  } else {
    stepOnFoot(dt, move);
  }

  // World systems.
  traffic.step(dt, player.car);
  peds.step(dt, player.inCar && player.car ? { x: player.car.x, z: player.car.z } : { x: player.x, z: player.z });
  police.step(dt, {
    x: player.inCar && player.car ? player.car.x : player.x,
    z: player.inCar && player.car ? player.car.z : player.z,
    inCar: player.inCar, car: player.car,
  }, () => bustPlayer('The Neon Bay police caught you.'), city.colliders);
  combat.stepEnemies(dt, { x: player.inCar && player.car ? player.car.x : player.x, z: player.inCar && player.car ? player.car.z : player.z }, (dmg) => {
    if (player.invulnerable <= 0) {
      player.health -= dmg; player.invulnerable = 0.6;
      if (player.health <= 0) wastedPlayer();
    }
  });
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  if (police.wanted === 0 && player.health < PLAYER.health) player.health = Math.min(PLAYER.health, player.health + 2 * dt);

  // Missions.
  const missionResult = missions.step(dt, {
    x: player.inCar && player.car ? player.car.x : player.x,
    z: player.inCar && player.car ? player.car.z : player.z,
    wanted: police.wanted,
  });
  if (missionResult === 'complete') missions.complete(game.cash);
  else if (missionResult === 'fail') { /* onMissionEvent already restarted it */ }
  // Keep the save's story index in sync (see the 'complete' branch above).
  game.missionIndex = missions.index;

  // Audio + autosave.
  audio.engine(player.inCar && player.car ? player.car.speed : 0, player.inCar);
  audio.siren(police.wanted > 0);
  audio.musicTimer += dt;
  if (audio.musicTimer > 0.14) { audio.musicTimer = 0; audio.musicStep(); }
  autosaveTimer += dt;
  if (autosaveTimer > 30) { autosaveTimer = 0; save.write(game); }

  // HUD.
  const target = missionTarget();
  hud.update({
    cash: game.cash, health: player.health, wanted: police.wanted,
    inCar: player.inCar, onFoot: !player.inCar, speed: player.car ? player.car.speed : 0,
    carName: player.car ? player.car.name : '', ammo: combat.ammo, reserve: combat.reserve,
    objective: missions.objectiveText(), district: districtAt(player.x, player.z),
  }, dt);
  hud.drawMinimap(CITY.half, {
    x: player.inCar && player.car ? player.car.x : player.x,
    z: player.inCar && player.car ? player.car.z : player.z,
    angle: player.inCar && player.car ? player.car.angle : player.angle,
  }, traffic.cars, police.cars, peds.peds, target, combat.enemies);
}

// --- camera ----------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
function updateCamera(dt) {
  const focus = player.inCar && player.car
    ? { x: player.car.x, z: player.car.z, angle: player.car.angle, h: 1.6 }
    : { x: player.x, z: player.z, angle: player.angle, h: 1.7 };
  // Camera follows behind the car heading, or behind the player's view yaw on foot.
  const yaw = player.inCar ? focus.angle : game.camYaw;
  const dist = player.inCar ? 11 : 7.5;
  const height = player.inCar ? 4.2 : 3.2;
  const cx = focus.x - Math.sin(yaw) * dist;
  const cz = focus.z - Math.cos(yaw) * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(focus.x, focus.h, focus.z);
}

// --- main loop --------------------------------------------------------------
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (game.screen === 'title') {
    // Slow cinematic orbit behind the title screen.
    game.camYaw += 0.0004;
    camera.position.set(Math.sin(now * 0.00005) * 60, 26, Math.cos(now * 0.00005) * 60);
    camera.lookAt(0, 4, 0);
    traffic.step(1 / 60, null);
    peds.step(1 / 60, null);
    renderer.render(scene, camera);
    return;
  }
  if (game.screen !== 'play') {
    // step() only runs on the play screen, so the keys that dismiss the
    // other screens would otherwise never be consumed: P/Esc/Enter did
    // nothing on pause (the screen promises "Press P or Enter to resume")
    // and Enter did nothing on busted/wasted/complete. Only the mouse
    // worked. Handle them here instead.
    const actions = input.takeActions();
    if (game.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      hud.hideScreen(); game.screen = 'play';
    } else if (actions & ACTION_CONFIRM) {
      const primary = document.getElementById('btn-primary');
      if (primary && document.getElementById('screen').style.display !== 'none') primary.click();
    }
  }
  while (accumulator >= STEP && game.screen !== 'title') {
    if (game.screen === 'play') step(STEP);
    accumulator -= STEP;
    if (game.screen !== 'play') { accumulator = 0; break; }
  }
  if (game.screen !== 'title') updateCamera(STEP);
  renderer.render(scene, camera);
}

if (shot) {
  // Staged screenshot: build the scene, run a few fixed steps, paint twice.
  game.screen = 'play';
  hud.hideScreen();
  stageShot(game, shot, { missions, startMission, enterCar, applySave });
  let painted = 0;
  function paintShot() {
    for (let i = 0; i < 5; i++) step(STEP);
    updateCamera(STEP);
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
