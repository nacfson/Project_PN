package admin

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestStreamLogger_AuthFailureUsesErrorLevel(t *testing.T) {
	var buf bytes.Buffer
	l := NewWriterLogger(&buf)
	l.Logf("AUTH_FAILURE", "ensure platform user on callback failed: unexpected EOF")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}
	if got["level"] != "error" {
		t.Fatalf("expected level=error for AUTH_FAILURE, got %v", got["level"])
	}
	if got["category"] != "AUTH_FAILURE" {
		t.Fatalf("expected category=AUTH_FAILURE, got %v", got["category"])
	}
}

func TestStreamLogger_NormalAuthUsesInfoLevel(t *testing.T) {
	var buf bytes.Buffer
	l := NewWriterLogger(&buf)
	l.Logf("AUTH", "user signed in")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}
	if got["level"] != "info" {
		t.Fatalf("expected level=info for AUTH, got %v", got["level"])
	}
}
