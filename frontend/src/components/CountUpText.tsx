import React, { useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

interface CountUpTextProps {
  target: number;
  duration?: number;
  variant?: 'body' | 'caption' | 'title' | 'heading' | 'headline' | 'label';
  color?: 'default' | 'muted' | 'inverse' | 'primary' | 'danger' | 'success' | 'onPrimaryContainer' | 'onSecondaryContainer';
  bold?: boolean;
  style?: any;
  _setInterval?: typeof setInterval;
  _clearInterval?: typeof clearInterval;
}

export function CountUpText({
  target,
  duration = 1000,
  variant,
  color,
  bold,
  style,
  _setInterval = setInterval,
  _clearInterval = clearInterval,
  ...rest
}: CountUpTextProps) {
  const { reduced } = useTheme();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (reduced || duration <= 0) {
      setDisplayValue(target);
      return;
    }

    const start = displayValue;
    if (start === target) return;

    let elapsed = 0;
    const step = 16;
    
    const interval = _setInterval(() => {
      elapsed += step;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = progress * (2 - progress);
      const currentValue = Math.round(start + (target - start) * easeProgress);

      setDisplayValue(currentValue);

      if (progress >= 1) {
        _clearInterval(interval);
      }
    }, step);

    return () => {
      _clearInterval(interval);
    };
  }, [target, duration, reduced, _setInterval, _clearInterval]);

  return (
    <Text variant={variant} color={color} bold={bold} style={style} {...rest}>
      {displayValue}
    </Text>
  );
}
