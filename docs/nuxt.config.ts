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

// The playground runs ESLint's Linter and vue-eslint-parser in the browser. They import a few Node modules, which
// resolve to the small shims in app/playground/ in the client build.
const shims: Record<string, string> = {
  'node:path': 'node-path',
  'path': 'node-path',
  'assert': 'node-assert',
  'events': 'node-events',
  'module': 'node-module',
}
const shim = (name: string) => fileURLToPath(new URL(`app/playground/${name}.ts`, root))
function nodeShim(id: string, importer?: string) {
  if (id === 'eslint' && importer?.includes('vue-eslint-parser')) return shim('node-eslint')
  return shims[id] ? shim(shims[id]) : undefined
}

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
  // The banner's neon on the ViteHub Docs tokens. ViteHub puts its own stylesheet first, so this one wins.
  css: ['~/assets/css/neon.css'],
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
    },
    // The header links beside the logo. ViteHub Docs names the first one "Docs" and the rest by their labels.
    start: {
      section: 'guide',
      links: [
        { label: 'Guide', to: '/guide' },
        { label: 'Integrations', to: '/integrations' },
        { label: 'Reference', to: '/reference' },
        { label: 'Playground', to: '/playground', icon: 'i-lucide-play' },
      ],
    },
    github: { repo: 'onmax/glosslint', dir: 'docs/content' },
    socials: [
      { label: 'glosslint on npmx', icon: 'i-glosslint-npmx', to: 'https://npmx.dev/package/glosslint' },
      { label: '@_onmax on X', icon: 'i-simple-icons-x', to: 'https://x.com/_onmax' },
    ],
    seoAudit: 'error',
    // The install tabs' order and logos.
    parser: 'parser.ts',
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
  // The terms page joined the glossary page.
  routeRules: {
    '/guide/terms': { redirect: { to: '/guide/glossary', statusCode: 301 } },
    '/spec': { redirect: { to: '/reference/spec', statusCode: 301 } },
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
  icon: {
    // npmx.dev's mark (public/logo-mark.svg) and x18n's (res/logo-mini-dark.svg, MIT), from their repositories, in
    // currentColor like the simple-icons logos.
    customCollections: [{ prefix: 'glosslint', dir: './app/assets/icons' }],
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
  vite: {
    // The dev optimizer pre-bundles ESLint and vue-eslint-parser with its own plugins, so it gets the shims too.
    plugins: [{
      name: 'glosslint-playground-node-shims',
      enforce: 'pre',
      resolveId: (id, importer, options) => options?.ssr ? undefined : nodeShim(id, importer),
    }],
    optimizeDeps: {
      include: ['vue-eslint-parser'],
      rolldownOptions: { plugins: [{ name: 'glosslint-playground-node-shims', resolveId: nodeShim }] },
    },
  },
  compatibilityDate: '2026-11-01',
})
