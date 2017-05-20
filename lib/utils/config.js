'use babel';

import AtomUtils from './atom';
import npmPath from 'path';

module.exports = {
  /**
   * Loads package settings from an array of config keys
   * @method loadUserSettings
   * @param  {Array} keys List of config keys to load
   * @return {Object} Package settings
   */
  loadUserSettings(keys) {
    const json = { user: {} };

    keys.map(key => {
      json.user[key] = AtomUtils.getAtomConfig(key);
    });

    return json;
  },

  /**
   * Loads settings from .jump-to-import files
   * @method loadProjectSettings
   * @param  {Object} configUrls Hash of .jump-to-import paths
   * @return {Object} Hash of project settings
   */
  loadProjectSettings(configUrls) {
    const json = {};

    Object.keys(configUrls).forEach(rootPath => {
      const filePath = configUrls[rootPath];

      if (fs.existsSync(filePath)) {
        const jsonString = fs.readFileSync(filePath, 'utf8');
        json[rootPath] = JSON.parse(jsonString);
      }
    });

    return json;
  },

  /**
   * Creates .jump-to-import config in every project root folder
   * @method createDefaultProjectConfig
   * @param  {Array} projectPaths List of root project folder paths
   * @param  {Object} defaultConfig Default config to populate .jump-to-import with
   */
  createDefaultProjectConfig(projectPaths, defaultConfig) {
    projectPaths.forEach(rootPath => {
      this.createProjectConfig(rootPath, defaultConfig);
    });
  },

  /**
   * Creates default .jump-to-import config
   * @method createProjectConfig
   * @param  {String} rootPath Project folder to create the file in
   */
  createProjectConfig(rootPath, defaultConfig) {
    const configPath = npmPath.join(rootPath, '.jump-to-import');
    const contents = JSON.stringify(defaultConfig, null, 2);
    fs.writeFile(configPath, contents);
  }
};
