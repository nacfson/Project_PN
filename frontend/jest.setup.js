// Required by @testing-library/react-native v14+ when using React 18/19.
// See: https://callstack.github.io/react-native-testing-library/docs/getting-started
// We set the flag both on the Jest sandbox global and on the Node real global
// so that untransformed native modules (e.g. react-reconciler) also see it.
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

