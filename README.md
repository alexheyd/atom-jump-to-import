# jump-to-import package

This is a replacement package for the `ember-import-navigator` Atom package.

Inspired by `amd-navigator` package: [https://github.com/zboro/amd-navigator](https://github.com/zboro/amd-navigator)

This fork no longer supports `require` AMD modules.

This package will open the relevant file for an imported module based on where the cursor is located or which word is selected.

You can open the module by pressing `Ctrl+Alt+E` when your cursor is on the module variable or the import path. This also works with module method names. For functions declared in the same file, it uses Atom's native `Symbols View` package.

## Example
With the following import line:

```javascript
// with cursor on, or selecting, FooMixin or the path, will open project-root/app/mixins/foo.js
import FooMixin from 'my-project/mixins/foo'

// with cursor on, or selecting, bar, will open project-root/app/mixins/foo.js and jump to the bar() method
FooMixin.bar();
```

### Plugin Settings

You can define your own path overrides in Settings. Default overrides are:
`$PROJECT:app` and `$PROJECT/config:config`.

This resolves the following path `project_name/app/components/foo` to `app/components/foo.js` and this path `project_name/config/environment` to: `config/environment.js` (default overrides for Ember projects, change to suit your project!)

The package will look for a `package.json` file in every root directory of the project to determine project names.

File extension is assumed to be `.js`

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

## Features
- Jump to imported file from path, variable name, or method name
- Custom path overrides
- `babel-plugin-module-resolver` support: loads path overrides from project's `.babelrc`
- Multiple project root folder support

## Coming Soon
- Multiple file extension support
- ~~Tag and path caching~~
  - will not be caching because files and tags can be edited on the fly and cache will likely get stale

## Known issues
- Soft wrap and code folding break opening modules when cursor is in string. (atom/atom#8685)
- Only supports one project root folder
