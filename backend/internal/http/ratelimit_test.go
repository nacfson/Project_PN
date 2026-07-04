package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterAllowAtLimitBoundary(t *testing.T) {
	rl := newRateLimiter(30, time.Minute)
	ip := "1.2.3.4"

	for i := 0; i < 30; i++ {
		if !rl.allow(ip) {
			t.Fatalf("expected request %d to be allowed", i+1)
		}
	}

	if rl.allow(ip) {
		t.Fatal("expected request 31 to be denied")
	}
}

func TestRateLimiterWindowExpiry(t *testing.T) {
	rl := newRateLimiter(2, time.Second)
	ip := "1.2.3.4"

	if !rl.allow(ip) {
		t.Fatal("expected first request to be allowed")
	}
	if !rl.allow(ip) {
		t.Fatal("expected second request to be allowed")
	}
	if rl.allow(ip) {
		t.Fatal("expected third request to be denied within the window")
	}

	time.Sleep(1100 * time.Millisecond)

	if !rl.allow(ip) {
		t.Fatal("expected request to be allowed after window expiry")
	}
}

func TestRateLimiterDeniedRequestsNotRecorded(t *testing.T) {
	rl := newRateLimiter(2, time.Minute)
	ip := "1.2.3.4"

	if !rl.allow(ip) {
		t.Fatal("expected first request to be allowed")
	}
	if !rl.allow(ip) {
		t.Fatal("expected second request to be allowed")
	}

	for i := 0; i < 5; i++ {
		if rl.allow(ip) {
			t.Fatalf("expected denied request %d not to be recorded", i+1)
		}
	}

	if len(rl.visitors[ip]) != 2 {
		t.Fatalf("expected 2 recorded requests, got %d", len(rl.visitors[ip]))
	}
}

func TestClientIPFallsBackToRemoteAddr(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "192.168.1.1:1234"

	ip := clientIP(r)
	if ip != "192.168.1.1" {
		t.Fatalf("expected stripped RemoteAddr, got %q", ip)
	}
}

func TestRateLimiterMiddlewareDeniesOverLimit(t *testing.T) {
	rl := newRateLimiter(2, time.Minute)
	handler := rl.middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 2; i++ {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("expected OK, got %d", rec.Code)
		}
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rec.Code)
	}
}
