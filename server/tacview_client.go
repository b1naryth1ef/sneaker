package server

import (
	"bufio"
	"errors"
	"fmt"
	"net"

	"github.com/b1naryth1ef/jambon/tacview"
)

type TacViewClient struct {
	host string
	port int
}

func NewTacViewClient(host string, port int) *TacViewClient {
	if port == 0 {
		port = 42674
	}

	return &TacViewClient{host: host, port: port}
}

func (c *TacViewClient) Start() (*tacview.Header, chan *tacview.TimeFrame, error) {
	conn, err := net.Dial("tcp", fmt.Sprintf("%s:%d", c.host, c.port))
	if err != nil {
		return nil, nil, err
	}

	reader := bufio.NewReader(conn)

	headerProtocol, err := reader.ReadString('\n')
	if err != nil {
		return nil, nil, err
	}
	if headerProtocol != "XtraLib.Stream.0\n" {
		return nil, nil, fmt.Errorf("bad header protocol: %v", headerProtocol)
	}

	headerVersion, err := reader.ReadString('\n')
	if err != nil {
		return nil, nil, err
	}
	if headerVersion != "Tacview.RealTimeTelemetry.0\n" {
		return nil, nil, fmt.Errorf("bad header version %v", headerVersion)
	}

	// Read hostaname
	_, err = reader.ReadString('\n')
	if err != nil {
		return nil, nil, err
	}

	eoh, err := reader.ReadByte()
	if err != nil {
		return nil, nil, err
	}

	if eoh != '\x00' {
		return nil, nil, errors.New("bad or missing end of header")
	}

	_, err = conn.Write([]byte("XtraLib.Stream.0\n"))
	if err != nil {
		return nil, nil, err
	}
	_, err = conn.Write([]byte("Tacview.RealTimeTelemetry.0\n"))
	if err != nil {
		return nil, nil, err
	}
	_, err = conn.Write([]byte("Client sneakerserver\n\x00\n"))
	if err != nil {
		return nil, nil, err
	}

	acmiReader, err := tacview.NewReader(reader)
	if err != nil {
		return nil, nil, err
	}

	data := make(chan *tacview.TimeFrame, 1)
	go acmiReader.ProcessTimeFrames(1, data)
	return &acmiReader.Header, data, nil
}
