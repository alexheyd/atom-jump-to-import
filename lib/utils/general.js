'use babel';

const AtomUtils = require('./atom');
const PathUtils = require('./path');

const VALID_BABEL_PLUGIN_NAMES = [
  'module-resolver',
  'babel-plugin-module-resolver',
  'module-alias',
  'babel-plugin-module-alias'
];

const PROJECT_NAME_ALIAS = '$PROJECT';

const _parseBabelConfig = (path, configs) => {
  const babelCfg = configs[path].config;
  const plugins = babelCfg ? babelCfg.plugins : null;

  if (plugins && plugins.length) {
    plugins.forEach(plugin => {
      _extractBabelAliases(plugin);
    });
  }
};

const _extractBabelAliases = plugin => {
  const pluginName = plugin[0];
  const pluginOptions = plugin[1];

  if (VALID_BABEL_PLUGIN_NAMES.indexOf(pluginName) > -1) {
    if (pluginOptions.alias) {
      aliases[path] = pluginOptions.alias;
    }
  }
};

const _parseAliases = (projectPath, projectName, overrides) => {
  const aliases = {
    [projectPath]: {}
  };

  overrides.forEach(override => {
    const split = override.split(':');
    let alias = split[0];
    const path = split[1];

    if (alias.indexOf(PROJECT_NAME_ALIAS) > -1 && projectName) {
      alias = alias.replace(PROJECT_NAME_ALIAS, projectName);
    }

    aliases[projectPath][alias] = path;
  });

  return aliases;
};

module.exports = {
  extractProjectNames(json) {
    const names = {};

    Object.keys(json).forEach(path => {
      names[path] = json[path].name || '';
    });

    return names;
  },

  extractUserAliases(overrides, projectNames) {
    let aliases = {};

    Object.keys(projectNames).forEach(projectPath => {
      aliases = _parseAliases(
        projectPath,
        projectNames[projectPath],
        overrides
      );
    });

    return aliases;
  },

  extractBabelAliases(configs) {
    const aliases = {};

    Object.keys(configs).forEach(path => _parseBabelConfig(path, configs));

    return aliases;
  },

  convertToModule(cursorString) {
    const modulePath = cursorString.substring(1, cursorString.length - 1);
    const pathFromVar = PathUtils.getPathFromVariable(cursorString);
    const module = PathUtils.isImportPath(cursorString)
      ? { path: modulePath }
      : pathFromVar;

    return module;
  }
};
