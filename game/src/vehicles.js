// Cars: a boxy low-poly build (body, cabin, wheels, headlights) shared by the
// player's stolen rides, traffic and police. Driving is arcade: accelerate,
// steer, brake, handbrake drift, and building collisions that bounce and slow.
import * as THREE from 'three';
import { CAR, CAR_COLORS, CAR_NAMES } from './config.js';
import { moveCircle, clampToCity } from './city.js';

export function buildCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.05, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    l.position.set(sx, 0.6, 2.22); g.add(l);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.45, -0.2); g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createCar(id, x, z, angle, color, name, isPolice) {
  const mesh = buildCarMesh(color, isPolice);
  mesh.position.set(x, 0, z); mesh.rotation.y = angle;
  return {
    id, mesh, x, z, angle, speed: 0, color, name, isPolice: !!isPolice,
    stolen: false, health: 100, isParked: false, driver: null,
  };
}

// Arcade drive step. Returns true when the car hit a building this step.
export function driveCar(car, input, dt, colliders, brake) {
  const fwd = input.f;
  const steer = input.s;
  if (fwd > 0) car.speed += CAR.accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverse) * dt;
  else car.speed -= Math.sign(car.speed) * CAR.grip * dt * 0.4;
  if (brake) car.speed -= Math.sign(car.speed) * CAR.brake * 1.4 * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 0.05) car.speed = 0;
  const turnRate = CAR.turn * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 10);
  car.angle += steer * turnRate * dt * (brake ? 1.4 : 1);
  const nx = Math.sin(car.angle) * car.speed * dt;
  const nz = Math.cos(car.angle) * car.speed * dt;
  const hit = moveCircle(colliders, car.x, car.z, nx, nz, 1.6);
  if (hit.hit && Math.abs(car.speed) > 6) car.speed *= -0.25;
  else if (hit.hit) car.speed *= 0.4;
  // Stay in Neon Bay: without this the car could drive off the map
  // entirely (a full-speed escape reached x=2241 on open ground). The
  // on-foot player was already clamped; the car never was.
  const clamped = clampToCity(hit.x, hit.z);
  car.x = clamped.x; car.z = clamped.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  return hit.hit;
}

export function carDistance(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz);
}

// Nearest car the player can steal, within reach.
export function nearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    const d = Math.sqrt((c.x - x) ** 2 + (c.z - z) ** 2);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
export function randomCarName(rand) { return rand.pick(CAR_NAMES); }
export function randomCarColor(rand) { return rand.pick(CAR_COLORS); }
