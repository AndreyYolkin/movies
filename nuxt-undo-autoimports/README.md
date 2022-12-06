# Undo Nuxt Autoimports module

## Warning
This module is compatible with 3.0.0 version of Nuxt. However it's more like POC and lots of functions are in progress. That's why it has `beta` suffix.

## Why?
Because Nuxt's autoimports is opinionated and very attractive to people who just starts building frontend applications. This module intends to create a possibility to bring implicit imports back to the files

## How to use?
Install it like a usual Nuxt module and run `npm run build`. Dev mode is not supported yet, because I can't handle the changes and rewrite file with captured imports after each save.

## Does it modify the source files?
No (at the current time). It's just outputs the list of missing imports. After running `npm run build` you will find `unimport.js` file at your project root. Use it as a reference

## Options
As of 3.0.0-beta.0, only `cwdAlias` options is tested, for initial options, please, see https://github.com/nuxt/framework/blob/13e4f8b679701366fb050f66aed4cb73babb00be/packages/schema/src/types/imports.ts#L3

* `cwdAlias`: string
Alias name to replace absolute path. For example, `/home/user/projectname/composables/tmdb.ts` will be written as `@/composables/tmdb.ts`

## Known issues
Because of building server and client, generated list duplicates each founded autoimport
