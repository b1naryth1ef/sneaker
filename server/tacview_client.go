package server

import (
	"bufio"
	"errors"
	"fmt"
	"net"
	"strings"

	"github.com/b1naryth1ef/jambon/tacview"
)

type TacViewClient struct {
	config *Config
	reader tacview.Reader
}

func NewTacViewClient(config *Config) *TacViewClient {
	return &TacViewClient{
		config: config,
	}
}

func (c *TacViewClient) Run(state *state) error {
	connString := c.config.TacViewServer
	if !strings.ContainsRune(connString, ':') {
		connString = connString + ":42674"
	}

	conn, err := net.Dial("tcp", connString)
	if err != nil {
		return err
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)

	headerProtocol, err := reader.ReadString('\n')
	if err != nil {
		return err
	}
	if headerProtocol != "XtraLib.Stream.0\n" {
		return fmt.Errorf("bad header protocol: %v", headerProtocol)
	}

	headerVersion, err := reader.ReadString('\n')
	if err != nil {
		return err
	}
	if headerVersion != "Tacview.RealTimeTelemetry.0\n" {
		return fmt.Errorf("bad header version %v", headerVersion)
	}

	// Read hostaname
	_, err = reader.ReadString('\n')
	if err != nil {
		return err
	}

	eoh, err := reader.ReadByte()
	if err != nil {
		return err
	}

	if eoh != '\x00' {
		return errors.New("bad or missing end of header")
	}

	_, err = conn.Write([]byte("XtraLib.Stream.0\n"))
	if err != nil {
		return err
	}
	_, err = conn.Write([]byte("Tacview.RealTimeTelemetry.0\n"))
	if err != nil {
		return err
	}
	_, err = conn.Write([]byte("Client sneakerserver\n\x00\n"))
	if err != nil {
		return err
	}

	acmiReader, err := tacview.NewReader(reader)
	if err != nil {
		return err
	}

	err = state.initialize(&acmiReader.Header)
	if err != nil {
		return err
	}

	data := make(chan *tacview.TimeFrame)
	go acmiReader.ProcessTimeFrames(1, data)

	for {
		tf := <-data
		state.Lock()
		state.update(tf)
		state.Unlock()
	}
}
