# jump-to-import package

This is a replacement package for the `ember-import-navigator` Atom package.

Inspired by `amd-navigator` package: [https://github.com/zboro/amd-navigator](https://github.com/zboro/amd-navigator)

This fork no longer supports `require` AMD modules.

This package will open the relevant file for an imported module based on where the cursor is located or which word is selected.

You can open the module by pressing `Ctrl+Alt+E` when your cursor is on the module variable or the import path. This also works with module method names. For functions declared in the same file, it uses Atom's native `Symbols View` package.

### Example
With the following import line:

```javascript
// with cursor on, or selecting, FooMixin or the path, will open project-root/app/mixins/foo.js
import FooMixin from 'my-project/mixins/foo'

// with cursor on, or selecting, bar, will open project-root/app/mixins/foo.js and jump to the bar() method
FooMixin.bar();
```

You can define your own path overrides in Settings. Default overrides are:
`$PROJECT:app` and `$PROJECT/config:config`.

This resolves the following path `project_name/app/components/foo` to `app/components/foo.js` and this path `project_name/config/environment` to: `config/environment.js` (default overrides for Ember projects, change to suit your project!)

The package will look for a `package.json` file in the root of the current file to determine the project name.

File extension is assumed to be `.js`

The package _could_ check for the existence of the folder first, and then check the project root for the same folder name, but checking if a directory exists returns a promise, which would slow the package down.

### Known issues

Soft wrap and code folding break opening modules when cursor is in string. (atom/atom#8685)
