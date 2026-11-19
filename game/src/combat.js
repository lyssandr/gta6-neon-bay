// Combat: a hitscan pistol with ammo and reload, rival gang members who
// shoot back, muzzle flash, tracer lines and hit markers. Enemies are simple
// state machines: idle, chase the player, shoot when in range.
import * as THREE from 'three';

export function createCombat(scene, rand) {
  const enemies = [];
  const tracers = [];
  const bodyGeo = new THREE.CylinderGeometry(0.38, 0.48, 1.15, 8);
  const headGeo = new THREE.SphereGeometry(0.3, 10, 8);
  let ammo = 12, reserve = 48;
  let shootCooldown = 0;

  function spawnEnemies(target, count) {
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x8e1616 }));
      body.position.y = 0.9; g.add(body);
      const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 1.7; g.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.3, 1.1, 0.5); g.add(gun);
      const a = (i / count) * Math.PI * 2;
      const x = target.x + Math.sin(a) * 14, z = target.z + Math.cos(a) * 14;
      g.position.set(x, 0, z); scene.add(g);
      enemies.push({ mesh: g, x, z, health: 3, shootTimer: rand.range(1, 2.5), alive: true });
    }
  }
  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }
  function tracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || 0xffe27a }));
    scene.add(line); tracers.push({ line, life: 0.08 });
  }
  function stepTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
    }
  }
  // Player shoots toward a world point. Returns the enemy hit, if any.
  function playerShoot(origin, dir, onHit) {
    if (shootCooldown > 0 || ammo <= 0) return null;
    shootCooldown = 0.22; ammo -= 1;
    const end = origin.clone().add(dir.clone().multiplyScalar(90));
    let best = null, bestT = 90;
    const ray = new THREE.Raycaster(origin, dir, 0, 90);
    for (const e of enemies) {
      if (!e.alive) continue;
      const hit = ray.intersectObject(e.mesh, true)[0];
      if (hit && hit.distance < bestT) { bestT = hit.distance; best = e; }
    }
    const hitPoint = best ? origin.clone().add(dir.clone().multiplyScalar(bestT)) : end;
    tracer(origin.clone().add(dir.clone().multiplyScalar(1.5)), hitPoint);
    if (best) {
      best.health -= 1;
      if (best.health <= 0) { best.alive = false; scene.remove(best.mesh); onHit(best, true); }
      else onHit(best, false);
    }
    return best;
  }
  function reload() {
    if (reserve <= 0 || ammo === 12) return false;
    const need = 12 - ammo, take = Math.min(need, reserve);
    ammo += take; reserve -= take; return true;
  }
  // Enemies advance on the player and fire with poor aim at range.
  function stepEnemies(dt, player, onPlayerHit) {
    shootCooldown = Math.max(0, shootCooldown - dt);
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist > 12) {
        e.x += (dx / dist) * 5 * dt; e.z += (dz / dist) * 5 * dt;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 38) {
        e.shootTimer = rand.range(1.2, 2.2);
        const from = new THREE.Vector3(e.x, 1.2, e.z);
        const aim = new THREE.Vector3(player.x + rand.range(-1.5, 1.5), 1.2, player.z + rand.range(-1.5, 1.5));
        tracer(from, aim, 0xff5555);
        if (dist < 22 && Math.random() < 0.45) onPlayerHit(8);
      }
    }
    stepTracers(dt);
  }
  return {
    get enemies() { return enemies; },
    get ammo() { return ammo; },
    get reserve() { return reserve; },
    get aliveCount() { return enemies.filter((e) => e.alive).length; },
    spawnEnemies, clearEnemies, playerShoot, reload, stepEnemies, stepTracers,
    addAmmo(n) { reserve += n; },
  };
}
