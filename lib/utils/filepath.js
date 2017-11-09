'use babel';

import fs from 'fs';
import npmPath from 'path';
import AtomUtils from './atom';
import Logger from './logger';

/**
 * Shorthand to get root path
 * @method _getRootPath
 * @param  {Boolean} pathRelativeToParent Indicate if path is relative, traversing up
 * @return {String} Root path
 */
function _getRootPath(pathRelativeToParent) {
  return pathRelativeToParent ? AtomUtils.getEditorDirPath() : AtomUtils.getEditorRootPath();
}

/**
 * Shorthand to get editor's path
 * @method _getEditorPath
 * @param  {String} rootPath Project root path
 * @return {String} Editor path
 */
function _getEditorPath(rootPath) {
  return AtomUtils.getEditorDirPath().replace(rootPath + '/', '');
}

/**
 * Check if module is an external module (npm or bower)
 * @method _isExternalModule
 * @param  {Object} module Hash of module path, name and method
 * @return {Boolean}
 */
function _isExternalModule(module) {
  const path = module.path;
  return path.indexOf('npm:') > -1 || path.indexOf('/') === -1;
}

/**
 * Converts a path to be a relative child path, prefixing the root path
 * @method _convertToRelativeChildPath
 * @param  {String} magicPath Original, unconverted module path
 * @param  {String} rootPath  Root path to prefix
 * @return {String} Converted path
 */
function _convertToRelativeChildPath(magicPath, rootPath) {
  return magicPath.replace('./', npmPath.join(_getEditorPath(rootPath), '/'));
}

/**
 * Sorts the keys of a hash by string length, longest first
 * @method sortHashByLongestFirst
 * @param  {Object} hash Hash of path aliases
 * @return {Array} List of sorted hash keys
 */
function _sortHashByLongestFirst(hash) {
  return Object.keys(hash).sort((a, b) => b.length - a.length);
}

/**
 * Apply path overrides
 * @method _applyOverrides
 * @param  {String} magicPath Original, unconverted module path
 * @param  {Object} aliases   Hash of path aliases
 * @param  {String} rootPath  Root path to prefix
 * @return {String} Path converted with alias overrides
 */
function _applyOverrides(magicPath, aliases, rootPath) {
  const aliasKeys = _sortHashByLongestFirst(aliases);
  let convertedPath = null;

  // matches the longest path segment defined in configs and overrides it
  const appliedOverride = aliasKeys.some(alias => {
    if (magicPath.indexOf(alias) === 0) {
      convertedPath = magicPath.replace(alias, aliases[alias]);
      return true;
    }

    return false;
  });

  // as a fallback, attempt to treat it as an npm module
  if (!appliedOverride) {
    convertedPath = _convertToExternalModule(magicPath);
  }

  return convertedPath;
}

/**
 * Applies name aliases to an Ember.Service injection
 * @method _applyServiceAliases
 * @param  {String} filePath Ember.Service service path
 * @param  {Array} aliases List of aliases
 * @return {String} Aliased Ember.Service name
 */
function _applyServiceAliases(filePath, aliases) {
  let path = filePath;

  aliases.forEach(alias => {
    const [toReplace, realName] = alias.split(':');

    if (path.indexOf(toReplace) > -1) {
      path = path.replace(toReplace, realName);
    }
  });

  return path;
}

/**
 * Converts the path to an external module path (NPM or Bower)
 * @method _convertToExternalModule
 * @param  {String} filePath File path to convert
 * @return {String} Converted file path
 */
function _convertToExternalModule(filePath) {
  let finalPath = _convertToNpmPath(filePath);

  if (!finalPath) {
    finalPath = _convertToBowerPath(filePath);
  }

  return finalPath;
}

/**
 * Extracts the entry point of a package from its package.json or bower.json
 * @method _getEntryPointFromJson
 * @param  {String} filePath    Path to package.json or bower.json
 * @param  {String} packagePath Path to the package itself
 * @return {String} Convert file path
 */
function _getEntryPointFromJson(filePath, packagePath) {
  let finalPath = null;

  if (fs.existsSync(filePath)) {
    const jsonString = fs.readFileSync(filePath, 'utf8');
    let entryPoint = JSON.parse(jsonString).main;
    let entryFileName = null;

    if (Array.isArray(entryPoint) && entryPoint.length) {
      entryPoint = entryPoint.filter(file => file.indexOf('.js') > -1);

      if (entryPoint && entryPoint.length) {
        entryFileName = entryPoint[0];
      }
    } else if (typeof entryPoint === 'string') {
      entryFileName = entryPoint;
    }

    if (entryFileName) {
      finalPath = npmPath.join(packagePath, entryFileName);
    }
  }

  return finalPath;
}

/**
 * Converts a path to a Bower path
 * @method _convertToBowerPath
 * @param  {String} filePath Path to convert to a Bower path
 * @return {String} Converted path
 */
function _convertToBowerPath(filePath) {
  const rootPath = AtomUtils.getEditorRootPath();
  const bowerPath = npmPath.join(rootPath, 'bower_components', '/');
  const packagePath = npmPath.join(bowerPath, filePath);
  const packageJsonPath = npmPath.join(packagePath, 'package.json');
  const bowerJsonPath = npmPath.join(packagePath, 'bower.json');

  return (
    _getEntryPointFromJson(packageJsonPath, packagePath) ||
    _getEntryPointFromJson(bowerJsonPath, packagePath)
  );
}

/**
 * Converts a path to an NPM path
 * @method _convertToNpmPath
 * @param  {String} filePath Path to convert to an NPM path
 * @return {String} Converted path
 */
function _convertToNpmPath(filePath) {
  const rootPath = AtomUtils.getEditorRootPath();
  const nodeModulesPath = npmPath.join(rootPath, 'node_modules', '/');
  const packagePath =
    filePath.indexOf('npm:') > -1
      ? filePath.replace('npm:', nodeModulesPath)
      : npmPath.join(nodeModulesPath, filePath);
  const packageJsonPath = npmPath.join(packagePath, 'package.json');
  return _getEntryPointFromJson(packageJsonPath, packagePath);
}

/**
 * Appends file extension to file path. If file isn't found, try treating
 * the path like a directory and look for an `index` file
 * @method      _appendExtension
 * @param       {String} filePath File path to append extension to
 * @param       {Array} fileExtensions List of file extensions to try
 * @param       {String} filename File name to fallback to. Defaults to `/index`
 * @return      {String} File path with extension
 */
function _appendExtension(filePath, fileExtensions, filename) {
  const name = filename || '';
  let finalPath = null;

  fileExtensions.some(ext => {
    const tmpPath = `${filePath}${name}.${ext}`;
    const fileExists = fs.existsSync(tmpPath);

    if (fileExists) {
      finalPath = tmpPath;
      return true;
    }

    return false;
  });

  return finalPath;
}

module.exports = {
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
    if (!module.path) return module;

    const mod = module;
    const magicPath = module.path;
    const { disablePathOverrides, fileExtensions } = options;
    const pathRelativeToParent = this.isPathRelativeParent(magicPath);
    const rootPath = _getRootPath(pathRelativeToParent);
    const isExternalModule = _isExternalModule(mod);
    const shouldApplyOverrides = !pathRelativeToParent && !this.isPathAbsolute(magicPath);

    if (module && magicPath) {
      if (mod.type === 'service') {
        mod.path = _applyServiceAliases(magicPath, options.serviceOverrides);
      } else if (this.isPathRelativeChild(magicPath)) {
        mod.path = _convertToRelativeChildPath(magicPath, rootPath);
      } else if (isExternalModule) {
        mod.path = _convertToExternalModule(magicPath);
      } else if (shouldApplyOverrides && !disablePathOverrides) {
        mod.path = _applyOverrides(magicPath, aliases, rootPath);
      }

      if (!mod.path) {
        Logger.report({
          notFound: magicPath
        });
        return mod;
      }

      if (!isExternalModule && mod.path.indexOf(rootPath) === -1) {
        mod.path = npmPath.join(rootPath, mod.path);
      }
      
      const ext = npmPath.extname(mod.path);
      let hasExtension = false;
      for (let fileExtension of fileExtensions) {
        if ('.'+fileExtension === ext) hasExtension = true;
      }
      
      if (!hasExtension) {
        mod.path = this.appendFileExtension(mod.path, fileExtensions);
      }
    }

    return mod;
  },

  /**
   * Attempts to find an existing file with extensions provided in package
   * settings
   * @method appendFileExtension
   * @param  {String} filePath File path to append extension to
   * @param  {Object} options  Hash of package settings
   * @return {String} File path with extension appended
   */
  appendFileExtension(filePath, fileExtensions) {
    return (
      _appendExtension(filePath, fileExtensions) ||
      _appendExtension(filePath, fileExtensions, '/index')
    );
  },

  /**
   * Gets the import/require path from a provided module name
   * @method getPathFromVariable
   * @param  {String} cursorString Module name
   * @param {Boolean} useEmberPods Use Ember pod structure to find services
   * @return {Object} Hash of module path, method and name
   */
  getPathFromVariable(cursorString, useEmberPods) {
    const currentWord = cursorString.replace(/,/g);
    const currentWordIsMethod = AtomUtils.currentWordIsMethod();
    const moduleName = currentWordIsMethod ? AtomUtils.getPreviousWord() : currentWord;
    const method = currentWordIsMethod ? currentWord : null;
    let path = null;
    let pathType = null;

    // don't attempt to find import path if method was invoked on `this`
    if (moduleName !== 'this') {
      // check if the method being called is the module itself,
      // fallback to checking the module name
      const pathHash =
        AtomUtils.extractImportPath(method, useEmberPods) ||
        AtomUtils.extractImportPath(moduleName, useEmberPods);

      if (pathHash) {
        path = pathHash.path;
        pathType = pathHash.type;
      }
    }

    return { path, type: pathType, method, name: moduleName };
  }
};
