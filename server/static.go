package server

import (
	"bytes"
	"io/ioutil"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"github.com/b1naryth1ef/sneaker"
	"github.com/go-chi/chi/v5"
)

// Serves static assets from the embedded filesystem
func (h *httpServer) serveEmbeddedStaticAssets(w http.ResponseWriter, r *http.Request) {
	param := chi.URLParam(r, "*")

	ext := filepath.Ext(param)

	if param == "" || (ext != ".js" && ext != ".css" && ext != ".mp3") {
		param = "index.html"
	}

	log.Printf("HMMM %v", h.config.AssetsPath)
	if h.config.AssetsPath != nil {
		path := filepath.Join(*h.config.AssetsPath, param)
		_, err := filepath.Rel(*h.config.AssetsPath, path)
		if err != nil {
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}

		contents, err := ioutil.ReadFile(path)
		if err != nil {
			http.Error(w, "Error reading file", http.StatusInternalServerError)
			return
		}

		fileName := filepath.Base(param)
		http.ServeContent(w, r, fileName, time.Now(), bytes.NewReader(contents))
	} else {
		f, err := sneaker.Static.ReadFile("dist/" + param)
		if err != nil {
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}

		fileName := filepath.Base(param)

		http.ServeContent(w, r, fileName, time.Now(), bytes.NewReader(f))
	}
}
