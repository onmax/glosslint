// vue-eslint-parser requires `eslint` only to parse custom blocks such as <i18n>, which the playground doesn't lint.
// The Node build of ESLint can't load in a browser, so that require gets this empty module.
export default {}
