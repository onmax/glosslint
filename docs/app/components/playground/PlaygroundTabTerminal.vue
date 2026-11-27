<script setup lang="ts">
// The Terminal tab of /playground: buttons that run the commands on the workspace files, their output, and on a
// finding a hover card with its quick fixes, as VS Code shows a TypeScript error.
import { useWorkspace } from '@vite-hub/ui/workspace'
import { doctor, fixAll, lint } from '~/playground/commands'
import { applies, applyEdits, type CommandOutput, type OutputLine, type PlaygroundFinding, type QuickFix } from '~/playground/findings'

type Action = 'lint' | 'doctor'

const { files, setFile, show, showTab } = useWorkspace()

const outputs = ref<CommandOutput[]>([])
const last = ref<Action>()
const busy = ref(false)
const note = ref<string>()
let runs = 0

const findings = computed(() => new Map(outputs.value.flatMap(output => output.findings).map(finding => [finding.id, finding])))
const fixable = computed(() => [...findings.value.values()].filter(finding => finding.autofix).length)

async function run(action: Action, options: { keepNote?: boolean } = {}) {
  const current = ++runs
  busy.value = true
  if (!options.keepNote) note.value = undefined
  try {
    const next = action === 'lint' ? await lint(files.value) : [doctor(files.value)]
    if (current !== runs) return
    outputs.value = next
    last.value = action
  }
  finally {
    if (current === runs) busy.value = false
  }
}

// The output follows the files, as a linter in watch mode does: an edit or a fix runs the last command again.
let timer: ReturnType<typeof setTimeout> | undefined
watch(files, () => {
  if (!last.value) return
  clearTimeout(timer)
  const action = last.value
  timer = setTimeout(() => void run(action, { keepNote: true }), 250)
})
onBeforeUnmount(() => clearTimeout(timer))

async function write(changed: Record<string, string>) {
  for (const [path, text] of Object.entries(changed)) await setFile(path, text)
}

async function fixEverything() {
  hide(true)
  busy.value = true
  const changed = await fixAll(files.value)
  const paths = Object.keys(changed)
  await write(changed)
  note.value = paths.length
    ? `Fixed ${paths.join(', ')}. Avoid words keep a suggestion: hover one to pick it.`
    : 'Nothing left that fixes alone. Hover a finding to pick a suggestion.'
  await run(last.value ?? 'lint', { keepNote: true })
}

async function apply(fix: QuickFix) {
  const text = files.value[fix.file]
  hide(true)
  if (!applies(text, fix.edits)) {
    note.value = `${fix.file} changed since this run, so the fix was not applied. Run the command again.`
    return
  }
  await setFile(fix.file, applyEdits(text, fix.edits))
  show(fix.file)
  note.value = `${fix.title} in ${fix.file}.`
}

// The hover card: it opens on hover or focus of a finding's line, stays while the pointer is on it, and a tap pins it.
const card = ref<{ finding: PlaygroundFinding, top: number, left: number, pinned: boolean }>()
let hideTimer: ReturnType<typeof setTimeout> | undefined

function open(id: string | undefined, event: Event, pinned = false) {
  const finding = id ? findings.value.get(id) : undefined
  const target = (event.currentTarget as HTMLElement | null)?.querySelector('.pg-mark') ?? event.currentTarget
  if (!finding || !(target instanceof HTMLElement)) return
  clearTimeout(hideTimer)
  const box = target.getBoundingClientRect()
  const width = Math.min(480, window.innerWidth - 16)
  card.value = {
    finding,
    top: box.bottom + 4,
    left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
    pinned: pinned || card.value?.pinned === true && card.value.finding.id === id,
  }
}

function hide(now = false) {
  clearTimeout(hideTimer)
  if (now) card.value = undefined
  else if (!card.value?.pinned) hideTimer = setTimeout(() => (card.value = undefined), 200)
}

function toggle(id: string | undefined, event: Event) {
  if (opensFile(event)) {
    const finding = id ? findings.value.get(id) : undefined
    if (finding) reveal(finding.file)
    return
  }
  if (card.value?.pinned && card.value.finding.id === id) return hide(true)
  open(id, event, true)
}

const keep = () => clearTimeout(hideTimer)

// Ctrl+click (Cmd+click on a Mac) on a path, or on a finding, opens its file, as in an editor's terminal. While the key
// is held the paths underline, so they read as links.
const linking = ref(false)
const opensFile = (event: Event) => event instanceof MouseEvent && (event.ctrlKey || event.metaKey)
const pathFile = (text: string) => text.trim().replace(/(?::\d+){1,2}$/, '')

function reveal(path: string) {
  if (!(path in files.value)) return
  hide(true)
  show(path)
}

function openPath(text: string, event: MouseEvent) {
  if (!opensFile(event)) return
  event.stopPropagation()
  reveal(pathFile(text))
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') hide(true)
  linking.value = event.ctrlKey || event.metaKey
}
const onKeyUp = (event: KeyboardEvent) => (linking.value = event.ctrlKey || event.metaKey)
const unlink = () => (linking.value = false)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', unlink)
  window.addEventListener('scroll', closeOnScroll, true)
  // The terminal is what the page is about, so it opens first, over the Output tab of the render runner.
  showTab('terminal')
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', unlink)
  window.removeEventListener('scroll', closeOnScroll, true)
})
function closeOnScroll(event: Event) {
  if (card.value && !(event.target instanceof Node && cardElement.value?.contains(event.target))) hide(true)
}
const cardElement = ref<HTMLElement>()

/** The line of a finding, split around the reported text, for the card's code preview. */
function preview(finding: PlaygroundFinding) {
  const text = files.value[finding.file] ?? ''
  const start = text.lastIndexOf('\n', finding.start - 1) + 1
  const newline = text.indexOf('\n', finding.start)
  const end = newline === -1 ? text.length : newline
  const to = Math.min(Math.max(finding.end, finding.start), end)
  return { before: text.slice(start, finding.start), mark: text.slice(finding.start, to), after: text.slice(to, end) }
}

/** The parts of an output line, with their styles. */
// A hanging indent: the first line starts at the left, the wrapped ones under the message, or less on a narrow screen.
const indent = (line: OutputLine) => line.indent ? { '--pg-indent': `min(${line.indent}ch, 20%)` } : undefined

function parts(line: OutputLine) {
  const out: { text: string, style?: string }[] = []
  let at = 0
  for (const span of [...line.spans ?? []].sort((a, b) => a.start - b.start)) {
    if (span.start > at) out.push({ text: line.text.slice(at, span.start) })
    out.push({ text: line.text.slice(span.start, span.end), style: span.style })
    at = span.end
  }
  if (at < line.text.length) out.push({ text: line.text.slice(at) })
  return out
}

function severityOf(line: OutputLine) {
  return line.finding ? findings.value.get(line.finding)?.severity : undefined
}
</script>

<template>
  <div class="pg-terminal">
    <div class="pg-bar">
      <UButton size="sm" icon="i-lucide-play" label="Lint" :loading="busy && last !== 'doctor'" @click="run('lint')" />
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-stethoscope" label="Doctor" @click="run('doctor')" />
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-wand-sparkles"
        label="Fix all"
        :disabled="busy"
        title="Apply every fix that applies alone, as each tool's --fix does"
        @click="fixEverything"
      />
      <span v-if="last" class="pg-bar-count">{{ findings.size }} finding{{ findings.size === 1 ? '' : 's' }}<template v-if="fixable">, {{ fixable }} fix alone</template></span>
    </div>

    <div class="pg-screen" :class="{ 'is-linking': linking }" role="log" aria-live="polite">
      <template v-if="!last">
        <p class="pg-line"><span class="pg-prompt">$</span> <span class="pg-dim">Lint runs glosslint check, ESLint and x18n on these files. Doctor checks the glossary.</span></p>
        <p class="pg-line pg-dim">Hover a finding to see its fix, as in your editor.</p>
      </template>
      <section v-for="output in outputs" :key="output.command" class="pg-command">
        <p class="pg-line"><span class="pg-prompt">$</span> {{ output.command }}</p>
        <template v-for="(line, index) in output.lines" :key="index">
          <p
            v-if="line.finding"
            class="pg-line pg-finding"
            :class="[`is-${severityOf(line)}`, card?.finding.id === line.finding && 'is-open']"
            :style="indent(line)"
            tabindex="0"
            role="button"
            :aria-label="`${line.text}. Show the fix.`"
            @mouseenter="open(line.finding, $event)"
            @mouseleave="hide()"
            @focus="open(line.finding, $event)"
            @blur="hide()"
            @click="toggle(line.finding, $event)"
            @keydown.enter.prevent="toggle(line.finding, $event)"
          ><span
            v-for="(part, at) in parts(line)"
            :key="at"
            :class="part.style && `pg-${part.style}`"
            :title="part.style === 'path' ? 'Ctrl+click to open' : undefined"
            @click="part.style === 'path' && openPath(part.text, $event)"
          >{{ part.text }}</span></p>
          <p v-else class="pg-line" :style="indent(line)"><span
            v-for="(part, at) in parts(line)"
            :key="at"
            :class="part.style && `pg-${part.style}`"
            :title="part.style === 'path' ? 'Ctrl+click to open' : undefined"
            @click="part.style === 'path' && openPath(part.text, $event)"
          >{{ part.text }}</span></p>
        </template>
      </section>
      <p v-if="note" class="pg-line pg-note">{{ note }}</p>
    </div>

    <Teleport to="body">
      <div
        v-if="card"
        ref="cardElement"
        class="pg-card"
        :class="`is-${card.finding.severity}`"
        role="dialog"
        :aria-label="`${card.finding.code}: quick fixes`"
        :style="{ top: `${card.top}px`, left: `${card.left}px` }"
        @mouseenter="keep"
        @mouseleave="hide()"
      >
        <p class="pg-card-message">{{ card.finding.message }}</p>
        <p class="pg-card-source">{{ card.finding.source }} <button type="button" class="pg-card-link" @click="show(card.finding.file); hide(true)">{{ card.finding.file }}:{{ card.finding.line }}:{{ card.finding.column }}</button></p>
        <pre class="pg-card-code"><span class="pg-card-no">{{ card.finding.line }}</span>{{ preview(card.finding).before }}<span class="pg-squiggle">{{ preview(card.finding).mark }}</span>{{ preview(card.finding).after }}</pre>
        <div class="pg-card-actions">
          <button v-for="fix in card.finding.fixes" :key="fix.title" type="button" class="pg-card-fix" @click="apply(fix)">
            <UIcon name="i-lucide-lightbulb" class="pg-card-bulb" />
            <span><strong>Fix it</strong>: {{ fix.title }}</span>
          </button>
          <span v-if="card.finding.fixes.length === 0" class="pg-card-none">{{ card.finding.tool === 'x18n' ? 'No quick fix: x18n leaves the other word to you.' : 'No quick fix.' }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pg-terminal {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--ui-bg);
}

.pg-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--ui-border);
}

.pg-bar-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}

.pg-screen {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 0.75rem 0.75rem 1.5rem;
  font: 12.5px/1.6 var(--font-mono, ui-monospace, monospace);
  color: var(--ui-text);
}

.pg-command + .pg-command {
  margin-top: 1rem;
}

.pg-line {
  min-height: 1.6em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding-left: var(--pg-indent, 0);
  text-indent: calc(-1 * var(--pg-indent, 0px));
}

.pg-prompt {
  color: var(--ui-success);
  user-select: none;
}

.pg-dim { color: var(--ui-text-muted); }
.pg-bold { font-weight: 600; }
.pg-path { color: var(--ui-info); }
.is-linking .pg-path,
.is-linking .pg-finding {
  cursor: pointer;
}
.is-linking .pg-path:hover,
.is-linking .pg-finding:hover .pg-path {
  text-decoration: underline;
}
.pg-error, .pg-code { color: var(--ui-error); font-weight: 600; }
.pg-warning { color: var(--ui-warning); font-weight: 600; }
.pg-ok { color: var(--ui-success); }

.pg-finding {
  cursor: pointer;
  border-radius: 3px;
  outline: none;
}

.pg-finding:hover,
.pg-finding:focus-visible,
.pg-finding.is-open {
  background: var(--ui-bg-elevated);
}

.pg-finding:focus-visible {
  box-shadow: 0 0 0 1px var(--ui-primary);
}

.pg-mark {
  text-decoration: underline wavy var(--ui-error);
  text-decoration-skip-ink: none;
  text-underline-offset: 3px;
}

.is-warning .pg-mark {
  text-decoration-color: var(--ui-warning);
}

.pg-note {
  margin-top: 1rem;
  white-space: pre-wrap;
  color: var(--ui-text-muted);
}

/* VS Code's hover: a flat box with the message, the source, the code and the quick fixes. */
.pg-card {
  position: fixed;
  z-index: 60;
  width: min(480px, calc(100vw - 16px));
  border: 1px solid var(--ui-border-accented);
  border-radius: 4px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  font: 12.5px/1.5 var(--font-mono, ui-monospace, monospace);
  color: var(--ui-text);
}

.pg-card-message {
  padding: 0.5rem 0.75rem 0;
  white-space: pre-wrap;
}

.pg-card-source {
  padding: 0.125rem 0.75rem 0.5rem;
  color: var(--ui-text-muted);
}

.pg-card-link {
  color: var(--ui-info);
  cursor: pointer;
}

.pg-card-link:hover {
  text-decoration: underline;
}

.pg-card-code {
  margin: 0;
  padding: 0.375rem 0.75rem;
  overflow-x: auto;
  border-block: 1px solid var(--ui-border);
  background: var(--ui-bg);
  font: inherit;
}

.pg-card-no {
  display: inline-block;
  min-width: 2ch;
  margin-right: 1ch;
  color: var(--ui-text-dimmed);
  text-align: right;
  user-select: none;
}

.pg-squiggle {
  text-decoration: underline wavy var(--ui-error);
  text-decoration-skip-ink: none;
  text-underline-offset: 3px;
}

.is-warning .pg-squiggle {
  text-decoration-color: var(--ui-warning);
}

.pg-card-actions {
  display: flex;
  flex-direction: column;
  padding: 0.25rem;
}

.pg-card-fix {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  color: var(--ui-text);
  text-align: left;
  cursor: pointer;
}

.pg-card-fix:hover,
.pg-card-fix:focus-visible {
  background: var(--ui-bg-accented);
  outline: none;
}

.pg-card-fix strong {
  color: var(--ui-info);
  font-weight: 600;
}

.pg-card-bulb {
  flex: none;
  color: var(--ui-warning);
}

.pg-card-none {
  padding: 0.25rem 0.5rem;
  color: var(--ui-text-muted);
}
</style>
