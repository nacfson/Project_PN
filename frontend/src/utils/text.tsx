import React, { ReactNode } from 'react';
import { Text } from '../ui/Text';
import type { Colors } from '../theme/tokens';

export function highlightWordInSentence(sentence: string, word: string, highlightColor?: string): ReactNode[] {
  if (!sentence || !word) return [sentence];
  const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}[a-zA-Z]*\\b`, 'gi');
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  sentence.replace(regex, (match, offset) => {
    if (offset > lastIndex) {
      parts.push(sentence.slice(lastIndex, offset));
    }
    parts.push(
      <Text key={`match-${offset}`} bold style={highlightColor ? { color: highlightColor } : undefined}>
        {match}
      </Text>
    );
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < sentence.length) {
    parts.push(sentence.slice(lastIndex));
  }
  return parts;
}

export function renderBoldMarkdown(text: string | null | undefined, highlightColor?: string): ReactNode[] {
  if (!text) return [];
  const parts: ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchedText = match[0];
    const innerText = match[1];
    
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    
    parts.push(
      <Text key={`bold-${matchIndex}`} bold style={highlightColor ? { color: highlightColor } : undefined}>
        {innerText}
      </Text>
    );
    
    lastIndex = matchIndex + matchedText.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}

export function renderFormattedSentence(sentence: string, word: string, highlightColor?: string): ReactNode[] {
  if (!sentence) return [];
  if (sentence.includes('**')) {
    return renderBoldMarkdown(sentence, highlightColor);
  }
  return highlightWordInSentence(sentence, word, highlightColor);
}

export function getPosColor(pos: string | null | undefined, colors: Colors): string {
  if (!pos) return colors.primary;
  switch (pos.toLowerCase()) {
    case 'noun':
      return colors.info;
    case 'verb':
      return colors.success;
    case 'adjective':
      return colors.warning;
    case 'adverb':
      return colors.primary;
    default:
      return colors.secondary;
  }
}

export function getPosBadgeVariant(pos: string | null | undefined): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  if (!pos) return 'default';
  switch (pos.toLowerCase()) {
    case 'noun':
      return 'info';
    case 'verb':
      return 'success';
    case 'adjective':
      return 'warning';
    case 'adverb':
      return 'primary';
    default:
      return 'default';
  }
}
