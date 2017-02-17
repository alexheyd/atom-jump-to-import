'use babel';

const { CompositeDisposable } = require('atom');
const fs = require('fs');
const path = require('path');
const DefaultConfig = require('./default-config');
const AtomUtils = require('./atom-utils');
const findBabelConfig = require('find-babel-config');
const TagGenerator = require('symbols-view/lib/tag-generator');

const babelPluginNames = [
  'module-resolver',
  'babel-plugin-module-resolver',
  'module-alias',
  'babel-plugin-module-alias'
];

let ProjectPaths = {};

class JumpToImport {
  constructor() {
    this.config = DefaultConfig;
    this.options = {};
    this.rootPaths = null;
    this.projectName = null;
    this.subscriptions = null;
  }

  activate() {
    this.registerCommand();
    this.packageSetup();
    this.subscribeToConfigChanges();
  }

  deactivate() {
    if (this.subscriptions) {
      this.subscriptions.dispose();
    }

    AtomUtils.clearCache();
  }

  registerCommand() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.commands.add('atom-workspace', 'jump-to-import:go-to-module', this.goToModule.bind(this))
    );
  }

  packageSetup() {
    this.rootPaths = this.getProjectPaths();

    this.rootPaths.forEach(rootPath => {
      ProjectPaths[rootPath] = {};
    });

    this.options = {
      pathOverrides: atom.config.get('jump-to-import.pathOverrides'),
      disablePathOverrides: atom.config.get('jump-to-import.disablePathOverrides'),
      disableBabelRc: atom.config.get('jump-to-import.disableBabelRc'),
      fileExtensions: atom.config.get('jump-to-import.fileExtensions')
    };

    if (!this.options.disableBabelRc) {
      this.loadBabelConfig();
    }
  }

  subscribeToConfigChanges() {
    this.observeConfigKey('disablePathOverrides');
    this.observeConfigKey('disableBabelRc');
    this.observeConfigKey('pathOverrides');
    this.observeConfigKey('fileExtensions');
  }

  observeConfigKey(key) {
    this.subscriptions.add(
      atom.config.onDidChange(`jump-to-import.${key}`, prop => {
        this.options[key] = prop.newValue;
      })
    );
  }

  // get all root directories in the current project
  getProjectPaths() {
    return atom.project.getPaths();
  }

  // loads .babelrc from each root directory
  loadBabelConfig() {
    this.rootPaths.forEach(rootPath => {
      const babelConfig = findBabelConfig.sync(rootPath);
      const config = babelConfig ? this.extractBabelConfig(babelConfig) : null;
      this.saveBabelProjectPaths(rootPath, config);
    });
  }

  // extracts config from .babelrc `config.plugins`
  extractBabelConfig(babelConfig) {
    let config = null;
    const babelCfg = babelConfig && babelConfig.config ? babelConfig.config : null;

    if (babelCfg) {
      const cfgPlugins = babelCfg.plugins;

      if (cfgPlugins && cfgPlugins.length) {
        config = cfgPlugins.find(plugin => {
          return babelPluginNames.indexOf(plugin[0]) > -1;
        });

        if (config && config.length >= 2) {
          config = config[1];
        }
      }
    }

    return config;
  }

  // saves path overrides relative to each root directory
  saveBabelProjectPaths(projectPath, babelConfig) {
    if (!projectPath || !babelConfig) {
      return;
    }

    if (babelConfig.alias) {
      ProjectPaths[projectPath] = babelConfig.alias;
    }

    if (babelConfig.root) {
      ProjectPaths[projectPath].root = babelConfig.root[0];
    }
  }

  // extracts project name from each root directory's package.json
  // if a name isn't found, pathOverrides set in Options will not get resolved
  getProjectNameFromPackageJSON() {
    atom.project.getDirectories().forEach(dir => {
      const path = dir.path;
      const filePath = `${path}/package.json`;

      if (fs.existsSync(filePath)) {
        const jsonString = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(jsonString);
        const projectName = json.name || null;
        ProjectPaths[path].__projectName__ = projectName;
        this.extractOptionsConfig(path, projectName);
      }
    });
  }

  extractOptionsConfig(rootPath, projectName) {
    const overrides = this.options.pathOverrides;

    if (!overrides || !overrides.length) {
      return;
    }

    overrides.forEach(override => {
      const split = override.split(':');
      let alias = split[0];
      const path = split[1];

      if (alias.indexOf('$PROJECT') > -1 && projectName) {
        alias = alias.replace('$PROJECT', projectName);
      }

      ProjectPaths[rootPath][alias] = path;
    });
  }

  getPathFromVariable(cursorString) {
    const currentWord = cursorString.replace(/,/g);
    const currentWordIsMethod = AtomUtils.currentWordIsMethod();
    const moduleName = currentWordIsMethod ? AtomUtils.getPreviousWord() : currentWord;
    const method = currentWordIsMethod ? currentWord : null;
    const path = AtomUtils.extractImportPath(moduleName);

    return { path, method };
  }

  // entry point
  goToModule() {
    if (!this.projectName) {
      this.getProjectNameFromPackageJSON();
    }

    this.openModule();
  }

  openModule() {
    const module = this.getModule(AtomUtils.findStringUnderCursor());

    if (!module || !module.path && !module.method) {
      return;
    }

    const { path: modulePath, method: moduleMethod } = module;

    if (!modulePath && moduleMethod) {
      this.jumpToMethod(AtomUtils.getEditor(), moduleMethod);
    } else if (modulePath) {
      fs.exists(modulePath, exists => {
        if (exists) {
          const openedEditor = this.openEditor(modulePath);

          if (openedEditor) {
            openedEditor.then(editor => {
              if (moduleMethod) {
                this.jumpToMethod(editor, moduleMethod);
              }
            });
          }
        }
      });
    }
  }

  openEditor(filePath) {
    return atom.workspace.open(filePath);
  }

  jumpToMethod(editor, method) {
    const fileTags = this.getFileTags(editor);

    if (fileTags) {
      fileTags.then(tags => {
        const matchingTags = tags.filter(tag => tag.name.indexOf(method) > -1);

        if (matchingTags.length) {
          this.setFilePosition(editor, matchingTags[0].position);
        }
      });
    }
  }

  getFileTags(editor) {
    const editorPath = editor.getPath();
    const tags = new TagGenerator(editorPath, 'source.js').generate();
    return tags;
  }

  setFilePosition(editor, position) {
    if (editor && position) {
      editor.scrollToBufferPosition(position, { center: true });
      editor.setCursorBufferPosition(position);
      editor.moveToFirstCharacterOfLine();
    }
  }

  getModule(cursorString) {
    let modulePath = cursorString.substring(1, cursorString.length - 1);
    let pathFromVar = this.getPathFromVariable(cursorString);
    let module = AtomUtils.isImportPath(cursorString) ? { path: modulePath } : pathFromVar;
    return this.applyMagicPaths(module);
  }

  appendFileExtension(filePath) {
    const validExtensions = this.options.fileExtensions;

    let finalPath = null;

    validExtensions.some(ext => {
      const tmpPath = `${filePath}.${ext}`;
      // const fullPath = path.join(rootPath, tmpPath);
      const fileExists = fs.existsSync(tmpPath);

      if (fileExists && !finalPath) {
        finalPath = tmpPath;
        return true;
      }
    });

    return finalPath;
  }

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
  }

  applyMagicPaths(module) {
    const magicPath = module.path;
    const pathAbsolute = AtomUtils.isPathAbsolute(magicPath);
    const pathRelativeToParent = AtomUtils.isPathRelativeParent(magicPath);
    const rootPath = pathRelativeToParent
      ? AtomUtils.getEditorDirPath()
      : AtomUtils.getEditorRootPath();
    const editorPath = AtomUtils.getEditorDirPath().replace(rootPath + '/', '');

    // only use path config relative to current root directory
    const PathMap = ProjectPaths[rootPath];

    // real path to open
    let realPath = magicPath;
    let isNpmPath = false;

    if (module && magicPath) {
      if (AtomUtils.isPathRelativeChild(magicPath)) {
        realPath = magicPath.replace('./', editorPath + '/');
        // module path is relative, attempting to traverse backwards
      } else if (magicPath.indexOf('npm:') > -1) {
        realPath = this.convertToNPMPath(magicPath);
        isNpmPath = true;
        // attempt to apply magic paths if module path is neither root absolute or relative
      } else if (!pathRelativeToParent && !pathAbsolute) {
        if (!this.options.disablePathOverrides) {
          let ProjectPathKeys = Object.keys(PathMap).sort((a, b) => b.length - a.length);

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

      module.path = isNpmPath ? realPath : this.appendFileExtension(realPath);
    }

    return module;
  }
}

module.exports = new JumpToImport();
