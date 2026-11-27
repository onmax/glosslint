// The playground's file tree (Pierre's trees, in a shadow root) rings the focused file on a click as well as from the
// keyboard. The ring stays for keyboard focus only. A rule outside the shadow root can't tell the two apart, since the
// host never matches `:focus-visible`, so each tree gets this rule in its own shadow root.
const css = '[role="treeitem"]:not(:focus-visible)::before { outline-color: transparent !important; }'

export default defineNuxtPlugin(() => {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  const trees = document.getElementsByTagName('file-tree-container')

  const adopt = () => {
    for (const tree of trees) {
      const shadow = tree.shadowRoot
      if (shadow && !shadow.adoptedStyleSheets.includes(sheet)) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet]
    }
  }

  new MutationObserver(adopt).observe(document.body, { childList: true, subtree: true })
  adopt()
})
