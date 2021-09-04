package server

import (
	"bytes"
	"net/http"
	"path/filepath"
	"time"

	"github.com/b1naryth1ef/sneaker"
	"github.com/go-chi/chi/v5"
)

// Serves static assets from the embedded filesystem
func serveEmbeddedStaticAssets(w http.ResponseWriter, r *http.Request) {
	param := chi.URLParam(r, "*")

	ext := filepath.Ext(param)

	if param == "" || (ext != ".js" && ext != ".css" && ext != ".mp3") {
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
