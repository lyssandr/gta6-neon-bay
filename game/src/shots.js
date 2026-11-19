// Deterministic staged scenes for screenshots: ?shot=chase|drive|mission|foot
// with &seed=N puts the player, the police, the traffic and the mission in a
// fixed arrangement, then main.js runs a few fixed steps and paints it.
// Each shot shows several systems at once: the chase shows the wanted level,
// the minimap, the mission objective and a police pursuit in one frame.
import { createCar, randomCarColor, randomCarName } from './vehicles.js';

export const SHOTS = ['chase', 'drive', 'mission', 'foot'];

function putPlayerInCar(game, x, z, angle) {
  const car = createCar('shot-car', x, z, angle, 0xd23b3b, 'Comet', false);
  game.scene.add(car.mesh);
  game.parkedCars.push(car);
  game.player.inCar = true; game.player.car = car;
  game.player.mesh.visible = false;
  game.camYaw = angle;
  return car;
}
function putPlayerOnFoot(game, x, z, angle) {
  game.player.inCar = false; game.player.car = null;
  game.player.x = x; game.player.z = z; game.player.angle = angle;
  game.player.mesh.visible = true;
  game.player.mesh.position.set(x, 0, z);
  game.camYaw = angle;
}

export function stageShot(game, name, helpers) {
  const { missions, startMission } = helpers;
  if (name === 'chase') {
    // Cover shot: 3-star police chase in a stolen car, mission 6 running.
    putPlayerInCar(game, 0, 0, 0.4);
    game.player.car.speed = 26;
    missions.index = 5;
    startMission();
    game.police.setWanted(3, 'shot');
    // Interceptors ahead on the road, in the chase camera's view: the
    // player is bearing down on them while two more close from behind.
    // (Cars placed behind the player fall outside the chase camera's frustum.)
    const a = game.player.car.angle;
    const fx = Math.sin(a), fz = Math.cos(a);
    const rx = Math.cos(a), rz = -Math.sin(a);
    const spots = [[10, -4], [14, 4], [22, 0]];
    for (let i = 0; i < 3; i++) {
      const [back, side] = spots[i];
      const px = game.player.car.x + fx * back + rx * side;
      const pz = game.player.car.z + fz * back + rz * side;
      const pc = createCar(`shot-police-${i}`, px, pz, a, 0x111111, 'Interceptor', true);
      pc.speed = 24; pc.cruise = 26;
      game.scene.add(pc.mesh);
      game.police.cars.push(pc);
    }
  } else if (name === 'drive') {
    // Sunset cruise down the main avenue (x = 0 is a road centre) with traffic around.
    putPlayerInCar(game, 0, 60, 0);
    game.player.car.speed = 18;
    missions.index = 0;
    startMission();
    game.police.setWanted(0, 'shot');
  } else if (name === 'mission') {
    // On foot at the docks: rivals to take out, marker beacon lit.
    putPlayerOnFoot(game, -60, -60, Math.PI * 0.75);
    missions.index = 3;
    startMission();
    game.combat.addAmmo(60);
  } else {
    // On foot on the Neon Strip with pedestrians, traffic and the first job.
    // (16, 10) keeps the street lamp at the 7,7 intersection out of the shot.
    putPlayerOnFoot(game, 16, 10, Math.PI * 0.2);
    missions.index = 0;
    startMission();
    game.police.setWanted(0, 'shot');
  }
  // Traffic cars near the player so every shot has a living street.
  for (const t of game.traffic.cars.slice(0, 4)) {
    t.x = game.player.x + (t.id.charCodeAt(t.id.length - 1) % 5 - 2) * 12;
    t.z = game.player.z + 18;
    t.mesh.position.set(t.x, 0, t.z);
  }
}
