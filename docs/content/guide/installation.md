---
title: Installation
description: Install glosslint, write a starter .agents/glossary.md, validate it with doctor, and run your first check.
navigation.order: 2
icon: i-lucide-download
---

```sh pm
pnpm add -D glosslint
```

Requires Node 22.18 or later. ESLint, Oxlint, and `@x18n/core` are optional peer dependencies.

## First setup

::steps
### Write `.agents/glossary.md`

```md [.agents/glossary.md]
# Glossary

Allow: roof rack

## Dock
What: A powered stand where one bike is locked.
Avoid:
- rack: Racks are unpowered.
Good:
- Return the bike to any dock
Bad:
- Return the bike to any rack

## eBike
```

`eBike` defaults to `Case: exact` because of its inner capital. See [The glossary file](/guide/glossary) for every field.

### Validate with `doctor`

```sh
npx glosslint doctor        # check format, values, and Good/Bad examples
npx glosslint doctor --fix  # rewrite layout and field names
```

### Check your docs

```sh
npx glosslint check docs
```

Reads `.md`, `.mdx`, and `.txt` files while skipping `node_modules`, `.git`, `.agents/glossary.md`, frontmatter, and code. Exits `0` when clean, `1` on findings, and `2` on errors.
::

## Next

- [The glossary file](/guide/glossary): format rules and every field.
- [ESLint](/integrations/eslint) and [Oxlint](/integrations/oxlint): check code, comments, and identifiers.
- [x18n](/integrations/x18n): check translations and export the glossary.
- [CLI](/integrations/cli): commands, flags, and example output.
