// The toy RAG model behind the figure: the AI 410 Module 2 simulator's own code (same documents,
// tokenizer, synonyms and cosine). docs.json is a copy of that simulator's data
// (cityuseattle/ai410, module-2/simulator.html), so the figure ranks chunks exactly as it does.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { DOCS: docs, STOP, SYN } = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "docs.json"), "utf8"));
export const DOCS = docs;

export function toks(s) { return (s.toLowerCase().match(/[a-z0-9$]+/g) || []).filter((w) => !STOP.includes(w)).map((w) => { w = SYN[w] || w; if (w.length > 4 && /s$/.test(w)) w = w.slice(0, -1); return SYN[w] || w; }); }
export function vec(s) { const v = {}; for (const t of toks(s)) v[t] = (v[t] || 0) + 1; return v; }
export function cos(a, b) { let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] * a[k]; if (b[k]) d += a[k] * b[k]; } for (const k in b) nb += b[k] * b[k]; return na && nb ? d / Math.sqrt(na * nb) : 0; }

// ingest(): the simulator's chunker. Splits on "## Title", then by words with overlap.
export function ingest(size, overlap) {
  const store = [], ov = Math.min(overlap, size - 1), titles = [];
  DOCS.split(/^##\s*/m).filter((s) => s.trim()).forEach((d, di) => {
    const lines = d.split("\n"), title = lines.shift().trim(), words = lines.join(" ").split(/\s+/).filter(Boolean);
    titles.push(title);
    for (let i = 0; i < words.length; i += size - ov) {
      const text = words.slice(i, i + size).join(" ");
      store.push({ doc: title, di, text, v: vec(title + " " + text) });
      if (i + size >= words.length) break;
    }
  });
  return { store, titles };
}

// A short fingerprint for drawing: the vector's words hashed into `n` buckets. Only the picture
// uses it; every score comes from the full cosine above.
export function fingerprint(v, n = 8) {
  const b = new Array(n).fill(0);
  for (const [w, c] of Object.entries(v)) { let h = 7; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0; b[h % n] += c; }
  const top = Math.max(...b, 1);
  return b.map((x) => x / top);
}
