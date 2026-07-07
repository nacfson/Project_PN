package admin

import "sync"

// MetricsCollector holds request counters for periodic emission.
type MetricsCollector struct {
	mu             sync.Mutex
	requestCount   int64
	errorCount     int64
	totalLatencyMs int64
	activeUsers    map[string]struct{}
}

// NewMetricsCollector creates a collector with empty counters.
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{activeUsers: make(map[string]struct{})}
}

// RecordRequest updates counters with one request.
func (c *MetricsCollector) RecordRequest(statusCode int, latencyMs int64, userID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.requestCount++
	if statusCode >= 500 {
		c.errorCount++
	}
	c.totalLatencyMs += latencyMs
	if userID != "" {
		c.activeUsers[userID] = struct{}{}
	}
}

// Flush writes a METRICS line using the provided logger and resets counters.
func (c *MetricsCollector) Flush(logger Logger) {
	c.mu.Lock()
	count := c.requestCount
	errors := c.errorCount
	latency := c.totalLatencyMs
	users := len(c.activeUsers)
	c.requestCount = 0
	c.errorCount = 0
	c.totalLatencyMs = 0
	c.activeUsers = make(map[string]struct{})
	c.mu.Unlock()

	var avg int64
	if count > 0 {
		avg = latency / count
	}
	logger.Logf("METRICS", "last 60s: %d requests, %d errors, avg latency %dms, %d active users", count, errors, avg, users)
}
