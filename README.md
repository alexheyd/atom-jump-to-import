# jump-to-import package

Contributions and Pull Requests are welcome.

* [Installation](#installation)
* [Bugs](#bugs)
* [Description](#description)
* [Requirements](#requirements)
* [Features](#features)
* [Usage](#usage)
	* [Without `hyperclick`](#without-hyperclick)
	* [With `hyperclick`](#with-hyperclick)
* [Setup](#setup)
	* [Package Settings](#package-settings)
		* [Aliases](#aliases)
		* [Project Name](#project-name)
		* [File Extensions](#file-extensions)
		* [Ember.Service Aliases](#emberservice-aliases)
	* [Project-specific settings via `.jump-to-import`](#project-specific-settings-via-jump-to-import)
	* [.babelrc](#babelrc)
	* [Settings & Aliases Priority](#settings-aliases-priority)
* [Example](#example)

## Installation
```bash
apm install jump-to-import
```

## Bugs
**NOTE:** please do the following before submitting an Issue
- enable debug logging in package settings (check box next to `Enable Debug`)
- in Atom's devtools (<kbd>CMD+ALT+I</kbd>), you'll see a log named `[jump-to-import] Debug Report: Object`
- click the `down arrow` next to `Object` to expand it, then copy and paste the log into a GitHub Issue

**Privacy Note:** please be aware that this will submit the following information to me:
- what string you attempted to jump to
- your path aliases
- user options for this package
- file paths that couldn't be found
- whether the file was a Javascript or HTMLBars file

## Description
Quickly jump to an ES6 module file from its import path or variable. Also supports jumping to `Ember.Service` definitions (with alias support), as well as `Ember.Component` template files from an `HTMLBars` file.

Support for project-specific settings/aliases via `.jump-to-import`, additional aliases via `.babelrc` and/or `webpack.config.js`

## Requirements
- `package.json` required at root of project
    - used to figure out the project name to use when converting magic paths to the real file path

## Features
- Commands:
	- `jump-to-import:go-to-module` (default keybind: <kbd>CTRL+ALT+E</kbd>)
	- `jump-to-import:create-project-config`
	- `jump-to-import:debug-log`
- Jump to:
    - imported file from path, variable name, or method name
        - supports `import` and `require` syntax
        - supports path aliasing
        - supports NPM and Bower modules (including `npm:foo` syntax for `Browserify`)
        - multi-line, destructured `import` statements
    - `Ember.Service` files, with or without pod structure
        - supports `Ember.Service` name aliasing
    - `Ember.Component` template files, with or without pod structure
        - from an `.hbs` file, component names can jump to their template file
- `hyperclick` support:
    - you can now click on variable names, import paths or methods
    - installing `hyperclick` is a requirement if you plan to use this functionality
    - you may need to configure `hyperclick` to use an appropriate hotkey
- `babel-plugin-module-resolver` support:
    - loads path overrides from project's `.babelrc`
- **NEW:** very basic Webpack Module Alias support
    - this *only* supports the `resolve.alias` section of the `webpack.config.js`
    - **NOTE:** any modification to `webpack.config.js` requires reloading Atom for now
- Multiple project root folders
- Configurable settings:
    - Project-specific settings via `.jump-to-import` file
    - Custom path aliases
    - `Ember.Service` name aliasing
    - Ability to disable custom path overrides, `.babelrc` overrides, `hyperclick` support
    - Prioritized list of file extensions to check (defaults to `js` and `jsx`)

## Usage

### Without `hyperclick`
Press <kbd>CTRL+ALT+E</kbd> with the cursor either on:
- an ES6 `import`/`require` path
- the imported namespace/variable
- a method on the imported namespace
- an `Ember.Service` dependency injection (i.e `foo: Ember.inject.service()`)

to open that file and jump to the relevant method, if applicable.

### With `hyperclick`
Hold your `hyperclick` toggle key and click on any applicable string to jump to that module.

## Setup
The package looks for configuration options and path aliases in two places:
- package settings
- `.jump-to-import` files (project settings)
- `.babelrc` files (babel aliases)

### Package Settings
These are simply accessed in Atom's `Settings > Packages > Jump To Import`. These are basically global settings that will apply to any project.

#### Aliases
You can define your own path aliases in Settings.

Default aliases are:
- `$PROJECT:app`
- `$PROJECT/config:config`

With the above default settings (for Ember projects) we would get the following behavior:
- `PROJECT_NAME/components/foo` -> `app/components/foo.js`
- `PROJECT_NAME/config/environment` -> `config/environment.js`

`PROJECT_NAME` in the path needs to match the project name defined in your `package.json` file in the root directory.

#### Project Name
The package will look for a `package.json` file in every root directory of the project to determine project names.

#### File Extensions
You can also define a list of file extensions to look for.

#### Ember.Service Aliases
You can define `Ember.Service` name aliases, in case the injected variable name and registered service name differ.

### Project-specific settings via `.jump-to-import`
Optionally, you can add a `.jump-to-import` file in any root folder of your project which will take precedence over the package settings. These allow for project-specific settings and aliases.

You can trigger the `jump-to-import:create-project-config` through the `Command Palette` to generate a default config.

**NOTE:** Project settings only apply to the root directory they belong to.

Here's a sample config, using default settings:

```javascript
{
  "usePendingPane": true,
  "openInSeparatePane": true,
  "panePosition": "right",
  "useEmberPods": true,
  "fileExtensions": [
    "js",
    "jsx"
  ],
  "pathOverrides": [
    "$PROJECT:app",
    "$PROJECT/config:config",
    "$PROJECT/tests:tests"
  ],
  "serviceOverrides": [
    "fastboot:boot"
  ],
  "disablePathOverrides": false,
  "disableBabelRc": false,
  "disableHyperclickSupport": false
}
```

### .babelrc
Optionally, you can use path aliases defined in `.babelrc`. A sample file looks like:

```javascript
{
  "plugins": [
      ["module-resolver", {
        "root": ["./src"],
        "alias": {
          "utils": "./utils"
        }
      }]
    ]
}
```

With the above `.babelrc` file, a path of `utils/test` will resolve to `./src/utils/test.js`

### Settings & Aliases Priority
Project settings and aliases defined in `.jump-to-import` will always take priority. Next, `.babelrc` aliases take precedence over aliases defined in Package Settings.

Remember, `.jump-to-import` > `.babelrc` > `Package Settings`

## Example
With the following `import` line:

```javascript
// assuming the project's name is defined as `my-project` in `package.json`
// with cursor on, or selecting, `FooMixin` or the path, will open project-root/app/mixins/foo.js
import FooMixin from 'my-project/mixins/foo'

// with cursor on, or selecting, bar, will open project-root/app/mixins/foo.js and jump to the bar() method
FooMixin.bar();
```
