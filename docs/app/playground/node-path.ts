// `node:path` for ESLint's Linter in the browser. The Linter only splits and joins the file name it is given, so POSIX
// paths are enough. nuxt.config.ts points ESLint's imports of `node:path` here in the client build.

export const sep = '/'
export const delimiter = ':'

export function normalize(path: string): string {
  const absolute = path.startsWith('/')
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop()
    else if (part !== '..' || !absolute) parts.push(part)
  }
  const joined = parts.join('/')
  return absolute ? `/${joined}` : joined || '.'
}

export const join = (...paths: string[]): string => normalize(paths.filter(Boolean).join('/'))
export const isAbsolute = (path: string): boolean => path.startsWith('/')
export const resolve = (...paths: string[]): string => {
  let out = ''
  for (const path of paths) out = isAbsolute(path) ? path : `${out}/${path}`
  return normalize(isAbsolute(out) ? out : `/${out}`)
}

export function dirname(path: string): string {
  const index = path.lastIndexOf('/')
  if (index === -1) return '.'
  return index === 0 ? '/' : path.slice(0, index)
}

export function basename(path: string, extension?: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  return extension && base.endsWith(extension) ? base.slice(0, -extension.length) : base
}

export function extname(path: string): string {
  const base = basename(path)
  const index = base.lastIndexOf('.')
  return index <= 0 ? '' : base.slice(index)
}

export function relative(from: string, to: string): string {
  const a = resolve(from).split('/').filter(Boolean)
  const b = resolve(to).split('/').filter(Boolean)
  let shared = 0
  while (shared < a.length && a[shared] === b[shared]) shared++
  return [...Array.from({ length: a.length - shared }, () => '..'), ...b.slice(shared)].join('/')
}

const path = { sep, delimiter, normalize, join, isAbsolute, resolve, dirname, basename, extname, relative }
export const posix = path
export default { ...path, posix }
