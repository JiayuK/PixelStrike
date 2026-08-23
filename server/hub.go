package main

import (
	"log"
	"sync"
	"sync/atomic"
	"time"
)

var OnlinePlayers atomic.Int64

type Hub struct {
	World  *World
	Store  *Store
	mu     sync.Mutex
	rooms  []*Room
	nextId int
}

func NewHub(w *World, s *Store) *Hub { return &Hub{World: w, Store: s} }

func (h *Hub) Join(p *Player, name string, primary, secondary uint8) {
	h.mu.Lock()
	var room *Room
	for _, candidate := range h.rooms {
		candidate.mu.Lock()
		if !candidate.closed && candidate.HumanCountLocked() < RoomCap {
			room = candidate
			break
		}
		candidate.mu.Unlock()
	}
	if room == nil {
		h.nextId++
		room = NewRoom(h.nextId, h.World, h.Store)
		h.rooms = append(h.rooms, room)
		room.mu.Lock()
	}
	// Bots are filler: a real player always owns the seat.
	if len(room.Players) >= RoomCap {
		for i := len(room.Players) - 1; i >= 0; i-- {
			if room.Players[i].IsBot {
				delete(room.botAIs, room.Players[i].Id)
				room.Players = append(room.Players[:i], room.Players[i+1:]...)
				break
			}
		}
	}
	p.Id = room.nextIdSeq
	room.nextIdSeq++
	p.Name = name
	p.joined = true
	p.Room = room
	p.ApplyLoadout(primary, secondary)
	p.HP = MaxHP
	p.Armor = 100
	p.Alive = true
	p.OnGround = true
	p.InvincibleUntil = time.Now().Add(SpawnProtectS)
	p.Pos = room.BestSpawn(&p.PlayerState)
	p.IsAdmin = room.HumanCountLocked() == 0
	room.Players = append(room.Players, p)
	room.Emit(Event{Type: EvPlayerName, Player: p.Id, Name: p.Name})
	players := append([]*Player(nil), room.Players...)
	p.Send(Welcome(p.Id, h.World.Revision, p.IsAdmin))
	p.Send(Roster(players))
	p.lastSelf = SelfState(&p.PlayerState)
	p.Send(p.lastSelf)
	p.ready = true
	if !room.running {
		room.running = true
		go room.Run()
	}
	room.mu.Unlock()
	h.mu.Unlock()

	OnlinePlayers.Add(1)
	h.Store.IncrMeta("total_joins", 1)
	log.Printf("player %d joined room %d as %q (admin=%v)", p.Id, room.Id, name, p.IsAdmin)
}

func (h *Hub) Leave(p *Player) {
	if p.closed {
		return
	}
	p.closed = true
	if room := p.Room; room != nil && p.joined {
		wasAdmin := p.IsAdmin
		room.Remove(p)
		OnlinePlayers.Add(-1)
		if wasAdmin {
			room.mu.Lock()
			for _, next := range room.Players {
				if !next.IsBot {
					next.IsAdmin = true
					break
				}
			}
			room.mu.Unlock()
		}
		log.Printf("player %d (%s) left room %d", p.Id, p.Name, room.Id)
	}
	if p.send != nil {
		close(p.send)
	}
	if p.joined {
		h.Store.Flush()
		h.Store.Invalidate(p.IP, p.Fingerprint)
	}
	h.mu.Lock()
	alive := h.rooms[:0]
	for _, r := range h.rooms {
		if !r.Empty() {
			alive = append(alive, r)
		}
	}
	h.rooms = alive
	h.mu.Unlock()
}
