export const PROTOCOL_VERSION = 3;

export const OP = {
  Join: 0x01,
  Input: 0x02,
  Fire: 0x03,
  Reload: 0x04,
  Grenade: 0x06,
  Switch: 0x08,
  Loadout: 0x09,
  RosterRequest: 0x0a,
  Welcome: 0x81,
  Snapshot: 0x82,
  Events: 0x83,
  Pong: 0x84,
  Self: 0x86,
  Roster: 0x87,
  Reject: 0x88,
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
  automatic: boolean;
  color: number;
  length: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 0, name: 'Glock-18', dmg: 20, headMult: 3.0, rpm: 400, mag: 20, reserve: 120, reloadMs: 1400, speedMult: 1.0, spread: 0.55, moveSpread: 1.5, automatic: false, color: 0x222225, length: 0.35 },
  { id: 1, name: 'Desert Eagle', dmg: 48, headMult: 2.3, rpm: 267, mag: 7, reserve: 35, reloadMs: 1800, speedMult: 0.98, spread: 0.35, moveSpread: 2.0, automatic: false, color: 0x9b9890, length: 0.42 },
  { id: 2, name: 'MP5-SD', dmg: 25, headMult: 3.0, rpm: 800, mag: 30, reserve: 120, reloadMs: 1800, speedMult: 0.98, spread: 0.9, moveSpread: 2.1, automatic: true, color: 0x34485a, length: 0.55 },
  { id: 3, name: 'AK-47', dmg: 33, headMult: 4.0, rpm: 600, mag: 30, reserve: 90, reloadMs: 2200, speedMult: 0.92, spread: 0.5, moveSpread: 1.8, automatic: true, color: 0x79502f, length: 0.75 },
  { id: 4, name: 'M4A4', dmg: 31, headMult: 3.6, rpm: 666, mag: 30, reserve: 90, reloadMs: 2100, speedMult: 0.92, spread: 0.45, moveSpread: 1.5, automatic: true, color: 0x3b463b, length: 0.75 },
  { id: 5, name: 'AWP', dmg: 108, headMult: 2.5, rpm: 41, mag: 5, reserve: 30, reloadMs: 2800, speedMult: 0.75, spread: 0.08, moveSpread: 3.5, automatic: false, color: 0x35463a, length: 1.05 },
  { id: 6, name: 'Knife', dmg: 34, headMult: 1.0, rpm: 150, mag: 0, reserve: 0, reloadMs: 0, speedMult: 1.08, spread: 0, moveSpread: 0, automatic: false, color: 0x777777, length: 0.3 },
];

export const KEY = {
  Forward: 1,
  Back: 2,
  Left: 4,
  Right: 8,
  Jump: 16,
  Crouch: 32,
  Aim: 64,
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
};
