package main

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	port := envOr("PORT", "8080")
	dbPath := envOr("DB_PATH", "./stats.db")
	mapPath := envOr("MAP_PATH", "../map.json")
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	adminPasswordHash := sha256.Sum256([]byte(adminPassword))

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
		if allowedOrigin != "" && r.Header.Get("Origin") != allowedOrigin {
			http.Error(w, "forbidden origin", http.StatusForbidden)
			return
		}
		ServeWS(hub, w, r, allowedOrigin)
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
	mux.HandleFunc("/api/visit", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		visits := store.IncrMeta("visits", 1)
		json.NewEncoder(w).Encode(map[string]int64{"visits": visits})
	})
	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		p50, p95, p99 := tickPercentiles()
		hub.mu.Lock()
		rooms := len(hub.rooms)
		hub.mu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{
			"visits":          store.GetMeta("visits"),
			"totalJoins":      store.GetMeta("total_joins"),
			"online":          OnlinePlayers.Load(),
			"rooms":           rooms,
			"outboundBytes":   outboundBytes.Load(),
			"outboundBps":     outboundBPS.Load(),
			"droppedMessages": droppedMessages.Load(),
			"tickP50Ms":       p50,
			"tickP95Ms":       p95,
			"tickP99Ms":       p99,
		})
	})
	mux.HandleFunc("/api/admin/bots", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		if adminPassword == "" {
			http.Error(w, `{"error":"admin password is not configured"}`, http.StatusServiceUnavailable)
			return
		}
		provided := sha256.Sum256([]byte(r.Header.Get("X-Admin-Password")))
		if subtle.ConstantTimeCompare(provided[:], adminPasswordHash[:]) != 1 {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		switch r.Method {
		case http.MethodGet:
			count, rooms := hub.BotStatus()
			json.NewEncoder(w).Encode(map[string]int{"bots": count, "rooms": rooms})
		case http.MethodPost:
			r.Body = http.MaxBytesReader(w, r.Body, 1024)
			var request struct {
				Bots int `json:"bots"`
			}
			decoder := json.NewDecoder(r.Body)
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&request); err != nil || decoder.Decode(&struct{}{}) != io.EOF || request.Bots < 0 || request.Bots > len(BotNames) {
				http.Error(w, `{"error":"bots must be an integer from 0 to 12"}`, http.StatusBadRequest)
				return
			}
			count, rooms := hub.SetBotCount(request.Bots)
			json.NewEncoder(w).Encode(map[string]int{"bots": count, "rooms": rooms})
		default:
			w.Header().Set("Allow", "GET, POST")
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})
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
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
