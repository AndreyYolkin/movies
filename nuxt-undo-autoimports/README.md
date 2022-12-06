# Undo Nuxt Autoimports module

## Warning
This module is compatible with 3.0.0 version of Nuxt. However it's more like POC and lots of functions are in progress. That's why it has `beta` suffix.

## Why?
Because Nuxt's autoimports is opinionated and very attractive to people who just starts building frontend applications. This module intends to create a possibility to bring implicit imports back to the files

## How to use?
Install it like a usual Nuxt module and run `npm run build`. Dev mode is not supported yet, because I can't handle the changes and rewrite file with captured imports after each save.

## Does it modify the source files?
Yes, if selected mode differs from 'log'. See options.

## Options
As of 3.0.0-beta.3, only `cwdAlias` and `mode` options are tested, for initial options, please, see https://github.com/nuxt/framework/blob/13e4f8b679701366fb050f66aed4cb73babb00be/packages/schema/src/types/imports.ts#L3

* `cwdAlias`: string \
Alias name to replace absolute path. For example, `/home/user/projectname/composables/tmdb.ts` will be written as `@/composables/tmdb.ts`
* `mode`: string \
Describes, how it should work. In `log` mode only unimport.js will be generated, `comment` mode will insert missing imports, but commented out. `insert` mode will insert missing imports without comments (and with ignorance of your eslint). Default mode is `log`

## Known issues
Imports in `comment` mode doesn't know about other comments. So, every time you run the module in `comment` mode, new comments will be added on top of your script section.
