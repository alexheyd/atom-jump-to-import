'use babel';

import DefaultConfig from '../default-config';
import AtomUtils from './atom';

module.exports = {
  /**
   * Hash of path aliases
   * @type {Object}
   */
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
        this.aliases[path] = Object.assign({}, this.aliases[path], alias[path]);
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
