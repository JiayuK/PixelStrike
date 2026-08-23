import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const MAX_PARTICLES = 512;
const dummy = new THREE.Object3D();
const pColor = new THREE.Color();
const grenadeStep = new THREE.Vector3();

interface ParticleData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: number;
  born: number;
  life: number;
}

interface GrenadeVisual {
  mesh: THREE.Mesh;
  player: number;
  vx: number;
  vy: number;
  vz: number;
  born: number;
}

interface GrenadeCollider {
  raycastDistance(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number;
}

export class ParticleSystem {
  group = new THREE.Group();
  private particles: ParticleData[] = [];
  private geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  private instancedMesh: THREE.InstancedMesh;
  private grenades: GrenadeVisual[] = [];
  private grenadeGeo = (() => {
    const body = new THREE.CylinderGeometry(0.075, 0.075, 0.18, 12);
    const rib = new THREE.BoxGeometry(0.16, 0.04, 0.16);
    const fuze = new THREE.BoxGeometry(0.05, 0.07, 0.09);
    fuze.translate(0, 0.12, 0);
    const ring = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8);
    ring.translate(0.04, 0.13, 0);
    return mergeGeometries([body, rib, fuze, ring])!;
  })();
  private grenadeMat = new THREE.MeshLambertMaterial({ color: 0x475e38 });

  constructor(scene: THREE.Scene) {
    this.instancedMesh = new THREE.InstancedMesh(this.geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_PARTICLES);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    this.group.add(this.instancedMesh);
    scene.add(this.group);
  }

  /** Spawn voxel debris on bullet hitting a surface */
  spawnImpact(pos: THREE.Vector3, normal: THREE.Vector3, color = 0xd6b36e, count = 8) {
    const available = MAX_PARTICLES - this.particles.length;
    count = Math.min(count, Math.max(0, available));
    if (count <= 0) return;
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const speed = 2.5 + Math.random() * 4.5;
      const rx = (Math.random() - 0.5) * 1.5;
      const ry = (Math.random() - 0.5) * 1.5;
      const rz = (Math.random() - 0.5) * 1.5;

      this.particles.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: (normal.x + rx) * speed,
        vy: Math.abs(normal.y + ry) * speed + 1.5,
        vz: (normal.z + rz) * speed,
        color,
        born: now,
        life: 400 + Math.random() * 300,
      });
    }
  }
  spawnGrenade(player: number, pos: THREE.Vector3, vel: THREE.Vector3) {
    const now = performance.now();
    const existing = this.grenades.find((g) => g.player === player && now - g.born < 400);
    if (existing) {
      existing.mesh.position.copy(pos);
      existing.vx = vel.x;
      existing.vy = vel.y;
      existing.vz = vel.z;
      return;
    }
    const mesh = new THREE.Mesh(this.grenadeGeo, this.grenadeMat);
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.grenades.push({ mesh, player, vx: vel.x, vy: vel.y, vz: vel.z, born: now });
  }

  /** Spawn dynamic high-impact explosion fire, sparks, and billowing smoke */
  spawnExplosion(pos: THREE.Vector3) {
    const now = performance.now();
    // 1. Fiery Blast Core & Shrapnel Sparks (Spherical burst)
    const fireColors = [0xff2200, 0xff5500, 0xff9900, 0xffdd33, 0xfffa88];
    for (let i = 0; i < 32; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const speed = 4.0 + Math.random() * 8.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.abs(Math.cos(phi)) * speed * 0.9 + 2.0;
      const vz = Math.sin(phi) * Math.sin(theta) * speed;
      this.particles.push({
        x: pos.x,
        y: pos.y + 0.2,
        z: pos.z,
        vx,
        vy,
        vz,
        color: fireColors[i % fireColors.length],
        born: now,
        life: 500 + Math.random() * 400,
      });
    }

    // 2. Billowing Volumetric Smoke Plumes (Rising ash & dark smoke)
    const smokeColors = [0x1e1e22, 0x38383e, 0x55555c, 0x777780];
    for (let i = 0; i < 24; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const speed = 1.0 + Math.random() * 2.5;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: pos.x + (Math.random() - 0.5) * 0.8,
        y: pos.y + 0.3 + Math.random() * 0.4,
        z: pos.z + (Math.random() - 0.5) * 0.8,
        vx: Math.cos(angle) * speed,
        vy: 2.5 + Math.random() * 3.5, // Ascending smoke
        vz: Math.sin(angle) * speed,
        color: smokeColors[i % smokeColors.length],
        born: now,
        life: 900 + Math.random() * 600,
      });
    }

    // 3. Ground Shrapnel & Debris
    this.spawnImpact(pos, UP, 0x8a7a60, 14);

    let nearest = -1;
    let nearestSq = 4;
    for (let i = 0; i < this.grenades.length; i++) {
      const d = this.grenades[i].mesh.position.distanceToSquared(pos);
      if (d < nearestSq) { nearest = i; nearestSq = d; }
    }
    if (nearest >= 0) {
      this.group.remove(this.grenades[nearest].mesh);
      this.grenades.splice(nearest, 1);
    }
  }

  update(dt: number, now = performance.now(), world: GrenadeCollider | null = null) {
    let alive = 0;
    let colorsDirty = false;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const age = now - p.born;
      if (age > p.life) continue;

      p.vy -= 18.0 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const scale = Math.max(0.08, 1 - age / p.life);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(alive, dummy.matrix);
      this.instancedMesh.setColorAt(alive, pColor.setHex(p.color));
      colorsDirty = true;

      this.particles[alive++] = p;
    }
    this.particles.length = alive;
    this.instancedMesh.count = alive;
    if (alive > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (colorsDirty && this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
    let liveGrenades = 0;
    for (const g of this.grenades) {
      if (now - g.born > 2100) {
        this.group.remove(g.mesh);
        continue;
      }
      g.vy -= 22 * dt;
      grenadeStep.set(g.vx * dt, g.vy * dt, g.vz * dt);
      const travel = grenadeStep.length();
      if (world && travel > 0) {
        grenadeStep.multiplyScalar(1 / travel);
        const hit = world.raycastDistance(g.mesh.position, grenadeStep, travel);
        if (hit < travel) {
          g.mesh.position.addScaledVector(grenadeStep, Math.max(0, hit - 0.03));
          g.vx = g.vy = g.vz = 0;
        } else {
          g.mesh.position.addScaledVector(grenadeStep, travel);
        }
      } else {
        g.mesh.position.add(grenadeStep);
      }
      if (g.mesh.position.y < 0.09) {
        g.mesh.position.y = 0.09;
        g.vx = g.vy = g.vz = 0;
      }
      g.mesh.rotation.x += dt * 9;
      g.mesh.rotation.z += dt * 6;
      this.grenades[liveGrenades++] = g;
    }
    this.grenades.length = liveGrenades;
  }
}
