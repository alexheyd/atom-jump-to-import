'use babel';

const TagGenerator = require('symbols-view/lib/tag-generator');
const fs = require('fs');
const npmPath = require('path');
const findBabelConfig = require('find-babel-config');

const REGEX_IMPORT = 'import(?:.*?\n?)from [\'"](.*?)[\'"]';
const REGEX_IMPORT_FROM = '(?:.*?)from [\'"](.*?)[\'"]';
const REGEX_REQUIRE = '(?:.*?)require\\([\'"](.*?)[\'"]\\)';

module.exports = {
  /**
   * Get all root project directory paths
   * @method getProjectPaths
   * @return {Array} List of root directories in the project
   */
  getProjectPaths() {
    return atom.project.getPaths();
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
   * Gets the active text editor
   * @method getEditor
   * @return {TextEditor} Atom TextEditor instance
   */
  getEditor() {
    return atom.workspace.getActiveTextEditor();
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
   * @param  {Object} obj JumpToImport instance
   * @param  {String} key Package setting key to listen to
   */
  onAtomConfigChange(obj, key) {
    return atom.config.onDidChange(`jump-to-import.${key}`, prop => {
      obj.options[key] = prop.newValue;
    });
  },

  /**
   * Gets the string under the user's cursor
   * @method findStringUnderCursor
   * @return {String} String under user's cursor
   */
  findStringUnderCursor() {
    const editor = this.getEditor();
    const cursorPosition = editor.getCursorScreenPosition();
    const range = editor.bufferRangeForScopeAtPosition(
      '.string',
      cursorPosition
    );
    const cursorString = range
      ? editor.getTextInBufferRange(editor.bufferRangeForScreenRange(range))
      : null;
    return cursorString || editor.getWordUnderCursor().replace(/,/g);
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
    return currentWordRange
      ? this.doesWordRangeStartWith('.', currentWordRange)
      : false;
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
  extractImportPath(moduleName) {
    const editorText = this.getEditor().getText();

    // extract from 'import' syntax, falling back to 'require' syntax
    return (
      this.extractES6StyleImportPath(moduleName, editorText) ||
      this.extractRequireStyleImportPath(moduleName, editorText)
    );
  },

  /**
   * Extracts ES6 style import path
   * @method extractES6StyleImportPath
   * @param  {String} moduleName Name of module to find import/require path for
   * @param  {String} editorText Contents of active TextEditor
   * @return {Object} Hash of imports
   */
  extractES6StyleImportPath(
    moduleName,
    editorText = this.getEditor().getText()
  ) {
    const editorTextWithoutNewlines = editorText.replace(/\n/g, ' ');
    const regex = new RegExp(REGEX_IMPORT, 'gi');
    const imports = editorTextWithoutNewlines.match(regex);
    let importPath = null;

    if (imports) {
      imports.forEach(importLine => {
        if (importLine.indexOf(moduleName) > -1) {
          importPath = importLine.match(REGEX_IMPORT_FROM);

          if (importPath && importPath.length >= 2) {
            importPath = importPath[1];
          }
        }
      });
    }

    return importPath;
  },

  /**
   * Extracts require style import path
   * @method extractRequireStyleImportPath
   * @param  {String} moduleName Name of module to find import/require path for
   * @param  {String} editorText Contents of active TextEditor
   * @return {Object} Hash of imports
   */
  extractRequireStyleImportPath(
    moduleName,
    editorText = this.getEditor().getText()
  ) {
    const regex = new RegExp(REGEX_REQUIRE, 'gi');
    const imports = editorText.match(regex);

    let importPath = null;

    if (imports) {
      imports.forEach(importLine => {
        let moduleDefintion = importLine.match('(.*)require', 'gi');

        if (moduleDefintion && moduleDefintion.length >= 2) {
          moduleDefintion = moduleDefintion[1];

          if (moduleDefintion.indexOf(moduleName) > -1) {
            importPath = importLine.match(REGEX_REQUIRE);

            if (importPath && importPath.length >= 2) {
              importPath = importPath[1];
            }
          }
        }
      });
    }

    return importPath;
  },

  /**
   * Async method to generate file tags
   * @method getFileTags
   * @param  {TextEditor} editor Atom TextEditor instance
   * @return {Array} List of file tags
   */
  async getFileTags(editor = this.getEditor()) {
    const editorPath = editor.getPath();
    return await new TagGenerator(editorPath, 'source.js').generate();
  },

  /**
   * Async method to jump to a method
   * @method jumpToMethod
   * @param  {TextEditor} editor Atom TextEditor instance
   * @param  {String} method Method name to jump to
   */
  async jumpToMethod(editor = this.getEditor(), method) {
    const fileTags = await this.getFileTags(editor);

    if (fileTags && fileTags.length) {
      const matchingTags = fileTags.filter(
        tag => tag.name.indexOf(method) > -1
      );

      if (matchingTags.length) {
        this.setFilePosition(editor, matchingTags[0].position);
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
    }
  },

  /**
   * Open a new text editor
   * @method openEditor
   * @param  {String} path File path to open
   * @return {TextEditor} Atom TextEditor instance
   */
  openEditor(path) {
    return atom.workspace.open(path);
  },

  /**
   * Opens a module in a new TextEditor, optionally jumping to a symbol
   * @method openModule
   * @param  {Object}   module Hash of module path, name and method
   */
  openModule(module) {
    let { path: modulePath, method: moduleMethod, name: moduleName } = module;

    if (!modulePath && moduleMethod) {
      this.jumpToMethod(this.getEditor(), moduleMethod);
    } else if (modulePath) {
      if (!moduleMethod) {
        moduleMethod = moduleName;
      }

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
};
