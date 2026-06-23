import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IoniconsName;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  color?: string;
}

export function Icon({ name, size = 'md', color }: IconProps) {
  const { colors, iconSizes } = useTheme();

  const resolvedSize = typeof size === 'number' ? size : iconSizes[size];
  const resolvedColor = color ?? colors.onSurfaceVariant;

  return <Ionicons name={name} size={resolvedSize} color={resolvedColor} />;
}
