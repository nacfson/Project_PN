// `/` is the fresh-tab and post-login URL. An empty Settings path captures it.
export const linkingConfig = {
  screens: {
    Learn: {
      path: '',
      alias: ['learn'],
    },
    Words: 'words',
    Add: 'add',
    Practice: 'practice',
    Settings: {
      path: 'settings',
      screens: {
        SettingsRoot: '',
        ConnectedAccounts: {
          path: 'connected-accounts',
          exact: true,
        },
      },
    },
  },
};
