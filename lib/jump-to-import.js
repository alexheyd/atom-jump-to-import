'use babel';

const { CompositeDisposable } = require('atom');
const fs = require('fs');
const DefaultConfig = require('./default-config');
const AtomUtils = require('./atom-utils');
const findBabelConfig = require('find-babel-config');
const TagGenerator = require('symbols-view/lib/tag-generator');

// TODO
// - multiple file extension support (configurable via options)
// - disable .babelrc via options

let ProjectPaths = {};

class JumpToImport {
  constructor() {
    this.rootPaths = null;
    this.projectName = null;
    this.config = DefaultConfig;
    this.options = {};
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
    this.subscriptions.add(atom.commands.add('atom-workspace', 'jump-to-import:go-to-module', this.goToModule.bind(this)));
  }

  packageSetup() {
    this.rootPaths = this.getProjectPaths();
    this.loadBabelConfig();

    this.options = {
      pathOverrides: atom.config.get('jump-to-import.pathOverrides'),
      disablePathOverrides: atom.config.get('jump-to-import.disablePathOverrides')
    };
  }

  subscribeToConfigChanges() {
    this.subscriptions.add(atom.config.onDidChange('jump-to-import:disablePathOverrides', event => {
      AtomUtils.setOption('disablePathOverrides', event.newValue);
    }));

    this.subscriptions.add(atom.config.onDidChange('jump-to-import:pathOverrides', event => {
      AtomUtils.setOption('pathOverrides', event.newValue);
    }));
  }

  // get all root directories in the current project
  getProjectPaths() {
    return atom.project.getPaths();
  }

  // loads .babelrc from each root directory
  loadBabelConfig() {
    this.rootPaths.forEach(projectPath => {
      const babelConfig = findBabelConfig.sync(projectPath);
      const config = this.extractBabelConfig(babelConfig);
      this.saveProjectPaths(projectPath, config);
    });
  }

  // extracts config from .babelrc `config.plugins`
  extractBabelConfig(babelConfig) {
    let config = null;

    if (babelConfig && babelConfig.config) {
      config = babelConfig.config.plugins.find(plugin => {
        const validPluginNames = ['module-resolver', 'babel-plugin-module-resolver', 'module-alias', 'babel-plugin-module-alias'];
        return validPluginNames.indexOf(plugin[0]) > -1;
      })[1];
    }

    return config;
  }

  // saves path overrides relative to each root directory
  saveProjectPaths(projectPath, babelConfig) {
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
    let promises = [];

    atom.project.getDirectories().forEach(dir => {
      const path = dir.path;

      let promise = dir.getFile('package.json').read().then(content => {
        const projectName = content ? JSON.parse(content).name : null;
        ProjectPaths[path].__projectName__ = projectName;
        this.extractOptionsConfig(path, projectName);
      });

      promises.push(promise);
    });

    return Promise.all(promises);
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
    const methodName = currentWordIsMethod ? currentWord : null;
    const importPath = AtomUtils.extractImportPath(moduleName);

    return {
      path: importPath,
      method: methodName
    };
  }

  goToModule() {
    if (!this.projectName) {
      this.getProjectNameFromPackageJSON().then(this.openModule.bind(this));
    } else {
      this.openModule();
    }
  }

  openModule() {
    const module = this.getModule(AtomUtils.findStringUnderCursor());
    const fileMethod = module.method;
    const fullSystemPath = AtomUtils.getEditorRootPath() + '/' + module.path;

    fs.exists(fullSystemPath, exists => {
      if (exists) {
        const openedEditor = this.openEditor(module.path);

        if (openedEditor) {
          openedEditor.then(editor => {
            if (fileMethod) {
              this.jumpToMethod(editor, fileMethod);
            }
          });
        }
      }
    });
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
      })
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

  applyMagicPaths(module) {
    const magicPath = module.path;
    const rootPath = AtomUtils.getEditorRootPath();

    // only use path config relative to current root directory
    const PathMap = ProjectPaths[rootPath];

    // real path to open
    let realPath = '';

    if (module && magicPath) {
      if (magicPath.indexOf('/') === 0) {
        realPath = magicPath.replace('/', PathMap.root);
      } else {
        // sort path overrides by length (longest first) so we attempt to override the more specific paths first
        let ProjectPathKeys = Object.keys(PathMap).sort((a, b) => b.length - a.length);

        // matches the longest path segment defined in configs and overrides it
        ProjectPathKeys.some(pathKey => {
          if (magicPath.indexOf(pathKey) === 0) {
            realPath += magicPath.replace(pathKey, PathMap[pathKey]);
            return true;
          }
        });
      }

      // strip out ./ and append extension
      module.path = realPath.replace(/\.\//g, '') + '.js';
    }

    return module;
  }
}

module.exports = new JumpToImport();
