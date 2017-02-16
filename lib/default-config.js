module.exports = DefaultConfig = {
  fileExtensions: {
    description: 'Prioritized comma separated list of file extensions to check.',
    type: 'array',
    default: ['js', 'jsx'],
    items: {
      type: 'string'
    }
  },

  disablePathOverrides: {
    description: 'Disable path overrides to lookup modules in the actual path specified.',
    type: 'boolean',
    default: false
  },

  disableBabelRc: {
    title: 'Disable .babelrc',
    description: 'Disable path overrides from .babelrc',
    type: 'boolean',
    default: false
  },

  pathOverrides: {
    title: 'Import Path Overrides',
    description: 'Override path lookups. Separate multiple overrides with a comma, and separate the target string with the override with a colon.<br/><br/> **Example:**<br/>`import FooMixin from "project-name/mixins/foo"` and a path override of `project-name:app` will look for `FooMixin` in `app/mixins/foo` instead.<br/><br/>Use `$PROJECT` to refer to project name listed in packages.json',
    type: 'array',
    default: ['$PROJECT:app', '$PROJECT/config:config'],
    items: {
      type: 'string'
    }
  }
}
