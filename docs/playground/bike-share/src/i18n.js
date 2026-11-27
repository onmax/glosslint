import en from "../locales/en.json";

export const t = (key) => en[key] ?? key;
