// `module` for vue-eslint-parser in the browser. It tries to load the project's own espree and eslint-scope, and when
// that throws it uses the copies it bundles, which is what the browser needs.
export function createRequire(): never {
  throw new Error('No require in the browser')
}

export default { createRequire }
