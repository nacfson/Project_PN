package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	DefaultMaxConnLifetime       = 5 * time.Minute
	DefaultMaxConnLifetimeJitter = 30 * time.Second
	DefaultMaxConnIdleTime       = 2 * time.Minute
	DefaultHealthCheckPeriod     = 30 * time.Second
)

// ParsePoolConfig parses databaseURL and configures pool connection lifetimes
// well below the platform vault-db-proxy 15-minute cutoff.
func ParsePoolConfig(databaseURL string) (*pgxpool.Config, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	cfg.MaxConnLifetime = DefaultMaxConnLifetime
	cfg.MaxConnLifetimeJitter = DefaultMaxConnLifetimeJitter
	cfg.MaxConnIdleTime = DefaultMaxConnIdleTime
	cfg.HealthCheckPeriod = DefaultHealthCheckPeriod
	return cfg, nil
}

func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := ParsePoolConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}
