import * as THREE from 'three';

const VIEW_LAYER = 1;

export interface AssembledWeapon {
  root: THREE.Group;
  magazine: THREE.Group | null;
  bolt: THREE.Group | null;
  muzzle: THREE.Vector3;
}

interface Mats {
  dark: THREE.MeshLambertMaterial;
  gun: THREE.MeshLambertMaterial;
  silver: THREE.MeshLambertMaterial;
  chrome: THREE.MeshLambertMaterial;
  wood: THREE.MeshLambertMaterial;
  camo: THREE.MeshLambertMaterial;
  grip: THREE.MeshLambertMaterial;
  blue: THREE.MeshLambertMaterial;
  brass: THREE.MeshLambertMaterial;
  tritium: THREE.MeshBasicMaterial;
  red: THREE.MeshLambertMaterial;
  white: THREE.MeshBasicMaterial;
  glass: THREE.MeshLambertMaterial;
  skin: THREE.MeshLambertMaterial;
  sleeve: THREE.MeshLambertMaterial;
  tan: THREE.MeshLambertMaterial;
}

function mats(): Mats {
  return {
    dark: new THREE.MeshLambertMaterial({ color: 0x1a1b1e }),
    gun: new THREE.MeshLambertMaterial({ color: 0x3a3e46 }),
    silver: new THREE.MeshLambertMaterial({ color: 0x9aa1ab }),
    chrome: new THREE.MeshLambertMaterial({ color: 0xd5dae0 }),
    wood: new THREE.MeshLambertMaterial({ color: 0x7a3c18 }),
    camo: new THREE.MeshLambertMaterial({ color: 0x3a4d38 }),
    grip: new THREE.MeshLambertMaterial({ color: 0x121314 }),
    blue: new THREE.MeshLambertMaterial({ color: 0x243546 }),
    brass: new THREE.MeshLambertMaterial({ color: 0xd4af37 }),
    tritium: new THREE.MeshBasicMaterial({ color: 0x39ff14 }),
    red: new THREE.MeshLambertMaterial({ color: 0xb42318 }),
    white: new THREE.MeshBasicMaterial({ color: 0xf4f1e8 }),
    glass: new THREE.MeshLambertMaterial({ color: 0x1a3344, transparent: true, opacity: 0.72 }),
    skin: new THREE.MeshLambertMaterial({ color: 0xd9a177 }),
    sleeve: new THREE.MeshLambertMaterial({ color: 0x1c8f92 }),
    tan: new THREE.MeshLambertMaterial({ color: 0x8a7a5c }),
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

function addHands(handL: THREE.Group, handR: THREE.Group, m: Mats, style: 'pistol' | 'rifle' | 'knife') {
  const palmR = box(m.skin, 0.09, 0.075, 0.11);
  const fingersR = box(m.skin, 0.078, 0.032, 0.07, 0, -0.012, -0.075);
  const thumbR = box(m.skin, 0.028, 0.028, 0.055, 0.05, 0.01, -0.02, 0, 0, 0.4);
  const armR = box(m.sleeve, 0.12, 0.12, 0.4, 0.16, -0.22, 0.2, 0.55, -0.22, 0.12);
  if (style === 'pistol') {
    palmR.position.set(0.02, -0.13, 0.05);
    fingersR.position.set(0.02, -0.142, -0.025);
    thumbR.position.set(0.06, -0.11, 0.02);
    armR.position.set(0.18, -0.34, 0.22);
  } else if (style === 'knife') {
    palmR.position.set(0.02, -0.02, 0.08);
    fingersR.position.set(0.02, -0.03, 0.01);
    thumbR.position.set(0.06, 0.0, 0.06);
    armR.position.set(0.18, -0.3, 0.24);
  } else {
    palmR.position.set(0.02, -0.1, 0.05);
    fingersR.position.set(0.02, -0.112, -0.025);
    thumbR.position.set(0.06, -0.08, 0.02);
    armR.position.set(0.22, -0.3, 0.22);
  }
  handR.add(palmR, fingersR, thumbR, armR);

  if (style === 'knife') return;
  const palmL = box(m.skin, 0.085, 0.07, 0.1);
  const fingersL = box(m.skin, 0.074, 0.03, 0.065, 0, -0.01, -0.07);
  const thumbL = box(m.skin, 0.026, 0.026, 0.05, -0.048, 0.008, -0.018, 0, 0, -0.4);
  const armL = box(m.sleeve, 0.12, 0.12, 0.4, -0.18, -0.22, 0.16, 0.52, 0.28, -0.12);
  if (style === 'pistol') {
    palmL.position.set(-0.04, -0.14, 0.02);
    fingersL.position.set(-0.04, -0.15, -0.05);
    thumbL.position.set(-0.08, -0.12, 0.0);
    armL.position.set(-0.2, -0.34, 0.18);
  } else {
    palmL.position.set(-0.03, -0.02, -0.22);
    fingersL.position.set(-0.03, -0.03, -0.29);
    thumbL.position.set(-0.07, 0.0, -0.2);
    armL.position.set(-0.22, -0.26, -0.04);
  }
  handL.add(palmL, fingersL, thumbL, armL);
}

function pistolFrame(root: THREE.Group, m: Mats, opts: { chrome?: boolean; long?: boolean; suppressor?: boolean }) {
  const bodyMat = opts.chrome ? m.chrome : m.dark;
  const slide = new THREE.Group();
  slide.add(
    box(bodyMat, opts.long ? 0.082 : 0.074, 0.062, opts.long ? 0.4 : 0.34, 0, 0.04, opts.long ? -0.08 : -0.05),
    box(m.gun, opts.long ? 0.084 : 0.076, 0.04, 0.055, 0, 0.04, opts.long ? 0.1 : 0.08),
    box(m.dark, 0.012, 0.02, 0.02, 0, 0.08, opts.long ? -0.26 : -0.2),
    box(m.dark, 0.04, 0.02, 0.018, 0, 0.08, opts.long ? 0.11 : 0.1),
    box(m.tritium, 0.006, 0.008, 0.004, 0, 0.082, opts.long ? -0.25 : -0.19),
  );
  root.add(
    box(m.grip, 0.07, 0.05, opts.long ? 0.36 : 0.3, 0, -0.016, -0.04),
    box(m.grip, 0.066, 0.185, 0.09, 0, -0.13, 0.05, 0.3),
    box(m.grip, 0.028, 0.065, 0.1, 0, -0.07, -0.06),
    box(m.red, 0.016, 0.034, 0.022, 0, -0.06, -0.035),
    cylZ(m.silver, 0.016, opts.long ? 0.14 : 0.1, 0, 0.032, opts.long ? -0.32 : -0.26, 10),
  );
  if (opts.suppressor) {
    root.add(cylZ(m.blue, 0.02, 0.16, 0, 0.032, -0.38, 12));
  }
  const mag = new THREE.Group();
  mag.add(
    box(m.dark, 0.055, 0.21, 0.075, 0, -0.14, 0.05, 0.3),
    box(m.grip, 0.062, 0.025, 0.085, 0, -0.24, 0.08, 0.3),
  );
  root.add(slide, mag);
  return { slide, mag, muzzle: new THREE.Vector3(0, 0.035, opts.suppressor ? -0.46 : opts.long ? -0.42 : -0.34) };
}

export function assembleViewWeapon(id: number, handL: THREE.Group, handR: THREE.Group): AssembledWeapon {
  const m = mats();
  const root = new THREE.Group();
  let magazine: THREE.Group | null = null;
  let bolt: THREE.Group | null = null;
  let muzzle = new THREE.Vector3(0, 0.04, -0.5);

  const style: 'pistol' | 'rifle' | 'knife' = id === 6 ? 'knife' : isPistolId(id) ? 'pistol' : 'rifle';

  switch (id) {
    case 0: {
      const built = pistolFrame(root, m, {});
      bolt = built.slide; magazine = built.mag; muzzle.copy(built.muzzle);
      break;
    }
    case 1: {
      const built = pistolFrame(root, m, { chrome: true, long: true });
      built.slide.add(box(m.brass, 0.08, 0.04, 0.04, 0, -0.14, 0.06, 0.3));
      bolt = built.slide; magazine = built.mag; muzzle.copy(built.muzzle);
      break;
    }
    case 7: {
      const built = pistolFrame(root, m, { suppressor: true });
      bolt = built.slide; magazine = built.mag; muzzle.copy(built.muzzle);
      break;
    }
    case 2: {
      root.add(
        box(m.dark, 0.09, 0.1, 0.42, 0, 0.04, -0.02),
        cylZ(m.blue, 0.046, 0.4, 0, 0.03, -0.42, 14),
        cylZ(m.grip, 0.05, 0.22, 0, 0.03, -0.38, 12),
        cylZ(m.silver, 0.044, 0.03, 0, 0.03, -0.62, 12),
        cylZ(m.gun, 0.02, 0.32, 0, 0.085, -0.22, 10),
        box(m.grip, 0.066, 0.18, 0.08, 0, -0.12, 0.06, 0.32),
        box(m.dark, 0.055, 0.12, 0.04, 0, 0.02, 0.36),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.05, 0.2, 0.09, 0, -0.12, 0.02, 0.15));
      const slide = new THREE.Group();
      slide.add(box(m.gun, 0.04, 0.04, 0.08, 0, 0.09, 0.12));
      root.add(mag, slide);
      magazine = mag; bolt = slide; muzzle.set(0, 0.03, -0.64);
      break;
    }
    case 3: {
      root.add(
        box(m.dark, 0.086, 0.1, 0.46, 0, 0.04, -0.04),
        box(m.wood, 0.09, 0.085, 0.18, 0, 0.03, 0.28),
        box(m.wood, 0.07, 0.16, 0.1, 0, -0.1, 0.08, 0.35),
        cylZ(m.gun, 0.018, 0.46, 0, 0.055, -0.42, 10),
        cylZ(m.dark, 0.028, 0.12, 0, 0.055, -0.68, 10),
        box(m.wood, 0.078, 0.07, 0.22, 0, -0.02, -0.22),
        box(m.dark, 0.05, 0.08, 0.08, 0, 0.1, 0.05),
        box(m.dark, 0.02, 0.06, 0.02, 0, 0.14, -0.55),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.05, 0.22, 0.1, 0, -0.12, -0.02, 0.18));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.03, 0.03, 0.16, 0.04, 0.08, 0.02));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.055, -0.76);
      break;
    }
    case 4: {
      root.add(
        box(m.dark, 0.084, 0.095, 0.44, 0, 0.04, -0.02),
        box(m.camo, 0.078, 0.07, 0.26, 0, -0.015, -0.24),
        box(m.grip, 0.064, 0.17, 0.09, 0, -0.12, 0.08, 0.28),
        cylZ(m.gun, 0.016, 0.42, 0, 0.05, -0.46, 10),
        box(m.gun, 0.07, 0.04, 0.08, 0, 0.05, -0.7),
        box(m.dark, 0.05, 0.1, 0.16, 0, 0.02, 0.32),
        box(m.dark, 0.04, 0.05, 0.12, 0, 0.1, -0.08),
        box(m.dark, 0.018, 0.05, 0.018, 0, 0.14, -0.48),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.048, 0.2, 0.09, 0, -0.12, 0.0));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.03, 0.028, 0.14, 0.038, 0.075, 0.04));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.05, -0.74);
      break;
    }
    case 5: {
      root.add(
        box(m.camo, 0.09, 0.1, 0.52, 0, 0.03, 0.02),
        box(m.grip, 0.06, 0.16, 0.12, 0, -0.1, 0.14, 0.2),
        cylZ(m.dark, 0.016, 0.62, 0, 0.04, -0.52, 10),
        box(m.gun, 0.07, 0.06, 0.12, 0, 0.04, -1.0),
        cylZ(m.dark, 0.028, 0.28, 0, 0.12, -0.12, 12),
        cylZ(m.glass, 0.022, 0.2, 0, 0.12, -0.12, 12),
        box(m.dark, 0.05, 0.05, 0.05, 0, 0.16, -0.12),
        box(m.dark, 0.04, 0.09, 0.18, 0, 0.0, 0.38),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.06, 0.2, 0.12, 0, -0.08, -0.04));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.035, 0.035, 0.18, 0.05, 0.08, 0.08));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.04, -1.08);
      break;
    }
    case 8: {
      root.add(
        box(m.tan, 0.1, 0.11, 0.4, 0, 0.04, 0.0),
        box(m.grip, 0.07, 0.18, 0.1, 0, -0.12, 0.1, 0.25),
        cylZ(m.dark, 0.02, 0.32, 0, 0.04, -0.36, 10),
        box(m.gun, 0.08, 0.05, 0.08, 0, 0.04, -0.54),
        box(m.dark, 0.06, 0.12, 0.14, 0, 0.02, 0.3),
        box(m.dark, 0.045, 0.06, 0.1, 0, 0.12, -0.04),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.07, 0.24, 0.12, 0, -0.14, 0.02, 0.12));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.03, 0.03, 0.1, 0.04, 0.09, 0.08));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.04, -0.58);
      break;
    }
    case 9: {
      root.add(
        box(m.camo, 0.088, 0.12, 0.5, 0, 0.02, -0.04),
        box(m.grip, 0.062, 0.16, 0.09, 0, -0.12, 0.16, 0.2),
        cylZ(m.gun, 0.016, 0.28, 0, 0.04, -0.42, 10),
        box(m.dark, 0.07, 0.045, 0.1, 0, 0.03, -0.6),
        box(m.dark, 0.04, 0.08, 0.2, 0, 0.1, -0.06),
        box(m.dark, 0.05, 0.09, 0.16, 0, 0.0, 0.32),
        box(m.gun, 0.03, 0.06, 0.08, 0.0, -0.06, -0.28),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.05, 0.18, 0.09, 0, -0.1, 0.08));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.028, 0.03, 0.12, 0.04, 0.08, 0.02));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.04, -0.66);
      break;
    }
    case 10: {
      root.add(
        box(m.camo, 0.09, 0.11, 0.58, 0, 0.03, -0.08),
        box(m.grip, 0.06, 0.15, 0.1, 0, -0.1, -0.02, 0.15),
        cylZ(m.dark, 0.018, 0.36, 0, 0.05, -0.52, 10),
        cylZ(m.dark, 0.026, 0.18, 0, 0.12, -0.16, 12),
        cylZ(m.glass, 0.02, 0.12, 0, 0.12, -0.16, 12),
        box(m.dark, 0.055, 0.1, 0.2, 0, 0.02, 0.32),
        box(m.gun, 0.07, 0.05, 0.1, 0, 0.04, -0.72),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.05, 0.2, 0.1, 0, -0.12, -0.08));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.03, 0.03, 0.14, 0.04, 0.08, 0.04));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.05, -0.78);
      break;
    }
    case 11: {
      root.add(
        box(m.blue, 0.08, 0.09, 0.48, 0, 0.03, 0.04),
        box(m.grip, 0.055, 0.15, 0.1, 0, -0.1, 0.16, 0.22),
        cylZ(m.dark, 0.014, 0.7, 0, 0.04, -0.48, 10),
        cylZ(m.dark, 0.024, 0.22, 0, 0.11, -0.08, 12),
        cylZ(m.glass, 0.018, 0.16, 0, 0.11, -0.08, 12),
        box(m.dark, 0.04, 0.08, 0.16, 0, 0.0, 0.36),
        box(m.gun, 0.05, 0.04, 0.08, 0, 0.04, -0.9),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.045, 0.16, 0.08, 0, -0.08, 0.02));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.03, 0.03, 0.16, 0.045, 0.07, 0.1));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.04, -0.96);
      break;
    }
    case 12: {
      root.add(
        box(m.tan, 0.092, 0.1, 0.46, 0, 0.03, -0.02),
        box(m.grip, 0.064, 0.16, 0.1, 0, -0.11, 0.12, 0.28),
        cylZ(m.dark, 0.028, 0.36, 0, 0.03, -0.4, 12),
        box(m.gun, 0.08, 0.06, 0.1, 0, 0.03, -0.62),
        box(m.dark, 0.05, 0.08, 0.18, 0, 0.02, 0.32),
        box(m.dark, 0.04, 0.05, 0.2, 0, 0.1, -0.08),
      );
      const mag = new THREE.Group();
      mag.add(box(m.dark, 0.055, 0.08, 0.22, 0, -0.06, -0.08));
      const boltG = new THREE.Group();
      boltG.add(box(m.gun, 0.04, 0.04, 0.1, 0.0, 0.09, 0.06));
      root.add(mag, boltG);
      magazine = mag; bolt = boltG; muzzle.set(0, 0.03, -0.68);
      break;
    }
    default: {
      root.add(
        box(m.chrome, 0.02, 0.07, 0.32, 0, 0.02, -0.16),
        box(m.silver, 0.014, 0.028, 0.3, 0, -0.016, -0.16),
        box(m.gun, 0.06, 0.028, 0.024, 0, 0.01, 0.01),
        box(m.grip, 0.05, 0.062, 0.17, 0, 0.01, 0.1),
        box(m.silver, 0.052, 0.066, 0.028, 0, 0.01, 0.2),
      );
      muzzle.set(0, 0.02, -0.34);
      break;
    }
  }

  addHands(handL, handR, m, style);
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
