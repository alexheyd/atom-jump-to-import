{CompositeDisposable} = require 'atom'
DefaultConfig         = require './default-config'
AtomUtils             = require './atom-utils'

module.exports = JumpToImport =
  config: DefaultConfig

  options: {}

  subscriptions: null

  activate: (state) ->
    @registerCommand()
    @packageSetup()

  deactivate: ->
    @subscriptions.dispose()
    AtomUtils.clearCache()

  packageSetup: ->
    @options =
      pathOverrides       : atom.config.get 'jump-to-import.pathOverrides'
      disablePathOverrides: atom.config.get 'jump-to-import.disablePathOverrides'

    @subscribeToConfigChanges()
    AtomUtils.setOptions @options
    AtomUtils.cacheProjectDirectories()

  subscribeToConfigChanges: ->
    @subscriptions.add atom.config.onDidChange 'jump-to-import.disablePathOverrides', (event) =>
      AtomUtils.setOption 'disablePathOverrides', event.newValue

    @subscriptions.add atom.config.onDidChange 'jump-to-import.pathOverrides', (event) =>
      AtomUtils.setOption 'pathOverrides', event.newValue

  registerCommand: ->
    # Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.commands.add 'atom-workspace', 'jump-to-import:go-to-module': => @goToModule()

  goToModule: ->
    cursorString = AtomUtils.findStringUnderCursor()
    module       = @getModule cursorString

    if AtomUtils.getCachedProjectName()
      @openModule module
    else
      @delayOpenUntilProjectNamed module

  getModule: (cursorString) ->
    return if AtomUtils.isImportPath(cursorString) then { path: cursorString.substring(1, cursorString.length - 1) } else @getPathFromVariable(cursorString)

  openModule: (module) ->
    return unless module

    if module.path?
      AtomUtils.openFile module.path, module.method
    else if module.method?
      AtomUtils.jumpToMethod AtomUtils.getEditor(), module.method

  delayOpenUntilProjectNamed: (module) ->
    nameFetched = AtomUtils.getProjectName AtomUtils.getAbsoluteCurrentFileRoot()

    if nameFetched?
      nameFetched.then => @openModule module
    else
      @openModule module

  getPathFromVariable: (currentWord) ->
    currentWord         = currentWord.replace(/,/g)
    currentWordIsMethod = AtomUtils.currentWordIsMethod()
    moduleName          = if currentWordIsMethod then AtomUtils.getPreviousWord() else currentWord
    methodName          = if currentWordIsMethod then currentWord else null
    importPath          = AtomUtils.getCachedImportPath(moduleName) or AtomUtils.extractImportPath(moduleName)

    if importPath
      AtomUtils.cacheImportPath moduleName, importPath

    return {
      path  : importPath,
      method: methodName
    }
