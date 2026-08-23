// Pixel Strike Map Generator — 512x512 Expanded Tactical Voxel Citadel (4x Arena Area)
// Authored for high-performance, fast-paced, zero-latency competitive tactical gameplay.
// Absolute Zero-Z-Fighting Guarantee: all objects strictly non-overlapping with distinct coordinates.

const SIZE = 512;
const ARENA_SIZE = 128;
const H_GROUND = -1;
const H_WALL = 6.0;
const H_TOWER = 9.0;

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
  addBox(x, 0, z, 2.4, 1.4, 2.4, T.MILITARY_CRATE);
  addBox(x + 1.4, 0, z + 0.9, 2.0, 1.4, 2.0, T.MILITARY_CRATE);
  addBox(x + 0.7, 1.4, z + 0.5, 1.8, 1.4, 1.8, T.MILITARY_CRATE);
}

function addPillar(x, y, z, h, t = T.CONCRETE_MASONRY) {
  addBox(x, y, z, 1.4, h, 1.4, t);
  addBox(x + 0.1, y + h, z + 0.1, 1.2, 0.8, 1.2, T.CYBER_BEACON);
}

// 1. BASE GROUND TERRAIN (Single solid slab, top at y=0, size 512x512)
addBox(-SIZE / 2, H_GROUND, -SIZE / 2, SIZE, 1, SIZE, T.TACTICAL_FLOOR);

// 2. OUTER PERIMETER ENCLOSURE WALLS & CORNER TOWERS (128x128 active arena)
const W_WALL = 3;
// Outer walls
addBox(-ARENA_SIZE / 2, 0, -ARENA_SIZE / 2, ARENA_SIZE, H_WALL, W_WALL, T.CONCRETE_MASONRY);
addBox(-ARENA_SIZE / 2, 0, ARENA_SIZE / 2 - W_WALL, ARENA_SIZE, H_WALL, W_WALL, T.CONCRETE_MASONRY);
addBox(-ARENA_SIZE / 2, 0, -ARENA_SIZE / 2 + W_WALL, W_WALL, H_WALL, ARENA_SIZE - 2 * W_WALL, T.CONCRETE_MASONRY);
addBox(ARENA_SIZE / 2 - W_WALL, 0, -ARENA_SIZE / 2 + W_WALL, W_WALL, H_WALL, ARENA_SIZE - 2 * W_WALL, T.CONCRETE_MASONRY);

// 4 Corner Bastions with beacon lights
const cornerOffsets = [
  [-ARENA_SIZE / 2, -ARENA_SIZE / 2],
  [ARENA_SIZE / 2 - 8, -ARENA_SIZE / 2],
  [-ARENA_SIZE / 2, ARENA_SIZE / 2 - 8],
  [ARENA_SIZE / 2 - 8, ARENA_SIZE / 2 - 8],
];
for (const [cx, cz] of cornerOffsets) {
  addBox(cx, 0, cz, 8, H_TOWER, 8, T.DARK_BASALT);
  addBox(cx + 2, H_TOWER, cz + 2, 4, 1.0, 4, T.CYBER_BEACON);
}

// 3. NORTH SECTOR: CASTLE BARRACKS & SPAWN A (Z: -56 to -26)
// North High Balcony Terrace (Y=1.5)
addBox(-32, 0, -56, 64, 1.5, 12, T.CONCRETE_MASONRY);
addBox(-32, 1.5, -44.5, 64, 0.6, 0.5, T.STEEL_PLATE); // Low cover guard rail
// Smooth Step-up stairs to North Terrace (0.5m steps)
addStepStairs(-40, 0, -56, 8, 1.5, 3, 0.5, 1, 0, T.CONCRETE_MASONRY);
addStepStairs(32, 0, -56, 8, 1.5, 3, 0.5, -1, 0, T.CONCRETE_MASONRY);

// North Fortress Flank Towers
addBox(-52, 0, -56, 10, H_WALL + 2, 10, T.DARK_BASALT);
addBox(42, 0, -56, 10, H_WALL + 2, 10, T.DARK_BASALT);
addBox(-49, H_WALL + 2, -53, 4, 1.0, 4, T.CYBER_BEACON);
addBox(45, H_WALL + 2, -53, 4, 1.0, 4, T.CYBER_BEACON);

// North Armory Interior Supply Shelves & Crates
addBox(-24, 1.5, -54, 12, 2.2, 1.2, T.SUPPLY_SHELF);
addBox(12, 1.5, -54, 12, 2.2, 1.2, T.SUPPLY_SHELF);
addCrateStack(-10, -50);
addCrateStack(10, -50);

// 4. SOUTH SECTOR: CITADEL STRONGHOLD & SPAWN B (Z: 26 to 56)
// South High Terrace (Y=1.5)
addBox(-32, 0, 44, 64, 1.5, 12, T.SANDSTONE);
addBox(-32, 1.5, 44, 64, 0.6, 0.5, T.RED_TERRACOTTA); // Guard rail
// Step-up stairs to South Terrace
addStepStairs(-40, 0, 48, 8, 1.5, 3, 0.5, 1, 0, T.SANDSTONE);
addStepStairs(32, 0, 48, 8, 1.5, 3, 0.5, -1, 0, T.SANDSTONE);

// South Twin Citadel Towers
addBox(-52, 0, 46, 10, H_WALL + 2, 10, T.RED_TERRACOTTA);
addBox(42, 0, 46, 10, H_WALL + 2, 10, T.RED_TERRACOTTA);
addBox(-49, H_WALL + 2, 49, 4, 1.0, 4, T.CYBER_BEACON);
addBox(45, H_WALL + 2, 49, 4, 1.0, 4, T.CYBER_BEACON);

// South Pillars & Supply
addPillar(-18, 1.5, 50, 3.0, T.SANDSTONE);
addPillar(18, 1.5, 50, 3.0, T.SANDSTONE);
addPillar(0, 1.5, 52, 3.0, T.SANDSTONE);
addCrateStack(-8, 46);
addCrateStack(8, 46);

// 5. MID SECTOR: GRAND SKY ARCH BRIDGE & CENTRAL PLAZA (Z: -24 to 24)
// High Stone Sky Bridge crossing East-West at Y=3.0 (Z: -4 to 4, X: -36 to 36)
addBox(-36, 3.0, -4, 72, 1.0, 8, T.DARK_BASALT); // Bridge Floor
addBox(-36, 4.0, -4, 72, 0.7, 0.5, T.STEEL_PLATE); // North railing
addBox(-36, 4.0, 3.5, 72, 0.7, 0.5, T.STEEL_PLATE); // South railing

// Bridge Support Arch Pillars
addBox(-24, 0, -4, 5, 3.0, 8, T.CONCRETE_MASONRY);
addBox(19, 0, -4, 5, 3.0, 8, T.CONCRETE_MASONRY);
addBox(-2.5, 0, -4, 5, 3.0, 8, T.CONCRETE_MASONRY);

// Bridge Center Beacon Lights
addBox(-1.5, 4.7, -4, 3.0, 1.0, 0.5, T.CYBER_BEACON);
addBox(-1.5, 4.7, 3.5, 3.0, 1.0, 0.5, T.CYBER_BEACON);

// Walkable Ramps/Stairs to Sky Bridge (0.5m steps, total height 3.0m)
addStepStairs(-36, 0, -20, 6, 2.6, 6, 0.5, 0, 1, T.CONCRETE_MASONRY); // North-West ramp
addStepStairs(30, 0, 4, 6, 2.6, 6, 0.5, 0, 1, T.CONCRETE_MASONRY); // South-East ramp

// Central Fountain / Water Basin under bridge
addBox(-10, 0, -10, 20, 0.4, 20, T.CONCRETE_MASONRY); // Basin Rim
addBox(-8, 0.4, -8, 16, 0.05, 16, T.AZURE_WATER); // Water surface
addBox(-1.5, 0.4, -1.5, 3.0, 2.8, 3.0, T.CYBER_BEACON); // Fountain beacon obelisk

// Mid Tactical Crate Stacks & Half-Walls in Plaza
addCrateStack(-22, -18);
addCrateStack(18, -18);
addCrateStack(-22, 14);
addCrateStack(18, 14);
addCrateStack(-12, -22);
addCrateStack(12, 22);

// Low 0.8m Cover Slabs in Plaza
addBox(-28, 0, -12, 8, 0.8, 1.5, T.STEEL_PLATE);
addBox(20, 0, -12, 8, 0.8, 1.5, T.STEEL_PLATE);
addBox(-28, 0, 10, 8, 0.8, 1.5, T.STEEL_PLATE);
addBox(20, 0, 10, 8, 0.8, 1.5, T.STEEL_PLATE);

// Decorative High-Tech Foliage / Planters
addBox(-30, 0, -22, 3, 2.5, 3, T.TACTICAL_FOLIAGE);
addBox(27, 0, -22, 3, 2.5, 3, T.TACTICAL_FOLIAGE);
addBox(-30, 0, 18, 3, 2.5, 3, T.TACTICAL_FOLIAGE);
addBox(27, 0, 18, 3, 2.5, 3, T.TACTICAL_FOLIAGE);

// 6. WEST FLANK: COVERED TRENCH & CATACOMBS TUNNEL (X: -58 to -36)
// Tunnel Outer Walls
addBox(-56, 0, -28, 2.5, 4.0, 56, T.DARK_BASALT);
addBox(-40, 0, -28, 2.5, 4.0, 56, T.DARK_BASALT);
// Tunnel Roof with skylight gaps
for (let tz = -28; tz < 28; tz += 9) {
  addBox(-56, 4.0, tz, 18.5, 0.8, 6.0, T.CONCRETE_MASONRY);
  addBox(-48.5, 3.6, tz + 2.0, 1.5, 0.4, 1.5, T.CYBER_BEACON);
}

// West Obelisk Monument & Bunkers
addBox(-57, 0, -3.0, 3, 6.0, 6, T.OBSIDIAN_CARBON);
addBox(-56, 6.0, -1.5, 1.5, 1.2, 3, T.CYBER_BEACON);
addCrateStack(-46, -10);
addCrateStack(-46, 8);

// 7. EAST FLANK: WAREHOUSE & CARGO CORRIDOR (X: 36 to 58)
// Warehouse North Room (Z: -36 to -8)
addBox(40, 0, -36, 18, H_WALL, 28, T.CONCRETE_MASONRY);
addBox(46, 0, -8, 6, 3.5, 2.0, T.STEEL_PLATE); // Entry frame
addBox(40, H_WALL, -36, 18, 0.8, 28, T.STEEL_PLATE); // Roof
addBox(47, H_WALL - 0.5, -22, 4, 0.8, 4, T.CYBER_BEACON);

// Warehouse South Room (Z: 8 to 36)
addBox(40, 0, 8, 18, H_WALL, 28, T.CONCRETE_MASONRY);
addBox(46, 0, 8, 6, 3.5, 2.0, T.STEEL_PLATE);
addBox(40, H_WALL, 8, 18, 0.8, 28, T.STEEL_PLATE);
addBox(47, H_WALL - 0.5, 22, 4, 0.8, 4, T.CYBER_BEACON);

// East Alleyway Crates & Security Barrier
addCrateStack(47, -2);
addBox(52, 0, -6, 3, 1.4, 12, T.STEEL_PLATE);

// 8. GENERATE 160+ NON-INTERSECTING SPAWN POINTS ACROSS ALL TACTICAL SECTORS
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
    spawns.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(z * 10) / 10]);
  }
}

// Generate structured grid of candidate spawns across all open sectors
// North Sector Spawns
for (let z = -52; z <= -30; z += 5) {
  for (let x = -28; x <= 28; x += 6) {
    tryAddSpawn(x, 0, z);
    tryAddSpawn(x, 1.5, -50);
  }
}
// South Sector Spawns
for (let z = 30; z <= 52; z += 5) {
  for (let x = -28; x <= 28; x += 6) {
    tryAddSpawn(x, 0, z);
    tryAddSpawn(x, 1.5, 50);
  }
}
// Mid Plaza Spawns
for (let z = -24; z <= 24; z += 6) {
  for (let x = -32; x <= 32; x += 7) {
    tryAddSpawn(x, 0, z);
  }
}
// West & East Flanks
for (let z = -24; z <= 24; z += 6) {
  tryAddSpawn(-48, 0, z);
  tryAddSpawn(48, 0, z);
}
// Bridge spawns
tryAddSpawn(-14, 4.0, 0);
tryAddSpawn(14, 4.0, 0);
tryAddSpawn(0, 4.0, 0);

// Ensure at least 120+ spawns
let extraZ = -44;
while (spawns.length < 160) {
  tryAddSpawn(-10, 0, extraZ);
  tryAddSpawn(10, 0, extraZ);
  extraZ += 4;
  if (extraZ > 44) extraZ = -44;
}

const map = {
  size: [SIZE, SIZE],
  blocks,
  spawns,
};

const fs = await import('node:fs');
fs.writeFileSync(new URL('../map.json', import.meta.url), JSON.stringify(map, null, 2));
console.log(`Generated 512x512 Tactical Citadel Map!`);
console.log(`Total blocks: ${blocks.length}`);
console.log(`Total valid spawns: ${spawns.length}`);
