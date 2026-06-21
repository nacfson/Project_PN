package words

// interleaveDueItems round-robins items across WordID buckets so consecutive
// cards avoid the same lemma family. Items from the same word with multiple
// CEFR senses stay separated by cards from other words.
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
		idx, ok := bucketIndex[item.WordID]
		if !ok {
			idx = len(buckets)
			bucketIndex[item.WordID] = idx
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
