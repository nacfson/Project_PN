package words

import (
	"testing"
	"time"
)

func TestComputeReviewStreakDays(t *testing.T) {
	today := time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC)

	tests := []struct {
		name  string
		dates []time.Time
		want  int
	}{
		{
			name:  "empty",
			dates: nil,
			want:  0,
		},
		{
			name: "today only",
			dates: []time.Time{
				today,
			},
			want: 1,
		},
		{
			name: "today and yesterday",
			dates: []time.Time{
				today,
				today.AddDate(0, 0, -1),
			},
			want: 2,
		},
		{
			name: "yesterday only keeps streak",
			dates: []time.Time{
				today.AddDate(0, 0, -1),
			},
			want: 1,
		},
		{
			name: "gap breaks streak",
			dates: []time.Time{
				today.AddDate(0, 0, -2),
			},
			want: 0,
		},
		{
			name: "non consecutive history stops count",
			dates: []time.Time{
				today,
				today.AddDate(0, 0, -1),
				today.AddDate(0, 0, -3),
			},
			want: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := computeReviewStreakDays(tc.dates, today); got != tc.want {
				t.Fatalf("computeReviewStreakDays() = %d, want %d", got, tc.want)
			}
		})
	}
}
