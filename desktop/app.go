package desktop

import (
	rl "github.com/gen2brain/raylib-go/raylib"
)

type App struct {
}

func NewApp() *App {
	return &App{}
}

func (a *App) Run() {
	rl.InitWindow(800, 450, "sneaker")
	rl.SetTargetFPS(144)

	for !rl.WindowShouldClose() {
		rl.BeginDrawing()
		rl.ClearBackground(rl.DarkGray)
		a.Draw()
		rl.EndDrawing()
	}

	rl.CloseWindow()
}

func (a *App) Draw() {

}
