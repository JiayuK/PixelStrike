import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Voxel particle burst system for authentic retro impact debris and sparks.

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  born: number;
  life: number;
}

export class ParticleSystem {
  group = new THREE.Group();
  private particles: Particle[] = [];
  private pool: THREE.Mesh[] = [];
  private geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Spawn voxel debris on bullet hitting a surface */
  spawnImpact(pos: THREE.Vector3, normal: THREE.Vector3, color = 0xd6b36e, count = 8) {
    count = Math.min(count, Math.max(0, 256 - this.particles.length));
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      let mesh = this.pool.pop();
      if (!mesh) {
        mesh = new THREE.Mesh(this.geo, new THREE.MeshLambertMaterial());
      }
      (mesh.material as THREE.MeshLambertMaterial).color.setHex(color);
      mesh.position.copy(pos);
      mesh.scale.setScalar(1);
      mesh.visible = true;
      this.group.add(mesh);

      // Eject in normal hemisphere with randomized spread
      const speed = 2.5 + Math.random() * 4.5;
      const rx = (Math.random() - 0.5) * 1.5;
      const ry = (Math.random() - 0.5) * 1.5;
      const rz = (Math.random() - 0.5) * 1.5;

      this.particles.push({
        mesh,
        vx: (normal.x + rx) * speed,
        vy: Math.abs(normal.y + ry) * speed + 1.5,
        vz: (normal.z + rz) * speed,
        born: now,
        life: 400 + Math.random() * 300,
      });
    }
  }
  /** Spawn explosion fire and smoke voxel cloud */
  spawnExplosion(pos: THREE.Vector3) {
    this.spawnImpact(pos, UP, 0xff4400, 16);
    this.spawnImpact(pos, UP, 0xffcc00, 12);
    this.spawnImpact(pos, UP, 0x555555, 10);
  }

  update(dt: number, now = performance.now()) {
    let alive = 0;

    for (const p of this.particles) {
      const age = now - p.born;
      if (age > p.life) {
        p.mesh.visible = false;
        this.group.remove(p.mesh);
        this.pool.push(p.mesh);
        continue;
      }
      p.vy -= 18.0 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const scale = Math.max(0.1, 1 - age / p.life);
      p.mesh.scale.setScalar(scale);

      this.particles[alive++] = p;
    }
    this.particles.length = alive;
  }
}
