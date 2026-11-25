/** A problem in the corpus or the config, with what to change. */
export class GlosslintConfigError extends Error {
  /** A stable code, such as `GLOSSLINT_DUPLICATE_TERM`. */
  readonly code: string;
  /** Why the config is wrong. */
  readonly why: string;
  /** What to change. */
  readonly fix: string;
  /** The term the problem is in, when it is in one. */
  readonly term?: string;

  constructor(options: { code: string; why: string; fix: string; term?: string }) {
    super(options.term ? `${options.why} (term "${options.term}")` : options.why);
    this.name = "GlosslintConfigError";
    this.code = options.code;
    this.why = options.why;
    this.fix = options.fix;
    if (options.term !== undefined) this.term = options.term;
  }
}
