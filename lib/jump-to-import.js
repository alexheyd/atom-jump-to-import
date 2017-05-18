'use babel';

import { CompositeDisposable, File } from 'atom';
import { Range as AtomRange } from 'atom';
import AtomUtils from './utils/atom';
import PathUtils from './utils/filepath';
import Config from './utils/config';
import Utils from './utils/general';
import DefaultConfig from './default-config';

/**
 * Converts a string to a module object
 * @method _getModule
 * @param  {String} str String to attempt to convert to a module object
 * @param  {Object} options Hash of package options
 * @return {Object} Module object
 */
function _getModule(str, options) {
  if (!str) {
    return null;
  }

  const module = Utils.convertToModule(str, options.useEmberPods);

  if (!module) {
    return null;
  }

  return PathUtils.applyPathOverrides(module, Config.getAliases(), options);
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
      if (!self.initialized) {
        self.setup();
      }

      const module = _getModule(text, self.options);

      if (module) {
        await AtomUtils.openModule(module, self.options);
      }
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
   * Indicates whether we're already listening to .babelrc file changes
   * @type {Boolean}
   */
  isSubscribedToBabelChanges: false;

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
    const disableHyperclickSupport = atom.config.get(
      `jump-to-import.disableHyperclickSupport`
    );

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
    this.subscriptions.add(
      atom.commands.add(
        'atom-workspace',
        'jump-to-import:go-to-module',
        this.goToModule.bind(this)
      )
    );
  }

  /**
   * All package setup occurs here. Responsible for extracting the
   * project name from package.json, loading package settings,
   * configuring path aliases from settings and .babelrc
   * @method setup
   */
  setup() {
    const projectPaths = AtomUtils.getProjectPaths();
    const projectNames = Utils.extractProjectNames(AtomUtils.getPackageJson());
    Config.saveProjectPaths(projectPaths);
    Config.saveProjectNames(projectNames);

    const configKeys = Object.keys(this.config);
    this.options = Config.loadSettings(configKeys);
    this.subscribeToConfigChanges(configKeys);

    const {
      disablePathOverrides,
      pathOverrides,
      disableBabelRc
    } = this.options;

    if (!disablePathOverrides) {
      Config.addAliases(Utils.extractUserAliases(pathOverrides, projectNames));
    }

    if (!disableBabelRc) {
      const babelConfigs = AtomUtils.getBabelRc(
        Object.keys(Config.getAliases())
      );

      if (!this.isSubscribedToBabelChanges) {
        this.subscribeToBabelChanges(babelConfigs);
      }

      const babelAliases = Utils.extractBabelAliases(babelConfigs);
      Config.addAliases(babelAliases);
    }

    this.initialized = true;
  }

  /**
   * Subscribes to changes made to the package settings
   * @method subscribeToConfigChanges
   * @param  {Array} configKeys List of config keys to listen for changes
   */
  subscribeToConfigChanges(configKeys) {
    configKeys.forEach(key => {
      this.subscriptions.add(
        AtomUtils.onAtomConfigChange(key, () => (this.initialized = false))
      );
    });
  }

  /**
   * Subscribes to changes made to .babelrc
   * @method subscribeToBabelChanges
   * @param  {Object} configs Hash of .babelrc configs
   */
  subscribeToBabelChanges(configs) {
    this.isSubscribedToBabelChanges = true;

    Object.keys(configs).forEach(projectRoot => {
      const fileName = configs[projectRoot].file;
      const file = new File(fileName, false);

      file.onDidChange(() => this.setup());
    });
  }

  /**
   * Main package functionality occurs here. Finds the string under
   * the user's cursor, figures out the import/require path for the
   * variable if one exists, then opens that file in a new editor,
   * also jumping to a symbol if applicable.
   * @method goToModule
   */
  async goToModule() {
    if (!this.initialized) {
      this.setup();
    }

    const options = this.options;
    const module = _getModule(AtomUtils.findStringUnderCursor(), options);

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
