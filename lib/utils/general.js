'use babel';

import { File } from 'atom';
import deepmerge from 'deepmerge';
import AtomUtils from './atom';
import PathUtils from './filepath';
import npmPath from 'path';

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
const _parseBabelConfig = (path, babelrc) => {
  const babelCfg = babelrc.config;
  const plugins = babelCfg ? babelCfg.plugins : null;
  let aliases = {};

  if (plugins && plugins.length) {
    plugins.forEach(plugin => {
      aliases = _extractBabelAliases(plugin, path);
    });
  }

  return aliases;
};

/**
 * Parses webpack config file to find module aliases
 * @method   _parseWebpackConfig
 * @param    {String} rootPath Project root path
 * @param    {Object} webpack Webpack config
 * @return   {Object} Webpack aliases
 */
const _parseWebpackConfig = (rootPath, webpack) => {
  const aliases = {
    [rootPath]: {}
  };

  Object.keys(webpack).forEach(alias => {
    aliases[rootPath][alias] = webpack[alias];
  });

  return aliases;
};

/**
 * Extracts path aliases from .babelrc if valid plugin names were found
 * @method _extractBabelAliases
 * @param  {Array} plugin List of plugin configuration options
 */
const _extractBabelAliases = (plugin, path) => {
  const pluginName = plugin[0];
  const pluginOptions = plugin[1];
  const aliases = {};

  if (VALID_BABEL_PLUGIN_NAMES.indexOf(pluginName) > -1) {
    const { root, alias } = pluginOptions;

    if (root && root.length) {
      Object.keys(alias).forEach(aliasKey => {
        alias[aliasKey] = npmPath.join(root[0], alias[aliasKey]);
      });
    }

    if (alias) {
      aliases[path] = alias;
    }
  }

  return aliases;
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
    let [alias, path] = override.split(':');

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
   * Extracts user, project and .babelrc path aliases
   * @method extractAllAliases
   * @param  {Object} userOverrides User aliases
   * @param  {Object} babelConfigs Hash of .babelrc paths
   * @param  {Object} projectConfigUrls Hash of .jump-to-import paths
   * @return {Object} Hash of path aliases
   */
  extractAllAliases(userOverrides, babelConfigs, projectConfigUrls, webpackConfigs) {
    const projectPaths = AtomUtils.getProjectPaths();
    const projectNames = this.extractProjectNames(AtomUtils.getPackageJson());
    const babelAliases = this.extractBabelAliases(babelConfigs);
    const allAliases = [];
    const userAliases = this.extractUserAliases(userOverrides, projectNames);
    const projectAliases = this.extractProjectAliases(projectConfigUrls, projectNames);
    const webpackAliases = this.extractWebpackAliases(webpackConfigs);

    let aliases = {};

    if (userAliases) {
      allAliases.push(userAliases);
    }

    if (babelAliases) {
      allAliases.push(babelAliases);
    }

    if (projectAliases) {
      allAliases.push(projectAliases);
    }

    if (webpackAliases) {
      allAliases.push(webpackAliases);
    }

    if (allAliases.length) {
      aliases = deepmerge.all(allAliases);
    }

    return aliases;
  },

  /**
   * Extracts webpack module aliases
   * @method   extractWebpackAliases
   * @param    {Object} configs Webpack configs, keyed by project root path
   * @return   {Object} Webpack aliases
   */
  extractWebpackAliases(configs) {
    if (!configs) {
      return null;
    }

    let aliases = {};

    Object.keys(configs).forEach(path => {
      if (configs[path]) {
        aliases = _parseWebpackConfig(path, configs[path]);
      }
    });

    return aliases;
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
      aliases = _parseAliases(projectPath, projectNames[projectPath], overrides);
    });

    return aliases;
  },

  /**
   * Extracts project path aliases from .jump-to-import files
   * @method extractProjectAliases
   * @param  {Object} projectConfigs Hash of .jump-to-import paths
   * @param  {Object} projectNames Hash of project names
   * @return {Object} Project path aliases
   */
  extractProjectAliases(projectConfigs, projectNames) {
    let aliases = {};

    Object.keys(projectConfigs).forEach(rootPath => {
      const filePath = projectConfigs[rootPath];

      if (fs.existsSync(filePath)) {
        const jsonString = fs.readFileSync(filePath, 'utf8');
        const overrides = JSON.parse(jsonString).pathOverrides;
        aliases = _parseAliases(rootPath, projectNames[rootPath], overrides);
      }
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
    if (!configs) {
      return null;
    }

    let aliases = {};

    Object.keys(configs).forEach(path => {
      if (configs[path]) {
        aliases = _parseBabelConfig(path, configs[path]);
      }
    });

    return aliases;
  },

  /**
   * Converts a string into a module object
   * @method convertToModule
   * @param  {String} cursorString String under user's cursor
   * @param {Boolean} useEmberPods Use Ember pod structure to find services
   * @return {Object} Hash of module's import path, method name and module name
   */
  convertToModule(cursorString, useEmberPods) {
    return PathUtils.getPathFromVariable(cursorString.replace(/'/g, ''), useEmberPods);
  },

  /**
   * Converts a string into an HTMLBars module object
   * @method   convertToHTMLBarsModule
   * @param    {String} rootPath Root project path
   * @param    {String} name Module name
   * @param    {Object} options Package options
   * @return   {Object} Module object
   */
  convertToHTMLBarsModule(rootPath, name, options) {
    const podPath = npmPath.join(rootPath, 'app', 'components', name, 'template.hbs');
    const nonPodPath = npmPath.join(rootPath, 'app', 'templates', `${name}.hbs`);
    const modulePath = options.useEmberPods ? podPath : nonPodPath;

    return {
      path: modulePath
    };
  },

  /**
   * Subscribes to file changes
   * @method   subscribeToFileChanges
   * @param    {String} filePath File path to subscribe to
   * @param    {Function} callback
   */
  subscribeToFileChanges(filePath, callback) {
    new File(filePath, false).onDidChange(callback);
  },

  /**
   * Subscribes to changes made to the package settings
   * @method subscribeToConfigChanges
   * @param  {Object} subscriptions Atom subscriptions
   * @param  {Array} configKeys List of config keys to listen to
   * @param  {Function} callback Listener callback
   */
  subscribeToConfigChanges(subscriptions, configKeys, callback) {
    if (configKeys && configKeys.length) {
      configKeys.forEach(key => {
        subscriptions.add(AtomUtils.onAtomConfigChange(key, callback));
      });
    }
  },

  /**
   * Subscribes to .jump-to-import file changes
   * @method subscribeToProjectConfigChanges
   * @param  {Object} projectConfigs Hash of .jump-to-import paths
   * @param  {Function} callback Listener callback
   */
  subscribeToProjectConfigChanges(projectConfigs, callback) {
    if (projectConfigs) {
      const configKeys = Object.keys(projectConfigs);

      if (configKeys && configKeys.length) {
        configKeys.forEach(rootPath => {
          this.subscribeToFileChanges(projectConfigs[rootPath], callback);
        });
      }
    }
  },

  /**
   * Subscribes to changes made to .babelrc
   * @method subscribeToBabelChanges
   * @param  {Object} configs Hash of .babelrc configs
   */
  subscribeToBabelChanges(configs, callback) {
    if (configs) {
      const configKeys = Object.keys(configs);

      if (configKeys && configKeys.length) {
        configKeys.forEach(projectRoot => {
          const fileName = configs[projectRoot].file;
          this.subscribeToFileChanges(fileName, callback);
        });
      }
    }
  },

  /**
   * Subscribes to changes made to webpack.config.js
   * @method   subscribeToWebpackChanges
   * @param    {Object} configs Hash of webpack configs, keyed by path
   * @param    {Function} callback
   */
  subscribeToWebpackChanges(configs, callback) {
    if (configs) {
      const configKeys = Object.keys(configs);

      if (configKeys && configKeys.length) {
        configKeys.forEach(projectRoot => {
          const fileName = npmPath.join(projectRoot, 'webpack.config.js');
          this.subscribeToFileChanges(fileName, callback);
        });
      }
    }
  },

  /**
   * Checks if file is a Javascript file
   * @method isJavascriptFile
   * @param  {Object} textEditor Atom TextEditor instance
   * @return {Boolean}
   */
  isJavascriptFile(textEditor) {
    const { scopeName } = textEditor.getGrammar();
    return scopeName.indexOf('source.js') > -1;
  },

  /**
   * Checks if file is an HTMLBars file
   * @method isHTMLBarsFile
   * @param  {Object} textEditor Atom TextEditor instance
   * @return {Boolean}
   */
  isHTMLBarsFile(textEditor) {
    const { scopeName } = textEditor.getGrammar();
    return scopeName === 'text.html.htmlbars' || scopeName === 'text.html.handlebars';
  }
};
