// Neon Bay itself: a sun-soaked grid city built from three.js boxes, with a
// procedural window texture, a beach on the south edge, palm trees, street
// lamps and a glowing mission beacon. Every building also registers an AABB
// collider the player, cars, traffic and police all respect.
import * as THREE from 'three';
import { CITY } from './config.js';

function windowTexture(rand, facade) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = facade; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) for (let x = 8; x < 120; x += 18) {
    const lit = rand.chance(0.35);
    g.fillStyle = lit ? (rand.chance(0.5) ? '#ffd27a' : '#9ad7ff') : '#3a4458';
    g.fillRect(x, y, 12, 14);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createCity(rand) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x87b5e0, 220, 620);
  const sun = new THREE.DirectionalLight(0xffe0b3, 2.8);
  sun.position.set(120, 180, 60); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a5a3a, 1.4));
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const parkedSpots = [];

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 260, CITY.half * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x4a7c59 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);

  // Asphalt: one dark plane per road strip, plus a centre line.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const half = CITY.half;
  const roadCentres = [];
  for (let i = -CITY.blocks; i <= CITY.blocks; i++) roadCentres.push(i * CITY.pitch);
  for (const c of roadCentres) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.road), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0, c); scene.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, half * 2), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0, 0); scene.add(v);
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 0.4), lineMat);
    dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.01, c); scene.add(dash);
  }
  // Sidewalks: light grey pads inside each block edge.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  for (let bx = -CITY.blocks; bx < CITY.blocks; bx++) for (let bz = -CITY.blocks; bz < CITY.blocks; bz++) {
    const cx = bx * CITY.pitch + CITY.pitch / 2, cz = bz * CITY.pitch + CITY.pitch / 2;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block + 4, CITY.block + 4), walkMat);
    pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.02, cz); scene.add(pad);
  }
  // Beach strip and sea on the south edge.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 260, 46), new THREE.MeshLambertMaterial({ color: 0xe8d49a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.03, half + 34); scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 260, 120), new THREE.MeshLambertMaterial({ color: 0x2a7fa8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, half + 120); scene.add(sea);

  // Buildings: 1-3 towers per block, heights vary, neon roof trim on some.
  // The facade colour is baked into the window texture so the lit face stays bright.
  const facades = ['#b8a89a', '#9fb2c8', '#c8b89a', '#a8b8a8', '#c0a0a0'];
  const winTexes = facades.map((f) => windowTexture(rand, f));
  const neon = [0xff2d95, 0x00e5ff, 0xffd23f, 0x7c4dff];
  const geoCache = new Map();
  function boxGeo(w, h, d) {
    const k = `${w}|${h}|${d}`;
    if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(k);
  }
  for (let bx = -CITY.blocks; bx < CITY.blocks; bx++) for (let bz = -CITY.blocks; bz < CITY.blocks; bz++) {
    const cx = bx * CITY.pitch + CITY.pitch / 2, cz = bz * CITY.pitch + CITY.pitch / 2;
    const towers = rand.int(1, 3);
    for (let t = 0; t < towers; t++) {
      const w = rand.range(10, 18), d = rand.range(10, 18), h = rand.range(9, 46);
      const ox = rand.range(-7, 7), oz = rand.range(-7, 7);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: rand.pick(winTexes) });
      const b = new THREE.Mesh(boxGeo(w, h, d), mat);
      b.position.set(cx + ox, h / 2, cz + oz); scene.add(b);
      colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      if (rand.chance(0.45)) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4),
          new THREE.MeshBasicMaterial({ color: rand.pick(neon) }));
        trim.position.set(cx + ox, h + 0.2, cz + oz); scene.add(trim);
      }
    }
    // Parked cars sit in the near lane of the road east of each block,
    // facing along the road, so a stolen car can drive straight off.
    if (rand.chance(0.6)) parkedSpots.push({ x: cx + CITY.block / 2 + 3, z: cz + rand.range(-12, 12), angle: 0 });
  }
  // Palm trees along the beach and the main avenue.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.y = 3.5; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1; g.add(leaf);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  for (let x = -half; x <= half; x += 24) palm(x, half + 22);
  for (let x = -half; x <= half; x += 48) palm(x + 10, 0);

  // Street lamps at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const cx of roadCentres) for (const cz of roadCentres) {
    if (rand.chance(0.5)) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
    pole.position.set(cx + 7, 3, cz + 7); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
    bulb.position.set(cx + 7, 6.2, cz + 7); scene.add(bulb);
  }
  // Glowing mission beacon: a tall light pillar the player can see across town.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2d95, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 30; beacon.add(pillar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff2d95 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; beacon.add(ring);
  beacon.visible = false; scene.add(beacon);

  function moveBeacon(x, z) { beacon.position.set(x, 0, z); beacon.visible = true; }
  function hideBeacon() { beacon.visible = false; }
  return { scene, colliders, parkedSpots, moveBeacon, hideBeacon, beacon };
}

// Circle vs building AABBs: push the circle out, return whether it hit.
export function collideCircle(colliders, x, z, r) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
      }
    }
  }
  return { x, z, hit };
}
export function clampToCity(x, z) {
  const lim = CITY.half + 40;
  return { x: Math.max(-lim, Math.min(lim, x)), z: Math.max(-lim, Math.min(lim, z)) };
}

// Axis-separated movement: move X, clamp against buildings, then move Z.
// Sliding along a wall keeps the parallel component, so the player and cars
// never get stuck on a building corner when steering around it.
export function moveCircle(colliders, x, z, dx, dz, r) {
  let hit = false;
  let nx = x + dx;
  for (const c of colliders) {
    if (nx + r > c.minX && nx - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
      hit = true;
      if (dx > 0) nx = c.minX - r;
      else if (dx < 0) nx = c.maxX + r;
      else nx = x;
    }
  }
  let nz = z + dz;
  for (const c of colliders) {
    if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
      hit = true;
      if (dz > 0) nz = c.minZ - r;
      else if (dz < 0) nz = c.maxZ + r;
      else nz = z;
    }
  }
  return { x: nx, z: nz, hit };
}
