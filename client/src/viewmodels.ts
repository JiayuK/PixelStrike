import * as THREE from 'three';

const VIEW_LAYER = 1;

export interface AssembledWeapon {
  root: THREE.Group;
  magazine: THREE.Group | null;
  bolt: THREE.Group | null;
  muzzle: THREE.Vector3;
}

export type WeaponSkin = 0 | 1 | 2;

export function applyWeaponSkin(root: THREE.Object3D, skin: number) {
  if (skin !== 1 && skin !== 2) return;
  const tint = new THREE.Color(skin === 1 ? 0xffc928 : 0x72e7ff);
  const skinned = new Map<THREE.Material, THREE.Material>();
  const materialFor = (source: THREE.Material) => {
    const cached = skinned.get(source);
    if (cached) return cached;
    const material = source.clone();
    if (material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshBasicMaterial) {
      material.color.lerp(tint, skin === 1 ? 0.72 : 0.62);
      if (material instanceof THREE.MeshLambertMaterial) {
        material.emissive.copy(tint).multiplyScalar(skin === 1 ? 0.08 : 0.16);
      }
    }
    skinned.set(source, material);
    return material;
  };
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material) ? object.material.map(materialFor) : materialFor(object.material);
  });
}

export interface Mats {
  dark: THREE.MeshLambertMaterial;
  gun: THREE.MeshLambertMaterial;
  gunSteel: THREE.MeshLambertMaterial;
  silver: THREE.MeshLambertMaterial;
  chrome: THREE.MeshLambertMaterial;
  wood: THREE.MeshLambertMaterial;
  woodDark: THREE.MeshLambertMaterial;
  camo: THREE.MeshLambertMaterial;
  camoDark: THREE.MeshLambertMaterial;
  grip: THREE.MeshLambertMaterial;
  blue: THREE.MeshLambertMaterial;
  brass: THREE.MeshLambertMaterial;
  copper: THREE.MeshLambertMaterial;
  tritium: THREE.MeshBasicMaterial;
  tritiumRed: THREE.MeshBasicMaterial;
  red: THREE.MeshLambertMaterial;
  white: THREE.MeshBasicMaterial;
  glass: THREE.MeshLambertMaterial;
  skin: THREE.MeshLambertMaterial;
  sleeve: THREE.MeshLambertMaterial;
  tan: THREE.MeshLambertMaterial;
  tanDark: THREE.MeshLambertMaterial;
  glove: THREE.MeshLambertMaterial;
  gloveKnuckle: THREE.MeshLambertMaterial;
  gloveStrap: THREE.MeshLambertMaterial;
  scopeBody: THREE.MeshLambertMaterial;
  rail: THREE.MeshLambertMaterial;
}

const texCache = new Map<string, THREE.Texture>();

function getTex(key: string, create: () => OffscreenCanvas): THREE.Texture {
  const cached = texCache.get(key);
  if (cached) return cached;
  const canvas = create();
  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

function makeBrushedMetal(baseColor: string, grainColor: string, edgeColor: string): OffscreenCanvas {
  const c = new OffscreenCanvas(128, 128);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = grainColor;
  for (let y = 0; y < 128; y++) {
    const len = 12 + (Math.sin(y * 11.7) * 0.5 + 0.5) * 44;
    for (let x = 0; x < 128; x += Math.floor(len + 4)) {
      if ((x + y * 5) % 2 === 0) {
        ctx.fillRect(x, y, len, 1);
      }
    }
  }
  // Bright top & left edge bevel highlight
  ctx.fillStyle = edgeColor;
  ctx.fillRect(0, 0, 128, 2);
  ctx.fillRect(0, 0, 2, 128);
  // Subtle shadow on bottom & right
  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(0, 126, 128, 2);
  ctx.fillRect(126, 0, 2, 128);
  return c;
}

function makeWoodGrain(baseColor: string, darkColor: string, highlightColor: string): OffscreenCanvas {
  const c = new OffscreenCanvas(128, 128);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = darkColor;
  for (let x = 0; x < 128; x++) {
    const freq = Math.sin(x * 0.12) * 5 + Math.sin(x * 0.04) * 10;
    for (let y = 0; y < 128; y++) {
      const wave = Math.sin(y * 0.08 + freq) * 3;
      if ((Math.floor(x + wave) % 6) === 0 || (Math.floor(x + wave * 0.6) % 11) === 0) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.fillStyle = highlightColor;
  for (let y = 0; y < 128; y += 14) {
    ctx.fillRect(0, y, 128, 2);
  }
  // Top edge gloss highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(0, 0, 128, 2);
  return c;
}

function makeTacticalGrip(): OffscreenCanvas {
  const c = new OffscreenCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a404c';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#5c6678';
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      const offset = (y / 4) % 2 === 0 ? 0 : 2;
      ctx.fillRect(x + offset, y, 2, 2);
    }
  }
  ctx.fillStyle = '#22262d';
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      const offset = (y / 4) % 2 === 0 ? 2 : 0;
      ctx.fillRect(x + offset, y, 2, 2);
    }
  }
  ctx.fillStyle = '#7a889e';
  ctx.fillRect(0, 0, 64, 1);
  return c;
}

function makeCamoTexture(c1: string, c2: string, c3: string, c4: string): OffscreenCanvas {
  const c = new OffscreenCanvas(128, 128);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 128, 128);
  const blotches = [
    { col: c2, pts: [[10, 20], [40, 15], [50, 45], [20, 50], [80, 80], [110, 70], [120, 100], [90, 115]] },
    { col: c3, pts: [[60, 10], [95, 25], [85, 55], [45, 35], [10, 90], [35, 120], [60, 105]] },
    { col: c4, pts: [[30, 70], [55, 65], [65, 85], [35, 95], [90, 30], [115, 40], [105, 60]] },
  ];
  for (const b of blotches) {
    ctx.fillStyle = b.col;
    for (let i = 0; i < b.pts.length; i += 2) {
      const [x, y] = b.pts[i];
      ctx.beginPath();
      ctx.ellipse(x, y, 18, 14, (x + y) * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, 0, 128, 2);
  return c;
}

function makeFabric(baseColor: string, gridColor: string): OffscreenCanvas {
  const c = new OffscreenCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = gridColor;
  for (let i = 0; i < 64; i += 5) {
    ctx.fillRect(i, 0, 1, 64);
    ctx.fillRect(0, i, 64, 1);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(0, 0, 64, 1);
  return c;
}

function makeCarbonFiber(): OffscreenCanvas {
  const c = new OffscreenCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#22262e';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#424a58';
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      ctx.fillRect(x, y, 4, 4);
      ctx.fillRect(x + 4, y + 4, 4, 4);
    }
  }
  ctx.fillStyle = '#5e6a7e';
  ctx.fillRect(0, 0, 64, 1);
  return c;
}
function makeScopeGlass(): OffscreenCanvas {
  const c = new OffscreenCanvas(128, 128);
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, '#103848');
  grad.addColorStop(0.7, '#081c28');
  grad.addColorStop(1, '#030a10');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(64, 224, 208, 0.25)';
  ctx.beginPath();
  ctx.arc(45, 45, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(63, 63, 2, 2);
  return c;
}

export function mats(): Mats {
  const texDark = getTex('dark', () => makeBrushedMetal('#424a56', 'rgba(255, 255, 255, 0.15)', '#8c9cb0'));
  const texGun = getTex('gun', () => makeBrushedMetal('#586476', 'rgba(255, 255, 255, 0.20)', '#b0c2d8'));
  const texGunSteel = getTex('gunSteel', () => makeBrushedMetal('#7c8ca2', 'rgba(255, 255, 255, 0.28)', '#d8e4f4'));
  const texSilver = getTex('silver', () => makeBrushedMetal('#b8c5d6', 'rgba(255, 255, 255, 0.38)', '#f0f5fc'));
  const texChrome = getTex('chrome', () => makeBrushedMetal('#e4ecf6', 'rgba(255, 255, 255, 0.50)', '#ffffff'));
  const texWood = getTex('wood', () => makeWoodGrain('#b86835', '#6c3514', 'rgba(255, 255, 255, 0.22)'));
  const texWoodDark = getTex('woodDark', () => makeWoodGrain('#8c4820', '#4e200a', 'rgba(255, 255, 255, 0.18)'));
  const texCamo = getTex('camo', () => makeCamoTexture('#668852', '#4a683a', '#b09c72', '#2f4425'));
  const texCamoDark = getTex('camoDark', () => makeCamoTexture('#4a683a', '#334828', '#8a7852', '#1f2e18'));
  const texGrip = getTex('grip', makeTacticalGrip);
  const texBlue = getTex('blue', () => makeBrushedMetal('#486888', 'rgba(255, 255, 255, 0.22)', '#8cb0d8'));
  const texBrass = getTex('brass', () => makeBrushedMetal('#f2cb48', 'rgba(255, 255, 255, 0.45)', '#fff4a8'));
  const texCopper = getTex('copper', () => makeBrushedMetal('#d88a4e', 'rgba(255, 255, 255, 0.38)', '#f8b884'));
  const texTan = getTex('tan', () => makeBrushedMetal('#c2aa84', 'rgba(255, 255, 255, 0.22)', '#e8d4b8'));
  const texTanDark = getTex('tanDark', () => makeBrushedMetal('#98805e', 'rgba(255, 255, 255, 0.18)', '#c4aa86'));
  const texGlove = getTex('glove', () => makeFabric('#363c46', '#525c6c'));
  const texGloveKnuckle = getTex('gloveKnuckle', makeCarbonFiber);
  const texGloveStrap = getTex('gloveStrap', () => makeFabric('#4a5c46', '#6c8466'));
  const texScopeBody = getTex('scopeBody', () => makeBrushedMetal('#3c4450', 'rgba(255, 255, 255, 0.16)', '#76869a'));
  const texRail = getTex('rail', () => makeBrushedMetal('#38404c', 'rgba(255, 255, 255, 0.15)', '#748296'));
  const texGlass = getTex('glass', makeScopeGlass);
  const texSleeve = getTex('sleeve', () => makeFabric('#3c626a', '#5c8e99'));

  return {
    dark: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texDark }),
    gun: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGun }),
    gunSteel: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGunSteel }),
    silver: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texSilver }),
    chrome: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texChrome }),
    wood: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texWood }),
    woodDark: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texWoodDark }),
    camo: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texCamo }),
    camoDark: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texCamoDark }),
    grip: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGrip }),
    blue: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texBlue }),
    brass: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texBrass }),
    copper: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texCopper }),
    tritium: new THREE.MeshBasicMaterial({ color: 0x39ff14 }),
    tritiumRed: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    red: new THREE.MeshLambertMaterial({ color: 0xba2418 }),
    white: new THREE.MeshBasicMaterial({ color: 0xf6f4ec }),
    glass: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGlass, transparent: true, opacity: 0.85 }),
    skin: new THREE.MeshLambertMaterial({ color: 0xd69d74 }),
    sleeve: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texSleeve }),
    tan: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texTan }),
    tanDark: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texTanDark }),
    glove: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGlove }),
    gloveKnuckle: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGloveKnuckle }),
    gloveStrap: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGloveStrap }),
    scopeBody: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texScopeBody }),
    rail: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texRail }),
  };
}

function box(mat: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

function cylZ(mat: THREE.Material, r: number, len: number, x = 0, y = 0, z = 0, segs = 12, r2 = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, segs), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

function cylX(mat: THREE.Material, r: number, len: number, x = 0, y = 0, z = 0, segs = 12, r2 = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, segs), mat);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

/** Create tactical operator hands with combat gloves, knuckle armor, and articulated fingers */
function addHands(handL: THREE.Group, handR: THREE.Group, m: Mats, style: 'pistol' | 'rifle' | 'knife') {
  // --- Right Hand (Firing Hand) ---
  const rArm = new THREE.Group();
  // Forearm with rolled sleeve & tactical watch/wrist strap
  rArm.add(
    box(m.sleeve, 0.12, 0.12, 0.38, 0.18, -0.26, 0.22, 0.52, -0.22, 0.12),
    box(m.gloveStrap, 0.126, 0.126, 0.05, 0.13, -0.19, 0.15, 0.52, -0.22, 0.12),
    box(m.dark, 0.04, 0.015, 0.035, 0.14, -0.16, 0.14, 0.52, -0.22, 0.12), // Tactical compass / watch
  );

  // Palm and glove chassis
  const rPalm = new THREE.Group();
  rPalm.add(
    box(m.glove, 0.088, 0.076, 0.11, 0, 0, 0),
    box(m.gloveKnuckle, 0.084, 0.022, 0.065, 0, 0.038, -0.01), // Hard molded knuckle protector
    box(m.grip, 0.076, 0.012, 0.09, 0, -0.038, 0), // Reinforced leather palm patch
    box(m.glove, 0.08, 0.034, 0.072, 0, -0.012, -0.076), // Fingers base
    box(m.gloveKnuckle, 0.076, 0.014, 0.055, 0, 0.01, -0.076), // Finger segment ridges
    box(m.glove, 0.028, 0.03, 0.058, 0.05, 0.012, -0.022, 0, 0, 0.38), // Thumb
    box(m.gloveKnuckle, 0.024, 0.012, 0.032, 0.054, 0.024, -0.026, 0, 0, 0.38),
  );

  if (style === 'pistol') {
    rPalm.position.set(0.02, -0.13, 0.05);
    rPalm.rotation.set(-0.05, 0.02, 0.04);
  } else if (style === 'knife') {
    rPalm.position.set(0.02, -0.02, 0.08);
    rPalm.rotation.set(-0.15, 0.1, 0.05);
  } else {
    rPalm.position.set(0.02, -0.1, 0.05);
    rPalm.rotation.set(-0.06, 0.02, 0.04);
  }
  handR.add(rArm, rPalm);

  if (style === 'knife') return;

  // --- Left Hand (Support Hand / Forend Grip) ---
  const lArm = new THREE.Group();
  lArm.add(
    box(m.sleeve, 0.12, 0.12, 0.38, -0.19, -0.25, 0.16, 0.48, 0.26, -0.12),
    box(m.gloveStrap, 0.126, 0.126, 0.05, -0.14, -0.18, 0.11, 0.48, 0.26, -0.12),
  );

  const lPalm = new THREE.Group();
  lPalm.add(
    box(m.glove, 0.085, 0.072, 0.1, 0, 0, 0),
    box(m.gloveKnuckle, 0.082, 0.02, 0.06, 0, 0.036, -0.01),
    box(m.grip, 0.074, 0.012, 0.085, 0, -0.036, 0),
    box(m.glove, 0.076, 0.032, 0.068, 0, -0.01, -0.072),
    box(m.gloveKnuckle, 0.072, 0.014, 0.05, 0, 0.01, -0.072),
    box(m.glove, 0.027, 0.028, 0.054, -0.048, 0.01, -0.02, 0, 0, -0.38),
    box(m.gloveKnuckle, 0.023, 0.012, 0.03, -0.052, 0.022, -0.024, 0, 0, -0.38),
  );

  if (style === 'pistol') {
    // Two-handed support cup grip under firing hand
    lPalm.position.set(-0.035, -0.142, 0.025);
    lPalm.rotation.set(0.12, 0.28, -0.18);
  } else {
    // Forward rifle handguard support hold
    lPalm.position.set(-0.03, -0.025, -0.22);
    lPalm.rotation.set(0.2, 0.15, -0.1);
  }
  handL.add(lArm, lPalm);
}

/** Detailed Handgun Platform (Glock-18, Desert Eagle, USP-S) */
function pistolFrame(root: THREE.Group, m: Mats, opts: { deagle?: boolean; usp?: boolean; glock?: boolean }) {
  const isDeagle = !!opts.deagle;
  const isUsp = !!opts.usp;
  const slideMat = isDeagle ? m.chrome : isUsp ? m.gun : m.dark;
  const frameMat = isDeagle ? m.silver : m.grip;
  const length = isDeagle ? 0.44 : isUsp ? 0.38 : 0.34;
  const slideW = isDeagle ? 0.088 : isUsp ? 0.076 : 0.074;
  const slideH = isDeagle ? 0.072 : isUsp ? 0.064 : 0.062;

  // 1. Reciprocating Slide Group
  const slide = new THREE.Group();
  slide.add(
    // Main Slide Body with chamfered top
    box(slideMat, slideW, slideH, length, 0, 0.04, isDeagle ? -0.09 : -0.05),
    // Rear Cocking Serrations
    box(m.gun, slideW + 0.004, slideH * 0.85, 0.07, 0, 0.04, isDeagle ? 0.1 : 0.08),
    // Front Cocking Serrations
    box(m.gun, slideW + 0.003, slideH * 0.7, 0.06, 0, 0.04, isDeagle ? -0.16 : -0.14),
    // Ejection Port cutout & extractor pin
    box(m.dark, slideW * 0.55, 0.025, 0.09, slideW * 0.26, 0.06, isDeagle ? -0.04 : -0.02),
    box(m.copper, 0.02, 0.02, 0.05, slideW * 0.18, 0.04, isDeagle ? -0.04 : -0.02), // Chambered round rim
    // Iron Sights: High-visibility 3-dot Tritium Sights
    box(m.dark, 0.014, 0.024, 0.018, 0, 0.082, isDeagle ? -0.29 : isUsp ? -0.22 : -0.20), // Front post
    box(opts.deagle ? m.red : m.tritium, 0.006, 0.01, 0.004, 0, 0.084, isDeagle ? -0.28 : isUsp ? -0.21 : -0.19),
    box(m.dark, 0.046, 0.024, 0.018, 0, 0.082, isDeagle ? 0.12 : 0.11), // Rear U-notch
    box(opts.deagle ? m.white : m.tritium, 0.005, 0.008, 0.004, -0.014, 0.084, isDeagle ? 0.12 : 0.11),
    box(opts.deagle ? m.white : m.tritium, 0.005, 0.008, 0.004, 0.014, 0.084, isDeagle ? 0.12 : 0.11),
  );

  if (isDeagle) {
    // Massive Polygonal Barrel, Top Picatinny Rail & Dual Muzzle Brake Slots
    slide.add(
      box(m.chrome, 0.076, 0.076, 0.18, 0, 0.04, -0.22),
      box(m.rail, 0.05, 0.016, 0.22, 0, 0.078, -0.08), // Top optics rail
      box(m.dark, 0.089, 0.028, 0.035, 0, 0.045, -0.28), // Muzzle brake side vents
      cylZ(m.gunSteel, 0.024, 0.06, 0, 0.04, -0.32, 12), // .50 Action Express bore
    );
  }

  // 2. Lower Receiver Frame & Controls
  const frame = new THREE.Group();
  frame.add(
    // Lower receiver with tactical under-barrel accessory rail
    box(frameMat, slideW - 0.004, 0.052, isDeagle ? 0.38 : 0.32, 0, -0.016, isDeagle ? -0.06 : -0.04),
    box(m.rail, slideW - 0.008, 0.014, 0.12, 0, -0.045, isDeagle ? -0.18 : -0.14), // Underbarrel rail
    // Ergonomic Stippled Grip with finger grooves & backstrap
    box(m.grip, slideW - 0.008, 0.2, 0.095, 0, -0.135, 0.05, 0.3),
    box(m.dark, slideW - 0.002, 0.18, 0.04, 0, -0.135, 0.085, 0.3), // Backstrap
    box(m.grip, slideW + 0.002, 0.03, 0.025, 0, -0.08, 0.005, 0.3), // Finger groove 1
    box(m.grip, slideW + 0.002, 0.03, 0.025, 0, -0.14, 0.025, 0.3), // Finger groove 2
    // Trigger guard with combat undercut
    box(frameMat, 0.026, 0.068, 0.11, 0, -0.072, -0.06),
    box(m.red, 0.014, 0.038, 0.024, 0, -0.062, -0.035, -0.15), // Trigger with safety blade
    // Steel guide rod & barrel sleeve
    cylZ(m.gunSteel, isDeagle ? 0.022 : 0.016, isDeagle ? 0.14 : 0.1, 0, 0.034, isDeagle ? -0.32 : isUsp ? -0.26 : -0.24, 12),
    // Slide release, takedown lever, combat hammer
    box(m.silver, 0.008, 0.016, 0.03, slideW * 0.5 + 0.004, 0.01, 0.02),
    box(m.dark, 0.022, 0.035, 0.03, 0, 0.038, 0.12, -0.4), // Hammer
  );

  if (isDeagle) {
    // Custom Grip Panels with Brass Medallion
    frame.add(
      box(m.dark, slideW + 0.006, 0.15, 0.08, 0, -0.14, 0.055, 0.3),
      box(m.brass, slideW + 0.008, 0.024, 0.024, 0, -0.14, 0.055, 0.3),
    );
  }

  if (isUsp) {
    // Quick-Detach Knurled Tactical Cylindrical Suppressor with Thread Collar
    const supp = new THREE.Group();
    supp.add(
      cylZ(m.dark, 0.028, 0.22, 0, 0.034, -0.38, 16),
      cylZ(m.gun, 0.03, 0.04, 0, 0.034, -0.29, 16), // Thread collar
      cylZ(m.grip, 0.029, 0.12, 0, 0.034, -0.38, 16), // Knurled grip band
      cylZ(m.gunSteel, 0.015, 0.02, 0, 0.034, -0.49, 12), // Suppressor end-cap orifice
    );
    root.add(supp);
  }

  // 3. Drop-free Magazine
  const mag = new THREE.Group();
  mag.add(
    box(m.dark, slideW - 0.018, 0.22, 0.08, 0, -0.145, 0.05, 0.3),
    box(m.brass, slideW - 0.024, 0.02, 0.05, 0, -0.03, 0.01, 0.3), // Top cartridge
    box(m.copper, slideW - 0.03, 0.016, 0.02, 0, -0.025, -0.015, 0.3),
    box(m.grip, slideW - 0.008, 0.03, 0.09, 0, -0.25, 0.085, 0.3), // Bumper baseplate
  );

  root.add(slide, frame, mag);
  const muzzleZ = isUsp ? -0.5 : isDeagle ? -0.36 : -0.28;
  return { slide, mag, muzzle: new THREE.Vector3(0, 0.035, muzzleZ) };
}

/** Master Viewmodel Assembler */
export function assembleViewWeapon(id: number, handL: THREE.Group | null, handR: THREE.Group | null): AssembledWeapon {
  const m = mats();
  const root = new THREE.Group();
  let magazine: THREE.Group | null = null;
  let bolt: THREE.Group | null = null;
  let muzzle = new THREE.Vector3(0, 0.04, -0.5);

  const style: 'pistol' | 'rifle' | 'knife' = id === 6 ? 'knife' : isPistolId(id) ? 'pistol' : 'rifle';

  switch (id) {
    case 0: { // Glock-18 (Select-fire Tactical Pistol)
      const built = pistolFrame(root, m, { glock: true });
      // Add fire mode selector switch on rear left of slide
      built.slide.add(box(m.red, 0.01, 0.02, 0.016, -0.04, 0.04, 0.08));
      bolt = built.slide; magazine = built.mag; muzzle.copy(built.muzzle);
      break;
    }

    case 1: { // Desert Eagle .50 AE (Brushed Chrome Heavy Hand Cannon)
      const built = pistolFrame(root, m, { deagle: true });
      bolt = built.slide; magazine = built.mag; muzzle.copy(built.muzzle);
      break;
    }

    case 7: { // USP-S (Tactical .45 Suppressed Pistol)
      const built = pistolFrame(root, m, { usp: true });
      bolt = built.slide; magazine = built.mag; muzzle.copy(built.muzzle);
      break;
    }

    case 2: { // MP5-SD (Integrally Suppressed 9mm Submachine Gun)
      root.add(
        // Stamped Upper Receiver with HK claw optic mount grooves
        box(m.dark, 0.088, 0.096, 0.44, 0, 0.04, -0.02),
        box(m.gun, 0.092, 0.02, 0.16, 0, 0.092, 0.02), // Claw mount base
        // Full-length Integrally Suppressed Ribbed Forend
        cylZ(m.blue, 0.048, 0.42, 0, 0.032, -0.44, 16),
        cylZ(m.grip, 0.052, 0.26, 0, 0.032, -0.40, 16), // Ribbed rubber sleeve
        cylZ(m.gunSteel, 0.046, 0.04, 0, 0.032, -0.66, 16), // Front cap
        // Navy Polymer Trigger Lower & Ergonomic Grip
        box(m.grip, 0.068, 0.185, 0.085, 0, -0.12, 0.06, 0.32),
        box(m.dark, 0.028, 0.065, 0.1, 0, -0.065, -0.04), // Trigger guard
        box(m.silver, 0.014, 0.032, 0.02, 0, -0.055, -0.02, -0.2), // Trigger
        // Retractable Metal Wire Stock with Twin Guide Rails
        box(m.silver, 0.016, 0.016, 0.32, 0.042, 0.03, 0.22),
        box(m.silver, 0.016, 0.016, 0.32, -0.042, 0.03, 0.22),
        box(m.grip, 0.095, 0.14, 0.035, 0, 0.02, 0.38), // Rubber buttpad
        // Sights: Rotary Diopter Drum Rear Sight & Hooded Ring Front Sight
        cylZ(m.dark, 0.02, 0.026, 0, 0.098, 0.12, 12), // Rear diopter drum
        cylZ(m.dark, 0.018, 0.02, 0, 0.092, -0.58, 12), // Hooded ring
        box(m.tritium, 0.005, 0.014, 0.005, 0, 0.092, -0.58), // Front tritium post
      );

      // Curved Stamped Steel 30-round 9mm Magazine
      const mag = new THREE.Group();
      mag.add(
        box(m.dark, 0.052, 0.22, 0.085, 0, -0.13, 0.02, 0.16),
        box(m.gun, 0.055, 0.18, 0.02, 0, -0.13, 0.055, 0.16), // Reinforcement spine
        box(m.brass, 0.04, 0.02, 0.06, 0, -0.02, 0.0, 0.16), // Top round
      );

      // Charging Handle on Forward Cocking Tube
      const slide = new THREE.Group();
      slide.add(
        cylZ(m.gunSteel, 0.018, 0.3, 0, 0.084, -0.22, 10),
        box(m.grip, 0.032, 0.03, 0.06, -0.048, 0.088, -0.28, 0, 0, 0.3), // Angled cocking lever
      );

      root.add(mag, slide);
      magazine = mag; bolt = slide; muzzle.set(0, 0.032, -0.68);
      break;
    }

    case 3: { // AK-47 (Legendary 7.62x39mm Assault Rifle)
      root.add(
        // Stamped Steel Receiver with Ribbed Dust Cover & Rivets
        box(m.dark, 0.088, 0.105, 0.48, 0, 0.04, -0.04),
        box(m.gun, 0.078, 0.03, 0.36, 0, 0.098, -0.02), // Dust cover ribs
        box(m.silver, 0.092, 0.012, 0.012, 0, 0.05, 0.08), // Receiver pins
        box(m.dark, 0.01, 0.024, 0.12, 0.046, 0.03, 0.02), // Selector lever (Safe/Auto/Semi)
        // Rich Polished Walnut Wood Furniture
        box(m.wood, 0.092, 0.09, 0.22, 0, 0.03, 0.32), // Solid wood stock
        box(m.woodDark, 0.088, 0.08, 0.14, 0, -0.02, 0.34),
        box(m.dark, 0.094, 0.11, 0.025, 0, 0.03, 0.43), // Steel buttplate
        box(m.wood, 0.072, 0.165, 0.095, 0, -0.105, 0.08, 0.35), // Wood pistol grip
        box(m.wood, 0.082, 0.076, 0.24, 0, -0.018, -0.24), // Lower wooden handguard
        box(m.woodDark, 0.076, 0.045, 0.2, 0, 0.058, -0.24), // Upper wooden gas tube cover
        // Barrel, Gas Block, Bayonet Lug & Slanted Compensator
        cylZ(m.gunSteel, 0.02, 0.52, 0, 0.055, -0.46, 12), // Heavy barrel
        cylZ(m.dark, 0.018, 0.24, 0, 0.082, -0.32, 10), // Gas piston tube
        box(m.dark, 0.05, 0.075, 0.06, 0, 0.07, -0.44), // Gas block
        cylZ(m.silver, 0.006, 0.36, 0, 0.028, -0.38, 8), // Cleaning rod
        cylZ(m.dark, 0.026, 0.08, 0, 0.055, -0.72, 10), // Slanted muzzle compensator
        // Sights: Hooded Front Post & Tangent Rear Leaf Sight
        box(m.dark, 0.05, 0.06, 0.09, 0, 0.095, -0.06), // Rear sight base
        box(m.silver, 0.024, 0.015, 0.07, 0, 0.12, -0.06, 0.15), // Rear sight leaf
        box(m.dark, 0.028, 0.07, 0.03, 0, 0.11, -0.62), // Front sight tower
        box(m.tritium, 0.005, 0.015, 0.005, 0, 0.13, -0.62), // Front tritium pin
        // Steel Trigger Guard & Magazine Latch
        box(m.dark, 0.028, 0.07, 0.12, 0, -0.065, -0.02),
        box(m.silver, 0.014, 0.035, 0.02, 0, -0.055, 0.0, -0.2),
        box(m.dark, 0.02, 0.03, 0.025, 0, -0.05, -0.07), // Mag release lever
      );

      // Curved Stamped Steel 30-round 7.62mm "Banana" Magazine with Ribs
      const mag = new THREE.Group();
      mag.add(
        box(m.dark, 0.055, 0.24, 0.11, 0, -0.13, -0.02, 0.22),
        box(m.gun, 0.058, 0.22, 0.02, 0, -0.13, 0.03, 0.22), // Stamped rib 1
        box(m.gun, 0.058, 0.22, 0.02, 0, -0.13, -0.07, 0.22), // Stamped rib 2
        box(m.brass, 0.045, 0.025, 0.08, 0, -0.02, -0.03, 0.22), // Top round
      );

      // Reciprocating Steel Bolt Carrier & Curved Right-side Charging Handle
      const boltG = new THREE.Group();
      boltG.add(
        box(m.gunSteel, 0.04, 0.035, 0.18, 0.035, 0.075, 0.02),
        cylX(m.silver, 0.012, 0.05, 0.065, 0.078, 0.02, 10), // Curved charging handle
      );

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.055, -0.78);
      break;
    }

    case 4: { // M4A4 (5.56mm Tactical Assault Carbine)
      root.add(
        // Flat-top Upper & Lower Receiver with Brass Deflector & Forward Assist
        box(m.dark, 0.086, 0.102, 0.46, 0, 0.04, -0.02),
        box(m.rail, 0.055, 0.016, 0.42, 0, 0.095, -0.02), // Top Picatinny optics rail
        box(m.gun, 0.025, 0.035, 0.04, 0.048, 0.05, 0.05), // Forward assist plunger
        box(m.dark, 0.02, 0.03, 0.05, 0.046, 0.04, -0.02), // Brass deflector
        // Quad-Rail Tactical Handguard with Ribbed Rail Covers
        box(m.camo, 0.082, 0.082, 0.28, 0, -0.01, -0.24),
        box(m.rail, 0.088, 0.02, 0.26, 0, -0.01, -0.24), // Side rails
        box(m.rail, 0.02, 0.088, 0.26, 0, -0.01, -0.24), // Bottom rail
        // Multi-Position SOPMOD Crane Telescopic Buttstock
        box(m.dark, 0.04, 0.04, 0.22, 0, 0.03, 0.22), // Buffer tube
        box(m.grip, 0.076, 0.13, 0.18, 0, 0.01, 0.32), // SOPMOD stock body
        box(m.dark, 0.08, 0.14, 0.03, 0, 0.01, 0.41), // Ribbed rubber buttpad
        // A2 Pistol Grip with Beavertail
        box(m.grip, 0.066, 0.175, 0.095, 0, -0.125, 0.08, 0.28),
        box(m.dark, 0.028, 0.065, 0.11, 0, -0.07, -0.02),
        box(m.silver, 0.014, 0.034, 0.02, 0, -0.06, 0.0, -0.2),
        // Barrel, Triangular A-frame Front Sight & Birdcage Flash Hider
        cylZ(m.gunSteel, 0.018, 0.46, 0, 0.048, -0.48, 12),
        box(m.dark, 0.024, 0.12, 0.06, 0, 0.10, -0.44), // A-frame front sight tower
        box(m.tritium, 0.005, 0.016, 0.005, 0, 0.155, -0.44), // Front sight post
        box(m.dark, 0.05, 0.05, 0.06, 0, 0.12, 0.14), // Detachable rear flip-up sight
        cylZ(m.dark, 0.026, 0.07, 0, 0.048, -0.72, 10), // Birdcage flash hider
      );

      // Curved STANAG 30-round 5.56mm Magazine
      const mag = new THREE.Group();
      mag.add(
        box(m.dark, 0.05, 0.22, 0.095, 0, -0.13, 0.0, 0.1),
        box(m.gunSteel, 0.054, 0.025, 0.098, 0, -0.23, 0.01, 0.1), // Baseplate
        box(m.brass, 0.042, 0.025, 0.07, 0, -0.02, 0.0, 0.1), // Top round
      );

      // Ambidextrous T-shaped Top Charging Handle & Ejection Dust Cover
      const boltG = new THREE.Group();
      boltG.add(
        box(m.silver, 0.034, 0.03, 0.14, 0.038, 0.05, 0.02), // Bolt carrier
        box(m.dark, 0.06, 0.02, 0.04, 0, 0.096, 0.16), // T-charging handle latch
      );

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.048, -0.76);
      break;
    }

    case 5: { // AWP (Accuracy International Arctic Warfare .338 Lapua Sniper Rifle)
      root.add(
        // Iconic Olive Drab Composite Chassis with Ergonomic Thumbhole Stock
        box(m.camo, 0.094, 0.11, 0.58, 0, 0.02, 0.06),
        box(m.camoDark, 0.088, 0.14, 0.28, 0, -0.02, 0.32), // Thumbhole stock section
        box(m.dark, 0.08, 0.06, 0.12, 0, 0.085, 0.32), // Adjustable cheek riser
        box(m.dark, 0.096, 0.15, 0.04, 0, -0.02, 0.46), // Rubber buttpad with spacers
        box(m.grip, 0.068, 0.165, 0.12, 0, -0.105, 0.14, 0.22), // Pistol grip section
        box(m.dark, 0.03, 0.07, 0.12, 0, -0.065, 0.04), // Trigger guard
        box(m.silver, 0.014, 0.036, 0.02, 0, -0.055, 0.06, -0.2),
        // Heavy Free-Floating Fluted Steel Barrel
        cylZ(m.gunSteel, 0.022, 0.72, 0, 0.042, -0.56, 14),
        cylZ(m.dark, 0.024, 0.42, 0, 0.042, -0.48, 14), // Fluted sleeve
        // Massive Rectangular Double-Baffle Muzzle Brake
        box(m.dark, 0.075, 0.065, 0.13, 0, 0.042, -0.96),
        box(m.silver, 0.078, 0.03, 0.04, 0, 0.042, -0.94), // Side port baffles
        // High-Precision Long-Range Tactical Sniper Scope
        cylZ(m.scopeBody, 0.034, 0.38, 0, 0.13, -0.12, 16), // Scope main tube
        cylZ(m.scopeBody, 0.046, 0.12, 0, 0.13, -0.32, 16), // Objective bell
        cylZ(m.glass, 0.042, 0.02, 0, 0.13, -0.37, 16), // Optical coated front lens
        cylZ(m.scopeBody, 0.038, 0.08, 0, 0.13, 0.06, 16), // Ocular eyepiece
        cylZ(m.glass, 0.034, 0.02, 0, 0.13, 0.1, 16), // Ocular lens
        // Scope Knurled Windage & Elevation Turrets
        box(m.scopeBody, 0.08, 0.028, 0.028, 0, 0.162, -0.12), // Elevation turret
        box(m.scopeBody, 0.028, 0.028, 0.08, 0.044, 0.13, -0.12), // Windage turret
        box(m.dark, 0.072, 0.05, 0.03, 0, 0.085, -0.22), // Scope mounting ring 1
        box(m.dark, 0.072, 0.05, 0.03, 0, 0.085, -0.02), // Scope mounting ring 2
      );

      // Heavy Detachable Steel Box Magazine (.338 Lapua Magnum)
      const mag = new THREE.Group();
      mag.add(
        box(m.dark, 0.065, 0.22, 0.14, 0, -0.1, -0.04),
        box(m.brass, 0.055, 0.03, 0.11, 0, 0.0, -0.04), // Massive .338 Lapua cartridge
        box(m.copper, 0.035, 0.02, 0.04, 0, 0.0, -0.08),
      );

      // Heavy Steel Cylindrical Bolt Action with Spherical Tactical Knob
      const boltG = new THREE.Group();
      boltG.add(
        cylZ(m.silver, 0.026, 0.24, 0, 0.042, 0.04, 12),
        cylX(m.gunSteel, 0.012, 0.08, 0.052, 0.06, 0.06, 10), // Bolt handle arm
        new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), m.dark), // Spherical bolt knob
      );
      boltG.children[2].position.set(0.092, 0.06, 0.06);

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.042, -1.04);
      break;
    }

    case 11: { // SSG 08 (Scout Lightweight Precision Sniper Rifle)
      root.add(
        // Modern Skeletal Tactical Chassis in Navy/Grey Polymer
        box(m.blue, 0.084, 0.095, 0.52, 0, 0.03, 0.04),
        box(m.dark, 0.04, 0.06, 0.26, 0, 0.0, 0.32), // Skeletal stock strut
        box(m.grip, 0.076, 0.14, 0.035, 0, 0.0, 0.44), // Minimalist buttpad
        box(m.dark, 0.06, 0.04, 0.12, 0, 0.065, 0.28), // Cheek rest
        box(m.grip, 0.058, 0.155, 0.105, 0, -0.1, 0.16, 0.22),
        // Ventilated Lightened Forend & Stepped Barrel
        box(m.dark, 0.074, 0.06, 0.24, 0, 0.01, -0.22),
        cylZ(m.gunSteel, 0.016, 0.68, 0, 0.04, -0.52, 12),
        cylZ(m.dark, 0.024, 0.08, 0, 0.04, -0.88, 12), // Muzzle compensator
        // Compact Variable Tactical Scope with Cantilever Mount
        cylZ(m.scopeBody, 0.028, 0.3, 0, 0.115, -0.08, 14),
        cylZ(m.scopeBody, 0.038, 0.1, 0, 0.115, -0.24, 14),
        cylZ(m.glass, 0.034, 0.02, 0, 0.115, -0.29, 14),
        cylZ(m.scopeBody, 0.032, 0.06, 0, 0.115, 0.06, 14),
        cylZ(m.glass, 0.028, 0.02, 0, 0.115, 0.09, 14),
        box(m.dark, 0.06, 0.04, 0.16, 0, 0.075, -0.08), // Cantilever base
      );

      // Flush-fit 10-round Box Magazine
      const mag = new THREE.Group();
      mag.add(
        box(m.dark, 0.048, 0.17, 0.09, 0, -0.085, 0.02),
        box(m.brass, 0.038, 0.02, 0.07, 0, 0.0, 0.02),
      );

      // Smooth Straight-pull Bolt Action with Tactical Knob
      const boltG = new THREE.Group();
      boltG.add(
        cylZ(m.silver, 0.022, 0.2, 0, 0.04, 0.08, 10),
        cylX(m.gunSteel, 0.01, 0.065, 0.045, 0.06, 0.1, 10),
        new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), m.dark),
      );
      boltG.children[2].position.set(0.08, 0.06, 0.1);

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.04, -0.94);
      break;
    }

    case 8: { // UMP-45 (.45 ACP Tactical Submachine Gun)
      root.add(
        // Coyote Tan / FDE Polymer Upper/Lower Receiver with Full Top Picatinny Rail
        box(m.tan, 0.095, 0.115, 0.44, 0, 0.04, 0.0),
        box(m.tanDark, 0.098, 0.06, 0.22, 0, 0.02, 0.1),
        box(m.rail, 0.058, 0.016, 0.42, 0, 0.105, 0.0), // Top optics rail
        box(m.rail, 0.016, 0.04, 0.16, 0.05, 0.03, -0.12), // Right side rail
        box(m.rail, 0.016, 0.04, 0.16, -0.05, 0.03, -0.12), // Left side rail
        // Vertical Tactical Foregrip on Bottom Rail
        cylZ(m.grip, 0.022, 0.13, 0, -0.09, -0.16, 12),
        // Side-Folding Skeletal Stock with Hinge Pin
        box(m.dark, 0.045, 0.08, 0.24, 0, 0.03, 0.32),
        box(m.grip, 0.075, 0.13, 0.03, 0, 0.02, 0.44),
        box(m.silver, 0.06, 0.03, 0.03, 0, 0.03, 0.21), // Hinge
        // Pistol Grip, Controls & Iron Sights
        box(m.grip, 0.068, 0.18, 0.105, 0, -0.12, 0.1, 0.25),
        box(m.dark, 0.028, 0.065, 0.11, 0, -0.065, 0.02),
        cylZ(m.gunSteel, 0.022, 0.36, 0, 0.04, -0.38, 12), // .45 ACP heavy barrel
        box(m.dark, 0.075, 0.055, 0.08, 0, 0.04, -0.56), // Muzzle flash hider
        box(m.dark, 0.026, 0.05, 0.03, 0, 0.13, -0.36), // Front sight post
        box(m.tritium, 0.005, 0.014, 0.005, 0, 0.155, -0.36),
        box(m.dark, 0.045, 0.04, 0.04, 0, 0.125, 0.16), // Rear combat aperture
      );

      // Straight Vertical Polymer Magazine with Cartridge Inspection Window
      const mag = new THREE.Group();
      mag.add(
        box(m.dark, 0.068, 0.26, 0.11, 0, -0.145, 0.02, 0.12),
        box(m.glass, 0.07, 0.12, 0.025, 0, -0.14, -0.035, 0.12), // Transparent round counter window
        box(m.brass, 0.055, 0.1, 0.02, 0, -0.14, -0.035, 0.12), // Visible brass cartridges
      );

      // Right-side Charging Handle
      const boltG = new THREE.Group();
      boltG.add(
        box(m.gunSteel, 0.034, 0.03, 0.12, 0.042, 0.085, 0.06),
        cylX(m.dark, 0.01, 0.045, 0.065, 0.088, 0.06, 10),
      );

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.04, -0.62);
      break;
    }

    case 9: { // FAMAS F1/G2 (5.56mm French Bullpup Assault Rifle)
      root.add(
        // Distinctive Bullpup Body with Massive Top Carrying Handle
        box(m.camo, 0.092, 0.125, 0.54, 0, 0.02, -0.04),
        box(m.camoDark, 0.088, 0.09, 0.22, 0, 0.0, 0.32), // Rear stock housing
        box(m.grip, 0.092, 0.13, 0.035, 0, 0.0, 0.43), // Rubber buttpad
        // Massive Top Carrying Handle with Integrated Tunnel Sights & Picatinny Rail
        box(m.dark, 0.046, 0.09, 0.38, 0, 0.12, -0.06),
        box(m.dark, 0.046, 0.06, 0.12, 0, 0.07, -0.22, -0.3), // Front handle pillar
        box(m.dark, 0.046, 0.06, 0.12, 0, 0.07, 0.12, 0.3), // Rear handle pillar
        box(m.tritium, 0.005, 0.014, 0.005, 0, 0.17, -0.22), // Front sight pin
        // Forward Handguard, Serrated Grips & Folded Bipod Legs
        box(m.grip, 0.066, 0.165, 0.095, 0, -0.12, 0.14, 0.2), // Pistol grip
        box(m.dark, 0.028, 0.065, 0.1, 0, -0.065, 0.04),
        box(m.silver, 0.012, 0.012, 0.34, 0.048, 0.0, -0.2), // Right bipod leg (stowed)
        box(m.silver, 0.012, 0.012, 0.34, -0.048, 0.0, -0.2), // Left bipod leg (stowed)
        cylZ(m.gunSteel, 0.018, 0.34, 0, 0.04, -0.46, 12),
        cylZ(m.dark, 0.026, 0.08, 0, 0.04, -0.64, 10), // Birdcage flash hider
      );

      // Bullpup Magazine Housing Behind Grip
      const mag = new THREE.Group();
      mag.add(
        box(m.dark, 0.054, 0.2, 0.095, 0, -0.11, 0.12),
        box(m.brass, 0.044, 0.025, 0.07, 0, -0.01, 0.12),
      );

      // Ambidextrous Central Charging Handle under Carrying Handle
      const boltG = new THREE.Group();
      boltG.add(
        box(m.silver, 0.03, 0.03, 0.14, 0, 0.08, -0.06),
        box(m.grip, 0.05, 0.025, 0.035, 0, 0.085, -0.06),
      );

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.04, -0.7);
      break;
    }

    case 10: { // AUG (Steyr AUG A1/A3 5.56mm Bullpup with Integrated Optical Scope)
      root.add(
        // Sleek Aerodynamic Bullpup Polymer Chassis in Olive Green
        box(m.camo, 0.094, 0.115, 0.62, 0, 0.03, -0.06),
        box(m.camoDark, 0.09, 0.11, 0.24, 0, 0.02, 0.3),
        box(m.grip, 0.094, 0.13, 0.035, 0, 0.02, 0.42),
        box(m.grip, 0.064, 0.16, 0.1, 0, -0.1, -0.02, 0.15), // Pistol grip
        box(m.dark, 0.03, 0.08, 0.15, 0, -0.06, -0.04), // Large winter trigger guard
        // Angled Forward Folding Tactical Vertical Grip under Gas Block
        cylZ(m.grip, 0.024, 0.14, 0, -0.08, -0.32, 12),
        cylZ(m.gunSteel, 0.02, 0.44, 0, 0.05, -0.56, 12),
        cylZ(m.dark, 0.028, 0.09, 0, 0.05, -0.78, 10), // Flash suppressor
        // Integrated 1.5x Optical Scope Tube & Backup Emergency Iron Sights
        cylZ(m.scopeBody, 0.032, 0.32, 0, 0.135, -0.14, 16),
        cylZ(m.scopeBody, 0.042, 0.08, 0, 0.135, -0.28, 16),
        cylZ(m.glass, 0.038, 0.02, 0, 0.135, -0.32, 16), // Front objective
        cylZ(m.scopeBody, 0.036, 0.06, 0, 0.135, 0.04, 16),
        cylZ(m.glass, 0.032, 0.02, 0, 0.135, 0.07, 16), // Rear eyepiece
        box(m.dark, 0.015, 0.02, 0.015, 0, 0.18, -0.28), // Backup front sight post
        box(m.tritium, 0.004, 0.01, 0.004, 0, 0.19, -0.28),
      );

      // Translucent Polymer "Waffle" Magazine with Visible Brass Cartridges
      const mag = new THREE.Group();
      mag.add(
        box(m.tan, 0.054, 0.22, 0.11, 0, -0.125, -0.08, 0.1),
        box(m.dark, 0.058, 0.2, 0.02, 0, -0.125, -0.04, 0.1), // Waffle grid ribs
        box(m.brass, 0.045, 0.16, 0.07, 0, -0.11, -0.08, 0.1), // Visible brass stack
      );

      // Forward Angled Charging Handle on Cocking Rod
      const boltG = new THREE.Group();
      boltG.add(
        cylZ(m.gunSteel, 0.014, 0.26, -0.038, 0.09, -0.24, 10),
        box(m.dark, 0.035, 0.03, 0.06, -0.065, 0.11, -0.3, 0, 0, 0.4), // Angled knob
      );

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.05, -0.84);
      break;
    }

    case 12: { // XM1014 (12-Gauge Tactical Combat Semi-Auto Shotgun)
      root.add(
        // Milled Steel Receiver with Large Side Ejection Port
        box(m.tan, 0.096, 0.11, 0.48, 0, 0.03, -0.02),
        box(m.rail, 0.056, 0.016, 0.36, 0, 0.095, -0.02), // Top rail
        box(m.dark, 0.02, 0.045, 0.12, 0.049, 0.03, -0.02), // Ejection port
        box(m.red, 0.028, 0.028, 0.07, 0.038, 0.03, -0.02), // 12-Gauge red shotshell in chamber
        box(m.brass, 0.03, 0.03, 0.02, 0.038, 0.03, 0.02), // Brass hull rim
        // Full-length Tubular Magazine, Barrel Clamp & Heavy 12-Ga Barrel
        cylZ(m.gunSteel, 0.024, 0.52, 0, 0.05, -0.46, 14), // 12-Gauge barrel
        cylZ(m.dark, 0.022, 0.48, 0, 0.01, -0.44, 14), // Underbarrel mag tube
        box(m.dark, 0.06, 0.07, 0.03, 0, 0.03, -0.66), // Barrel clamp
        cylZ(m.gunSteel, 0.026, 0.06, 0, 0.05, -0.72, 14), // Muzzle choke
        // Ribbed Tactical Forend Handguard
        cylZ(m.grip, 0.048, 0.28, 0, 0.015, -0.26, 16),
        // Pistol Grip & Collapsible Twin-Strut Skeletal Stock
        box(m.grip, 0.066, 0.17, 0.105, 0, -0.115, 0.12, 0.28),
        box(m.silver, 0.014, 0.014, 0.32, 0.038, 0.03, 0.24),
        box(m.silver, 0.014, 0.014, 0.32, -0.038, 0.03, 0.24),
        box(m.grip, 0.088, 0.14, 0.035, 0, 0.02, 0.4),
        // Ghost Ring Rear Sight & Blade Front Sight
        cylZ(m.dark, 0.018, 0.02, 0, 0.115, 0.08, 12),
        box(m.dark, 0.02, 0.05, 0.02, 0, 0.105, -0.66),
        box(m.tritiumRed, 0.005, 0.016, 0.005, 0, 0.13, -0.66),
      );

      // Loading Gate / Shell Carrier beneath receiver
      const mag = new THREE.Group();
      mag.add(
        box(m.silver, 0.045, 0.02, 0.14, 0, -0.04, 0.0), // Steel elevator
        box(m.red, 0.028, 0.028, 0.09, 0, -0.06, -0.06), // Red 12-gauge shell
        box(m.brass, 0.03, 0.03, 0.025, 0, -0.06, -0.01),
      );

      // Right-side Cocking Handle on Bolt Carrier
      const boltG = new THREE.Group();
      boltG.add(
        box(m.silver, 0.035, 0.035, 0.12, 0.038, 0.04, 0.02),
        cylX(m.silver, 0.012, 0.05, 0.065, 0.04, 0.02, 10),
      );

      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.05, -0.76);
      break;
    }

    default: { // Tactical Combat Knife (High-Carbon Multi-Bevel Blade & G10 Scales)
      root.add(
        // Blade: Dual-tone High-Carbon Steel with Satin Grind & Black Oxide Spine
        box(m.chrome, 0.016, 0.075, 0.34, 0, 0.02, -0.18), // Primary grind bevel
        box(m.silver, 0.012, 0.032, 0.32, 0, -0.018, -0.18), // Razor cutting edge
        box(m.dark, 0.02, 0.022, 0.32, 0, 0.056, -0.18), // Spine with thumb jimping
        box(m.silver, 0.022, 0.01, 0.12, 0, 0.058, -0.12), // Jimping serrations
        // Ergonomic Textured G10 Composite Handle Scales
        box(m.gun, 0.058, 0.034, 0.026, 0, 0.01, 0.01), // Crossguard / finger choil
        box(m.grip, 0.052, 0.068, 0.18, 0, 0.01, 0.11), // Ergonomic handle scales
        box(m.dark, 0.056, 0.025, 0.02, 0, -0.015, 0.06), // Finger groove 1
        box(m.dark, 0.056, 0.025, 0.02, 0, -0.015, 0.13), // Finger groove 2
        // Full-Tang Steel Skull Crusher Pommel & Lanyard Ring
        box(m.silver, 0.048, 0.068, 0.03, 0, 0.01, 0.21),
        cylZ(m.silver, 0.016, 0.012, 0, 0.01, 0.23, 10), // Pommel ring hole
      );
      muzzle.set(0, 0.02, -0.36);
      break;
    }
  }

  if (handL && handR) addHands(handL, handR, m, style);
  return { root, magazine, bolt, muzzle };
}

function isPistolId(id: number) {
  return id === 0 || id === 1 || id === 7;
}

export function markViewLayer(root: THREE.Object3D) {
  root.traverse((obj) => {
    obj.layers.set(VIEW_LAYER);
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshBasicMaterial && material.blending === THREE.AdditiveBlending) continue;
      material.depthTest = true;
      material.depthWrite = !material.transparent;
    }
  });
}

export const VIEWMODEL_LAYER = VIEW_LAYER;
