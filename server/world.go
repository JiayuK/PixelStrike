package main

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
)

type Vec3 struct{ X, Y, Z float64 }

type AABB struct {
	Min, Max Vec3
}

// World is the static map: AABB list plus spawn points.
type World struct {
	rawJSON  []byte // original file bytes served by /map.json
	Revision uint32
	Size     [2]float64   `json:"size"`
	Blocks   []MapBlock   `json:"blocks"`
	Spawns   [][3]float64 `json:"spawns"`

	aabbs []AABB
}

type MapBlock struct {
	X, Y, Z float64
	W, H, D float64
	T       int
}

func LoadWorld(path string) (*World, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	w := &World{}
	if err := json.Unmarshal(data, w); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	w.aabbs = make([]AABB, 0, len(w.Blocks))
	for _, b := range w.Blocks {
		if b.T == 12 { // water is visual, not a wall or bullet shield
			continue
		}
		w.aabbs = append(w.aabbs, AABB{
			Min: Vec3{b.X, b.Y, b.Z},
			Max: Vec3{b.X + b.W, b.Y + b.H, b.Z + b.D},
		})
	}
	w.rawJSON = data
	hash := sha256.Sum256(data)
	w.Revision = binary.LittleEndian.Uint32(hash[:4])
	if len(w.Spawns) == 0 {
		return nil, fmt.Errorf("map has no spawns")
	}
	return w, nil
}

const (
	PlayerHalf = 0.3
	StepUp     = 0.55
	Epsilon    = 0.001
)

// MoveAABB uses swept axis tests so frame stalls and corrections cannot cross walls.
func (w *World) MoveAABB(pos *Vec3, vel *Vec3, dt, height float64, canStep bool) bool {
	grounded := w.depenetrate(pos, vel, height)

	dx := vel.X * dt
	if dx != 0 {
		startX, nextX, blocked := pos.X, pos.X+dx, false
		for _, b := range w.aabbs {
			if pos.Y >= b.Max.Y || pos.Y+height <= b.Min.Y || pos.Z-PlayerHalf >= b.Max.Z || pos.Z+PlayerHalf <= b.Min.Z {
				continue
			}
			crossed := dx > 0 && startX+PlayerHalf <= b.Min.X+Epsilon && nextX+PlayerHalf > b.Min.X ||
				dx < 0 && startX-PlayerHalf >= b.Max.X-Epsilon && nextX-PlayerHalf < b.Max.X
			if !crossed {
				continue
			}
			stepH := b.Max.Y - pos.Y
			if canStep && stepH > 0 && stepH <= StepUp && !stepBlocked(w, Vec3{nextX, pos.Y, pos.Z}, b.Max.Y, height) {
				pos.Y = b.Max.Y + Epsilon
				grounded = true
				continue
			}
			if dx > 0 {
				nextX = math.Min(nextX, b.Min.X-PlayerHalf-Epsilon)
			} else {
				nextX = math.Max(nextX, b.Max.X+PlayerHalf+Epsilon)
			}
			blocked = true
		}
		pos.X = nextX
		if blocked {
			vel.X = 0
		}
	}

	dz := vel.Z * dt
	if dz != 0 {
		startZ, nextZ, blocked := pos.Z, pos.Z+dz, false
		for _, b := range w.aabbs {
			if pos.Y >= b.Max.Y || pos.Y+height <= b.Min.Y || pos.X-PlayerHalf >= b.Max.X || pos.X+PlayerHalf <= b.Min.X {
				continue
			}
			crossed := dz > 0 && startZ+PlayerHalf <= b.Min.Z+Epsilon && nextZ+PlayerHalf > b.Min.Z ||
				dz < 0 && startZ-PlayerHalf >= b.Max.Z-Epsilon && nextZ-PlayerHalf < b.Max.Z
			if !crossed {
				continue
			}
			stepH := b.Max.Y - pos.Y
			if canStep && stepH > 0 && stepH <= StepUp && !stepBlocked(w, Vec3{pos.X, pos.Y, nextZ}, b.Max.Y, height) {
				pos.Y = b.Max.Y + Epsilon
				grounded = true
				continue
			}
			if dz > 0 {
				nextZ = math.Min(nextZ, b.Min.Z-PlayerHalf-Epsilon)
			} else {
				nextZ = math.Max(nextZ, b.Max.Z+PlayerHalf+Epsilon)
			}
			blocked = true
		}
		pos.Z = nextZ
		if blocked {
			vel.Z = 0
		}
	}

	dy := vel.Y * dt
	if dy != 0 {
		startY, nextY := pos.Y, pos.Y+dy
		for _, b := range w.aabbs {
			if pos.X-PlayerHalf >= b.Max.X || pos.X+PlayerHalf <= b.Min.X || pos.Z-PlayerHalf >= b.Max.Z || pos.Z+PlayerHalf <= b.Min.Z {
				continue
			}
			if dy < 0 && startY >= b.Max.Y-Epsilon && nextY < b.Max.Y {
				nextY = math.Max(nextY, b.Max.Y+Epsilon)
				vel.Y, grounded = 0, true
			} else if dy > 0 && startY+height <= b.Min.Y+Epsilon && nextY+height > b.Min.Y {
				nextY = math.Min(nextY, b.Min.Y-height-Epsilon)
				vel.Y = 0
			}
		}
		pos.Y = nextY
	}
	grounded = w.depenetrate(pos, vel, height) || grounded
	return grounded
}

func (w *World) CanOccupy(pos Vec3, height float64) bool {
	box := playerBox(pos, height)
	for _, b := range w.aabbs {
		if intersects(box, b) {
			return false
		}
	}
	return true
}

func (w *World) depenetrate(pos *Vec3, vel *Vec3, height float64) bool {
	grounded := false
	for pass := 0; pass < 6; pass++ {
		found := false
		for _, b := range w.aabbs {
			if !intersects(playerBox(*pos, height), b) {
				continue
			}
			found = true
			axis, delta := 0, b.Min.X-Epsilon-(pos.X+PlayerHalf)
			best := math.Abs(delta)
			choose := func(candidate float64, candidateAxis int) {
				if size := math.Abs(candidate); size < best {
					best, delta, axis = size, candidate, candidateAxis
				}
			}
			choose(b.Max.X+Epsilon-(pos.X-PlayerHalf), 0)
			choose(b.Min.Y-Epsilon-(pos.Y+height), 1)
			choose(b.Max.Y+Epsilon-pos.Y, 1)
			choose(b.Min.Z-Epsilon-(pos.Z+PlayerHalf), 2)
			choose(b.Max.Z+Epsilon-(pos.Z-PlayerHalf), 2)
			switch axis {
			case 0:
				pos.X += delta
				vel.X = 0
			case 1:
				pos.Y += delta
				vel.Y = 0
				grounded = grounded || delta > 0
			default:
				pos.Z += delta
				vel.Z = 0
			}
			break
		}
		if !found {
			break
		}
	}
	return grounded
}

func stepBlocked(w *World, p Vec3, newFeet, height float64) bool {
	top := playerBox(Vec3{p.X, newFeet + Epsilon, p.Z}, height)
	for _, b := range w.aabbs {
		if intersects(top, b) {
			return true
		}
	}
	return false
}

func playerBox(p Vec3, height float64) AABB {
	return AABB{
		Min: Vec3{p.X - PlayerHalf, p.Y, p.Z - PlayerHalf},
		Max: Vec3{p.X + PlayerHalf, p.Y + height, p.Z + PlayerHalf},
	}
}

func intersects(a, b AABB) bool {
	return a.Min.X < b.Max.X && a.Max.X > b.Min.X &&
		a.Min.Y < b.Max.Y && a.Max.Y > b.Min.Y &&
		a.Min.Z < b.Max.Z && a.Max.Z > b.Min.Z
}

// Raycast returns distance to nearest world hit via slab method, O(n).
func (w *World) Raycast(origin, dir Vec3, maxDist float64) (bool, float64) {
	best := maxDist
	hit := false
	for _, b := range w.aabbs {
		if d, ok := rayAABB(origin, dir, b, best); ok && d < best {
			best = d
			hit = true
		}
	}
	return hit, best
}

func rayAABB(o, d Vec3, b AABB, maxDist float64) (float64, bool) {
	tmin, tmax := 0.0, maxDist
	for axis := range 3 {
		var od, omin, omax, dd float64
		switch axis {
		case 0:
			od, omin, omax, dd = o.X, b.Min.X, b.Max.X, d.X
		case 1:
			od, omin, omax, dd = o.Y, b.Min.Y, b.Max.Y, d.Y
		default:
			od, omin, omax, dd = o.Z, b.Min.Z, b.Max.Z, d.Z
		}
		if math.Abs(dd) < 1e-9 {
			if od < omin || od > omax {
				return 0, false
			}
			continue
		}
		t1 := (omin - od) / dd
		t2 := (omax - od) / dd
		if t1 > t2 {
			t1, t2 = t2, t1
		}
		tmin = math.Max(tmin, t1)
		tmax = math.Min(tmax, t2)
		if tmin > tmax {
			return 0, false
		}
	}
	if tmin <= 0 {
		return 0, false
	}
	return tmin, true
}

func RayPlayerAABBHeight(o, d Vec3, p Vec3, height, maxDist float64) (float64, bool) {
	return rayAABB(o, d, playerBox(p, height), maxDist)
}
