import * as THREE from 'three';
import { WEAPONS } from './constants.js';

interface Shell {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  born: number;
}

interface Tracer { mesh: THREE.Mesh; born: number }

export class Weapons {
  group = new THREE.Group();
  tracers = new THREE.Group();
  shellsGroup = new THREE.Group();
  private gunMeshes: THREE.Object3D[] = [];
  private handsGroup = new THREE.Group();
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleLight = new THREE.PointLight(0xffdf88, 0, 6);
  private muzzleUntil = 0;

  // Viewmodel mechanics
  private recoil = 0;
  private bobT = 0;
  private shells: Shell[] = [];
  private shellPool: THREE.Mesh[] = [];
  private shellGeo = new THREE.BoxGeometry(0.02, 0.02, 0.05);
  private brassMat = new THREE.MeshLambertMaterial({ color: 0xd4af37 });
  private shellOffset = new THREE.Vector3(0.1, -0.05, -0.2);
  private shellSide = new THREE.Vector3();
  private activeTracers: Tracer[] = [];
  private tracerPool: THREE.Mesh[] = [];
  private tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffea78 });
  private tracerTarget = new THREE.Vector3();

  // Aim Down Sights (ADS)
  adsProgress = 0;

  // Client-side ammo & timing
  nextFireAt = 0;
  ammoLocal = WEAPONS[3].mag;
  reloadingUntil = 0;
  weaponId = 3;

  // Idle breath & sway
  swayX = 0;
  swayY = 0;

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    camera.add(this.group);
    scene.add(this.tracers);
    scene.add(this.shellsGroup);

    const flashGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.muzzleFlashMesh = new THREE.Mesh(
      flashGeo,
      new THREE.MeshBasicMaterial({ color: 0xffea78, transparent: true, opacity: 0.95 })
    );
    this.muzzleFlashMesh.visible = false;
    this.group.add(this.muzzleFlashMesh);
    this.group.add(this.muzzleLight);
    this.group.add(this.handsGroup);

    this.build(3);
  }

  build(id: number) {
    this.weaponId = id;
    for (const m of this.gunMeshes) {
      this.group.remove(m);
      disposeObject(m);
    }
    this.gunMeshes = [];
    for (const child of [...this.handsGroup.children]) {
      this.handsGroup.remove(child);
      disposeObject(child);
    }
    this.handsGroup.clear();

    const root = new THREE.Group();

    const darkMetal = new THREE.MeshLambertMaterial({ color: 0x1e1e22 });
    const gunmetal = new THREE.MeshLambertMaterial({ color: 0x38383e });
    const silverSteel = new THREE.MeshLambertMaterial({ color: 0x9999a3 });
    const cherryWood = new THREE.MeshLambertMaterial({ color: 0x7a3d1d });
    const greenCamo = new THREE.MeshLambertMaterial({ color: 0x354f38 });
    const darkGrip = new THREE.MeshLambertMaterial({ color: 0x121214 });
    const tacticalBlue = new THREE.MeshLambertMaterial({ color: 0x243e5e });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a377 });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x00a8aa });

    switch (id) {
      case 0: { // Glock-18
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.38), darkMetal);
        slide.position.set(0, 0.04, -0.06);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), silverSteel);
        barrel.position.set(0, 0.035, -0.26);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.06, 0.34), darkGrip);
        frame.position.set(0, -0.02, -0.05);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), darkGrip);
        grip.position.set(0, -0.13, 0.05);
        grip.rotation.x = 0.28;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.1), gunmetal);
        guard.position.set(0, -0.07, -0.07);

        root.add(slide, barrel, frame, grip, guard);
        this.muzzleLight.position.set(0, 0.04, -0.36);
        this.muzzleFlashMesh.position.set(0, 0.04, -0.36);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.13, 0.04);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.18, -0.35, 0.22);
        armR.rotation.set(0.7, -0.3, 0.2);
        this.handsGroup.add(handR, armR);
        break;
      }
      case 1: { // Desert Eagle
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.46), silverSteel);
        slide.position.set(0, 0.05, -0.08);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), silverSteel);
        barrel.position.set(0, 0.05, -0.35);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.4), silverSteel);
        frame.position.set(0, -0.02, -0.06);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.11), darkGrip);
        grip.position.set(0, -0.16, 0.06);
        grip.rotation.x = 0.32;

        root.add(slide, barrel, frame, grip);
        this.muzzleLight.position.set(0, 0.05, -0.45);
        this.muzzleFlashMesh.position.set(0, 0.05, -0.45);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.15, 0.05);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.2, -0.36, 0.24);
        armR.rotation.set(0.7, -0.3, 0.2);
        this.handsGroup.add(handR, armR);
        break;
      }
      case 2: { // MP5-SD
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.48), darkMetal);
        receiver.position.set(0, 0.04, -0.02);
        const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 12), tacticalBlue);
        suppressor.rotation.x = Math.PI / 2;
        suppressor.position.set(0, 0.03, -0.42);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.08), darkMetal);
        mag.position.set(0, -0.12, -0.08);
        mag.rotation.x = 0.35;
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.22), darkGrip);
        stock.position.set(0, 0.02, 0.32);

        root.add(receiver, suppressor, mag, stock);
        this.muzzleLight.position.set(0, 0.03, -0.62);
        this.muzzleFlashMesh.position.set(0, 0.03, -0.62);

        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.22, -0.32, 0.2);
        armR.rotation.set(0.65, -0.3, 0.2);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.24, -0.28, 0.05);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handsGroup.add(armR, armL);
        break;
      }
      case 3: { // AK-47
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.52), darkMetal);
        receiver.position.set(0, 0.04, -0.02);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.45), gunmetal);
        barrel.position.set(0, 0.05, -0.48);
        const gasTube = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), darkMetal);
        gasTube.position.set(0, 0.09, -0.36);
        const woodGuard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.26), cherryWood);
        woodGuard.position.set(0, 0.05, -0.36);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.12), darkMetal);
        mag.position.set(0, -0.14, -0.12);
        mag.rotation.x = 0.42;
        const woodStock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.34), cherryWood);
        woodStock.position.set(0, 0.01, 0.38);

        root.add(receiver, barrel, gasTube, woodGuard, mag, woodStock);
        this.muzzleLight.position.set(0, 0.05, -0.72);
        this.muzzleFlashMesh.position.set(0, 0.05, -0.72);

        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.24, -0.32, 0.2);
        armR.rotation.set(0.65, -0.3, 0.2);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.25, -0.28, 0.0);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handsGroup.add(armR, armL);
        break;
      }
      case 4: { // M4A4
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.48), darkMetal);
        receiver.position.set(0, 0.04, -0.02);
        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.32), gunmetal);
        handguard.position.set(0, 0.04, -0.38);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.35), silverSteel);
        barrel.position.set(0, 0.04, -0.58);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.09), darkGrip);
        mag.position.set(0, -0.13, -0.1);
        mag.rotation.x = 0.25;
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.28), darkGrip);
        stock.position.set(0, 0.02, 0.34);

        root.add(receiver, handguard, barrel, mag, stock);
        this.muzzleLight.position.set(0, 0.04, -0.76);
        this.muzzleFlashMesh.position.set(0, 0.04, -0.76);

        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.24, -0.32, 0.2);
        armR.rotation.set(0.65, -0.3, 0.2);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.25, -0.28, 0.0);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handsGroup.add(armR, armL);
        break;
      }
      case 5: { // AWP Heavy Sniper
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.65), greenCamo);
        body.position.set(0, 0.03, 0.0);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.75), darkMetal);
        barrel.position.set(0, 0.04, -0.65);
        const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.12), gunmetal);
        muzzleBrake.position.set(0, 0.04, -1.05);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 12), darkMetal);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.13, -0.05);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.11), darkMetal);
        mag.position.set(0, -0.09, -0.06);

        root.add(body, barrel, muzzleBrake, scope, mag);
        this.muzzleLight.position.set(0, 0.04, -1.12);
        this.muzzleFlashMesh.position.set(0, 0.04, -1.12);

        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.25, -0.32, 0.22);
        armR.rotation.set(0.65, -0.3, 0.2);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.25, -0.28, -0.05);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handsGroup.add(armR, armL);
        break;
      }
      default: { // Knife
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.32), silverSteel);
        blade.position.set(0, 0.02, -0.16);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.16), darkGrip);
        handle.position.set(0, 0.01, 0.08);
        root.add(blade, handle);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.02, 0.06);
        this.handsGroup.add(handR);
        break;
      }
    }

    this.gunMeshes.push(root);
    this.group.add(root);
  }

  canFire(t: number): boolean {
    return t >= this.nextFireAt && t >= this.reloadingUntil && this.ammoLocal > 0;
  }

  startReload(t: number) {
    const def = WEAPONS[this.weaponId] ?? WEAPONS[0];
    this.reloadingUntil = t + def.reloadMs;
    this.ammoLocal = def.mag;
  }

  onFired(t: number, origin: THREE.Vector3) {
    const def = WEAPONS[this.weaponId] ?? WEAPONS[0];
    this.nextFireAt = t + (60000 / def.rpm);
    this.ammoLocal = Math.max(0, this.ammoLocal - 1);
    this.recoil = Math.min(1.2, this.recoil + 0.45);

    this.muzzleFlashMesh.visible = true;
    this.muzzleLight.intensity = 2.5;
    this.muzzleUntil = t + 50;

    this.ejectShell(origin);
  }

  private ejectShell(origin: THREE.Vector3) {
    if (this.shells.length >= 24) return;
    const mesh = this.shellPool.pop() ?? new THREE.Mesh(this.shellGeo, this.brassMat);
    mesh.position.copy(origin).add(this.shellOffset);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(1);
    this.shellsGroup.add(mesh);

    const side = this.shellSide.set(1, 0.8, -0.2).normalize().applyQuaternion(this.group.quaternion);
    const speed = 2.0 + Math.random() * 1.5;

    this.shells.push({
      mesh,
      vx: side.x * speed,
      vy: side.y * speed,
      vz: side.z * speed,
      rotX: (Math.random() - 0.5) * 20,
      rotY: (Math.random() - 0.5) * 20,
      born: performance.now(),
    });
  }

  animate(t: number, dt: number, moving: boolean, isAiming: boolean, mouseDeltaX: number, mouseDeltaY: number) {
    if (this.weaponId === 5 && isAiming) {
      this.group.visible = false;
    } else {
      this.group.visible = true;
    }
    const targetAds = isAiming ? 1 : 0;
    this.adsProgress += (targetAds - this.adsProgress) * Math.min(1, dt * 14);

    this.swayX += (-mouseDeltaX * 0.0008 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (-mouseDeltaY * 0.0008 - this.swayY) * Math.min(1, dt * 10);

    if (moving && !isAiming) this.bobT += dt * 9;
    const bobFactor = 1 - this.adsProgress;
    const bobY = moving ? Math.sin(this.bobT) * 0.018 * bobFactor : Math.sin(t * 0.0018) * 0.003;
    const bobX = moving ? Math.cos(this.bobT * 0.5) * 0.01 * bobFactor : 0;

    this.recoil = Math.max(0, this.recoil - dt * 10);

    const rlRatio = this.reloadingUntil > t ? (this.reloadingUntil - t) / WEAPONS[this.weaponId].reloadMs : 0;
    const rlDip = rlRatio > 0 ? Math.sin(Math.PI * (1 - rlRatio)) * 0.24 : 0;

    const hipX = 0.28, hipY = -0.26, hipZ = -0.5;
    const adsX = 0.0, adsY = this.weaponId === 5 ? -0.17 : -0.15, adsZ = -0.38;

    const posX = hipX + (adsX - hipX) * this.adsProgress + bobX + this.swayX;
    const posY = hipY + (adsY - hipY) * this.adsProgress + bobY - rlDip + this.swayY;
    const posZ = hipZ + (adsZ - hipZ) * this.adsProgress + this.recoil * 0.09;

    this.group.position.set(posX, posY, posZ);
    this.group.rotation.x = this.recoil * 0.16 + rlDip * 0.7 - this.swayY * 1.5;
    this.group.rotation.y = -this.recoil * 0.03 + this.swayX * 1.5;

    if (t > this.muzzleUntil) {
      this.muzzleFlashMesh.visible = false;
      this.muzzleLight.intensity = 0;
    }

    const now = t;
    let aliveShells = 0;
    for (const sh of this.shells) {
      const age = now - sh.born;
      if (age > 1200) {
        this.shellsGroup.remove(sh.mesh);
        this.shellPool.push(sh.mesh);
        continue;
      }
      sh.vy -= 14 * dt;
      sh.mesh.position.x += sh.vx * dt;
      sh.mesh.position.y += sh.vy * dt;
      sh.mesh.position.z += sh.vz * dt;
      sh.mesh.rotation.x += sh.rotX * dt;
      sh.mesh.rotation.y += sh.rotY * dt;
      this.shells[aliveShells++] = sh;
    }
    this.shells.length = aliveShells;

    let aliveTracers = 0;
    for (const tracer of this.activeTracers) {
      if (now - tracer.born > 90) {
        this.tracers.remove(tracer.mesh);
        this.tracerPool.push(tracer.mesh);
        continue;
      }
      this.activeTracers[aliveTracers++] = tracer;
    }
    this.activeTracers.length = aliveTracers;
  }

  spawnTracer(origin: THREE.Vector3, dir: THREE.Vector3, dist: number) {
    if (this.activeTracers.length >= 64) return;
    const mesh = this.tracerPool.pop() ?? new THREE.Mesh(this.tracerGeo, this.tracerMat);
    mesh.position.copy(origin).addScaledVector(dir, dist / 2);
    mesh.scale.set(1, 1, dist);
    mesh.lookAt(this.tracerTarget.copy(origin).addScaledVector(dir, dist));
    this.tracers.add(mesh);
    this.activeTracers.push({ mesh, born: performance.now() });
  }
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) material.dispose();
  });
}
