'use babel';

const fs = require('fs');
const AtomUtils = require('./atom');

module.exports = {
  isImportPath(str) {
    return str ? str[0] === "'" || str[0] === '"' : false;
  },

  isPathAbsolute(path) {
    return path.indexOf('/') === 0;
  },

  isPathRelativeChild(path) {
    return path.indexOf('./') === 0;
  },

  isPathRelativeParent(path) {
    return path.indexOf('../') === 0;
  },

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
    const PathMap = aliases[rootPath];

    // real path to open
    let realPath = magicPath;
    let isNpmPath = false;

    if (module && magicPath) {
      if (this.isPathRelativeChild(magicPath)) {
        realPath = magicPath.replace('./', editorPath + '/');
        // module path is relative, attempting to traverse backwards
      } else if (magicPath.indexOf('npm:') > -1) {
        realPath = this.convertToNPMPath(magicPath);
        isNpmPath = true;
        // attempt to apply magic paths if module path is neither root absolute or relative
      } else if (!pathRelativeToParent && !pathAbsolute) {
        if (!options.disablePathOverrides) {
          let ProjectPathKeys = Object.keys(PathMap).sort(
            (a, b) => b.length - a.length
          );

          // matches the longest path segment defined in configs and overrides it
          ProjectPathKeys.some(pathKey => {
            if (magicPath.indexOf(pathKey) === 0) {
              realPath = magicPath.replace(pathKey, PathMap[pathKey]);
              return true;
            }
          });
        }
      }

      if (!isNpmPath) {
        realPath = `${rootPath}/${realPath}`;
      }

      const hasExtension = !!path.extname(realPath);

      module.path = isNpmPath || hasExtension
        ? realPath
        : this.appendFileExtension(realPath, options);
    }

    return module;
  },

  convertToNPMPath(filePath) {
    const rootPath = AtomUtils.getEditorRootPath();
    const packagePath = filePath.replace('npm:', `${rootPath}/node_modules/`);
    const packageFilePath = `${packagePath}/package.json`;
    let finalPath = null;

    if (fs.existsSync(packageFilePath)) {
      const jsonString = fs.readFileSync(packageFilePath, 'utf8');
      const json = JSON.parse(jsonString);
      const entryPoint = json.main;

      if (entryPoint) {
        finalPath = `${packagePath}/${entryPoint}`;
      }
    }

    return finalPath;
  },

  appendFileExtension(filePath, options) {
    const validExtensions = options.fileExtensions;

    let finalPath = null;

    validExtensions.some(ext => {
      const tmpPath = `${filePath}.${ext}`;
      const fileExists = fs.existsSync(tmpPath);

      if (fileExists && !finalPath) {
        finalPath = tmpPath;
        return true;
      }
    });

    return finalPath;
  },

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

    console.log('extracted path: ', path);

    return { path, method, moduleName: currentWord };
  }
};
