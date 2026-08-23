package main

import (
	"encoding/binary"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeChanSize = 16
	maxMsgSize    = 4096
	readDeadlineS = 30
)

var upgrader = websocket.Upgrader{ReadBufferSize: 2048, WriteBufferSize: 2048, CheckOrigin: sameOrigin}

func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	return err == nil && strings.EqualFold(u.Host, r.Host)
}

type Player struct {
	PlayerState
	ws                    *websocket.Conn
	send                  chan []byte
	sendMu                sync.RWMutex
	closeOnce             sync.Once
	Room                  *Room
	Hub                   *Hub
	IP, Fingerprint       string
	joined, ready, closed bool
	netCache              map[uint16]quantState
	netFullAt             map[uint16]uint32
	lastSelf              compactSelfState
	hasLastSelf           bool
	rosterRequested       bool
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, allowedOrigin string) {
	connectionUpgrader := upgrader
	connectionUpgrader.CheckOrigin = func(request *http.Request) bool {
		return sameOrigin(request) || allowedOrigin != "" && request.Header.Get("Origin") == allowedOrigin
	}
	conn, err := connectionUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	ip := r.Header.Get("X-Forwarded-For")
	if i := strings.IndexByte(ip, ','); i >= 0 {
		ip = strings.TrimSpace(ip[:i])
	}
	if ip == "" {
		ip = r.Header.Get("X-Real-IP")
	}
	if ip == "" {
		ip = r.RemoteAddr
	}
	p := &Player{ws: conn, send: make(chan []byte, writeChanSize), Hub: hub, IP: ip}
	p.ApplyLoadout(3, 0)
	p.HP = MaxHP
	p.Armor = 100
	p.Grenades = 1
	go p.writePump()
	p.readPump(hub)
}

func (p *Player) readPump(hub *Hub) {
	defer hub.Leave(p)
	p.ws.SetReadLimit(maxMsgSize)
	p.ws.SetReadDeadline(time.Now().Add(readDeadlineS * time.Second))
	for {
		mt, data, err := p.ws.ReadMessage()
		if err != nil {
			return
		}
		if mt != websocket.BinaryMessage || len(data) < 1 {
			continue
		}
		p.ws.SetReadDeadline(time.Now().Add(readDeadlineS * time.Second))
		op, payload := data[0], data[1:]
		now := time.Now()
		if p.joined && op != OpPing && !p.InputRateOK(now) {
			log.Printf("player %d message flood", p.Id)
			return
		}
		switch op {
		case OpJoin:
			if p.joined || len(payload) < 4 {
				return
			}
			if payload[0] != ProtocolVersion {
				p.Send(Reject("版本已更新，请刷新页面"))
				time.Sleep(50 * time.Millisecond)
				return
			}
			n := int(payload[1])
			if n > len(payload)-4 {
				continue
			}
			name := sanitizeName(string(payload[2 : 2+n]))
			primary, secondary := payload[2+n], payload[3+n]
			if !validLoadout(primary, secondary) {
				primary, secondary = 3, 0
			}
			if len(payload) > 4+n {
				p.Fingerprint = sanitizeFingerprint(string(payload[4+n:]))
			}
			if name == "" {
				name = "player"
			}
			resolved := hub.Store.GetOrCreatePlayer(p.IP, p.Fingerprint, name)
			hub.Join(p, resolved, primary, secondary)
		case OpInput:
			if !p.joined || len(payload) < 11 {
				continue
			}
			seq := binary.LittleEndian.Uint16(payload)
			keys := payload[2] & 0x7f
			yaw := float64(math.Float32frombits(binary.LittleEndian.Uint32(payload[3:])))
			pitch := float64(math.Float32frombits(binary.LittleEndian.Uint32(payload[7:])))
			if !finite(yaw) || !finite(pitch) {
				continue
			}
			pitch = math.Max(-1.55, math.Min(1.55, pitch))
			yaw = math.Remainder(yaw, 2*math.Pi)
			if room := p.Room; room != nil {
				room.mu.Lock()
				if keys&KeyAim != 0 && (p.CmdKeys&KeyAim == 0 || p.AimStarted.IsZero()) {
					p.AimStarted = now
				} else if keys&KeyAim == 0 {
					p.AimStarted = time.Time{}
				}
				p.CmdKeys = keys
				p.Yaw = yaw
				p.Pitch = pitch
				p.LastInputSeq = seq
				room.mu.Unlock()
			}
		case OpFire:
			if !p.joined || len(payload) < 15 {
				continue
			}
			shot := binary.LittleEndian.Uint16(payload)
			seen := binary.LittleEndian.Uint32(payload[2:])
			mode := payload[6]
			yaw := float64(math.Float32frombits(binary.LittleEndian.Uint32(payload[7:])))
			pitch := float64(math.Float32frombits(binary.LittleEndian.Uint32(payload[11:])))
			if room := p.Room; room != nil {
				room.mu.Lock()
				room.TryFire(&p.PlayerState, yaw, pitch, mode, seen, shot, now)
				room.mu.Unlock()
			}
		case OpReload:
			if room := p.Room; room != nil {
				room.mu.Lock()
				room.StartReload(&p.PlayerState, now)
				room.mu.Unlock()
			}
		case OpGrenade:
			if len(payload) < 8 {
				continue
			}
			yaw := float64(math.Float32frombits(binary.LittleEndian.Uint32(payload)))
			pitch := float64(math.Float32frombits(binary.LittleEndian.Uint32(payload[4:])))
			if room := p.Room; room != nil && finite(yaw) && finite(pitch) {
				yaw = math.Remainder(yaw, 2*math.Pi)
				pitch = math.Max(-1.55, math.Min(1.55, pitch))
				room.mu.Lock()
				room.ThrowGrenade(&p.PlayerState, yaw, pitch, now)
				room.mu.Unlock()
			}
		case OpSwitch:
			if len(payload) < 1 {
				continue
			}
			if room := p.Room; room != nil {
				room.mu.Lock()
				if p.Alive {
					p.SwitchSlot(payload[0])
				}
				room.mu.Unlock()
			}
		case OpLoadout:
			if len(payload) < 2 || !validLoadout(payload[0], payload[1]) {
				continue
			}
			if room := p.Room; room != nil {
				room.mu.Lock()
				if !p.Alive {
					p.Primary, p.Secondary = payload[0], payload[1]
				}
				room.mu.Unlock()
			}
		case OpRosterRequest:
			if room := p.Room; room != nil {
				room.mu.Lock()
				p.rosterRequested = true
				room.mu.Unlock()
			}
		case OpPing:
			out := make([]byte, 5)
			out[0] = OpPong
			binary.LittleEndian.PutUint32(out[1:], uint32(max(0, min(outboundBPS.Load(), int64(^uint32(0))))))
			p.Send(out)
		}
	}
}

func (p *Player) Send(msg []byte) {
	if p.IsBot {
		return
	}
	p.sendMu.RLock()
	if p.closed || p.send == nil {
		p.sendMu.RUnlock()
		return
	}
	select {
	case p.send <- msg:
		p.sendMu.RUnlock()
	default:
		p.sendMu.RUnlock()
		droppedMessages.Add(1)
		p.closeOnce.Do(func() { go p.ws.Close() })
	}
}
func (p *Player) writePump() {
	defer p.ws.Close()
	for msg := range p.send {
		p.ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if err := p.ws.WriteMessage(websocket.BinaryMessage, msg); err != nil {
			return
		}
		outboundBytes.Add(int64(len(msg)))
	}
}

func sanitizeName(s string) string {
	s = strings.ToValidUTF8(s, "")
	r := []rune(strings.TrimSpace(s))
	if len(r) > 16 {
		r = r[:16]
	}
	out := r[:0]
	for _, c := range r {
		if c != '\n' && c != '\r' && c != '\t' && c != 0 && c != '<' && c != '>' && c != '"' && c != '\'' {
			out = append(out, c)
		}
	}
	return string(out)
}
func sanitizeFingerprint(s string) string {
	if len(s) > 96 {
		s = s[:96]
	}
	var b strings.Builder
	for _, c := range s {
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '-' {
			b.WriteRune(c)
		}
	}
	return b.String()
}
