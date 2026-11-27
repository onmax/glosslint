// `assert` for vue-eslint-parser in the browser, which checks its own parser state with it.
export default function assert(value: unknown, message?: string): asserts value {
  if (!value) throw new Error(message ?? 'Assertion failed')
}
