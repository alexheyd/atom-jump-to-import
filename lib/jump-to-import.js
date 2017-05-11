'use babel';

const { CompositeDisposable } = require('atom');
const AtomUtils = require('./utils/atom');
const PathUtils = require('./utils/path');
const Config = require('./utils/config');
const Utils = require('./utils/general');
const DefaultConfig = require('./default-config');

class JumpToImport {
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
    const json = AtomUtils.getPackageJson();
    const projectNames = Utils.extractProjectNames(json);
    const configKeys = [
      'pathOverrides',
      'disablePathOverrides',
      'disableBabelRc',
      'fileExtensions'
    ];

    this.options = Config.loadSettings(configKeys);
    Config.subscribeToConfigChanges(this, configKeys);
    Config.saveProjectPaths(projectPaths);
    Config.saveProjectNames(projectNames);

    const userAliases = Utils.extractUserAliases(
      this.options.pathOverrides,
      projectNames
    );

    Config.addAliases(userAliases);

    if (!this.options.disableBabelRc) {
      const babelConfigs = AtomUtils.getBabelRc(
        Object.keys(Config.getAliases())
      );
      const babelAliases = Utils.extractBabelAliases(babelConfigs);
      Config.addAliases(babelAliases);
    }
  }

  /**
   * Main package functionality occurs here. Finds the string under
   * the user's cursor, figures out the import/require path for the
   * variable if one exists, then opens that file in a new editor,
   * also jumping to a symbol if applicable.
   * @method goToModule
   */
  goToModule() {
    const cursorString = AtomUtils.findStringUnderCursor();
    let module = Utils.convertToModule(cursorString);

    module = PathUtils.applyPathOverrides(
      module,
      Config.getAliases(),
      this.options
    );

    if (!module || (!module.path && !module.method)) {
      return;
    }

    AtomUtils.openModule(module);
  }
}

module.exports = new JumpToImport();
