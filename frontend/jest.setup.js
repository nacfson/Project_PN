// Required by @testing-library/react-native v14+ when using React 18/19.
// See: https://callstack.github.io/react-native-testing-library/docs/getting-started
if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}
const nodeGlobal = Function('return this')();
if (typeof nodeGlobal.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  nodeGlobal.IS_REACT_ACT_ENVIRONMENT = true;
}

// Mock vector icons so tests can render UI components without loading native font modules.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const mockReact = require('react');
  return {
    __esModule: true,
    default: function IoniconsMock({ name, ...rest }) {
      return mockReact.createElement('Text', { ...rest, testID: `icon-${name}` }, name);
    },
  };
});

// Mock expo-blur so tests can render BlurView without native modules.
jest.mock('expo-blur', () => {
  const mockReact = require('react');
  return {
    BlurView: function BlurViewMock(props) {
      return mockReact.createElement('View', { ...props, testID: 'blur-view' });
    },
  };
});

// Mock react-native-safe-area-context for Jest environment
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, style, ...props }) => React.createElement('View', { ...props, style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// Mock react-native-reanimated to avoid Worklets native parts check in tests.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const RN = require('react-native');

  const mockUseSharedValue = (initialValue) => {
    return { value: initialValue };
  };

  const mockUseDerivedValue = (fn) => {
    return { value: fn() };
  };

  const mockInterpolate = (value, inputRange, outputRange) => {
    return outputRange[0];
  };

  const mockWithTiming = (value) => value;

  const mockUseAnimatedScrollHandler = (handlers) => {
    return (event) => {
      if (typeof handlers === 'function') {
        handlers(event);
      } else if (handlers && handlers.onScroll) {
        handlers.onScroll(event);
      }
    };
  };

  const mockUseAnimatedStyle = (styleFn) => {
    return styleFn();
  };

  const Animated = {
    View: RN.View,
    ScrollView: RN.ScrollView,
    Text: RN.Text,
    createAnimatedComponent: (c) => c,
  };

  return {
    __esModule: true,
    default: Animated,
    useSharedValue: mockUseSharedValue,
    useAnimatedScrollHandler: mockUseAnimatedScrollHandler,
    useAnimatedStyle: mockUseAnimatedStyle,
    useDerivedValue: mockUseDerivedValue,
    interpolate: mockInterpolate,
    Extrapolation: {
      CLAMP: 'clamp',
      IDENTITY: 'identity',
      EXTEND: 'extend',
    },
    withTiming: mockWithTiming,
    runOnJS: (fn) => fn, // Mock runOnJS to just return the function for JS thread execution in tests
  };
});
