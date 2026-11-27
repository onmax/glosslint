// `events` for vue-eslint-parser in the browser. It only registers listeners on an emitter, lists
// their names and emits, and lifts the listener limit, which this emitter doesn't have.
type Listener = (...args: unknown[]) => void

export default class EventEmitter {
  #listeners = new Map<string, Listener[]>()

  on(name: string, listener: Listener): this {
    this.#listeners.set(name, [...this.#listeners.get(name) ?? [], listener])
    return this
  }

  emit(name: string, ...args: unknown[]): boolean {
    const listeners = this.#listeners.get(name)
    for (const listener of listeners ?? []) listener(...args)
    return listeners !== undefined
  }

  setMaxListeners(): this {
    return this
  }

  eventNames(): string[] {
    return [...this.#listeners.keys()]
  }
}
