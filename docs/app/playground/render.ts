// The Output and Issues tabs of /playground: every finding of every command, with the line it is on.
import type { DocsRenderFunction } from '@vite-hub/docs/runnable'
import { findAll } from './commands.ts'
import type { Files, PlaygroundFinding } from './findings.ts'

const escape = (text: string) => text.replace(/[&<>"]/g, char => `&#${char.charCodeAt(0)};`)

function lineOf(text: string, finding: PlaygroundFinding): string {
  const start = text.lastIndexOf('\n', finding.start - 1) + 1
  const newline = text.indexOf('\n', finding.start)
  const end = newline === -1 ? text.length : newline
  const to = Math.min(finding.end, end)
  return `${escape(text.slice(start, finding.start))}<mark>${escape(text.slice(finding.start, to))}</mark>${escape(text.slice(to, end))}`
}

function report(files: Files, findings: PlaygroundFinding[]): string {
  if (findings.length === 0) return '<p class="none">No findings. Every file uses the glossary\'s words.</p>'
  const byFile = new Map<string, PlaygroundFinding[]>()
  for (const finding of findings) byFile.set(finding.file, [...byFile.get(finding.file) ?? [], finding])
  return [...byFile].map(([file, inFile]) => `<section><h2>${escape(file)}<span>${inFile.length}</span></h2><ol>${inFile.map(finding => `
    <li class="${finding.severity}">
      <code class="line"><span class="no">${finding.line}</span>${lineOf(files[file] ?? '', finding)}</code>
      <p>${escape(finding.message)}</p>
      <small>${escape(finding.source)}${finding.fixes[0] ? ` · fix: ${escape(finding.fixes[0].title)}` : ''}</small>
    </li>`).join('')}</ol></section>`).join('')
}

const STYLE = `<style>
  body { padding: 1rem; font: 14px/1.5 system-ui, sans-serif; color: #1f2328; }
  h1 { font-size: 15px; margin: 0 0 1rem; color: #59636e; font-weight: 500; }
  h2 { font: 600 13px/1.4 ui-monospace, monospace; margin: 1.25rem 0 .5rem; display: flex; gap: .5rem; align-items: center; }
  h2 span { font: 500 11px/1 system-ui; background: #f6f8fa; border: 1px solid #d1d9e0; border-radius: 99px; padding: 2px 7px; }
  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
  li { border: 1px solid #d1d9e0; border-left: 3px solid #d1242f; border-radius: 6px; padding: .5rem .75rem; }
  li.warning { border-left-color: #bf8700; }
  .line { display: block; font: 13px/1.6 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  .no { color: #8c959f; margin-right: 1ch; user-select: none; }
  mark { background: none; color: inherit; text-decoration: underline wavy #d1242f; text-decoration-skip-ink: none; text-underline-offset: 3px; }
  li.warning mark { text-decoration-color: #bf8700; }
  p { margin: .25rem 0 0; }
  small { color: #59636e; font: 12px/1.4 ui-monospace, monospace; }
  .none { color: #1a7f37; }
</style>`

const render: DocsRenderFunction = async (files) => {
  const { findings } = await findAll(files)
  const counts = `${findings.length} finding${findings.length === 1 ? '' : 's'} in ${new Set(findings.map(finding => finding.file)).size} files. Open the Terminal tab to run each command and fix them.`
  return {
    html: `${STYLE}<h1>${findings.length ? counts : 'Nothing to fix.'}</h1>${report(files, findings)}`,
    issues: findings.map(finding => ({ message: `${finding.message} ${finding.source}`, file: finding.file, line: finding.line })),
  }
}

export default render
