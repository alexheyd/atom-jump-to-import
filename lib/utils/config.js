'use babel';

const DefaultConfig = require('../default-config');
const AtomUtils = require('./atom');

/**
 * Adds subscription for package setting changes
 * @method _observeConfigKey
 * @param  {Object} obj JumpToImport class instance
 * @param  {String} key Config key
 */
const _observeConfigKey = (obj, key) => {
  obj.subscriptions.add(AtomUtils.onAtomConfigChange(obj, key));
};

module.exports = {
  aliases: {},

  /**
   * Short-hand to reference path aliases
   * @method getAliases
   * @return {Object} Project path aliases
   */
  getAliases() {
    return this.aliases;
  },

  /**
   * Loads package settings from an array of config keys
   * @method loadSettings
   * @param  {Array} keys List of config keys to load
   * @return {Object} Package settings
   */
  loadSettings(keys) {
    const json = {};

    keys.map(key => {
      json[key] = AtomUtils.getAtomConfig(key);
    });

    return json;
  },

  /**
   * Subscribes to changes made to the package settings
   * @method subscribeToConfigChanges
   * @param  {Object} obj JumpToImport class instance
   * @param  {Array} keys List of config keys to listen for changes
   */
  subscribeToConfigChanges(obj, keys) {
    keys.forEach(key => _observeConfigKey(obj, key));
  },

  /**
   * Saves project paths
   * @method saveProjectPaths
   * @param  {Array} paths List of root project directory paths
   */
  saveProjectPaths(paths) {
    paths.forEach(path => {
      this.aliases[path] = {};
    });
  },

  /**
   * Adds a hash of path aliases
   * @method addAliases
   * @param  {Object} aliases Path aliases
   */
  addAliases(...aliases) {
    aliases.forEach(alias => {
      Object.keys(alias).forEach(path => {
        const oldAliases = this.aliases[path];
        const newAliases = Object.assign({}, oldAliases, alias[path]);
        this.aliases[path] = newAliases;
      });
    });
  },

  /**
   * Saves project names
   * @method saveProjectNames
   * @param  {Object} json Hash of project root paths and their associated project name
   */
  saveProjectNames(json) {
    Object.keys(json).forEach(path => {
      if (!this.aliases[path]) {
        this.aliases[path] = {};
      }

      this.aliases[path].__project_name__ = json[path];
    });
  }
};
