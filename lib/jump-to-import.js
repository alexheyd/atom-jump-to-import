'use babel';

import { CompositeDisposable, File } from 'atom';
import { Range as AtomRange } from 'atom';
import AtomUtils from './utils/atom';
import PathUtils from './utils/filepath';
import Config from './utils/config';
import Utils from './utils/general';
import DefaultConfig from './default-config';

function _getModule(str, options) {
  if (!str) {
    return null;
  }

  const module = Utils.convertToModule(str);

  if (!module) {
    return null;
  }

  return PathUtils.applyPathOverrides(module, Config.getAliases(), options);
}

class JumpToImport {
  /**
   * Indicates whether we're already listening to .babelrc file changes
   * @type {Boolean}
   */
  isSubscribedToBabelChanges: false;
  /**
   * Indicate whether package settings have changed
   * @type {Boolean}
   */
  settingsChanged: false;

  /**
   * Loads default config and registers package command
   * @method constructor
   */
  constructor() {
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
    await this.setup();

    if (
      !atom.packages.isPackageLoaded('hyperclick') &&
      !this.options.disableHyperclickSupport
    ) {
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
    const configKeys = Object.keys(this.config);

    this.options = Config.loadSettings(configKeys);
    this.subscribeToConfigChanges(configKeys);

    Config.saveProjectPaths(projectPaths);
    Config.saveProjectNames(projectNames);

    if (!this.options.disablePathOverrides) {
      Config.addAliases(
        Utils.extractUserAliases(this.options.pathOverrides, projectNames)
      );
    }

    if (!this.options.disableBabelRc) {
      const babelConfigs = AtomUtils.getBabelRc(
        Object.keys(Config.getAliases())
      );

      if (!this.isSubscribedToBabelChanges) {
        this.subscribeToBabelChanges(babelConfigs);
      }

      const babelAliases = Utils.extractBabelAliases(babelConfigs);
      Config.addAliases(babelAliases);
    }
  }

  /**
   * Subscribes to changes made to the package settings
   * @method subscribeToConfigChanges
   * @param  {Array} configKeys List of config keys to listen for changes
   */
  subscribeToConfigChanges(configKeys) {
    this.subscriptions.add(AtomUtils.onAtomConfigChange(() => this.setup()));
  }

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
    if (this.settingsChanged) {
      this.settingsChanged = false;
      this.setup();
    }

    const module = _getModule(AtomUtils.findStringUnderCursor(), this.options);

    if (!module || (!module.path && !module.method)) {
      return;
    }

    await AtomUtils.openModule(module, this.options);
  }

  getProvider() {
    const options = this.options;

    return {
      providerName: 'jump-to-import-hyperclick',
      wordRegExp: /[$0-9\/\w]+/g,
      getSuggestionForWord(textEditor, text, range) {
        const { start, end } = range;

        return {
          range: new AtomRange(start, end),
          async callback() {
            const module = _getModule(text, options);

            if (module) {
              await AtomUtils.openModule(module, options);
            }
          }
        };
      }
    };
  }
}

module.exports = new JumpToImport();
