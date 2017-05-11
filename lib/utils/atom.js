'use babel';

const TagGenerator = require('symbols-view/lib/tag-generator');
const fs = require('fs');

module.exports = {
  getProjectPaths() {
    return atom.project.getPaths();
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

  getPackageJson() {
    let json = {};

    this.getDirectories().forEach(dir => {
      const path = dir.path;
      const filePath = `${path}/package.json`;

      if (fs.existsSync(filePath)) {
        const jsonString = fs.readFileSync(filePath, 'utf8');
        json[path] = JSON.parse(jsonString);
      }
    });

    return json;
  },

  getBabelRc(rootPaths) {
    let babelConfigs = null;

    rootPaths.forEach(rootPath => {
      // const babelConfig = findBabelConfig.sync(rootPath);
      const babelRc = findBabelConfig.sync(rootPath);

      if (babelRc) {
        if (!babelConfigs) {
          babelConfigs = {};
        }

        babelConfigs[rootPath] = babelRc;
      }
      // const config = babelConfig ? this.extractBabelConfig(babelConfig) : null;
      // this.saveBabelProjectPaths(rootPath, config);
    });

    return babelConfigs;
  },

  getDirectories() {
    return atom.project.getDirectories();
  },

  getAtomConfig(key) {
    return atom.config.get(`jump-to-import.${key}`);
  },

  getEditor() {
    return atom.workspace.getActiveTextEditor();
  },

  openEditor(path) {
    return atom.workspace.open(path);
  },

  onAtomConfigChange(obj, key) {
    return atom.config.onDidChange(`jump-to-import.${key}`, prop => {
      obj.options[key] = prop.newValue;
    });
  },

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

  currentWordIsMethod() {
    const editor = this.getEditor();
    const cursor = editor.getLastCursor();
    const currentWordRange = cursor.getCurrentWordBufferRange();
    return currentWordRange
      ? this.doesWordRangeStartWith('.', currentWordRange)
      : false;
  },

  doesWordRangeStartWith(str, range) {
    return str && range
      ? this.getEditor().getTextInBufferRange([
          [range.start.row, range.start.column - 1],
          range.start
        ]) === str
      : false;
  },

  getPreviousWord() {
    const tempCursor = this.createTempCursor();
    tempCursor.moveToPreviousWordBoundary();
    const prevWord = tempCursor.getCurrentWordPrefix().trim();
    tempCursor.destroy();
    return prevWord;
  },

  createTempCursor() {
    return this.getEditor().addCursorAtBufferPosition(
      this.getCursor().getPreviousWordBoundaryBufferPosition()
    );
  },

  getCursor() {
    return this.getEditor().getLastCursor();
  },

  extractImportPath(moduleName) {
    const editorText = this.getEditor().getText();

    // extract from 'import' syntax, falling back to 'require' syntax if nothing is found
    return (
      this.extractES6StyleImportPath(moduleName, editorText) ||
      this.extractRequireStyleImportPath(moduleName, editorText)
    );
  },

  extractES6StyleImportPath(
    moduleName,
    editorText = this.getEditor().getText()
  ) {
    const editorTextWithoutNewlines = editorText.replace(/\n/g, ' ');
    const regex = new RegExp('import(?:.*?\n?)from [\'"](.*?)[\'"]', 'gi');
    const imports = editorTextWithoutNewlines.match(regex);

    let importPath = null;

    if (imports) {
      imports.forEach(importLine => {
        if (importLine.indexOf(moduleName) > -1) {
          importPath = importPath && importPath.length >= 2
            ? importPath[1]
            : importLine.match('(?:.*?)from [\'"](.*?)[\'"]');
        }
      });
    }

    return importPath;
  },

  extractRequireStyleImportPath(
    moduleName,
    editorText = this.getEditor().getText()
  ) {
    const regex = new RegExp('(?:.*?)require\\([\'"](.*?)[\'"]\\)', 'gi');
    const imports = editorText.match(regex);

    let importPath = null;

    if (imports) {
      imports.forEach(importLine => {
        let moduleDefinition = importLine.match('(.*)require', 'gi');

        if (moduleDefinition && moduleDefinition.length >= 2) {
          moduleDefinition = moduleDefinition[1];

          if (moduleDefinition.indexOf(moduleName) > -1) {
            importPath = importPath && importPath.length >= 2
              ? importPath[1]
              : importLine.match('(?:.*?)require\\([\'"](.*?)[\'"]\\)');
          }
        }
      });
    }

    return importPath;
  },

  getFileTags(editor = this.getEditor()) {
    const editorPath = editor.getPath();
    return new TagGenerator(editorPath, 'source.js').generate();
  },

  setFilePosition(editor = this.getEditor(), position) {
    if (editor && position) {
      editor.scrollToBufferPosition(position, { center: true });
      editor.setCursorBufferPosition(position);
      editor.moveToFirstCharacterOfLine();
    }
  },

  jumpToMethod(editor = this.getEditor(), method) {
    const fileTags = this.getFileTags(editor);

    if (fileTags) {
      fileTags.then(tags => {
        const matchingTags = tags.filter(tag => tag.name.indexOf(method) > -1);

        if (matchingTags.length) {
          this.setFilePosition(editor, matchingTags[0].position);
        }
      });
    }
  },

  openModule(module) {
    let { path: modulePath, method: moduleMethod } = module;

    if (!modulePath && moduleMethod) {
      this.jumpToMethod(AtomUtils.getEditor(), moduleMethod);
    } else if (modulePath) {
      if (!moduleMethod) {
        moduleMethod = module.moduleName;
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
