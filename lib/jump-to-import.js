'use babel';

const { CompositeDisposable } = require('atom');
const fs = require('fs');
const DefaultConfig = require('./default-config');
const AtomUtils = require('./atom-utils');
const findBabelConfig = require('find-babel-config');
const TagGenerator = require('symbols-view/lib/tag-generator');

// TODO
// - jump to method
// - multiple root project folders

let ProjectPaths = {};

class JumpToImport {
  constructor() {
    this.projectPath = null;
    this.projectName = null;
    this.config = DefaultConfig;
    this.options = {};
    this.subscriptions = null;
  }

  activate() {
    this.registerCommand();
    this.packageSetup();
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
    this.projectPath = this.getProjectPath();
    this.loadBabelConfig();

    this.options = {
      pathOverrides: atom.config.get('jump-to-import.pathOverrides'),
      disablePathOverrides: atom.config.get('jump-to-import.disablePathOverrides')
    };

    this.subscribeToConfigChanges();
  }

  getProjectPath() {
    // TODO: don't restrict to one root folder
    return atom.project.getPaths()[0];
  }

  loadBabelConfig() {
    const babelConfig = findBabelConfig.sync(this.projectPath);

    if (!babelConfig || !babelConfig.config) {
      return;
    }

    const config = babelConfig.config.plugins.find(plugin => {
      const validPluginNames = ['module-resolver', 'babel-plugin-module-resolver', 'module-alias', 'babel-plugin-module-alias'];
      return validPluginNames.indexOf(plugin[0]) > -1;
    })[1];

    ProjectPaths = config.alias;

    if (config.root) {
      ProjectPaths.root = config.root[0];
    }
  }

  getProjectNameFromPackageJSON() {
    const directories = atom.project.getDirectories();
    const mainDirectory = directories[0];

    return mainDirectory.getFile('package.json').read().then(contents => {
      const name = JSON.parse(contents).name;
      this.projectName = name;

      this.options.pathOverrides.forEach(override => {
        const split = override.split(':');
        let alias = split[0];
        const path = split[1];

        if (alias.indexOf('$PROJECT') > -1) {
          alias = alias.replace('$PROJECT', this.projectName);
        }

        ProjectPaths[alias] = path;
      });
    });
  }

  subscribeToConfigChanges() {
    this.subscriptions.add(atom.config.onDidChange('jump-to-import:disablePathOverrides', event => {
      AtomUtils.setOption('disablePathOverrides', event.newValue);
    }));

    this.subscriptions.add(atom.config.onDidChange('jump-to-import:pathOverrides', event => {
      AtomUtils.setOption('pathOverrides', event.newValue);
    }));
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
    const fullSystemPath = this.projectPath + '/' + module.path;

    fs.exists(fullSystemPath, exists => {
      if (exists) {
        this.openEditor(module.path, module.method);
      }
    });
  }

  openEditor(filePath, fileMethod) {
    const openedEditor = atom.workspace.open(filePath);

    if (openedEditor) {
      openedEditor.then(editor => {
        if (fileMethod) {
          this.jumpToMethod(editor, fileMethod);
        }
      });
    }
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
    let realPath = '';

    if (module && magicPath) {
      if (magicPath.indexOf('/') === 0) {
        realPath = magicPath.replace('/', ProjectPaths.root);
      } else {
        // sort path overrides by length (longest first) so we attempt to override the more specific paths first
        let ProjectPathKeys = Object.keys(ProjectPaths).sort((a, b) => b.length - a.length);

        ProjectPathKeys.some(pathKey => {
          if (magicPath.indexOf(pathKey) === 0) {
            realPath += magicPath.replace(pathKey, ProjectPaths[pathKey]);
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
