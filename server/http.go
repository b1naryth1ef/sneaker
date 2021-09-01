package server

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/b1naryth1ef/sneaker"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

const RADAR_REFRESH_RATE = time.Second * 2

type httpServer struct {
	sync.Mutex

	state *state
	id    int64
	subs  map[int64]chan []byte
}

func (h *httpServer) publishLoop() {
	ticker := time.NewTicker(RADAR_REFRESH_RATE)

	var lastUpdate int64 = 0
	for {
		<-ticker.C

		h.state.RLock()
		updated := make([]*StateObject, 0)
		deleted := make([]uint64, 0)
		for _, object := range h.state.objects {
			if object.Deleted {
				delete(h.state.objects, object.Id)
				deleted = append(deleted, object.Id)
				continue
			}
			if object.UpdatedAt > lastUpdate {
				updated = append(updated, object)
			}
		}
		lastUpdate = h.state.ts
		h.state.RUnlock()

		if len(updated) > 0 {
			data, err := json.Marshal(map[string]interface{}{
				"e": "CREATE",
				"o": updated,
			})
			if err != nil {
				log.Printf("JSON failed: %v", err)
				continue
			}
			h.Lock()
			for _, sub := range h.subs {
				sub <- data
			}
			h.Unlock()
		}

		if len(deleted) > 0 {
			data, err := json.Marshal(map[string]interface{}{
				"e":  "DELETE",
				"id": deleted,
			})
			if err != nil {
				log.Printf("JSON failed: %v", err)
				continue
			}
			h.Lock()
			for _, sub := range h.subs {
				sub <- data
			}
			h.Unlock()
		}

	}
}

func (h *httpServer) static(w http.ResponseWriter, r *http.Request) {
	param := chi.URLParam(r, "*")
	if param == "" {
		param = "index.html"
	}

	f, err := sneaker.Static.ReadFile("dist/" + param)
	if err != nil {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}

	fileName := filepath.Base(param)

	http.ServeContent(w, r, fileName, time.Now(), bytes.NewReader(f))
}

func (h *httpServer) events(w http.ResponseWriter, r *http.Request) {
	subChan := make(chan []byte)
	h.Lock()
	h.id += 1
	h.subs[h.id] = subChan
	h.Unlock()

	defer func() {
		h.Lock()
		delete(h.subs, h.id)
		h.Unlock()
	}()

	f, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Transfer-Encoding", "chunked")

	// Send initial data
	init := make([]*StateObject, 0)
	h.state.RLock()
	for _, object := range h.state.objects {
		if object.Deleted {
			continue
		}
		init = append(init, object)
	}
	h.state.RUnlock()

	data, err := json.Marshal(map[string]interface{}{
		"e": "CREATE",
		"o": init,
	})
	if err != nil {
		http.Error(w, "Failed to process internal data", http.StatusInternalServerError)
		return
	}

	go func() {
		subChan <- data
	}()

	for {
		msg, ok := <-subChan
		if !ok {
			return
		}

		outgoing := []byte("data: ")
		outgoing = append(outgoing, msg...)
		outgoing = append(outgoing, '\n', '\n')
		w.Write(outgoing)

		f.Flush()
	}

}

type Config struct {
	Bind          string
	TacViewServer string
}

func runClient(config *Config, state *state, server *httpServer) {
	client := NewTacViewClient(config)

	go server.publishLoop()

	err := client.Run(state)
	if err != nil {
		log.Printf("ERROR: %v", err)
	}

	time.Sleep(5)
	runClient(config, state, server)
}

func Run(config *Config) error {
	state := &state{}
	server := &httpServer{
		state: state,
		subs:  make(map[int64]chan []byte),
	}

	go runClient(config, state, server)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(

		cors.Handler(cors.Options{
			AllowedOrigins:   []string{"https://*", "http://*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			AllowCredentials: false,
			MaxAge:           300,
		}))

	r.Get("/*", server.static)
	r.Get("/events", server.events)
	return http.ListenAndServe(config.Bind, r)
}
