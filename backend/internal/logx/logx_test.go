package logx_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"project-pn/internal/logx"
)

func TestLineHasRequiredKeys(t *testing.T) {
	var buf bytes.Buffer
	logx.New(&buf, "pn-api", "v1.4.2").Info("hello")

	var m map[string]any
	if err := json.Unmarshal(buf.Bytes(), &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, k := range []string{"time", "level", "msg", "service.name", "service.version"} {
		if _, ok := m[k]; !ok {
			t.Fatalf("missing %s in %s", k, buf.String())
		}
	}
	if m["service.name"] != "pn-api" {
		t.Fatalf("service.name = %v, want pn-api", m["service.name"])
	}
	if m["service.version"] != "v1.4.2" {
		t.Fatalf("service.version = %v, want v1.4.2", m["service.version"])
	}
	timeRe := regexp.MustCompile(`^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$`)
	if !timeRe.MatchString(m["time"].(string)) {
		t.Fatalf("time %q is not RFC 3339 UTC with milliseconds", m["time"])
	}
}

func TestErrorAttrBecomesException(t *testing.T) {
	var buf bytes.Buffer
	wrapped := fmt.Errorf("enrich word 4812: %w", context.DeadlineExceeded)
	logx.New(&buf, "pn-api", "v1.4.2").Error("enrich failed", "error", wrapped)

	var m map[string]any
	if err := json.Unmarshal(buf.Bytes(), &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if m["level"] != "ERROR" {
		t.Fatalf("level = %v, want ERROR", m["level"])
	}
	if m["exception.message"] != "enrich word 4812: context deadline exceeded" {
		t.Fatalf("exception.message = %v", m["exception.message"])
	}
	if m["exception.type"] != "context.deadlineExceededError" {
		t.Fatalf("exception.type = %v, want context.deadlineExceededError (never *fmt.wrapError)", m["exception.type"])
	}
	if _, ok := m["error"]; ok {
		t.Fatal("top-level error attr must be renamed to exception.*")
	}
}

func TestExceptionHelperUnwrapsInnermost(t *testing.T) {
	root := &url.Error{Op: "Post", URL: "https://api.example.com", Err: nil}
	wrapped := fmt.Errorf("layer 2: %w", fmt.Errorf("layer 1: %w", root))
	joined := errors.Join(errors.New("sentinel"), wrapped)

	attrs := logx.Exception(joined)
	if len(attrs) != 4 {
		t.Fatalf("expected 4 elements in Exception slice, got %d: %v", len(attrs), attrs)
	}
	got := map[string]any{
		attrs[0].(string): attrs[1],
		attrs[2].(string): attrs[3],
	}
	if got["exception.type"] != "*url.Error" {
		t.Fatalf("exception.type = %v, want *url.Error", got["exception.type"])
	}
	if !strings.Contains(got["exception.message"].(string), "Post \"https://api.example.com\"") {
		t.Fatalf("exception.message = %v", got["exception.message"])
	}
}

func TestStacktraceCappedAt8KiB(t *testing.T) {
	// Exactly 8192 bytes stays unchanged.
	exact := strings.Repeat("a", 8191) + "\n"
	if len(exact) != 8192 {
		t.Fatalf("setup len = %d", len(exact))
	}
	var bufExact bytes.Buffer
	logx.New(&bufExact, "pn-api", "v1.4.2").Error("exact trace", "error", context.DeadlineExceeded, "exception.stacktrace", exact)
	var mExact map[string]any
	if err := json.Unmarshal(bufExact.Bytes(), &mExact); err != nil {
		t.Fatalf("unmarshal exact: %v", err)
	}
	if mExact["exception.stacktrace"] != exact {
		t.Fatalf("expected 8192-byte trace to stay unchanged, got len %d", len(mExact["exception.stacktrace"].(string)))
	}

	// Over 8192 bytes is capped, keeps top, and appends \n…[truncated N bytes].
	lines := []string{"goroutine 1 [running]:", "main.fail()"}
	for len(strings.Join(lines, "\n")) < 20480 {
		lines = append(lines, "\t/app/cmd/api/main.go:42 +0x123")
	}
	big := strings.Join(lines, "\n")

	var bufBig bytes.Buffer
	logx.New(&bufBig, "pn-api", "v1.4.2").Error("big trace", "error", context.DeadlineExceeded, "exception.stacktrace", big)
	var mBig map[string]any
	if err := json.Unmarshal(bufBig.Bytes(), &mBig); err != nil {
		t.Fatalf("unmarshal big: %v", err)
	}
	got := mBig["exception.stacktrace"].(string)
	if len(got) > 8192 {
		t.Fatalf("truncated stacktrace len = %d, want <= 8192", len(got))
	}
	if !strings.HasPrefix(got, "goroutine 1 [running]:\nmain.fail()\n") {
		t.Fatalf("expected top of stacktrace to be preserved, got prefix %q", got[:60])
	}
	re := regexp.MustCompile(`\n…\[truncated (\d+) bytes\]$`)
	matches := re.FindStringSubmatch(got)
	if matches == nil {
		t.Fatalf("expected truncation suffix, got tail %q", got[len(got)-60:])
	}
	cutBytes, err := strconv.Atoi(matches[1])
	if err != nil {
		t.Fatalf("atoi: %v", err)
	}
	keptLen := len(got) - len(matches[0])
	if keptLen+cutBytes != len(big) {
		t.Fatalf("kept (%d) + cut (%d) = %d, want %d", keptLen, cutBytes, keptLen+cutBytes, len(big))
	}
}

func TestNoTextHandlers(t *testing.T) {
	target := "New" + "TextHandler"
	var hits []string
	err := filepath.WalkDir("../..", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || filepath.Ext(path) != ".go" {
			return nil
		}
		if filepath.Base(path) == "logx_test.go" {
			return nil
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if bytes.Contains(b, []byte(target)) {
			hits = append(hits, path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	if len(hits) > 0 {
		t.Fatalf("slog text handlers remain in: %v", hits)
	}
}
