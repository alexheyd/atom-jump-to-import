TagGenerator = require 'symbols-view/lib/tag-generator'
fs           = require 'fs'
path         = require 'path'

ABSOLUTE_PATH_PATTERN = '^(\\w+(?:/\\w+)+)(?:.*?)?$'
RELATIVE_PATH_PATTERN = '^((?:..?/)+(?:\\w+/)*\\w+)(?:.*?)?$'

AtomUtilsCacheDefaults =
  editor: null
  cursor: null
  tags: {}
  modules: {}
  directories: {}
  runtime:
    editor: null
    cursor: null
  paths:
    currentFile: {}
    root: null

module.exports = AtomUtils =
  options: {}

  currentProjectName: null

  cache: AtomUtilsCacheDefaults

  setOptions: (options) ->
    @options = options

  setOption: (key, value) ->
    @options[key] = value

  clearCache: ->
    # clone AtomUtilsCacheDefaults to recreate cache
    @cache = JSON.parse JSON.stringify AtomUtilsCacheDefaults

  clearRuntimeCache: ->
    @cache.runtime = {
      editor: null
      cursor: null
    }

  getProjectDirectories: ->
    return atom.project.getDirectories()

  getDirectory: (rootPath) ->
    return @cache.directories[rootPath]?.directory

  getEditor: ->
    return @getCachedEditor() or @cacheEditor atom.workspace.getActiveTextEditor()

  getEditorPath: ->
    return @getEditor().getPath()

  getCursor: ->
    return @getCachedCursor() or @cacheCursor @getEditor().getLastCursor()

  getRelativeCurrentFilePath: ->
    cachedPath = @cache.paths.currentFile.relative

    unless cachedPath?
      filePath = atom.project.relativizePath @getEditorPath()
      @cache.paths.currentFile.relative = filePath

    return cachedPath or filePath

  getAbsoluteCurrentFileRoot: ->
    rootPath = @getRelativeCurrentFilePath()[0]
    @cache.paths.root = rootPath
    return rootPath

  getRelativeCurrentFileRoot: ->
    fileRoot = @getRelativeCurrentFilePath()[1]
    return path.dirname(fileRoot)

  getProjectName: (currentFileRoot) ->
    return @readPackageJson(currentFileRoot).then (contents) => @cacheProjectName currentFileRoot, @extractProjectName(contents)

  getCachedEditor: ->
    return @cache.runtime.editor

  getCachedCursor: ->
    return @cache.runtime.cursor

  getCachedImportPath: (moduleName) ->
    return @cache.modules[moduleName]

  getCachedProjectName: (filePath) ->
    return @cache.directories[filePath]?.projectName

  getCachedTags: (path) ->
    return @cache.tags[path]

  getFileTags: (editor) ->
    editorPath = editor.getPath()
    tags       = @getCachedTags editorPath

    unless tags
      tags = new TagGenerator(editorPath, 'source.js').generate();
      @cacheFileTags editorPath, tags

    return tags

  getPreviousWord: ->
    tempCursor = @createTempCursor()
    tempCursor.moveToPreviousWordBoundary()
    prevWord = tempCursor.getCurrentWordPrefix().trim()
    tempCursor.destroy()
    return prevWord

  # try to find a string in quotes or fallback to the word under cursor, comma stripped
  findStringUnderCursor: ->
    editor         = @getEditor()
    cursorPosition = editor.getCursorScreenPosition()
    range          = editor.displayBuffer.bufferRangeForScopeAtPosition '.string', cursorPosition
    cursorString   = if range? then editor.getTextInBufferRange editor.bufferRangeForScreenRange range
    return cursorString or editor.getWordUnderCursor().replace(/,/g)

  # getStringFromCursor: (cursorPosition) ->
  #   editor = @getEditor()
  #   range  = editor.displayBuffer.bufferRangeForScopeAtPosition('.string', cursorPosition)
  #   return unless range
  #   cursorString = editor.getTextInBufferRange(editor.bufferRangeForScreenRange(range))
  #   return cursorString

  currentWordIsMethod: ->
    editor           = @getEditor()
    cursor           = editor.getLastCursor()
    currentWordRange = cursor.getCurrentWordBufferRange()
    return if currentWordRange? then @doesWordRangeStartWith '.', currentWordRange

  doesWordRangeStartWith: (str, range) ->
    return if range? and str? then @getEditor().getTextInBufferRange([[range.start.row, range.start.column - 1], range.start]) == str

  createTempCursor: ->
    return @getEditor().addCursorAtBufferPosition @getCursor().getPreviousWordBoundaryBufferPosition()

  extractImportPath: (moduleName) ->
    # look for `import moduleName from 'path/to/module'`
    importPath = @getEditor().getText().match('import ' + moduleName + ' from [\'"](.*?)[\'"]')
    return importPath?[1]

  extractProjectName: (json) ->
    return if json? then JSON.parse(json).name

  cacheEditor: (editor) ->
    @cache.runtime.editor = editor
    return editor

  cacheCursor: (cursor) ->
    @cache.runtime.cursor = cursor
    return cursor

  cacheFileTags: (path, tags) ->
    @cache.tags[path] = tags

  cacheImportPath: (moduleName, modulePath) ->
    @cache.modules[moduleName] = modulePath

  cacheProjectName: (projectPath, projectName) ->
    return unless projectName and projectPath
    @currentProjectName = projectName
    @cache.directories[projectPath]?.projectName = projectName
    return projectName

  cacheProjectDirectories: ->
    @cacheDirectory directory for directory in @getProjectDirectories()
    # @getProjectDirectories().forEach (directory) => @cacheDirectory directory

  # cache project roots with Directory object and project name for future lookup
  cacheDirectory: (directory) ->
    @cache.directories[directory.path] = {
      directory: directory
      projectName: ''
    }

  # returns a promise
  readPackageJson: (currentFileRoot) ->
    if currentFileRoot? then @getDirectory(currentFileRoot)?.getFile('package.json').read()

  isImportPath: (str) ->
    if str? then str[0] is '\'' or str[0] is '"' else false

  isAbsolutePath: (filePath) ->
    filePath.match ABSOLUTE_PATH_PATTERN

  isRelativePath: (filePath) ->
    filePath.match RELATIVE_PATH_PATTERN

  appendJSExtension: (filePath) ->
    fileExtension = '.js'
    filePath      += fileExtension unless filePath.endsWith fileExtension
    filePath

  buildRelativePath: (filePath) ->
    path.join @getRelativeCurrentFileRoot(), @appendJSExtension filePath

  overridePaths: (filePath) ->
    finalPath    = filePath
    targets      = []
    replacements = {}
    pathReplaced = false

    _extractTargetFrom = (pathOverride) =>
      parts       = pathOverride.split ':'
      target      = parts[0]
      replacement = parts[1]
      targets.push target
      replacements[target] = replacement

    _replacePath = (target) =>
      return if pathReplaced

      replaced = target.replace '$PROJECT', @currentProjectName

      if filePath.indexOf(replaced) > -1
        finalPath    = filePath.replace replaced, replacements[target]
        pathReplaced = true

    unless @options.disablePathOverrides
      _extractTargetFrom target for target in @options.pathOverrides
      # sort targets by longest string first (more specific path)
      targets.sort (a, b) => return b.length - a.length
      _replacePath target for target in targets

    return @appendJSExtension finalPath

  buildFinalFilePath: (filePath) ->
    return if @isAbsolutePath filePath then @overridePaths filePath else @buildRelativePath filePath

  jumpToMethod: (editor, method) ->
    fileTags = @getFileTags editor
    return unless fileTags
    fileTags.then (tags) =>
      matchingTags = tags.filter((tag) -> tag.name == method)
      return unless matchingTags.length
      @setFilePosition editor, matchingTags[0].position

  setFilePosition: (editor, position) ->
    return unless editor? and position?
    editor.scrollToBufferPosition position, center: true
    editor.setCursorBufferPosition position
    editor.moveToFirstCharacterOfLine()

  openFile: (filePath, fileMethod) ->
    finalPath = @buildFinalFilePath filePath
    return unless finalPath
    fullSystemPath = path.join @cache.paths.root, finalPath
    fs.exists(fullSystemPath, (exists) => if exists then @openEditor(finalPath, fileMethod))

  openEditor: (filePath, fileMethod) ->
    openedEditor = atom.workspace.open filePath
    return unless openedEditor

    openedEditor.then (editor) =>
      @clearRuntimeCache()

      if fileMethod
        @jumpToMethod editor, fileMethod
