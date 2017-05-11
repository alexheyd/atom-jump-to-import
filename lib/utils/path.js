'use babel';

const fs = require('fs');
const npmPath = require('path');
const AtomUtils = require('./atom');

module.exports = {
  /**
   * Checks if a string is an import path
   * @method isImportPath
   * @param  {String} str String to check
   * @return {Boolean}
   */
  isImportPath(str) {
    return str ? str[0] === "'" || str[0] === '"' : false;
  },

  /**
   * Checks if a path is absolute
   * @method isPathAbsolute
   * @param  {String} path Path to check
   * @return {Boolean}
   */
  isPathAbsolute(path) {
    return path.indexOf('/') === 0;
  },

  /**
   * Checks if the path is relative to a child
   * @method isPathRelativeChild
   * @param  {String} path Path to check
   * @return {Boolean}
   */
  isPathRelativeChild(path) {
    return path.indexOf('./') === 0;
  },

  /**
   * Checks if the path is relative to its parent
   * @method isPathRelativeParent
   * @param  {String} path Path to check
   * @return {Boolean}
   */
  isPathRelativeParent(path) {
    return path.indexOf('../') === 0;
  },

  /**
   * Applies path overrides
   * @method applyPathOverrides
   * @param  {Object} module  Hash of module path, name and method
   * @param  {Object} aliases Hash of aliases to applyPathOverrides
   * @param  {Object} options Hash of package options
   * @return {Object} Module with path overrides applied
   */
  applyPathOverrides(module, aliases, options) {
    const magicPath = module.path;

    if (!magicPath) return false;

    const pathAbsolute = this.isPathAbsolute(magicPath);
    const pathRelativeToParent = this.isPathRelativeParent(magicPath);
    const rootPath = pathRelativeToParent
      ? AtomUtils.getEditorDirPath()
      : AtomUtils.getEditorRootPath();
    const editorPath = AtomUtils.getEditorDirPath().replace(rootPath + '/', '');
    // only use path config relative to current root directory
    const aliasMap = aliases[rootPath];
    // real path to open
    let realPath = magicPath;
    let isNpmPath = false;

    if (module && magicPath) {
      if (this.isPathRelativeChild(magicPath)) {
        realPath = magicPath.replace('./', npmPath.join(editorPath, '/'));
        // module is an npm module
      } else if (
        magicPath.indexOf('npm:') > -1 ||
        magicPath.indexOf('/') === -1
      ) {
        realPath = this.convertToNPMPath(magicPath);
        isNpmPath = true;
        // attempt to apply magic paths if module path is neither root absolute or relative
      } else if (!pathRelativeToParent && !pathAbsolute) {
        // allow path overrides to be disabled
        if (!options.disablePathOverrides) {
          let appliedOverride = false;

          // sort aliases by length so most specific overrides get applied
          const aliasKeys = this.sortHashByLongestFirst(aliasMap);

          // matches the longest path segment defined in configs and overrides it
          aliasKeys.some(alias => {
            if (magicPath.indexOf(alias) === 0) {
              realPath = magicPath.replace(alias, aliasMap[alias]);
              appliedOverride = true;
              return true;
            }
          });

          // as a fallback, attempt to treat it as an npm module
          if (!appliedOverride) {
            realPath = this.convertToNPMPath(magicPath);
            isNpmPath = true;
          }
        }
      }

      if (!isNpmPath) {
        realPath = npmPath.join(rootPath, realPath);
      }

      const hasExtension = !!path.extname(realPath);

      module.path = isNpmPath || hasExtension
        ? realPath
        : this.appendFileExtension(realPath, options);
    }

    return module;
  },

  /**
   * Converts a path to an NPM path
   * @method convertToNPMPath
   * @param  {String} filePath Path to convertToNPMPath
   * @return {String} Converted path
   */
  convertToNPMPath(filePath) {
    const rootPath = AtomUtils.getEditorRootPath();
    let packagePath = '';

    if (filePath.indexOf('npm:') > -1) {
      packagePath = filePath.replace(
        'npm:',
        npmPath.join(rootPath, 'node_modules/')
      );
    } else {
      packagePath = npmPath.join(rootPath, 'node_modules', filePath);
    }

    const packageJsonPath = npmPath.join(packagePath, 'package.json');
    let finalPath = null;

    if (fs.existsSync(packageJsonPath)) {
      const jsonString = fs.readFileSync(packageJsonPath, 'utf8');
      const json = JSON.parse(jsonString);
      const entryPoint = json.main;

      if (entryPoint) {
        finalPath = npmPath.join(packagePath, entryPoint);
      }
    }

    return finalPath;
  },

  /**
   * Attempts to find an existing file with extensions provided in package
   * settings
   * @method appendFileExtension
   * @param  {String} filePath File path to append extension to
   * @param  {Object} options  Hash of package settings
   * @return {String} File path with extension appended
   */
  appendFileExtension(filePath, options) {
    const validExtensions = options.fileExtensions;

    let finalPath = null;

    validExtensions.some(ext => {
      const tmpPath = `${filePath}.${ext}`;
      const fileExists = fs.existsSync(tmpPath);

      if (fileExists) {
        finalPath = tmpPath;
        return true;
      }

      return false;
    });

    return finalPath;
  },

  /**
   * Gets the import/require path from a provided module name
   * @method getPathFromVariable
   * @param  {String} cursorString Module name
   * @return {Object} Hash of module path, method and name
   */
  getPathFromVariable(cursorString) {
    const currentWord = cursorString.replace(/,/g);
    const currentWordIsMethod = AtomUtils.currentWordIsMethod();
    const moduleName = currentWordIsMethod
      ? AtomUtils.getPreviousWord()
      : currentWord;
    const method = currentWordIsMethod ? currentWord : null;

    // check if the method being called is the module itself,
    // fallback to checking the module name
    const path =
      AtomUtils.extractImportPath(method) ||
      AtomUtils.extractImportPath(moduleName);

    return { path, method, moduleName: currentWord };
  },

  /**
   * Sorts the keys of a hash by string length, longest first
   * @method sortHashByLongestFirst
   * @param  {Object} hash Hash of path aliases
   * @return {Array} List of sorted hash keys
   */
  sortHashByLongestFirst(hash) {
    return Object.keys(hash).sort((a, b) => b.length - a.length);
  }
};
