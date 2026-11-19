// Neon Bay: every tuning number, name and mission in one place.
// The city is a grid of blocks. Roads run every BLOCK+ROAD units; buildings sit
// inside blocks so the roads stay clear for cars, traffic and police chases.
export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-bay-save-v1';
export const CITY = {
  blocks: 5, // blocks per side, centred on the origin
  block: 34, // building block size
  road: 16, // road width
  get pitch() { return this.block + this.road; },
  get half() { return (this.blocks * 2 * this.pitch + this.road) / 2; },
};
export const PLAYER = { walkSpeed: 9, runSpeed: 14, radius: 0.7, health: 100 };
export const CAR = { accel: 26, brake: 42, reverse: 12, maxSpeed: 42, maxReverse: 12, turn: 1.9, grip: 6 };
export const WANTED_MAX = 5;
export const START_CASH = 250;

// The story: Ray "Vex" Marlowe, a wheelman fresh out of lockup, owes the
// Neon Bay harbour crew. Six jobs climb from errands to the big getaway.
export const MISSIONS = [
  { id: 1, title: 'First Wheels', giver: 'Dana', type: 'goto',
    brief: 'Dana needs wheels. Steal any parked car and drive to the pink marker at Marina Row.',
    target: { x: 75, z: 25 }, reward: 300 },
  { id: 2, title: 'The Package', giver: 'Dana', type: 'pickup',
    brief: 'Pick up the package on foot at the docks marker, then bring it back to Dana at the garage.',
    target: { x: -75, z: 75 }, returnTo: { x: -25, z: -25 }, reward: 450 },
  { id: 3, title: 'Hot Wheels', giver: 'Marco', type: 'escape',
    brief: 'Marco tipped the cops. Lose a 2-star wanted level: stay out of sight for 20 seconds.',
    target: { x: 25, z: -75 }, reward: 600, wanted: 2, survive: 20 },
  { id: 4, title: 'Dockside Trouble', giver: 'Marco', type: 'combat',
    brief: 'Rival crew at the docks. Take out all 4 rivals, then reach the marker. Click to shoot.',
    target: { x: -75, z: -75 }, enemies: 4, reward: 900 },
  { id: 5, title: 'Night Run', giver: 'Dana', type: 'deliver',
    brief: 'Drive the goods across town to the north marker. Do it fast: bonus for under 90 seconds.',
    target: { x: 75, z: -75 }, reward: 1200, timeLimit: 90 },
  { id: 6, title: 'The Big Getaway', giver: 'Marco', type: 'escape',
    brief: 'The harbour job went loud. Survive a 3-star chase for 30 seconds, then reach the safehouse.',
    target: { x: 0, z: 100 }, reward: 2500, wanted: 3, survive: 30 },
];

export const CAR_COLORS = [0xd23b3b, 0x2f7fd0, 0xe8b93c, 0x3cb371, 0x8e44ad, 0xe67e22, 0xdddddd, 0x222831, 0x16a085, 0xc0392b];
export const CAR_NAMES = ['Comet', 'Stallion', 'Voyager', 'Falcon', 'Bison', 'Mirage', 'Dune', 'Raptor'];
export const PED_NAMES = ['Kai', 'Mira', 'Juno', 'Theo', 'Lena', 'Omar', 'Rosa', 'Felix'];
export const DISTRICTS = ['Marina Row', 'Palm Court', 'The Docks', 'Neon Strip', 'Harbour View', 'Sunset Mile'];
export function districtAt(x, z) {
  const d = DISTRICTS[Math.abs(Math.floor(x / 60) + Math.floor(z / 60) * 2) % DISTRICTS.length];
  return d;
}
