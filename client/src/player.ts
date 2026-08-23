import * as THREE from 'three';
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
  jumpLatched = false;
  weaponId = 3;
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
    let speed = PHYS.walkSpeed * (WEAPONS[this.weaponId]?.speedMult ?? 1);
    if (this.crouch) speed *= PHYS.crouchSpeed;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const targetX = (side * cos - forward * sin) * speed;
    const targetZ = (-forward * cos - side * sin) * speed;
    const accel = (this.onGround ? (moving ? PHYS.groundAccel : PHYS.stopAccel) : PHYS.airAccel) * dt;
    this.vel.x = approach(this.vel.x, targetX, accel);
    this.vel.z = approach(this.vel.z, targetZ, accel);

    const jumpPressed = !!(this.keys & KEY.Jump);
    if (jumpPressed && !this.jumpLatched && this.onGround) {
      this.vel.y = PHYS.jumpVel;
      this.onGround = false;
    }
    this.jumpLatched = jumpPressed;
    this.vel.y += PHYS.gravity * dt;
  }

  eyeY() { return this.pos.y + (this.crouch ? PHYS.crouchEye : PHYS.eyeHeight); }
  height() { return this.crouch ? PHYS.crouchingHeight : PHYS.standingHeight; }

  reconcile(x: number, y: number, z: number, vx = 0, vz = 0, latencyMs = 0, boxes?: Box[]) {
    const lead = Math.min(0.12, 0.018 + latencyMs * 0.0005);
    target.set(x + vx * lead, y, z + vz * lead);
    const errorSq = this.pos.distanceToSquared(target);
    if (errorSq > 9) {
      this.pos.copy(target);
      if (boxes) moveAABB(this.pos, correction.set(0, 0, 0), 0, boxes, this.height(), false);
    } else if (errorSq > 0.09) {
      correction.subVectors(target, this.pos).clampLength(0, 0.06);
      if (boxes) moveAABB(this.pos, correction, 1, boxes, this.height(), false);
      else this.pos.add(correction);
    }
  }
}

const MAX_PLAYERS = 100;
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const target = new THREE.Vector3();
const correction = new THREE.Vector3();
const goal = new THREE.Vector3();
const bodyColor = new THREE.Color();
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
  private bodyGeo = new THREE.BoxGeometry(0.44, 0.6, 0.24);
  private headGeo = (() => {
    const g = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    g.translate(0, 0.18, 0); // Pivot at neck
    return g;
  })();
  private armRGeo = (() => {
    const g = new THREE.BoxGeometry(0.14, 0.56, 0.14);
    g.translate(0, -0.28, 0); // Pivot at right shoulder
    return g;
  })();
  private armLGeo = (() => {
    const g = new THREE.BoxGeometry(0.14, 0.56, 0.14);
    g.translate(0, -0.28, 0); // Pivot at left shoulder
    return g;
  })();
  private legRGeo = (() => {
    const g = new THREE.BoxGeometry(0.17, 0.6, 0.18);
    g.translate(0, -0.3, 0); // Pivot at right hip
    return g;
  })();
  private legLGeo = (() => {
    const g = new THREE.BoxGeometry(0.17, 0.6, 0.18);
    g.translate(0, -0.3, 0); // Pivot at left hip
    return g;
  })();
  private gunGeo = (() => {
    const g = new THREE.BoxGeometry(0.09, 0.14, 0.68);
    g.translate(0, 0, -0.24); // Pivot at grip
    return g;
  })();

  private body = this.mesh(this.bodyGeo, 0xffffff);
  private head = this.mesh(this.headGeo, 0xd9a377);
  private armR = this.mesh(this.armRGeo, 0x5dada9);
  private armL = this.mesh(this.armLGeo, 0x5dada9);
  private legR = this.mesh(this.legRGeo, 0x273573);
  private legL = this.mesh(this.legLGeo, 0x273573);
  private gun = this.mesh(this.gunGeo, 0xffffff);
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

  private mesh(geometry: THREE.BufferGeometry, color: number) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color }), MAX_PLAYERS);
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
      if (!(state.state & 1)) {
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

      // Right Arm (Aims weapon along pitch)
      this.place(this.armR, model.index, model, sin, cos, 0.29, shoulderY, 0, -Math.PI / 2 + model.pitch);

      // Left Arm (Swings when walking)
      this.place(this.armL, model.index, model, sin, cos, -0.29, shoulderY, 0, -swing * 0.75);

      // Right Leg (Swings forward/backward)
      this.place(this.legR, model.index, model, sin, cos, 0.12, hipY, 0, swing);

      // Left Leg (Swings opposite)
      this.place(this.legL, model.index, model, sin, cos, -0.12, hipY, 0, -swing);

      // Gun (Held in front of chest/hands, aiming with pitch)
      this.place(this.gun, model.index, model, sin, cos, 0.22, bodyY + 0.08, -0.26, model.pitch);

      const wantedBodyColor = now < model.flashUntil ? 0xf43f5e : state.state & 2 ? 0xb89a61 : 0x009aa6;
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
      if (!(model.state.state & 1)) continue;
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

  private place(mesh: THREE.InstancedMesh, index: number, model: RemoteModel, sin: number, cos: number, lx: number, ly: number, lz: number, pitch: number) {
    const yaw = model.yaw;
    this.dummy.position.set(
      model.position.x + lx * cos + lz * sin,
      model.position.y + ly,
      model.position.z - lx * sin + lz * cos,
    );
    this.dummy.rotation.set(pitch, yaw, 0, 'YXZ');
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
