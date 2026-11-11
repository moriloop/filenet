#!/usr/bin/env node
import { createRequire } from 'node:module'
import { defineCommand, runMain } from 'citty'

const { version, description } = createRequire(import.meta.url)('../package.json') as {
  version: string
  description: string
}

const main = defineCommand({
  meta: {
    name: 'filenet',
    version,
    description,
  },
  setup() {
  },
  cleanup() {
  },
  subCommands: {
    serve: () => import('./commands/serve.js').then(r => r.default),
    send: () => import('./commands/send.js').then(r => r.default),
  },
})

runMain(main)
