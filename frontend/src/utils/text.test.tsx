import React from 'react';
import { render } from '@testing-library/react-native';
import { renderBoldMarkdown, renderFormattedSentence } from './text';
import { Text } from '../ui/Text';
import { ThemeProvider } from '../theme/ThemeProvider';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('Text Formatting Utilities', () => {
  describe('renderBoldMarkdown', () => {
    it('handles null/undefined/empty string', () => {
      expect(renderBoldMarkdown(null)).toEqual([]);
      expect(renderBoldMarkdown(undefined)).toEqual([]);
      expect(renderBoldMarkdown('')).toEqual([]);
    });

    it('renders normal text without markdown as a single string', () => {
      const parts = renderBoldMarkdown('This is normal text.');
      expect(parts).toEqual(['This is normal text.']);
    });

    it('parses double asterisks into bold Text components', () => {
      const parts = renderBoldMarkdown('선생님께서 너의 숙제를 **검사**하실 것이다.');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('선생님께서 너의 숙제를 ');
      
      const boldPart = parts[1] as React.ReactElement;
      expect(boldPart.type).toBe(Text);
      expect(boldPart.props.bold).toBe(true);
      expect(boldPart.props.children).toBe('검사');
      
      expect(parts[2]).toBe('하실 것이다.');
    });
  });

  describe('renderFormattedSentence', () => {
    it('prefers markdown parsing over dynamic word matching if asterisks exist', () => {
      const parts = renderFormattedSentence('선생님께서 너의 숙제를 **검사**하실 것이다.', 'inspect');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('선생님께서 너의 숙제를 ');
      expect((parts[1] as React.ReactElement).props.children).toBe('검사');
      expect(parts[2]).toBe('하실 것이다.');
    });

    it('falls back to highlighting query word dynamically if no asterisks are present', () => {
      const parts = renderFormattedSentence('The teacher will inspect your homework.', 'inspect');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('The teacher will ');
      expect((parts[1] as React.ReactElement).props.children).toBe('inspect');
      expect(parts[2]).toBe(' your homework.');
    });
  });
});
