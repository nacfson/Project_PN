import React, { ReactNode } from 'react';
import { Text } from '../ui/Text';

export function highlightWordInSentence(sentence: string, word: string): ReactNode[] {
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
      <Text key={`match-${offset}`} bold>
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

export function renderBoldMarkdown(text: string | null | undefined): ReactNode[] {
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
      <Text key={`bold-${matchIndex}`} bold>
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

export function renderFormattedSentence(sentence: string, word: string): ReactNode[] {
  if (!sentence) return [];
  if (sentence.includes('**')) {
    return renderBoldMarkdown(sentence);
  }
  return highlightWordInSentence(sentence, word);
}
