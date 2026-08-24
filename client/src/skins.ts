import * as THREE from 'three';

export interface SkinTextures {
  head: THREE.Texture;
  torso: THREE.Texture;
  arm: THREE.Texture;
  leg: THREE.Texture;
}

export const SKIN_NAMES = [
  '经典史蒂夫 / Classic Steve',
  '战术爱丽克斯 / Tactical Alex',
  '特警特战队 / SWAT Spec-Ops',
  '沙漠风暴特工 / Desert Operator',
  '赛博暗影佣兵 / Cyber Neon',
  '极地雪狐特遣 / Arctic Snow',
  '十字军圣骑士 / Crusader Knight',
  '丛林幽灵突击 / Jungle Commando',
];
export const SKIN_COUNT = SKIN_NAMES.length;
export type SkinPart = keyof SkinTextures;

const skinCache = new Map<number, SkinTextures>();
const atlasCache = new Map<SkinPart, THREE.Texture>();

export function normalizeSkin(id: number) {
  return ((id % SKIN_COUNT) + SKIN_COUNT) % SKIN_COUNT;
}

function canvasTex(canvas: OffscreenCanvas): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function getMCSkin(skinId: number): SkinTextures {
  const id = normalizeSkin(skinId);
  const cached = skinCache.get(id);
  if (cached) return cached;

  const textures = generateMCSkin(id);
  skinCache.set(id, textures);
  return textures;
}

export function getMCSkinAtlas(part: SkinPart): THREE.Texture {
  const cached = atlasCache.get(part);
  if (cached) return cached;

  const first = getMCSkin(0)[part].image as OffscreenCanvas;
  const stride = first.width + 2;
  const canvas = new OffscreenCanvas(stride * SKIN_COUNT, first.height);
  const ctx = canvas.getContext('2d')!;
  for (let id = 0; id < SKIN_COUNT; id++) {
    const image = getMCSkin(id)[part].image as OffscreenCanvas;
    const x = id * stride;
    ctx.drawImage(image, x + 1, 0);
    ctx.drawImage(image, 0, 0, 1, image.height, x, 0, 1, image.height);
    ctx.drawImage(image, image.width - 1, 0, 1, image.height, x + image.width + 1, 0, 1, image.height);
  }
  const texture = canvasTex(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.userData.skinAtlas = { tileWidth: first.width, atlasWidth: canvas.width, stride };
  atlasCache.set(part, texture);
  return texture;
}

// ---- Drawing Helpers for Crisp Pixel Art ----
function fill(ctx: OffscreenCanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function noise(
  ctx: OffscreenCanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
  step = 3,
  shift = 1,
) {
  ctx.fillStyle = color;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if ((px * shift + py * 5 + (px ^ py)) % step === 0) {
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
}

function strokeBrd(ctx: OffscreenCanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function generateMCSkin(id: number): SkinTextures {
  // Head: 64x32
  const headCanvas = new OffscreenCanvas(64, 32);
  const hCtx = headCanvas.getContext('2d')!;

  // Torso: 64x32
  const torsoCanvas = new OffscreenCanvas(64, 32);
  const tCtx = torsoCanvas.getContext('2d')!;

  // Arm: 32x32
  const armCanvas = new OffscreenCanvas(32, 32);
  const aCtx = armCanvas.getContext('2d')!;

  // Leg: 32x32
  const legCanvas = new OffscreenCanvas(32, 32);
  const lCtx = legCanvas.getContext('2d')!;

  switch (id) {
    case 0: { // 0: Classic Steve (High-Definition Shaded)
      // --- Head (64x32) ---
      // Base hair background
      fill(hCtx, '#382012', 0, 0, 64, 32);
      noise(hCtx, '#2b170c', 0, 0, 64, 16, 4);
      noise(hCtx, '#4c2e1b', 0, 0, 64, 16, 5);

      // Top helmet / head (+Y)
      fill(hCtx, '#422716', 16, 0, 16, 16);
      noise(hCtx, '#301a0d', 16, 0, 16, 16, 3);
      // Neck bottom (-Y)
      fill(hCtx, '#c68f64', 32, 0, 16, 16);

      // Accessory Palette Zone (x: 0..16, y: 0..16)
      fill(hCtx, '#382012', 0, 0, 8, 8); // NVG mount / hair clip
      fill(hCtx, '#2b170c', 8, 0, 8, 8); // Brim base
      fill(hCtx, '#4a2c17', 0, 8, 8, 8); // Earcups / sides
      fill(hCtx, '#1d1108', 8, 8, 8, 8); // Dark accent

      // Front Face (-Z: 16..32, 16..32)
      fill(hCtx, '#d9a377', 16, 16, 16, 16);
      fill(hCtx, '#c79165', 16, 28, 16, 4); // Chin shadow
      // Steve Hair & Bangs
      fill(hCtx, '#382012', 16, 16, 16, 4);
      fill(hCtx, '#382012', 16, 20, 2, 4);
      fill(hCtx, '#382012', 30, 20, 2, 4);
      fill(hCtx, '#27150a', 18, 16, 12, 1);
      // Eyes (White + Indigo Pupil + Highlight)
      fill(hCtx, '#ffffff', 18, 22, 4, 3);
      fill(hCtx, '#ffffff', 26, 22, 4, 3);
      fill(hCtx, '#2c3577', 20, 22, 2, 3);
      fill(hCtx, '#2c3577', 26, 22, 2, 3);
      fill(hCtx, '#4b5bd6', 20, 22, 1, 1);
      fill(hCtx, '#4b5bd6', 26, 22, 1, 1);
      // Nose & Beard/Mouth
      fill(hCtx, '#be7e50', 23, 24, 2, 2);
      fill(hCtx, '#4e2a18', 19, 26, 10, 2);
      fill(hCtx, '#6b3c23', 21, 26, 6, 1);

      // Sides of Head (+X: 0..16, 16..32 / -X: 32..48, 16..32)
      fill(hCtx, '#d9a377', 0, 20, 16, 12);
      fill(hCtx, '#382012', 0, 16, 16, 4);
      fill(hCtx, '#382012', 8, 20, 8, 6);
      fill(hCtx, '#d9a377', 32, 20, 16, 12);
      fill(hCtx, '#382012', 32, 16, 16, 4);
      fill(hCtx, '#382012', 32, 20, 8, 6);

      // Back of Head (+Z: 48..64, 16..32)
      fill(hCtx, '#382012', 48, 16, 16, 16);
      noise(hCtx, '#2b170c', 48, 16, 16, 16, 3);

      // --- Torso (64x32) ---
      // Tactical Accessory Palette (x: 0..12, y: 0..8)
      fill(tCtx, '#1a4e52', 0, 0, 4, 4); // Vest base
      fill(tCtx, '#143d40', 4, 0, 4, 4); // Straps
      fill(tCtx, '#0e2b2d', 8, 0, 4, 4); // Mag pouches
      fill(tCtx, '#262930', 0, 4, 4, 4); // Tactical Belt
      fill(tCtx, '#1b1d22', 4, 4, 4, 4); // Radio
      fill(tCtx, '#707785', 8, 4, 4, 4); // Antenna / Buckle

      // Shoulders (+Y: 12..32, 0..8)
      fill(tCtx, '#009da0', 12, 0, 20, 8);
      fill(tCtx, '#d9a377', 18, 2, 8, 6); // Neck hole

      // Waist Bottom (-Y: 44..64, 0..8)
      fill(tCtx, '#1f2655', 44, 0, 20, 8);

      // Front Chest (-Z: 12..32, 8..32)
      fill(tCtx, '#00a8aa', 12, 8, 20, 24);
      noise(tCtx, '#008a8c', 12, 8, 20, 24, 4);
      // V-neck skin
      fill(tCtx, '#d9a377', 18, 8, 8, 5);
      fill(tCtx, '#d9a377', 20, 13, 4, 3);
      fill(tCtx, '#be7e50', 21, 14, 2, 2);
      // Folds and side seam shading
      fill(tCtx, '#00797b', 12, 8, 2, 24);
      fill(tCtx, '#00797b', 30, 8, 2, 24);
      fill(tCtx, '#008a8c', 14, 20, 6, 2);
      fill(tCtx, '#008a8c', 22, 22, 6, 2);
      // Tactical Leather Belt & Silver Buckle at waist
      fill(tCtx, '#23272e', 12, 28, 20, 4);
      fill(tCtx, '#9ba2b0', 20, 28, 4, 4);
      fill(tCtx, '#23272e', 21, 29, 2, 2);

      // Flanks (+X: 0..12, 8..32 / -X: 32..44, 8..32)
      fill(tCtx, '#009da0', 0, 8, 12, 24);
      fill(tCtx, '#23272e', 0, 28, 12, 4);
      fill(tCtx, '#009da0', 32, 8, 12, 24);
      fill(tCtx, '#23272e', 32, 28, 12, 4);

      // Back (+Z: 44..64, 8..32)
      fill(tCtx, '#00a8aa', 44, 8, 20, 24);
      noise(tCtx, '#008a8c', 44, 8, 20, 24, 4);
      fill(tCtx, '#00797b', 44, 8, 2, 24);
      fill(tCtx, '#00797b', 62, 8, 2, 24);
      fill(tCtx, '#23272e', 44, 28, 20, 4);

      // --- Arm (32x32) ---
      // Accessories (x: 0..8, y: 0..8)
      fill(aCtx, '#008a8c', 0, 0, 4, 4); // Shoulder pad
      fill(aCtx, '#007274', 4, 0, 4, 4); // Elbow pad

      // Top cap (8..16, 0..8) & Bottom palm (16..24, 0..8)
      fill(aCtx, '#00a8aa', 8, 0, 8, 8);
      fill(aCtx, '#c68f64', 16, 0, 8, 8);

      // Sleeves & Forearms (y: 8..32)
      fill(aCtx, '#00a8aa', 0, 8, 32, 8);
      fill(aCtx, '#008a8c', 0, 15, 32, 1); // Sleeve hem seam
      fill(aCtx, '#d9a377', 0, 16, 32, 16);
      noise(aCtx, '#c79165', 0, 16, 32, 16, 5);
      // Hand wrist crease
      fill(aCtx, '#be7e50', 0, 28, 32, 1);

      // --- Leg (32x32) ---
      // Accessories (x: 0..8, y: 0..8)
      fill(lCtx, '#1f2655', 0, 0, 4, 4); // Knee pad
      fill(lCtx, '#3a3a44', 4, 0, 4, 4); // Boot toe
      fill(lCtx, '#181b22', 0, 4, 4, 4); // Holster

      // Denim Pants (y: 8..26)
      fill(lCtx, '#2b3577', 0, 8, 32, 18);
      noise(lCtx, '#1e2456', 0, 8, 32, 18, 4);
      noise(lCtx, '#384594', 0, 10, 32, 10, 5); // Denim fade
      // Sneaker shoes (y: 26..32)
      fill(lCtx, '#4c4c57', 0, 26, 32, 4);
      fill(lCtx, '#dadce0', 0, 30, 32, 2); // White rubber sole
      fill(lCtx, '#dadce0', 10, 27, 4, 1); // Laces
      break;
    }

    case 1: { // 1: Tactical Alex (Tactical Field Operator)
      // --- Head (64x32) ---
      fill(hCtx, '#b45309', 0, 0, 64, 32);
      noise(hCtx, '#8a3c05', 0, 0, 64, 16, 3);
      fill(hCtx, '#92400e', 16, 0, 16, 16);
      fill(hCtx, '#d49b72', 32, 0, 16, 16);

      // Accessory Palette
      fill(hCtx, '#3a4a2f', 0, 0, 8, 8); // Tactical brim
      fill(hCtx, '#283320', 8, 0, 8, 8); // NVG mount
      fill(hCtx, '#4a3319', 0, 8, 8, 8); // Comms headset

      // Front Face
      fill(hCtx, '#e8b890', 16, 16, 16, 16);
      fill(hCtx, '#d69e76', 16, 28, 16, 4);
      // Orange bangs & side hair
      fill(hCtx, '#b45309', 16, 16, 16, 4);
      fill(hCtx, '#b45309', 16, 20, 3, 6);
      fill(hCtx, '#8a3c05', 18, 16, 12, 1);
      // Emerald Green Eyes + Catchlight
      fill(hCtx, '#ffffff', 19, 22, 3, 3);
      fill(hCtx, '#ffffff', 26, 22, 3, 3);
      fill(hCtx, '#15803d', 20, 22, 2, 3);
      fill(hCtx, '#15803d', 26, 22, 2, 3);
      fill(hCtx, '#4ade80', 20, 22, 1, 1);
      fill(hCtx, '#4ade80', 26, 22, 1, 1);
      // Nose & Mouth
      fill(hCtx, '#d4956d', 23, 25, 2, 1);
      fill(hCtx, '#c27d58', 22, 27, 4, 1);

      // Sides & Back
      fill(hCtx, '#e8b890', 0, 22, 16, 10);
      fill(hCtx, '#b45309', 0, 16, 16, 6);
      fill(hCtx, '#e8b890', 32, 22, 16, 10);
      fill(hCtx, '#b45309', 32, 16, 16, 6);
      fill(hCtx, '#b45309', 48, 16, 16, 16);

      // --- Torso (64x32) ---
      // Tactical Accessory Palette
      fill(tCtx, '#3a532d', 0, 0, 4, 4); // Olive tactical vest
      fill(tCtx, '#2d4023', 4, 0, 4, 4); // Straps
      fill(tCtx, '#4d3319', 8, 0, 4, 4); // Leather mag pouches
      fill(tCtx, '#3b2516', 0, 4, 4, 4); // Leather belt
      fill(tCtx, '#21291d', 4, 4, 4, 4); // Radio
      fill(tCtx, '#d4af37', 8, 4, 4, 4); // Gold buckle

      // Front Chest
      fill(tCtx, '#4d7c3b', 12, 8, 20, 24);
      noise(tCtx, '#3a602c', 12, 8, 20, 24, 4);
      // Neckline
      fill(tCtx, '#e8b890', 19, 8, 6, 4);
      // Tactical Leather Harness & Belt
      fill(tCtx, '#3b2516', 15, 8, 2, 16);
      fill(tCtx, '#3b2516', 27, 8, 2, 16);
      fill(tCtx, '#d4af37', 15, 14, 2, 2);
      fill(tCtx, '#d4af37', 27, 14, 2, 2);
      fill(tCtx, '#3b2516', 12, 24, 20, 6);
      fill(tCtx, '#d4af37', 19, 24, 6, 6);
      fill(tCtx, '#3b2516', 20, 25, 4, 4);

      // Sides & Back
      fill(tCtx, '#4d7c3b', 0, 8, 12, 24);
      fill(tCtx, '#3b2516', 0, 24, 12, 6);
      fill(tCtx, '#4d7c3b', 32, 8, 12, 24);
      fill(tCtx, '#3b2516', 32, 24, 12, 6);
      fill(tCtx, '#4d7c3b', 44, 8, 20, 24);
      noise(tCtx, '#3a602c', 44, 8, 20, 24, 4);
      fill(tCtx, '#3b2516', 44, 24, 20, 6);

      // --- Arm (32x32) ---
      fill(aCtx, '#3a532d', 0, 0, 4, 4);
      fill(aCtx, '#2d4023', 4, 0, 4, 4);
      fill(aCtx, '#4d7c3b', 0, 8, 32, 8);
      fill(aCtx, '#3a602c', 0, 15, 32, 1);
      fill(aCtx, '#e8b890', 0, 16, 32, 16);
      // Brown leather tactical fingerless gloves
      fill(aCtx, '#4a311b', 0, 26, 32, 6);
      fill(aCtx, '#d4af37', 2, 27, 2, 2);

      // --- Leg (32x32) ---
      fill(lCtx, '#3b2516', 0, 0, 4, 4); // Knee pad
      fill(lCtx, '#1e130a', 4, 0, 4, 4); // Boot toe
      fill(lCtx, '#3b2516', 0, 4, 4, 4); // Holster
      // Dark brown cargo pants
      fill(lCtx, '#5c4028', 0, 8, 32, 16);
      noise(lCtx, '#442e1b', 0, 8, 32, 16, 4);
      // Tall lace-up combat boots
      fill(lCtx, '#24170e', 0, 24, 32, 8);
      fill(lCtx, '#3d291a', 0, 24, 32, 2);
      fill(lCtx, '#100a06', 0, 30, 32, 2);
      break;
    }

    case 2: { // 2: SWAT Spec-Ops (Tactical Assault)
      // --- Head (64x32) ---
      fill(hCtx, '#121418', 0, 0, 64, 32);
      noise(hCtx, '#1b1f24', 0, 0, 64, 16, 3);
      fill(hCtx, '#1a1d22', 16, 0, 16, 16);

      // Accessory Palette
      fill(hCtx, '#1b2028', 0, 0, 8, 8); // FAST Helmet Brim
      fill(hCtx, '#334155', 8, 0, 8, 8); // NVG Shroud Mount
      fill(hCtx, '#0f172a', 0, 8, 8, 8); // Headset Earcups
      fill(hCtx, '#0284c7', 8, 8, 8, 8); // Blue Visor Glass

      // Front Face: Balaclava + Cyan Tactical Goggles
      fill(hCtx, '#16191f', 16, 16, 16, 16);
      // Balaclava nose bridge & breath mesh
      fill(hCtx, '#0d0f12', 21, 26, 6, 4);
      // High-Tech Illuminated Goggles
      fill(hCtx, '#0369a1', 17, 20, 14, 5);
      fill(hCtx, '#38bdf8', 18, 21, 4, 3);
      fill(hCtx, '#38bdf8', 26, 21, 4, 3);
      fill(hCtx, '#e0f2fe', 19, 21, 2, 1);
      fill(hCtx, '#e0f2fe', 27, 21, 2, 1);
      // Helmet NVG Mount
      fill(hCtx, '#475569', 22, 16, 4, 3);
      fill(hCtx, '#64748b', 23, 17, 2, 1);

      // --- Torso (64x32) ---
      // Accessory Palette
      fill(tCtx, '#0f172a', 0, 0, 4, 4); // Heavy Ballistic Vest
      fill(tCtx, '#1e293b', 4, 0, 4, 4); // Shoulder Straps
      fill(tCtx, '#111827', 8, 0, 4, 4); // Mag Pouches
      fill(tCtx, '#0a0d12', 0, 4, 4, 4); // Duty Belt
      fill(tCtx, '#1e2229', 4, 4, 4, 4); // Comms Radio
      fill(tCtx, '#0284c7', 8, 4, 4, 4); // Blue Accents

      // Front Chest: Heavy Ceramic Body Armor & MOLLE
      fill(tCtx, '#181b20', 12, 8, 20, 24);
      fill(tCtx, '#0f172a', 14, 10, 16, 20);
      strokeBrd(tCtx, '#334155', 14, 10, 16, 20);
      // "POLICE" / "SWAT" White Stencil
      fill(tCtx, '#ffffff', 17, 12, 10, 2);
      fill(tCtx, '#38bdf8', 16, 15, 12, 1); // Blue indicator light
      // Triple Tactical Mag Pouches
      fill(tCtx, '#1e293b', 15, 18, 4, 6);
      fill(tCtx, '#1e293b', 20, 18, 4, 6);
      fill(tCtx, '#1e293b', 25, 18, 4, 6);
      // Duty Belt
      fill(tCtx, '#0b0e14', 12, 28, 20, 4);
      fill(tCtx, '#475569', 20, 28, 4, 4);

      // Sides & Back: "SWAT" on back plate
      fill(tCtx, '#181b20', 0, 8, 12, 24);
      fill(tCtx, '#181b20', 32, 8, 12, 24);
      fill(tCtx, '#181b20', 44, 8, 20, 24);
      fill(tCtx, '#0f172a', 46, 10, 16, 20);
      fill(tCtx, '#ffffff', 49, 13, 10, 3); // Large Back SWAT sign

      // --- Arm (32x32) ---
      fill(aCtx, '#0f172a', 0, 0, 4, 4); // Shoulder pad
      fill(aCtx, '#1e293b', 4, 0, 4, 4); // Elbow pad
      fill(aCtx, '#1e293b', 0, 8, 32, 14);
      fill(aCtx, '#0284c7', 0, 16, 32, 2); // Blue Tactical ID Armband
      // Armored Kevlar Combat Gloves
      fill(aCtx, '#0f172a', 0, 22, 32, 10);
      fill(aCtx, '#334155', 2, 24, 6, 3); // Molded knuckle protector

      // --- Leg (32x32) ---
      fill(lCtx, '#0f172a', 0, 0, 4, 4); // Knee pad
      fill(lCtx, '#080a0d', 4, 0, 4, 4); // Steel toe boot
      fill(lCtx, '#0b0e14', 0, 4, 4, 4); // Holster
      fill(lCtx, '#1a2230', 0, 8, 32, 16);
      noise(lCtx, '#121822', 0, 8, 32, 16, 4);
      // Hard tactical knee pads
      fill(lCtx, '#0f172a', 2, 14, 6, 6);
      fill(lCtx, '#334155', 3, 15, 4, 4);
      // Assault boots
      fill(lCtx, '#0c0e12', 0, 24, 32, 8);
      fill(lCtx, '#1f242d', 0, 24, 32, 2);
      break;
    }

    case 3: { // 3: Desert Camo Operator
      // --- Head (64x32) ---
      fill(hCtx, '#a38a67', 0, 0, 64, 32);
      noise(hCtx, '#806848', 0, 0, 64, 16, 3);
      noise(hCtx, '#c2a884', 0, 0, 64, 16, 4);

      // Accessory Palette
      fill(hCtx, '#7a6042', 0, 0, 8, 8); // Tan Brim
      fill(hCtx, '#475569', 8, 0, 8, 8); // NVG Mount
      fill(hCtx, '#3b2c1b', 0, 8, 8, 8); // Comms Headset

      // Front Face: Tan Helmet + Polarized Sunglasses + Beard
      fill(hCtx, '#d4a276', 16, 16, 16, 16);
      fill(hCtx, '#a38a67', 16, 16, 16, 4); // Helmet rim
      // Dark Polarized Sunglasses
      fill(hCtx, '#0f172a', 17, 21, 14, 4);
      fill(hCtx, '#475569', 18, 22, 5, 2);
      fill(hCtx, '#475569', 25, 22, 5, 2);
      fill(hCtx, '#94a3b8', 19, 22, 2, 1);
      fill(hCtx, '#94a3b8', 26, 22, 2, 1);
      // Tactical Beard & Stubble
      fill(hCtx, '#54361e', 18, 26, 12, 4);
      fill(hCtx, '#6b4528', 19, 26, 10, 1);

      // --- Torso (64x32) ---
      // Accessory Palette
      fill(tCtx, '#7a6042', 0, 0, 4, 4); // Coyote Plate Carrier
      fill(tCtx, '#5f4930', 4, 0, 4, 4); // Webbing Straps
      fill(tCtx, '#8c6e4c', 8, 0, 4, 4); // Mag Pouches
      fill(tCtx, '#4a3824', 0, 4, 4, 4); // Riggers Belt
      fill(tCtx, '#262017', 4, 4, 4, 4); // Radio
      fill(tCtx, '#d97706', 8, 4, 4, 4); // IR Flag Patch

      // Front Chest: Desert 3-Color Multicam + Coyote Vest
      fill(tCtx, '#c2a67e', 12, 8, 20, 24);
      noise(tCtx, '#9e8561', 12, 8, 20, 24, 3);
      noise(tCtx, '#735c3e', 12, 8, 20, 24, 5);
      // Coyote Plate Carrier
      fill(tCtx, '#7a6042', 14, 10, 16, 18);
      fill(tCtx, '#5f4930', 15, 14, 4, 7);
      fill(tCtx, '#5f4930', 20, 14, 4, 7);
      fill(tCtx, '#5f4930', 25, 14, 4, 7);
      // Tan belt
      fill(tCtx, '#4a3824', 12, 28, 20, 4);

      // Sides & Back
      fill(tCtx, '#c2a67e', 0, 8, 12, 24);
      fill(tCtx, '#c2a67e', 32, 8, 12, 24);
      fill(tCtx, '#c2a67e', 44, 8, 20, 24);
      fill(tCtx, '#7a6042', 46, 10, 16, 18);

      // --- Arm (32x32) ---
      fill(aCtx, '#7a6042', 0, 0, 4, 4);
      fill(aCtx, '#5f4930', 4, 0, 4, 4);
      fill(aCtx, '#c2a67e', 0, 8, 32, 12);
      noise(aCtx, '#9e8561', 0, 8, 32, 12, 3);
      fill(aCtx, '#d4a276', 0, 20, 32, 4); // Bare forearm
      // Tan Oakley Combat Gloves
      fill(aCtx, '#543f29', 0, 24, 32, 8);
      fill(aCtx, '#7a6042', 2, 25, 6, 3);

      // --- Leg (32x32) ---
      fill(lCtx, '#7a6042', 0, 0, 4, 4);
      fill(lCtx, '#5c452e', 4, 0, 4, 4);
      fill(lCtx, '#4a3824', 0, 4, 4, 4);
      fill(lCtx, '#c2a67e', 0, 8, 32, 16);
      noise(lCtx, '#9e8561', 0, 8, 32, 16, 3);
      // Knee Pads
      fill(lCtx, '#7a6042', 2, 14, 6, 6);
      fill(lCtx, '#5f4930', 3, 15, 4, 4);
      // Suede Desert Boots
      fill(lCtx, '#806443', 0, 24, 32, 8);
      fill(lCtx, '#574127', 0, 30, 32, 2);
      break;
    }

    case 4: { // 4: Cyber Neon (Cybernetic Stealth Suit)
      // --- Head (64x32) ---
      fill(hCtx, '#090b10', 0, 0, 64, 32);
      noise(hCtx, '#121620', 0, 0, 64, 16, 3);

      // Accessory Palette
      fill(hCtx, '#0f172a', 0, 0, 8, 8); // Carbon Helm
      fill(hCtx, '#06b6d4', 8, 0, 8, 8); // Neon Cyan Glow
      fill(hCtx, '#ec4899', 0, 8, 8, 8); // Neon Magenta Accent
      fill(hCtx, '#22d3ee', 8, 8, 8, 8); // Visor Glint

      // Front Face: Cyber Visor & HUD Glint
      fill(hCtx, '#0d111a', 16, 16, 16, 16);
      fill(hCtx, '#0891b2', 17, 20, 14, 6);
      fill(hCtx, '#06b6d4', 18, 21, 12, 4);
      fill(hCtx, '#a5f3fc', 19, 21, 4, 2);
      fill(hCtx, '#a5f3fc', 25, 21, 4, 2);
      // Cyber Neon Temple Traces
      fill(hCtx, '#ec4899', 0, 24, 16, 1);
      fill(hCtx, '#06b6d4', 32, 24, 16, 1);
      fill(hCtx, '#06b6d4', 48, 22, 16, 2);

      // --- Torso (64x32) ---
      // Accessory Palette
      fill(tCtx, '#0c0f17', 0, 0, 4, 4); // Exoskeleton Armor
      fill(tCtx, '#06b6d4', 4, 0, 4, 4); // Cyan Power Conduit
      fill(tCtx, '#ec4899', 8, 0, 4, 4); // Core Reactor
      fill(tCtx, '#05070a', 0, 4, 4, 4); // Harness
      fill(tCtx, '#1e293b', 4, 4, 4, 4); // Battery Pack
      fill(tCtx, '#38bdf8', 8, 4, 4, 4); // LED Grid

      // Front Chest: Carbon Composite + Illuminated Neon Conduits
      fill(tCtx, '#0f121a', 12, 8, 20, 24);
      noise(tCtx, '#182030', 12, 8, 20, 24, 4);
      // Cyan Power Conduits
      fill(tCtx, '#06b6d4', 16, 10, 2, 18);
      fill(tCtx, '#06b6d4', 26, 10, 2, 18);
      fill(tCtx, '#06b6d4', 16, 18, 12, 2);
      // Magenta Core Reactor
      fill(tCtx, '#ec4899', 20, 12, 4, 4);
      fill(tCtx, '#fbcfe8', 21, 13, 2, 2);

      // Sides & Back: Cyber Spine
      fill(tCtx, '#0f121a', 0, 8, 12, 24);
      fill(tCtx, '#0f121a', 32, 8, 12, 24);
      fill(tCtx, '#0f121a', 44, 8, 20, 24);
      fill(tCtx, '#06b6d4', 53, 10, 2, 18); // Illuminated Cyber Spine

      // --- Arm (32x32) ---
      fill(aCtx, '#0c0f17', 0, 0, 4, 4);
      fill(aCtx, '#06b6d4', 4, 0, 4, 4);
      fill(aCtx, '#0f121a', 0, 8, 32, 24);
      fill(aCtx, '#06b6d4', 0, 14, 32, 2); // Neon Ring
      fill(aCtx, '#ec4899', 0, 24, 32, 2); // Wrist Power Ring

      // --- Leg (32x32) ---
      fill(lCtx, '#06b6d4', 0, 0, 4, 4); // LED Knee
      fill(lCtx, '#05070a', 4, 0, 4, 4); // Carbon Boot
      fill(lCtx, '#0f121a', 0, 4, 4, 4);
      fill(lCtx, '#0f121a', 0, 8, 32, 24);
      fill(lCtx, '#06b6d4', 2, 14, 6, 6); // Glowing Knee
      fill(lCtx, '#ec4899', 0, 28, 32, 4); // Neon Treads
      break;
    }

    case 5: { // 5: Arctic Snow Spec-Ops (Frostbite Camo)
      // --- Head (64x32) ---
      fill(hCtx, '#e2e8f0', 0, 0, 64, 32);
      noise(hCtx, '#94a3b8', 0, 0, 64, 32, 4);
      noise(hCtx, '#64748b', 0, 0, 64, 16, 5);

      // Accessory Palette
      fill(hCtx, '#cbd5e1', 0, 0, 8, 8); // Snow Brim
      fill(hCtx, '#475569', 8, 0, 8, 8); // NVG
      fill(hCtx, '#334155', 0, 8, 8, 8); // Headset

      // Front Face: Snow Camo Mask + Polarized Ice-Blue Goggles
      fill(hCtx, '#e2e8f0', 16, 16, 16, 16);
      noise(hCtx, '#94a3b8', 16, 16, 16, 16, 4);
      // Ice Goggles
      fill(hCtx, '#0284c7', 17, 20, 14, 5);
      fill(hCtx, '#38bdf8', 18, 21, 4, 3);
      fill(hCtx, '#38bdf8', 26, 21, 4, 3);
      fill(hCtx, '#f0f9ff', 19, 21, 2, 1);
      fill(hCtx, '#f0f9ff', 27, 21, 2, 1);

      // --- Torso (64x32) ---
      // Accessory Palette
      fill(tCtx, '#475569', 0, 0, 4, 4); // Arctic Plate Carrier
      fill(tCtx, '#334155', 4, 0, 4, 4); // Straps
      fill(tCtx, '#64748b', 8, 0, 4, 4); // Mag Pouches
      fill(tCtx, '#1e293b', 0, 4, 4, 4); // Belt
      fill(tCtx, '#0f172a', 4, 4, 4, 4); // Radio
      fill(tCtx, '#38bdf8', 8, 4, 4, 4); // Icy Carabiner

      // Front Chest: Arctic Snow Camo Parka & Slate Vest
      fill(tCtx, '#f1f5f9', 12, 8, 20, 24);
      noise(tCtx, '#94a3b8', 12, 8, 20, 24, 3);
      noise(tCtx, '#64748b', 12, 8, 20, 24, 5);
      // Slate Plate Carrier
      fill(tCtx, '#475569', 14, 10, 16, 18);
      fill(tCtx, '#334155', 16, 14, 4, 7);
      fill(tCtx, '#334155', 24, 14, 4, 7);
      fill(tCtx, '#1e293b', 12, 28, 20, 4);

      // Sides & Back
      fill(tCtx, '#f1f5f9', 0, 8, 12, 24);
      fill(tCtx, '#f1f5f9', 32, 8, 12, 24);
      fill(tCtx, '#f1f5f9', 44, 8, 20, 24);
      fill(tCtx, '#475569', 46, 10, 16, 18);

      // --- Arm (32x32) ---
      fill(aCtx, '#475569', 0, 0, 4, 4);
      fill(aCtx, '#334155', 4, 0, 4, 4);
      fill(aCtx, '#f1f5f9', 0, 8, 32, 14);
      noise(aCtx, '#94a3b8', 0, 8, 32, 14, 4);
      // Thermal Slate Gloves
      fill(aCtx, '#334155', 0, 22, 32, 10);
      fill(aCtx, '#475569', 2, 24, 6, 3);

      // --- Leg (32x32) ---
      fill(lCtx, '#334155', 0, 0, 4, 4);
      fill(lCtx, '#1e293b', 4, 0, 4, 4);
      fill(lCtx, '#334155', 0, 4, 4, 4);
      fill(lCtx, '#f1f5f9', 0, 8, 32, 16);
      noise(lCtx, '#94a3b8', 0, 8, 32, 16, 4);
      fill(lCtx, '#334155', 2, 14, 6, 6);
      // Winter Snow Boots
      fill(lCtx, '#1e293b', 0, 24, 32, 8);
      fill(lCtx, '#475569', 0, 24, 32, 2);
      break;
    }

    case 6: { // 6: Crusader Knight (Polished Steel & Heraldic Tabard)
      // --- Head (64x32) ---
      fill(hCtx, '#94a3b8', 0, 0, 64, 32);
      noise(hCtx, '#64748b', 0, 0, 64, 16, 3);
      fill(hCtx, '#cbd5e1', 16, 0, 16, 16); // Polished Crown

      // Accessory Palette
      fill(hCtx, '#d97706', 0, 0, 8, 8); // Gold Visor Inlay
      fill(hCtx, '#475569', 8, 0, 8, 8); // Steel Rivets
      fill(hCtx, '#64748b', 0, 8, 8, 8); // Chainmail Coif

      // Front Face: Greathelm & Gold-Inlaid Cross Slits
      fill(hCtx, '#cbd5e1', 16, 16, 16, 16);
      // Golden Cross Visor Frame
      fill(hCtx, '#d97706', 17, 20, 14, 6);
      fill(hCtx, '#d97706', 22, 16, 4, 14);
      fill(hCtx, '#f59e0b', 18, 21, 12, 4);
      fill(hCtx, '#f59e0b', 23, 17, 2, 12);
      // Dark Eye Breath Slits
      fill(hCtx, '#0f172a', 18, 22, 12, 2);
      fill(hCtx, '#0f172a', 23, 18, 2, 10);

      // --- Torso (64x32) ---
      // Accessory Palette
      fill(tCtx, '#b45309', 0, 0, 4, 4); // Knight Girdle Belt
      fill(tCtx, '#dc2626', 4, 0, 4, 4); // Red Templar Fabric
      fill(tCtx, '#d97706', 8, 0, 4, 4); // Gold Trim
      fill(tCtx, '#78350f', 0, 4, 4, 4); // Scabbard Leather
      fill(tCtx, '#64748b', 4, 4, 4, 4); // Chainmail
      fill(tCtx, '#f8fafc', 8, 4, 4, 4); // White Tabard

      // Front Chest: White Tabard + Bold Red Crusader Cross
      fill(tCtx, '#f8fafc', 12, 8, 20, 24);
      noise(tCtx, '#e2e8f0', 12, 8, 20, 24, 4);
      // Red Templar Cross
      fill(tCtx, '#dc2626', 20, 10, 4, 16);
      fill(tCtx, '#dc2626', 14, 14, 16, 4);
      fill(tCtx, '#b91c1c', 21, 11, 2, 14);
      fill(tCtx, '#b91c1c', 15, 15, 14, 2);
      // Gold Knight Belt
      fill(tCtx, '#b45309', 12, 26, 20, 6);
      fill(tCtx, '#d97706', 19, 26, 6, 6);

      // Sides & Back
      fill(tCtx, '#64748b', 0, 8, 12, 24); // Chainmail flanks
      fill(tCtx, '#64748b', 32, 8, 12, 24);
      fill(tCtx, '#f8fafc', 44, 8, 20, 24);
      fill(tCtx, '#dc2626', 52, 10, 4, 16);

      // --- Arm (32x32) ---
      fill(aCtx, '#cbd5e1', 0, 0, 4, 4); // Steel Pauldron
      fill(aCtx, '#94a3b8', 4, 0, 4, 4); // Elbow Couter
      // Chainmail Sleeves + Steel Gauntlets
      fill(aCtx, '#64748b', 0, 8, 32, 14);
      noise(aCtx, '#475569', 0, 8, 32, 14, 3);
      fill(aCtx, '#cbd5e1', 0, 22, 32, 10);
      fill(aCtx, '#94a3b8', 2, 24, 6, 3);

      // --- Leg (32x32) ---
      fill(lCtx, '#cbd5e1', 0, 0, 4, 4); // Poleyn Knee
      fill(lCtx, '#94a3b8', 4, 0, 4, 4); // Sabaton Toe
      fill(lCtx, '#78350f', 0, 4, 4, 4);
      // Chainmail Chausses & Steel Greaves
      fill(lCtx, '#64748b', 0, 8, 32, 16);
      noise(lCtx, '#475569', 0, 8, 32, 16, 3);
      fill(lCtx, '#cbd5e1', 2, 14, 6, 6); // Steel Knee
      // Steel Sabaton Armor Boots
      fill(lCtx, '#94a3b8', 0, 24, 32, 8);
      fill(lCtx, '#cbd5e1', 0, 24, 32, 2);
      break;
    }

    default: { // 7: Jungle Commando (Tiger-stripe Camo & Bandana)
      // --- Head (64x32) ---
      fill(hCtx, '#2e1c0c', 0, 0, 64, 32);
      // Iconic Red Commando Bandana (y: 14..19 across head)
      fill(hCtx, '#dc2626', 0, 14, 64, 5);
      fill(hCtx, '#ef4444', 0, 15, 64, 2);

      // Accessory Palette
      fill(hCtx, '#166534', 0, 0, 8, 8); // Camo Brim
      fill(hCtx, '#15803d', 8, 0, 8, 8); // Bandana Tie
      fill(hCtx, '#3f2e18', 0, 8, 8, 8); // Earth Camo

      // Front Face: War Paint & Fierce Eyes
      fill(hCtx, '#d9a377', 16, 19, 16, 13);
      // Woodland Tiger-Stripe Face Paint
      fill(hCtx, '#166534', 17, 23, 5, 2);
      fill(hCtx, '#166534', 26, 23, 5, 2);
      fill(hCtx, '#27272a', 18, 25, 4, 1);
      fill(hCtx, '#27272a', 27, 25, 4, 1);
      fill(hCtx, '#166534', 20, 28, 6, 2);
      // Warrior Eyes
      fill(hCtx, '#ffffff', 18, 21, 3, 2);
      fill(hCtx, '#ffffff', 26, 21, 3, 2);
      fill(hCtx, '#1e293b', 19, 21, 2, 2);
      fill(hCtx, '#1e293b', 26, 21, 2, 2);

      // --- Torso (64x32) ---
      // Accessory Palette
      fill(tCtx, '#166534', 0, 0, 4, 4); // Tiger Camo Vest
      fill(tCtx, '#27272a', 4, 0, 4, 4); // Straps
      fill(tCtx, '#3f2e18', 8, 0, 4, 4); // Mag Pouches
      fill(tCtx, '#2b1d0f', 0, 4, 4, 4); // Combat Belt
      fill(tCtx, '#14532d', 4, 4, 4, 4); // Radio
      fill(tCtx, '#ca8a04', 8, 4, 4, 4); // Brass Ammo Belt

      // Front Chest: Muscular Bare Chest + Tiger Stripe Assault Rig
      fill(tCtx, '#166534', 12, 8, 20, 24);
      noise(tCtx, '#3f2e18', 12, 8, 20, 24, 3);
      noise(tCtx, '#15803d', 12, 8, 20, 24, 4);
      // Exposed muscular chest
      fill(tCtx, '#d9a377', 18, 8, 8, 8);
      fill(tCtx, '#c79165', 19, 13, 6, 3); // Pectoral shadow
      fill(tCtx, '#94a3b8', 21, 10, 2, 3); // Dog tags
      // Ammo Bandolier across chest
      fill(tCtx, '#ca8a04', 14, 16, 3, 2);
      fill(tCtx, '#ca8a04', 18, 18, 3, 2);
      fill(tCtx, '#ca8a04', 22, 20, 3, 2);
      fill(tCtx, '#ca8a04', 26, 22, 3, 2);
      fill(tCtx, '#2b1d0f', 12, 28, 20, 4);

      // Sides & Back
      fill(tCtx, '#166534', 0, 8, 12, 24);
      fill(tCtx, '#166534', 32, 8, 12, 24);
      fill(tCtx, '#166534', 44, 8, 20, 24);
      noise(tCtx, '#3f2e18', 44, 8, 20, 24, 3);

      // --- Arm (32x32) ---
      fill(aCtx, '#166534', 0, 0, 4, 4);
      fill(aCtx, '#3f2e18', 4, 0, 4, 4);
      // Muscular Bare Arms
      fill(aCtx, '#d9a377', 0, 8, 32, 20);
      noise(aCtx, '#c79165', 0, 8, 32, 20, 4);
      fill(aCtx, '#be7e50', 0, 18, 32, 2); // Bicep crease
      // Wrapped Combat Wrist Tape & Gloves
      fill(aCtx, '#166534', 0, 24, 32, 8);
      fill(aCtx, '#14532d', 2, 25, 6, 3);

      // --- Leg (32x32) ---
      fill(lCtx, '#166534', 0, 0, 4, 4);
      fill(lCtx, '#111827', 4, 0, 4, 4);
      fill(lCtx, '#3f2e18', 0, 4, 4, 4); // Knife Sheath
      fill(lCtx, '#166534', 0, 8, 32, 16);
      noise(lCtx, '#3f2e18', 0, 8, 32, 16, 3);
      noise(lCtx, '#15803d', 0, 8, 32, 16, 4);
      // Heavy Black Jungle Boots
      fill(lCtx, '#18181b', 0, 24, 32, 8);
      fill(lCtx, '#27272a', 0, 24, 32, 2);
      break;
    }
  }

  return {
    head: canvasTex(headCanvas),
    torso: canvasTex(torsoCanvas),
    arm: canvasTex(armCanvas),
    leg: canvasTex(legCanvas),
  };
}
