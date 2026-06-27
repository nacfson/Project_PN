import { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Card } from './Card';
import { HoverReveal } from './HoverReveal';

interface CinematicCardProps extends ViewProps {
  onPress?: () => void;
  revealActions?: ReactNode;
  elevated?: boolean;
  children: ReactNode;
}

export function CinematicCard({
  onPress,
  revealActions,
  elevated,
  children,
  style,
  ...rest
}: CinematicCardProps) {
  return (
    <Card
      onPress={onPress}
      elevated={elevated}
      hoverElevation
      hoverScale
      style={style}
      {...rest}
    >
      <View style={{ position: 'relative' }}>
        {children}
        {revealActions ? (
          <View style={{ position: 'absolute', top: 0, right: 0 }}>
            <HoverReveal>{revealActions}</HoverReveal>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
