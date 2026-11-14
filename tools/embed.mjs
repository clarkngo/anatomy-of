// Shared by the figures that came from the AI 410 course (rag-pipeline, guardrail, push-chain):
// the same embed as cityuseattle/ai410's figures/embed.mjs, so their build scripts copy over
// almost unchanged, plus page(), which writes the standalone anatomy-of page.
//
// - The figure sits in <div class="iso anatomy-embed" data-anatomy="slug">; its styles use the
//   page tokens below (--surface, --text, ...), mapped here to the kit's own colours.
// - Keys (arrows, F to expand, ...) only act while focus is inside the figure.
//
// node <slug>/build.mjs          writes <slug>/index.html and <slug>/thumb.svg
// node <slug>/build.mjs --dark   writes <slug>/dark.html instead (not committed)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./anatomy/kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");
export { k };

// The kit as plain script source (exports stripped), inlined into the page's module script.
export const kitScript = () => readFileSync(join(HERE, "anatomy", "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");

const ICON_OPEN = `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M1.5 4.5v-3h3M7.5 1.5h3v3M10.5 7.5v3h-3M4.5 10.5h-3v-3"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M4.5 1.5v3h-3M10.5 4.5h-3v-3M7.5 10.5v-3h3M1.5 7.5h3v3"/></svg>`;
export const EXPAND_BUTTON = `<button type="button" class="pc-btn pc-expand" data-expand aria-pressed="false" aria-keyshortcuts="F" aria-label="Expand the figure" title="Expand (F)">${ICON_OPEN}</button>`;

// Shared styles. Every rule is scoped to .anatomy-embed.
const CSS = `
.anatomy-embed{--anatomy-page:var(--surface,#fff);--anatomy-muted:var(--muted,#53695d);--anatomy-text:var(--text,#10231a);margin:22px 0 26px;color:var(--text);font:inherit}
.anatomy-embed .iso-figure{margin:0}
.anatomy-embed{scroll-margin-top:16px}
.anatomy-embed .pc-try{margin:12px 0 0;padding:10px 12px;border-left:3px solid var(--text);background:var(--surface2);border-radius:0 6px 6px 0;color:var(--text);font-size:.96rem}
.anatomy-embed .iso-plate{background:var(--anatomy-card);border:1px solid var(--border,#d3e2d8);border-radius:var(--radius-sm,8px);padding:16px 16px 40px}
.anatomy-embed .iso-plate-corner{color:var(--muted)}
.anatomy-embed .iso-plate-corner[data-corner="fig"],.anatomy-embed .iso-plate-corner[data-corner="readout"]{color:var(--text)}
.anatomy-embed .iso-legend{color:var(--muted);font-size:.92rem}
.anatomy-embed .iso-stage{border-radius:4px}
.anatomy-embed .iso-stage:focus-visible{outline:2px solid var(--link);outline-offset:3px}
.anatomy-embed .iso-stage [data-part]{cursor:pointer}
.anatomy-embed .iso-stage[data-focus] [data-part]:not([data-on]) *{stroke:var(--anatomy-faint)!important}
.anatomy-embed .iso-stage[data-focus] [data-part]:not([data-on]) .iso-fill{fill:var(--anatomy-paper)!important}
.anatomy-embed .iso-stage[data-focus] [data-part]:not([data-on]) .iso-top{fill:var(--anatomy-top)!important}
.anatomy-embed .iso-stage[data-focus] [data-part]:not([data-on]) .iso-shade{fill:var(--anatomy-shade-3)!important}
.anatomy-embed .iso-stage[data-focus] [data-part]:not([data-on]) text{fill:var(--anatomy-faint)!important}
.anatomy-embed .iso-stage[data-focus] [data-part]:not([data-on]) .iso-dots circle{opacity:.1!important}
.anatomy-embed .pc-controls{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:-4px;padding:0 4px 6px;font:12px/1 var(--anatomy-mono);z-index:1}
.anatomy-embed .pc-btn{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 10px;cursor:pointer;min-height:32px;min-width:32px}
.anatomy-embed .pc-btn:hover{border-color:var(--text)}
.anatomy-embed .pc-btn:focus-visible{outline:2px solid var(--link);outline-offset:2px}
.anatomy-embed .pc-btn:disabled{color:var(--muted);opacity:.6;cursor:default}
.anatomy-embed .pc-btn[aria-pressed="true"]{border-color:var(--text);background:var(--surface2)}
.anatomy-embed .pc-group{display:inline-flex;align-items:center;gap:6px;color:var(--text);font-variant-numeric:tabular-nums}
.anatomy-embed .pc-group [data-value]{min-width:44px;text-align:center}
.anatomy-embed .pc-right{margin-left:auto}
.anatomy-embed .pc-dots{display:flex;gap:5px}
.anatomy-embed .pc-dots i{width:7px;height:7px;border:1px solid var(--muted);border-radius:50%}
.anatomy-embed .pc-dots i[data-on]{background:var(--text);border-color:var(--text)}
.anatomy-embed .pc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.anatomy-embed .pc-expand{display:inline-flex;align-items:center;justify-content:center;padding:0}
.anatomy-embed .pc-expand svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.anatomy-embed .iso-figure[data-expanded]{position:fixed;inset:0;z-index:1000;margin:0;padding:16px;background:var(--surface);display:flex;flex-direction:column;justify-content:center;overflow:auto}
.anatomy-embed .iso-figure[data-expanded] .iso-plate{width:100%;max-width:1500px;margin:0 auto}
.anatomy-embed .iso-figure[data-expanded] .iso-svg{max-height:calc(100dvh - 200px)}
.anatomy-embed .iso-figure[data-expanded] .iso-legend{display:none}
.anatomy-embed .pc-parts{margin-top:14px}
.anatomy-embed .pc-parts summary{cursor:pointer;font-weight:600;color:var(--text);padding:6px 0}
.anatomy-embed .pc-parts summary:focus-visible{outline:2px solid var(--link);outline-offset:2px}
.anatomy-embed .pc-parts .tip{font-size:.88rem;color:var(--muted);margin:4px 0 8px}
.anatomy-embed .pc-parts ol{list-style:none;margin:0;padding:0}
.anatomy-embed .pc-parts ol > li{border-top:1px solid var(--border)}
.anatomy-embed .pc-part{display:grid;grid-template-columns:34px 1fr;gap:2px 10px;padding:10px 8px;margin:0 -8px;border-radius:6px;cursor:pointer}
.anatomy-embed .pc-part:hover,.anatomy-embed .pc-part[data-on]{background:var(--surface2)}
.anatomy-embed .pc-part:focus-visible{outline:2px solid var(--link);outline-offset:-2px}
.anatomy-embed .pc-parts .num{grid-row:span 2;font:12px var(--anatomy-mono);color:var(--muted);padding-top:3px}
.anatomy-embed .pc-parts h4{margin:0;font-size:1rem;color:var(--text)}
.anatomy-embed .pc-part p{margin:0;color:var(--muted);font-size:.94rem}
.anatomy-embed .pc-bars{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px;font:12px var(--anatomy-mono);color:var(--muted)}
.anatomy-embed .pc-bars li{display:grid;grid-template-columns:minmax(48px,auto) 1fr 44px;align-items:center;gap:10px;padding:0;margin:0;border:0;cursor:default}
.anatomy-embed .pc-bars li:hover{background:none}
.anatomy-embed .pc-bars i{display:block;height:6px;background:var(--surface2);border:1px solid var(--border);position:relative}
.anatomy-embed .pc-bars i::after{content:"";position:absolute;inset:0 auto 0 0;width:calc(var(--p) * 100%);background:var(--text);transition:width .4s var(--anatomy-ease)}
.anatomy-embed .pc-bars li[data-on] span,.anatomy-embed .pc-bars li[data-on] b{color:var(--text);font-weight:700}
.anatomy-embed .pc-bars b{font-weight:400;text-align:right;color:var(--text);font-variant-numeric:tabular-nums}
@media (max-width:600px){.anatomy-embed .pc-controls{margin-top:6px;padding:0 0 4px}.anatomy-embed .pc-right{margin-left:0}.anatomy-embed .iso-plate{padding:30px 10px 34px}.anatomy-embed .iso-plate-corner[data-corner="hint"],.anatomy-embed .iso-plate-corner[data-corner="title"]{display:none}}
@media (prefers-reduced-motion:reduce){.anatomy-embed .pc-bars i::after{transition:none}}
`;

// Runs first in the figure's module: finds the root, keeps the theme in sync, wires expand.
const PRELUDE = (slug) => `
const ROOT = document.querySelector('[data-anatomy="${slug}"]');
{
  // light unless the reader chose dark with the site's toggle
  const html = document.documentElement;
  const sync = () => ROOT.setAttribute("data-theme", html.getAttribute("data-theme") === "dark" ? "dark" : "light");
  sync();
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["data-theme"] });
}
{
  const figure = ROOT.querySelector(".iso-figure");
  const button = ROOT.querySelector("[data-expand]");
  const stageEl = ROOT.querySelector(".iso-stage");
  const OPEN = ${JSON.stringify(ICON_OPEN)}, CLOSE = ${JSON.stringify(ICON_CLOSE)};
  let expanded = false;
  const setExpanded = (on) => {
    expanded = on;
    if (on) figure.setAttribute("data-expanded", ""); else figure.removeAttribute("data-expanded");
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Close the expanded view" : "Expand the figure");
    button.title = on ? "Close (Esc)" : "Expand (F)";
    button.innerHTML = on ? CLOSE : OPEN;
    html.style.overflow = on ? "hidden" : "";
    if (on) stageEl.focus({ preventScroll: true });
  };
  const html = document.documentElement;
  button.addEventListener("click", () => setExpanded(!expanded));
  // Only while focus is inside the figure; capture phase so Escape closes before it resets.
  ROOT.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); }
    else if ((event.key === "f" || event.key === "F") && event.target.closest(".iso-stage, .pc-controls")) { event.preventDefault(); setExpanded(!expanded); }
  }, true);
}
`;

// Parts list as a collapsible text alternative under the figure.
export function partsHtml(parts, { extra = "", tip = "Point at a part, or focus it, to find it in the figure. Click or press Enter to step the machine to it." } = {}) {
  return `<div class="pc-parts">${extra}<details><summary>The parts (${parts.length}), one by one</summary><p class="tip">${tip}</p><ol>${parts.map(({ id, title, text }, i) => `<li><div class="pc-part" data-select="${id}" tabindex="0" role="button" aria-label="${title}: show it in the figure"><span class="num">${String(i + 1).padStart(2, "0")}</span><h4>${title}</h4><p>${text}</p></div></li>`).join("")}</ol></details></div>`;
}

// The inline block for a lesson: wrapper, styles, plate, parts and one module script.
// The wrapper's id is fig-<slug>, so a lesson can link to it (#fig-rag-pipeline).
// `task` is a one-line "Try this" under the plate.
export function embedHtml({ slug, plate, parts, task = "", css = "", live }) {
  const script = (kitScript() + PRELUDE(slug) + live).replace(/<\/(script)/gi, "<\\/$1");
  return `<div class="iso anatomy-embed" id="fig-${slug}" data-anatomy="${slug}" data-theme="light">
<style>${k.ISO_CSS}${CSS}${css}</style>
${plate}
${task ? `<p class="pc-try"><b>Try this:</b> ${task}</p>` : ""}
${parts}
<script type="module">${script}</script>
</div>`;
}

// The standalone page: nav, title, a one-line lede, the figure and its parts list (open).
const PAGE_CSS = `
*{box-sizing:border-box}
html{color-scheme:light}html[data-theme="dark"]{color-scheme:dark}
body{margin:0;background:var(--anatomy-page);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
/* the embed reads these; the kit's own muted grey is under 4.5:1, so text greys are set here for AA */
.iso{--surface:var(--anatomy-card);--surface2:var(--anatomy-face);--text:#18181a;--muted:#5d5d61;--border:#c9c9cc;--link:#18181a;--radius-sm:0}
.iso[data-theme="dark"]{--text:#e6e6e6;--muted:#a3a3a7;--border:#3a3a3e;--link:#e6e6e6}
.pc-page{width:min(760px,100% - 32px);margin:0 auto;padding:24px 0 64px}
.pc-nav{font:14px/1.4 ui-monospace,Menlo,monospace}
.pc-nav a{color:var(--muted);text-decoration:none}.pc-nav a:hover{color:var(--text)}
.pc-head h1{font:600 34px/1.15 Georgia,serif;margin:28px 0 8px;color:var(--text)}
.pc-head p{margin:0 0 8px;color:var(--muted)}
.pc-head a{color:var(--text)}
`;
const xmlSafe = (text) => text.replace(/ (data-[\w-]+)(?=[\s>\/])/g, ' $1=""');
export function page(slug, html, { title, lede, credit = "" }) {
  const dark = process.argv.includes("--dark"), theme = dark ? "dark" : "light";
  const dir = join(ROOT, slug);
  mkdirSync(dir, { recursive: true });
  const body = `<main class="pc-page iso" data-theme="${theme}"><style>${PAGE_CSS}</style>
<nav class="pc-nav"><a href="../">← anatomy/of</a></nav>
<header class="pc-head"><h1>${title}</h1><p>${lede}</p>${credit ? `<p>${credit}</p>` : ""}</header>
${html.replace("<details>", "<details open>")}
</main>`;
  const out = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${k.ISO_CSS}</style></head><body class="iso" data-theme="${theme}">${body}</body></html>`;
  writeFileSync(join(dir, dark ? "dark.html" : "index.html"), out);
  console.log("wrote", join(slug, dark ? "dark.html" : "index.html"));
  if (dark) return;
  // the home-page thumbnail: the figure's svg on its own, light, with the kit's styles inside
  const svg = html.match(/<svg [^>]*class="iso-svg"[\s\S]*?<\/svg>(?=<\/div>)/)[0]
    .replace('class="iso-svg"', 'class="iso-svg iso" data-theme="light"')
    .replace(/(<svg[^>]*>)/, `$1<style>${k.ISO_CSS}</style>`);
  writeFileSync(join(dir, "thumb.svg"), xmlSafe(svg));
}
