// Runs glosslint's x18n plugin in a real x18n project on the playground's locale files.
import { createMemoryHost, createProject, pathId, resolveConfig, walkLeaves } from '@x18n/core'
import type { Diagnostic, NodeRange, Plugin } from '@x18n/core'
import { createPlugin } from '../../../src/x18n/plugin.ts'
import type { Corpus } from '../../../src/types.ts'
import { edit, lineColumn, type Files, type PlaygroundFinding, type QuickFix } from './findings.ts'

const LOCALE_FILE = /^locales\/([\w-]+)\.json$/

/** Where each message's key and value are in a JSON file, with the quotes. Values are flat strings, as in the example. */
function ranges(text: string, tree: Record<string, unknown>): Map<string, NodeRange> {
  const out = new Map<string, NodeRange>()
  let from = 0
  for (const { path, value } of walkLeaves(tree as never)) {
    const key = JSON.stringify(path.at(-1))
    const keyStart = text.indexOf(key, from)
    const raw = JSON.stringify(value)
    const valueStart = text.indexOf(raw, keyStart + key.length)
    if (keyStart === -1 || valueStart === -1) continue
    out.set(pathId(path), {
      key: { start: keyStart, end: keyStart + key.length },
      value: { start: valueStart, end: valueStart + raw.length },
    })
    from = valueStart + raw.length
  }
  return out
}

/** @x18n/core has no formats or finders of its own, so the playground brings a JSON format and finds `locales/*.json`. */
function support(paths: string[]): Plugin {
  return {
    name: 'playground-json',
    localeFinders: [{
      id: 'playground-locales',
      find: async () => paths.map(path => ({ path, locale: LOCALE_FILE.exec(path)![1]!, namespace: undefined })),
    }],
    formats: [{
      id: 'playground-json',
      extensions: ['json'],
      parse: (text) => {
        const tree = JSON.parse(text) as Record<string, unknown>
        return { tree: tree as never, ranges: ranges(text, tree) }
      },
      serialize: tree => `${JSON.stringify(tree, null, 2)}\n`,
    }],
  }
}

async function project(files: Files, corpus: Corpus) {
  const paths = Object.keys(files).filter(path => LOCALE_FILE.test(path)).sort()
  const host = createMemoryHost(Object.fromEntries(paths.map(path => [path, files[path]!])), '/playground')
  const setup = await resolveConfig({
    host,
    config: { sourceLocale: 'en', plugins: [support(paths), createPlugin(corpus)] },
    builtins: { plugins: [], presets: {} },
  })
  const p = createProject({ host, setup })
  await p.ready
  return { host, project: p, paths }
}

/** The quick fix of one x18n fix: its `set` ops as edits of the message values in the file. */
function quickFix(files: Files, path: string, fix: Diagnostic['fixes'][number]): QuickFix | undefined {
  const text = files[path]
  if (text === undefined) return undefined
  let tree: Record<string, unknown>
  try {
    tree = JSON.parse(text) as Record<string, unknown>
  }
  catch {
    return undefined
  }
  const where = ranges(text, tree)
  const edits = []
  for (const op of fix.ops) {
    if (op.type !== 'set') return undefined
    const range = where.get(pathId([op.key]))
    if (!range || typeof op.value !== 'string') return undefined
    edits.push(edit(text, range.value.start, range.value.end, JSON.stringify(op.value)))
  }
  return { title: fix.title, file: path, edits }
}

export interface X18nRun {
  paths: string[]
  findings: PlaygroundFinding[]
  /** How many findings `x18n check --fix` fixes. */
  fixable: number
}

export async function runX18n(files: Files, corpus: Corpus): Promise<X18nRun> {
  const { project: p, paths } = await project(files, corpus)
  const diagnostics = p.analyze().diagnostics
  const findings: PlaygroundFinding[] = []
  for (const diagnostic of diagnostics) {
    const location = diagnostic.location
    if (!location) continue
    const text = files[location.path] ?? ''
    const { line, column } = lineColumn(text, location.range.start)
    findings.push({
      id: `x18n:${location.path}:${location.range.start}:${diagnostic.code}`,
      tool: 'x18n',
      source: `x18n(${diagnostic.code})`,
      code: diagnostic.code,
      severity: diagnostic.severity === 'error' ? 'error' : 'warning',
      file: location.path,
      line,
      column,
      start: location.range.start,
      end: location.range.end,
      text: text.slice(location.range.start, location.range.end),
      message: diagnostic.message,
      fixes: diagnostic.fixes.flatMap(fix => quickFix(files, location.path, fix) ?? []),
      autofix: diagnostic.fixes.some(fix => fix.level === 'safe'),
    })
  }
  return { paths, findings, fixable: p.planFixes(diagnostics).fixed.length }
}

/** `x18n check --fix`: x18n plans the safe fixes and writes them. Returns the locale files that changed. */
export async function fixX18n(files: Files, corpus: Corpus): Promise<Files> {
  const { host, project: p, paths } = await project(files, corpus)
  const { plan } = p.planFixes(p.analyze().diagnostics)
  await p.apply(plan)
  const changed: Files = {}
  for (const path of paths) {
    const text = await host.readFile(path)
    if (text !== undefined && text !== files[path]) changed[path] = text
  }
  return changed
}
