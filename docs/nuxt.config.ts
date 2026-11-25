import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { detectHost } from 'vite-hub'

// Local builds and CI run on Node with SQLite. `vitehub deploy --host cloudflare` sets VITEHUB_HOST, so the deploy
// builds the Worker with the D1 database and KV namespace that it provisions and records in .vitehub/provision.json.
const host = detectHost() ?? 'node'

const root = new URL('./', import.meta.url)
const repo = new URL('../', root)
const generated = new URL('.generated/public/', root)

// The brand files, from where the README shows them, so the site and the README can't drift apart.
const brand = ['banner.svg', 'logo.svg', 'favicon.svg']

export default defineNuxtConfig({
  modules: [
    'vite-hub/nuxt',
    'vite-hub/docs/nuxt',
    async (_, nuxt) => {
      await rm(generated, { recursive: true, force: true })
      await mkdir(generated, { recursive: true })
      for (const file of brand)
        await cp(new URL(`.github/assets/${file}`, repo), new URL(file, generated))
      nuxt.options.nitro.publicAssets ??= []
      nuxt.options.nitro.publicAssets.push({ dir: fileURLToPath(generated), maxAge: 60 * 60 * 24 })
    },
  ],
  app: {
    head: {
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    },
  },
  docs: {
    site: {
      name: 'glosslint',
      url: 'https://glosslint.onmax.me',
      description: 'Lint your product vocabulary in code, translations and docs from one glossary.',
      // The tile with its colors, as the README and the favicon show it.
      logo: { light: '/logo.svg' },
      badge: { label: 'preview', tooltip: 'Not published on npm yet. Version 0.0.1 is next.' },
    },
    banner: 'glosslint is in preview and not on npm yet. Version 0.0.1 will be the first release.',
    start: { section: 'guide' },
    github: { repo: 'onmax/glosslint', dir: 'docs/content' },
    socials: [
      { label: 'glosslint on npm', icon: 'i-simple-icons-npm', to: 'https://npmx.dev/package/glosslint' },
    ],
    seoAudit: 'error',
  },
  vitehub: {
    name: 'glosslint-docs',
    // The CMS keeps editor sessions here. Pages and their history live in the GitHub repository.
    database: host === 'cloudflare'
      ? { driver: 'cloudflare', databaseName: 'glosslint-docs', migrateOnDeploy: true }
      : true,
    // Content keeps GitHub answers that never change (commits, trees, archives) here, so a new Worker isolate opens the
    // Console overview with a few GitHub requests instead of reading every commit again.
    // namespaceId pins the namespace that `vitehub deploy` created: ViteHub 0.5.1 records it in app/.vitehub/provision.json
    // (Nuxt's srcDir) and then builds the KV binding without it, which makes wrangler create another namespace.
    kv: host === 'cloudflare'
      ? { driver: 'cloudflare', namespaceName: 'glosslint-docs', namespaceId: '34936d73515247d98cf06c50d1b582b7' }
      : true,
    console: true,
  },
  nitro: {
    cloudflare: {
      wrangler: {
        // glosslint.onmax.me is a custom domain of the Worker. The onmax.me zone is on the same Cloudflare account.
        routes: [{ pattern: 'glosslint.onmax.me', custom_domain: true }],
        workers_dev: false,
        // The public key of the ViteHub Console link (app c74a8682), so the Console's signed requests verify.
        vars: { VITEHUB_CONSOLE_KEY_CONSOLE_C74A8682: 'l3WoQCIu2-0Pe9h8XX6Keb6agNA-yridVqDAjCn6Vf8' },
      },
    },
  },
  fonts: {
    // The ViteHub theme names Geist only in --font-sans and --font-mono, which @nuxt/fonts 1.x doesn't scan.
    families: ['Geist', 'Geist Mono'].map(name => ({
      name,
      provider: 'google',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      global: true,
    })),
  },
  compatibilityDate: '2026-11-01',
})
