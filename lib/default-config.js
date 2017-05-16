module.exports = DefaultConfig = {
  disablePathOverrides: {
    description: 'Disable path aliases to lookup modules in the actual path specified.',
    type: 'boolean',
    default: false,
    order: 1
  },

  disableBabelRc: {
    title: 'Disable .babelrc',
    description: 'Disable path aliases from .babelrc',
    type: 'boolean',
    default: false,
    order: 2
  },

  disableHyperclickSupport: {
    description: 'Disable hyperclick support (which makes variables and paths clickable). Requires Atom Reload/Restart for changes to take effect.',
    type: 'boolean',
    default: false,
    order: 3
  },

  openInSeparatePane: {
    description: 'Open module file in a separate pane.',
    type: 'boolean',
    default: true,
    order: 4
  },

  usePendingPane: {
    description: 'Open module file in a pending pane.',
    type: 'boolean',
    default: true,
    order: 4
  },

  panePosition: {
    description: 'Where the pane opens.',
    type: 'string',
    default: 'right',
    enum: ['up', 'down', 'left', 'right'],
    order: 5
  },

  fileExtensions: {
    description: 'Prioritized comma separated list of file extensions to check.',
    type: 'array',
    default: ['js', 'jsx'],
    items: {
      type: 'string'
    },
    order: 6
  },

  pathOverrides: {
    title: 'Import Path Overrides',
    description: 'Override path lookups. Separate multiple overrides with a comma, and separate the target string with the override with a colon.<br/><br/> **Example:**<br/>`import FooMixin from "project-name/mixins/foo"` and a path override of `project-name:app` will look for `FooMixin` in `app/mixins/foo` instead.<br/><br/>Use `$PROJECT` to refer to project name listed in packages.json',
    type: 'array',
    default: ['$PROJECT:app', '$PROJECT/config:config'],
    items: {
      type: 'string'
    },
    order: 7
  }
};
