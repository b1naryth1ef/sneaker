package main

import (
	"log"
	"os"

	"github.com/b1naryth1ef/sneaker/desktop"
	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Name:  "sneaker-desktop",
		Usage: "AEW&C simulation display",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) error {
			desktop.NewApp().Run()
			return nil
		},
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}
