package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/b1naryth1ef/sneaker/server"
	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Name:  "sneaker-server",
		Usage: "tacview realtime telemetry relay server",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "bind",
				Value: "localhost:7788",
				Usage: "the server bind address",
			},
			&cli.StringSliceFlag{
				Name:     "server",
				Required: true,
				Usage:    "provide a server connection in format name:host(:port(:password))",
			},
		},
		Action: func(c *cli.Context) error {
			var config server.Config
			config.Bind = c.String("bind")

			var servers = c.StringSlice(("server"))
			if len(servers) == 0 {
				return errors.New("no servers provided")
			}

			config.Servers = make([]server.DCSServer, len(servers))
			for idx, serverString := range servers {
				parts := strings.SplitN(serverString, ":", 4)
				if len(parts) < 2 {
					return fmt.Errorf("Failed to parse server connection: %v", serverString)
				}

				var (
					port int64
					err  error
				)
				if len(parts) >= 3 {
					port, err = strconv.ParseInt(parts[2], 10, 64)
					if err != nil {
						return err
					}
				}

				var password string
				if len(parts) == 4 {
					password = parts[3]
				}

				config.Servers[idx] = server.DCSServer{
					Name:             parts[0],
					RadarRefreshRate: 5,
					Hostname:         parts[1],
					Port:             int(port),
					Password:         password,
				}
			}
			return server.Run(&config)
		},
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}
