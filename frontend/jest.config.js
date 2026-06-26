const config = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((react-native.*)?|@react-native.*|@react-navigation.*|expo.*|@expo.*))',
  ],
};

module.exports = config;
