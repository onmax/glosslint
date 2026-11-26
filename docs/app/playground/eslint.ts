// Runs glosslint's ESLint rules with ESLint's own Linter, the browser build that the ESLint playground uses too.
import { Linter } from 'eslint/universal'
import { createRules } from '../../../src/eslint/rules.ts'
import { DEFAULT_IGNORE_CALLEES } from '../../../src/eslint/sites.ts'
import type { Corpus } from '../../../src/types.ts'
import { edit, type Files, type PlaygroundFinding, type QuickFix } from './findings.ts'

/** The files ESLint reads: plain JavaScript, which espree parses in the browser. */
export const SOURCE_FILE = /^src\/.+\.(?:js|mjs)$/

// `glosslint()` in eslint.config.js turns on these four rules at these levels.
function config(corpus: Corpus): Linter.Config[] {
  const settings = { ignoreCallees: DEFAULT_IGNORE_CALLEES, identifierAvoid: false }
  return [{
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { glosslint: { rules: createRules(() => ({ corpus, settings })) } },
    rules: {
      'glosslint/term': 'error',
      'glosslint/avoid': 'error',
      'glosslint/comment': 'error',
      'glosslint/identifier': 'warn',
    },
  }]
}

// `cwd` keeps the Linter from asking for `process.cwd()`, which a browser has not.
const linter = () => new Linter({ cwd: '/' })

export interface EslintRun {
  paths: string[]
  findings: PlaygroundFinding[]
  /** ESLint's parse errors and other messages without a rule, as it prints them. */
  fatal: { file: string, line: number, column: number, message: string }[]
}

export function runEslint(files: Files, corpus: Corpus): EslintRun {
  const paths = Object.keys(files).filter(path => SOURCE_FILE.test(path)).sort()
  const findings: PlaygroundFinding[] = []
  const fatal: EslintRun['fatal'] = []
  const lint = linter()
  const flat = config(corpus)
  for (const path of paths) {
    const text = files[path]!
    for (const message of lint.verify(text, flat, path)) {
      if (!message.ruleId) {
        fatal.push({ file: path, line: message.line, column: message.column, message: message.message })
        continue
      }
      const start = indexOf(text, message.line, message.column)
      const end = message.endLine === undefined ? start : indexOf(text, message.endLine, message.endColumn ?? message.column)
      const fixes: QuickFix[] = []
      if (message.fix)
        fixes.push({ title: `Change to "${message.fix.text}"`, file: path, edits: [edit(text, message.fix.range[0], message.fix.range[1], message.fix.text)] })
      for (const suggestion of message.suggestions ?? [])
        fixes.push({ title: suggestion.desc, file: path, edits: [edit(text, suggestion.fix.range[0], suggestion.fix.range[1], suggestion.fix.text)] })
      findings.push({
        id: `eslint:${path}:${start}:${message.ruleId}`,
        tool: 'eslint',
        source: `eslint(${message.ruleId})`,
        code: message.messageId ?? message.ruleId,
        severity: message.severity === 2 ? 'error' : 'warning',
        file: path,
        line: message.line,
        column: message.column,
        start,
        end,
        text: text.slice(start, end),
        message: message.message,
        fixes,
        autofix: message.fix !== undefined,
      })
    }
  }
  return { paths, findings, fatal }
}

/** `eslint --fix`: the autofixes of every source file. Returns the files that changed. */
export function fixEslint(files: Files, corpus: Corpus): Files {
  const changed: Files = {}
  const lint = linter()
  const flat = config(corpus)
  for (const path of Object.keys(files).filter(path => SOURCE_FILE.test(path))) {
    const { output, fixed } = lint.verifyAndFix(files[path]!, flat, path)
    if (fixed) changed[path] = output
  }
  return changed
}

function indexOf(text: string, line: number, column: number): number {
  let offset = 0
  for (let current = 1; current < line; current++) offset = text.indexOf('\n', offset) + 1
  return offset + column - 1
}
