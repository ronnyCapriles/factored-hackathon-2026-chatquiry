// Fails when a locale is missing keys, has extra keys, or drops a {placeholder}.
import { readFileSync } from "node:fs";

const load = (l) => JSON.parse(readFileSync(new URL(`../src/i18n/locales/${l}.json`, import.meta.url)));
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

const source = new Map(flatten(load("es")));
let failed = false;
for (const locale of ["en", "pt"]) {
  const target = new Map(flatten(load(locale)));
  for (const [key, value] of source) {
    if (!target.has(key)) (failed = true), console.error(`${locale}: missing ${key}`);
    else if (vars(value) !== vars(target.get(key))) (failed = true), console.error(`${locale}: placeholders differ in ${key}`);
  }
  for (const key of target.keys()) if (!source.has(key)) (failed = true), console.error(`${locale}: extra ${key}`);
}
if (failed) process.exit(1);
console.log(`i18n ok: ${source.size} keys in es, en, pt`);
