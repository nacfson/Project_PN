package words

import (
	"math/rand/v2"
	"strings"
)

// shuffleAndInterleaveDueItems randomizes card order, then round-robins
// lemma families so consecutive cards avoid the same word. Origin/add
// order is not preserved: retries and first-pass quizzes must test meaning,
// not memorized sequence.
func shuffleAndInterleaveDueItems(items []DueItem) []DueItem {
	return shuffleAndInterleaveDueItemsWith(items, rand.Shuffle)
}

func shuffleAndInterleaveDueItemsWith(items []DueItem, shuffle func(n int, swap func(i, j int))) []DueItem {
	if len(items) <= 1 {
		return items
	}
	out := append([]DueItem(nil), items...)
	shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return interleaveDueItems(out)
}

func dueItemInterleaveKey(item DueItem) string {
	if norm := strings.TrimSpace(item.NormalizedText); norm != "" {
		return strings.ToLower(strings.TrimSpace(item.LanguageCode) + ":" + norm)
	}
	if item.WordID != "" {
		return item.WordID
	}
	return item.UserWordSenseID
}

// interleaveDueItems round-robins items across lemma/word buckets so consecutive
// cards avoid the same lemma family across both dictionary and custom cards.
func interleaveDueItems(items []DueItem) []DueItem {
	if len(items) <= 1 {
		return items
	}

	type bucket struct {
		items []DueItem
	}

	bucketIndex := make(map[string]int)
	var buckets []bucket

	for _, item := range items {
		key := dueItemInterleaveKey(item)
		idx, ok := bucketIndex[key]
		if !ok {
			idx = len(buckets)
			bucketIndex[key] = idx
			buckets = append(buckets, bucket{})
		}
		buckets[idx].items = append(buckets[idx].items, item)
	}

	result := make([]DueItem, 0, len(items))
	for len(result) < len(items) {
		progress := false
		for i := range buckets {
			if len(buckets[i].items) == 0 {
				continue
			}
			result = append(result, buckets[i].items[0])
			buckets[i].items = buckets[i].items[1:]
			progress = true
		}
		if !progress {
			break
		}
	}
	return result
}
