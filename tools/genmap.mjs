// Pixel Strike Competitive Map Generator — Asymmetric Tactical Battlefield
// Inspired by legendary competitive maps: CS:GO (Dust II, Mirage, Inferno, Cache) & CrossFire (运输船, 黑色城镇, 沙漠-1D)
// Features: A Site with Long/Catwalk, B Industrial Container Depot, Mid Doors with Underpass Water Canal, Asymmetric Spawns & Verticality.

const SIZE = 512;
const ARENA_SIZE = 140;
const H_GROUND = -1;
const H_WALL = 6.5;

export const T = {
  TACTICAL_FLOOR: 0,   // 0: Sandstone / concrete floor tiles
  CONCRETE_MASONRY: 1, // 1: Concrete brick masonry
  MILITARY_CRATE: 2,   // 2: Military wooden crate with metal brackets & stencils
  STEEL_PLATE: 3,      // 3: Industrial diamond steel plate
  DARK_BASALT: 4,      // 4: Dark basalt slate tiles
  TACTICAL_FOLIAGE: 5, // 5: Green hedge / planter
  SANDSTONE: 6,        // 6: Chiseled golden sandstone
  RED_TERRACOTTA: 7,   // 7: Crimson terracotta brick
  CYBER_BEACON: 8,     // 8: Luminous beacon lamp
  OBSIDIAN_CARBON: 9,  // 9: 2x2 Twill carbon fiber
  SUPPLY_SHELF: 10,    // 10: Tactical supply depot & ammo racks
  TINTED_GLASS: 11,    // 11: High-tech security glass
  AZURE_WATER: 12,     // 12: Flowing water caustics (non-colliding)
  PAVED_ROAD: 13,      // 13: Asphalt road with markings
};

const blocks = [];
const spawns = [];

function addBox(x, y, z, w, h, d, t) {
  blocks.push({ x, y, z, w, h, d, t });
}

function addStepStairs(startX, startY, startZ, width, depth, stepCount, stepH, dirX, dirZ, t = T.CONCRETE_MASONRY) {
  for (let i = 0; i < stepCount; i++) {
    const x = startX + i * dirX * depth;
    const y = startY;
    const z = startZ + i * dirZ * depth;
    const h = (i + 1) * stepH;
    addBox(x, y, z, width, h, depth, t);
  }
}

function addCrateStack(x, z, h = 0) {
  addBox(x, h, z, 2.2, 1.4, 2.2, T.MILITARY_CRATE);
  addBox(x + 1.2, h, z + 0.8, 1.8, 1.4, 1.8, T.MILITARY_CRATE);
  addBox(x + 0.5, h + 1.4, z + 0.4, 1.6, 1.4, 1.6, T.MILITARY_CRATE);
}

function addDoubleCrate(x, z, h = 0) {
  addBox(x, h, z, 2.0, 1.4, 2.0, T.MILITARY_CRATE);
  addBox(x, h + 1.4, z, 1.8, 1.4, 1.8, T.MILITARY_CRATE);
}

function addShippingContainer(x, y, z, w, h, d, mainType = T.STEEL_PLATE, trimType = T.DARK_BASALT) {
  addBox(x, y, z, w, h, d, mainType);
  // Heavy end frames
  addBox(x - 0.05, y, z - 0.05, w + 0.1, h, 0.3, trimType);
  addBox(x - 0.05, y, z + d - 0.25, w + 0.1, h, 0.3, trimType);
}

function addArchway(x, y, z, width, height, depth, wallType = T.SANDSTONE) {
  const pillarW = 1.4;
  // Left Pillar
  addBox(x, y, z, pillarW, height, depth, wallType);
  // Right Pillar
  addBox(x + width - pillarW, y, z, pillarW, height, depth, wallType);
  // Top Arch Lintel
  addBox(x, y + height - 1.2, z, width, 1.2, depth, wallType);
}

// -------------------------------------------------------------
// 1. BASE GROUND TERRAIN (512x512 Single solid floor at Y=-1)
// -------------------------------------------------------------
addBox(-SIZE / 2, H_GROUND, -SIZE / 2, SIZE, 1, SIZE, T.TACTICAL_FLOOR);

// Main Central Asphalt Roadway Cross (North-South & East-West avenues)
addBox(-8, 0, -ARENA_SIZE / 2, 16, 0.02, ARENA_SIZE, T.PAVED_ROAD);
addBox(-ARENA_SIZE / 2, 0, -4, ARENA_SIZE, 0.02, 12, T.PAVED_ROAD);

// -------------------------------------------------------------
// 2. OUTER PERIMETER ENCLOSURE WALLS & CORNER FORTRESS TOWERS
// -------------------------------------------------------------
const W_WALL = 3.5;
addBox(-ARENA_SIZE / 2, 0, -ARENA_SIZE / 2, ARENA_SIZE, H_WALL, W_WALL, T.CONCRETE_MASONRY); // North Wall
addBox(-ARENA_SIZE / 2, 0, ARENA_SIZE / 2 - W_WALL, ARENA_SIZE, H_WALL, W_WALL, T.CONCRETE_MASONRY); // South Wall
addBox(-ARENA_SIZE / 2, 0, -ARENA_SIZE / 2 + W_WALL, W_WALL, H_WALL, ARENA_SIZE - 2 * W_WALL, T.CONCRETE_MASONRY); // West Wall
addBox(ARENA_SIZE / 2 - W_WALL, 0, -ARENA_SIZE / 2 + W_WALL, W_WALL, H_WALL, ARENA_SIZE - 2 * W_WALL, T.CONCRETE_MASONRY); // East Wall

// Perimeter Wall Top Architectural Coping Trims (0.35m basalt trim)
addBox(-ARENA_SIZE / 2, H_WALL, -ARENA_SIZE / 2, ARENA_SIZE, 0.35, W_WALL, T.DARK_BASALT);
addBox(-ARENA_SIZE / 2, H_WALL, ARENA_SIZE / 2 - W_WALL, ARENA_SIZE, 0.35, W_WALL, T.DARK_BASALT);
addBox(-ARENA_SIZE / 2, H_WALL, -ARENA_SIZE / 2 + W_WALL, W_WALL, 0.35, ARENA_SIZE - 2 * W_WALL, T.DARK_BASALT);
addBox(ARENA_SIZE / 2 - W_WALL, H_WALL, -ARENA_SIZE / 2 + W_WALL, W_WALL, 0.35, ARENA_SIZE - 2 * W_WALL, T.DARK_BASALT);
// 4 Corner Bastion Towers with Luminous Beacons
const corners = [
  [-ARENA_SIZE / 2, -ARENA_SIZE / 2],
  [ARENA_SIZE / 2 - 12, -ARENA_SIZE / 2],
  [-ARENA_SIZE / 2, ARENA_SIZE / 2 - 12],
  [ARENA_SIZE / 2 - 12, ARENA_SIZE / 2 - 12],
];
for (const [cx, cz] of corners) {
  addBox(cx, 0, cz, 12, H_WALL + 2.5, 12, T.DARK_BASALT);
  addBox(cx + 2, H_WALL + 2.5, cz + 2, 8, 1.2, 8, T.CYBER_BEACON);
}

// -------------------------------------------------------------
// 3. ZONE A: GOLDEN CITADEL & A SITE (East / Northeast Sector)
// -------------------------------------------------------------
// A Site Elevated Platform (Y=1.5, X: 28 to 56, Z: -54 to -28)
addBox(28, 0, -54, 28, 1.5, 26, T.SANDSTONE);
// A Site Low Cover Wall around platform edge with peeking gaps
addBox(28, 1.5, -54, 28, 0.7, 0.8, T.SANDSTONE); // Back wall
addBox(55.2, 1.5, -54, 0.8, 0.7, 26, T.SANDSTONE); // Right edge
addBox(28, 1.5, -28.8, 16, 0.7, 0.8, T.SANDSTONE); // Front-left railing

// A Site Central Pillar & Double Crates (Firebox / Ninja Spot)
addBox(40, 1.5, -42, 2.5, 3.2, 2.5, T.SANDSTONE);
addDoubleCrate(34, -46, 1.5);
addDoubleCrate(46, -36, 1.5);
addCrateStack(32, -36, 1.5);

// Stairs up to A Platform from CT Side & Short Side
addStepStairs(28, 0, -54, 6, 2.0, 3, 0.5, 0, 1, T.SANDSTONE); // From CT Ramp
addStepStairs(28, 0, -34, 6, 2.0, 3, 0.5, 1, 0, T.SANDSTONE); // From Short A

// Long A Corridor & Palace Arch (X: 44 to 62, Z: -26 to 48)
// Long A Dividing Wall between Mid and Long
addBox(38, 0, -24, 2.5, H_WALL, 56, T.CONCRETE_MASONRY);
addBox(38, H_WALL, -24, 2.5, 0.35, 56, T.DARK_BASALT); // Wall cap
// Long A Corner Building / Pit (大坑) at Z: 36 to 52
addBox(44, 0, 38, 18, 0.8, 18, T.DARK_BASALT); // Pit Rim
addStepStairs(44, 0, 34, 6, 1.5, 2, 0.4, 0, 1, T.CONCRETE_MASONRY);

// Long A Doors / Archway at Z: 18
addArchway(40.5, 0, 16, 17.5, 4.2, 3.0, T.SANDSTONE);
addDoubleCrate(44, 8);
addCrateStack(52, -12);

// Short A / Catwalk (A 小道天桥 - Y=2.5, X: 12 to 38, Z: -28 to -16)
addBox(14, 2.5, -26, 24, 0.6, 10, T.DARK_BASALT); // Catwalk Floor
addBox(14, 3.1, -26, 24, 0.6, 0.5, T.STEEL_PLATE); // Guard rail
// Stairs to Catwalk from Mid
addStepStairs(8, 0, -26, 6, 2.0, 5, 0.5, 1, 0, T.CONCRETE_MASONRY);

// -------------------------------------------------------------
// 4. ZONE B: INDUSTRIAL CONTAINER DEPOT & WAREHOUSE (West / Northwest)
// -------------------------------------------------------------
// B Warehouse Enclosure Walls with Entrance Doors & Window (X: -60 to -24, Z: -56 to -18)
addBox(-60, 0, -56, 36, H_WALL, 2.5, T.CONCRETE_MASONRY); // North Warehouse Wall
addBox(-60, 0, -56, 2.5, H_WALL, 38, T.CONCRETE_MASONRY); // West Wall
addBox(-26.5, 0, -56, 2.5, H_WALL, 38, T.CONCRETE_MASONRY); // East Wall

// B Site Entrance Doors & Windows
addBox(-60, 0, -18, 12, H_WALL, 2.5, T.CONCRETE_MASONRY); // South-West Wall
addBox(-38, 0, -18, 14, H_WALL, 2.5, T.CONCRETE_MASONRY); // South-East Wall
// B Main Doorway (Gap from -48 to -38)
addBox(-48, 4.2, -18, 10, 2.3, 2.5, T.STEEL_PLATE); // Door lintel

// B Site Multi-Colored Stacked Shipping Containers (运输船 / Cache 风格集装箱战术迷宫)
// Blue Container 1 (40ft long)
addShippingContainer(-52, 0, -48, 4.5, 3.0, 12, T.STEEL_PLATE, T.DARK_BASALT);
// Red Container 2 (angled cover in center B)
addShippingContainer(-42, 0, -42, 10, 3.0, 4.5, T.RED_TERRACOTTA, T.DARK_BASALT);
// Yellow Container 3 (stacked on top of Container 1 creating high sniper perch)
addShippingContainer(-51, 3.0, -46, 4.2, 2.8, 10, T.SANDSTONE, T.DARK_BASALT);
// Green / Steel Container 4 (covering B Window)
addShippingContainer(-36, 0, -32, 4.5, 3.0, 8, T.TACTICAL_FOLIAGE, T.DARK_BASALT);

// B Elevated Catwalk & Ladder Ramp (Y=3.0, X: -56 to -44, Z: -26 to -20)
addBox(-56, 3.0, -26, 12, 0.6, 6, T.STEEL_PLATE);
addBox(-56, 3.6, -26, 12, 0.6, 0.5, T.STEEL_PLATE); // Railing
addStepStairs(-56, 0, -34, 5, 1.8, 6, 0.5, 0, 1, T.STEEL_PLATE);

// B Site Crates, Supply Shelves & Ammo Stacks
addCrateStack(-34, -48);
addCrateStack(-50, -32);
addBox(-44, 0, -53, 8, 2.4, 1.4, T.SUPPLY_SHELF);
addBox(-32, 0, -53, 4, 2.4, 1.4, T.SUPPLY_SHELF);

// B Tunnels / Catacombs (地下暗道从 T 家通向 B 区, X: -58 to -38, Z: 8 to 44)
addBox(-58, 0, 12, 2.5, 4.5, 34, T.DARK_BASALT); // Tunnel West Wall
addBox(-42, 0, 12, 2.5, 4.5, 34, T.DARK_BASALT); // Tunnel East Wall
// Tunnel Roof with skylights
for (let tz = 12; tz < 44; tz += 8) {
  addBox(-58, 4.5, tz, 18, 0.8, 5, T.DARK_BASALT);
}
addCrateStack(-50, 24);
addBox(-50, 0, 36, 6, 1.2, 2, T.STEEL_PLATE);

// -------------------------------------------------------------
// 5. ZONE MID: CENTRAL CROSS, MID DOORS & UNDERPASS WATER CANAL
// -------------------------------------------------------------
// Mid Doors Sniper Duel Alley (中路双门对狙中缝, Z: -20 to 16, X: -14 to 14)
// West Mid Wall
addBox(-18, 0, -18, 3.0, H_WALL, 34, T.CONCRETE_MASONRY);
addBox(-18, H_WALL, -18, 3.0, 0.35, 34, T.DARK_BASALT);
addBox(14, 0, -18, 3.0, H_WALL, 34, T.CONCRETE_MASONRY);
addBox(14, H_WALL, -18, 3.0, 0.35, 34, T.DARK_BASALT);

// Mid Doors (中门实体掩体，留出 2 米狭窄对狙缝隙)
addBox(-15, 0, 2, 6.0, 4.0, 1.2, T.STEEL_PLATE); // Left Door
addBox(-7, 0, 2, 6.0, 4.0, 1.2, T.STEEL_PLATE);  // Right Door
// Door lintel
addBox(-15, 4.0, 2, 14, 2.0, 1.2, T.DARK_BASALT);

// Underpass / Sunken Aqueduct Water Canal (地下水渠暗道 - X: -26 to 14, Z: -6 to 6)
// Deep sunken trench with flowing water
addBox(-26, -0.8, -6, 40, 0.8, 12, T.AZURE_WATER); // Sunken water surface
addBox(-28, 0, -7, 44, 0.5, 1.0, T.DARK_BASALT); // Water canal north rim
addBox(-28, 0, 6, 44, 0.5, 1.0, T.DARK_BASALT);  // Water canal south rim
// Steps leading down into water canal from Mid
addStepStairs(8, 0, -6, 5, 1.5, 2, 0.4, 0, -1, T.CONCRETE_MASONRY);
addStepStairs(-20, 0, 6, 5, 1.5, 2, 0.4, 0, 1, T.CONCRETE_MASONRY);

// High Stone Sky Bridge over Mid Water Canal (Y=3.2, X: -20 to 20, Z: -5 to 5)
addBox(-18, 3.2, -4, 36, 0.8, 8, T.DARK_BASALT);
addBox(-18, 4.0, -4, 36, 0.7, 0.5, T.STEEL_PLATE); // North railing
addBox(-18, 4.0, 3.5, 36, 0.7, 0.5, T.STEEL_PLATE); // South railing

// Mid Tactical Cover Boxes & Pallets
addDoubleCrate(-4, -14);
addCrateStack(4, -12);
addDoubleCrate(-2, 10);
addCrateStack(6, 12);

// -------------------------------------------------------------
// 6. ZONE T-SPAWN & BAZAAR (South Sector, Z: 36 to 58, X: -36 to 36)
// -------------------------------------------------------------
// T-Spawn Sandstone Bazaar Walls & Archways
addBox(-34, 0, 48, 68, 1.5, 8, T.SANDSTONE); // Raised spawn courtyard
addBox(-34, 1.5, 48, 68, 0.6, 0.6, T.RED_TERRACOTTA); // Border rail
addStepStairs(-34, 0, 44, 6, 1.5, 3, 0.5, 0, 1, T.SANDSTONE);
addStepStairs(28, 0, 44, 6, 1.5, 3, 0.5, 0, 1, T.SANDSTONE);

// Bazaar Market Stalls & Cover Pallets
addBox(-20, 1.5, 50, 8, 2.2, 1.4, T.SUPPLY_SHELF);
addBox(12, 1.5, 50, 8, 2.2, 1.4, T.SUPPLY_SHELF);
addCrateStack(-6, 42);
addCrateStack(6, 42);
addDoubleCrate(-16, 36);
addDoubleCrate(16, 36);

// T-Spawn Palm Planters & Beacon Lamps
addBox(-28, 0, 40, 3, 2.5, 3, T.TACTICAL_FOLIAGE);
addBox(25, 0, 40, 3, 2.5, 3, T.TACTICAL_FOLIAGE);
addBox(-1.5, 1.5, 52, 3.0, 2.5, 3.0, T.CYBER_BEACON);

// -------------------------------------------------------------
// 7. ZONE CT-SPAWN & DEFENSE BARRACKS (North Sector, Z: -58 to -36, X: -24 to 24)
// -------------------------------------------------------------
// Fortified Command Parapet (Y=1.5, X: -22 to 22, Z: -56 to -44)
addBox(-22, 0, -56, 44, 1.5, 12, T.CONCRETE_MASONRY);
addBox(-22, 1.5, -44.5, 44, 0.6, 0.6, T.STEEL_PLATE); // Low sandbag cover
addStepStairs(-22, 0, -44, 6, 1.5, 3, 0.5, 0, -1, T.CONCRETE_MASONRY);
addStepStairs(16, 0, -44, 6, 1.5, 3, 0.5, 0, -1, T.CONCRETE_MASONRY);

// CT Armory Racks & Supply Shelves
addBox(-18, 1.5, -54, 10, 2.2, 1.2, T.SUPPLY_SHELF);
addBox(8, 1.5, -54, 10, 2.2, 1.2, T.SUPPLY_SHELF);
addCrateStack(-6, -42);
addCrateStack(6, -42);

// -------------------------------------------------------------
// 8. GENERATE 180+ GUARANTEED NON-INTERSECTING SPAWN POINTS
// -------------------------------------------------------------
const PH = 0.35;
const H_STAND = 1.8;

function isSpawnClear(x, y, z) {
  const minX = x - PH, maxX = x + PH;
  const minY = y, maxY = y + H_STAND;
  const minZ = z - PH, maxZ = z + PH;

  if (Math.abs(x) > ARENA_SIZE / 2 - 4 || Math.abs(z) > ARENA_SIZE / 2 - 4) return false;

  for (const b of blocks) {
    if (b.t === T.AZURE_WATER) continue; // Water does not block spawning
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
  const ry = Math.round(y * 100) / 100;
  const rx = Math.round(x * 10) / 10;
  const rz = Math.round(z * 10) / 10;
  if (isSpawnClear(rx, ry, rz) && !spawns.some((spawn) => spawn[0] === rx && spawn[1] === ry && spawn[2] === rz)) {
    spawns.push([rx, ry, rz]);
    return true;
  }
  return false;
}

// 1. A Site & Long A Spawns
for (let z = -50; z <= -30; z += 4.5) {
  for (let x = 32; x <= 50; x += 5.5) {
    tryAddSpawn(x, 1.5, z);
  }
}
for (let z = -20; z <= 30; z += 5) {
  tryAddSpawn(48, 0, z);
  tryAddSpawn(54, 0, z);
}

// 2. B Site Container Depot & Warehouse Spawns
for (let z = -50; z <= -24; z += 5) {
  for (let x = -54; x <= -30; x += 6) {
    tryAddSpawn(x, 0, z);
  }
}
// B Tunnel Spawns
for (let z = 14; z <= 40; z += 5) {
  tryAddSpawn(-48, 0, z);
  tryAddSpawn(-52, 0, z);
}

// 3. Mid Lane & Underpass Spawns
for (let z = -22; z <= 22; z += 4.5) {
  tryAddSpawn(-6, 0, z);
  tryAddSpawn(2, 0, z);
  tryAddSpawn(8, 0, z);
}
// Catwalk & Sky Bridge Spawns
tryAddSpawn(20, 2.5, -20);
tryAddSpawn(28, 2.5, -20);
tryAddSpawn(-10, 3.2, 0);
tryAddSpawn(0, 3.2, 0);
tryAddSpawn(10, 3.2, 0);

// 4. T-Spawn Bazaar & Courtyard Spawns
for (let z = 36; z <= 52; z += 4.5) {
  for (let x = -30; x <= 30; x += 5.5) {
    tryAddSpawn(x, z > 46 ? 1.5 : 0, z);
  }
}

// 5. CT-Spawn Defense Barracks Spawns
for (let z = -54; z <= -38; z += 4.5) {
  for (let x = -20; x <= 20; x += 5.5) {
    tryAddSpawn(x, z < -44 ? 1.5 : 0, z);
  }
}

// Fill extra spawns across open arena grid to guarantee 180+
for (let x = -ARENA_SIZE / 2 + 8; x <= ARENA_SIZE / 2 - 8; x += 4) {
  for (let z = -ARENA_SIZE / 2 + 8; z <= ARENA_SIZE / 2 - 8; z += 4) {
    if (spawns.length >= 220) break;
    tryAddSpawn(x, 0, z);
  }
}

console.log(`Generated Competitive Tactical Map!`);
console.log(`Total blocks: ${blocks.length}`);
console.log(`Total valid spawns: ${spawns.length}`);

const mapData = {
  size: [SIZE, SIZE],
  blocks,
  spawns,
};

const fs = await import('node:fs');
fs.writeFileSync(new URL('../map.json', import.meta.url), JSON.stringify(mapData, null, 2));
