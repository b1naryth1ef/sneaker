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

	EnableFriendlyGroundUnits bool `json:"enable_friendly_ground_units"`
	EnableEnemyGroundUnits    bool `json:"enable_enemy_ground_units"`
}
