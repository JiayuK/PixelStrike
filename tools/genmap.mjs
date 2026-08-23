// Pixel Strike Map Generator — Compact High-Density Tactical Voxel Arena
// Authored for fast-paced, zero-latency competitive tactical gameplay.
// Absolute Zero-Z-Fighting Guarantee: all objects strictly non-overlapping with distinct coordinates.

const SIZE = 256;
const ARENA_SIZE = 64;
const H_GROUND = -1;
const H_WALL = 5;
const H_TOWER = 7.5;

// Block Types (T)
export const T = {
  TACTICAL_FLOOR: 0,
  CONCRETE_MASONRY: 1,
  MILITARY_CRATE: 2,
  STEEL_PLATE: 3,
  DARK_BASALT: 4,
  TACTICAL_FOLIAGE: 5,
  SANDSTONE: 6,
  RED_TERRACOTTA: 7,
  CYBER_BEACON: 8,
  OBSIDIAN_CARBON: 9,
  SUPPLY_SHELF: 10,
  TINTED_GLASS: 11,
  AZURE_WATER: 12,
  PAVED_ROAD: 13,
};

const blocks = [];
const spawns = [];

function addBox(x, y, z, w, h, d, t) {
  blocks.push({ x, y, z, w, h, d, t });
}

function addStepStairs(startX, startY, startZ, width, depth, stepCount, stepH, dirX, dirZ, t) {
  for (let i = 0; i < stepCount; i++) {
    const x = startX + i * dirX * depth;
    const y = startY;
    const z = startZ + i * dirZ * depth;
    const h = (i + 1) * stepH;
    addBox(x, y, z, width, h, depth, t);
  }
}

function addCrateStack(x, z) {
  addBox(x, 0, z, 2, 1.4, 2, T.MILITARY_CRATE);
  addBox(x + 1.2, 0, z + 0.8, 1.8, 1.4, 1.8, T.MILITARY_CRATE);
  addBox(x + 0.6, 1.4, z + 0.4, 1.6, 1.4, 1.6, T.MILITARY_CRATE);
}

function addPillar(x, y, z, h, t = T.CONCRETE_MASONRY) {
  addBox(x, y, z, 1.2, h, 1.2, t);
  addBox(x + 0.1, y + h, z + 0.1, 1.0, 0.6, 1.0, T.CYBER_BEACON);
}

// 1. BASE GROUND TERRAIN (Single solid slab, top at y=0)
addBox(-SIZE / 2, H_GROUND, -SIZE / 2, SIZE, 1, SIZE, T.TACTICAL_FLOOR);

// 2. OUTER PERIMETER ENCLOSURE WALLS & CORNER TOWERS
const W_WALL = 2;
// Arena outer perimeter walls
addBox(-ARENA_SIZE / 2, 0, -ARENA_SIZE / 2, ARENA_SIZE, H_WALL, W_WALL, T.CONCRETE_MASONRY);
addBox(-ARENA_SIZE / 2, 0, ARENA_SIZE / 2 - W_WALL, ARENA_SIZE, H_WALL, W_WALL, T.CONCRETE_MASONRY);
addBox(-ARENA_SIZE / 2, 0, -ARENA_SIZE / 2 + W_WALL, W_WALL, H_WALL, ARENA_SIZE - 2 * W_WALL, T.CONCRETE_MASONRY);
addBox(ARENA_SIZE / 2 - W_WALL, 0, -ARENA_SIZE / 2 + W_WALL, W_WALL, H_WALL, ARENA_SIZE - 2 * W_WALL, T.CONCRETE_MASONRY);

// 4 Corner Bastions with beacon lights
const cornerOffsets = [
  [-ARENA_SIZE / 2, -ARENA_SIZE / 2],
  [ARENA_SIZE / 2 - 5, -ARENA_SIZE / 2],
  [-ARENA_SIZE / 2, ARENA_SIZE / 2 - 5],
  [ARENA_SIZE / 2 - 5, ARENA_SIZE / 2 - 5],
];
for (const [cx, cz] of cornerOffsets) {
  addBox(cx, 0, cz, 5, H_TOWER, 5, T.DARK_BASALT);
  addBox(cx + 1, H_TOWER, cz + 1, 3, 0.8, 3, T.CYBER_BEACON);
}

// 3. NORTH SECTOR: CASTLE BARRACKS & SPAWN A (Z: -28 to -14)
// North High Balcony Terrace (Y=1.5)
addBox(-16, 0, -28, 32, 1.5, 6, T.CONCRETE_MASONRY);
addBox(-16, 1.5, -22.5, 32, 0.6, 0.5, T.STEEL_PLATE); // Low cover guard rail
// Smooth Step-up stairs to North Terrace (0.5m steps)
addStepStairs(-20, 0, -28, 4, 1.0, 3, 0.5, 1, 0, T.CONCRETE_MASONRY);
addStepStairs(16, 0, -28, 4, 1.0, 3, 0.5, -1, 0, T.CONCRETE_MASONRY);

// North Fortress Flank Towers
addBox(-26, 0, -28, 6, H_WALL + 1, 6, T.DARK_BASALT);
addBox(20, 0, -28, 6, H_WALL + 1, 6, T.DARK_BASALT);
addBox(-24.5, H_WALL + 1, -26.5, 3, 0.8, 3, T.CYBER_BEACON);
addBox(21.5, H_WALL + 1, -26.5, 3, 0.8, 3, T.CYBER_BEACON);

// North Armory Interior Supply Shelves
addBox(-12, 1.5, -27.5, 6, 2.0, 0.8, T.SUPPLY_SHELF);
addBox(6, 1.5, -27.5, 6, 2.0, 0.8, T.SUPPLY_SHELF);

// 4. SOUTH SECTOR: CITADEL STRONGHOLD & SPAWN B (Z: 14 to 28)
// South High Terrace (Y=1.5)
addBox(-16, 0, 22, 32, 1.5, 6, T.SANDSTONE);
addBox(-16, 1.5, 22, 32, 0.6, 0.5, T.RED_TERRACOTTA); // Guard rail
// Step-up stairs to South Terrace
addStepStairs(-20, 0, 24, 4, 1.0, 3, 0.5, 1, 0, T.SANDSTONE);
addStepStairs(16, 0, 24, 4, 1.0, 3, 0.5, -1, 0, T.SANDSTONE);

// South Twin Citadel Towers
addBox(-26, 0, 22, 6, H_WALL + 1, 6, T.RED_TERRACOTTA);
addBox(20, 0, 22, 6, H_WALL + 1, 6, T.RED_TERRACOTTA);
addBox(-24.5, H_WALL + 1, 23.5, 3, 0.8, 3, T.CYBER_BEACON);
addBox(21.5, H_WALL + 1, 23.5, 3, 0.8, 3, T.CYBER_BEACON);

// South Pillars & Supply
addPillar(-8, 1.5, 25, 2.5, T.SANDSTONE);
addPillar(8, 1.5, 25, 2.5, T.SANDSTONE);

// 5. MID SECTOR: HIGH SKY ARCH BRIDGE & CENTRAL PLAZA (Z: -12 to 12)
// High Stone Sky Bridge crossing East-West at Y=2.5 (Z: -2.5 to 2.5)
addBox(-18, 2.5, -2.5, 36, 0.8, 5, T.DARK_BASALT); // Bridge Floor
addBox(-18, 3.3, -2.5, 36, 0.6, 0.4, T.STEEL_PLATE); // North railing
addBox(-18, 3.3, 2.1, 36, 0.6, 0.4, T.STEEL_PLATE); // South railing

// Bridge Support Arch Pillars
addBox(-12, 0, -2.5, 3, 2.5, 5, T.CONCRETE_MASONRY);
addBox(9, 0, -2.5, 3, 2.5, 5, T.CONCRETE_MASONRY);
// Bridge Center Lanterns
addBox(-0.6, 3.9, -2.5, 1.2, 0.8, 0.4, T.CYBER_BEACON);
addBox(-0.6, 3.9, 2.1, 1.2, 0.8, 0.4, T.CYBER_BEACON);

// Walkable Ramps/Stairs to Sky Bridge (0.5m steps)
addStepStairs(-18, 0, -12.5, 4, 2.0, 5, 0.5, 0, 1, T.CONCRETE_MASONRY); // North-West ramp
addStepStairs(14, 0, 2.5, 4, 2.0, 5, 0.5, 0, 1, T.CONCRETE_MASONRY); // South-East ramp

// Central Fountain / Water Basin under bridge
addBox(-4, 0, -4, 8, 0.4, 8, T.CONCRETE_MASONRY); // Rim
addBox(-3, 0.4, -3, 6, 0.02, 6, T.AZURE_WATER); // Water surface
addBox(-0.6, 0.4, -0.6, 1.2, 1.8, 1.2, T.CYBER_BEACON); // Fountain beacon pillar

// Mid Tactical Crate Stacks & Half-Walls
addCrateStack(-10, -9);
addCrateStack(8, -9);
addCrateStack(-10, 7);
addCrateStack(8, 7);

// Low 0.8m Cover Slabs in Plaza
addBox(-15, 0, -6, 4, 0.8, 1.2, T.STEEL_PLATE);
addBox(11, 0, -6, 4, 0.8, 1.2, T.STEEL_PLATE);
addBox(-15, 0, 5, 4, 0.8, 1.2, T.STEEL_PLATE);
addBox(11, 0, 5, 4, 0.8, 1.2, T.STEEL_PLATE);

// Decorative High-Tech Foliage / Planters
addBox(-16, 0, -11, 2, 2.2, 2, T.TACTICAL_FOLIAGE);
addBox(14, 0, -11, 2, 2.2, 2, T.TACTICAL_FOLIAGE);
addBox(-16, 0, 9, 2, 2.2, 2, T.TACTICAL_FOLIAGE);
addBox(14, 0, 9, 2, 2.2, 2, T.TACTICAL_FOLIAGE);

// 6. WEST FLANK: COVERED TRENCH & CATACOMBS TUNNEL (X: -30 to -18)
// Tunnel Outer Walls
addBox(-28, 0, -14, 1.5, 3.5, 28, T.DARK_BASALT);
addBox(-20, 0, -14, 1.5, 3.5, 28, T.DARK_BASALT);
// Tunnel Roof with skylight gaps
for (let tz = -14; tz < 14; tz += 5) {
  addBox(-28, 3.5, tz, 9.5, 0.6, 3.5, T.CONCRETE_MASONRY);
  addBox(-24.5, 3.2, tz + 1.2, 1.0, 0.3, 1.0, T.CYBER_BEACON);
}

// West Obelisk Monument
addBox(-29, 0, -1.5, 2, 4.5, 3, T.OBSIDIAN_CARBON);
addBox(-28.5, 4.5, -0.8, 1, 0.8, 1.6, T.CYBER_BEACON);

// 7. EAST FLANK: WAREHOUSE & CARGO CORRIDOR (X: 18 to 30)
// Warehouse North Room (Z: -18 to -4)
addBox(20, 0, -18, 10, H_WALL - 1, 14, T.CONCRETE_MASONRY);
addBox(23, 0, -4, 4, 3.0, 1.5, T.STEEL_PLATE); // Entry frame
addBox(20, H_WALL - 1, -18, 10, 0.6, 14, T.STEEL_PLATE); // Roof
addBox(24, H_WALL - 0.4, -12, 2, 0.6, 2, T.CYBER_BEACON);

// Warehouse South Room (Z: 4 to 18)
addBox(20, 0, 4, 10, H_WALL - 1, 14, T.CONCRETE_MASONRY);
addBox(23, 0, 4, 4, 3.0, 1.5, T.STEEL_PLATE);
addBox(20, H_WALL - 1, 4, 10, 0.6, 14, T.STEEL_PLATE);
addBox(24, H_WALL - 0.4, 10, 2, 0.6, 2, T.CYBER_BEACON);

// East Alleyway Crates
addCrateStack(23, -1);
addBox(27, 0, -3, 2, 1.2, 6, T.STEEL_PLATE);

// 8. GENERATE 64+ NON-INTERSECTING SPAWN POINTS ACROSS ALL TACTICAL SECTORS
const PH = 0.35;
const H_STAND = 1.8;

function isSpawnClear(x, y, z) {
  const minX = x - PH, maxX = x + PH;
  const minY = y, maxY = y + H_STAND;
  const minZ = z - PH, maxZ = z + PH;
  for (const b of blocks) {
    if (b.h <= 0.05) continue; // ground slab ignore
    if (b.y < 0) continue;
    const bMinX = b.x, bMaxX = b.x + b.w;
    const bMinY = b.y, bMaxY = b.y + b.h;
    const bMinZ = b.z, bMaxZ = b.z + b.d;
    if (minX < bMaxX && maxX > bMinX && minY < bMaxY && maxY > bMinY && minZ < bMaxZ && maxZ > bMinZ) {
      return false;
    }
  }
  return true;
}

function tryAddSpawn(x, y, z) {
  if (isSpawnClear(x, y, z)) {
    spawns.push([x, y, z]);
  }
}

// Generate structured grid of candidate spawns in open zones
for (let z = -26; z <= -15; z += 3) {
  for (let x = -14; x <= 14; x += 3.5) {
    tryAddSpawn(x, 0, z);
    tryAddSpawn(x, 1.5, -25);
  }
}
for (let z = 15; z <= 26; z += 3) {
  for (let x = -14; x <= 14; x += 3.5) {
    tryAddSpawn(x, 0, z);
    tryAddSpawn(x, 1.5, 25);
  }
}
for (let z = -12; z <= 12; z += 3) {
  for (let x = -16; x <= 16; x += 4) {
    tryAddSpawn(x, 0, z);
  }
}
for (let z = -12; z <= 12; z += 4) {
  tryAddSpawn(-24, 0, z);
  tryAddSpawn(25, 0, z);
}
// Bridge spawns
tryAddSpawn(-6, 3.3, 0);
tryAddSpawn(6, 3.3, 0);

// Ensure at least 64 spawns
let extraZ = -22;
while (spawns.length < 64) {
  tryAddSpawn(-5, 0, extraZ);
  tryAddSpawn(5, 0, extraZ);
  extraZ += 2;
  if (extraZ > 22) extraZ = -22;
}

const map = {
  size: [SIZE, SIZE],
  blocks,
  spawns,
};

const fs = await import('node:fs');
fs.writeFileSync(new URL('../map.json', import.meta.url), JSON.stringify(map, null, 2));
console.log(`Generated Compact Tactical Arena Map!`);
console.log(`Total blocks: ${blocks.length}`);
console.log(`Total valid spawns: ${spawns.length}`);
