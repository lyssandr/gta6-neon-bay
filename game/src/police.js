// The wanted system: stars 0-5, police cars that spawn at the edge of sight
// and ram the player, a heat timer that cools off when the player stays out of
// sight, and BUSTED when a police car catches the player on foot or wrecks
// the player's car at high wanted levels.
import { WANTED_MAX } from './config.js';
import { createCar, carDistance } from './vehicles.js';
import { moveCircle } from './city.js';

export function createPolice(scene, rand) {
  let wanted = 0;
  let heat = 0; // seconds of unseen time banked toward cooling off
  let bustedTimer = 0;
  const cars = [];

  function setWanted(level, reason) {
    const before = wanted;
    wanted = Math.max(0, Math.min(WANTED_MAX, level));
    if (wanted > before) heat = 0;
    return { changed: wanted !== before, reason };
  }
  function addCrime(level) { return setWanted(Math.max(wanted, level), 'crime'); }
  function spawnPoliceCar(player) {
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.sin(angle) * 55, z = player.z + Math.cos(angle) * 55;
    const car = createCar(`police-${cars.length}-${Date.now() % 100000}`, x, z, angle, 0x111111, 'Interceptor', true);
    car.cruise = 20 + wanted * 3;
    scene.add(car.mesh); cars.push(car);
    return car;
  }
  function step(dt, player, onBusted, colliders) {
    // Keep one police car per wanted star, up to the cap.
    const wantCount = wanted === 0 ? 0 : Math.min(wanted, 3);
    while (cars.length < wantCount) spawnPoliceCar(player);
    while (cars.length > wantCount) {
      const c = cars.pop(); scene.remove(c.mesh);
    }
    let nearest = Infinity;
    for (const car of cars) {
      const dx = player.x - car.x, dz = player.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      nearest = Math.min(nearest, dist);
      const wantAngle = Math.atan2(dx, dz);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      car.speed = Math.min(car.cruise || 24, car.speed + 14 * dt);
      // Police drive on the streets like everyone else: the old code moved
      // them straight through buildings, so on a loop escape they cut every
      // corner diagonally and intercepted the player at the next turn,
      // making a 3-star chase effectively unlosable even at top speed.
      const moved = moveCircle(colliders || [], car.x, car.z, Math.sin(car.angle) * car.speed * dt, Math.cos(car.angle) * car.speed * dt, 1.6);
      car.x = moved.x; car.z = moved.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
      // Ram: shove the player's car, or bust the player on foot.
      if (dist < 3.2) {
        if (!player.inCar) {
          bustedTimer += dt;
          if (bustedTimer > 1.2) { onBusted(); bustedTimer = 0; }
        } else if (player.car) {
          // Ram: shove the player's car and drag its speed. The drag used
          // to multiply the speed by 0.92 EVERY FRAME while a patrol car
          // was in contact, a 99% speed loss per second: the car was pinned
          // at ~5 u/s, the patrol car stayed glued to it, and the wanted
          // level could never decay, so a 3-star chase was unlosable. A
          // fixed per-second drag lets the player power away.
          player.car.speed = Math.max(0, player.car.speed - 10 * dt);
          const shove = moveCircle(colliders || [], player.car.x, player.car.z,
            Math.sin(car.angle) * 2.2 * dt * 10, Math.cos(car.angle) * 2.2 * dt * 10, 1.6);
          player.car.x = shove.x; player.car.z = shove.z;
          player.car.mesh.position.set(player.car.x, 0, player.car.z);
        }
      }
    }
    // Cool off: 12 s unseen at low wanted, longer at high wanted.
    // The bust timer only counts continuous contact: without this reset
    // it banked time across separate brushes all game, so a player who
    // brushed a patrol car twice minutes apart got busted on the second
    // brush, and a player starting Hot Wheels on foot (after walking in
    // the previous job's return) could be busted in under a second.
    if (nearest >= 3.2) bustedTimer = 0;
    if (wanted > 0) {
      if (nearest > 45) { heat += dt; if (heat > 10 + wanted * 4) { wanted -= 1; heat = 0; } }
      else heat = Math.max(0, heat - dt * 2);
    }
    return { nearest };
  }
  function clear() {
    wanted = 0; heat = 0;
    for (const c of cars) scene.remove(c.mesh);
    cars.length = 0;
  }
  return {
    get wanted() { return wanted; },
    get cars() { return cars; },
    setWanted, addCrime, step, clear,
  };
}
