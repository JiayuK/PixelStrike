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
scene.fog = new THREE.Fog(0xa2d2f8, 50, 260);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
document.body.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xb4dcff, 0x5a7840, 0.75);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xfffae8, 1.25);
sun.position.set(110, 160, -150);
scene.add(sun);
scene.add(camera);

const hud = new Hud();
const audio = new AudioEngine();
const net = new Net();
const local = new LocalPlayer();
const remotes = new RemotePlayers(scene);
const particles = new ParticleSystem(scene);
const weapons = new Weapons(camera, scene);
weapons.onPlaySound = (name, vol, pitch) => audio.play(name, vol, pitch);
let world: WorldView | null = null;
let joined = false;
let alive = false;
let myName = '';
let killerId = -1;
let respawnAt = 0;
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
let crosshairScale = 1;
let activeSlot = 1;
let lastWeaponSlot = 1;
let grenadePrimed = false;
let userPrimaryChoice = -1;
let userSecondaryChoice = -1;
const PRIMARY_IDS = [3, 4, 2, 5];
const SECONDARY_IDS = [0, 1];

function resolveLoadout(p: number, s: number): { primary: number; secondary: number } {
  const actualPrimary = p === -1 ? PRIMARY_IDS[Math.floor(Math.random() * PRIMARY_IDS.length)] : p;
  const actualSecondary = s === -1 ? SECONDARY_IDS[Math.floor(Math.random() * SECONDARY_IDS.length)] : s;
  return { primary: actualPrimary, secondary: actualSecondary };
}

let primaryWeapon = 3;
let secondaryWeapon = 0;
const slotMags = [0, WEAPONS[3].mag, WEAPONS[0].mag, 0];
const slotReserves = [0, WEAPONS[3].reserve, WEAPONS[0].reserve, 0];
let cameraStepOffset = 0;
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
const eventVelocity = new THREE.Vector3();
const grenadeOrigin = new THREE.Vector3();
const grenadeVelocityVec = new THREE.Vector3();
const shotRight = new THREE.Vector3();
const shotUp = new THREE.Vector3();
const cameraCorrection = new THREE.Vector3();

function resize() {
  const ratio = hud.quality === 'low' ? 0.75 : hud.quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : 1;
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  crosshairScale = window.innerHeight * 0.5 / Math.tan(camera.fov * Math.PI / 360);
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

function resetInventory(primary: number, secondary: number) {
  primaryWeapon = primary;
  secondaryWeapon = secondary;
  slotMags[1] = WEAPONS[primary].mag;
  slotReserves[1] = WEAPONS[primary].reserve;
  slotMags[2] = WEAPONS[secondary].mag;
  slotReserves[2] = WEAPONS[secondary].reserve;
}

function refreshWeaponHud() {
  hud.setWeapon(weapons.weaponId, mag, reserve, nades, activeSlot);
  hud.setInventory(primaryWeapon, secondaryWeapon, activeSlot, slotMags, slotReserves, nades, grenadePrimed);
}

function grenadeVelocity(out: THREE.Vector3) {
  const cp = Math.cos(local.pitch);
  return out.set(-Math.sin(local.yaw) * cp * 22, Math.sin(local.pitch) * 22 + 3.2, -Math.cos(local.yaw) * cp * 22);
}
function clearCombatInput() {
  keys.clear();
  fireHeld = false;
  firePressed = false;
  grenadePrimed = false;
  stopAiming();
  weapons.resetMotion();
  if (joined && alive) net.sendInput(inputSeq++, 0, local.yaw, local.pitch);
  refreshWeaponHud();
}

function stopAiming() {
  aiming = false;
  aimStartedAt = 0;
  hud.setScope(false);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, select, textarea, button, a, [contenteditable="true"]');
}


function startReload(t = performance.now(), notifyServer = true) {
  if (!alive || activeSlot > 2 || weapons.isReloading(t) || !weapons.startReload(t, reserve)) return;
  if (notifyServer) net.sendReload();
  stopAiming();
}

function selectSlot(slot: number) {
  if (!joined || !alive || slot === activeSlot) return;
  if (slot === 4 ? nades <= 0 : slot < 1 || slot > 3) return;
  fireHeld = false;
  firePressed = false;
  weapons.nextFireAt = Math.max(weapons.nextFireAt, performance.now() + 220);
  if (slot === 4) {
    activeSlot = 4;
    grenadePrimed = false;
    stopAiming();
    weapons.cancelReload();
    weapons.group.visible = false;
    audio.play('weapon_switch', 0.7);
    refreshWeaponHud();
    return;
  }
  activeSlot = slot;
  lastWeaponSlot = slot;
  grenadePrimed = false;
  weapons.group.visible = true;
  stopAiming();
  weapons.cancelReload();
  net.switchSlot(slot);
  audio.play('weapon_switch', 0.7);
  refreshWeaponHud();
}

function primeGrenade() {
  if (activeSlot !== 4 || grenadePrimed || nades <= 0) return;
  grenadePrimed = true;
  audio.play('bolt_rack', 0.55);
  refreshWeaponHud();
}

function throwGrenade() {
  if (activeSlot !== 4 || !grenadePrimed || nades <= 0) return;
  grenadePrimed = false;
  nades--;
  grenadeOrigin.set(local.pos.x, local.eyeY(), local.pos.z);
  particles.spawnGrenade(net.yourId, grenadeOrigin, grenadeVelocity(grenadeVelocityVec));
  net.sendGrenade(local.yaw, local.pitch);
  activeSlot = lastWeaponSlot;
  weapons.group.visible = true;
  audio.play('weapon_switch', 0.7);
  refreshWeaponHud();
}
window.addEventListener('keydown', (e) => {
  const interactive = isInteractiveTarget(e.target);
  if (joined && (!interactive || e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code))) e.preventDefault();
  if (e.code === 'Escape' && joined) {
    e.preventDefault();
    if (!e.repeat) hud.toggleSettings();
    return;
  }
  if (!joined || interactive) return;
  if (e.metaKey || e.altKey || (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight')) return;
  if (e.code === 'Tab') {
    hud.toggleScoreboard(true);
    if (!e.repeat) net.requestRoster();
    return;
  }
  if (!alive) return;
  keys.add(e.code);
  if (e.repeat) return;
  if (/^Digit[1234]$/.test(e.code)) {
    selectSlot(+e.code.at(-1)!);
    return;
  }
  if (e.code === 'KeyR') {
    startReload();
    return;
  }
  if (e.code === 'KeyG') selectSlot(4);
}, { capture: true });

window.addEventListener('keyup', (e) => {
  if (joined && !isInteractiveTarget(e.target)) e.preventDefault();
  keys.delete(e.code);
  if (e.code === 'Tab') hud.toggleScoreboard(false);
}, { capture: true });

window.addEventListener('blur', clearCombatInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearCombatInput();
});

window.addEventListener('mousemove', (e) => {
  if (!alive || document.pointerLockElement !== renderer.domElement) return;
  if (e.buttons & 2) e.preventDefault();
  const mx = e.movementX;
  const my = e.movementY;
  const sens = aiming && weapons.weaponId === 5 ? hud.sensitivity * 0.45 : hud.sensitivity;
  local.yaw -= mx * sens;
  local.pitch = Math.max(-1.52, Math.min(1.52, local.pitch - my * sens));
  mouseX = Math.max(-240, Math.min(240, mouseX + Math.max(-150, Math.min(150, mx))));
  mouseY = Math.max(-240, Math.min(240, mouseY + Math.max(-150, Math.min(150, my))));
}, { capture: true, passive: false });

window.addEventListener('mousedown', (e) => {
  if (!joined) return;
  const interactive = isInteractiveTarget(e.target);
  if (!interactive || e.button !== 0) e.preventDefault();
  if (e.button === 2) e.stopPropagation();
  if (interactive) return;
  document.getSelection()?.removeAllRanges();
  if (!alive || hud.isSettingsOpen()) return;
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
    return;
  }
  if (activeSlot === 4) {
    if (e.button === 2) primeGrenade();
    else if (e.button === 0) throwGrenade();
    return;
  }
  if (e.button === 0) {
    fireHeld = true;
    firePressed = true;
  } else if (e.button === 2) {
    if (!aiming) aimStartedAt = performance.now();
    aiming = true;
    hud.setScope(weapons.weaponId === 5);
  }
}, { capture: true });

window.addEventListener('mouseup', (e) => {
  if (joined && (!isInteractiveTarget(e.target) || e.button !== 0)) e.preventDefault();
  if (e.button === 2) e.stopPropagation();
  if (e.button === 0) fireHeld = false;
  if (e.button === 2 && activeSlot !== 4) stopAiming();
}, { capture: true });

window.addEventListener('pointermove', (e) => {
  if (joined && e.pointerType === 'mouse' && e.buttons & 2) {
    e.preventDefault();
    e.stopPropagation();
  }
}, { capture: true, passive: false });
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopImmediatePropagation();
}, { capture: true });
document.addEventListener('auxclick', (e) => e.preventDefault(), { capture: true });
for (const type of ['selectstart', 'dragstart', 'copy', 'cut', 'paste', 'gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => {
    if (!isInteractiveTarget(e.target)) e.preventDefault();
  }, { capture: true });
}
window.addEventListener('wheel', (e) => {
  if (joined && alive && !hud.isSettingsOpen()) {
    e.preventDefault();
    if (e.deltaY > 0) {
      const next = activeSlot === 4 ? 1 : activeSlot + 1;
      selectSlot(next);
    } else if (e.deltaY < 0) {
      const prev = activeSlot === 1 ? 4 : activeSlot - 1;
      selectSlot(prev);
    }
  } else if (joined) {
    e.preventDefault();
  }
}, { capture: true, passive: false });

document.addEventListener('pointerlockchange', () => {
  const isLocked = document.pointerLockElement === renderer.domElement;
  if (!isLocked) clearCombatInput();
  else document.getSelection()?.removeAllRanges();
  if (joined && alive) hud.showPause(!isLocked && !hud.isSettingsOpen());
  else hud.showPause(false);
});

hud.onPauseClick(() => {
  if (joined && !hud.isSettingsOpen()) {
    renderer.domElement.requestPointerLock();
  }
});

hud.onJoin = (name, primary, secondary) => {
  myName = name;
  userPrimaryChoice = primary;
  userSecondaryChoice = secondary;
  const resolved = resolveLoadout(primary, secondary);
  primaryWeapon = resolved.primary;
  secondaryWeapon = resolved.secondary;
  weapons.build(primaryWeapon);
  resetInventory(primaryWeapon, secondaryWeapon);
  activeSlot = lastWeaponSlot = 1;
  grenadePrimed = false;
  mag = slotMags[1];
  reserve = slotReserves[1];
  nades = 1;
  weapons.ammoLocal = mag;
  weapons.group.visible = true;
  refreshWeaponHud();
  net.connect(wsUrl, name, primaryWeapon, secondaryWeapon);
  renderer.domElement.requestPointerLock();
  audio.init();
};

hud.onLoadoutChange = (p, s) => {
  userPrimaryChoice = p;
  userSecondaryChoice = s;
  const next = resolveLoadout(p, s);
  net.setLoadout(next.primary, next.secondary);
};
hud.onExit = () => {
  joined = false;
  alive = false;
  respawnAt = 0;
  clearCombatInput();
  net.disconnect();
  hud.exitMatch();
  for (const id of [...remotes.ids()]) remotes.remove(id);
  states.clear();
  roster.clear();
  names.clear();
};

hud.onSettingsClose = () => {
  if (joined && alive) renderer.domElement.requestPointerLock();
};

net.onWelcome = async (id, revision) => {
  if (joined) {
    for (const playerId of [...remotes.ids()]) remotes.remove(playerId);
    states.clear();
    roster.clear();
    names.clear();
  }
  joined = true;
  hud.hideDisconnect();
  if (!world) {
    try {
      const response = await fetch(`/map.json?v=${revision.toString(16)}`);
      if (!response.ok) throw new Error('map load failed');
      const map = (await response.json()) as MapData;
      world = new WorldView(scene, map);
      world.clouds.visible = hud.quality !== 'low';
      hud.setMap(map);
    } catch {
      joined = false;
      net.disconnect();
      hud.showDisconnect('地图加载失败，请刷新页面重试');
      return;
    }
  }
  renderer.domElement.requestPointerLock();
  names.set(id, myName);
};

net.onReject = (reason) => hud.showDisconnect(reason);
net.onDisconnect = () => {
  alive = false;
  respawnAt = 0;
  clearCombatInput();
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
      const wasAlive = alive;
      alive = !!(p.state & 1);
      if (wasAlive && !alive) {
        if (!respawnAt) respawnAt = now + 3000;
        weapons.group.visible = false;
      }
      const beforeX = local.pos.x, beforeY = local.pos.y, beforeZ = local.pos.z;
      local.reconcile(p.x, p.y, p.z, p.vx, p.vz, latencyMs, world?.boxes, !!(p.state & 8));
      cameraCorrection.x += beforeX - local.pos.x;
      cameraCorrection.y += beforeY - local.pos.y;
      cameraCorrection.z += beforeZ - local.pos.z;
      if (cameraCorrection.lengthSq() > 0.1225) cameraCorrection.setLength(0.35);
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
  if (s.slot === 1) primaryWeapon = s.weapon;
  else if (s.slot === 2) secondaryWeapon = s.weapon;
  if (s.slot === 1 || s.slot === 2) {
    slotMags[s.slot] = mag;
    slotReserves[s.slot] = reserve;
  }
  if (s.weapon !== weapons.weaponId) {
    weapons.cancelReload();
    weapons.build(s.weapon);
    local.weaponId = s.weapon;
    stopAiming();
  }
  weapons.ammoLocal = mag;
  refreshWeaponHud();
};

net.onRoster = (list) => {
  roster.clear();
  for (const p of list) {
    roster.set(p.id, p);
    names.set(p.id, p.name);
    if (p.id === net.yourId) myName = p.name;
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
      weapons.group.visible = false;
      respawnAt = performance.now() + 3000;
      clearCombatInput();
      killerId = e.killer ?? -1;
      const next = resolveLoadout(userPrimaryChoice, userSecondaryChoice);
      primaryWeapon = next.primary;
      secondaryWeapon = next.secondary;
      net.setLoadout(next.primary, next.secondary);
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
    respawnAt = 0;
    local.pos.set(...e.origin);
    local.vel.set(0, 0, 0);
    local.onGround = true;
    cameraEyeHeight = PHYS.eyeHeight;
    landingPenaltyUntil = 0;
    patternShots = 0;
    resetInventory(primaryWeapon, secondaryWeapon);
    activeSlot = lastWeaponSlot = 1;
    grenadePrimed = false;
    cameraStepOffset = 0;
    cameraCorrection.set(0, 0, 0);
    weapons.group.visible = true;
    refreshWeaponHud();
    if (!hud.isSettingsOpen() && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
    return;
  }
  if (e.type === 5) {
    // EvReloadStart
    if (e.player === net.yourId) startReload(performance.now(), false);
    else {
      const s = states.get(e.player ?? -1);
      if (s) playSpatial('reload_click', s.x, s.z, 0.42, 28);
    }
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
    const d = Math.hypot(e.origin[0] - local.pos.x, e.origin[2] - local.pos.z);
    if (d < 45) {
      screenShake = Math.max(screenShake, (1 - d / 45) * 0.18);
    }
    return;
  }
  if (e.type === 8 && e.player !== undefined && e.origin && e.dir) {
    // EvNadeThrow
    particles.spawnGrenade(e.player, eventOrigin.set(...e.origin), eventVelocity.set(...e.dir));
    if (e.player !== net.yourId) playSpatial('bolt_rack', e.origin[0], e.origin[2], 0.4, 30);
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
  if (s.weapon >= 6) {
    playSpatial('knife_slash', position.x, position.z, 0.55, 22);
    return;
  }
  if (!world) return;
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
      const feetY = local.pos.y;
      const canStand = !local.crouch || !!(local.keys & KEY.Crouch) || !world || canOccupy(world.boxes, local.pos, PHYS.standingHeight);
      local.update(step, canStand);
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
      if (wasGrounded && grounded && local.pos.y > feetY + 0.01) {
        cameraStepOffset = Math.max(-0.55, cameraStepOffset - (local.pos.y - feetY));
      }
      if (!wasGrounded && grounded) {
        landed = true;
        impactSpeed = Math.min(impactSpeed, fallSpeed);
      }
      remaining -= step;
    }
    if (landed) landingPenaltyUntil = t + 140;
    if (landed && impactSpeed < -5.5) {
      landingKick = Math.min(0.04, -impactSpeed * 0.004);
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

    const shouldFire = activeSlot !== 4 && ((WEAPONS[weapons.weaponId]?.automatic ?? false) ? fireHeld : firePressed);
    if (shouldFire && document.pointerLockElement === renderer.domElement) {
      if (weapons.canFire(t)) {
        fire(0, t);
      } else if (weapons.ammoLocal === 0 && !weapons.isReloading(t) && t >= weapons.nextFireAt && weapons.weaponId < 6) {
        if (reserve > 0) {
          startReload(t, true);
        } else {
          audio.play('empty_click', 0.65);
          weapons.nextFireAt = t + 280;
        }
      }
    }
    firePressed = false;
    landingKick *= Math.exp(-dt * 14);
    cameraStepOffset *= Math.exp(-dt * 10);
    cameraCorrection.multiplyScalar(Math.exp(-dt * 12));
    cameraEyeHeight += ((local.crouch ? PHYS.crouchEye : PHYS.eyeHeight) - cameraEyeHeight) * (1 - Math.exp(-dt * 18));
    camera.position.set(
      local.pos.x + cameraCorrection.x,
      local.pos.y + cameraEyeHeight + cameraCorrection.y + cameraStepOffset - landingKick,
      local.pos.z + cameraCorrection.z,
    );
    if (screenShake > 0) {
      const shake = screenShake * 0.18;
      camera.position.x += Math.sin(t * 0.035) * shake;
      camera.position.y += Math.sin(t * 0.051) * shake * 0.5;
      camera.position.z += Math.cos(t * 0.041) * shake;
      screenShake = Math.max(0, screenShake - dt * 0.7);
    }
    camera.rotation.y = local.yaw;
    camera.rotation.x = local.pitch;

    const targetFov = aiming ? (weapons.weaponId === 5 ? 32 : 58) : 75;
    const nextFov = camera.fov + (targetFov - camera.fov) * Math.min(1, dt * 14);
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
      crosshairScale = window.innerHeight * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    }

    weapons.animate(t, dt, moving && local.onGround, aiming, mouseX, mouseY, activeSlot !== 4);
    mouseX = 0;
    mouseY = 0;

    hud.updateRadar(local.pos.x, local.pos.z, local.yaw, t);
    hud.setReloading(activeSlot <= 2 && weapons.isReloading(t), weapons.getReloadProgress(t));
  } else if (joined && !alive) {
    deathCam();
  }

  hud.setDeathCountdown(joined && !alive && respawnAt ? Math.max(0, Math.ceil((respawnAt - t) / 1000)) : -1);
  const spread = joined && alive && activeSlot !== 4 && weapons.weaponId < 6 ? localSpread(t) : 0;
  hud.setCrosshair(Math.tan(spread * Math.PI / 180) * crosshairScale);

  remotes.update(t);
  particles.update(dt, t, world);
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
  if (activeSlot === 1 || activeSlot === 2) slotMags[activeSlot] = mag;
  refreshWeaponHud();
  if (weapons.weaponId < 6) {
    audio.play(fireSound(weapons.weaponId), 1, 1, 0, true);
    const dist = world?.raycastDistance(origin, dir, 180) ?? 180;
    weapons.spawnTracer(origin, dir, dist);
    if (dist < 180) {
      particles.spawnImpact(impactPoint.copy(origin).addScaledVector(dir, dist), impactNormal, 0xd6b36e, 4);
    }
    const climb = weapons.weaponId === 3 ? 0.028 : weapons.weaponId === 4 ? 0.022 : weapons.weaponId === 5 ? 0.045 : 0.012;
    local.pitch = Math.min(1.5, local.pitch + climb * (aiming ? 0.45 : 1.0));
  } else {
    weapons.onKnifeSlash();
    audio.play('knife_slash', 0.85);
    const dist = world?.raycastDistance(origin, dir, 2.0) ?? 2.0;
    if (dist < 2.0) {
      particles.spawnImpact(impactPoint.copy(origin).addScaledVector(dir, dist), impactNormal, 0xd6b36e, 3);
    }
  }
  if (mag === 0 && reserve > 0 && weapons.weaponId < 6) startReload(t, false);
}

function deathCam() {
  weapons.group.visible = false;
  const k = remotes.posOf(killerId);
  if (!k) return;
  const backDist = 3.5;
  const x = k.position.x - Math.sin(k.yaw) * backDist;
  const y = k.position.y + 1.8;
  const z = k.position.z - Math.cos(k.yaw) * backDist;
  camera.position.lerp(deathTarget.set(x, y, z), 0.1);
  const dx = k.position.x - camera.position.x;
  const dy = k.position.y + 1.2 - camera.position.y;
  const dz = k.position.z - camera.position.z;
  camera.rotation.y = Math.atan2(-dx, -dz);
  camera.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
}

function localSpread(t: number): number {
  const def = WEAPONS[weapons.weaponId];
  let spread = def.spread;
  if (local.vel.x * local.vel.x + local.vel.z * local.vel.z > 0.25) spread = def.moveSpread;
  if (!local.onGround) spread = Math.max(spread, def.moveSpread * 2.2 + 1);
  if (local.crouch) spread *= 0.6;
  if (t < landingPenaltyUntil) spread = Math.max(spread, def.moveSpread * 1.35);
  if (weapons.weaponId === 5 && (!aiming || t - aimStartedAt < 180)) spread = Math.max(spread, 3.5);
  return spread;
}

function remoteSpread(s: PlayerSnap): number {
  const def = WEAPONS[s.weapon];
  let spread = def.spread;
  if (s.vx * s.vx + s.vz * s.vz > 0.25) spread = def.moveSpread;
  if (!(s.state & 8)) spread = Math.max(spread, def.moveSpread * 2.2 + 1);
  if (s.state & 4) spread *= 0.6;
  if (s.weapon === 5 && !(s.state & 16)) spread = Math.max(spread, 3.5);
  return spread;
}

function shotDirection(out: THREE.Vector3, yaw: number, pitch: number, spread: number, shot: number, weapon: number): THREE.Vector3 {
  const cp = Math.cos(pitch);
  out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  if (spread <= 0) return out;
  let seed = (Math.imul(shot, 747796405) + Math.imul(weapon + 1, 2891336453)) >>> 0;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const radius = Math.sqrt(seed / 4294967296) * Math.tan(spread * Math.PI / 180);
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const angle = seed / 4294967296 * Math.PI * 2;
  shotRight.set(-out.z, 0, out.x).normalize();
  shotUp.crossVectors(shotRight, out);
  return out.addScaledVector(shotRight, Math.cos(angle) * radius).addScaledVector(shotUp, Math.sin(angle) * radius).normalize();
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
