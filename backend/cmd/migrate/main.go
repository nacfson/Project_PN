package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"

	"project-pn/internal/config"
	"project-pn/internal/logx"
	"project-pn/internal/migrations"
)

var version = "v0.0.0"

func main() {
	slog.SetDefault(logx.New(os.Stderr, "pn-api", version))
	var steps int
	flag.IntVar(&steps, "steps", 1, "number of migration steps for down")
	flag.Parse()

	command := "up"
	if flag.NArg() > 0 {
		command = flag.Arg(0)
	}

	cfg := config.Load()

	switch command {
	case "up":
		if err := migrations.Up(cfg.MigrationsPath, cfg.DatabaseURL); err != nil {
			slog.Error("migration up failed", "error", err)
			os.Exit(1)
		}
	case "down":
		if steps < 1 {
			slog.Error("steps must be positive")
			os.Exit(1)
		}
		if err := migrations.Down(cfg.MigrationsPath, cfg.DatabaseURL, steps); err != nil {
			slog.Error("migration down failed", "error", err)
			os.Exit(1)
		}
	case "version":
		version, dirty, err := migrations.Version(cfg.MigrationsPath, cfg.DatabaseURL)
		if err != nil {
			slog.Error("migration version failed", "error", err)
			os.Exit(1)
		}
		fmt.Printf("version=%d dirty=%t\n", version, dirty)
	default:
		slog.Error("unknown migration command", "command", command)
		os.Exit(1)
	}
}
