export const PROTOCOL_VERSION = 5;

export const OP = {
  Join: 0x01,
  Input: 0x02,
  Fire: 0x03,
  Reload: 0x04,
  Grenade: 0x06,
  Switch: 0x08,
  Loadout: 0x09,
  RosterRequest: 0x0a,
  ToggleFlight: 0x0b,
  Welcome: 0x81,
  Snapshot: 0x82,
  Events: 0x83,
  Pong: 0x84,
  Self: 0x86,
  Roster: 0x87,
  Reject: 0x88,
  Maintenance: 0x89,
  Ping: 0xf0,
} as const;

export interface MapBlock {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  t: number;
}

export interface MapData {
  size: [number, number];
  blocks: MapBlock[];
  spawns: [number, number, number][];
}

export interface PlayerSnap {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  hp: number;
  armor: number;
  state: number;
  weapon: number;
  shot: number;
}

export interface RosterEntry {
  id: number;
  name: string;
  kills: number;
  deaths: number;
}

export interface WeaponDef {
  id: number;
  name: string;
  dmg: number;
  headMult: number;
  rpm: number;
  mag: number;
  reserve: number;
  reloadMs: number;
  speedMult: number;
  spread: number;
  moveSpread: number;
  bloom: number;
  adsFov: number;
  automatic: boolean;
  color: number;
  length: number;
  pellets?: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 0, name: 'Glock-18', dmg: 20, headMult: 3.0, rpm: 450, mag: 30, reserve: 180, reloadMs: 1400, speedMult: 1.0, spread: 0.36, moveSpread: 1.2, bloom: 0.12, adsFov: 68, automatic: false, color: 0x222225, length: 0.35 },
  { id: 1, name: 'Desert Eagle', dmg: 41, headMult: 2.3, rpm: 267, mag: 11, reserve: 53, reloadMs: 1800, speedMult: 0.98, spread: 0.22, moveSpread: 2.2, bloom: 0.36, adsFov: 64, automatic: false, color: 0x9b9890, length: 0.42 },
  { id: 2, name: 'MP5-SD', dmg: 22, headMult: 3.0, rpm: 800, mag: 45, reserve: 180, reloadMs: 1800, speedMult: 1.0, spread: 0.50, moveSpread: 1.45, bloom: 0.06, adsFov: 60, automatic: true, color: 0x34485a, length: 0.55 },
  { id: 3, name: 'AK-47', dmg: 28, headMult: 4.0, rpm: 600, mag: 45, reserve: 135, reloadMs: 2200, speedMult: 0.92, spread: 0.38, moveSpread: 2.0, bloom: 0.17, adsFov: 56, automatic: true, color: 0x79502f, length: 0.75 },
  { id: 4, name: 'M4A4', dmg: 26, headMult: 3.6, rpm: 666, mag: 45, reserve: 135, reloadMs: 2100, speedMult: 0.93, spread: 0.28, moveSpread: 1.65, bloom: 0.11, adsFov: 54, automatic: true, color: 0x3b463b, length: 0.75 },
  { id: 5, name: 'AWP', dmg: 92, headMult: 2.5, rpm: 32, mag: 8, reserve: 45, reloadMs: 2800, speedMult: 0.76, spread: 0.03, moveSpread: 4.8, bloom: 0, adsFov: 28, automatic: false, color: 0x35463a, length: 1.05 },
  { id: 6, name: 'Knife', dmg: 34, headMult: 1.0, rpm: 150, mag: 0, reserve: 0, reloadMs: 0, speedMult: 1.08, spread: 0, moveSpread: 0, bloom: 0, adsFov: 75, automatic: false, color: 0x777777, length: 0.3 },
  { id: 7, name: 'USP-S', dmg: 23, headMult: 2.4, rpm: 352, mag: 18, reserve: 36, reloadMs: 1700, speedMult: 1.0, spread: 0.16, moveSpread: 1.4, bloom: 0.22, adsFov: 66, automatic: false, color: 0x2a3340, length: 0.38 },
  { id: 8, name: 'UMP-45', dmg: 22, headMult: 2.6, rpm: 600, mag: 38, reserve: 150, reloadMs: 2100, speedMult: 0.97, spread: 0.68, moveSpread: 1.55, bloom: 0.10, adsFov: 58, automatic: true, color: 0x4a4036, length: 0.58 },
  { id: 9, name: 'FAMAS', dmg: 26, headMult: 3.2, rpm: 700, mag: 38, reserve: 135, reloadMs: 2200, speedMult: 0.94, spread: 0.36, moveSpread: 1.75, bloom: 0.14, adsFov: 54, automatic: true, color: 0x5a6848, length: 0.7 },
  { id: 10, name: 'AUG', dmg: 26, headMult: 3.4, rpm: 600, mag: 45, reserve: 135, reloadMs: 2300, speedMult: 0.88, spread: 0.27, moveSpread: 1.6, bloom: 0.12, adsFov: 44, automatic: true, color: 0x3d4a3a, length: 0.78 },
  { id: 11, name: 'SSG 08', dmg: 68, headMult: 2.4, rpm: 40, mag: 12, reserve: 120, reloadMs: 2600, speedMult: 0.80, spread: 0.05, moveSpread: 3.8, bloom: 0, adsFov: 32, automatic: false, color: 0x2f3a48, length: 1.0 },
  { id: 12, name: 'XM1014', dmg: 12, headMult: 1.2, rpm: 150, mag: 8, reserve: 36, reloadMs: 2600, speedMult: 0.93, spread: 3.2, moveSpread: 4.2, bloom: 0.40, adsFov: 68, automatic: false, color: 0x6a5a3a, length: 0.72, pellets: 6 },
];

export const isSniper = (id: number) => id === 5 || id === 11;
export const isPistol = (id: number) => id === 0 || id === 1 || id === 7;
export const isGun = (id: number) => id !== 6;
export const scopeSettleMs = (id: number) => id === 5 ? 320 : id === 11 ? 240 : 0;

export const KEY = {
  Forward: 1,
  Back: 2,
  Left: 4,
  Right: 8,
  Jump: 16,
  Crouch: 32,
  Aim: 64,
  Descend: 128,
} as const;

export const PHYS = {
  walkSpeed: 6.4,
  groundAccel: 44,
  stopAccel: 60,
  airAccel: 9.5,
  gravity: -22.0,
  jumpVel: 8.4,
  crouchSpeed: 0.6,
  eyeHeight: 1.6,
  crouchEye: 1.12,
  standingHeight: 1.8,
  crouchingHeight: 1.3,
  flightSpeed: 6.4,
  maxFlightHeight: 45,
};
