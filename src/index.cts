const { default: MagicString } = require("magic-string") as typeof import("magic-string");
type MagicString = InstanceType<typeof MagicString>;
const { init, parse } = require("es-module-lexer") as typeof import("es-module-lexer");
import type { Plugin as VitePlugin, UserConfig, ResolvedConfig } from "vite";
import type { server as tsserverlibrary } from "typescript/lib/tsserverlibrary";
type PluginCreateInfo = tsserverlibrary.PluginCreateInfo;
type ESBuildPlugin = NonNullable<
	NonNullable<
		NonNullable<UserConfig["optimizeDeps"]>["esbuildOptions"]
	>["plugins"]
>[number];

function getQuery(params: URLSearchParams) {
	if (params.size === 0) return "";
	return (
		"?" +
		Array.from(params.entries(), ([key, value]) =>
			value ? `${key}=${value}` : key,
		).join("&")
	);
}

function removeEnvArgs(name: string) {
	return ["client", "server", "dev", "prod"].reduce(
		(name, env) =>
			name.replace(new RegExp(`(\\?|&)${env}(&|$)`), (_, $1, $2) =>
				$2 ? $1 : "",
			),
		name,
	);
}

/**
 * Isomorphically import modules on client, server, dev, or prod context.
 */
const envImport = (): VitePlugin => {
	let config: ResolvedConfig;

	return {
		name: "vite-plugin-env-import",
		enforce: "post",

		config: () => ({
			optimizeDeps: {
				esbuildOptions: {
					plugins: [esbuildPatchPlugin()],
				},
			},
		}),

		configResolved(resolvedConfig) {
			// store the resolved config
			config = resolvedConfig;
		},

		async transform(code, id, options) {
			// Support breaking change in Vite 2.7
			// The third argument now contains an object with ssr property, instead of just the ssr boolean
			const ssr = (options as never as boolean) === true || options?.ssr;
			const dev = config.command === "serve";

			await init;

			let magicString: MagicString | undefined;
			const getMagicString = () =>
				(magicString ??= new MagicString(code));
			const [imports] = parse(code);

			for (const import_ of imports) {
				// Ignore if no name or is dynamic import
				if (!import_.n || import_.d !== -1) continue;
				const queryIndex = import_.n.indexOf("?");
				const params = new URLSearchParams(import_.n.slice(queryIndex));
				if (params.size === 0 || queryIndex === -1) continue;
				// "?client"         => ""
				// "?client&foo"     => "?foo"
				// "?foo&client"     => "?foo"
				// "?foo&client&bar" => "?foo&bar"
				if (
					(params.has("client") && ssr) ||
					(params.has("server") && !ssr) ||
					(params.has("dev") && !dev) ||
					(params.has("prod") && dev)
				) {
					getMagicString().overwrite(import_.ss, import_.se, "");
					continue;
				}
				["client", "server", "dev", "prod"].forEach((env) =>
					params.delete(env),
				);
				getMagicString().overwrite(
					import_.s + queryIndex,
					import_.e,
					getQuery(params),
				);
			}

			if (magicString) {
				return {
					code: magicString.toString(),
					map: magicString.generateMap({ hires: "boundary" }),
				};
			}
		},
	};
};

/**
 * I wish I would never have to write this again :(
 *
 * This esbuild plugin patches Vite's dep scan plugin so it's `build.onResolve`
 * callback param always receives `args.path` without `?client` or `?server` suffix.
 *
 * But why this method? A list of alternatives tried:
 *
 * 1. Esbuild plugin which resolves "my-lib?client" => "my-lib"
 *
 * This does not work because `build.onResolve` doesn't fallthrough
 * (needs resolve to absolute path), which also means Vite's scanner won't catch this.
 *
 * 2. Use Vite plugin `resolveId` for "my-lib?client" => "my-lib?client"
 *
 * Almost worked, but Vite prebundles as "my-lib?client", causing actual import to
 * trigger dynamic pre-bundling.
 *
 * 3. Intercept server._optimizeDepsMetadata (Idea: https://github.com/antfu/vite-plugin-optimize-persist)
 *
 * Too risky with potential pitfalls. Plus we need to fix this for non-package imports
 * as well so Vite crawls into the import path, e.g. relative or alias imports.
 *
 * 4. Use esbuild tsconfig option to map "*?client" => "*" naively
 *
 * Doesn't work. Don't think it's valid either.
 *
 * 5. Fix Vite directly to strip anything after "?"
 *
 * There could be legitimate reasons we don't want that to happen.
 */
const esbuildPatchPlugin = (): ESBuildPlugin => ({
	name: "esbuild-plugin-env-import",
	setup(build) {
		const viteScanPlugin = build.initialOptions.plugins!.find(
			(v) => v.name === "vite:dep-scan",
		);

		if (!viteScanPlugin) return;

		const oriSetup = viteScanPlugin.setup.bind(viteScanPlugin);
		viteScanPlugin.setup = (build) => {
			const oriResolve = build.onResolve.bind(
				build,
			) as typeof build.onResolve;
			build.onResolve = (options, callback) => {
				const wrapCallback: typeof callback = (args) => {
					args.path = removeEnvArgs(args.path);
					return callback(args);
				};

				return oriResolve(options, wrapCallback);
			};
			return oriSetup(build);
		};
	},
});

/**
 * TypeScript plugin to correctly resolve ?client, ?server, ?dev, and ?prod imports.
 * Only works for JS and TS files. Vue and Svelte are not supported.
 */
function tsPlugin() {
	function create(info: PluginCreateInfo) {
		// Thanks: https://github.com/sveltejs/language-tools/blob/6e0396ca18ea5e7da801468eab35cdef43b3c979/packages/typescript-plugin/src/module-loader.ts#L56
		const originalResolveModuleNames =
			info.languageServiceHost.resolveModuleNames!.bind(
				info.languageServiceHost,
			);
		info.languageServiceHost.resolveModuleNames = (
			moduleNames,
			...args
		) => {
			const newModuleNames = moduleNames.map((name) =>
				removeEnvArgs(name),
			);
			return originalResolveModuleNames(newModuleNames, ...args);
		};

		return info.languageService;
	}

	return { create };
}

export = tsPlugin;
tsPlugin.default = tsPlugin;
tsPlugin.envImport = envImport;
