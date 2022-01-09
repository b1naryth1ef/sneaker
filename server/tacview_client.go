package server

import (
	"fmt"

	"github.com/b1naryth1ef/jambon/tacview"
)

type TacViewClient struct {
	host     string
	port     int
	password string
}

func NewTacViewClient(host string, port int, password string) *TacViewClient {
	if port == 0 {
		port = 42674
	}

	return &TacViewClient{host: host, port: port, password: password}
}

func (c *TacViewClient) Start() (*tacview.Header, chan *tacview.TimeFrame, error) {
	reader, err := tacview.NewRealTimeReader(fmt.Sprintf("%s:%d", c.host, c.port), "sneakerserver", c.password)
	if err != nil {
		return nil, nil, err
	}

	data := make(chan *tacview.TimeFrame, 1)
	go reader.ProcessTimeFrames(1, data)
	return &reader.Header, data, nil
}
