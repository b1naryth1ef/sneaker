package server

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"
)

type sessionRadarSnapshotData struct {
	Offset  int64          `json:"offset"`
	Created []*StateObject `json:"created"`
	Updated []*StateObject `json:"updated"`
	Deleted []uint64       `json:"deleted"`
}

type sessionStateData struct {
	SessionId string         `json:"session_id"`
	Offset    int64          `json:"offset"`
	Objects   []*StateObject `json:"objects"`
}

type serverSession struct {
	sync.Mutex

	server *TacViewServerConfig

	subscriberIdx int
	subscribers   map[int]chan<- []byte
	state         sessionState
}

func newServerSession(server *TacViewServerConfig) (*serverSession, error) {
	return &serverSession{server: server, subscribers: make(map[int]chan<- []byte)}, nil
}

type PlayerMetadata struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

func (s *serverSession) GetPlayerList() []PlayerMetadata {
	players := []PlayerMetadata{}
	s.state.RLock()
	for _, object := range s.state.objects {
		isPlayer := false

		for _, typeName := range object.Types {
			if typeName == "Air" {
				isPlayer = true
				continue
			}
		}
		if !isPlayer {
			continue
		}

		pilotName, ok := object.Properties["Pilot"]
		if !ok {
			continue
		}

		if strings.HasPrefix(pilotName, object.Properties["Group"]) {
			continue
		}

		players = append(players, PlayerMetadata{
			Name: pilotName,
			Type: object.Properties["Name"],
		})
	}
	s.state.RUnlock()
	return players
}

func (s *serverSession) updateLoop() {
	refreshRate := time.Duration(5)
	if s.server.RadarRefreshRate != 0 {
		refreshRate = time.Duration(s.server.RadarRefreshRate)
	}
	ticker := time.NewTicker(time.Second * refreshRate)

	var currentOffset int64
	for {
		<-ticker.C

		if !s.state.active {
			continue
		}

		s.state.Lock()
		data := &sessionRadarSnapshotData{
			Offset:  s.state.offset,
			Created: make([]*StateObject, 0),
			Updated: make([]*StateObject, 0),
			Deleted: make([]uint64, 0),
		}

		for _, object := range s.state.objects {
			if object.Deleted {
				data.Deleted = append(data.Deleted, object.Id)
			} else if object.CreatedAt > currentOffset {
				data.Created = append(data.Created, object)
			} else if object.UpdatedAt > currentOffset {
				data.Updated = append(data.Updated, object)
			}
		}

		// We can now delete these objects from the state
		for _, objectId := range data.Deleted {
			delete(s.state.objects, objectId)
		}

		currentOffset = s.state.offset
		s.state.Unlock()

		s.publish("SESSION_RADAR_SNAPSHOT", data)
	}
}

func (s *serverSession) getInitialState() (*sessionStateData, []*StateObject) {
	s.state.RLock()
	defer s.state.RUnlock()

	if !s.state.active {
		return nil, nil
	}

	objects := make([]*StateObject, len(s.state.objects))

	idx := 0
	for _, object := range s.state.objects {
		objects[idx] = object
		idx += 1
	}

	return &sessionStateData{
		SessionId: s.state.sessionId,
		Offset:    s.state.offset,
	}, objects
}

func (s *serverSession) publish(event string, data interface{}) error {
	encoded, err := json.Marshal(map[string]interface{}{
		"e": event,
		"d": data,
	})
	if err != nil {
		return err
	}

	s.Lock()
	for id, sub := range s.subscribers {
		select {
		case sub <- encoded:
			continue
		default:
			log.Printf("[session:%v] subscriber %v non-responsive, closing", s.server.Name, id)
			delete(s.subscribers, id)
			close(sub)
		}
	}
	s.Unlock()
	return nil

}

func (s *serverSession) run() {
	go s.updateLoop()

	for {
		err := s.runTacViewClient()
		log.Printf("[session:%v] tacview client closed, reseting and reopening in 5 seconds (%v)", s.server.Name, err)
		time.Sleep(time.Second * 5)
	}
}

func (s *serverSession) runTacViewClient() error {
	client := NewTacViewClient(s.server.Hostname, s.server.Port, s.server.Password)
	header, timeFrameStream, err := client.Start()
	if err != nil {
		return err
	}

	err = s.state.initialize(header)
	if err != nil {
		return err
	}

	s.state.Lock()
	objects := make([]*StateObject, len(s.state.objects))
	var idx = 0
	for _, object := range s.state.objects {
		objects[idx] = object
		idx += 1
	}
	s.state.Unlock()

	log.Printf("[session:%v] tacview client session initialized", s.server.Name)
	s.publish("SESSION_STATE", &sessionStateData{
		SessionId: s.state.sessionId,
		Objects:   objects,
	})

	for {
		timeFrame, ok := <-timeFrameStream
		if !ok {
			return nil
		}

		s.state.Lock()
		s.state.update(timeFrame)
		s.state.Unlock()
	}
}

func (s *serverSession) removeSub(id int) {
	s.Lock()
	defer s.Unlock()
	delete(s.subscribers, id)
}

func (s *serverSession) addSub() (<-chan []byte, func()) {
	sub := make(chan []byte, 16)
	s.Lock()
	id := s.subscriberIdx
	s.subscribers[id] = sub
	s.subscriberIdx += 1
	s.Unlock()
	return sub, func() {
		s.removeSub(id)
	}
}
