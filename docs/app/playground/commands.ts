// The playground's commands: `glosslint check`, `eslint`, `x18n check` and `glosslint doctor`, run in the page on the
// workspace files with glosslint's own modules, and their output as the terminal prints it.
import { checkFileText } from '../../../src/check-text.ts'
import { formatDoctor, formatFinding, formatFindings } from '../../../src/format.ts'
import { DEFAULT_GLOSSARY, readGlossary } from '../../../src/glossary-text.ts'
import { createMatcher } from '../../../src/matcher.ts'
import type { CliFinding, Corpus } from '../../../src/types.ts'
import { applyEdits, edit, type CommandOutput, type Files, type OutputLine, type PlaygroundFinding, type Span } from './findings.ts'
import { fixX18n, runX18n } from './x18n.ts'

export const GLOSSARY = DEFAULT_GLOSSARY
/** What `glosslint check docs` reads: Markdown, MDX and text files in `docs/`. */
const DOC_FILE = /^docs\/.+\.(?:md|mdx|txt)$/

// ESLint and its rule registry are the largest part, so they load when a command first needs them. The playground runs
// only in the browser, and the server build leaves ESLint out of the Worker.
const eslint = () => import.meta.server
  ? Promise.reject(new Error('The playground runs ESLint in the browser.'))
  : import('./eslint.ts')

function glossary(files: Files) {
  const text = files[GLOSSARY]
  return text === undefined ? undefined : readGlossary(text)
}

/** The corpus of the glossary, or the output that says why there is none, as the CLI prints it. */
function corpusOr(files: Files, command: string): { corpus: Corpus } | { output: CommandOutput } {
  const result = glossary(files)
  if (result?.corpus) return { corpus: result.corpus }
  const lines = result
    ? doctorLines(files, result.problems.filter(problem => !problem.fixable), 0, false).lines
    : [line(`No glossary at ${GLOSSARY}. Add one with a "# Glossary" heading and a "## Term" section per term.`, [{ start: 0, end: 11, style: 'error' }])]
  return { output: { command, lines, findings: [] } }
}

const line = (text: string, spans?: Span[], finding?: string): OutputLine => ({ text, spans, finding })

/** A tree block of the CLI's text format, with its headline styled and marked as the finding's line. */
function treeLines(block: string, finding: string, code: string, quoted: string | undefined): OutputLine[] {
  return block.split('\n').map((text, index) => {
    if (index === 0) {
      const spans: Span[] = [{ start: 0, end: code.length + 2, style: 'error' }]
      if (quoted !== undefined) spans.push({ start: code.length + 4, end: code.length + 4 + quoted.length, style: 'mark' })
      const at = text.lastIndexOf(' ')
      spans.push({ start: at + 1, end: text.length, style: 'path' })
      return line(text, spans, finding)
    }
    const colon = text.indexOf(':')
    return line(text, [{ start: 0, end: 2, style: 'dim' }, { start: 3, end: colon + 1, style: 'bold' }])
  })
}

function summaryLine(text: string, failed: boolean): OutputLine {
  return line(text, [{ start: 0, end: text.length, style: failed ? 'bold' : 'ok' }])
}

function fromCli(finding: CliFinding, text: string): PlaygroundFinding {
  const fixes = finding.fix
    ? [{ title: `${finding.fix.kind === 'autofix' ? 'Change to' : 'Use'} "${finding.fix.replace}"`, file: finding.file, edits: [edit(text, finding.start, finding.end, finding.fix.replace)] }]
    : []
  return {
    id: `glosslint:${finding.file}:${finding.start}:${finding.code}`,
    tool: 'glosslint',
    source: `glosslint(${finding.code})`,
    code: finding.code,
    severity: 'error',
    file: finding.file,
    line: finding.line,
    column: finding.column,
    start: finding.start,
    end: finding.end,
    text: finding.text,
    message: finding.message,
    fixes,
    autofix: finding.fix?.kind === 'autofix',
  }
}

/** `glosslint check docs`. */
export function check(files: Files): CommandOutput {
  const command = 'npx glosslint check docs'
  const loaded = corpusOr(files, command)
  if ('output' in loaded) return loaded.output
  const matcher = createMatcher(loaded.corpus)
  const paths = Object.keys(files).filter(path => DOC_FILE.test(path)).sort()
  const found = paths.flatMap(path => checkFileText(matcher, files[path]!, path, { markdown: !path.endsWith('.txt'), mdx: path.endsWith('.mdx') }))
  const findings = found.map(finding => fromCli(finding, files[finding.file]!))
  const lines: OutputLine[] = []
  for (const [index, finding] of found.entries()) {
    lines.push(...treeLines(formatFinding(finding), findings[index]!.id, finding.code, finding.text), line(''))
  }
  // The summary is the last block of the CLI's own output.
  lines.push(summaryLine(formatFindings(found, { files: paths.length }).split('\n\n').at(-1)!, found.length > 0))
  return { command, lines, findings }
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Rows of ESLint's `stylish` format: position, severity, message and rule, in columns. */
function rows(findings: PlaygroundFinding[], rule: (finding: PlaygroundFinding) => string): OutputLine[] {
  const position = (finding: PlaygroundFinding) => `${finding.line}:${finding.column}`
  const widths = [
    Math.max(...findings.map(finding => position(finding).length)),
    Math.max(...findings.map(finding => finding.severity.length)),
    Math.max(...findings.map(finding => finding.message.length)),
  ]
  return findings.map((finding) => {
    const cells = [position(finding).padEnd(widths[0]!), finding.severity.padEnd(widths[1]!), finding.message.padEnd(widths[2]!), rule(finding)]
    const text = `  ${cells.join('  ')}`
    const at = (cell: number) => 2 + cells.slice(0, cell).reduce((sum, value) => sum + value.length + 2, 0)
    return {
      ...line(text.trimEnd(), [
        { start: at(0), end: at(0) + position(finding).length, style: 'dim' },
        { start: at(1), end: at(1) + finding.severity.length, style: finding.severity },
        { start: at(2), end: at(2) + finding.message.length, style: 'mark' },
        { start: at(3), end: at(3) + rule(finding).length, style: 'dim' },
      ], finding.id),
      indent: at(2),
    }
  })
}

function byFile(findings: PlaygroundFinding[]): Map<string, PlaygroundFinding[]> {
  const files = new Map<string, PlaygroundFinding[]>()
  for (const finding of findings) files.set(finding.file, [...files.get(finding.file) ?? [], finding])
  return files
}

/** `eslint src`, with `glosslint()` in the config, in ESLint's default `stylish` format. */
export async function lintSource(files: Files): Promise<CommandOutput> {
  const command = 'npx eslint src'
  const loaded = corpusOr(files, command)
  if ('output' in loaded) return loaded.output
  const { findings, fatal } = (await eslint()).runEslint(files, loaded.corpus)
  const lines: OutputLine[] = []
  for (const [file, inFile] of byFile(findings)) {
    lines.push(line(''), line(file, [{ start: 0, end: file.length, style: 'path' }]), ...rows(inFile, finding => finding.source.slice(7, -1)))
  }
  for (const problem of fatal)
    lines.push(line(''), line(problem.file, [{ start: 0, end: problem.file.length, style: 'path' }]), line(`  ${problem.line}:${problem.column}  error  ${problem.message}`, [{ start: 2, end: 2 + `${problem.line}:${problem.column}`.length, style: 'dim' }]))
  const errors = findings.filter(finding => finding.severity === 'error').length + fatal.length
  const warnings = findings.length + fatal.length - errors
  if (errors + warnings === 0) {
    lines.push(line('ESLint printed nothing: no problems.', [{ start: 0, end: 36, style: 'dim' }]))
    return { command, lines, findings }
  }
  const total = `✖ ${plural(errors + warnings, 'problem')} (${plural(errors, 'error')}, ${plural(warnings, 'warning')})`
  lines.push(line(''), line(total, [{ start: 0, end: total.length, style: errors ? 'error' : 'warning' }]))
  const autofixable = autofixes(findings)
  if (autofixable.errors + autofixable.warnings > 0) {
    const text = `  ${plural(autofixable.errors, 'error')} and ${plural(autofixable.warnings, 'warning')} potentially fixable with the \`--fix\` option.`
    lines.push(line(text, [{ start: 0, end: text.length, style: errors ? 'error' : 'warning' }]))
  }
  return { command, lines, findings }
}

/** ESLint counts a message as fixable when it has a `fix`. */
function autofixes(findings: PlaygroundFinding[]) {
  const fixable = findings.filter(finding => finding.autofix)
  return { errors: fixable.filter(finding => finding.severity === 'error').length, warnings: fixable.filter(finding => finding.severity === 'warning').length }
}

/** `x18n check`, with glosslint's plugin, on the source locale. */
export async function checkMessages(files: Files): Promise<CommandOutput> {
  const command = 'npx x18n check'
  const loaded = corpusOr(files, command)
  if ('output' in loaded) return loaded.output
  const { findings, fixable } = await runX18n(files, loaded.corpus)
  const lines: OutputLine[] = []
  for (const [file, inFile] of byFile(findings)) {
    lines.push(line(''), line(file, [{ start: 0, end: file.length, style: 'path' }]), ...rows(inFile, finding => finding.code))
  }
  const errors = findings.filter(finding => finding.severity === 'error').length
  const total = findings.length === 0
    ? 'No problems.'
    : `${plural(findings.length, 'problem')} (${plural(errors, 'error')}, ${plural(findings.length - errors, 'warning')}), ${fixable} fixable with --fix.`
  lines.push(line(''), summaryLine(total, findings.length > 0))
  return { command, lines, findings }
}

/** Every lint command, in the order the terminal runs them. */
export async function lint(files: Files): Promise<CommandOutput[]> {
  return [check(files), await lintSource(files), await checkMessages(files)]
}

function doctorLines(files: Files, problems: ReturnType<typeof readGlossary>['problems'], fixed: number, rewritable: boolean, fixedText?: string) {
  const text = files[GLOSSARY] ?? ''
  const findings: PlaygroundFinding[] = []
  const lines: OutputLine[] = []
  const blocks = formatDoctor({ file: GLOSSARY, problems, fixed, rewritable }).split('\n\n')
  for (const [index, problem] of problems.entries()) {
    let start = 0
    for (let current = 1; current < problem.line; current++) start = text.indexOf('\n', start) + 1
    const end = text.indexOf('\n', start) === -1 ? text.length : text.indexOf('\n', start)
    const finding: PlaygroundFinding = {
      id: `doctor:${problem.code}:${problem.line}`,
      tool: 'glosslint',
      source: 'glosslint doctor',
      code: problem.code,
      severity: 'error',
      file: GLOSSARY,
      line: problem.line,
      column: 1,
      start,
      end,
      text: text.slice(start, end),
      message: `${problem.why} ${problem.fix}`,
      // `doctor --fix` rewrites the whole file in its canonical form, so its quick fix is that rewrite.
      fixes: problem.fixable && fixedText !== undefined ? [{ title: problem.fix.replace(/\.$/, ''), file: GLOSSARY, edits: [edit(text, 0, text.length, fixedText)] }] : [],
      autofix: problem.fixable && fixedText !== undefined,
    }
    findings.push(finding)
    lines.push(...treeLines(blocks[index]!, finding.id, problem.code, undefined), line(''))
  }
  lines.push(summaryLine(blocks.at(-1)!, problems.length > 0))
  return { lines, findings }
}

/** `glosslint doctor`, and with `fix`, `glosslint doctor --fix`, which returns the rewritten glossary in `fixed`. */
export function doctor(files: Files, fix = false): CommandOutput & { fixed?: string } {
  const command = `npx glosslint doctor${fix ? ' --fix' : ''}`
  let result = glossary(files)
  if (!result) {
    const text = `No glossary at ${GLOSSARY}.`
    return { command, lines: [line(text, [{ start: 0, end: text.length, style: 'error' }])], findings: [] }
  }
  let fixed = 0
  let fixedText: string | undefined
  if (fix && result.fixed !== undefined) {
    fixed = result.problems.filter(problem => problem.fixable).length
    fixedText = result.fixed
    result = readGlossary(result.fixed)
  }
  const files_ = fixedText === undefined ? files : { ...files, [GLOSSARY]: fixedText }
  const out = doctorLines(files_, result.problems, fixed, result.fixed !== undefined, result.fixed)
  return { command, ...out, fixed: fixedText }
}

/**
 * Every fix that applies alone: `eslint --fix`, `x18n check --fix` and `glosslint doctor --fix`, and the autofixes of
 * the Markdown findings, which an editor applies one by one since `glosslint check` never edits a file.
 */
export async function fixAll(files: Files): Promise<Files> {
  const changed: Files = {}
  const fixedGlossary = doctor(files, true).fixed
  if (fixedGlossary !== undefined && fixedGlossary !== files[GLOSSARY]) changed[GLOSSARY] = fixedGlossary
  const next = { ...files, ...changed }
  const loaded = corpusOr(next, '')
  if ('output' in loaded) return changed
  Object.assign(changed, (await eslint()).fixEslint(next, loaded.corpus), await fixX18n(next, loaded.corpus))
  const matcher = createMatcher(loaded.corpus)
  for (const path of Object.keys(next).filter(path => DOC_FILE.test(path))) {
    const text = next[path]!
    const autofix = checkFileText(matcher, text, path, { markdown: !path.endsWith('.txt'), mdx: path.endsWith('.mdx') })
      .filter(finding => finding.fix?.kind === 'autofix')
      .map(finding => edit(text, finding.start, finding.end, finding.fix!.replace))
    if (autofix.length > 0) changed[path] = applyEdits(text, autofix)
  }
  return changed
}

/** Every finding of every command, for the Output and Issues tabs. */
export async function findAll(files: Files): Promise<{ outputs: CommandOutput[], findings: PlaygroundFinding[] }> {
  const outputs = [...await lint(files), doctor(files)]
  return { outputs, findings: outputs.flatMap(output => output.findings) }
}
