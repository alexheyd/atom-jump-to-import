const TagGenerator    = require('symbols-view/lib/tag-generator');
const fs              = require('fs');
const path            = require('path');
const findBabelConfig = require('find-babel-config');

const ABSOLUTE_PATH_PATTERN = '^(\\w+(?:/\\w+)+)(?:.*?)?$';
const RELATIVE_PATH_PATTERN = '^((?:..?/)+(?:\\w+/)*\\w+)(?:.*?)?$';
const PROJECT_NAME_WILDCARD = '$PROJECT';

const AtomUtilsCacheDefaults = {
  editor: null,
  cursor: null,
  tags: {},
  modules: {},
  directories: {},
  runtime: {
    editor: null,
    cursor: null
  },
  paths: {
    currentFile: {},
    root: null
  }
};

module.exports = AtomUtils = {
  options: {},
  currentProjectName: null,
  cache: Object.assign({}, AtomUtilsCacheDefaults),

  isPathAbsolute(path) {
    return path.indexOf('/') === 0;
  },

  isPathRelativeChild(path) {
    return path.indexOf('./') === 0;
  },

  isPathRelativeParent(path) {
    return path.indexOf('../') === 0;
  },

  getEditor() {
    return atom.workspace.getActiveTextEditor();
  },

  getEditorPath() {
    return this.getEditor().getPath();
  },

  getEditorDirPath() {
    const path = this.getEditor().getPath();
    return path.substring(0, path.lastIndexOf('/'));
  },

  getEditorRootPath() {
    return atom.project.relativizePath(this.getEditorPath())[0];
  },

  getPreviousWord() {
    const tempCursor = this.createTempCursor();
    tempCursor.moveToPreviousWordBoundary();
    const prevWord = tempCursor.getCurrentWordPrefix().trim();
    tempCursor.destroy();
    return prevWord;
  },

  getCursor() {
    return this.getEditor().getLastCursor();
  },

  createTempCursor() {
    return this.getEditor().addCursorAtBufferPosition(this.getCursor().getPreviousWordBoundaryBufferPosition());
  },

  setOptions(options) {
    this.options = options;
  },

  setOption(key, value) {
    this.options[key] = value;
  },

  clearCache() {
    this.cache = Object.assign({}, AtomUtilsCacheDefaults);
  },

  currentWordIsMethod() {
    const editor           = this.getEditor();
    const cursor           = editor.getLastCursor();
    const currentWordRange = cursor.getCurrentWordBufferRange();
    return currentWordRange ? this.doesWordRangeStartWith('.', currentWordRange) : false;
  },

  doesWordRangeStartWith(str, range) {
    return (str && range) ? (this.getEditor().getTextInBufferRange([[range.start.row, range.start.column - 1], range.start]) === str) : false;
  },

  // try to find a string in quotes or fallback to the word under cursor, comma stripped
  findStringUnderCursor() {
    const editor         = this.getEditor();
    const cursorPosition = editor.getCursorScreenPosition();
    const range          = editor.bufferRangeForScopeAtPosition('.string', cursorPosition);
    const cursorString   = range ? editor.getTextInBufferRange(editor.bufferRangeForScreenRange(range)) : null;
    return cursorString || editor.getWordUnderCursor().replace(/,/g);
  },

  extractImportPath(moduleName) {
    const editorText = this.getEditor().getText().replace(/\n/g, ' ');
    const regex = new RegExp('import(?:.*?\n?)from [\'"](.*?)[\'"]', 'gi');
    const imports = editorText.match(regex);

    // previous regex used:
    // 'import (?:.*?\n?)' + moduleName + '(?:.*?\n?) from [\'"](.*?)[\'"]'

    let importPath = null;

    imports.forEach(importLine => {
      if (importLine.indexOf(moduleName) > -1) {
        importPath = importLine.match('(?:.*?)from [\'"](.*?)[\'"]');

        if (importPath && importPath.length >= 2) {
          importPath = importPath[1];
        }
      }
    });

    return importPath;
  },

  isImportPath(str) {
    return str ? str[0] === '\'' || str[0] === '"' : false;
  }
};
