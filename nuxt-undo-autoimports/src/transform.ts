import { pathToFileURL } from 'node:url'
import { createWriteStream } from 'node:fs'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import type { Unimport } from 'unimport'
import { normalize } from 'pathe'
import type { UndoImportsOptions } from './schema'

const file = createWriteStream('unimport.js', { flags: 'w' })

file.write(`/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */

`)

export const TransformPlugin = createUnplugin(({ ctx, options, sourcemap }: { ctx: Unimport; options: Partial<UndoImportsOptions>; sourcemap?: boolean }) => {
  return {
    name: 'nuxt:imports-transform',
    enforce: 'post',
    transformInclude(id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const query = parseQuery(search)

      // Included
      if (options.transform?.include?.some(pattern => id.match(pattern)))
        return true

      // Excluded
      if (options.transform?.exclude?.some(pattern => id.match(pattern)))
        return false

      // Vue files
      if (
        id.endsWith('.vue')
        || 'macro' in query
        || ('vue' in query && (query.type === 'template' || query.type === 'script' || 'setup' in query))
      )
        return true

      // JavaScript files
      if (pathname.match(/\.((c|m)?j|t)sx?$/g))
        return true
    },
    async transform(code, id) {
      console.warn('hello')
      id = normalize(id)
      const isNodeModule = id.match(/[\\/]node_modules[\\/]/) && !options.transform?.include?.some(pattern => id.match(pattern))
      // For modules in node_modules, we only transform `#imports` but not doing imports
      if (isNodeModule && !code.match(/(['"])#imports\1/))
        return

      console.log('id', id)
      const { isCJSContext, matchedImports } = await ctx.detectImports(code)
      // console.log('matchedImports', matchedImports, id)
      const { s } = await ctx.injectImports(code, id, { autoImport: options.autoImport && !isNodeModule })
      if (s.hasChanged()) {
        if (s.toString().length - s.original.length > 0 && !id.includes('node_modules') && !id.includes('virtual')) {
          file.write(`// ${id}
${s.toString().slice(0, s.toString().length - s.original.length).replaceAll(process.cwd(), options.cwdAlias ?? process.cwd())}
`)
        }
        return {
          code: s.toString(),
          map: sourcemap
            ? s.generateMap({ source: id, includeContent: true })
            : undefined,
        }
      }
    },
  }
})
