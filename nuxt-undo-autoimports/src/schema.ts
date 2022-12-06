import type { ImportsOptions } from '@nuxt/schema'

export interface UndoImportsOptions extends ImportsOptions {
  cwdAlias?: string,
  mode: 'log' | 'comment' | 'insert'
}
