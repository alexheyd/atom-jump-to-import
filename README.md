# jump-to-import package

*Replacement package for the `ember-import-navigator` Atom package.*

Contributions and Pull Requests are welcome.

## Limitations
- `package.json` required at root of project
  - used to figure out the project name to use when converting magic paths to the real file path

## Features
- Jump to imported file from path, variable name, or method name
- **NPM Module Support** with Browserify (as long as the path is formatted like `npm:path-to-package`)
  - it grabs the package's entry file from its `package.json` `main` value
- `babel-plugin-module-resolver` support: loads path overrides from project's `.babelrc`
- Multiple project root folder support
- Supports multi-line destructured `import` statements
- Configurable settings:
  - Custom path overrides
  - Ability to disable custom path overrides and `.babelrc` overrides
  - Prioritized list of file extensions to check (defaults to `js` and `jsx`)

## Usage
Press CTRL+ALT+E with the cursor either on a CommonJS `import` path, or the imported namespace, or a method on the imported namespace to open that file and jump to the relevant method, if applicable. For functions declared in the same file, it uses Atom's native `Symbols View` package.

### Example
With the following `import` line:

```javascript
// assuming the project's name is defined as `my-project` in `package.json`
// with cursor on, or selecting, `FooMixin` or the path, will open project-root/app/mixins/foo.js
import FooMixin from 'my-project/mixins/foo'

// with cursor on, or selecting, bar, will open project-root/app/mixins/foo.js and jump to the bar() method
FooMixin.bar();
```

### Plugin Settings

You can define your own path overrides in Settings.

Default overrides are:
- `$PROJECT:app`
- `$PROJECT/config:config`

With the above default settings (for Ember projects) we would get the following behavior:
- `PROJECT_NAME/components/foo` -> `app/components/foo.js`
- `PROJECT_NAME/config/environment` -> `config/environment.js`

`PROJECT_NAME` in the path needs to match the project name defined in your `package.json` file in the root directory.

The package will look for a `package.json` file in every root directory of the project to determine project names.

You can now also define a list of file extensions to try and open.

## .babelrc Support

Support for `babel-plugin-module-resolver` has been added, where you can have the babel module aliases used for the file lookups.

```
{
  "plugins": [
      ["module-resolver", {
        "root": ["./src"],
        "alias": {
          "utils": "./src/utils"
        }
      }]
    ]
}
```

With the above `.babelrc` file, a path of `utils/test` will resolve to `./src/utils/test.js`

**Note:** The `pathOverrides` defined in `Settings` have priority over `.babelrc` aliases.

## Coming Soon
- Ability to define a project name if no `package.json` file is present

## Known issues
- Soft wrap and code folding break opening modules when cursor is in string. (atom/atom#8685)
- Only supports one project root folder
