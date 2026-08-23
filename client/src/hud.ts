import { WEAPONS, type MapData, type PlayerSnap, type RosterEntry } from './constants.js';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

const WEAPON_BADGES: Record<number, string> = {
  0: 'GLOCK-18',
  1: 'DEAGLE',
  2: 'MP5-SD',
  3: 'AK-47',
  4: 'M4A4',
  5: 'AWP',
  6: 'KNIFE',
};

const BLOCK_RADAR_COLORS: Record<number, string> = {
  0: '#385e2b',
  1: '#5c5e58',
  2: '#7d5830',
  3: '#8c949c',
  4: '#4a4d46',
  5: '#2d5422',
  6: '#a89d6e',
  7: '#6e3028',
  8: '#d49b28',
  9: '#181226',
  10: '#754b28',
  11: '#7ab3cf',
  12: '#2a5ebd',
  13: '#6e4f35',
};

export class Hud {
  root = el('hud');
  sensitivity = 0.00216;
  volume = 0.8;
  quality: 'low' | 'medium' | 'high' = 'medium';
  botCount = 6;
  private loadoutPrimary = 3;
  private loadoutSecondary = 0;

  onJoin: ((name: string, primary: number, secondary: number) => void) | null = null;
  onVolumeChange: ((v: number) => void) | null = null;
  onQualityChange: ((q: 'low' | 'medium' | 'high') => void) | null = null;
  onExit: (() => void) | null = null;
  onBotCountChange: ((n: number) => void) | null = null;
  onLoadoutChange: ((p: number, s: number) => void) | null = null;
  onSettingsClose: (() => void) | null = null;

  private menu = el('menu');
  private scoreboard = el('scoreboard');
  private settings = el('settings-modal');
  private pause = el('pause-overlay');
  private death = el('death-overlay');
  private disconnect = el('disconnect-overlay');
  private killfeed = el('killfeed');
  private hit = el('hitmarker');
  private crosshair = el('crosshair');
  private damage = el('damage-flash');
  private scope = el('sniper-scope');
  private radar = el('radar') as HTMLCanvasElement;
  private radarBase = document.createElement('canvas');

  private map: MapData | null = null;
  private lastRadar = 0;
  private hitTimer = 0;
  private damageTimer = 0;
  private lastHp = -1;
  private lastArmor = -1;
  private lastWeapon = '';
  private lastNetwork = '';
  private lastShield = false;
  private lastCrosshair = -1;
  private respawnTimer = 0;

  constructor() {
    const name = el('name-input') as HTMLInputElement;
    const primary = el('primary-select') as HTMLSelectElement;
    const secondary = el('secondary-select') as HTMLSelectElement;
    // Restore username and loadout.
    const savedName = localStorage.getItem('pixel_strike_name') || getCookie('ps_name');
    if (savedName && name) {
      name.value = savedName;
    }
    const savedPrimary = localStorage.getItem('pixel_strike_primary');
    if (savedPrimary && primary) {
      primary.value = savedPrimary;
    }
    const savedSecondary = localStorage.getItem('pixel_strike_secondary');
    if (savedSecondary && secondary) {
      secondary.value = savedSecondary;
    }
    name.addEventListener('input', () => {
      const val = name.value.trim();
      if (val) {
        localStorage.setItem('pixel_strike_name', val);
        setCookie('ps_name', val, 365);
      }
    });

    const updateWeaponSpecs = (id: number) => {
      const weapon = WEAPONS[id];
      const tag = el('weapon-spec-tag');
      const dmgVal = el('spec-dmg-val');
      const rpmVal = el('spec-rpm-val');
      const headVal = el('spec-head-val');
      const magVal = el('spec-mag-val');
      if (!weapon || !tag) return;
      tag.textContent = `${weapon.name.toUpperCase()} / ${id === 5 ? '重型狙击' : id === 2 ? '微声冲锋' : '突击步枪'}`;
      dmgVal.textContent = String(weapon.dmg);
      rpmVal.textContent = `${weapon.rpm} RPM`;
      headVal.textContent = `${weapon.headMult.toFixed(1)} ×`;
      magVal.textContent = `${weapon.mag} / ${weapon.reserve}`;
    };

    if (primary) {
      updateWeaponSpecs(+primary.value);
      primary.addEventListener('change', () => {
        localStorage.setItem('pixel_strike_primary', primary.value);
        updateWeaponSpecs(+primary.value);
      });
    }
    secondary?.addEventListener('change', () => {
      localStorage.setItem('pixel_strike_secondary', secondary.value);
    });

    el('join-btn').addEventListener('click', () => {
      const trimmed = name.value.trim();
      const n = [...trimmed].slice(0, 16).join('') || `特战队员-${Math.floor(100 + Math.random() * 900)}`;
      if (trimmed) {
        localStorage.setItem('pixel_strike_name', trimmed);
        setCookie('ps_name', trimmed, 365);
      }
      this.loadoutPrimary = +primary.value;
      this.loadoutSecondary = +secondary.value;
      this.menu.style.display = 'none';
      this.root.style.display = 'block';
      this.onJoin?.(n, this.loadoutPrimary, this.loadoutSecondary);
    });

    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') el('join-btn').click();
    });

    el('lb-refresh-btn')?.addEventListener('click', () => this.loadLeaderboard());

    const bot = el('bot-slider') as HTMLInputElement;
    bot?.addEventListener('input', () => {
      this.botCount = +bot.value;
      const countBadge = el('bot-count-display');
      if (countBadge) countBadge.textContent = `${bot.value} BOTS`;
      this.onBotCountChange?.(this.botCount);
    });

    document.querySelectorAll('.bot-pill').forEach((p) => {
      p.addEventListener('click', () => {
        const val = parseInt((p as HTMLElement).dataset.bots || '6');
        this.botCount = val;
        if (bot) bot.value = String(val);
        const countBadge = el('bot-count-display');
        if (countBadge) countBadge.textContent = `${val} BOTS`;
        document.querySelectorAll('.bot-pill').forEach((b) => b.classList.remove('active'));
        p.classList.add('active');
        this.onBotCountChange?.(val);
      });
    });

    this.setupSettings();
    this.setupDeathModal();
    this.loadLeaderboard();
  }

  private setupSettings() {
    const sens = el('sens-slider') as HTMLInputElement;
    const vol = el('vol-slider') as HTMLInputElement;
    const quality = el('quality-select') as HTMLSelectElement;

    const savedSens = localStorage.getItem('ps_sens');
    const savedVol = localStorage.getItem('ps_vol');
    const savedQ = localStorage.getItem('ps_quality') as typeof this.quality | null;

    if (savedSens && sens) sens.value = savedSens;
    if (savedVol && vol) vol.value = savedVol;
    if (savedQ && quality) quality.value = savedQ;

    this.sensitivity = sens ? (+sens.value / 50) * 0.0024 : 0.00216;
    this.volume = vol ? +vol.value / 100 : 0.8;
    this.quality = quality ? (quality.value as typeof this.quality) : 'medium';

    sens?.addEventListener('input', () => {
      this.sensitivity = (+sens.value / 50) * 0.0024;
      localStorage.setItem('ps_sens', sens.value);
    });

    vol?.addEventListener('input', () => {
      this.volume = +vol.value / 100;
      localStorage.setItem('ps_vol', vol.value);
      this.onVolumeChange?.(this.volume);
    });

    quality?.addEventListener('change', () => {
      this.quality = quality.value as typeof this.quality;
      localStorage.setItem('ps_quality', this.quality);
      this.onQualityChange?.(this.quality);
    });

    el('open-settings-btn')?.addEventListener('click', () => this.toggleSettings(true));
    el('close-settings-btn')?.addEventListener('click', () => this.toggleSettings(false));
    el('exit-btn')?.addEventListener('click', () => this.onExit?.());
    el('pause-resume-btn')?.addEventListener('click', () => this.showPause(false));
    el('pause-exit-btn')?.addEventListener('click', () => this.onExit?.());
  }

  private setupDeathModal() {
    const dp = el('death-primary') as HTMLSelectElement;
    const ds = el('death-secondary') as HTMLSelectElement;
    const primary = el('primary-select') as HTMLSelectElement;
    const secondary = el('secondary-select') as HTMLSelectElement;
    const update = () => {
      if (dp && ds) {
        this.loadoutPrimary = +dp.value;
        this.loadoutSecondary = +ds.value;
        primary.value = dp.value;
        secondary.value = ds.value;
        localStorage.setItem('pixel_strike_primary', dp.value);
        localStorage.setItem('pixel_strike_secondary', ds.value);
        this.onLoadoutChange?.(this.loadoutPrimary, this.loadoutSecondary);
      }
    };
    dp?.addEventListener('change', update);
    ds?.addEventListener('change', update);
  }

  setAdmin(admin: boolean) {
    const control = document.getElementById('bot-control');
    if (control) control.style.display = admin ? 'block' : 'none';
  }

  setMap(map: MapData) {
    this.map = map;
    this.radarBase.width = this.radar.width;
    this.radarBase.height = this.radar.height;
    const ctx = this.radarBase.getContext('2d')!;
    const size = map.size[0] || 256;
    const scale = this.radarBase.width / size;
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, this.radarBase.width, this.radarBase.height);
    for (const b of map.blocks) {
      ctx.fillStyle = BLOCK_RADAR_COLORS[b.t] ?? '#444850';
      ctx.fillRect((b.x + size / 2) * scale, (b.z + size / 2) * scale, Math.max(1, b.w * scale), Math.max(1, b.d * scale));
    }
    this.drawRadar(0, 0, 0, true);
  }

  updateRadar(x: number, z: number, yaw: number, now: number) {
    if (now - this.lastRadar < 80) return;
    this.lastRadar = now;
    this.drawRadar(x, z, yaw, false);
  }

  private drawRadar(x: number, z: number, yaw: number, staticOnly: boolean) {
    if (!this.map || !this.radar) return;
    const c = this.radar;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const size = this.map.size[0] || 256;
    const scale = c.width / size;
    ctx.drawImage(this.radarBase, 0, 0);

    if (staticOnly) return;

    const px = (x + size / 2) * scale;
    const pz = (z + size / 2) * scale;

    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  setHp(v: number) {
    if (v === this.lastHp) return;
    this.lastHp = v;
    const hpEl = el('hp');
    if (hpEl) hpEl.textContent = String(v);
  }

  setArmor(v: number) {
    if (v === this.lastArmor) return;
    this.lastArmor = v;
    const armorEl = el('armor');
    if (armorEl) armorEl.textContent = String(v);
  }

  setWeapon(id: number, mag: number, reserve: number, nades: number) {
    const state = `${id}:${mag}:${reserve}:${nades}`;
    if (state === this.lastWeapon) return;
    this.lastWeapon = state;
    const nameEl = el('weapon-name');
    if (nameEl) nameEl.textContent = WEAPON_BADGES[id] ?? 'HE GRENADE';
    const ammoEl = el('ammo');
    if (ammoEl) ammoEl.innerHTML = id === 6 ? '-' : `${mag} <span class="reserve">/ ${reserve}</span>`;
    const nadeEl = el('grenades');
    if (nadeEl) nadeEl.textContent = String(nades);
  }

  setScope(v: boolean) {
    if (this.scope) this.scope.style.display = v ? 'block' : 'none';
    this.crosshair.style.display = v ? 'none' : 'block';
  }

  setSpawnShield(v: boolean) {
    if (v === this.lastShield) return;
    this.lastShield = v;
    const shield = el('shield-badge');
    if (shield) shield.style.display = v ? 'block' : 'none';
  }

  setOnlineRank(online: number, rank: number) {
    const onlineEl = el('online-count');
    if (onlineEl) onlineEl.textContent = String(online);
    const rankEl = el('rank-line');
    if (rankEl) rankEl.textContent = online ? `${rank}/${online}` : '-';
  }

  setNetworkStats(latencyMs: number, outboundBps: number) {
    const latency = latencyMs ? String(Math.round(latencyMs)) : '--';
    const bandwidth = (outboundBps * 8 / 1e6).toFixed(1);
    const state = `${latency}:${bandwidth}`;
    if (state === this.lastNetwork) return;
    this.lastNetwork = state;
    el('latency-value').textContent = `${latency} ms`;
    el('bandwidth-value').textContent = `${bandwidth} Mbps`;
  }

  hitMarker(head = false) {
    if (!this.hit) return;
    this.hit.style.display = 'block';
    this.hit.style.color = head ? '#e4b762' : '#bd5146';
    clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => {
      if (this.hit) this.hit.style.display = 'none';
    }, 110);
  }

  setCrosshair(spread: number) {
    const px = Math.round(Math.max(0, Math.min(18, spread)));
    if (px === this.lastCrosshair) return;
    this.lastCrosshair = px;
    this.crosshair.style.setProperty('--spread', `${px}px`);
  }

  damageFlash() {
    if (!this.damage) return;
    this.damage.style.display = 'block';
    clearTimeout(this.damageTimer);
    this.damageTimer = window.setTimeout(() => {
      if (this.damage) this.damage.style.display = 'none';
    }, 130);
  }

  killFeedEntry(killer: string, victim: string, weapon: number, head: boolean, mine: boolean) {
    if (!this.killfeed) return;
    const row = document.createElement('div');
    row.className = 'kill-row' + (mine ? ' mine' : '');
    const badge = WEAPON_BADGES[weapon] ?? 'HE';
    row.innerHTML = `<span class="killer">${esc(killer)}</span><span class="weapon">${esc(badge)}</span>${head ? '<span class="head-badge">HEAD</span>' : ''}<span class="victim">${esc(victim)}</span>`;
    this.killfeed.prepend(row);
    while (this.killfeed.children.length > 6) {
      this.killfeed.lastElementChild?.remove();
    }
    setTimeout(() => row.remove(), 4200);
  }

  deathScreen(killer: string) {
    const killerEl = el('killer-label');
    if (killerEl) killerEl.textContent = killer;
    if (this.death) this.death.style.display = 'flex';
    this.showPause(false);
    document.exitPointerLock?.();
    (el('death-primary') as HTMLSelectElement).value = String(this.loadoutPrimary);
    (el('death-secondary') as HTMLSelectElement).value = String(this.loadoutSecondary);
    let left = 3.0;
    const countEl = el('respawn-count');
    if (countEl) countEl.textContent = '3';
    clearInterval(this.respawnTimer);
    this.respawnTimer = window.setInterval(() => {
      left -= 0.1;
      if (countEl) countEl.textContent = String(Math.max(1, Math.ceil(left)));
      if (left <= 0) clearInterval(this.respawnTimer);
    }, 100);
  }

  respawned() {
    clearInterval(this.respawnTimer);
    if (this.death) this.death.style.display = 'none';
  }

  updateScoreboard(roster: RosterEntry[], states: Map<number, PlayerSnap>, myId: number) {
    const sorted = [...roster].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
    const rank = Math.max(1, sorted.findIndex((p) => p.id === myId) + 1);
    this.setOnlineRank(sorted.length, rank);
    if (this.scoreboard.style.display !== 'block') return;

    const roomInfo = el('sb-room-info');
    if (roomInfo) roomInfo.textContent = `实时对战 · ${sorted.length} 名特战队员`;

    const body = el('sb-body');
    if (!body) return;
    body.innerHTML = sorted.map((p, i) => {
      const s = states.get(p.id);
      const alive = !!(s?.state && s.state & 1);
      const weapon = WEAPON_BADGES[s?.weapon ?? 3] ?? 'AK-47';
      const kd = p.deaths ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(1);
      return `
        <tr class="${p.id === myId ? 'me' : ''}">
          <td><span class="rank-badge ${i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : ''}">${i + 1}</span></td>
          <td><b>${esc(p.name)}</b>${p.id === myId ? ' (你)' : ''}</td>
          <td>${alive ? '<span style="color:#10b981;font-weight:700;">存活</span>' : '<span style="color:#64748b;">阵亡</span>'}</td>
          <td>${esc(weapon)}</td>
          <td style="color:#10b981;font-weight:800;">${p.kills}</td>
          <td style="color:#f43f5e;">${p.deaths}</td>
          <td style="color:#f59e0b;font-weight:800;">${kd}</td>
        </tr>
      `;
    }).join('');
  }

  toggleScoreboard(v: boolean) {
    if (this.scoreboard) this.scoreboard.style.display = v ? 'block' : 'none';
  }

  toggleSettings(force?: boolean) {
    if (!this.settings) return;
    const open = force ?? this.settings.style.display !== 'flex';
    this.settings.style.display = open ? 'flex' : 'none';
    if (!open) this.onSettingsClose?.();
  }

  isSettingsOpen(): boolean {
    return this.settings?.style.display === 'flex';
  }

  showPause(v: boolean) {
    if (this.pause) this.pause.style.display = v ? 'flex' : 'none';
  }

  onPauseClick(fn: () => void) {
    el('pause-resume-btn')?.addEventListener('click', fn);
  }

  showDisconnect(message = '正在重新连接…') {
    const msgEl = el('disconnect-message');
    if (msgEl) msgEl.textContent = message;
    if (this.disconnect) this.disconnect.style.display = 'flex';
  }

  hideDisconnect() {
    if (this.disconnect) this.disconnect.style.display = 'none';
  }

  exitMatch() {
    clearInterval(this.respawnTimer);
    document.exitPointerLock?.();
    this.root.style.display = 'none';
    this.menu.style.display = 'block';
    if (this.pause) this.pause.style.display = 'none';
    if (this.settings) this.settings.style.display = 'none';
    if (this.scoreboard) this.scoreboard.style.display = 'none';
    if (this.death) this.death.style.display = 'none';
    this.loadLeaderboard();
  }

  async loadLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('leaderboard fetch failed');
      const rows: { name: string; kills: number; deaths: number; kd: number }[] = await res.json();
      const lbEl = el('leaderboard');
      if (!lbEl) return;
      if (!rows.length) {
        lbEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">暂无战绩数据</td></tr>';
        return;
      }
      lbEl.innerHTML = rows.map((r, i) => `
        <tr>
          <td><span class="rank-badge ${i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : ''}">${i + 1}</span></td>
          <td><b>${esc(r.name)}</b></td>
          <td style="color:#10b981;font-weight:800;">${r.kills}</td>
          <td style="color:#f43f5e;">${r.deaths}</td>
          <td style="color:#f59e0b;font-weight:800;">${r.kd.toFixed(2)}</td>
        </tr>
      `).join('');
    } catch {
      const lbEl = el('leaderboard');
      if (lbEl) lbEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#f43f5e;padding:16px;">排行榜暂不可用</td></tr>';
    }
  }
}
