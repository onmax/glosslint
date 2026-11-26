import { fromGlossary } from "glosslint";

export default fromGlossary(new URL("./.agents/glossary.md", import.meta.url));
