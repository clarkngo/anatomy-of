// Expanded view, shared by every figure: a button (and the F key) that opens the figure
// full-window with its controls, and Escape (or the button again) to close it.

const ICON_OPEN = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 4.5v-3h3M7.5 1.5h3v3M10.5 7.5v3h-3M4.5 10.5h-3v-3"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 1.5v3h-3M10.5 4.5h-3v-3M7.5 10.5v-3h3M1.5 7.5h3v3"/></svg>`;

export const EXPAND_BUTTON = `<button type="button" class="pc-btn pc-expand" data-expand aria-pressed="false" aria-keyshortcuts="F" aria-label="Expand the figure" title="Expand (F)">${ICON_OPEN}</button>`;

export const EXPAND_CSS = `
.pc-expand{display:inline-flex;align-items:center;justify-content:center;width:32px;padding:0}
.pc-expand svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.iso-figure.iso-figure[data-expanded]{position:fixed;inset:0;z-index:100;margin:0;padding:16px;background:var(--anatomy-page);display:flex;flex-direction:column;justify-content:center;overflow:auto;box-shadow:none}
.iso-figure[data-expanded] .iso-plate{width:100%;max-width:1600px;margin:0 auto}
.iso-figure[data-expanded] .iso-svg{max-height:calc(100dvh - 190px)}
.iso-figure[data-expanded] .iso-legend{display:none}
@media (max-width:600px){.iso-figure.iso-figure[data-expanded]{padding:8px}.iso-figure[data-expanded] .iso-svg{max-height:calc(100dvh - 230px)}}
`;

export const EXPAND_JS = `
{
  const figure = document.querySelector(".iso-figure");
  const button = document.querySelector("[data-expand]");
  const stageEl = document.querySelector(".iso-stage");
  const OPEN = ${JSON.stringify(ICON_OPEN)}, CLOSE = ${JSON.stringify(ICON_CLOSE)};
  let expanded = false;
  const setExpanded = (on) => {
    expanded = on;
    if (on) figure.setAttribute("data-expanded", ""); else figure.removeAttribute("data-expanded");
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Close the expanded view" : "Expand the figure");
    button.title = on ? "Close (Esc)" : "Expand (F)";
    button.innerHTML = on ? CLOSE : OPEN;
    document.documentElement.style.overflow = on ? "hidden" : "";
    if (on) stageEl.focus({ preventScroll: true });
    else figure.scrollIntoView({ block: "nearest" });
  };
  button.addEventListener("click", () => setExpanded(!expanded));
  // Capture phase, so Escape closes the view before the figure treats it as "reset".
  addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); }
    else if (event.key === "f" || event.key === "F") { event.preventDefault(); setExpanded(!expanded); }
  }, true);
}
`;
