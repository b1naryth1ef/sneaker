package server

import (
	"errors"
	"log"
	"strconv"
	"strings"
	"sync"

	"github.com/b1naryth1ef/jambon/tacview"
)

type StateObject struct {
	Id         uint64            `json:"id"`
	Types      []string          `json:"types"`
	Properties map[string]string `json:"properties"`
	Latitude   float64           `json:"latitude"`
	Longitude  float64           `json:"longitude"`
	Altitude   float64           `json:"altitude"`
	Heading    float64           `json:"heading"`
	Deleted    bool              `json:"-"`
	UpdatedAt  int64             `json:"-"`
}

func NewStateObject(ts int64, sourceObj *tacview.Object, coordBase [2]float64) (*StateObject, error) {
	obj := &StateObject{
		Id:         sourceObj.Id,
		Types:      []string{},
		Properties: make(map[string]string),
		Deleted:    false,
	}

	err := obj.update(ts, sourceObj, coordBase)
	if err != nil {
		return nil, err
	}

	return obj, nil
}

func (obj *StateObject) updateLocation(data string, coordBase [2]float64) error {
	parts := strings.Split(data, "|")

	if len(parts) >= 3 {
		if parts[0] != "" {
			lng, err := strconv.ParseFloat(parts[0], 64)
			if err != nil {
				return err
			}
			obj.Longitude = lng + coordBase[1]
		}

		if parts[1] != "" {
			lat, err := strconv.ParseFloat(parts[1], 64)
			if err != nil {
				return err
			}
			obj.Latitude = lat + coordBase[0]
		}

		if parts[2] != "" {
			alt, err := strconv.ParseFloat(parts[2], 64)
			if err != nil {
				return err
			}
			obj.Altitude = alt
		}

		if len(parts) == 9 && parts[8] != "" {
			heading, err := strconv.ParseFloat(parts[8], 64)
			if err != nil {
				return err
			}
			obj.Heading = heading
		}
	}
	return nil
}

func (obj *StateObject) update(ts int64, sourceObj *tacview.Object, coordBase [2]float64) error {
	if sourceObj.Deleted {
		obj.Deleted = true
	} else {
		for _, prop := range sourceObj.Properties {
			if prop.Key == "T" {
				err := obj.updateLocation(prop.Value, coordBase)
				if err != nil {
					return err
				}
			} else if prop.Key == "Type" {
				obj.Types = strings.Split(prop.Value, "+")
			} else {
				obj.Properties[prop.Key] = prop.Value
			}
		}
	}
	obj.UpdatedAt = ts
	return nil
}

// Internal GCI server state
type state struct {
	sync.RWMutex

	// Base to use for all incoming coordinates
	coordBase [2]float64

	// Tracked objects
	objects map[uint64]*StateObject

	ts int64
}

// Called when our connection is interrupted
func (s *state) reset() {
	s.Lock()
	defer s.Unlock()
	s.objects = make(map[uint64]*StateObject)
}

// Called when the tacview stream starts
func (s *state) initialize(header *tacview.Header) error {
	s.reset()

	s.Lock()
	defer s.Unlock()
	globalObj := header.InitialTimeFrame.Get(0)
	if globalObj == nil {
		return errors.New("TacView initial time frame is missing global object")
	}

	refLat := globalObj.Get("ReferenceLatitude")
	refLng := globalObj.Get("ReferenceLongitude")

	if refLat != nil && refLng != nil {
		refLatF, err := strconv.ParseFloat(refLat.Value, 64)
		if err != nil {
			return err
		}
		refLngF, err := strconv.ParseFloat(refLng.Value, 64)
		if err != nil {
			return err
		}

		s.coordBase = [2]float64{refLatF, refLngF}
	} else {
		s.coordBase = [2]float64{0.0, 0.0}
	}

	s.update(&header.InitialTimeFrame)
	return nil
}

func (s *state) update(tf *tacview.TimeFrame) {
	s.ts = int64(tf.Offset)
	for _, object := range tf.Objects {
		if _, exists := s.objects[object.Id]; exists {
			s.objects[object.Id].update(int64(tf.Offset), object, s.coordBase)
		} else {
			stateObj, err := NewStateObject(int64(tf.Offset), object, s.coordBase)
			if err != nil {
				log.Printf("Error processing object: %v", err)
				continue
			}

			s.objects[object.Id] = stateObj
		}
	}
}
