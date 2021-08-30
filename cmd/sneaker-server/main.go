package main

import (
	"log"
	"os"

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
			&cli.StringFlag{
				Name:     "tacview-server",
				Required: true,
				Usage:    "connection string to the tacview realtime telemetry server",
			},
		},
		Action: func(c *cli.Context) error {
			var config server.Config
			config.Bind = c.String("bind")
			config.TacViewServer = c.String("tacview-server")
			return server.Run(&config)
		},
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}
