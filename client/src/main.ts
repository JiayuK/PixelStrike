import * as THREE from 'three';
import { Net, type GameEvent } from './net.js';
import { WorldView, canOccupy, moveAABB } from './world.js';
import { LocalPlayer, RemotePlayers } from './player.js';
import { Weapons } from './weapons.js';
import { Hud } from './hud.js';
import { AudioEngine, type SfxName } from './audio.js';
import { ParticleSystem } from './particles.js';
import { KEY, PHYS, WEAPONS, type MapData, type PlayerSnap, type RosterEntry } from './constants.js';

const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = import.meta.env.VITE_WS_URL || `${proto}//${location.host}/ws`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8bc4f5);
scene.fog = new THREE.Fog(0xa2d2f8, 35, 175);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 360);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
document.body.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xb4dcff, 0x5a7840, 0.75);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xfffae8, 1.25);
sun.position.set(60, 95, -90);
scene.add(sun);
scene.add(camera);

const hud = new Hud();
const audio = new AudioEngine();
const net = new Net();
const local = new LocalPlayer();
const remotes = new RemotePlayers(scene);
const particles = new ParticleSystem(scene);
const weapons = new Weapons(camera, scene);

let world: WorldView | null = null;
let joined = false;
let alive = false;
let myName = '';
let killerId = -1;
let screenShake = 0;
let aiming = false;
let lastStep = 0;
let inputSeq = 0;
let shotSeq = 0;
let lastInput = 0;
const INPUT_INTERVAL = 1000 / 60;
let fireHeld = false;
let firePressed = false;
let mouseX = 0;
let mouseY = 0;
let mag = 30;
let reserve = 90;
let nades = 1;
let landingKick = 0;
let cameraEyeHeight = PHYS.eyeHeight;
let landingPenaltyUntil = 0;
let aimStartedAt = 0;
let patternShots = 0;
let lastPatternShot = 0;
let latencyMs = 0;
let serverOutboundBps = 0;

const states = new Map<number, PlayerSnap>();
const names = new Map<number, string>();
const roster = new Map<number, RosterEntry>();
remotes.nameOf = (id) => names.get(id) ?? `特战队员${id}`;
const deathTarget = new THREE.Vector3();
const remoteShotOrigin = new THREE.Vector3();
const remoteShotDir = new THREE.Vector3();
const localShotOrigin = new THREE.Vector3();
const localShotDir = new THREE.Vector3();
const impactPoint = new THREE.Vector3();
const impactNormal = new THREE.Vector3(0, 1, 0);
const eventOrigin = new THREE.Vector3();
const shotRight = new THREE.Vector3();
const shotUp = new THREE.Vector3();

function resize() {
  const ratio = hud.quality === 'low' ? 0.75 : hud.quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : 1;
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

hud.onQualityChange = (q) => {
  if (world) world.clouds.visible = q !== 'low';
  resize();
};
hud.onVolumeChange = (v) => audio.setVolume(v);
audio.setVolume(hud.volume);

const keys = new Set<string>();
function keyMask(): number {
  let k = 0;
  if (keys.has('KeyW')) k |= KEY.Forward;
  if (keys.has('KeyS')) k |= KEY.Back;
  if (keys.has('KeyA')) k |= KEY.Left;
  if (keys.has('KeyD')) k |= KEY.Right;
  if (keys.has('Space')) k |= KEY.Jump;
  if (keys.has('ControlLeft') || keys.has('ControlRight')) k |= KEY.Crouch;
  return k;
}

function stopAiming() {
  aiming = false;
  aimStartedAt = 0;
  hud.setScope(false);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Tab') {
    e.preventDefault();
    hud.toggleScoreboard(true);
    net.requestRoster();
    return;
  }
  if (!joined) return;
  if (/^Digit[123]$/.test(e.code)) {
    stopAiming();
    net.switchSlot(+e.code.at(-1)!);
    return;
  }
  if (e.code === 'KeyR') {
    net.sendReload();
    weapons.startReload(performance.now());
    audio.play('reload_click');
    return;
  }
  if (e.code === 'KeyG') {
    net.sendGrenade(local.yaw, local.pitch);
    audio.play('bolt_rack', 0.55);
    return;
  }
  if (e.code === 'Escape') {
    hud.toggleSettings();
    return;
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Tab') hud.toggleScoreboard(false);
});

window.addEventListener('blur', () => {
  keys.clear();
  fireHeld = false;
  stopAiming();
});

window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const mx = Math.max(-100, Math.min(100, e.movementX));
  const my = Math.max(-100, Math.min(100, e.movementY));
  const sens = aiming && weapons.weaponId === 5 ? hud.sensitivity * 0.45 : hud.sensitivity;
  local.yaw -= mx * sens;
  local.pitch = Math.max(-1.52, Math.min(1.52, local.pitch - my * sens));
  mouseX += mx;
  mouseY += my;
});

window.addEventListener('mousedown', (e) => {
  if (joined && !hud.isSettingsOpen() && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
  if (e.button === 0) {
    fireHeld = true;
    firePressed = true;
  }
  if (e.button === 2) {
    e.preventDefault();
    if (!aiming) aimStartedAt = performance.now();
    aiming = true;
    hud.setScope(weapons.weaponId === 5);
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) fireHeld = false;
  if (e.button === 2) {
    stopAiming();
  }
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
  const isLocked = document.pointerLockElement === renderer.domElement;
  if (joined && alive) {
    if (!isLocked && !hud.isSettingsOpen()) {
      hud.showPause(true);
    } else {
      hud.showPause(false);
    }
  } else {
    hud.showPause(false);
  }
});

hud.onPauseClick(() => {
  if (joined && !hud.isSettingsOpen()) {
    renderer.domElement.requestPointerLock();
  }
});

hud.onJoin = (name, primary, secondary) => {
  myName = name;
  weapons.build(primary);
  net.connect(wsUrl, name, primary, secondary);
  renderer.domElement.requestPointerLock();
  audio.init();
};

hud.onExit = () => {
  joined = false;
  alive = false;
  stopAiming();
  net.disconnect();
  hud.exitMatch();
  for (const id of [...remotes.ids()]) remotes.remove(id);
  states.clear();
  roster.clear();
  names.clear();
};

hud.onBotCountChange = (n) => net.setBots(n);
hud.onLoadoutChange = (p, s) => net.setLoadout(p, s);
hud.onSettingsClose = () => {
  if (joined && alive) renderer.domElement.requestPointerLock();
};

net.onWelcome = async (id, revision, admin) => {
  if (joined) {
    for (const playerId of [...remotes.ids()]) remotes.remove(playerId);
    states.clear();
    roster.clear();
    names.clear();
  }
  joined = true;
  hud.setAdmin(admin);
  hud.hideDisconnect();
  if (!world) {
    const response = await fetch(`/map.json?v=${revision.toString(16)}`);
    if (!response.ok) throw new Error('map load failed');
    const map = (await response.json()) as MapData;
    world = new WorldView(scene, map);
    world.clouds.visible = hud.quality !== 'low';
    hud.setMap(map);
  }
  renderer.domElement.requestPointerLock();
  names.set(id, myName);
};

net.onReject = (reason) => hud.showDisconnect(reason);
net.onDisconnect = () => {
  alive = false;
  stopAiming();
  hud.showDisconnect();
};
net.onLatency = (ms, outboundBps) => {
  latencyMs = ms;
  serverOutboundBps = outboundBps;
  hud.setNetworkStats(latencyMs, serverOutboundBps);
};

net.onSnapshot = (_tick, _ack, updates) => {
  const now = performance.now();
  for (const p of updates) {
    states.set(p.id, p);
    if (p.id === net.yourId) {
      alive = !!(p.state & 1);
      local.crouch = !!(p.state & 4);
      local.reconcile(p.x, p.y, p.z, p.vx, p.vz, latencyMs, world?.boxes);
      hud.setHp(p.hp);
      hud.setArmor(p.armor);
      hud.setSpawnShield(!!(p.state & 2));
      continue;
    }
    remotes.sample(p, now);
  }
};

net.onSelf = (s) => {
  mag = s.mag;
  reserve = s.reserve;
  nades = s.nades;
  if (s.weapon !== weapons.weaponId) {
    weapons.build(s.weapon);
    local.weaponId = s.weapon;
    stopAiming();
  }
  weapons.ammoLocal = mag;
  hud.setWeapon(s.weapon, mag, reserve, nades);
};

net.onRoster = (list) => {
  roster.clear();
  for (const p of list) {
    roster.set(p.id, p);
    names.set(p.id, p.name);
  }
  refreshScoreboard();
};

net.onEvents = (events) => {
  for (const e of events) handleEvent(e);
};

function handleEvent(e: GameEvent) {
  if (e.type === 0) {
    // EvKill
    const killer = nameOf(e.killer);
    const victim = nameOf(e.victim);
    const mine = e.killer === net.yourId || e.victim === net.yourId;
    hud.killFeedEntry(killer, victim, e.weapon ?? 3, e.headshot === 1, mine);
    const victimState = states.get(e.victim ?? -1);
    if (e.victim === net.yourId) audio.play('death', 0.65);
    else if (victimState) playSpatial('death', victimState.x, victimState.z, 0.35, 45);
    const k = roster.get(e.killer ?? -1);
    const v = roster.get(e.victim ?? -1);
    if (k) k.kills++;
    if (v) v.deaths++;
    refreshScoreboard();
    if (e.victim === net.yourId) {
      alive = false;
      fireHeld = false;
      stopAiming();
      killerId = e.killer ?? -1;
      hud.deathScreen(killer);
    }
    return;
  }
  if (e.type === 1) {
    // EvHit
    if (e.victim === net.yourId) {
      hud.damageFlash();
      audio.play('hurt', 0.7);
      screenShake = Math.max(screenShake, 0.05);
    }
    if (e.player === net.yourId) {
      const headshot = e.headshot === 1;
      hud.hitMarker(headshot);
      audio.play(headshot ? 'headshot_ding' : 'hitmarker', headshot ? 0.9 : 0.55);
      remotes.flashHit(e.victim ?? -1);
    }
    return;
  }
  if (e.type === 2 && e.player === net.yourId && e.origin) {
    // EvRespawn
    local.pos.set(...e.origin);
    local.vel.set(0, 0, 0);
    local.onGround = true;
    cameraEyeHeight = PHYS.eyeHeight;
    landingPenaltyUntil = 0;
    patternShots = 0;
    hud.respawned();
    return;
  }
  if (e.type === 5 && e.player !== net.yourId) {
    // EvReloadStart
    const s = states.get(e.player ?? -1);
    if (s) playSpatial('reload_click', s.x, s.z, 0.42, 28);
    return;
  }
  if (e.type === 6 && e.player && e.name) {
    // EvPlayerName
    names.set(e.player, e.name);
    return;
  }
  if (e.type === 7 && e.origin) {
    // EvExplosion
    particles.spawnExplosion(eventOrigin.set(...e.origin));
    playSpatial('grenade_explode', e.origin[0], e.origin[2], 0.9, 95);
    return;
  }
  if (e.type === 8 && e.player !== net.yourId) {
    // EvNadeThrow
    const s = states.get(e.player ?? -1);
    if (s) playSpatial('bolt_rack', s.x, s.z, 0.4, 30);
    return;
  }
  if (e.type === 9 && e.player) {
    // EvPlayerLeave
    remotes.remove(e.player);
    states.delete(e.player);
    roster.delete(e.player);
    names.delete(e.player);
    net.forget(e.player);
    refreshScoreboard();
    return;
  }
}

function nameOf(id?: number): string {
  return id === net.yourId ? myName : names.get(id ?? -1) ?? `特战队员${id ?? '?'}`;
}

function refreshScoreboard() {
  hud.updateScoreboard([...roster.values()], states, net.yourId);
}

remotes.onShot = (s, position) => {
  if (!world || s.weapon >= 6) return;
  const o = remoteShotOrigin.set(position.x, position.y + (s.state & 4 ? 1.12 : 1.6), position.z);
  const d = shotDirection(remoteShotDir, s.yaw, s.pitch, remoteSpread(s), s.shot, s.weapon);
  const dist = world.raycastDistance(o, d, 180);
  weapons.spawnTracer(o, d, dist);
  playSpatial(fireSound(s.weapon), position.x, position.z, 0.65, 120);
};

remotes.onStep = (position) => playSpatial('step', position.x, position.z, 0.16, 26, 0.92);

let prev = performance.now();
function frame(t: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - prev) / 1000);
  prev = t;

  if (joined && alive) {
    local.keys = keyMask();
    let remaining = dt;
    let landed = false;
    let impactSpeed = 0;
    while (remaining > 0.00001) {
      const step = Math.min(1 / 60, remaining);
      const wasGrounded = local.onGround;
      local.update(step, !world || canOccupy(world.boxes, local.pos, PHYS.standingHeight));
      const fallSpeed = local.vel.y;
      let grounded = false;
      if (world) grounded = moveAABB(local.pos, local.vel, step, world.boxes, local.height(), local.onGround);
      else local.pos.addScaledVector(local.vel, step);
      if (local.pos.y < 0) {
        local.pos.y = 0;
        local.vel.y = 0;
        grounded = true;
      }
      local.onGround = grounded;
      if (!wasGrounded && grounded) {
        landed = true;
        impactSpeed = Math.min(impactSpeed, fallSpeed);
      }
      remaining -= step;
    }
    if (landed) landingPenaltyUntil = t + 140;
    if (landed && impactSpeed < -4) {
      landingKick = Math.min(0.08, -impactSpeed * 0.006);
      audio.play('step', 0.22, 0.82);
    }

    const moving = !!(local.keys & (KEY.Forward | KEY.Back | KEY.Left | KEY.Right));
    if (moving && local.onGround && !local.crouch && t - lastStep > 390) {
      lastStep = t;
      audio.play('step', 0.18, 0.92 + Math.random() * 0.16);
    }

    if (t - lastInput >= INPUT_INTERVAL) {
      lastInput = t - ((t - lastInput) % INPUT_INTERVAL);
      net.sendInput(inputSeq++, local.keys | (aiming ? KEY.Aim : 0), local.yaw, local.pitch);
    }

    const shouldFire = (WEAPONS[weapons.weaponId]?.automatic ?? false) ? fireHeld : firePressed;
    if (shouldFire && document.pointerLockElement === renderer.domElement && weapons.canFire(t)) {
      fire(0, t);
    }
    firePressed = false;

    landingKick *= Math.exp(-dt * 14);
    cameraEyeHeight += ((local.crouch ? PHYS.crouchEye : PHYS.eyeHeight) - cameraEyeHeight) * (1 - Math.exp(-dt * 18));
    camera.position.set(local.pos.x, local.pos.y + cameraEyeHeight - landingKick, local.pos.z);
    if (screenShake > 0) {
      camera.position.x += (Math.random() - 0.5) * screenShake;
      camera.position.y += (Math.random() - 0.5) * screenShake;
      camera.position.z += (Math.random() - 0.5) * screenShake;
      screenShake = Math.max(0, screenShake - dt * 0.4);
    }
    camera.rotation.y = local.yaw;
    camera.rotation.x = local.pitch;

    weapons.animate(t, dt, moving && local.onGround, aiming, mouseX, mouseY);
    mouseX = 0;
    mouseY = 0;

    hud.updateRadar(local.pos.x, local.pos.z, local.yaw, t);
  } else if (joined && !alive) {
    deathCam();
  }

  const spray = t - lastPatternShot < 420 ? patternShots : 0;
  hud.setCrosshair(joined && alive && weapons.weaponId < 6 ? localSpread(t) * 2.2 + Math.min(12, spray) * 0.55 : 0);

  remotes.update(t);
  particles.update(dt, t);
  world?.animate(t);
  renderer.render(scene, camera);
  remotes.updateLabels(camera, world);
}
requestAnimationFrame(frame);

function fire(mode: number, t: number) {
  const origin = localShotOrigin.set(local.pos.x, local.eyeY(), local.pos.z);
  if (t - lastPatternShot > 420) patternShots = 0;
  lastPatternShot = t;
  patternShots++;
  const dir = shotDirection(localShotDir, local.yaw, local.pitch, localSpread(t), patternShots, weapons.weaponId);
  weapons.onFired(t, origin);
  net.sendFire(++shotSeq, net.lastServerTick, mode | (aiming ? 0x80 : 0), local.yaw, local.pitch);
  mag = weapons.ammoLocal;
  hud.setWeapon(weapons.weaponId, mag, reserve, nades);
  if (weapons.weaponId < 6) {
    audio.play(fireSound(weapons.weaponId), 1, 1, 0, true);
    const dist = world?.raycastDistance(origin, dir, 180) ?? 180;
    weapons.spawnTracer(origin, dir, dist);
    if (dist < 180) {
      particles.spawnImpact(impactPoint.copy(origin).addScaledVector(dir, dist), impactNormal, 0xd6b36e, 4);
    }
    const climb = weapons.weaponId === 3 ? 0.028 : weapons.weaponId === 4 ? 0.022 : weapons.weaponId === 5 ? 0.045 : 0.012;
    local.pitch = Math.min(1.5, local.pitch + climb * (aiming ? 0.45 : 1.0));
  }
}

function deathCam() {
  const k = remotes.posOf(killerId);
  if (!k) return;
  const x = k.position.x + Math.sin(k.yaw) * 2.5;
  const z = k.position.z + Math.cos(k.yaw) * 2.5;
  camera.position.lerp(deathTarget.set(x, k.position.y + 2.2, z), 0.08);
  const dx = k.position.x - camera.position.x;
  const dy = k.position.y + 1.3 - camera.position.y;
  const dz = k.position.z - camera.position.z;
  camera.rotation.y = Math.atan2(-dx, -dz);
  camera.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
}

function localSpread(t: number): number {
  const def = WEAPONS[weapons.weaponId];
  let spread = def.spread;
  if (local.vel.x * local.vel.x + local.vel.z * local.vel.z > 0.25) spread = def.moveSpread;
  if (!local.onGround) spread = Math.max(spread, def.moveSpread * 2.2 + 1);
  if (local.crouch) spread *= 0.78;
  if (t < landingPenaltyUntil) spread = Math.max(spread, def.moveSpread * 1.35);
  if (weapons.weaponId === 5 && (!aiming || t - aimStartedAt < 180)) spread = Math.max(spread, 3.5);
  return spread;
}

function remoteSpread(s: PlayerSnap): number {
  const def = WEAPONS[s.weapon];
  let spread = def.spread;
  if (s.vx * s.vx + s.vz * s.vz > 0.25) spread = def.moveSpread;
  if (!(s.state & 8)) spread = Math.max(spread, def.moveSpread * 2.2 + 1);
  if (s.state & 4) spread *= 0.78;
  if (s.weapon === 5 && !(s.state & 16)) spread = Math.max(spread, 3.5);
  return spread;
}

function shotDirection(out: THREE.Vector3, yaw: number, pitch: number, spread: number, shot: number, weapon: number): THREE.Vector3 {
  const cp = Math.cos(pitch);
  out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  if (spread <= 0) return out;
  const rad = spread * Math.PI / 180;
  shotRight.set(-out.z, 0, out.x).normalize();
  shotUp.crossVectors(shotRight, out);
  const a = Math.sin(shot * 17 + weapon * 31) * rad * 0.72;
  const b = Math.cos(shot * 11 + weapon * 7) * rad + Math.max(0, shot - 1) * rad * 0.08;
  return out.addScaledVector(shotRight, a).addScaledVector(shotUp, b).normalize();
}

function playSpatial(name: SfxName, x: number, z: number, volume: number, maxDistance: number, pitch = 1) {
  const dx = x - local.pos.x;
  const dz = z - local.pos.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= maxDistance) return;
  const attenuation = 1 - distance / maxDistance;
  const pan = distance > 0.01 ? (dx * Math.cos(local.yaw) - dz * Math.sin(local.yaw)) / distance : 0;
  audio.play(name, volume * attenuation, pitch, pan);
}

const sounds: Record<number, SfxName> = {
  0: 'fire_glock',
  1: 'fire_deagle',
  2: 'fire_mp5',
  3: 'fire_ak47',
  4: 'fire_m4a4',
  5: 'fire_awp',
};

function fireSound(id: number): SfxName {
  return sounds[id] ?? 'fire_ak47';
}
