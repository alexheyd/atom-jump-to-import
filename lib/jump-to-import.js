'use babel';

import { CompositeDisposable } from 'atom';
import { Range as AtomRange } from 'atom';
import npmPath from 'path';
import AtomUtils from './utils/atom';
import PathUtils from './utils/filepath';
import Config from './utils/config';
import Utils from './utils/general';
import DefaultConfig from './default-config';
import Logger from './utils/logger';

/**
 * Converts a string to a module object
 * @method _getModule
 * @param  {String} str String to attempt to convert to a module object
 * @param  {Object} options Hash of package options
 * @return {Object} Module object
 */
function _getModule(str, aliases, options) {
  if (str) {
    const module = Utils.convertToModule(str, options.useEmberPods);
    return PathUtils.applyPathOverrides(module, aliases, options);
  }

  return null;
}

/**
 * Converts a string to a module object
 * @method _getHTMLBarsModule
 * @param  {String} rootPath Project root path
 * @param  {String} componentName Ember component name
 * @return {Object} Module object
 */
function _getHTMLBarsModule(rootPath, componentName, options) {
  if (rootPath && componentName) {
    return Utils.convertToHTMLBarsModule(rootPath, componentName, options);
  }

  return null;
}

/**
 * Hyperclick provider, bound to this package instance
 * @method _getSuggestionForWord
 * @param  {Object} textEditor Atom TextEditor instance
 * @param  {string} text Selected text
 * @param  {Object} range Hash of range arrays
 * @return {Object} Hyperclick suggestion hash
 */
function _getSuggestionForWord(textEditor, text, range) {
  const self = this;
  const { start, end } = range;

  return {
    range: new AtomRange(start, end),
    async callback() {
      self.goToModule(text);
    }
  };
}

class JumpToImport {
  /**
   * Indicates whether this.setup() was called
   * @type {Boolean}
   */
  initialized: false;

  /**
   * Indicates whether we're already listening to file and config changes
   * @type {Boolean}
   */
  isSubscribedToChanges: false;

  /**
   * Hash of all path aliases
   * @type {Object}
   */
  aliases: {};

  /**
   * Loads default config and registers package command
   * @method constructor
   */
  constructor() {
    _getSuggestionForWord = _getSuggestionForWord.bind(this);
    this.config = DefaultConfig;
    this.subscriptions = null;
    this.registerCommand();
  }

  /**
   * Package activation hook -- performs package setup and installs
   * hyperclick if not available
   * @method activate
   */
  async activate() {
    const isHyperclickLoaded = atom.packages.isPackageLoaded('hyperclick');
    const disableHyperclickSupport = atom.config.get(`jump-to-import.disableHyperclickSupport`);

    if (!isHyperclickLoaded && !disableHyperclickSupport) {
      await require('atom-package-deps').install('hyperclick');
    }
  }

  /**
   * Package deactivation hook -- disposes of subscriptions
   * @method deactivate
   */
  deactivate() {
    if (this.subscriptions) {
      this.subscriptions.dispose();
    }
  }

  /**
   * Registers the package commands in Atom
   * @method registerCommand
   */
  registerCommand() {
    this.subscriptions = new CompositeDisposable();

    const goToModule = atom.commands.add(
      'atom-workspace',
      'jump-to-import:go-to-module',
      this.goToModule.bind(this)
    );

    const createDefaultProjectConfig = atom.commands.add(
      'atom-workspace',
      'jump-to-import:create-project-config',
      this.createDefaultProjectConfig.bind(this)
    );

    const debugLog = atom.commands.add(
      'atom-workspace',
      'jump-to-import:debug-log',
      this.debugLog.bind(this)
    );

    const subscribedToFileOpen = AtomUtils.subscribeToFileOpen();

    this.subscriptions.add(goToModule, createDefaultProjectConfig, subscribedToFileOpen);
  }

  /**
   * All package setup occurs here. Responsible for extracting the
   * project name from package.json, loading package settings,
   * configuring path aliases from settings and .babelrc
   * @method setup
   */
  setup() {
    const projectPaths = AtomUtils.getProjectPaths();
    const projectConfigUrls = AtomUtils.getProjectConfigUrls(projectPaths);
    const projectSettings = Config.loadProjectSettings(projectConfigUrls);
    const configKeys = Object.keys(this.config);
    const userSettings = Config.loadUserSettings(configKeys);
    const options = Object.assign({}, userSettings, projectSettings);
    let babelConfigs = null;
    let webpackConfigs = null;

    if (!options.user.disableBabelRc) {
      babelConfigs = AtomUtils.getBabelRc(projectPaths);
    }

    if (!options.user.disableWebpack) {
      webpackConfigs = AtomUtils.getWebpackConfigs(projectPaths);
    }

    const userOverrides = options.user.pathOverrides;
    const aliases = Utils.extractAllAliases(
      userOverrides,
      babelConfigs,
      projectConfigUrls,
      webpackConfigs
    );

    if (userSettings.user.enableDebug) {
      Logger.enable();
    } else {
      Logger.disable();
    }

    this.initialized = true;
    this.options = options;
    this.aliases = aliases;

    Logger.report({
      options,
      aliases
    });

    this.subscribeToChanges(configKeys, projectConfigUrls, babelConfigs, webpackConfigs);
  }

  /**
   * Subscribes to config, .babelrc and .jump-to-import file changes
   * @method subscribeToChanges
   * @param {Array} configKeys List of config keys to listen to
   * @param {Object} projectConfigUrls Hash of .jump-to-import paths
   * @param {Object} babelConfigs Hash of .babelrc paths
   */
  subscribeToChanges(configKeys, projectConfigUrls, babelConfigs, webpackConfigs) {
    if (!this.isSubscribedToChanges) {
      this.isSubscribedToChanges = true;

      const resetInitialization = () => {
        this.initialized = false;
      };

      Utils.subscribeToConfigChanges(this.subscriptions, configKeys, resetInitialization);
      Utils.subscribeToProjectConfigChanges(projectConfigUrls, resetInitialization);

      if (!this.options.disableBabelRc) {
        Utils.subscribeToBabelChanges(babelConfigs, resetInitialization);
      }
      // TODO: re-enable once require.cache is fixed
      // Utils.subscribeToWebpackChanges(webpackConfigs, resetInitialization);
    }
  }

  /**
   * Creates default .jump-to-import config in all root folders
   * @method createDefaultProjectConfig
   */
  createDefaultProjectConfig() {
    const configKeys = Object.keys(this.config);
    const userSettings = Config.loadUserSettings(configKeys).user;
    Config.createDefaultProjectConfig(AtomUtils.getProjectPaths(), userSettings);
  }

  /**
   * Logs debug information to console
   * @method   debugLog
   */
  debugLog() {
    Logger.debugLog();
  }

  /**
   * Main package functionality occurs here. Finds the string under
   * the user's cursor, figures out the import/require path for the
   * variable if one exists, then opens that file in a new editor,
   * also jumping to a symbol if applicable.
   * @method goToModule
   */
  async goToModule(str) {
    if (!this.initialized) {
      this.setup();
    }

    const stringProvided = typeof str === 'string';
    const editor = AtomUtils.getEditor();
    const editorPath = AtomUtils.getEditorRootPath();
    const isHTMLBars = Utils.isHTMLBarsFile(editor);
    const isJavascript = Utils.isJavascriptFile(editor);
    const options = this.options[editorPath] || this.options.user;
    let module = null;

    if (isJavascript) {
      const cursorString = stringProvided ? str : AtomUtils.findStringUnderCursor();
      Logger.report({ cursorString });
      module = _getModule(cursorString, this.aliases[editorPath], options);
    } else if (isHTMLBars) {
      const cursorString = stringProvided ? str : AtomUtils.findHTMLBarsStringUnderCursor();
      module = _getHTMLBarsModule(editorPath, cursorString, options);
      Logger.report({ cursorString });
    }

    Logger.report({ module, isJavascript, isHTMLBars });
    Logger.debugLog();

    if (module) {
      await AtomUtils.openModule(module, options);
    }
  }

  /**
   * Hyperclick provider
   * @method getProvider
   * @return {Object}
   */
  getProvider() {
    return {
      providerName: 'jump-to-import-hyperclick',
      wordRegExp: /[$0-9\-\/\w]+/g,
      getSuggestionForWord: _getSuggestionForWord
    };
  }
}

module.exports = new JumpToImport();
