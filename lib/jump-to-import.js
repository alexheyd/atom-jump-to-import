'use babel';

const { CompositeDisposable, File } = require('atom');
const AtomUtils = require('./utils/atom');
const PathUtils = require('./utils/filepath');
const Config = require('./utils/config');
const Utils = require('./utils/general');
const DefaultConfig = require('./default-config');

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
   * Package activation hook -- performs package setup
   * @method activate
   */
  activate() {
    this.setup();
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
    const configKeys = [
      'pathOverrides',
      'disablePathOverrides',
      'disableBabelRc',
      'fileExtensions'
    ];

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
    configKeys.forEach(key => {
      this.subscriptions.add(
        AtomUtils.onAtomConfigChange(key, prop => {
          this.options[key] = prop.newValue;
          this.settingsChanged = true;
        })
      );
    });
  }

  subscribeToBabelChanges(configs) {
    this.isSubscribedToBabelChanges = true;

    Object.keys(configs).forEach(projectRoot => {
      const fileName = configs[projectRoot].file;
      const file = new File(fileName, false);

      file.onDidChange(() => (this.settingsChanged = true));
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

    const cursorString = AtomUtils.findStringUnderCursor();

    if (!cursorString) {
      return;
    }

    const module = Utils.convertToModule(cursorString);

    if (!module) {
      return;
    }

    const finalModule = PathUtils.applyPathOverrides(
      module,
      Config.getAliases(),
      this.options
    );

    if (!finalModule || (!finalModule.path && !finalModule.method)) {
      return;
    }

    await AtomUtils.openModule(finalModule);
  }
}

module.exports = new JumpToImport();
