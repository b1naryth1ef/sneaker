package server

type Config struct {
	Bind    string                `json:"bind"`
	Servers []TacViewServerConfig `json:"servers"`
}

type TacViewServerConfig struct {
	Name     string `json:"name"`
	Hostname string `json:"hostname"`

	RadarRefreshRate int64  `json:"radar_refresh_rate"`
	Port             int    `json:"port"`
	Password         string `json:"password"`
}
