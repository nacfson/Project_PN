// Required by @testing-library/react-native v14+ when using React 18/19.
// See: https://callstack.github.io/react-native-testing-library/docs/getting-started
if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}
const nodeGlobal = Function('return this')();
if (typeof nodeGlobal.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  nodeGlobal.IS_REACT_ACT_ENVIRONMENT = true;
}

// Fail tests if React logs unwrapped state updates (HookContainer / components) or overlapping act() calls.
const util = require('util');
const originalConsoleError = console.error;
let actViolations = [];

console.error = (...args) => {
  const formatted = util.format(...args);
  // Ignore React Native's internal Animated / CountUpText interval ticks in Node test environment
  if (
    formatted.includes('inside a test was not wrapped in act(...)') &&
    (formatted.includes('An update to Animated(') ||
      formatted.includes('An update to CountUpText'))
  ) {
    return;
  }
  const isUnwrappedAct = formatted.includes('inside a test was not wrapped in act(...)');
  const isOverlappingAct = formatted.includes('You seem to have overlapping act() calls');
  const isMisconfiguredAct = formatted.includes(
    'The current testing environment is not configured to support act(...)',
  );

  if (isUnwrappedAct || isOverlappingAct || isMisconfiguredAct) {
    actViolations.push(formatted.split('\n')[0]);
  }
  originalConsoleError.apply(console, args);
};

beforeEach(() => {
  actViolations = [];
});

afterEach(() => {
  if (actViolations.length > 0) {
    const violations = actViolations.slice();
    actViolations = [];
    throw new Error(
      `React act(...) violation detected during test:\n- ${violations.join('\n- ')}\nWrap state-updating calls in await act(async () => ...) and await async @testing-library/react-native helpers (render, rerender, fireEvent, cleanup).`,
    );
  }
});

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
    FlatList: RN.FlatList,
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
