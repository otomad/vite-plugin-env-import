# vite-plugin-env-import

[![npm](https://img.shields.io/npm/v/vite-plugin-env-import?logo=npm&logoColor=%23CB3837&label=npm&labelColor=white&color=%23CB3837)](https://www.npmjs.org/package/vite-plugin-env-import)
[![GitHub](https://img.shields.io/npm/v/vite-plugin-env-import?logo=github&label=GitHub&color=%23181717)](https://github.com/otomad/vite-plugin-env-import.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)][license-url]

[license-url]: https://opensource.org/licenses/MIT

Import modules isomorphically in the client, server, development, or production. [Vite discussion](https://github.com/vitejs/vite/discussions/4172) for potential built-in support.

Focked from [vite-plugin-iso-import](https://github.com/bluwy/vite-plugin-iso-import). And added the environment-specific import for DEV and PROD.

## Usage

Input:

```javascript
import { foo } from "./client-module?client";
import { bar } from "./server-module?server";
```

Normal build output:

```javascript
import { foo } from "./client-module";
```

SSR build output:

```javascript
import { bar } from "./server-module";
```

---

Input:

```javascript
import { foo } from "./dev-module?dev";
import { bar } from "./prod-module?prod";
```

Development mode output:

```javascript
import { foo } from "./dev-module";
```

Production mode output:

```javascript
import { bar } from "./prod-module";
```

## Installation

Install library:

```bash
# npm
npm install --save-dev vite-plugin-env-import

# yarn
yarn add --save-dev vite-plugin-env-import

# pnpm
pnpm add --save-dev vite-plugin-env-import
```

Add plugin to `vite.config.js` or `vite.config.ts`:

```javascript
import { envImport } from "vite-plugin-env-import";

export default defineCnfig({
  plugins: [envImport()]
})
```

## FAQ

### What happens if I use an import value that has been stripped off?

You'll get a usual JS error of the value being unreferenced/undefined. Instead, you should always wrap these environment-specific code with [`import.meta.env.*`](https://vite.dev/guide/env-and-mode#built-in-constants).

### Using `?env` loses intellisense

The library exports a custom TypeScript plugin that fixes it. Simply update your `jsconfig.json` or `tsconfig.json` like so:

```javascripton
{
  "compilerOptions": {
    "plugins": [{ "name": "vite-plugin-env-import" }]
  }
}
```

If you're using the VSCode-bundled TypeScript version, you have to update VSCode's `settings.json` with `"typescript.tsserver.pluginPaths": ["."]`. (Or a path to the project that contains the `node_modules` folder)

Also note that this currently does not work for Vue and Svelte files. The language services are unable to load TypeScript plugins. At the meantime, you can use this suboptimal solution for npm packages only:

```ts
// global.d.ts (or any ambient dts file)

// default export
declare module "camelcase?client" {
  import all from "camelcase";
  export = all;
}

// named export
declare module "lodash-es?server" {
  import * as all from "lodash-es";
  export = all;
}

// fallback
declare module "*?client";
declare module "*?server";
```

## License

MIT
