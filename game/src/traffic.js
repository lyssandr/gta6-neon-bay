// Traffic and pedestrians: cars loop along the road grid, pedestrians stroll
// the sidewalks. Both keep the city alive and both react to the player: a
// pedestrian hit or a car rammed is a crime that raises the wanted level.
import * as THREE from 'three';
import { CITY } from './config.js';
import { createCar, driveCar, randomCarColor, randomCarName } from './vehicles.js';
import { moveCircle } from './city.js';

const LANE = 3.5; // cars drive on the right-hand lane of each road

export function createTraffic(scene, rand, colliders, count) {
  const cars = [];
  const roadCentres = [];
  for (let i = -CITY.blocks; i <= CITY.blocks; i++) roadCentres.push(i * CITY.pitch);
  function randomRoute() {
    // A rectangular loop around two random roads.
    const a = rand.pick(roadCentres), b = rand.pick(roadCentres);
    const c = rand.pick(roadCentres), d = rand.pick(roadCentres);
    return [{ x: a, z: c }, { x: b, z: c }, { x: b, z: d }, { x: a, z: d }];
  }
  for (let i = 0; i < count; i++) {
    const route = randomRoute();
    const p = route[0];
    const car = createCar(`traffic-${i}`, p.x, p.z, 0, randomCarColor(rand), randomCarName(rand), false);
    car.route = route; car.wp = 1; car.cruise = rand.range(9, 15);
    scene.add(car.mesh); cars.push(car);
  }
  function step(dt, playerCar) {
    for (const car of cars) {
      if (playerCar === car) continue;
      const target = car.route[car.wp];
      const dx = target.x - car.x, dz = target.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 4) { car.wp = (car.wp + 1) % car.route.length; continue; }
      const wantAngle = Math.atan2(dx, dz);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      // Slow down if another car is right ahead.
      let blocked = false;
      for (const other of cars) {
        if (other === car) continue;
        const ox = other.x - car.x, oz = other.z - car.z;
        if (ox * ox + oz * oz < 36 && Math.sin(car.angle) * ox + Math.cos(car.angle) * oz > 0) { blocked = true; break; }
      }
      car.speed = blocked ? Math.max(0, car.speed - 20 * dt) : Math.min(car.cruise, car.speed + 8 * dt);
      // Slide along buildings instead of cutting through block corners on
      // turns: the colliders were passed in but never used, so a turning
      // car clipped straight through the corner tower.
      const moved = moveCircle(colliders, car.x, car.z, Math.sin(car.angle) * car.speed * dt, Math.cos(car.angle) * car.speed * dt, 1.6);
      car.x = moved.x; car.z = moved.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
    }
  }
  return { cars, step };
}

export function createPedestrians(scene, rand, count, colliders = []) {
  const peds = [];
  const colors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x1abc9c, 0xe67e22, 0x9b59b6, 0xecf0f1, 0xfd79a8];
  const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.1, 8);
  const headGeo = new THREE.SphereGeometry(0.28, 10, 8);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: rand.pick(colors) });
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, mat); body.position.y = 0.85; g.add(body);
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xe8b88a })); head.position.y = 1.65; g.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), legMat); legL.position.set(-0.15, 0.3, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
    const x = rand.range(-CITY.half, CITY.half), z = rand.range(-CITY.half, CITY.half);
    g.position.set(x, 0, z); scene.add(g);
    peds.push({
      mesh: g, x, z, angle: rand.range(0, Math.PI * 2), speed: rand.range(1.2, 2.4),
      alive: true, panic: 0, legL, legR, phase: rand.range(0, 6),
    });
  }
  function step(dt, danger) {
    for (const p of peds) {
      if (!p.alive) continue;
      if (danger && Math.hypot(p.x - danger.x, p.z - danger.z) < 14) p.panic = 3;
      if (p.panic > 0) {
        p.panic -= dt; p.speed = 5;
        p.angle = Math.atan2(p.x - danger.x, p.z - danger.z);
      } else {
        p.speed = 1.6;
        if (Math.random() < dt * 0.15) p.angle += (Math.random() - 0.5) * 1.6;
      }
      // Slide along buildings instead of strolling through them: peds
      // wandered at random headings and crossed straight over tower
      // footprints. moveCircle resolves the step axis by axis, so a ped
      // meeting a wall slides along it instead of passing through.
      const moved = moveCircle(colliders, p.x, p.z, Math.sin(p.angle) * p.speed * dt, Math.cos(p.angle) * p.speed * dt, 0.5);
      p.x = moved.x; p.z = moved.z;
      if (Math.abs(p.x) > CITY.half + 30) p.angle += Math.PI;
      if (Math.abs(p.z) > CITY.half + 30) p.angle += Math.PI;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.angle;
      p.phase += dt * p.speed * 3;
      p.legL.rotation.x = Math.sin(p.phase) * 0.6;
      p.legR.rotation.x = -Math.sin(p.phase) * 0.6;
    }
  }
  return { peds, step };
}
