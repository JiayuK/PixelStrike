package main

import (
	"encoding/binary"
	"math"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func TestWelcomeV3(t *testing.T) {
	b := Welcome(42, 0x12345678)
	if len(b) != 8 || b[0] != OpWelcome || b[1] != ProtocolVersion || binary.LittleEndian.Uint16(b[2:]) != 42 {
		t.Fatalf("bad welcome: %v", b)
	}
}

func TestBalanceValues(t *testing.T) {
	if RespawnDelayS != 3*time.Second || Weapons[3].Dmg != 33 || Weapons[5].Dmg != 108 || Weapons[0].ArmorPen != .58 ||
		WalkSpeed != 6.4 || GroundAccel != 44 || StopAccel != 60 || AirAccel != 9.5 || JumpVel != 8.4 || MaxRewindTicks != 8 {
		t.Fatalf("unexpected balance: respawn=%v ak=%v awp=%v", RespawnDelayS, Weapons[3].Dmg, Weapons[5].Dmg)
	}
	for _, weapon := range []int{1, 3} {
		w := Weapons[weapon]
		if w.Dmg*w.HeadMult*w.ArmorPen < MaxHP {
			t.Fatalf("%s cannot one-tap a helmet: %.1f", w.Name, w.Dmg*w.HeadMult*w.ArmorPen)
		}
	}
	now := time.Now()
	r := &Room{}
	attacker := &PlayerState{IsBot: true, Alive: true}
	victim := &PlayerState{IsBot: true, Alive: true, HP: 1, Weapon: 3}
	r.Damage(attacker, victim, 10, false, 3, now)
	if victim.RespawnAt.Sub(now) != 3*time.Second {
		t.Fatalf("wrong respawn delay: %v", victim.RespawnAt.Sub(now))
	}
	if len(r.pending) != 2 || r.pending[0].Type != EvHit || r.pending[1].Type != EvKill {
		t.Fatalf("unexpected lethal events: %#v", r.pending)
	}
}

func TestHitEventCarriesHeadshotWithoutGrowing(t *testing.T) {
	b := Events([]Event{{Type: EvHit, Player: 1, Victim: 2, Dmg: 42, Headshot: 1}})
	if len(b) != 8 || b[7] != (42|0x80) {
		t.Fatalf("bad headshot hit event: %v", b)
	}
}

func TestCeilingCollisionIsNotGround(t *testing.T) {
	w := &World{aabbs: []AABB{{Min: Vec3{-2, 2, -2}, Max: Vec3{2, 2.5, 2}}}}
	pos, vel := Vec3{}, Vec3{Y: 7}
	if w.MoveAABB(&pos, &vel, .1, StandingHeight, false) {
		t.Fatal("ceiling collision reported as grounded")
	}
	w.aabbs = []AABB{{Min: Vec3{-2, -1, -2}, Max: Vec3{2, 0, 2}}}
	pos, vel = Vec3{Y: .1}, Vec3{Y: -2}
	if !w.MoveAABB(&pos, &vel, .1, StandingHeight, false) {
		t.Fatal("floor collision did not report grounded")
	}
}

func TestSweptCollisionAndCrouchClearance(t *testing.T) {
	w := &World{aabbs: []AABB{{Min: Vec3{1, 0, -2}, Max: Vec3{1.05, 3, 2}}}}
	pos, vel := Vec3{}, Vec3{X: 20}
	w.MoveAABB(&pos, &vel, .1, StandingHeight, false)
	if pos.X > 1-PlayerHalf || vel.X != 0 || !w.CanOccupy(pos, StandingHeight) {
		t.Fatalf("swept wall failed: pos=%v vel=%v", pos, vel)
	}

	w.aabbs = []AABB{{Min: Vec3{-2, 1.4, -2}, Max: Vec3{2, 2, 2}}}
	if !w.CanOccupy(Vec3{}, CrouchingHeight) || w.CanOccupy(Vec3{}, StandingHeight) {
		t.Fatal("crouch clearance check failed")
	}
}

func TestDiagonalWallSlideDoesNotStickOrTunnel(t *testing.T) {
	w := &World{aabbs: []AABB{{Min: Vec3{1, 0, -10}, Max: Vec3{1.05, 3, 10}}}}
	pos, vel := Vec3{}, Vec3{X: 20, Z: 6}
	w.MoveAABB(&pos, &vel, .1, StandingHeight, false)
	if pos.X > 1-PlayerHalf || pos.Z < .59 || vel.X != 0 || !w.CanOccupy(pos, StandingHeight) {
		t.Fatalf("diagonal slide failed: pos=%v vel=%v", pos, vel)
	}
	for range 20 {
		vel.X, vel.Z = 6, 6
		w.MoveAABB(&pos, &vel, 1.0/60, StandingHeight, false)
	}
	if pos.Z < 2.5 || !w.CanOccupy(pos, StandingHeight) {
		t.Fatalf("wall movement stuck or penetrated: pos=%v", pos)
	}
}

func TestJumpRequiresGround(t *testing.T) {
	w := &World{aabbs: []AABB{{Min: Vec3{-20, -1, -20}, Max: Vec3{20, 0, 20}}}}
	r := &Room{World: w}
	p := &PlayerState{Alive: true, OnGround: true, Pos: Vec3{Y: Epsilon}, CmdKeys: KeyJump | KeyForward}
	p.ApplyLoadout(3, 0)
	maxY, maxSpeed := p.Pos.Y, 0.0
	jumps := 0
	for range 180 {
		wasGrounded := p.OnGround
		r.Move(p, time.Now())
		if wasGrounded && !p.OnGround {
			jumps++
		}
		maxY = max(maxY, p.Pos.Y)
		maxSpeed = max(maxSpeed, math.Hypot(p.Vel.X, p.Vel.Z))
	}
	speedLimit := WalkSpeed * Weapons[3].SpeedMult
	if maxY < 1.45 || jumps < 2 || maxSpeed > speedLimit+1e-9 {
		t.Fatalf("bad bunny hop: apex=%.3f jumps=%d speed=%.3f limit=%.3f", maxY, jumps, maxSpeed, speedLimit)
	}
	p.Pos.Y, p.OnGround, p.Vel.Y = 2, false, -1
	r.Move(p, time.Now())
	if p.Vel.Y >= 0 {
		t.Fatal("jump without solid support was accepted")
	}
}

func TestLastRoundStartsReload(t *testing.T) {
	r := &Room{World: &World{}, history: make(map[uint16]*poseHistory)}
	p := &PlayerState{Alive: true, OnGround: true}
	p.ApplyLoadout(3, 0)
	p.Mags[0] = 1
	now := time.Unix(1, 0)
	if !r.TryFire(p, 0, 0, 0, 0, 1, now) || p.Mags[0] != 0 || !p.Reloading {
		t.Fatalf("last round did not start reload: mag=%d reloading=%v", p.Mags[0], p.Reloading)
	}
}

func TestReloadRequestDoesNotRestartActiveReload(t *testing.T) {
	r := &Room{}
	p := &PlayerState{Alive: true}
	p.ApplyLoadout(3, 0)
	p.Mags[0]--
	now := time.Unix(1, 0)
	if !r.StartReload(p, now) {
		t.Fatal("initial reload rejected")
	}
	deadline := p.ReloadEnd
	if r.StartReload(p, now.Add(time.Second)) || !p.ReloadEnd.Equal(deadline) || len(r.pending) != 1 {
		t.Fatalf("active reload restarted: end=%v events=%d", p.ReloadEnd, len(r.pending))
	}
}

func TestGrenadeThrowConsumesOnceAndEmitsTrajectory(t *testing.T) {
	r := &Room{}
	p := &PlayerState{Id: 7, Alive: true, Grenades: 1}
	now := time.Unix(1, 0)
	r.ThrowGrenade(p, .4, .2, now)
	r.ThrowGrenade(p, .4, .2, now)
	if p.Grenades != 0 || len(r.Grenades) != 1 || len(r.pending) != 1 {
		t.Fatalf("duplicate grenade throw: grenades=%d live=%d events=%d", p.Grenades, len(r.Grenades), len(r.pending))
	}
	e := r.pending[0]
	if e.Type != EvNadeThrow || e.Player != p.Id || e.Dir.X == 0 || e.Dir.Y == 0 || e.Dir.Z == 0 {
		t.Fatalf("grenade trajectory event missing: %#v", e)
	}
}

func TestKnifeAttackDoesNotRequireAmmo(t *testing.T) {
	r := &Room{World: &World{}, history: make(map[uint16]*poseHistory)}
	attacker := &Player{PlayerState: PlayerState{Id: 1, Alive: true, IsBot: true, HP: MaxHP, Pos: Vec3{}}}
	victim := &Player{PlayerState: PlayerState{Id: 2, Alive: true, IsBot: true, HP: MaxHP, Pos: Vec3{Z: -1.2}}}
	attacker.ApplyLoadout(3, 0)
	attacker.SwitchSlot(3)
	attacker.NextFire = time.Time{}
	r.Players = []*Player{attacker, victim}
	if !r.TryFire(&attacker.PlayerState, 0, 0, 0, 0, 1, time.Unix(1, 0)) || victim.HP >= MaxHP {
		t.Fatalf("knife attack failed without ammo: accepted=%v hp=%d", attacker.HasShot, victim.HP)
	}
}

func TestPatternDirStaysInsideSpread(t *testing.T) {
	aim := AimDir(.3, -.2)
	limit := math.Cos(2 * math.Pi / 180)
	for shot := 1; shot <= 64; shot++ {
		got := patternDir(aim, 2, shot, 3)
		if dot := aim.X*got.X + aim.Y*got.Y + aim.Z*got.Z; dot < limit-1e-12 {
			t.Fatalf("shot %d left spread cone: cos=%.9f limit=%.9f", shot, dot, limit)
		}
	}
}

func TestAutomaticFireKeepsCadenceAcrossFrames(t *testing.T) {
	r := &Room{World: &World{}, history: make(map[uint16]*poseHistory)}
	p := &PlayerState{Alive: true, OnGround: true}
	p.ApplyLoadout(2, 0)
	now := time.Unix(1, 0)
	if !r.TryFire(p, 0, 0, 0, 0, 1, now) {
		t.Fatal("first shot rejected")
	}
	firstDeadline := p.NextFire
	gap := time.Duration(60 / Weapons[2].Rpm * float64(time.Second))
	if !r.TryFire(p, 0, 0, 0, 0, 2, firstDeadline.Add(8*time.Millisecond)) {
		t.Fatal("late frame shot rejected")
	}
	if want := firstDeadline.Add(gap); !p.NextFire.Equal(want) {
		t.Fatalf("fire cadence drifted: got %v want %v", p.NextFire, want)
	}
}

func TestDeltaSnapshotIsSmallerThanKeyframe(t *testing.T) {
	now := time.Now()
	receiver := &Player{PlayerState: PlayerState{Id: 1, Alive: true, HP: 100, Armor: 100, InvincibleUntil: now.Add(time.Second)}}
	receiver.ApplyLoadout(3, 0)
	other := &Player{PlayerState: PlayerState{Id: 2, Alive: true, HP: 100, Armor: 100, Pos: Vec3{10, 0, 10}}}
	other.ApplyLoadout(4, 0)
	full := receiver.BuildSnapshot(0, []*Player{receiver, other}, now.UnixNano())
	other.Pos.X += .1
	delta := receiver.BuildSnapshot(2, []*Player{receiver, other}, now.UnixNano())
	if len(delta) >= len(full) || delta[7] == 0 {
		t.Fatalf("full=%d delta=%d records=%d", len(full), len(delta), delta[7])
	}
}

func TestMapSupportsHundredPlayerRoom(t *testing.T) {
	w, err := LoadWorld("../map.json")
	if err != nil {
		t.Fatal(err)
	}
	if w.Size != [2]float64{512, 512} || len(w.Spawns) < 64 {
		t.Fatalf("size=%v spawns=%d", w.Size, len(w.Spawns))
	}
	for i, spawn := range w.Spawns {
		box := playerBox(Vec3{spawn[0], spawn[1], spawn[2]}, StandingHeight)
		for _, block := range w.aabbs {
			if intersects(box, block) {
				t.Fatalf("spawn %d intersects map: %v", i, spawn)
			}
		}
	}
}

func TestLastHumanClosesBotRoom(t *testing.T) {
	human := &Player{PlayerState: PlayerState{Id: 1}}
	bot := &Player{PlayerState: PlayerState{Id: 2, IsBot: true}}
	r := &Room{Players: []*Player{human, bot}, botAIs: map[uint16]*BotAI{2: {}}, history: make(map[uint16]*poseHistory)}
	r.Remove(human)
	if !r.Empty() || len(r.Players) != 0 {
		t.Fatalf("room not closed: closed=%v players=%d", r.closed, len(r.Players))
	}
}

func TestEventsNeverSplitsUTF8Rune(t *testing.T) {
	name := strings.Repeat("汉", 25) // 75 bytes > 64 limit
	b := Events([]Event{{Type: EvPlayerName, Player: 1, Name: name}})
	n := int(b[5])
	got := string(b[6 : 6+n])
	if !utf8.ValidString(got) {
		t.Fatalf("truncated name is not valid UTF-8: %q", got)
	}
	if !strings.HasPrefix(name, got) || len(got)%3 != 0 {
		t.Fatalf("bad truncation: %q", got)
	}
}

func TestPoseHistoryRing(t *testing.T) {
	p := &Player{PlayerState: PlayerState{Id: 1}}
	r := &Room{Players: []*Player{p}, history: make(map[uint16]*poseHistory)}
	for i := uint32(0); i < 20; i++ {
		r.tick, p.Pos.X = i, float64(i)
		r.recordHistory()
	}
	if got := r.poseAt(1, 10, Vec3{}, false); got.Tick != 10 || got.Pos.X != 10 {
		t.Fatalf("pose at 10 = %#v", got)
	}
	if got := r.poseAt(1, 2, Vec3{X: -1}, false); got.Pos.X != -1 {
		t.Fatalf("expired pose did not use fallback: %#v", got)
	}
}

func TestSanitizeNameUTF8(t *testing.T) {
	if s := sanitizeName("小明\xff\xfe<bot>"); s != "小明bot" {
		t.Fatalf("sanitizeName = %q", s)
	}
	if s := sanitizeName(strings.Repeat("汉", 20)); len([]rune(s)) != 16 {
		t.Fatalf("sanitizeName len = %d", len([]rune(s)))
	}
}

func TestFingerprintsDoNotMergePlayersBehindOneIP(t *testing.T) {
	s, err := NewStore(t.TempDir() + "/stats.db")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	a := s.GetOrCreatePlayer("203.0.113.10", "browser-a", "Alice")
	b := s.GetOrCreatePlayer("203.0.113.10", "browser-b", "Bob")
	if a != "Alice" || b != "Bob" {
		t.Fatalf("shared IP merged distinct browsers: %q %q", a, b)
	}
}
