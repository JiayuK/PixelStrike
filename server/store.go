package main

import (
	"database/sql"
	"log"
	"math"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db      *sql.DB
	ch      chan delta
	flushCh chan chan struct{}
	stopCh  chan chan struct{}
	cacheMu sync.RWMutex
	cache   map[string]string
}

type delta struct {
	name   string
	kills  int
	deaths int
}

func NewStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	for _, schema := range []string{
		`CREATE TABLE IF NOT EXISTS stats(
			name TEXT PRIMARY KEY,
			ip TEXT DEFAULT '',
			fingerprint TEXT DEFAULT '',
			kills INTEGER DEFAULT 0,
			deaths INTEGER DEFAULT 0,
			money INTEGER DEFAULT 0,
			updated_at INTEGER)`,
		`CREATE TABLE IF NOT EXISTS meta(
			key TEXT PRIMARY KEY, val INTEGER DEFAULT 0)`,
	} {
		if _, err := db.Exec(schema); err != nil {
			return nil, err
		}
	}
	// Migrate pre-binding databases: CREATE TABLE IF NOT EXISTS won't add
	// columns to an existing stats table.
	for _, col := range []string{"ip", "fingerprint"} {
		var have int
		if err := db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('stats') WHERE name=?`, col).Scan(&have); err == nil && have == 0 {
			if _, err := db.Exec("ALTER TABLE stats ADD COLUMN " + col + " TEXT DEFAULT ''"); err != nil {
				return nil, err
			}
		}
	}
	// Clean up historical bot records from persistent stats ([BOT] in-game
	// bots plus legacy tools/bots.mjs load-test names).
	_, _ = db.Exec(`DELETE FROM stats WHERE name LIKE '[BOT]%' OR name LIKE 'bot%' OR name LIKE 'CombatBot%'
		OR name LIKE 'Duel[AB]%' OR name LIKE 'load-%'
		OR name IN ('VoxelKing','ShadowSniper','ApexGhost','ViperZero','Phoenix','Maverick','CyberWolf',
			'Soldier','VoxelMaster','BugHunter','ColTest','Commander','Tester','ApexHunter','General')`)

	s := &Store{
		db:      db,
		ch:      make(chan delta, 4096),
		flushCh: make(chan chan struct{}, 16),
		stopCh:  make(chan chan struct{}, 1),
		cache:   make(map[string]string),
	}
	go s.writer()
	return s, nil
}

const upsert = `INSERT INTO stats(name,kills,deaths,updated_at) VALUES(?,?,?,strftime('%s','now'))
	ON CONFLICT(name) DO UPDATE SET kills=kills+excluded.kills,
	deaths=deaths+excluded.deaths, updated_at=excluded.updated_at`

func (s *Store) writer() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	batch := make(map[string]delta)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		tx, err := s.db.Begin()
		if err != nil {
			log.Printf("store begin: %v", err)
			return
		}
		for _, d := range batch {
			if _, err := tx.Exec(upsert, d.name, d.kills, d.deaths); err != nil {
				log.Printf("store upsert: %v", err)
			}
		}
		if err := tx.Commit(); err != nil {
			log.Printf("store commit: %v", err)
		}
		batch = make(map[string]delta)
	}
	for {
		select {
		case <-ticker.C:
			flush()
		case d := <-s.ch:
			acc := batch[d.name]
			acc.name = d.name
			acc.kills += d.kills
			acc.deaths += d.deaths
			batch[d.name] = acc
		case done := <-s.flushCh:
			// Drain all pending deltas in channel before flushing
			for {
				select {
				case d := <-s.ch:
					acc := batch[d.name]
					acc.name = d.name
					acc.kills += d.kills
					acc.deaths += d.deaths
					batch[d.name] = acc
				default:
					goto drained
				}
			}
		drained:
			flush()
			if done != nil {
				close(done)
			}
		case done := <-s.stopCh:
			for {
				select {
				case d := <-s.ch:
					acc := batch[d.name]
					acc.name = d.name
					acc.kills += d.kills
					acc.deaths += d.deaths
					batch[d.name] = acc
				default:
					flush()
					close(done)
					return
				}
			}
		}
	}
}

// Accumulate queues a stat change; persisted on the next 30s tick.
func (s *Store) Accumulate(name string, kills, deaths int) {
	select {
	case s.ch <- delta{name, kills, deaths}:
	default:
		log.Printf("store queue full, dropping stats for %q", name)
	}
}

// Flush persists all pending changes immediately.
func (s *Store) Flush() {
	done := make(chan struct{})
	select {
	case s.flushCh <- done:
		<-done
	default:
	}
}

// Invalidate drops the cached account for a disconnecting player.
func (s *Store) Invalidate(ip, fp string) {
	key := fp
	if key == "" {
		key = ip
	}
	if key == "" {
		return
	}
	s.cacheMu.Lock()
	delete(s.cache, key)
	s.cacheMu.Unlock()
}

func (s *Store) GetOrCreatePlayer(ip, fp, name string) string {
	key := fp
	if key == "" {
		key = ip
	}
	if key != "" {
		s.cacheMu.RLock()
		cached, ok := s.cache[key]
		s.cacheMu.RUnlock()
		if ok {
			return cached
		}

		var existingName string
		var err error
		if fp != "" {
			err = s.db.QueryRow(`SELECT name FROM stats WHERE fingerprint = ? LIMIT 1`, fp).Scan(&existingName)
		} else {
			err = s.db.QueryRow(`SELECT name FROM stats WHERE ip != '' AND ip = ? LIMIT 1`, ip).Scan(&existingName)
		}
		if err == nil && existingName != "" {
			// Backfill whichever of ip/fingerprint was missing so both stay
			// uniquely bound to this one account row.
			_, _ = s.db.Exec(`UPDATE stats SET fingerprint=CASE WHEN fingerprint='' THEN ?2 ELSE fingerprint END,
				ip=CASE WHEN ip='' THEN ?1 ELSE ip END WHERE name=?3`, ip, fp, existingName)
			s.cacheMu.Lock()
			s.cache[key] = existingName
			s.cacheMu.Unlock()
			return existingName
		}
	}

	// New player: insert or update record
	_, _ = s.db.Exec(`INSERT INTO stats(name, ip, fingerprint, updated_at) VALUES(?, ?, ?, strftime('%s','now')) ON CONFLICT(name) DO UPDATE SET ip=excluded.ip, fingerprint=excluded.fingerprint`, name, ip, fp)
	if key != "" {
		s.cacheMu.Lock()
		s.cache[key] = name
		s.cacheMu.Unlock()
	}
	return name
}

type LeaderRow struct {
	Name   string  `json:"name"`
	Kills  uint32  `json:"kills"`
	Deaths uint32  `json:"deaths"`
	KD     float64 `json:"kd"`
}

func (s *Store) Leaderboard(n int) ([]LeaderRow, error) {
	// Flush pending in-memory batch before querying leaderboard
	done := make(chan struct{})
	select {
	case s.flushCh <- done:
		<-done
	default:
	}

	rows, err := s.db.Query(
		`SELECT name, kills, deaths FROM stats WHERE kills + deaths > 0
			AND name NOT LIKE '[BOT]%' AND name NOT LIKE 'load-%'
			AND name NOT IN ('VoxelKing','ShadowSniper','ApexGhost','ViperZero','Phoenix','Maverick','CyberWolf',
				'Soldier','VoxelMaster','BugHunter','ColTest','Commander','Tester','ApexHunter','General')
			ORDER BY kills DESC, deaths ASC LIMIT ?`, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LeaderRow{}
	for rows.Next() {
		var r LeaderRow
		var name sql.NullString
		var k, d int64
		if err := rows.Scan(&name, &k, &d); err != nil {
			log.Printf("leaderboard scan error: %v", err)
			continue
		}
		r.Name = name.String
		r.Kills = uint32(k)
		r.Deaths = uint32(d)
		if d == 0 {
			r.KD = float64(k)
		} else {
			r.KD = math.Round(float64(k)/float64(d)*100) / 100
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// IncrMeta atomically bumps a named counter and returns the new value.
func (s *Store) IncrMeta(key string, by int64) int64 {
	var v int64
	err := s.db.QueryRow(`INSERT INTO meta(key,val) VALUES(?,?)
		ON CONFLICT(key) DO UPDATE SET val=val+excluded.val RETURNING val`, key, by).Scan(&v)
	if err != nil {
		return 0
	}
	return v
}

func (s *Store) GetMeta(key string) int64 {
	var v int64
	s.db.QueryRow(`SELECT val FROM meta WHERE key=?`, key).Scan(&v)
	return v
}

func (s *Store) Close() error {
	done := make(chan struct{})
	s.stopCh <- done
	<-done
	return s.db.Close()
}
