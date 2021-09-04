package server

type DCSServer struct {
	Name             string `json:"name"`
	RadarRefreshRate int64  `json:"radar_refresh_rate"`

	// Private details for connecting
	Hostname string `json:"-"`
	Port     int    `json:"-"`
	Password string `json:"-"`
}
