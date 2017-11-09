'use babel';

import TagGenerator from 'symbols-view/lib/tag-generator';
import fs from 'fs';
import npmPath from 'path';
import findBabelConfig from 'find-babel-config';

const REGEX_IMPORT = 'import(?:.*?\n?)from [\'"](.*?)[\'"]';
const REGEX_IMPORT_FROM = '(?:.*?)from [\'"](.*?)[\'"]';
const REGEX_REQUIRE = '(?:.*?)require\\([\'"](.*?)[\'"]\\)';
const REGEX_REQUIRE_PATH = '(.*)require';

/**
 * Dasherizes a string
 * @method _dasherize
 * @param  {String} str String to dasherize
 * @return {String} Dasherized string
 */
function _dasherize(str) {
  return str.replace(/[A-Z]/g, function(char, index) {
    return (index !== 0 ? '-' : '') + char.toLowerCase();
  });
}

/**
 * Capitalizes a string
 * @method _capitalize
 * @param  {String} str String to capitalize
 * @return {String} Capitalized string
 */
function _capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Creates a new pane, split in a specific direction
 * @method _createPane
 * @param  {String} position Direction to split
 * @return {Object} New pane
 */
function _createPane(position, onDestroy) {
  const activePane = atom.workspace.getActivePane();
  const tmpPane = activePane[`split${_capitalize(position)}`]();
  tmpPane.onDidDestroy(onDestroy);
  return tmpPane;
}

module.exports = {
  /**
   * Reference to the pane used to open the module file so we can reuse the
   * same pane for other files
   * @type {Object}
   * @default null
   */
  tmpPane: null,

  /**
   * Reference to last active text editor
   * @type {Object}
   */
  activeEditor: null,

  /**
   * Keep track of the active TextEditor, because when single clicking a file
   * from the tree-view, atom.workspace.getEditor() returns undefined
   * @method subscribeToFileOpen
   */
  subscribeToFileOpen() {
    return atom.workspace.onDidOpen(event => {
      this.activeEditor = event.item;
    });
  },

  /**
   * Looks for all .jump-to-import config files in all root directories
   * @method getProjectConfigUrls
   * @param  {Array} projectRoots List of project root directory paths
   * @return {Object} Hash of .jump-to-import paths
   */
  getProjectConfigUrls(projectRoots) {
    const configs = {};

    projectRoots.forEach(rootPath => {
      const configPath = npmPath.join(rootPath, '.jump-to-import');

      if (fs.existsSync(configPath)) {
        configs[rootPath] = configPath;
      }
    });

    return configs;
  },

  /**
   * Get all root project directory paths
   * @method getProjectPaths
   * @return {Array} List of root directories in the project
   */
  getProjectPaths() {
    return atom.project.getPaths();
  },

  /**
   * Gets the active text editor
   * @method getEditor
   * @return {TextEditor} Atom TextEditor instance
   */
  getEditor() {
    return atom.workspace.getActiveTextEditor() || this.activeEditor;
  },

  /**
   * Gets the editor's current path
   * @method getEditorPath
   * @return {String} Editor's current path
   */
  getEditorPath() {
    return this.getEditor().getPath();
  },

  /**
   * Gets the editor's current working directory
   * @method getEditorDirPath
   * @return {String} Editor's current working directory
   */
  getEditorDirPath() {
    const path = this.getEditorPath();
    return path.substring(0, path.lastIndexOf('/'));
  },

  /**
   * Gets the editor's root path
   * @method getEditorRootPath
   * @return {String} Editor's root path
   */
  getEditorRootPath() {
    return atom.project.relativizePath(this.getEditorPath())[0];
  },

  /**
   * Gets all package.json from each root directory in the project
   * @method getPackageJson
   * @return {Object} Hash of package.json
   */
  getPackageJson() {
    let json = {};

    this.getDirectories().forEach(dir => {
      const path = dir.path;
      const filePath = npmPath.join(path, 'package.json');

      if (fs.existsSync(filePath)) {
        const jsonString = fs.readFileSync(filePath, 'utf8');
        json[path] = JSON.parse(jsonString);
      }
    });

    return json;
  },

  /**
   * Gets all .babelrc from each root directory in the project
   * @method getBabelRc
   * @param  {Array} rootPaths List of root project directories
   * @return {Object} Hash of .babelrc
   */
  getBabelRc(rootPaths) {
    let babelConfigs = null;

    rootPaths.forEach(rootPath => {
      const babelRc = findBabelConfig.sync(rootPath);

      if (babelRc) {
        if (!babelConfigs) {
          babelConfigs = {};
        }

        babelConfigs[rootPath] = babelRc;
      }
    });

    return babelConfigs;
  },

  /**
   * Gets all webpack.config.js files from each root directory in the project
   * @method getWebpackConfigs
   * @param  {Array} rootPaths List of root project directories
   * @return {Object} Hash of webpack.config.js files
   */
  getWebpackConfigs(rootPaths) {
    let json = {};

    rootPaths.forEach(path => {
      const filePath = npmPath.join(path, 'webpack.config.js');
      let webpack = null;

      if (fs.existsSync(filePath)) {
        try {
          // TODO: fix -- deleting cache has no effect to force file reload
          if (require.cache[filePath]) {
            delete require.cache[require.resolve(filePath)];
          }

          webpack = require(filePath);
        } catch (err) {
          webpack = {};
        }

        if (webpack && webpack.resolve && webpack.resolve.alias) {
          json[path] = webpack.resolve.alias;
        }
      }
    });

    return json;
  },

  /**
   * Get all directories in project
   * @method getDirectories
   * @return {Array} List of project directories
   */
  getDirectories() {
    return atom.project.getDirectories();
  },

  /**
   * Get the value of a package setting
   * @method getAtomConfig
   * @param  {String} key Name of setting value to retrieve
   * @return {Any} Package setting value
   */
  getAtomConfig(key) {
    return atom.config.get(`jump-to-import.${key}`);
  },

  /**
   * Gets the previous word
   * @method getPreviousWord
   * @return {String}
   */
  getPreviousWord() {
    const tempCursor = this.createTempCursor();
    tempCursor.moveToPreviousWordBoundary();
    const prevWord = tempCursor.getCurrentWordPrefix().trim();
    tempCursor.destroy();
    return prevWord;
  },

  /**
   * Gets an instance of the active cursor
   * @method getCursor
   * @return {Cursor} Atom Cursor instance
   */
  getCursor() {
    return this.getEditor().getLastCursor();
  },

  /**
   * Creates a temporary cursor (used to find previous word)
   * @method createTempCursor
   * @return {Cursor} Atom Cursor instance
   */
  createTempCursor() {
    return this.getEditor().addCursorAtBufferPosition(
      this.getCursor().getPreviousWordBoundaryBufferPosition()
    );
  },

  /**
   * Subscribes to package setting changes
   * @method onAtomConfigChange
   * @param  {String} key Package setting key to listen to
   * @param  {Function} callback On change callback
   */
  onAtomConfigChange(key, callback) {
    return atom.config.onDidChange(`jump-to-import.${key}`, callback);
  },

  /**
   * Returns string under the user's cursor based on scope
   * @method getCursorString
   * @param  {String} scope Text scope to match
   * @return {String}
   */
  getCursorString(scope) {
    const editor = this.getEditor();
    const cursorPosition = editor.getCursorScreenPosition();
    const range = editor.bufferRangeForScopeAtPosition(scope, cursorPosition);

    return range ? editor.getTextInBufferRange(editor.bufferRangeForScreenRange(range)) : null;
  },

  /**
   * Gets the string under the user's cursor
   * @method findStringUnderCursor
   * @return {String} String under user's cursor
   */
  findStringUnderCursor() {
    return (
      this.getCursorString('.string') ||
      this.getEditor()
        .getWordUnderCursor()
        .replace(/,/g)
    );
  },

  /**
   * Finds Ember.Component name from an HTMLBars file
   * @method findHTMLBarsStringUnderCursor
   * @return {String} String under user's cursor
   */
  findHTMLBarsStringUnderCursor() {
    let cursorString = this.getCursorString('.htmlbars') || this.getCursorString('.handlebars');

    cursorString = cursorString
      .replace('{{', '')
      .replace('#', '')
      .replace('}}', '')
      .trim()
      .split(' ')[0];

    return (
      cursorString ||
      this.getEditor()
        .getWordUnderCursor()
        .replace(/,/g)
    );
  },

  /**
   * Checks if the string under user's cursor is a method (preceded by a dot)
   * @method currentWordIsMethod
   * @return {Boolean}
   */
  currentWordIsMethod() {
    const editor = this.getEditor();
    const cursor = editor.getLastCursor();
    const currentWordRange = cursor.getCurrentWordBufferRange();
    return currentWordRange ? this.doesWordRangeStartWith('.', currentWordRange) : false;
  },

  /**
   * Checks if the word range starts with a specific string
   * @method doesWordRangeStartWith
   * @param  {string} str String to check for
   * @param  {Array} range List of ranges to check
   * @return {Boolean}
   */
  doesWordRangeStartWith(str, range) {
    return str && range
      ? this.getEditor().getTextInBufferRange([
          [range.start.row, range.start.column - 1],
          range.start
        ]) === str
      : false;
  },

  /**
   * Extract the import or require path when provided with a variable name
   * @method extractImportPath
   * @param  {String} moduleName Name of module to find import/require path for
   * @return {Object}
   */
  extractImportPath(moduleName, useEmberPods) {
    if (!moduleName) return null;

    const text = this.getEditor().getText();

    // extract from 'import' syntax, falling back to 'require' syntax
    return (
      this.extractES6StyleImportPath(moduleName, text) ||
      this.extractRequireStyleImportPath(moduleName, text) ||
      this.extractEmberServicePath(moduleName, text, useEmberPods)
    );
  },

  /**
   * Extract the import path for an Ember.Service.
   * @method extractEmberServicePath
   * @param  {String} moduleName Name of module to open
   * @param  {String} editorText All content of TextEditor
   * @param  {Boolean} useEmberPods Flag indicating if we should use Ember's pod structure or not
   * @return {String} Ember Service import path
   */
  extractEmberServicePath(moduleName, editorText, useEmberPods) {
    const name = moduleName.replace(/'/g, '');
    let podFile = null;
    let nonPodFile = null;
    let foundLine = null;
    let path = null;

    editorText.split('\n').some(line => {
      if (line.indexOf(name + ':') > -1 && line.indexOf('service(') > -1) {
        foundLine = line;
        return true;
      }

      return false;
    });

    if (foundLine) {
      const rootPath = this.getEditorRootPath();
      const dasherizedName = _dasherize(name);
      podFile = npmPath.join(rootPath, 'app', 'services', dasherizedName);
      nonPodFile = npmPath.join(rootPath, 'app', dasherizedName, 'service');
      path = useEmberPods ? podFile : nonPodFile;
    }

    const modulePath = {
      type: 'service',
      path
    };

    return !path ? null : modulePath;
  },

  /**
   * Extracts ES6 style import path
   * @method extractES6StyleImportPath
   * @param  {String} moduleName Name of module to find import/require path for
   * @param  {String} editorText Contents of active TextEditor
   * @return {Object} Hash of imports
   */
  extractES6StyleImportPath(moduleName, editorText) {
    const editorTextWithoutNewlines = editorText.replace(/\n/g, ' ');
    const regex = new RegExp(REGEX_IMPORT, 'gi');
    const imports = editorTextWithoutNewlines.match(regex);
    let importPath = null;

    if (imports) {
      const name = moduleName.replace(/[\'");]/gi, '');
      const REGEX_IMPORT_NAME = "[\\s?,?\\s?'?](" + name + ")[\\s?,?\\s?'?]";
      const nameRegex = new RegExp(REGEX_IMPORT_NAME, 'gi');

      imports.some(importLine => {
        const matchedName = importLine.match(nameRegex);

        if (matchedName && matchedName.length) {
          importPath = importLine.match(REGEX_IMPORT_FROM);

          if (importPath && importPath.length >= 2) {
            importPath = importPath[1];
          }

          return true;
        }

        return false;
      });
    }

    const modulePath = {
      type: 'import',
      path: importPath
    };

    return !importPath ? null : modulePath;
  },

  /**
   * Extracts require style import path
   * @method extractRequireStyleImportPath
   * @param  {String} moduleName Name of module to find import/require path for
   * @param  {String} editorText Contents of active TextEditor
   * @return {Object} Hash of imports
   */
  extractRequireStyleImportPath(moduleName, editorText) {
    const editorTextWithoutNewlines = editorText.replace(/\n/g, ' ');
    const regex = new RegExp(REGEX_REQUIRE, 'gi');
    const imports = editorTextWithoutNewlines.match(regex);
    let importPath = null;

    if (imports) {
      imports.some(importLine => {
        const name = moduleName.replace(/[\'");]/gi, '');
        const moduleDefinition = importLine.match(REGEX_REQUIRE_PATH, 'gi');

        if (moduleDefinition && moduleDefinition.length >= 2) {
          const varDeclaration = moduleDefinition[1];
          const matchInput = moduleDefinition.input;

          if (varDeclaration.indexOf(name) > -1 || matchInput.indexOf(name) > -1) {
            importPath = importLine.match(REGEX_REQUIRE);

            if (importPath && importPath.length >= 2) {
              importPath = importPath[1];
            }

            return true;
          }
        }

        return false;
      });
    }

    const modulePath = {
      type: 'require',
      path: importPath
    };

    return !importPath ? null : modulePath;
  },

  /**
   * Async method to generate file tags
   * @method getFileTags
   * @param  {TextEditor} editor Atom TextEditor instance
   * @return {Array} List of file tags
   */
  async getFileTags(editorPath = this.getEditor().getPath()) {
    return await new TagGenerator(editorPath, 'source.js').generate();
  },

  /**
   * Async method to jump to a method
   * @method jumpToMethod
   * @param  {TextEditor} editor Atom TextEditor instance
   * @param  {String} method Method name to jump to
   */
  async jumpToMethod(editor = this.getEditor(), method) {
    if (editor && method) {
      const fileTags = await this.getFileTags(editor.getPath());

      if (fileTags && fileTags.length) {
        const matchingTags = fileTags.filter(tag => tag.name === method);

        if (matchingTags.length) {
          this.setFilePosition(editor, matchingTags[0].position);
        }
      }
    }
  },

  /**
   * Sets user's position in a file
   * @method setFilePosition
   * @param  {TextEditor} editor Atom TextEditor instance
   * @param  {Number} position Position to set
   */
  setFilePosition(editor = this.getEditor(), position) {
    if (editor && position) {
      editor.scrollToBufferPosition(position, { center: true });
      editor.setCursorBufferPosition(position);
      editor.moveToFirstCharacterOfLine();
      this.scrollCursorToCenter(editor);
    }
  },

  /**
   * Centers editor screen on cursor position
   * @method scrollCursorToCenter
   * @param  {Object} editor Atom TextEditor instance
   */
  scrollCursorToCenter(editor) {
    const editorView = atom.views.getView(editor);
    const pixelPositionForCursorPosition = editorView.pixelPositionForScreenPosition(
      editor.getCursorScreenPosition()
    );
    const halfScreenHeight = editorView.getHeight() / 2;
    const scrollTop = pixelPositionForCursorPosition.top - halfScreenHeight;
    editorView.setScrollTop(scrollTop);
  },

  /**
   * Open a new text editor
   * @method openEditor
   * @param  {String} path File path to open
   * @param  {String} options Options to pass to atom.workspace.open()
   * @return {TextEditor} Atom TextEditor instance
   */
  async openEditor(path, options = {}) {
    return await atom.workspace.open(path, options);
  },

  /**
   * Opens a module in a new TextEditor, optionally jumping to a symbol
   * @method openModule
   * @param  {Object}   module Hash of module path, name and method
   */
  async openModule(module = {}, options = {}) {
    let { path, method, name } = module;

    if (!path && method) {
      this.jumpToMethod(this.getEditor(), method);
    } else if (path) {
      if (!method) {
        method = name;
      }

      if (fs.existsSync(path)) {
        const existingEditor = this.lookForExistingEditor(path);

        if (existingEditor) {
          this.activateExistingEditor(existingEditor, method);
        } else if (!options.openInSeparatePane) {
          await this.openInSamePane(path, method);
        } else {
          await this.openInSeparatePane(path, method, options);
        }
      }
    }
  },

  /**
   * Opens an item in the current active pane
   * @method openInSamePane
   * @param  {String} path   Item uri path
   * @param  {String} method Name of method to jump to
   * @return {Promise}
   */
  async openInSamePane(path, method) {
    const editor = await this.openEditor(path);
    this.jumpToMethod(editor, method);
  },

  /**
   * Opens an item in a separate pane
   * @method openInSeparatePane
   * @param  {String} path    Item uri path
   * @param  {String} method  Name of method to jump to
   * @param  {Object} options Hash of package options
   */
  async openInSeparatePane(path, method, options) {
    const { usePendingPane, panePosition } = options;
    const pathItem = await atom.workspace.createItemForURI(path);
    const itemOptions = { pending: usePendingPane };
    const extraPane = this.getPositionedPane(panePosition);
    const activePane = atom.workspace.getCenter().getActivePane();

    if (extraPane && extraPane !== activePane && !this.tmpPane) {
      this.openItemInExistingPane(extraPane, pathItem, method, itemOptions);
    } else if (!this.tmpPane) {
      this.tmpPane = _createPane(panePosition, () => {
        this.tmpPane = null;
      });

      this.openItemInExistingPane(this.tmpPane, pathItem, method, itemOptions);
    } else {
      this.openItemInExistingPane(this.tmpPane, pathItem, method, itemOptions);
    }
  },

  /**
   * Returns the top|bottom|right|left most sibling pane to the active pane
   * @method   getPositionedPane
   * @param    {String} position Direction to look for pane
   * @return   {Object} Atom Pane instance
   */
  getPositionedPane(position) {
    const positionMap = {
      up: 'top',
      down: 'bottom',
      left: 'left',
      right: 'right'
    };

    const methodName = `find${_capitalize(positionMap[position])}mostSibling`;
    return atom.workspace
      .getCenter()
      .getActivePane()
      [methodName]();
  },

  /**
   * Opens an item in a separate, existing pane
   * @method openItemInExistingPane
   * @param  {Object} pane    Atom Pane instance
   * @param  {Object} item    Atom Item instance
   * @param  {String} method  Name of method to jump to
   * @param  {Object} options Hash of package options
   */
  openItemInExistingPane(pane, item, method, options) {
    if (pane) {
      const editor = pane.addItem(item, options);
      pane.activate();
      pane.activateItem(item);
      this.jumpToMethod(editor, method);
    }
  },

  /**
   * Checks to see if the file is already open in an editor
   * @method   lookForExistingEditor
   * @param    {String} path File path to check
   * @return   {Object} TextEditor
   */
  lookForExistingEditor(path) {
    const [editor] = atom.workspace.getTextEditors().filter(editor => editor.getPath() === path);
    return editor;
  },

  /**
   * Activates an existing editor and jumps to the provided method
   * @method   activateExistingEditor
   * @param    {Object} editor TextEditor
   * @param    {String} method Method name
   */
  activateExistingEditor(editor, method) {
    atom.workspace.paneForItem(editor).activateItem(editor);
    this.jumpToMethod(editor, method);
  }
};
