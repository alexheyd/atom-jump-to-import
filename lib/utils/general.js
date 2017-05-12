'use babel';

const AtomUtils = require('./atom');
const PathUtils = require('./path');

/**
 * Babel plugin names that we check for in .babelrc to extract aliases
 * @type {Array}
 */
const VALID_BABEL_PLUGIN_NAMES = [
  'module-resolver',
  'babel-plugin-module-resolver',
  'module-alias',
  'babel-plugin-module-alias'
];

/**
 * Wildcard for project name in path aliases
 * @type {String}
 */
const PROJECT_NAME_ALIAS = '$PROJECT';

/**
 * Parses .babelrc to find listed babel plugins
 * @method _parseBabelConfig
 * @param  {String} path Root path where the .babelrc resides
 * @param  {Object} configs Hash of Babel configs
 */
const _parseBabelConfig = (path, configs) => {
  const babelCfg = configs[path].config;
  const plugins = babelCfg ? babelCfg.plugins : null;

  if (plugins && plugins.length) {
    plugins.forEach(plugin => _extractBabelAliases(plugin));
  }
};

/**
 * Extracts path aliases from .babelrc if valid plugin names were found
 * @method _extractBabelAliases
 * @param  {Array} plugin List of plugin configuration options
 */
const _extractBabelAliases = plugin => {
  const pluginName = plugin[0];
  const pluginOptions = plugin[1];

  if (VALID_BABEL_PLUGIN_NAMES.indexOf(pluginName) > -1) {
    if (pluginOptions.alias) {
      aliases[path] = pluginOptions.alias;
    }
  }
};
/**
 * Parses path aliases from package settings, replacing project name wildcard
 * and extracting the final aliases
 * @method _parseAliases
 * @param  {String} projectPath Root proiect path
 * @param  {String} projectName Name of project
 * @param  {Object} overrides Hash of path aliases
 * @return {Object} Hash of path aliases
 */
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
  /**
   * Extracts project names from package.json in each root project directory
   * @method extractProjectNames
   * @param  {Object} json Hash of package.json
   * @return {Object} Hash of project names
   */
  extractProjectNames(json) {
    const names = {};
    Object.keys(json).forEach(path => (names[path] = json[path].name || ''));
    return names;
  },

  /**
   * Extracts path aliases defined in package settings
   * @method extractUserAliases
   * @param  {Object} overrides Hash of path aliases
   * @param  {Object} projectNames Hash of project names
   * @return {Object} Hash of path aliases
   */
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

  /**
   * Extracts path aliases from .babelrc
   * @method extractBabelAliases
   * @param  {Object} configs Hash of Babel configs
   * @return {Object} Hash of path aliases
   */
  extractBabelAliases(configs) {
    const aliases = {};

    Object.keys(configs).forEach(path => _parseBabelConfig(path, configs));

    return aliases;
  },

  /**
   * Converts a string into a module object
   * @method convertToModule
   * @param  {String} cursorString String under user's cursor
   * @return {Object} Hash of module's import path, method name and module name
   */
  convertToModule(cursorString) {
    const modulePath = cursorString.substring(1, cursorString.length - 1);
    const pathFromVar = PathUtils.getPathFromVariable(cursorString);
    const module = PathUtils.isImportPath(cursorString)
      ? { path: modulePath }
      : pathFromVar;

    return module;
  }
};
