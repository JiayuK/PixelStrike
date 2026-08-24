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

const skinCache = new Map<number, SkinTextures>();

function canvasTex(canvas: OffscreenCanvas): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function getMCSkin(skinId: number): SkinTextures {
  const id = ((skinId % SKIN_NAMES.length) + SKIN_NAMES.length) % SKIN_NAMES.length;
  const cached = skinCache.get(id);
  if (cached) return cached;

  const textures = generateMCSkin(id);
  skinCache.set(id, textures);
  return textures;
}

function generateMCSkin(id: number): SkinTextures {
  // ---- 1. Head Texture (64x32) ----
  const headCanvas = new OffscreenCanvas(64, 32);
  const hCtx = headCanvas.getContext('2d')!;

  // ---- 2. Torso Texture (32x32) ----
  const torsoCanvas = new OffscreenCanvas(32, 32);
  const tCtx = torsoCanvas.getContext('2d')!;

  // ---- 3. Arm Texture (32x32) ----
  const armCanvas = new OffscreenCanvas(32, 32);
  const aCtx = armCanvas.getContext('2d')!;

  // ---- 4. Leg Texture (32x32) ----
  const legCanvas = new OffscreenCanvas(32, 32);
  const lCtx = legCanvas.getContext('2d')!;

  switch (id) {
    case 0: { // 0: Classic Steve
      // Head
      hCtx.fillStyle = '#482b18'; // Brown Hair
      hCtx.fillRect(0, 0, 64, 32);
      hCtx.fillStyle = '#d9a377'; // Skin Tone
      hCtx.fillRect(16, 16, 16, 16); // Face
      hCtx.fillStyle = '#482b18'; // Hair bangs
      hCtx.fillRect(16, 16, 16, 4);
      hCtx.fillRect(16, 20, 2, 4);
      hCtx.fillRect(30, 20, 2, 4);
      // Steve Eyes
      hCtx.fillStyle = '#ffffff';
      hCtx.fillRect(18, 22, 4, 3);
      hCtx.fillRect(26, 22, 4, 3);
      hCtx.fillStyle = '#2c3577'; // Indigo pupil
      hCtx.fillRect(20, 22, 2, 3);
      hCtx.fillRect(26, 22, 2, 3);
      // Nose & Mouth / Beard
      hCtx.fillStyle = '#be7e50';
      hCtx.fillRect(23, 24, 2, 2);
      hCtx.fillStyle = '#582f1b';
      hCtx.fillRect(18, 26, 12, 2);

      // Torso: Cyan T-shirt with V-neck
      tCtx.fillStyle = '#00a8aa';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#008a8c';
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          if ((x + y * 3) % 7 === 0) tCtx.fillRect(x, y, 1, 1);
        }
      }
      // V-neck skin
      tCtx.fillStyle = '#d9a377';
      tCtx.fillRect(12, 0, 8, 6);
      tCtx.fillRect(14, 6, 4, 4);

      // Arms: Cyan sleeve top + skin forearm
      aCtx.fillStyle = '#00a8aa';
      aCtx.fillRect(0, 0, 32, 10);
      aCtx.fillStyle = '#d9a377';
      aCtx.fillRect(0, 10, 32, 22);

      // Legs: Indigo blue jeans + gray shoes
      lCtx.fillStyle = '#2b3577';
      lCtx.fillRect(0, 0, 32, 26);
      lCtx.fillStyle = '#1e2456';
      for (let y = 0; y < 26; y++) {
        for (let x = 0; x < 32; x++) {
          if ((x + y) % 5 === 0) lCtx.fillRect(x, y, 1, 1);
        }
      }
      lCtx.fillStyle = '#5a5a66'; // Gray Shoes
      lCtx.fillRect(0, 26, 32, 6);
      break;
    }

    case 1: { // 1: Tactical Alex
      // Head: Orange hair, bright green eyes
      hCtx.fillStyle = '#b85c18'; // Orange hair
      hCtx.fillRect(0, 0, 64, 32);
      hCtx.fillStyle = '#e8b890'; // Fair skin
      hCtx.fillRect(16, 16, 16, 16);
      hCtx.fillStyle = '#b85c18';
      hCtx.fillRect(16, 16, 16, 4);
      hCtx.fillRect(16, 20, 3, 6);
      // Green eyes
      hCtx.fillStyle = '#ffffff';
      hCtx.fillRect(19, 22, 3, 3);
      hCtx.fillRect(26, 22, 3, 3);
      hCtx.fillStyle = '#16a34a';
      hCtx.fillRect(20, 22, 2, 3);
      hCtx.fillRect(26, 22, 2, 3);

      // Torso: Green tunic with dark brown tactical belt
      tCtx.fillStyle = '#4d7c3b';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#3a602c';
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          if ((x + y) % 6 === 0) tCtx.fillRect(x, y, 1, 1);
        }
      }
      tCtx.fillStyle = '#e8b890';
      tCtx.fillRect(13, 0, 6, 5);
      tCtx.fillStyle = '#3b2516'; // Leather belt
      tCtx.fillRect(0, 24, 32, 6);
      tCtx.fillStyle = '#d4af37'; // Gold buckle
      tCtx.fillRect(13, 24, 6, 6);

      // Arms: Green sleeve + fair skin
      aCtx.fillStyle = '#4d7c3b';
      aCtx.fillRect(0, 0, 32, 12);
      aCtx.fillStyle = '#e8b890';
      aCtx.fillRect(0, 12, 32, 20);

      // Legs: Dark brown trousers + tall boots
      lCtx.fillStyle = '#5c4028';
      lCtx.fillRect(0, 0, 32, 24);
      lCtx.fillStyle = '#2b1b10'; // Dark boots
      lCtx.fillRect(0, 24, 32, 8);
      break;
    }

    case 2: { // 2: SWAT Spec-Ops
      // Head: Black balaclava, night-vision tinted blue goggles
      hCtx.fillStyle = '#181b20';
      hCtx.fillRect(0, 0, 64, 32);
      // Goggles
      hCtx.fillStyle = '#0284c7';
      hCtx.fillRect(18, 21, 12, 5);
      hCtx.fillStyle = '#38bdf8';
      hCtx.fillRect(19, 22, 4, 3);
      hCtx.fillRect(25, 22, 4, 3);
      hCtx.fillStyle = '#bae6fd';
      hCtx.fillRect(20, 22, 1, 1);
      hCtx.fillRect(26, 22, 1, 1);
      // Helmet NVG mount
      hCtx.fillStyle = '#475569';
      hCtx.fillRect(22, 16, 4, 3);

      // Torso: Heavy SWAT tactical armor vest + radio & MOLLE
      tCtx.fillStyle = '#181b20';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#0f172a';
      tCtx.fillRect(6, 4, 20, 24);
      tCtx.fillStyle = '#334155';
      tCtx.fillRect(8, 8, 16, 2);
      tCtx.fillRect(8, 14, 16, 2);
      tCtx.fillRect(8, 20, 16, 2);
      // "POLICE" / "SWAT" badge
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(12, 6, 8, 3);

      // Arms: Black combat uniform + tactical gloves
      aCtx.fillStyle = '#1e293b';
      aCtx.fillRect(0, 0, 32, 20);
      aCtx.fillStyle = '#0f172a'; // Gloves
      aCtx.fillRect(0, 20, 32, 12);
      aCtx.fillStyle = '#38bdf8'; // Blue wristband
      aCtx.fillRect(0, 18, 32, 2);

      // Legs: Dark tactical cargo pants + combat boots
      lCtx.fillStyle = '#1e293b';
      lCtx.fillRect(0, 0, 32, 24);
      lCtx.fillStyle = '#0f172a';
      lCtx.fillRect(4, 12, 10, 8); // Holster
      lCtx.fillRect(0, 24, 32, 8); // Boots
      break;
    }

    case 3: { // 3: Desert Camo Operator
      // Head: Desert tan helmet, dark tactical sunglasses, beard
      hCtx.fillStyle = '#9e8561';
      hCtx.fillRect(0, 0, 64, 32);
      hCtx.fillStyle = '#d4a276';
      hCtx.fillRect(16, 18, 16, 14);
      // Dark sunglasses
      hCtx.fillStyle = '#0f172a';
      hCtx.fillRect(17, 21, 14, 4);
      hCtx.fillStyle = '#475569';
      hCtx.fillRect(18, 22, 5, 2);
      hCtx.fillRect(25, 22, 5, 2);
      // Tactical beard
      hCtx.fillStyle = '#54361e';
      hCtx.fillRect(18, 26, 12, 3);

      // Torso: Desert 3-color camo + coyote tactical plate carrier
      tCtx.fillStyle = '#c2a67e';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#9e8561';
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          if ((x * 2 + y * 5) % 6 === 0) tCtx.fillRect(x, y, 2, 2);
        }
      }
      tCtx.fillStyle = '#7a6042'; // Coyote Vest
      tCtx.fillRect(6, 4, 20, 24);
      tCtx.fillStyle = '#543f29';
      tCtx.fillRect(8, 14, 4, 8); tCtx.fillRect(14, 14, 4, 8); tCtx.fillRect(20, 14, 4, 8);

      // Arms: Tan sleeves + tactical glove
      aCtx.fillStyle = '#c2a67e';
      aCtx.fillRect(0, 0, 32, 20);
      aCtx.fillStyle = '#543f29';
      aCtx.fillRect(0, 20, 32, 12);

      // Legs: Desert pants + knee pads + desert boots
      lCtx.fillStyle = '#c2a67e';
      lCtx.fillRect(0, 0, 32, 24);
      lCtx.fillStyle = '#7a6042'; // Knee pads
      lCtx.fillRect(2, 12, 12, 6);
      lCtx.fillRect(18, 12, 12, 6);
      lCtx.fillStyle = '#8f704e'; // Desert boots
      lCtx.fillRect(0, 24, 32, 8);
      break;
    }

    case 4: { // 4: Cyber Neon
      // Head: Dark matte helmet with glowing cyan HUD visor
      hCtx.fillStyle = '#0f1218';
      hCtx.fillRect(0, 0, 64, 32);
      // Cyber Neon Visor
      hCtx.fillStyle = '#06b6d4';
      hCtx.fillRect(17, 20, 14, 6);
      hCtx.fillStyle = '#a5f3fc';
      hCtx.fillRect(18, 21, 6, 2);
      hCtx.fillRect(25, 21, 5, 2);
      hCtx.fillStyle = '#ec4899'; // Pink cyber circuit accent
      hCtx.fillRect(0, 24, 16, 2);
      hCtx.fillRect(48, 24, 16, 2);

      // Torso: Carbon fiber jacket with neon cyan piping
      tCtx.fillStyle = '#11141c';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#06b6d4';
      tCtx.fillRect(6, 6, 2, 20);
      tCtx.fillRect(24, 6, 2, 20);
      tCtx.fillRect(6, 16, 20, 2);
      tCtx.fillStyle = '#ec4899';
      tCtx.fillRect(14, 10, 4, 4);

      // Arms: Cybernetic sleeves + neon glow rings
      aCtx.fillStyle = '#11141c';
      aCtx.fillRect(0, 0, 32, 32);
      aCtx.fillStyle = '#06b6d4';
      aCtx.fillRect(0, 10, 32, 2);
      aCtx.fillRect(0, 22, 32, 2);

      // Legs: Carbon pants + LED combat boots
      lCtx.fillStyle = '#11141c';
      lCtx.fillRect(0, 0, 32, 32);
      lCtx.fillStyle = '#06b6d4';
      lCtx.fillRect(4, 14, 8, 4);
      lCtx.fillRect(20, 14, 8, 4);
      lCtx.fillRect(0, 28, 32, 4);
      break;
    }

    case 5: { // 5: Arctic Snow Spec-Ops
      // Head: Snow white helmet + icy blue goggles
      hCtx.fillStyle = '#e2e8f0';
      hCtx.fillRect(0, 0, 64, 32);
      hCtx.fillStyle = '#94a3b8';
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 64; x++) {
          if ((x * 3 + y * 7) % 8 === 0) hCtx.fillRect(x, y, 2, 2);
        }
      }
      hCtx.fillStyle = '#0ea5e9';
      hCtx.fillRect(18, 21, 12, 4);
      hCtx.fillStyle = '#e0f2fe';
      hCtx.fillRect(19, 22, 4, 2); hCtx.fillRect(25, 22, 4, 2);

      // Torso: Arctic snow camouflage parka + tactical harness
      tCtx.fillStyle = '#f1f5f9';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#94a3b8';
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          if ((x + y * 2) % 5 === 0) tCtx.fillRect(x, y, 2, 2);
        }
      }
      tCtx.fillStyle = '#475569';
      tCtx.fillRect(8, 4, 16, 24);

      // Arms: Snow camo + dark thermal gloves
      aCtx.fillStyle = '#f1f5f9';
      aCtx.fillRect(0, 0, 32, 20);
      aCtx.fillStyle = '#334155';
      aCtx.fillRect(0, 20, 32, 12);

      // Legs: Snow camo pants + heavy winter boots
      lCtx.fillStyle = '#f1f5f9';
      lCtx.fillRect(0, 0, 32, 24);
      lCtx.fillStyle = '#334155';
      lCtx.fillRect(0, 24, 32, 8);
      break;
    }

    case 6: { // 6: Crusader Knight
      // Head: Steel Greathelm with cross slit visor
      hCtx.fillStyle = '#94a3b8';
      hCtx.fillRect(0, 0, 64, 32);
      hCtx.fillStyle = '#cbd5e1';
      hCtx.fillRect(16, 0, 32, 16);
      // Gold Cross Visor
      hCtx.fillStyle = '#d97706';
      hCtx.fillRect(18, 20, 12, 6);
      hCtx.fillRect(22, 16, 4, 14);
      hCtx.fillStyle = '#0f172a'; // Eye slits
      hCtx.fillRect(19, 22, 10, 2);

      // Torso: Chainmail + White surcoat with red cross emblem
      tCtx.fillStyle = '#f8fafc';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#dc2626'; // Red Crusader Cross
      tCtx.fillRect(13, 4, 6, 24);
      tCtx.fillRect(4, 10, 24, 6);
      tCtx.fillStyle = '#b45309'; // Leather belt
      tCtx.fillRect(0, 24, 32, 4);

      // Arms: Chainmail & Steel Plate Gauntlets
      aCtx.fillStyle = '#64748b';
      aCtx.fillRect(0, 0, 32, 20);
      aCtx.fillStyle = '#94a3b8';
      aCtx.fillRect(0, 20, 32, 12);

      // Legs: Steel plate greaves & sabatons
      lCtx.fillStyle = '#64748b';
      lCtx.fillRect(0, 0, 32, 24);
      lCtx.fillStyle = '#94a3b8';
      lCtx.fillRect(0, 24, 32, 8);
      break;
    }

    default: { // 7: Jungle Commando
      // Head: Green camo face paint + red bandana
      hCtx.fillStyle = '#2e1c0c';
      hCtx.fillRect(0, 0, 64, 32);
      hCtx.fillStyle = '#dc2626'; // Red Bandana
      hCtx.fillRect(0, 16, 64, 5);
      hCtx.fillStyle = '#d9a377'; // Face
      hCtx.fillRect(16, 21, 16, 11);
      // Camo face stripes
      hCtx.fillStyle = '#166534';
      hCtx.fillRect(17, 24, 4, 2);
      hCtx.fillRect(26, 24, 4, 2);
      hCtx.fillRect(20, 28, 6, 2);
      // Eyes
      hCtx.fillStyle = '#ffffff';
      hCtx.fillRect(18, 22, 3, 2); hCtx.fillRect(26, 22, 3, 2);
      hCtx.fillStyle = '#1e293b';
      hCtx.fillRect(19, 22, 2, 2); hCtx.fillRect(26, 22, 2, 2);

      // Torso: Woodland camouflage vest
      tCtx.fillStyle = '#166534';
      tCtx.fillRect(0, 0, 32, 32);
      tCtx.fillStyle = '#3f2e18';
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          if ((x * 3 + y * 2) % 5 === 0) tCtx.fillRect(x, y, 2, 2);
        }
      }
      tCtx.fillStyle = '#d9a377'; // Bare chest area
      tCtx.fillRect(12, 0, 8, 8);

      // Arms: Bare muscular arms + combat wrist wraps
      aCtx.fillStyle = '#d9a377';
      aCtx.fillRect(0, 0, 32, 22);
      aCtx.fillStyle = '#166534';
      aCtx.fillRect(0, 22, 32, 10);

      // Legs: Woodland camo cargo pants + combat jungle boots
      lCtx.fillStyle = '#166534';
      lCtx.fillRect(0, 0, 32, 24);
      lCtx.fillStyle = '#3f2e18';
      lCtx.fillRect(4, 12, 10, 8);
      lCtx.fillStyle = '#1c1917'; // Boots
      lCtx.fillRect(0, 24, 32, 8);
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
