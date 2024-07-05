//go:generate goversioninfo
package main

import (
	"encoding/json"
	"io/ioutil"
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
				Usage: "the server bind address",
			},
			&cli.PathFlag{
				Name:     "config",
				Usage:    "path to configuration file",
				Required: true,
			},
		},
		Action: func(c *cli.Context) error {
			var config server.Config

			configData, err := ioutil.ReadFile(c.Path("config"))
			if err != nil {
				return err
			}

			err = json.Unmarshal(configData, &config)
			if err != nil {
				return err
			}

			if c.IsSet("bind") {
				config.Bind = c.String("bind")
			}
			if config.Bind == "" {
				config.Bind = "localhost:7788"
			}

			return server.Run(&config)
		},
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}
