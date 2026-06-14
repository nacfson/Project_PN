create index words_normalized_text_prefix_idx
on words (normalized_text text_pattern_ops);
