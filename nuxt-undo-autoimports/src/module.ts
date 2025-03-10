import { addPluginTemplate, addTemplate, logger, addVitePlugin, addWebpackPlugin, defineNuxtModule, resolveAlias, updateTemplates, useNuxt } from '@nuxt/kit'
import { isAbsolute, join, normalize, relative, resolve } from 'pathe'
import type { Import, Unimport } from 'unimport'
import { createUnimport, scanDirExports, toImports } from 'unimport'
import type { ImportPresetWithDeprecation } from '@nuxt/schema'
import escapeRE from 'escape-string-regexp'
import { TransformPlugin } from './transform'
import { defaultPresets } from './presets'
import type { UndoImportsOptions } from './schema'

export default defineNuxtModule<Partial<UndoImportsOptions>>({
  meta: {
    name: 'imports',
    configKey: 'imports',
  },
  defaults: {
    autoImport: true,
    presets: defaultPresets,
    global: false,
    imports: [],
    dirs: [],
    transform: {
      include: [],
      exclude: undefined,
    },
    mode: 'log',
    cwdAlias: undefined,
  },
  async setup(_options, nuxt) {
    if (nuxt.options.dev) {
      logger.error('UndoImports module is not compatible with dev mode yet. Please run `nuxt build` instead.')
      process.exit(1)
    }
    if (_options.mode === 'insert') {
      logger.warn('Insertion mode: hope you committed your changes before running `nuxt build`!')
    }
    if (_options.mode === 'log') {
      logger.info('Logging mode: you\'ll just get unimport.js file at your project root.')
    }
    if (_options.mode === 'comment') {
      logger.info('Comment mode: imports will be included in your files, but commented out.')
    }
    const options = { ..._options }
    options.transform = options?.transform || { include: [] }
    options.transform.include = options.transform.include || []
    options.transform.include.push(
      ...nuxt.options._layers
        .filter(i => i.cwd && i.cwd.includes('node_modules'))
        .map(i => new RegExp(`(^|\\/)${escapeRE(i.cwd.split('node_modules/').pop())}(\\/|$)(?!node_modules\\/)`)),
    )
    // TODO: fix sharing of defaults between invocations of modules
    const presets = JSON.parse(JSON.stringify(options.presets)) as ImportPresetWithDeprecation[]

    // Allow modules extending sources
    await nuxt.callHook('imports:sources', presets)

    // Filter disabled sources
    // options.sources = options.sources.filter(source => source.disabled !== true)

    // Create a context to share state between module internals
    const ctx = createUnimport({
      presets,
      imports: options.imports,
      virtualImports: ['#imports'],
      addons: {
        vueTemplate: options.autoImport,
      },
    })

    // composables/ dirs from all layers
    let composablesDirs: string[] = []
    for (const layer of nuxt.options._layers) {
      composablesDirs.push(resolve(layer.config.srcDir, 'composables'))
      composablesDirs.push(resolve(layer.config.srcDir, 'utils'))
      for (const dir of (layer.config.imports?.dirs ?? [])) {
        if (!dir)
          continue

        composablesDirs.push(resolve(layer.config.srcDir, dir))
      }
    }

    await nuxt.callHook('imports:dirs', composablesDirs)
    composablesDirs = composablesDirs.map(dir => normalize(dir))

    // Support for importing from '#imports'
    addTemplate({
      filename: 'imports.mjs',
      getContents: async () => `${await ctx.toExports()}\nif (process.dev) { console.warn("[nuxt] \`#imports\` should be transformed with real imports. There seems to be something wrong with the imports plugin.") }`,
    })
    nuxt.options.alias['#imports'] = join(nuxt.options.buildDir, 'imports')

    // Transpile and injection
    if (nuxt.options.dev && options.global) {
      // Add all imports to globalThis in development mode
      addPluginTemplate({
        filename: 'imports.mjs',
        getContents: async () => {
          const imports = await ctx.getImports()
          const importStatement = toImports(imports)
          const globalThisSet = imports.map(i => `globalThis.${i.as} = ${i.as};`).join('\n')
          return `${importStatement}\n\n${globalThisSet}\n\nexport default () => {};`
        },
      })
    }
    else {
      // Transform to inject imports in production mode
      addVitePlugin(TransformPlugin.vite({ ctx, options, sourcemap: nuxt.options.sourcemap?.server || nuxt.options.sourcemap?.client }))
      addWebpackPlugin(TransformPlugin.webpack({ ctx, options, sourcemap: nuxt.options.sourcemap?.server || nuxt.options.sourcemap?.client }))
    }

    const regenerateImports = async () => {
      ctx.clearDynamicImports()
      await ctx.modifyDynamicImports(async (imports) => {
        // Scan composables/
        imports.push(...await scanDirExports(composablesDirs))
        // Modules extending
        await nuxt.callHook('imports:extend', imports)
      })
    }

    await regenerateImports()

    // Generate types
    addDeclarationTemplates(ctx, options)

    // Add generated types to `nuxt.d.ts`
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/imports.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'imports.d.ts') })
    })

    const onCompiledCallback = () => {
      logger.success(`Missing imports listed in ${process.cwd()}/unimport.js`)
      process.exit(0)
    }

    nuxt.hook('vite:compiled', onCompiledCallback)
    nuxt.hook('webpack:compiled', onCompiledCallback)

    // Watch composables/ directory
    const templates = [
      'types/imports.d.ts',
      'imports.d.ts',
      'imports.mjs',
    ]
    nuxt.hook('builder:watch', async (_, path) => {
      const _resolved = resolve(nuxt.options.srcDir, path)
      if (composablesDirs.find(dir => _resolved.startsWith(dir))) {
        await updateTemplates({
          filter: template => templates.includes(template.filename),
        })
      }
    })

    nuxt.hook('builder:generateApp', async () => {
      await regenerateImports()
    })
  },
})

function addDeclarationTemplates(ctx: Unimport, options: Partial<UndoImportsOptions>) {
  const nuxt = useNuxt()

  // Remove file extension for benefit of TypeScript
  const stripExtension = (path: string) => path.replace(/\.[a-z]+$/, '')

  const resolved: Record<string, string> = {}
  const r = ({ from }: Import) => {
    if (resolved[from])
      return resolved[from]

    let path = resolveAlias(from)
    if (isAbsolute(path))
      path = relative(join(nuxt.options.buildDir, 'types'), path)

    path = stripExtension(path)
    resolved[from] = path
    return path
  }

  addTemplate({
    filename: 'imports.d.ts',
    getContents: () => ctx.toExports(nuxt.options.buildDir),
  })

  addTemplate({
    filename: 'types/imports.d.ts',
    getContents: async () => `// Generated by auto imports\n${
      options.autoImport
        ? await ctx.generateTypeDeclarations({ resolvePath: r })
        : '// Implicit auto importing is disabled, you can use explicitly import from `#imports` instead.'}`,
  })
}
