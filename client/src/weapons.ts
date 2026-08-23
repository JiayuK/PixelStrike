import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WEAPONS } from './constants.js';
import type { SfxName } from './audio.js';

interface Shell {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  born: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  born: number;
}

interface SoundCue {
  time: number;
  name: SfxName;
  vol?: number;
  pitch?: number;
}

export type SoundCallback = (name: SfxName, volume?: number, pitch?: number) => void;

export class Weapons {
  group = new THREE.Group();
  tracers = new THREE.Group();
  shellsGroup = new THREE.Group();

  private gunMeshes: THREE.Object3D[] = [];
  private handsGroup = new THREE.Group();
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleLight = new THREE.PointLight(0xffdf88, 0, 6);
  private muzzleUntil = 0;

  // Animated sub-components for dynamic viewmodel reload
  private magazineMesh: THREE.Group | null = null;
  private boltMesh: THREE.Group | null = null;
  private handLGroup = new THREE.Group();
  private handRGroup = new THREE.Group();

  // Audio callback and scheduled sound cues
  public onPlaySound?: SoundCallback;
  private scheduledSounds: SoundCue[] = [];

  // Viewmodel mechanics
  private recoil = 0;
  private bobT = 0;
  private curBobX = 0;
  private curBobY = 0;
  private drawProgress = 1.0;
  private slashProgress = 0;
  private boltCycleStartedAt = 0;
  private boltCycleUntil = 0;
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
  reloadStartedAt = 0;
  reloadingUntil = 0;
  weaponId = 3;

  // Idle breath & sway
  swayX = 0;
  swayY = 0;

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    camera.add(this.group);
    this.group.scale.setScalar(0.86);
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

    this.handsGroup.add(this.handLGroup);
    this.handsGroup.add(this.handRGroup);
    this.group.add(this.handsGroup);

    this.build(3);
  }

  build(id: number) {
    this.weaponId = id;
    this.drawProgress = 0;
    this.slashProgress = 0;
    this.boltCycleStartedAt = 0;
    this.boltCycleUntil = 0;
    this.scheduledSounds = [];
    this.recoil = 0;
    this.adsProgress = 0;
    this.resetMotion();
    this.magazineMesh = null;
    this.boltMesh = null;

    for (const m of this.gunMeshes) {
      this.group.remove(m);
      disposeObject(m);
    }
    this.gunMeshes = [];
    for (const child of [...this.handLGroup.children]) {
      this.handLGroup.remove(child);
      disposeObject(child);
    }
    for (const child of [...this.handRGroup.children]) {
      this.handRGroup.remove(child);
      disposeObject(child);
    }
    this.handLGroup.clear();
    this.handRGroup.clear();
    this.handLGroup.position.set(0, 0, 0);
    this.handLGroup.rotation.set(0, 0, 0);
    this.handRGroup.position.set(0, 0, 0);
    this.handRGroup.rotation.set(0, 0, 0);

    const root = new THREE.Group();

    // High-definition tactical material palette
    const darkMetal = new THREE.MeshLambertMaterial({ color: 0x1b1b1e });
    const gunmetal = new THREE.MeshLambertMaterial({ color: 0x33363d });
    const silverSteel = new THREE.MeshLambertMaterial({ color: 0x9fa3ab });
    const chromeSteel = new THREE.MeshLambertMaterial({ color: 0xd2d6dc });
    const cherryWood = new THREE.MeshLambertMaterial({ color: 0x7a3a1a });
    const greenCamo = new THREE.MeshLambertMaterial({ color: 0x344d37 });
    const darkGrip = new THREE.MeshLambertMaterial({ color: 0x121316 });
    const tacticalBlue = new THREE.MeshLambertMaterial({ color: 0x223547 });
    const goldBrass = new THREE.MeshLambertMaterial({ color: 0xd4af37 });
    const tritiumGreen = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const redAccent = new THREE.MeshLambertMaterial({ color: 0xc92a2a });
    const whiteDot = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x182e3d, transparent: true, opacity: 0.85 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a177 });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x009ea2 });

    switch (id) {
      case 0: { // Glock-18 (Tactical Semi/Burst Pistol)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.055, 0.34), darkGrip);
        frame.position.set(0, -0.018, -0.05);

        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, 0.11), darkGrip);
        rail.position.set(0, -0.052, -0.16);

        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.12), silverSteel);
        barrel.position.set(0, 0.035, -0.26);

        const guideRod = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.08), silverSteel);
        guideRod.position.set(0, 0.01, -0.24);

        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.068, 0.11), darkGrip);
        guard.position.set(0, -0.07, -0.07);

        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.038, 0.025), redAccent);
        trigger.position.set(0, -0.062, -0.04);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.19, 0.095), darkGrip);
        grip.position.set(0, -0.13, 0.05);
        grip.rotation.x = 0.28;

        const gripStipple = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.075), darkMetal);
        gripStipple.position.set(0, -0.14, 0.055);
        gripStipple.rotation.x = 0.28;

        root.add(frame, rail, barrel, guideRod, guard, trigger, grip, gripStipple);

        // Slide group (moves during fire and reload)
        const slideGroup = new THREE.Group();
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.065, 0.36), darkMetal);
        slide.position.set(0, 0.04, -0.05);

        const frontSerr = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.038, 0.06), gunmetal);
        frontSerr.position.set(0, 0.04, -0.18);

        const rearSerr = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.042, 0.06), gunmetal);
        rearSerr.position.set(0, 0.04, 0.08);

        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.02), darkMetal);
        frontSight.position.set(0, 0.08, -0.21);
        const frontDot = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.004), tritiumGreen);
        frontDot.position.set(0, 0.082, -0.20);

        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.022, 0.02), darkMetal);
        rearSight.position.set(0, 0.08, 0.11);
        const dotL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.004), whiteDot);
        dotL.position.set(-0.014, 0.082, 0.10);
        const dotR = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.004), whiteDot);
        dotR.position.set(0.014, 0.082, 0.10);

        const ejectPort = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.028, 0.08), gunmetal);
        ejectPort.position.set(0.022, 0.055, -0.04);

        slideGroup.add(slide, frontSerr, rearSerr, frontSight, frontDot, rearSight, dotL, dotR, ejectPort);
        root.add(slideGroup);
        this.boltMesh = slideGroup;

        // Magazine group (moves during reload)
        const magGroup = new THREE.Group();
        const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.22, 0.076), darkMetal);
        magBody.position.set(0, -0.14, 0.05);
        magBody.rotation.x = 0.28;
        const magPad = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.028, 0.09), darkGrip);
        magPad.position.set(0, -0.24, 0.08);
        magPad.rotation.x = 0.28;
        magGroup.add(magBody, magPad);
        root.add(magGroup);
        this.magazineMesh = magGroup;

        this.muzzleLight.position.set(0, 0.04, -0.36);
        this.muzzleFlashMesh.position.set(0, 0.04, -0.36);

        // Hands (Right grip & Left support)
        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.13, 0.04);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.18, -0.35, 0.22);
        armR.rotation.set(0.7, -0.3, 0.2);
        this.handRGroup.add(handR, armR);

        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.13), skinMat);
        handL.position.set(-0.04, -0.14, 0.02);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.20, -0.34, 0.18);
        armL.rotation.set(0.68, 0.35, -0.2);
        this.handLGroup.add(handL, armL);
        break;
      }

      case 1: { // Desert Eagle .50 AE (Heavy Hand Cannon)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.075, 0.40), silverSteel);
        frame.position.set(0, -0.02, -0.06);

        const frontBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.086, 0.16), chromeSteel);
        frontBarrel.position.set(0, 0.05, -0.35);

        const compPorts = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.022, 0.045), darkMetal);
        compPorts.position.set(0, 0.065, -0.37);

        const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.045, 0.035), darkMetal);
        hammer.position.set(0, 0.035, 0.14);

        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.13), silverSteel);
        guard.position.set(0, -0.075, -0.09);

        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.035), darkMetal);
        trigger.position.set(0, -0.065, -0.06);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.23, 0.115), darkGrip);
        grip.position.set(0, -0.16, 0.06);
        grip.rotation.x = 0.32;

        const medallion = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.045, 0.045), goldBrass);
        medallion.position.set(0, -0.15, 0.065);
        medallion.rotation.x = 0.32;

        root.add(frame, frontBarrel, compPorts, hammer, guard, trigger, grip, medallion);

        // Slide group (Chrome slide)
        const slideGroup = new THREE.Group();
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.092, 0.44), chromeSteel);
        slide.position.set(0, 0.05, -0.08);

        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.018, 0.32), chromeSteel);
        topRail.position.set(0, 0.102, -0.08);

        const serr = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.065, 0.08), silverSteel);
        serr.position.set(0, 0.05, 0.10);

        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.025), darkMetal);
        frontSight.position.set(0, 0.105, -0.28);

        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.028, 0.025), darkMetal);
        rearSight.position.set(0, 0.105, 0.12);

        const safety = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.02, 0.04), darkMetal);
        safety.position.set(0, 0.07, 0.08);

        slideGroup.add(slide, topRail, serr, frontSight, rearSight, safety);
        root.add(slideGroup);
        this.boltMesh = slideGroup;

        // Magazine group
        const magGroup = new THREE.Group();
        const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.095), darkMetal);
        magBody.position.set(0, -0.16, 0.06);
        magBody.rotation.x = 0.32;
        const magPad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.028, 0.105), darkGrip);
        magPad.position.set(0, -0.28, 0.10);
        magPad.rotation.x = 0.32;
        magGroup.add(magBody, magPad);
        root.add(magGroup);
        this.magazineMesh = magGroup;

        this.muzzleLight.position.set(0, 0.05, -0.45);
        this.muzzleFlashMesh.position.set(0, 0.05, -0.45);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.15, 0.05);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.2, -0.36, 0.24);
        armR.rotation.set(0.7, -0.3, 0.2);
        this.handRGroup.add(handR, armR);

        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.13), skinMat);
        handL.position.set(-0.04, -0.16, 0.03);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.21, -0.35, 0.20);
        armL.rotation.set(0.68, 0.35, -0.2);
        this.handLGroup.add(handL, armL);
        break;
      }

      case 2: { // MP5-SD (Submachine Gun with Integral Suppressor)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.105, 0.44), darkMetal);
        receiver.position.set(0, 0.04, -0.02);

        // Suppressor barrel with knurled rubber sleeve
        const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.38, 16), tacticalBlue);
        suppressor.rotation.x = Math.PI / 2;
        suppressor.position.set(0, 0.03, -0.42);

        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.25, 16), darkGrip);
        sleeve.rotation.x = Math.PI / 2;
        sleeve.position.set(0, 0.03, -0.40);

        const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 16), silverSteel);
        muzzleRing.rotation.x = Math.PI / 2;
        muzzleRing.position.set(0, 0.03, -0.61);

        const cockingTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12), gunmetal);
        cockingTube.rotation.x = Math.PI / 2;
        cockingTube.position.set(0, 0.085, -0.25);

        const diopterSight = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 12), darkMetal);
        diopterSight.position.set(0, 0.105, 0.14);

        const hoodedFront = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), darkMetal);
        hoodedFront.position.set(0, 0.085, -0.48);

        const lowerGrip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.19, 0.085), darkGrip);
        lowerGrip.position.set(0, -0.13, 0.06);
        lowerGrip.rotation.x = 0.35;

        const selector = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.015, 0.03), redAccent);
        selector.position.set(0, -0.03, 0.03);

        const railL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.28), silverSteel);
        railL.position.set(-0.042, 0.03, 0.26);
        const railR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.28), silverSteel);
        railR.position.set(0.042, 0.03, 0.26);
        const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.035), darkGrip);
        buttpad.position.set(0, 0.02, 0.38);

        root.add(receiver, suppressor, sleeve, muzzleRing, cockingTube, diopterSight, hoodedFront, lowerGrip, selector, railL, railR, buttpad);

        // Charging handle (boltMesh)
        const boltGroup = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.035), silverSteel);
        handle.position.set(-0.035, 0.09, -0.38);
        boltGroup.add(handle);
        root.add(boltGroup);
        this.boltMesh = boltGroup;

        // Curved 30-round 9mm Banana Magazine
        const magGroup = new THREE.Group();
        const magUpper = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.15, 0.075), darkMetal);
        magUpper.position.set(0, -0.10, -0.08);
        magUpper.rotation.x = 0.35;
        const magLower = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.14, 0.075), darkMetal);
        magLower.position.set(0, -0.22, -0.03);
        magLower.rotation.x = 0.52;
        const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.02), silverSteel);
        paddle.position.set(0, -0.07, -0.04);
        magGroup.add(magUpper, magLower, paddle);
        root.add(magGroup);
        this.magazineMesh = magGroup;

        this.muzzleLight.position.set(0, 0.03, -0.62);
        this.muzzleFlashMesh.position.set(0, 0.03, -0.62);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.13, 0.05);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.22, -0.32, 0.2);
        armR.rotation.set(0.65, -0.3, 0.2);
        this.handRGroup.add(handR, armR);

        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.13), skinMat);
        handL.position.set(-0.01, 0.03, -0.38);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.24, -0.28, 0.05);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handLGroup.add(handL, armL);
        break;
      }

      case 3: { // AK-47 (Classic Tactical Assault Rifle)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.115, 0.46), darkMetal);
        receiver.position.set(0, 0.04, -0.02);

        const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.05, 0.36), gunmetal);
        dustCover.position.set(0, 0.095, 0.02);

        const selectorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.14), gunmetal);
        selectorPlate.position.set(0.048, 0.03, 0.02);

        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.45), gunmetal);
        barrel.position.set(0, 0.05, -0.48);

        const cleanRod = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.38), silverSteel);
        cleanRod.position.set(0, 0.025, -0.44);

        const gasTube = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.30), darkMetal);
        gasTube.position.set(0, 0.09, -0.36);

        const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.05), gunmetal);
        gasBlock.position.set(0, 0.075, -0.52);

        const woodUpper = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.055, 0.24), cherryWood);
        woodUpper.position.set(0, 0.092, -0.35);

        const woodLower = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.075, 0.26), cherryWood);
        woodLower.position.set(0, 0.045, -0.36);

        const woodGrip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.19, 0.085), cherryWood);
        woodGrip.position.set(0, -0.13, 0.06);
        woodGrip.rotation.x = 0.38;

        const woodStock = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.145, 0.35), cherryWood);
        woodStock.position.set(0, 0.01, 0.38);
        woodStock.rotation.x = -0.04;

        const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.15, 0.02), darkMetal);
        buttplate.position.set(0, 0.01, 0.55);

        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.085, 0.04), gunmetal);
        frontSight.position.set(0, 0.085, -0.66);

        const slantComp = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.04, 0.06), gunmetal);
        slantComp.position.set(0, 0.05, -0.72);

        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.11), gunmetal);
        rearSight.position.set(0, 0.11, -0.21);

        root.add(receiver, dustCover, selectorPlate, barrel, cleanRod, gasTube, gasBlock, woodUpper, woodLower, woodGrip, woodStock, buttplate, frontSight, slantComp, rearSight);

        // Bolt carrier group with charging handle (moves during fire and reload)
        const boltGroup = new THREE.Group();
        const boltCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.16), silverSteel);
        boltCarrier.position.set(0, 0.075, -0.04);
        const boltHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.025), silverSteel);
        boltHandle.position.set(0.065, 0.075, -0.04);
        boltGroup.add(boltCarrier, boltHandle);
        root.add(boltGroup);
        this.boltMesh = boltGroup;

        // Curved 30-round 7.62mm Steel Waffle Magazine
        const magGroup = new THREE.Group();
        const magUpper = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.18, 0.11), darkMetal);
        magUpper.position.set(0, -0.12, -0.11);
        magUpper.rotation.x = 0.38;
        const magLower = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.16, 0.11), darkMetal);
        magLower.position.set(0, -0.25, -0.04);
        magLower.rotation.x = 0.58;
        const magLatch = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, 0.025), gunmetal);
        magLatch.position.set(0, -0.06, -0.04);
        magGroup.add(magUpper, magLower, magLatch);
        root.add(magGroup);
        this.magazineMesh = magGroup;

        this.muzzleLight.position.set(0, 0.05, -0.72);
        this.muzzleFlashMesh.position.set(0, 0.05, -0.72);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.13, 0.05);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.24, -0.32, 0.2);
        armR.rotation.set(0.65, -0.3, 0.2);
        this.handRGroup.add(handR, armR);

        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.13), skinMat);
        handL.position.set(-0.01, 0.02, -0.34);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.25, -0.28, 0.0);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handLGroup.add(handL, armL);
        break;
      }

      case 4: { // M4A4 (Special Operations Carbine)
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.095, 0.38), darkMetal);
        upper.position.set(0, 0.04, -0.02);

        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.08, 0.34), darkMetal);
        lower.position.set(0, -0.04, -0.03);

        const deflector = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, 0.05), gunmetal);
        deflector.position.set(0.05, 0.05, 0.04);

        const assist = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.06), gunmetal);
        assist.position.set(0.05, 0.02, 0.08);

        const deltaRing = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.035, 16), gunmetal);
        deltaRing.rotation.x = Math.PI / 2;
        deltaRing.position.set(0, 0.04, -0.20);

        const quadRail = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.092, 0.34), gunmetal);
        quadRail.position.set(0, 0.04, -0.38);

        const railCovers = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.075, 0.26), darkGrip);
        railCovers.position.set(0, 0.04, -0.38);

        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.36), silverSteel);
        barrel.position.set(0, 0.04, -0.58);

        const a2Front = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), gunmetal);
        a2Front.position.set(0, 0.09, -0.66);

        const rearAperture = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.10), gunmetal);
        rearAperture.position.set(0, 0.105, 0.10);

        const birdcage = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.075), gunmetal);
        birdcage.position.set(0, 0.04, -0.76);

        const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.26, 12), silverSteel);
        bufferTube.rotation.x = Math.PI / 2;
        bufferTube.position.set(0, 0.03, 0.26);

        const craneStock = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.14, 0.26), darkGrip);
        craneStock.position.set(0, 0.02, 0.34);

        const a2Grip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.20, 0.09), darkGrip);
        a2Grip.position.set(0, -0.13, 0.06);
        a2Grip.rotation.x = 0.32;

        root.add(upper, lower, deflector, assist, deltaRing, quadRail, railCovers, barrel, a2Front, rearAperture, birdcage, bufferTube, craneStock, a2Grip);

        // Rear charging handle (boltMesh)
        const boltGroup = new THREE.Group();
        const chargingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.08), gunmetal);
        chargingHandle.position.set(0, 0.088, 0.17);
        boltGroup.add(chargingHandle);
        root.add(boltGroup);
        this.boltMesh = boltGroup;

        // Straight STANAG 30-round Magazine
        const magGroup = new THREE.Group();
        const stanagMag = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.28, 0.095), darkGrip);
        stanagMag.position.set(0, -0.13, -0.10);
        stanagMag.rotation.x = 0.25;
        magGroup.add(stanagMag);
        root.add(magGroup);
        this.magazineMesh = magGroup;

        this.muzzleLight.position.set(0, 0.04, -0.76);
        this.muzzleFlashMesh.position.set(0, 0.04, -0.76);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.13, 0.05);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.24, -0.32, 0.2);
        armR.rotation.set(0.65, -0.3, 0.2);
        this.handRGroup.add(handR, armR);

        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.13), skinMat);
        handL.position.set(-0.01, 0.03, -0.36);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.25, -0.28, 0.0);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handLGroup.add(handL, armL);
        break;
      }

      case 5: { // AWP (Heavy Precision Sniper Rifle)
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.125, 0.68), greenCamo);
        chassis.position.set(0, 0.03, 0.0);

        const thumbhole = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.38), greenCamo);
        thumbhole.position.set(0, 0.01, 0.38);

        const cheekRiser = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.18), darkGrip);
        cheekRiser.position.set(0, 0.10, 0.32);

        const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.16, 0.045), darkGrip);
        buttpad.position.set(0, 0.01, 0.58);

        const flutedBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.044, 0.78), darkMetal);
        flutedBarrel.position.set(0, 0.04, -0.65);

        const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.068, 0.14), gunmetal);
        muzzleBrake.position.set(0, 0.04, -1.05);

        // High-Magnification Sniper Optic Scope
        const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.26), darkMetal);
        scopeMount.position.set(0, 0.10, -0.05);

        const ringF = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 16), gunmetal);
        ringF.rotation.x = Math.PI / 2;
        ringF.position.set(0, 0.14, -0.14);

        const ringR = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 16), gunmetal);
        ringR.rotation.x = Math.PI / 2;
        ringR.position.set(0, 0.14, 0.04);

        const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.44, 16), darkMetal);
        scopeTube.rotation.x = Math.PI / 2;
        scopeTube.position.set(0, 0.14, -0.05);

        const objBell = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.038, 0.10, 16), darkMetal);
        objBell.rotation.x = Math.PI / 2;
        objBell.position.set(0, 0.14, -0.28);

        const objGlass = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.005), glassMat);
        objGlass.position.set(0, 0.14, -0.32);

        const ocularBell = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.08, 16), darkMetal);
        ocularBell.rotation.x = Math.PI / 2;
        ocularBell.position.set(0, 0.14, 0.18);

        const turretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.025, 12), gunmetal);
        turretTop.position.set(0, 0.18, -0.05);

        const turretSide = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.025, 12), gunmetal);
        turretSide.rotation.z = Math.PI / 2;
        turretSide.position.set(0.04, 0.14, -0.05);

        // Folded Bipod
        const bipodL = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.26), silverSteel);
        bipodL.position.set(-0.045, -0.03, -0.35);
        const bipodR = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.26), silverSteel);
        bipodR.position.set(0.045, -0.03, -0.35);

        root.add(chassis, thumbhole, cheekRiser, buttpad, flutedBarrel, muzzleBrake, scopeMount, ringF, ringR, scopeTube, objBell, objGlass, ocularBell, turretTop, turretSide, bipodL, bipodR);

        // Heavy Bolt Assembly
        const boltGroup = new THREE.Group();
        const boltBody = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.28), silverSteel);
        boltBody.position.set(0, 0.05, 0.02);
        const handleArm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.02, 0.02), silverSteel);
        handleArm.position.set(0.065, 0.065, 0.06);
        const handleKnob = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.032), silverSteel);
        handleKnob.position.set(0.09, 0.055, 0.06);
        boltGroup.add(boltBody, handleArm, handleKnob);
        root.add(boltGroup);
        this.boltMesh = boltGroup;

        // Heavy Box Magazine
        const magGroup = new THREE.Group();
        const boxMag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.22, 0.125), darkMetal);
        boxMag.position.set(0, -0.09, -0.06);
        magGroup.add(boxMag);
        root.add(magGroup);
        this.magazineMesh = magGroup;

        this.muzzleLight.position.set(0, 0.04, -1.12);
        this.muzzleFlashMesh.position.set(0, 0.04, -1.12);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.11, 0.06);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.25, -0.32, 0.22);
        armR.rotation.set(0.65, -0.3, 0.2);
        this.handRGroup.add(handR, armR);

        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.13), skinMat);
        handL.position.set(-0.01, -0.02, -0.28);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armL.position.set(-0.25, -0.28, -0.05);
        armL.rotation.set(0.6, 0.45, -0.3);
        this.handLGroup.add(handL, armL);
        break;
      }

      default: { // Knife (Tactical Combat Bayonet)
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.085, 0.34), silverSteel);
        blade.position.set(0, 0.02, -0.16);

        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, 0.32), chromeSteel);
        edge.position.set(0, -0.02, -0.16);

        const sawSpine = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.02, 0.14), gunmetal);
        sawSpine.position.set(0, 0.06, -0.10);

        const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.015, 0.20), darkMetal);
        fuller.position.set(0, 0.02, -0.15);

        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.03, 0.025), gunmetal);
        guard.position.set(0, 0.01, 0.01);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.068, 0.18), darkGrip);
        handle.position.set(0, 0.01, 0.10);

        const rivet1 = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.015), silverSteel);
        rivet1.position.set(0, 0.01, 0.06);
        const rivet2 = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.015), silverSteel);
        rivet2.position.set(0, 0.01, 0.13);

        const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.072, 0.03), silverSteel);
        pommel.position.set(0, 0.01, 0.20);

        root.add(blade, edge, sawSpine, fuller, guard, handle, rivet1, rivet2, pommel);

        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), skinMat);
        handR.position.set(0.01, -0.02, 0.08);
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), sleeveMat);
        armR.position.set(0.20, -0.32, 0.24);
        armR.rotation.set(0.7, -0.25, 0.2);
        this.handRGroup.add(handR, armR);
        break;
      }
    }
    if (this.magazineMesh) mergeMeshesByMaterial(this.magazineMesh);
    if (this.boltMesh) mergeMeshesByMaterial(this.boltMesh);
    mergeMeshesByMaterial(root, [this.magazineMesh, this.boltMesh]);

    for (const part of [root, this.handLGroup, this.handRGroup]) {
      part.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
          material.transparent = true;
          material.depthTest = false;
          material.depthWrite = false;
        }
        obj.renderOrder = 1000;
      });
    }

    this.gunMeshes.push(root);
    this.group.add(root);
  }
  canFire(t: number): boolean {
    if (this.weaponId === 6) {
      return t >= this.nextFireAt;
    }
    return t >= this.nextFireAt && t >= this.reloadingUntil && this.ammoLocal > 0;
  }

  startReload(t: number, reserve = 999): boolean {
    const def = WEAPONS[this.weaponId] ?? WEAPONS[0];
    if (this.weaponId >= 6 || reserve <= 0 || this.ammoLocal >= def.mag || this.isReloading(t)) return false;

    this.reloadStartedAt = t;
    this.reloadingUntil = t + def.reloadMs;
    this.nextFireAt = Math.max(this.nextFireAt, this.reloadingUntil);

    // Schedule high-definition synchronized reload sound cues
    const isPistol = this.weaponId === 0 || this.weaponId === 1;
    this.scheduledSounds = [
      { time: t + def.reloadMs * 0.18, name: 'mag_out', vol: 0.75 },
      { time: t + def.reloadMs * 0.54, name: 'mag_in', vol: 0.85 },
      { time: t + def.reloadMs * 0.78, name: isPistol ? 'reload_click' : 'bolt_cycle', vol: 0.82 },
    ];

    return true;
  }

  isReloading(t: number): boolean {
    return t < this.reloadingUntil;
  }

  getReloadProgress(t: number): number {
    if (!this.isReloading(t)) return 0;
    const def = WEAPONS[this.weaponId] ?? WEAPONS[0];
    const dur = def.reloadMs || 1800;
    return Math.max(0, Math.min(1, (t - this.reloadStartedAt) / dur));
  }

  cancelReload() {
    this.reloadStartedAt = 0;
    this.reloadingUntil = 0;
    this.scheduledSounds = [];
    this.boltCycleStartedAt = 0;
    this.boltCycleUntil = 0;
    if (this.magazineMesh) {
      this.magazineMesh.position.set(0, 0, 0);
      this.magazineMesh.rotation.set(0, 0, 0);
    }
    if (this.boltMesh) {
      this.boltMesh.position.set(0, 0, 0);
    }
    this.handLGroup.position.set(0, 0, 0);
    this.handRGroup.position.set(0, 0, 0);
    this.handRGroup.rotation.set(0, 0, 0);
  }

  onKnifeSlash() {
    this.slashProgress = 1.0;
  }

  resetMotion() {
    this.swayX = 0;
    this.swayY = 0;
    this.curBobX = 0;
    this.curBobY = 0;
  }

  onFired(t: number, origin: THREE.Vector3) {
    const def = WEAPONS[this.weaponId] ?? WEAPONS[0];
    const interval = 60000 / def.rpm;
    this.nextFireAt = this.nextFireAt > 0 && t - this.nextFireAt < interval ? this.nextFireAt + interval : t + interval;
    if (this.weaponId === 5) {
      this.boltCycleStartedAt = t;
      this.boltCycleUntil = this.nextFireAt;
      this.scheduledSounds.push({ time: t + interval * 0.28, name: 'bolt_cycle', vol: 0.9 });
    }
    if (this.weaponId === 6) return;
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

  animate(t: number, dt: number, moving: boolean, isAiming: boolean, mouseDeltaX: number, mouseDeltaY: number, equipped = true) {
    const reloading = this.isReloading(t);
    const rlProgress = reloading ? this.getReloadProgress(t) : 0;
    const boltProgress = this.weaponId === 5 && !reloading && t < this.boltCycleUntil
      ? Math.max(0, Math.min(1, (t - this.boltCycleStartedAt) / (this.boltCycleUntil - this.boltCycleStartedAt)))
      : 1;
    const awpBoltArc = boltProgress < 0.78 ? Math.sin(boltProgress / 0.78 * Math.PI) : 0;

    // Trigger scheduled audio cues exactly synchronized with visual animation
    if (this.scheduledSounds.length > 0) {
      let pending = 0;
      for (const s of this.scheduledSounds) {
        if (t >= s.time) {
          this.onPlaySound?.(s.name, s.vol, s.pitch);
        } else {
          this.scheduledSounds[pending++] = s;
        }
      }
      this.scheduledSounds.length = pending;
    }

    this.group.visible = equipped && !(this.weaponId === 5 && isAiming && !reloading);
    const targetAds = isAiming && !reloading ? 1 : 0;
    const adsRate = this.weaponId === 5 ? 4.5 : 14;
    this.adsProgress += (targetAds - this.adsProgress) * Math.min(1, dt * adsRate);

    this.swayX += (-mouseDeltaX * 0.00045 - this.swayX) * Math.min(1, dt * 16);
    this.swayY += (-mouseDeltaY * 0.00045 - this.swayY) * Math.min(1, dt * 16);
    const motionFactor = 1 - this.adsProgress;

    // Smooth weapon draw / deploy transition
    this.drawProgress = Math.min(1, this.drawProgress + dt * 5.5);
    const drawDip = Math.sin((1 - this.drawProgress) * Math.PI * 0.5);

    // Dynamic, wide tactical knife slash arc
    if (this.slashProgress > 0) {
      this.slashProgress = Math.max(0, this.slashProgress - dt * 4.2);
    }
    const slashPhase = this.slashProgress > 0 ? Math.sin((1 - this.slashProgress) * Math.PI) : 0;
    // Continuous, jitter-free viewmodel bobbing with target lerp
    if (moving && !isAiming && !reloading) this.bobT += dt * 6.2;
    const targetBobY = (moving && !isAiming && !reloading ? Math.sin(this.bobT) * 0.006 : Math.sin(t * 0.0018) * 0.0015) * (1 - this.adsProgress);
    const targetBobX = (moving && !isAiming && !reloading ? Math.cos(this.bobT * 0.5) * 0.0035 : 0) * (1 - this.adsProgress);
    this.curBobX += (targetBobX - this.curBobX) * Math.min(1, dt * 14);
    this.curBobY += (targetBobY - this.curBobY) * Math.min(1, dt * 14);

    this.recoil = Math.max(0, this.recoil - dt * 10);

    // Keep reload motion inside the viewmodel-safe area; animate parts, not the whole gun across the camera.
    const rlTilt = reloading ? Math.sin(Math.PI * rlProgress) : 0;
    const rlSeatImpulse = (rlProgress > 0.52 && rlProgress < 0.64) ? Math.sin((rlProgress - 0.52) * Math.PI / 0.12) * 0.026 : 0;
    const rlBoltCycle = (rlProgress > 0.68 && rlProgress < 0.84) ? Math.sin((rlProgress - 0.68) * Math.PI / 0.16) : 0;

    // Precision ADS alignment: sights sit precisely at center reticle without receiver body blocking view
    // Natural ADS position: Gun stays visible in lower third of screen, never blocking central reticle/sightline
    let hipX = 0.28, hipY = -0.26, hipZ = -0.72;
    let adsX = 0.08, adsY = -0.24, adsZ = -0.66;

    switch (this.weaponId) {
      case 0: // Glock-18
        hipX = 0.22; hipY = -0.20; hipZ = -0.58;
        adsX = 0.06; adsY = -0.20; adsZ = -0.54;
        break;
      case 1: // Desert Eagle
        hipX = 0.24; hipY = -0.22; hipZ = -0.60;
        adsX = 0.06; adsY = -0.22; adsZ = -0.56;
        break;
      case 2: // MP5-SD
        hipX = 0.26; hipY = -0.24; hipZ = -0.68;
        adsX = 0.07; adsY = -0.23; adsZ = -0.62;
        break;
      case 3: // AK-47
        hipX = 0.28; hipY = -0.26; hipZ = -0.72;
        adsX = 0.08; adsY = -0.24; adsZ = -0.66;
        break;
      case 4: // M4A4
        hipX = 0.28; hipY = -0.26; hipZ = -0.72;
        adsX = 0.08; adsY = -0.24; adsZ = -0.66;
        break;
      case 5: // AWP
        hipX = 0.30; hipY = -0.28; hipZ = -0.78;
        adsX = 0.08; adsY = -0.26; adsZ = -0.70;
        break;
      default: // Knife
        hipX = adsX = 0.26; hipY = adsY = -0.22; hipZ = adsZ = -0.58;
        break;
    }

    const posX = hipX + (adsX - hipX) * this.adsProgress + this.curBobX + this.swayX * motionFactor - rlTilt * 0.06 + slashPhase * 0.11;
    const posY = hipY + (adsY - hipY) * this.adsProgress + this.curBobY + this.swayY * motionFactor - rlTilt * 0.05 - rlSeatImpulse - drawDip * 0.12 + Math.sin(slashPhase * Math.PI) * 0.045;
    const posZ = hipZ + (adsZ - hipZ) * this.adsProgress + this.recoil * 0.06 + rlSeatImpulse * 0.3 - drawDip * 0.06 - slashPhase * 0.07;
    this.group.position.set(posX, posY, posZ);

    this.group.rotation.x = this.recoil * 0.12 + rlTilt * 0.16 - this.swayY * motionFactor + drawDip * 0.22 - slashPhase * 0.32 + rlBoltCycle * 0.10 - this.adsProgress * 0.04;
    this.group.rotation.y = -this.recoil * 0.02 + this.swayX * motionFactor + rlTilt * 0.10 + slashPhase * 0.48 - this.adsProgress * 0.02;
    this.group.rotation.z = -rlTilt * 0.30 - slashPhase * 0.20;
    if (this.magazineMesh) {
      if (reloading && rlProgress < 0.32) {
        const p = rlProgress / 0.32;
        this.magazineMesh.position.set(0, -p * p * 0.34, p * 0.04);
      } else if (reloading && rlProgress < 0.56) {
        const p = (rlProgress - 0.32) / 0.24;
        this.magazineMesh.position.set(0, -(1 - p) * (1 - p) * 0.34, (1 - p) * 0.04);
      } else {
        this.magazineMesh.position.set(0, 0, 0);
      }
      this.magazineMesh.rotation.set(0, 0, 0);
    }
    if (this.boltMesh) {
      const fireBlowback = Math.max(0, this.recoil) * 0.04;
      this.boltMesh.position.set(0, 0, fireBlowback + rlBoltCycle * 0.065 + awpBoltArc * 0.22);
      this.boltMesh.rotation.z = this.weaponId === 5 ? -awpBoltArc * 0.65 : 0;
    }
    if (reloading) {
      if (rlProgress < 0.32) {
        const p = rlProgress / 0.32;
        this.handLGroup.position.set(0, -p * 0.20, p * 0.04);
      } else if (rlProgress < 0.56) {
        const p = (rlProgress - 0.32) / 0.24;
        this.handLGroup.position.set(0, -(1 - p) * 0.20, (1 - p) * 0.04);
      } else if (rlProgress < 0.84) {
        const reach = Math.sin((rlProgress - 0.56) / 0.28 * Math.PI);
        this.handLGroup.position.set(-reach * 0.025, reach * 0.06, -reach * 0.08);
      } else {
        this.handLGroup.position.set(0, 0, 0);
      }
    } else {
      this.handLGroup.position.set(0, 0, 0);
    }
    if (this.weaponId === 5 && awpBoltArc > 0) {
      this.handRGroup.position.set(awpBoltArc * 0.07, awpBoltArc * 0.08, awpBoltArc * 0.16);
      this.handRGroup.rotation.z = -awpBoltArc * 0.35;
    } else {
      this.handRGroup.position.set(0, 0, 0);
      this.handRGroup.rotation.set(0, 0, 0);
    }
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

function mergeMeshesByMaterial(root: THREE.Object3D, excludedRoots: (THREE.Object3D | null)[] = []) {
  const excluded = new Set<THREE.Object3D>();
  for (const excludedRoot of excludedRoots) excludedRoot?.traverse((obj) => excluded.add(obj));
  root.updateWorldMatrix(true, true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const transform = new THREE.Matrix4();
  const groups = new Map<THREE.Material, { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[]>();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || excluded.has(obj) || Array.isArray(obj.material)) return;
    const geometry = obj.geometry.clone();
    geometry.applyMatrix4(transform.multiplyMatrices(inverseRoot, obj.matrixWorld));
    const entries = groups.get(obj.material) ?? [];
    entries.push({ mesh: obj, geometry });
    groups.set(obj.material, entries);
  });
  for (const [material, entries] of groups) {
    if (entries.length < 2) {
      entries[0].geometry.dispose();
      continue;
    }
    const merged = mergeGeometries(entries.map((entry) => entry.geometry), false);
    for (const entry of entries) entry.geometry.dispose();
    if (!merged) continue;
    for (const entry of entries) {
      entry.mesh.parent?.remove(entry.mesh);
      entry.mesh.geometry.dispose();
    }
    root.add(new THREE.Mesh(merged, material));
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
