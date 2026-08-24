import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapData } from './constants.js';

// ---- 128x128 High-Definition Procedural Voxel Textures ----

function createHDVoxelTexture(type: number): THREE.Texture {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext('2d')!;
  let seed = type * 137 + 47;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  switch (type) {
    case 0: { // 0: Tactical Sandstone / Concrete Floor (4 beveled tiles with micro-pitted surface)
      ctx.fillStyle = '#bda98c';
      ctx.fillRect(0, 0, 128, 128);
      // Subtle ambient occlusion around perimeter
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, 0, 128, 6); ctx.fillRect(0, 122, 128, 6);
      ctx.fillRect(0, 0, 6, 128); ctx.fillRect(122, 0, 6, 128);

      // 4 Large square floor tiles with 4px beveled mortar seams
      ctx.fillStyle = '#5c4f3d';
      ctx.fillRect(0, 62, 128, 4);
      ctx.fillRect(62, 0, 4, 128);
      // Tile bevel highlights & shadows
      ctx.fillStyle = '#dbcca9';
      ctx.fillRect(2, 2, 58, 3); ctx.fillRect(2, 2, 3, 58);
      ctx.fillRect(68, 2, 58, 3); ctx.fillRect(68, 2, 3, 58);
      ctx.fillRect(2, 68, 58, 3); ctx.fillRect(2, 68, 3, 58);
      ctx.fillRect(68, 68, 58, 3); ctx.fillRect(68, 68, 3, 58);

      ctx.fillStyle = '#85745b';
      ctx.fillRect(2, 57, 58, 3); ctx.fillRect(57, 2, 3, 58);
      ctx.fillRect(68, 57, 58, 3); ctx.fillRect(123, 2, 3, 58);
      ctx.fillRect(2, 123, 58, 3); ctx.fillRect(57, 68, 3, 58);
      ctx.fillRect(68, 123, 58, 3); ctx.fillRect(123, 68, 3, 58);

      // Micro surface roughness
      for (let i = 0; i < 300; i++) {
        const x = Math.floor(rnd() * 128);
        const y = Math.floor(rnd() * 128);
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
        ctx.fillRect(x, y, 2, 2);
      }
      break;
    }
    case 1: { // 1: Reinforced Concrete Masonry (Clean modern urban brick blocks)
      ctx.fillStyle = '#7c838a';
      ctx.fillRect(0, 0, 128, 128);
      // Clean horizontal and staggered vertical mortar lines
      ctx.fillStyle = '#32363b';
      ctx.fillRect(0, 30, 128, 4);
      ctx.fillRect(0, 62, 128, 4);
      ctx.fillRect(0, 94, 128, 4);
      ctx.fillRect(0, 124, 128, 4);

      ctx.fillRect(62, 0, 4, 30);
      ctx.fillRect(30, 34, 4, 28);
      ctx.fillRect(94, 34, 4, 28);
      ctx.fillRect(62, 66, 4, 28);
      ctx.fillRect(30, 98, 4, 26);
      ctx.fillRect(94, 98, 4, 26);

      // Brick top highlights & bevels
      ctx.fillStyle = '#a0a8b2';
      ctx.fillRect(0, 0, 62, 2); ctx.fillRect(66, 0, 62, 2);
      ctx.fillRect(0, 34, 30, 2); ctx.fillRect(34, 34, 60, 2); ctx.fillRect(98, 34, 30, 2);
      ctx.fillRect(0, 66, 62, 2); ctx.fillRect(66, 66, 62, 2);
      ctx.fillRect(0, 98, 30, 2); ctx.fillRect(34, 98, 60, 2); ctx.fillRect(98, 98, 30, 2);

      // Concrete stippling
      for (let i = 0; i < 260; i++) {
        const x = Math.floor(rnd() * 128);
        const y = Math.floor(rnd() * 128);
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
        ctx.fillRect(x, y, 2, 2);
      }
      break;
    }
    case 2: { // 2: High-Def Military Wooden Crate (Dark oak with heavy steel braces & stencils)
      ctx.fillStyle = '#5c3d22';
      ctx.fillRect(0, 0, 128, 128);
      // Wood plank grooves
      ctx.fillStyle = '#311d0e';
      ctx.fillRect(0, 30, 128, 3);
      ctx.fillRect(0, 62, 128, 3);
      ctx.fillRect(0, 94, 128, 3);

      // Wood grain streaks
      ctx.fillStyle = '#78502d';
      for (let i = 0; i < 50; i++) {
        const y = Math.floor(rnd() * 128);
        const x = Math.floor(rnd() * 100);
        ctx.fillRect(x, y, 20 + rnd() * 24, 2);
      }

      // Military Crate Stenciled Markings in center
      ctx.fillStyle = 'rgba(235, 200, 120, 0.45)';
      ctx.fillRect(36, 42, 56, 12);
      ctx.fillStyle = '#311d0e';
      ctx.fillRect(40, 44, 4, 8); ctx.fillRect(48, 44, 4, 8); ctx.fillRect(56, 44, 4, 8);
      ctx.fillRect(66, 44, 12, 3); ctx.fillRect(70, 47, 4, 5);

      // Outer heavy metal frame
      ctx.fillStyle = '#1c1f24';
      ctx.fillRect(0, 0, 128, 12);
      ctx.fillRect(0, 116, 128, 12);
      ctx.fillRect(0, 0, 12, 128);
      ctx.fillRect(116, 0, 12, 128);

      // Diagonal cross-brace metal band
      ctx.beginPath();
      ctx.strokeStyle = '#1c1f24';
      ctx.lineWidth = 12;
      ctx.moveTo(0, 0); ctx.lineTo(128, 128);
      ctx.stroke();

      // Silver corner bolts
      ctx.fillStyle = '#c5ccd6';
      const boltCoords = [
        [5, 5], [117, 5], [5, 117], [117, 117],
        [60, 5], [60, 117], [5, 60], [117, 60],
      ];
      for (const [bx, by] of boltCoords) {
        ctx.fillRect(bx, by, 5, 5);
        ctx.fillStyle = '#2d333b';
        ctx.fillRect(bx + 1, by + 1, 3, 3);
        ctx.fillStyle = '#c5ccd6';
      }
      break;
    }
    case 3: { // 3: Diamond Steel Plate (Industrial metallic tread plate)
      ctx.fillStyle = '#565e66';
      ctx.fillRect(0, 0, 128, 128);
      // Beveled outer border
      ctx.fillStyle = '#8b96a2';
      ctx.fillRect(0, 0, 128, 4);
      ctx.fillRect(0, 0, 4, 128);
      ctx.fillStyle = '#34383e';
      ctx.fillRect(0, 124, 128, 4);
      ctx.fillRect(124, 0, 4, 128);

      // Diamond tread pattern with drop shadows and specular edge
      for (let y = 12; y < 120; y += 20) {
        for (let x = 12; x < 120; x += 20) {
          // Shadow
          ctx.fillStyle = '#2c3136';
          ctx.beginPath();
          ctx.moveTo(x + 1, y - 5);
          ctx.lineTo(x + 6, y + 1);
          ctx.lineTo(x + 1, y + 7);
          ctx.lineTo(x - 4, y + 1);
          ctx.closePath();
          ctx.fill();

          // Highlight
          ctx.fillStyle = '#838e9a';
          ctx.beginPath();
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x + 4, y);
          ctx.lineTo(x, y + 6);
          ctx.lineTo(x - 4, y);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#b2bcc7';
          ctx.fillRect(x - 1, y - 4, 2, 2);
        }
      }
      break;
    }
    case 4: { // 4: Dark Basalt / Fortress Stone (Polished dark slate tiles)
      ctx.fillStyle = '#27292e';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#141518';
      ctx.fillRect(0, 62, 128, 4);
      ctx.fillRect(62, 0, 4, 128);
      ctx.fillStyle = '#4b4f57';
      ctx.fillRect(0, 0, 62, 2); ctx.fillRect(0, 0, 2, 62);
      ctx.fillRect(66, 0, 62, 2); ctx.fillRect(66, 0, 2, 62);
      ctx.fillRect(0, 66, 62, 2); ctx.fillRect(0, 66, 2, 62);
      ctx.fillRect(66, 66, 62, 2); ctx.fillRect(66, 66, 2, 62);
      break;
    }
    case 5: { // 5: High-Def Foliage & Planters (Lush multi-tone emerald hedge)
      ctx.fillStyle = '#265221';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 480; i++) {
        const x = Math.floor(rnd() * 126);
        const y = Math.floor(rnd() * 126);
        const r = rnd();
        ctx.fillStyle = r < 0.3 ? '#193815' : r < 0.65 ? '#366d2f' : '#4d8e43';
        ctx.fillRect(x, y, 4, 4);
      }
      break;
    }
    case 6: { // 6: Chiseled Desert Sandstone (Warm golden architectural relief)
      ctx.fillStyle = '#d6c490';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#9e8c58';
      ctx.fillRect(0, 0, 128, 8);
      ctx.fillRect(0, 120, 128, 8);
      // Center geometric relief
      ctx.fillStyle = '#bcaa77';
      ctx.fillRect(18, 18, 92, 92);
      ctx.fillStyle = '#d6c490';
      ctx.fillRect(34, 34, 60, 60);
      ctx.fillStyle = '#9e8c58';
      ctx.fillRect(50, 50, 28, 28);
      ctx.fillStyle = '#e8d9aa';
      ctx.fillRect(56, 56, 16, 16);
      break;
    }
    case 7: { // 7: Red Terracotta / Nether Brick (Deep crimson masonry)
      ctx.fillStyle = '#6e2b26';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#33120f';
      ctx.fillRect(0, 62, 128, 4);
      ctx.fillRect(62, 0, 4, 128);
      ctx.fillStyle = '#8f3f38';
      ctx.fillRect(0, 0, 62, 2); ctx.fillRect(66, 0, 62, 2);
      ctx.fillRect(0, 66, 62, 2); ctx.fillRect(66, 66, 62, 2);
      break;
    }
    case 8: { // 8: Cyber Beacon / Lamp (Luminous amber lattice with glowing core)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#6b2d07';
      ctx.fillRect(0, 0, 128, 8);
      ctx.fillRect(0, 120, 128, 8);
      ctx.fillRect(0, 0, 8, 128);
      ctx.fillRect(120, 0, 8, 128);
      ctx.fillRect(60, 0, 8, 128);
      ctx.fillRect(0, 60, 128, 8);

      // Glowing white-hot center core
      ctx.fillStyle = '#fffdf0';
      ctx.fillRect(18, 18, 40, 40);
      ctx.fillRect(70, 18, 40, 40);
      ctx.fillRect(18, 70, 40, 40);
      ctx.fillRect(70, 70, 40, 40);
      break;
    }
    case 9: { // 9: Obsidian Carbon (High-tech 2x2 twill carbon fiber sheen)
      ctx.fillStyle = '#111317';
      ctx.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 8) {
        for (let x = 0; x < 128; x += 8) {
          ctx.fillStyle = (x + y) % 16 === 0 ? '#2a2e38' : '#0c0d10';
          ctx.fillRect(x, y, 8, 8);
        }
      }
      break;
    }
    case 10: { // 10: Tactical Supply Shelf
      ctx.fillStyle = '#4e3826';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#241810';
      ctx.fillRect(4, 4, 120, 56);
      ctx.fillRect(4, 68, 120, 56);

      // Colorful tactical crates & aid packs
      const cols = ['#10b981', '#06b6d4', '#f59e0b', '#f43f5e', '#3b82f6'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = cols[i];
        ctx.fillRect(10 + i * 22, 16, 18, 40);
        ctx.fillRect(10 + i * 22, 80, 18, 40);
      }
      break;
    }
    case 11: { // 11: Tinted Security Glass
      ctx.fillStyle = 'rgba(6, 182, 212, 0.32)';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(0, 0, 128, 4);
      ctx.fillRect(0, 124, 128, 4);
      ctx.fillRect(0, 0, 4, 128);
      ctx.fillRect(124, 0, 4, 128);
      // High-tech diagonal glints
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 4;
      ctx.moveTo(10, 10); ctx.lineTo(40, 40);
      ctx.moveTo(80, 80); ctx.lineTo(118, 118);
      ctx.stroke();
      break;
    }
    case 12: { // 12: Azure Water Basin (Crystal Clear Flowing Water Caustics)
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 128, 128);
      // Soft organic water caustics ripples without harsh stripes
      ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      for (let i = 0; i < 56; i++) {
        const cx = Math.floor(rnd() * 128);
        const cy = Math.floor(rnd() * 128);
        const cw = 6 + Math.floor(rnd() * 16);
        const ch = 4 + Math.floor(rnd() * 10);
        ctx.fillRect(cx, cy, cw, ch);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      for (let i = 0; i < 28; i++) {
        const cx = Math.floor(rnd() * 128);
        const cy = Math.floor(rnd() * 128);
        ctx.fillRect(cx, cy, 3, 2);
      }
      break;
    }
    default: { // 13: Paved Roadway / Asphalt with Dashed Center Markings
      ctx.fillStyle = '#2e3238';
      ctx.fillRect(0, 0, 128, 128);
      // Asphalt stone speckles
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 2, 2);
      }
      // White boundary curbs
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, 128, 5);
      ctx.fillRect(0, 123, 128, 5);
      // Yellow dashed center stripe
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(16, 61, 32, 6);
      ctx.fillRect(80, 61, 32, 6);
      break;
    }
  }
  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Generate geometry with repeating 1-meter UV mapping so HD textures tile seamlessly across large walls
function createRepeatingBox(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uvs = geo.attributes.uv;
  // BoxGeometry face order: +X (0-3), -X (4-7), +Y (8-11), -Y (12-15), +Z (16-19), -Z (20-23)
  const faceSizes = [
    [d, h], // +X
    [d, h], // -X
    [w, d], // +Y
    [w, d], // -Y
    [w, h], // +Z
    [w, h], // -Z
  ];

  for (let face = 0; face < 6; face++) {
    const [fw, fh] = faceSizes[face];
    const base = face * 4;
    uvs.setXY(base + 0, 0, fh);
    uvs.setXY(base + 1, fw, fh);
    uvs.setXY(base + 2, 0, 0);
    uvs.setXY(base + 3, fw, 0);
  }
  uvs.needsUpdate = true;
  geo.translate(x + w / 2, y + h / 2, z + d / 2);
  return geo;
}

export class WorldView {
  group = new THREE.Group();
  clouds = new THREE.Group();
  sun = new THREE.Group();
  private scene: THREE.Scene;
  private waterTex: THREE.Texture | null = null;
  private pickupTemplates: THREE.Group[];
  private pickups = new Map<number, THREE.Group>();
  boxes: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[] = [];
  constructor(scene: THREE.Scene, map: MapData) {
    this.scene = scene;
    this.pickupTemplates = [this.createPickup(0), this.createPickup(1), this.createPickup(2)];

    // 1. Build Repeating-UV High-Definition Voxel Map with Merged Geometries per Material
    const byMat = new Map<number, THREE.BufferGeometry[]>();
    for (const b of map.blocks) {
      if (b.t !== 12) this.boxes.push({ x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h, z0: b.z, z1: b.z + b.d });
      if (!byMat.has(b.t)) byMat.set(b.t, []);
      const geo = createRepeatingBox(b.w, b.h, b.d, b.x, b.y, b.z);
      byMat.get(b.t)!.push(geo);
    }

    for (const [t, geos] of byMat) {
      const tex = createHDVoxelTexture(t);
      let mat: THREE.Material;

      if (t === 8) { // Luminous Cyber Beacon
        mat = new THREE.MeshLambertMaterial({
          map: tex,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.8,
        });
      } else if (t === 12) { // Water surface
        this.waterTex = tex;
        mat = new THREE.MeshLambertMaterial({
          map: tex,
          transparent: true,
          opacity: 0.76,
          depthWrite: false,
        });
      } else if (t === 11) { // Glass
        mat = new THREE.MeshLambertMaterial({
          map: tex,
          transparent: true,
          opacity: 0.75,
        });
      } else if (t === 5) { // Foliage
        mat = new THREE.MeshLambertMaterial({ map: tex });
      } else {
        mat = new THREE.MeshLambertMaterial({
          map: tex,
        });
      }

      const merged = mergeGeometries(geos, false)!;
      for (const g of geos) g.dispose();
      this.group.add(new THREE.Mesh(merged, mat));
    }
    this.scene.add(this.group);

    // 2. High-Tech Sky with Sun & Volumetric Cloud Slabs
    this.setupSky();

  }

  private createPickup(kind: number): THREE.Group {
    const group = new THREE.Group();
    const colors = [0xe4a94a, 0xd94c4c, 0x35c9e8];
    const color = colors[kind];
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.36, 0.52),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.75 }),
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 12, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    group.add(core, glow);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xf5f2df });
    if (kind === 0) {
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.09), markerMat);
      const right = left.clone();
      left.position.set(-0.12, 0.24, 0);
      right.position.set(0.12, 0.24, 0);
      group.add(left, right);
    } else if (kind === 1) {
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.08), markerMat);
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.08), markerMat);
      horizontal.position.set(0, 0, -0.3);
      vertical.position.set(0, 0, -0.3);
      group.add(horizontal, vertical);
    } else {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.08), markerMat);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.08), markerMat);
      const wingR = wingL.clone();
      shaft.position.set(0, 0.08, -0.3);
      wingL.position.set(-0.1, -0.05, -0.3);
      wingR.position.set(0.1, -0.05, -0.3);
      wingL.rotation.z = -0.7;
      wingR.rotation.z = 0.7;
      group.add(shaft, wingL, wingR);
    }
    return group;
  }

  setPickup(id: number, kind: number, x: number, y: number, z: number) {
    this.removePickup(id);
    const pickup = (this.pickupTemplates[kind] ?? this.pickupTemplates[0]).clone();
    pickup.position.set(x, y + 0.48, z);
    pickup.userData.baseY = pickup.position.y;
    this.pickups.set(id, pickup);
    this.group.add(pickup);
  }

  removePickup(id: number) {
    const pickup = this.pickups.get(id);
    if (!pickup) return;
    this.group.remove(pickup);
    this.pickups.delete(id);
  }

  private setupSky() {
    const sunBox = new THREE.Mesh(
      new THREE.BoxGeometry(26, 26, 6),
      new THREE.MeshBasicMaterial({ color: 0xfffff0 })
    );
    sunBox.position.set(100, 95, -120);
    sunBox.lookAt(0, 0, 0);
    const haloInner = new THREE.Mesh(
      new THREE.BoxGeometry(44, 44, 4),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, depthWrite: false })
    );
    haloInner.position.copy(sunBox.position);
    haloInner.lookAt(0, 0, 0);
    const haloOuter = new THREE.Mesh(
      new THREE.BoxGeometry(72, 72, 2),
      new THREE.MeshBasicMaterial({ color: 0xffdf80, transparent: true, opacity: 0.18, depthWrite: false })
    );
    haloOuter.position.copy(sunBox.position);
    haloOuter.lookAt(0, 0, 0);
    this.sun.add(haloOuter, haloInner, sunBox);
    this.scene.add(this.sun);

    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 });
    const cloudGeos: THREE.BufferGeometry[] = [];
    let cSeed = 42;
    const cRnd = () => (cSeed = (cSeed * 16807) % 2147483647) / 2147483647;

    for (let x = -240; x <= 240; x += 48) {
      for (let z = -240; z <= 240; z += 48) {
        if (cRnd() > 0.38) {
          const cw = 24 + Math.floor(cRnd() * 28);
          const cd = 24 + Math.floor(cRnd() * 28);
          const cg = new THREE.BoxGeometry(cw, 3.5, cd);
          cg.translate(x + cRnd() * 10, 55 + cRnd() * 6, z + cRnd() * 10);
          cloudGeos.push(cg);
        }
      }
    }
    const mergedClouds = mergeGeometries(cloudGeos)!;
    for (const g of cloudGeos) g.dispose();
    this.clouds.add(new THREE.Mesh(mergedClouds, cloudMat));
    this.scene.add(this.clouds);
  }
  raycastDistance(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number {
    let best = maxDist;
    for (const b of this.boxes) {
      let tmin = 0, tmax = best;
      if (Math.abs(dir.x) < 1e-9) { if (origin.x < b.x0 || origin.x > b.x1) continue; }
      else {
        let t1 = (b.x0 - origin.x) / dir.x, t2 = (b.x1 - origin.x) / dir.x;
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (Math.abs(dir.y) < 1e-9) { if (origin.y < b.y0 || origin.y > b.y1) continue; }
      else {
        let t1 = (b.y0 - origin.y) / dir.y, t2 = (b.y1 - origin.y) / dir.y;
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (Math.abs(dir.z) < 1e-9) { if (origin.z < b.z0 || origin.z > b.z1) continue; }
      else {
        let t1 = (b.z0 - origin.z) / dir.z, t2 = (b.z1 - origin.z) / dir.z;
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (tmin > 0 && tmin < best) best = tmin;
    }
    return best;
  }

  animate(t: number) {
    if (this.clouds.visible) this.clouds.position.x = (t * 0.0018) % 48;
    if (this.waterTex) {
      this.waterTex.offset.x = (t * 0.00005) % 1;
      this.waterTex.offset.y = (t * 0.00008) % 1;
    }
    for (const [id, pickup] of this.pickups) {
      pickup.rotation.y = t * 0.0018 + id;
      pickup.position.y = pickup.userData.baseY + Math.sin(t * 0.003 + id) * 0.08;
      pickup.scale.setScalar(1 + Math.sin(t * 0.004 + id) * 0.06);
    }
  }
}

// ---- Client-side AABB sliding collision ----
export type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

const PH = 0.3;
const SU = 0.55;
const EPS = 0.001;

function overlaps(px: number, py: number, pz: number, b: Box, height: number): boolean {
  return px - PH < b.x1 && px + PH > b.x0 && py < b.y1 && py + height > b.y0 && pz - PH < b.z1 && pz + PH > b.z0;
}

export function canOccupy(boxes: Box[], pos: THREE.Vector3, height: number): boolean {
  for (const b of boxes) if (overlaps(pos.x, pos.y, pos.z, b, height)) return false;
  return true;
}


function stepBlocked(boxes: Box[], px: number, newFeet: number, pz: number, height: number): boolean {
  for (const b of boxes) if (overlaps(px, newFeet + EPS, pz, b, height)) return true;
  return false;
}

export function moveAABB(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  dt: number,
  boxes: Box[],
  height = 1.8,
  canStep = true,
): boolean {
  let grounded = depenetrate(pos, vel, boxes, height);

  const dx = vel.x * dt;
  if (dx !== 0) {
    const startX = pos.x;
    let nextX = startX + dx;
    let blocked = false;
    for (const b of boxes) {
      if (pos.y >= b.y1 || pos.y + height <= b.y0 || pos.z - PH >= b.z1 || pos.z + PH <= b.z0) continue;
      const crossed = dx > 0
        ? startX + PH <= b.x0 + EPS && nextX + PH > b.x0
        : startX - PH >= b.x1 - EPS && nextX - PH < b.x1;
      if (!crossed) continue;
      const stepH = b.y1 - pos.y;
      if (canStep && stepH > 0 && stepH <= SU && !stepBlocked(boxes, nextX, b.y1, pos.z, height)) {
        pos.y = b.y1 + EPS;
        grounded = true;
        continue;
      }
      nextX = dx > 0 ? Math.min(nextX, b.x0 - PH - EPS) : Math.max(nextX, b.x1 + PH + EPS);
      blocked = true;
    }
    pos.x = nextX;
    if (blocked) vel.x = 0;
  }

  const dz = vel.z * dt;
  if (dz !== 0) {
    const startZ = pos.z;
    let nextZ = startZ + dz;
    let blocked = false;
    for (const b of boxes) {
      if (pos.y >= b.y1 || pos.y + height <= b.y0 || pos.x - PH >= b.x1 || pos.x + PH <= b.x0) continue;
      const crossed = dz > 0
        ? startZ + PH <= b.z0 + EPS && nextZ + PH > b.z0
        : startZ - PH >= b.z1 - EPS && nextZ - PH < b.z1;
      if (!crossed) continue;
      const stepH = b.y1 - pos.y;
      if (canStep && stepH > 0 && stepH <= SU && !stepBlocked(boxes, pos.x, b.y1, nextZ, height)) {
        pos.y = b.y1 + EPS;
        grounded = true;
        continue;
      }
      nextZ = dz > 0 ? Math.min(nextZ, b.z0 - PH - EPS) : Math.max(nextZ, b.z1 + PH + EPS);
      blocked = true;
    }
    pos.z = nextZ;
    if (blocked) vel.z = 0;
  }

  const dy = vel.y * dt;
  if (dy !== 0) {
    const startY = pos.y;
    let nextY = startY + dy;
    for (const b of boxes) {
      if (pos.x - PH >= b.x1 || pos.x + PH <= b.x0 || pos.z - PH >= b.z1 || pos.z + PH <= b.z0) continue;
      if (dy < 0 && startY >= b.y1 - EPS && nextY < b.y1) {
        nextY = Math.max(nextY, b.y1 + EPS);
        vel.y = 0;
        grounded = true;
      } else if (dy > 0 && startY + height <= b.y0 + EPS && nextY + height > b.y0) {
        nextY = Math.min(nextY, b.y0 - height - EPS);
        vel.y = 0;
      }
    }
    pos.y = nextY;
  }
  grounded = depenetrate(pos, vel, boxes, height) || grounded;
  return grounded;
}

function depenetrate(pos: THREE.Vector3, vel: THREE.Vector3, boxes: Box[], height: number): boolean {
  let grounded = false;
  for (let pass = 0; pass < 6; pass++) {
    let found = false;
    for (const b of boxes) {
      if (!overlaps(pos.x, pos.y, pos.z, b, height)) continue;
      found = true;
      let axis = 0;
      let delta = b.x0 - EPS - (pos.x + PH);
      let best = Math.abs(delta);
      const choose = (candidate: number, candidateAxis: number) => {
        const size = Math.abs(candidate);
        if (size < best) { best = size; delta = candidate; axis = candidateAxis; }
      };
      choose(b.x1 + EPS - (pos.x - PH), 0);
      choose(b.y0 - EPS - (pos.y + height), 1);
      choose(b.y1 + EPS - pos.y, 1);
      choose(b.z0 - EPS - (pos.z + PH), 2);
      choose(b.z1 + EPS - (pos.z - PH), 2);
      if (axis === 0) { pos.x += delta; vel.x = 0; }
      else if (axis === 1) { pos.y += delta; vel.y = 0; grounded ||= delta > 0; }
      else { pos.z += delta; vel.z = 0; }
      break;
    }
    if (!found) break;
  }
  return grounded;
}
