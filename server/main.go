package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

func main() {
	port := envOr("PORT", "8080")
	dbPath := envOr("DB_PATH", "./stats.db")
	mapPath := envOr("MAP_PATH", "../map.json")
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	trustedProxies, err := NewIPResolver(os.Getenv("TRUSTED_PROXY_CIDRS"))
	if err != nil {
		log.Fatalf("trusted proxies: %v", err)
	}
	secureAdminCookie, err := strconv.ParseBool(envOr("ADMIN_COOKIE_SECURE", "false"))
	if err != nil {
		log.Fatalf("ADMIN_COOKIE_SECURE: %v", err)
	}

	if _, err := os.Stat(mapPath); err != nil {
		// also try next to the executable
		exe, _ := os.Executable()
		alt := filepath.Join(filepath.Dir(exe), filepath.Base(mapPath))
		if _, err2 := os.Stat(alt); err2 == nil {
			mapPath = alt
		} else {
			log.Fatalf("map.json not found at %s: %v", mapPath, err)
		}
	}
	world, err := LoadWorld(mapPath)
	if err != nil {
		log.Fatalf("load world: %v", err)
	}
	log.Printf("world loaded: %d blocks, %d spawns", len(world.Blocks), len(world.Spawns))

	store, err := NewStore(dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer store.Close()

	hub := NewHub(world, store)
	stopMetrics := startMetrics()
	defer stopMetrics()
	mux := http.NewServeMux()
	mux.HandleFunc("/map.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("ETag", fmt.Sprintf("\"%08x\"", world.Revision))
		if r.Header.Get("If-None-Match") == fmt.Sprintf("\"%08x\"", world.Revision) {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Write(world.rawJSON)
	})
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r, allowedOrigin, trustedProxies)
	})
	mux.HandleFunc("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rows, err := store.Leaderboard(20)
		if err != nil {
			http.Error(w, `{"error":"db"}`, http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(rows)
	})
	mux.HandleFunc("/api/progression", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		ip := trustedProxies.ClientIP(r)
		if ip == "" {
			http.Error(w, `{"error":"invalid client address"}`, http.StatusBadRequest)
			return
		}
		progress, err := store.WeaponProgressForIP(ip)
		if err != nil {
			http.Error(w, `{"error":"db"}`, http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"weapons":      progress,
			"goldKills":    GoldKillRequirement,
			"diamondKills": DiamondKillRequirement,
		})
	})
	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(runtimeStats(hub, store))
	})
	registerAdminHandlers(mux, hub, store, adminPassword, trustedProxies, secureAdminCookie)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		log.Printf("listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	hub.Broadcast(Maintenance(2))
	time.Sleep(500 * time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func runtimeStats(hub *Hub, store *Store) map[string]any {
	p50, p95, p99 := tickPercentiles()
	hub.mu.Lock()
	rooms := len(hub.rooms)
	hub.mu.Unlock()
	return map[string]any{
		"totalJoins":      store.GetMeta("total_joins"),
		"online":          OnlinePlayers.Load(),
		"rooms":           rooms,
		"outboundBytes":   outboundBytes.Load(),
		"outboundBps":     outboundBPS.Load(),
		"droppedMessages": droppedMessages.Load(),
		"tickP50Ms":       p50,
		"tickP95Ms":       p95,
		"tickP99Ms":       p99,
	}
}
