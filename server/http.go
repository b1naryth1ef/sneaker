package server

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/alioygur/gores"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type httpServer struct {
	sync.Mutex

	config   *Config
	sessions map[string]*serverSession
	discord  *DiscordIntegration
}

func newHttpServer(config *Config) *httpServer {
	return &httpServer{
		config:   config,
		sessions: make(map[string]*serverSession),
	}
}

func (h *httpServer) getServerMetadata(server *TacViewServerConfig) serverMetadata {
	result := serverMetadata{
		Name:            server.Name,
		GroundUnitModes: getGroundUnitModes(server),
		GCIs:            []gciMetadata{},
	}

	session, err := h.getOrCreateSession(server.Name)
	if err == nil {
		result.Players = session.GetPlayerList()
	}

	if h.discord != nil {
		gciList := h.discord.GetGCIList(server.Name)
		for _, gciState := range gciList {
			result.GCIs = append(result.GCIs, gciMetadata{
				Id:        gciState.DiscordId,
				Notes:     gciState.Notes,
				ExpiresAt: gciState.ExpiresAt,
			})
		}
	}

	return result
}

// Returns a list of available servers
func (h *httpServer) getServerList(w http.ResponseWriter, r *http.Request) {
	result := make([]serverMetadata, len(h.config.Servers))
	for idx, server := range h.config.Servers {
		// note: safe, we're not leaking this reference anywhere
		result[idx] = h.getServerMetadata(&server)

	}

	gores.JSON(w, 200, result)
}

type serverMetadata struct {
	Name            string           `json:"name"`
	GroundUnitModes []string         `json:"ground_unit_modes"`
	Players         []PlayerMetadata `json:"players"`
	GCIs            []gciMetadata    `json:"gcis"`
}

func getGroundUnitModes(config *TacViewServerConfig) []string {
	result := []string{}
	if config.EnableEnemyGroundUnits {
		result = append(result, "enemy")
	}
	if config.EnableFriendlyGroundUnits {
		result = append(result, "friendly")
	}
	return result
}

func (h *httpServer) ensureServer(w http.ResponseWriter, r *http.Request) *TacViewServerConfig {
	serverName := chi.URLParam(r, "serverName")

	var server *TacViewServerConfig
	for _, checkServer := range h.config.Servers {
		if checkServer.Name == serverName {
			server = &checkServer
			break
		}
	}
	if server == nil {
		gores.Error(w, 404, "server not found")
		return nil
	}
	return server
}

type gciMetadata struct {
	Id        string    `json:"id"`
	Notes     string    `json:"notes"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Return information about a specific server
func (h *httpServer) getServer(w http.ResponseWriter, r *http.Request) {
	server := h.ensureServer(w, r)
	if server == nil {
		return
	}

	gores.JSON(w, 200, h.getServerMetadata(server))
}

var errNoServerFound = errors.New("no server by that name was found")

func (h *httpServer) getOrCreateSession(serverName string) (*serverSession, error) {
	h.Lock()
	defer h.Unlock()

	existingSession := h.sessions[serverName]
	if existingSession != nil {
		return existingSession, nil
	}

	var server *TacViewServerConfig
	for _, checkServer := range h.config.Servers {
		if checkServer.Name == serverName {
			server = &checkServer
			break
		}
	}
	if server == nil {
		return nil, errNoServerFound
	}

	var err error
	h.sessions[serverName], err = newServerSession(server)
	if err != nil {
		return nil, err
	}

	go h.sessions[serverName].run()
	return h.sessions[serverName], nil
}

// Streams events for a given server
func (h *httpServer) streamServerEvents(w http.ResponseWriter, r *http.Request) {
	session, err := h.getOrCreateSession(chi.URLParam(r, "serverName"))
	if err != nil {
		if err == errNoServerFound {
			gores.Error(w, 404, "server not found")
			return
		}

		gores.Error(w, 500, "failed to find or create server session")
		return
	}

	sub, subCloser := session.addSub()
	defer subCloser()

	f, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Transfer-Encoding", "chunked")

	publish := func(event string, data interface{}) {
		encoded, err := json.Marshal(map[string]interface{}{
			"e": event,
			"d": data,
		})
		if err != nil {
			return
		}

		outgoing := []byte("data: ")
		outgoing = append(outgoing, encoded...)
		outgoing = append(outgoing, '\n', '\n')
		w.Write(outgoing)
		f.Flush()
	}

	// Send initial data
	initialStateData, objects := session.getInitialState()
	if initialStateData != nil {
		publish("SESSION_STATE", initialStateData)

		publish("SESSION_RADAR_SNAPSHOT", &sessionRadarSnapshotData{
			Offset:  initialStateData.Offset,
			Created: objects,
			Updated: []*StateObject{},
			Deleted: []uint64{},
		})
	}

	done := make(chan struct{})
	notify := w.(middleware.WrapResponseWriter).Unwrap().(http.CloseNotifier).CloseNotify()
	go func() {
		<-notify
		close(done)
		log.Printf("Connection closed")
	}()

	for {
		select {
		case msg, ok := <-sub:
			if !ok {
				return
			}

			outgoing := []byte("data: ")
			outgoing = append(outgoing, msg...)
			outgoing = append(outgoing, '\n', '\n')
			w.Write(outgoing)
			f.Flush()
		case <-done:
			return
		}

	}
}

func Run(config *Config) error {
	server := newHttpServer(config)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		server.serveEmbeddedFile("index.html", w, r)
	})
	r.Get("/static/*", server.serveEmbeddedStaticAssets)
	r.Get("/api/servers", server.getServerList)
	r.Get("/api/servers/{serverName}", server.getServer)
	r.Get("/api/servers/{serverName}/events", server.streamServerEvents)

	if config.Discord != nil {
		server.discord = NewDiscordIntegration(server, config.Discord)
		r.Handle("/api/discord/*", server.discord)

		err := server.discord.Setup()
		if err != nil {
			log.Panicf("Failed to setup discord integration: %v", err)
		}
	}

	log.Printf("Starting up %v Tacview clients", len(config.Servers))
	for _, serverConfig := range config.Servers {
		server.getOrCreateSession(serverConfig.Name)
	}

	return http.ListenAndServe(config.Bind, r)
}
