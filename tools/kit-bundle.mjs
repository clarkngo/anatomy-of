// The iso kit and the lathe kit as one in-page object, K, so a page can rebuild
// round parts (lathe) as they move. Both are MIT, vendored in tools/anatomy.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "anatomy", "kit");
const read = (file) => readFileSync(join(KIT, file), "utf8");
const names = (source) => [...source.matchAll(/^export (?:function|const|let|class) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);

export function kitBundle() {
  const iso = read("iso-kit.mjs");
  const lathe = read("lathe.mjs");
  const imported = [...lathe.matchAll(/^import \{([^}]*)\} from "\.\/iso-kit\.mjs";$/gm)].flatMap((m) => m[1].split(",").map((name) => name.trim()));
  const scope = (source, list) => `(() => {\n${source.replace(/^import .*$/gm, "").replace(/^export /gm, "")}\nreturn { ${list.join(", ")} };\n})()`;
  return `const K = (() => {\nconst ISO = ${scope(iso, names(iso))};\nconst { ${imported.join(", ")} } = ISO;\nconst LATHE = ${scope(lathe, names(lathe))};\nreturn { ...ISO, ...LATHE };\n})();\n`;
}
