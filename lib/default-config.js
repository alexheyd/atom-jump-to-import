module.exports = DefaultConfig = {
  enableDebug: {
    description: 'Enable debug logging.',
    type: 'boolean',
    default: false,
    order: 1
  },

  usePendingPane: {
    description: 'Open module file in a pending pane.',
    type: 'boolean',
    default: true,
    order: 10
  },

  openInSeparatePane: {
    description: 'Open module file in a separate pane.',
    type: 'boolean',
    default: true,
    order: 20
  },

  panePosition: {
    description: 'Where the pane opens.',
    type: 'string',
    default: 'right',
    enum: ['up', 'down', 'left', 'right'],
    order: 30
  },

  useEmberPods: {
    description: 'Use Ember pod structure to find Ember Services.',
    type: 'boolean',
    default: true,
    order: 35
  },

  fileExtensions: {
    description: 'Prioritized comma separated list of file extensions to check.',
    type: 'array',
    default: ['js', 'jsx'],
    items: {
      type: 'string'
    },
    order: 40
  },

  pathOverrides: {
    title: 'Import Path Aliases',
    description:
      'Use these aliases when overriding path lookups. Separate multiple aliases with a comma, and separate the target string with the override with a colon.<br/><br/> **Example:**<br/>`import FooMixin from "project-name/mixins/foo"` and a path alias of `project-name:app` will look for `FooMixin` in `app/mixins/foo` instead.<br/><br/>Use `$PROJECT` to refer to project name listed in packages.json',
    type: 'array',
    default: ['$PROJECT:app', '$PROJECT/config:config'],
    items: {
      type: 'string'
    },
    order: 50
  },

  serviceOverrides: {
    title: 'Ember Service Aliases',
    description:
      'You can alias Ember.Service names to map variable names to their actual service counterparts, if the names differ. Separate multiple aliases with a comma, and separate the target string with the alias with a colon.<br/><br/>**Example:**<br/>`foo: Ember.inject.service()` and an alias of `foo:foobar` will look for `foobar.js` instead of `foo.js`',
    type: 'array',
    default: [],
    items: {
      type: 'string'
    },
    order: 51
  },

  disablePathOverrides: {
    title: 'Disable Path Aliases',
    description: 'Disable path aliases to lookup modules in the actual path specified.',
    type: 'boolean',
    default: false,
    order: 60
  },

  disableBabelRc: {
    title: 'Disable .babelrc aliases',
    description: 'Disable path aliases from .babelrc',
    type: 'boolean',
    default: false,
    order: 70
  },

  disableWebpack: {
    title: 'Disable Webpack aliases',
    description: 'Disable path aliases from webpack.config.js',
    type: 'boolean',
    default: false,
    order: 75
  },

  disableHyperclickSupport: {
    description:
      'Disable hyperclick support (which makes variables and paths clickable). Requires Atom Reload/Restart for changes to take effect.',
    type: 'boolean',
    default: false,
    order: 80
  }
};
