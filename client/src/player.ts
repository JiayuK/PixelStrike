import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KEY, PHYS, WEAPONS, type PlayerSnap } from './constants.js';
import { moveAABB, type Box } from './world.js';

export class LocalPlayer {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  keys = 0;
  onGround = true;
  crouch = false;
  weaponId = 3;
  speedMultiplier = 1;
  update(dt: number, canStand = true) {
    let forward = 0, side = 0;
    if (this.keys & KEY.Forward) forward++;
    if (this.keys & KEY.Back) forward--;
    if (this.keys & KEY.Right) side++;
    if (this.keys & KEY.Left) side--;
    const moving = forward !== 0 || side !== 0;
    if (forward && side) { forward *= Math.SQRT1_2; side *= Math.SQRT1_2; }

    if (this.keys & KEY.Crouch) this.crouch = true;
    else if (canStand) this.crouch = false;
    let speed = PHYS.walkSpeed * (WEAPONS[this.weaponId]?.speedMult ?? 1) * this.speedMultiplier;
    if (this.crouch) speed *= PHYS.crouchSpeed;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const targetX = (side * cos - forward * sin) * speed;
    const targetZ = (-forward * cos - side * sin) * speed;
    const accel = (this.onGround ? (moving ? PHYS.groundAccel : PHYS.stopAccel) : PHYS.airAccel) * dt;
    this.vel.x = approach(this.vel.x, targetX, accel);
    this.vel.z = approach(this.vel.z, targetZ, accel);
    const horizontalSpeedSq = this.vel.x * this.vel.x + this.vel.z * this.vel.z;
    if (horizontalSpeedSq > speed * speed) {
      const scale = speed / Math.sqrt(horizontalSpeedSq);
      this.vel.x *= scale;
      this.vel.z *= scale;
    }

    if (this.keys & KEY.Jump && this.onGround) {
      this.vel.y = PHYS.jumpVel;
      this.onGround = false;
    }
    this.vel.y += PHYS.gravity * dt;
  }

  eyeY() { return this.pos.y + (this.crouch ? PHYS.crouchEye : PHYS.eyeHeight); }
  height() { return this.crouch ? PHYS.crouchingHeight : PHYS.standingHeight; }

  reconcile(x: number, y: number, z: number, vx = 0, vz = 0, latencyMs = 0, boxes?: Box[], canStep = false) {
    const lead = Math.min(0.12, 0.018 + latencyMs * 0.0005);
    target.set(x, y, z);
    if (boxes) moveAABB(target, prediction.set(vx, 0, vz), lead, boxes, this.height(), canStep);
    else target.addScaledVector(prediction.set(vx, 0, vz), lead);

    const errorSq = this.pos.distanceToSquared(target);
    if (errorSq > 4) {
      this.pos.copy(target);
      this.vel.x = vx;
      this.vel.z = vz;
      return;
    }
    if (errorSq < 0.0004) return;
    const cy = this.onGround ? (target.y - this.pos.y) * 0.15 : 0;
    correction.set((target.x - this.pos.x) * 0.15, cy, (target.z - this.pos.z) * 0.15);
    if (boxes) moveAABB(this.pos, correction, 1, boxes, this.height(), false);
    else this.pos.add(correction);
  }
}

const MAX_PLAYERS = 100;
const STALE_AFTER_MS = 3000;
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const target = new THREE.Vector3();
const correction = new THREE.Vector3();
const goal = new THREE.Vector3();
const bodyColor = new THREE.Color();
const prediction = new THREE.Vector3();
const PLAYER_SKINS = [0x00a8aa, 0xc45f48, 0x5f79c8, 0x79994d, 0xac6aa2, 0xcf963e];
const gunColor = new THREE.Color();
const approach = (value: number, wanted: number, amount: number) => value < wanted ? Math.min(wanted, value + amount) : Math.max(wanted, value - amount);
const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

interface RemoteModel {
  index: number;
  state: PlayerSnap;
  position: THREE.Vector3;
  sampleAt: number;
  flashUntil: number;
  lastShot: number;
  yaw: number;
  pitch: number;
  walk: number;
  nextStepAt: number;
  bodyColor: number;
  gunColor: number;
  visible: boolean;
}

interface PlayerLabel {
  root: HTMLElement;
  name: HTMLElement;
  bar: HTMLElement;
  hp: HTMLElement;
  id: number;
  lastName: string;
  lastHP: number;
}

interface WorldOccluder {
  raycastDistance(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number;
}

const MAX_LABELS = 24;

function createSteveHeadTexture(): THREE.Texture {
  const canvas = new OffscreenCanvas(32, 16);
  const ctx = canvas.getContext('2d')!;

  const H = '#482b18'; // Dark Brown Hair
  const H2 = '#381e0f';
  const S = '#d9a377'; // Skin Tone
  const N = '#be7e50'; // Nose
  const W = '#ffffff'; // White Eye Sclera
  const P = '#2c3577'; // Blue/Purple Pupil
  const B = '#582f1b'; // Beard/Mouth
  const B2 = '#42200f';

  // Fill base hair
  ctx.fillStyle = H;
  ctx.fillRect(0, 0, 32, 16);

  // Top hair (+Y, x: 8 to 16, y: 0 to 8)
  for (let y = 0; y < 8; y++) {
    for (let x = 8; x < 16; x++) {
      ctx.fillStyle = (x + y) % 3 === 0 ? H2 : H;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Front Face (+Z, x: 8 to 16, y: 8 to 16) - Iconic Minecraft Steve Face
  const face = [
    [H, H, H, H, H, H, H, H],
    [H, H, H, H, H, H, H, H],
    [H, S, S, S, S, S, S, H],
    [S, S, S, S, S, S, S, S],
    [S, W, P, S, S, P, W, S], // Iconic Steve Eyes
    [S, S, S, N, N, S, S, S], // Nose
    [S, B, B, B, B, B, B, S], // Beard / Smile
    [H, H, B2, B2, B2, B2, H, H],
  ];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = face[r][c];
      ctx.fillRect(8 + c, 8 + r, 1, 1);
    }
  }

  // Right Face (+X, x: 0 to 8, y: 8 to 16) & Left Face (-X, x: 16 to 24, y: 8 to 16)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = r < 3 ? H : (r < 5 && (c === 0 || c === 7) ? H : S);
      ctx.fillRect(0 + c, 8 + r, 1, 1);
      ctx.fillRect(16 + c, 8 + r, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function createSteveTorsoTexture(): THREE.Texture {
  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext('2d')!;

  const C = '#00a8aa'; // Steve Cyan Shirt
  const C2 = '#008e90';
  const S = '#d9a377'; // Skin V-neck

  ctx.fillStyle = C;
  ctx.fillRect(0, 0, 16, 16);

  // Front (+Z, x: 4 to 12, y: 0 to 16) with V-neck collar
  for (let y = 0; y < 16; y++) {
    for (let x = 4; x < 12; x++) {
      if (y < 4 && (x >= 6 && x <= 9)) {
        ctx.fillStyle = S; // V-neck skin
      } else {
        ctx.fillStyle = (x + y) % 5 === 0 ? C2 : C;
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function createSteveArmTexture(): THREE.Texture {
  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext('2d')!;

  const C = '#00a8aa'; // Cyan Sleeve
  const S = '#d9a377'; // Skin Arm

  // Top 1/3 is sleeve, bottom 2/3 is skin
  ctx.fillStyle = S;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = C;
  ctx.fillRect(0, 0, 16, 6);

  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function createSteveLegTexture(): THREE.Texture {
  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext('2d')!;

  const J = '#2b3577'; // Denim Jeans Blue
  const J2 = '#222b64';
  const B = '#3a3a3a'; // Dark Gray Shoes

  ctx.fillStyle = J;
  ctx.fillRect(0, 0, 16, 16);

  // Texture details
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = (x + y) % 4 === 0 ? J2 : J;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Shoes on bottom
  ctx.fillStyle = B;
  ctx.fillRect(0, 12, 16, 4);

  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
export class RemotePlayers {
  group = new THREE.Group();
  onShot: ((state: PlayerSnap, position: THREE.Vector3) => void) | null = null;
  onStep: ((position: THREE.Vector3) => void) | null = null;
  private models = new Map<number, RemoteModel>();
  private free = Array.from({ length: MAX_PLAYERS }, (_, i) => MAX_PLAYERS - 1 - i);
  private dummy = new THREE.Object3D();
  private labels: PlayerLabel[] = [];
  private labelModels: RemoteModel[] = [];
  private labelDistances: number[] = [];
  private labelPoint = new THREE.Vector3();
  private labelRay = new THREE.Vector3();
  private viewDir = new THREE.Vector3();
  private lastUpdate = performance.now();
  private headTex = createSteveHeadTexture();
  private torsoTex = createSteveTorsoTexture();
  private armTex = createSteveArmTexture();
  private legTex = createSteveLegTexture();

  private headGeo = (() => {
    const geo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const uvs = geo.attributes.uv;
    const faceUVs = [
      [0.00, 0.25, 0.00, 0.50], // +X (Right side)
      [0.50, 0.75, 0.00, 0.50], // -X (Left side)
      [0.25, 0.50, 0.50, 1.00], // +Y (Top hair)
      [0.50, 0.75, 0.50, 1.00], // -Y (Bottom neck)
      [0.75, 1.00, 0.00, 0.50], // +Z (Back hair)
      [0.25, 0.50, 0.00, 0.50], // -Z (Front face with Steve eyes!)
    ];
    for (let f = 0; f < 6; f++) {
      const [u0, u1, v0, v1] = faceUVs[f];
      const base = f * 4;
      uvs.setXY(base + 0, u0, v1);
      uvs.setXY(base + 1, u1, v1);
      uvs.setXY(base + 2, u0, v0);
      uvs.setXY(base + 3, u1, v0);
    }
    uvs.needsUpdate = true;
    geo.translate(0, 0.18, 0); // Pivot at neck
    return geo;
  })();

  private bodyGeo = (() => {
    const geo = new THREE.BoxGeometry(0.44, 0.60, 0.24);
    const uvs = geo.attributes.uv;
    const faceUVs = [
      [0.00, 0.25, 0.00, 1.00], // +X
      [0.75, 1.00, 0.00, 1.00], // -X
      [0.25, 0.75, 0.75, 1.00], // +Y
      [0.25, 0.75, 0.00, 0.25], // -Y
      [0.25, 0.75, 0.00, 1.00], // +Z (Front with V-neck)
      [0.25, 0.75, 0.00, 1.00], // -Z
    ];
    for (let f = 0; f < 6; f++) {
      const [u0, u1, v0, v1] = faceUVs[f];
      const base = f * 4;
      uvs.setXY(base + 0, u0, v1);
      uvs.setXY(base + 1, u1, v1);
      uvs.setXY(base + 2, u0, v0);
      uvs.setXY(base + 3, u1, v0);
    }
    uvs.needsUpdate = true;
    return geo;
  })();

  private armRGeo = (() => {
    const geo = new THREE.BoxGeometry(0.16, 0.60, 0.16);
    const uvs = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const base = f * 4;
      uvs.setXY(base + 0, 0, 1);
      uvs.setXY(base + 1, 1, 1);
      uvs.setXY(base + 2, 0, 0);
      uvs.setXY(base + 3, 1, 0);
    }
    uvs.needsUpdate = true;
    geo.translate(0, -0.30, 0); // Pivot at right shoulder
    return geo;
  })();

  private armLGeo = (() => {
    const geo = new THREE.BoxGeometry(0.16, 0.60, 0.16);
    const uvs = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const base = f * 4;
      uvs.setXY(base + 0, 0, 1);
      uvs.setXY(base + 1, 1, 1);
      uvs.setXY(base + 2, 0, 0);
      uvs.setXY(base + 3, 1, 0);
    }
    uvs.needsUpdate = true;
    geo.translate(0, -0.30, 0); // Pivot at left shoulder
    return geo;
  })();

  private legRGeo = (() => {
    const geo = new THREE.BoxGeometry(0.18, 0.60, 0.18);
    const uvs = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const base = f * 4;
      uvs.setXY(base + 0, 0, 1);
      uvs.setXY(base + 1, 1, 1);
      uvs.setXY(base + 2, 0, 0);
      uvs.setXY(base + 3, 1, 0);
    }
    uvs.needsUpdate = true;
    geo.translate(0, -0.30, 0); // Pivot at right hip
    return geo;
  })();

  private legLGeo = (() => {
    const geo = new THREE.BoxGeometry(0.18, 0.60, 0.18);
    const uvs = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const base = f * 4;
      uvs.setXY(base + 0, 0, 1);
      uvs.setXY(base + 1, 1, 1);
      uvs.setXY(base + 2, 0, 0);
      uvs.setXY(base + 3, 1, 0);
    }
    uvs.needsUpdate = true;
    geo.translate(0, -0.30, 0); // Pivot at left hip
    return geo;
  })();

  private gunGeo = (() => {
    const body = new THREE.BoxGeometry(0.08, 0.14, 0.58);
    body.translate(0, 0, -0.18);
    const barrel = new THREE.BoxGeometry(0.035, 0.035, 0.35);
    barrel.translate(0, 0.04, -0.56);
    const mag = new THREE.BoxGeometry(0.055, 0.22, 0.11);
    mag.translate(0, -0.12, -0.15);
    const scope = new THREE.BoxGeometry(0.05, 0.04, 0.22);
    scope.translate(0, 0.09, -0.14);
    return mergeGeometries([body, barrel, mag, scope])!;
  })();

  private head = this.mesh(this.headGeo, this.headTex);
  private body = this.mesh(this.bodyGeo, this.torsoTex);
  private armR = this.mesh(this.armRGeo, this.armTex);
  private armL = this.mesh(this.armLGeo, this.armTex);
  private legR = this.mesh(this.legRGeo, this.legTex);
  private legL = this.mesh(this.legLGeo, this.legTex);
  private gun = this.mesh(this.gunGeo, null, 0xffffff);
  private layers = [this.body, this.head, this.armR, this.armL, this.legR, this.legL, this.gun];
  nameOf: (id: number) => string = (id) => `特战队员${id}`;

  constructor(scene: THREE.Scene) {
    this.group.add(...this.layers);
    scene.add(this.group);
    for (let i = 0; i < MAX_PLAYERS; i++) this.hide(i);
    const root = document.getElementById('player-labels')!;
    for (let i = 0; i < MAX_LABELS; i++) {
      const tag = document.createElement('div');
      tag.className = 'player-label';
      tag.innerHTML = '<span class="player-identity"><b class="player-name"></b><span class="player-health"><i></i></span></span><span class="player-hp"></span>';
      root.appendChild(tag);
      const identity = tag.children[0] as HTMLElement;
      this.labels.push({ root: tag, name: identity.children[0] as HTMLElement, bar: identity.children[1].children[0] as HTMLElement, hp: tag.children[1] as HTMLElement, id: -1, lastName: '', lastHP: -1 });
    }
  }

  private mesh(geometry: THREE.BufferGeometry, texture: THREE.Texture | null = null, color = 0xffffff) {
    const mat = texture
      ? new THREE.MeshLambertMaterial({ map: texture })
      : new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.InstancedMesh(geometry, mat, MAX_PLAYERS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
  }
  sample(state: PlayerSnap, now: number) {
    let model = this.models.get(state.id);
    if (!model) {
      const index = this.free.pop();
      if (index === undefined) return;
      model = {
        index,
        state,
        position: new THREE.Vector3(state.x, state.y, state.z),
        sampleAt: now,
        flashUntil: 0,
        lastShot: state.shot,
        yaw: state.yaw,
        pitch: state.pitch,
        walk: 0,
        nextStepAt: now,
        bodyColor: -1,
        gunColor: -1,
        visible: false,
      };
      this.models.set(state.id, model);
    } else {
      if (state.shot !== model.lastShot) {
        model.lastShot = state.shot;
        this.onShot?.(state, model.position);
      }
      model.state = state;
      model.sampleAt = now;
    }
  }

  remove(id: number) {
    const model = this.models.get(id);
    if (!model) return;
    this.hide(model.index);
    this.free.push(model.index);
    this.models.delete(id);
  }

  flashHit(id: number) {
    const model = this.models.get(id);
    if (model) model.flashUntil = performance.now() + 120;
  }

  ids(): Iterable<number> { return this.models.keys(); }

  posOf(id: number) {
    return this.models.get(id) ?? null;
  }

  update(now: number) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastUpdate) / 1000));
    this.lastUpdate = now;
    if (this.models.size === 0) return;
    const alpha = 1 - Math.exp(-dt * 16);
    let bodyColorsDirty = false, gunColorsDirty = false;

    for (const model of this.models.values()) {
      const state = model.state;
      if (!(state.state & 1) || now - model.sampleAt > STALE_AFTER_MS) {
        if (model.visible) {
          this.hide(model.index);
          model.visible = false;
        }
        continue;
      }
      model.visible = true;

      const age = Math.min(0.2, Math.max(0, (now - model.sampleAt) / 1000));
      goal.set(state.x + state.vx * age, state.y, state.z + state.vz * age);
      if (model.position.distanceToSquared(goal) > 64) model.position.copy(goal);
      else model.position.lerp(goal, alpha);
      model.yaw = angleLerp(model.yaw, state.yaw, alpha);
      model.pitch += (state.pitch - model.pitch) * alpha;

      const speed = Math.sqrt(state.vx * state.vx + state.vz * state.vz);
      model.walk += speed * dt * 2.2;
      if (speed > 1 && state.state & 8 && !(state.state & 4) && now >= model.nextStepAt) {
        model.nextStepAt = now + 390;
        this.onStep?.(model.position);
      }
      const swing = speed > 0.2 ? Math.sin(model.walk) * 0.55 : 0;
      const crouch = !!(state.state & 4);
      const bodyY = crouch ? 0.64 : 0.94;
      const headY = bodyY + 0.3;
      const shoulderY = bodyY + 0.26;
      const hipY = bodyY - 0.3;
      const sin = Math.sin(model.yaw);
      const cos = Math.cos(model.yaw);

      // Body (Torso)
      this.place(this.body, model.index, model, sin, cos, 0, bodyY, 0, 0);

      // Head (Pivots at neck)
      this.place(this.head, model.index, model, sin, cos, 0, headY, 0, model.pitch);
      // Two-handed forward triangular V-shape weapon grip (尖尖双手持枪)
      const isKnife = state.weapon === 6;
      const pistolHold = state.weapon === 0 || state.weapon === 1 || state.weapon === 7;

      if (isKnife) {
        // Knife stance: Right hand holds blade forward-down, left arm swings with walking
        this.place(this.armR, model.index, model, sin, cos, 0.22, shoulderY, -0.04, Math.PI / 2.6 + model.pitch * 0.8, -0.15, -0.25);
        this.place(this.armL, model.index, model, sin, cos, -0.24, shoulderY, 0, -swing * 0.75, 0, 0);
        this.place(this.gun, model.index, model, sin, cos, 0.14, bodyY + 0.08, -0.28, model.pitch, 0, 0);
      } else if (pistolHold) {
        // Two-handed pistol grip: Both arms angle forward-inward meeting at pistol grip
        this.place(this.armR, model.index, model, sin, cos, 0.24, shoulderY, 0, Math.PI / 2.15 + model.pitch, 0.42, 0);
        this.place(this.armL, model.index, model, sin, cos, -0.24, shoulderY, 0, Math.PI / 2.15 + model.pitch, -0.42, 0);
        this.place(this.gun, model.index, model, sin, cos, 0.0, bodyY + 0.20, -0.44, model.pitch, 0, 0);
      } else {
        // Rifle / SMG / Sniper stance: Both arms angle forward-inward forming sharp V-shape holding rifle
        this.place(this.armR, model.index, model, sin, cos, 0.24, shoulderY, 0, Math.PI / 2.15 + model.pitch, 0.42, 0);
        this.place(this.armL, model.index, model, sin, cos, -0.24, shoulderY, 0, Math.PI / 2.15 + model.pitch, -0.42, 0);
        this.place(this.gun, model.index, model, sin, cos, 0.0, bodyY + 0.20, -0.48, model.pitch, 0, 0);
      }

      // Right Leg (Swings forward/backward when walking)
      this.place(this.legR, model.index, model, sin, cos, 0.12, hipY, 0, swing, 0, 0);

      // Left Leg (Swings opposite)
      this.place(this.legL, model.index, model, sin, cos, -0.12, hipY, 0, -swing, 0, 0);
      const wantedBodyColor = now < model.flashUntil ? 0xf43f5e : state.state & 2 ? 0xb89a61 : PLAYER_SKINS[state.id % PLAYER_SKINS.length];
      if (wantedBodyColor !== model.bodyColor) {
        model.bodyColor = wantedBodyColor;
        this.body.setColorAt(model.index, bodyColor.setHex(wantedBodyColor));
        bodyColorsDirty = true;
      }
      const wantedGunColor = WEAPONS[state.weapon]?.color ?? 0x222225;
      if (wantedGunColor !== model.gunColor) {
        model.gunColor = wantedGunColor;
        this.gun.setColorAt(model.index, gunColor.setHex(wantedGunColor));
        gunColorsDirty = true;
      }
    }

    for (const layer of this.layers) layer.instanceMatrix.needsUpdate = true;
    if (bodyColorsDirty && this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (gunColorsDirty && this.gun.instanceColor) this.gun.instanceColor.needsUpdate = true;
  }

  updateLabels(camera: THREE.Camera, world: WorldOccluder | null) {
    camera.getWorldDirection(this.viewDir);
    let count = 0;
    for (const model of this.models.values()) {
      if (!model.visible) continue;
      const dx = model.position.x - camera.position.x;
      const dy = model.position.y + 1.7 - camera.position.y;
      const dz = model.position.z - camera.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > 50 * 50 || dx * this.viewDir.x + dy * this.viewDir.y + dz * this.viewDir.z <= 0) continue;
      let at = Math.min(count, MAX_LABELS - 1);
      if (count === MAX_LABELS && distSq >= this.labelDistances[at]) continue;
      if (count < MAX_LABELS) count++;
      while (at > 0 && distSq < this.labelDistances[at - 1]) {
        this.labelModels[at] = this.labelModels[at - 1];
        this.labelDistances[at] = this.labelDistances[at - 1];
        at--;
      }
      this.labelModels[at] = model;
      this.labelDistances[at] = distSq;
    }

    for (let i = 0; i < count; i++) {
      const label = this.labels[i];
      const model = this.labelModels[i];
      const crouch = !!(model.state.state & 4);
      this.labelPoint.copy(model.position).y += crouch ? 1.55 : 2.05;
      this.labelRay.subVectors(this.labelPoint, camera.position);
      const distance = this.labelRay.length();
      this.labelPoint.project(camera);
      if (this.labelPoint.z < -1 || this.labelPoint.z > 1 || Math.abs(this.labelPoint.x) > 1.08 || Math.abs(this.labelPoint.y) > 1.08 || (world && world.raycastDistance(camera.position, this.labelRay.multiplyScalar(1 / distance), distance) < distance - 0.25)) {
        label.root.style.display = 'none';
        continue;
      }

      const id = model.state.id;
      const name = this.nameOf(id);
      const hp = Math.max(0, Math.min(100, model.state.hp));
      if (label.id !== id || label.lastName !== name) {
        label.id = id;
        label.lastName = name;
        label.name.textContent = name;
      }
      if (label.lastHP !== hp) {
        label.lastHP = hp;
        label.hp.textContent = String(hp);
        label.bar.style.transform = `scaleX(${hp / 100})`;
        label.bar.style.backgroundColor = hp > 60 ? '#58a65c' : hp > 30 ? '#c9822b' : '#bd5146';
      }
      const x = (this.labelPoint.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this.labelPoint.y * 0.5 + 0.5) * window.innerHeight;
      label.root.style.display = 'flex';
      label.root.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%) scale(${Math.max(0.78, 1 - distance / 180)})`;
    }
    for (let i = count; i < MAX_LABELS; i++) this.labels[i].root.style.display = 'none';
  }

  private place(
    mesh: THREE.InstancedMesh,
    index: number,
    model: RemoteModel,
    sin: number,
    cos: number,
    lx: number,
    ly: number,
    lz: number,
    pitch: number,
    yawOffset = 0,
    roll = 0,
  ) {
    const yaw = model.yaw + yawOffset;
    this.dummy.position.set(
      model.position.x + lx * cos + lz * sin,
      model.position.y + ly,
      model.position.z - lx * sin + lz * cos,
    );
    this.dummy.rotation.set(pitch, yaw, roll, 'YXZ');
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);
  }

  private hide(index: number) {
    for (const layer of this.layers) {
      layer.setMatrixAt(index, hidden);
      layer.instanceMatrix.needsUpdate = true;
    }
  }
}
