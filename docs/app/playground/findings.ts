// What the playground's runners report, in one shape for the terminal, the hover card and the Issues tab.

export type Files = Record<string, string>

/** A replacement in a file. `was` is the text it replaces, so a fix never lands on a file that changed since. */
export interface Edit {
  start: number
  end: number
  text: string
  was: string
}

/** A quick fix: its title, as the tool names it, and the edits of one file. */
export interface QuickFix {
  title: string
  file: string
  edits: Edit[]
}

export type Tool = 'glosslint' | 'eslint' | 'x18n'

export interface PlaygroundFinding {
  id: string
  tool: Tool
  /** Where the finding comes from, as VS Code shows it: `eslint(glosslint/term)`. */
  source: string
  code: string
  severity: 'error' | 'warning'
  file: string
  line: number
  column: number
  start: number
  end: number
  text: string
  message: string
  fixes: QuickFix[]
  /** Whether the tool's own `--fix` applies the first fix. */
  autofix: boolean
}

/** A part of an output line: plain text, or text with a style. */
export interface Span {
  start: number
  end: number
  style: 'code' | 'path' | 'mark' | 'dim' | 'error' | 'warning' | 'ok' | 'bold'
}

export interface OutputLine {
  text: string
  spans?: Span[]
  /** The finding the line reports, which the hover card shows. */
  finding?: string
  /** The column that wrapped text starts at, so a long ESLint row wraps under its message. */
  indent?: number
}

export interface CommandOutput {
  command: string
  lines: OutputLine[]
  findings: PlaygroundFinding[]
}

export function lineColumn(text: string, offset: number): { line: number, column: number } {
  let line = 1
  let lineStart = 0
  for (let index = text.indexOf('\n'); index !== -1 && index < offset; index = text.indexOf('\n', index + 1)) {
    line++
    lineStart = index + 1
  }
  return { line, column: offset - lineStart + 1 }
}

/** Applies edits right to left, leaving out one that overlaps an edit already applied. */
export function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = text
  let limit = text.length
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    if (edit.end > limit) continue
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
    limit = edit.start
  }
  return out
}

/** Whether every edit still finds the text it replaces. */
export function applies(text: string | undefined, edits: readonly Edit[]): text is string {
  return text !== undefined && edits.every(edit => text.slice(edit.start, edit.end) === edit.was)
}

export function edit(text: string, start: number, end: number, replace: string): Edit {
  return { start, end, text: replace, was: text.slice(start, end) }
}
