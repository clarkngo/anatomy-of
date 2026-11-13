// Anatomy of a pencil: builds pencil/index.html (light) or pencil/dark.html (--dark).
// Uses the Anatomy kit (MIT, vendored in tools/anatomy). World units are millimetres.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../tools/anatomy/kit/lathe.mjs";
import { kitScript } from "../tools/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

// ---------- the model: a new, unsharpened HB pencil ----------
const PENCIL = {
  length: 190, // overall, eraser included
  body: 170, // painted hexagonal body
  flats: 7, // across flats
  core: 2, // core diameter
  shoulder: [170, 176], // wood turned down to take the ferrule
  ferrule: [170, 181],
  eraser: [176, 190], // 5 mm plug inside the ferrule, 9 mm showing
  grade: "HB",
};
const APO = PENCIL.flats / 2; // hexagon apothem
const RAD = APO / Math.cos(Math.PI / 6); // hexagon corner radius
const CORE_R = PENCIL.core / 2;
const SH_R = 3.3;
const FER_R = 3.85;
const ER_R = SH_R;
const GROOVE = CORE_R + 0.05;

const W = 600;
const H = 300;
const X0 = 100; // the pencil's cut end, s = 0
const ZC = 14; // height of the pencil's axis
const F = G.frameOf([X0, 0, ZC], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);

// Assemblies, in the order they leave: each one's way off is clear before the next moves.
const PIECES = {
  eraser: { move: [-38, 0, 0], name: "Eraser" },
  ferrule: { move: [-30, 0, 0], name: "Ferrule" },
  upper: { move: [0, 0, 16], name: "Upper slat" },
  core: { move: [0, 0, 8], name: "Core" },
};
const STAGGER = ["eraser", "ferrule", "upper", "core"];
const SPRING = { stagger: 0.35, stiffness: 110, damping: 20, substeps: 4 };

const PLATE = { x: -142, y: -26, w: 256, d: 52, r: 7 };
const PLATE_H = 9;
const FOOT_H = 5;
const CRADLES = [28, 142].map((s) => X0 - s);
const CRADLE_TOP = ZC - APO;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [X0, RAD, ZC + APO + 17], [X0 - PENCIL.length, -RAD, ZC + APO + 17]],
  W,
  H,
  { pad: 22, azimuth: 62 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(...a) - depth(...b));
const onF = (s, u, v) => [F.o[0] + F.a[0] * s + F.u[0] * u + F.v[0] * v, F.o[1] + F.a[1] * s + F.u[1] * u + F.v[1] * v, F.o[2] + F.a[2] * s + F.u[2] * u + F.v[2] * v];
const pathAt = (points) => k.pathOf(points.map(at));

const UPPER_HEX = [[RAD, 0], [RAD / 2, APO], [-RAD / 2, APO], [-RAD, 0]];
const LOWER_HEX = [[-RAD, 0], [-RAD / 2, -APO], [RAD / 2, -APO], [RAD, 0]];
const halfDisc = (r, upper, steps = 28) => Array.from({ length: steps + 1 }, (_, i) => {
  const t = (upper ? 0 : Math.PI) + (Math.PI * i) / steps;
  return [r * Math.cos(t), r * Math.sin(t)];
});
// The lacquer coat seen in section on the cut end: the hexagon inset by the paint's thickness.
const lacquer = (half, inset = 0.6) => pathAt(half.map(([u, v]) => onF(0, (u * (APO - inset)) / APO, (v * (APO - inset)) / APO)));
const grooveLines = (s0, s1) => pathAt([onF(s0, -GROOVE, 0), onF(s1, -GROOVE, 0)]) + pathAt([onF(s0, GROOVE, 0), onF(s1, GROOVE, 0)]);

// ---------- bench plate ----------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // Millimetre rule under the pencil, zero at its cut end.
  const strip = { x: X0 - PENCIL.length - 4, y: 17, w: PENCIL.length + 8, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(X0 - PENCIL.length, X0, 2, 5, strip.y + 0.6, 0.6, [1.6, 3.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 4.4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4.4, 0.6])], { size: 0.4 }));

  // Label plate with three rule lines.
  const label = { x: -136, y: 9, w: 30, d: 12, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(L([[4, 14], [6.5, 20], [9, 11]].map(([dy, len]) => k.lineOnTop([label.x + 5, label.y + dy], [label.x + 5 + len, label.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.6, label.y + 2.6, 0.8]), at([label.x + label.w - 2.6, label.y + label.d - 2.6, 0.8])], { size: 0.4 }));
  return out.join("");
}

function fence() {
  const rail = { x: -128, y: -22, w: 236, d: 5, r: 1.2 };
  const out = [S(k.slabOf(rail, 0, 7, P, 3, 0.5), { tone: "mid" })];
  out.push(D([-118, -59, 0, 59, 98].map((x) => at([x, rail.y + 2.5, 7])), { size: 0.45 }));
  return out.join("");
}

function cradle(cx, front) {
  const out = [];
  const block = { x: cx - 8, y: -9, w: 16, d: 18, r: 1.5 };
  if (!front) {
    out.push(S(k.slabOf(block, 0, CRADLE_TOP, P, 3, 0.6), { tone: "mid" }));
    out.push(L(k.sideSeam(block, 3, P, 3), { tone: "faint" }));
    out.push(D([[cx - 5.5, -6.5], [cx + 5.5, -6.5], [cx - 5.5, 6.5], [cx + 5.5, 6.5]].map(([x, y]) => at([x, y, CRADLE_TOP])), { size: 0.45 }));
    // lock knob on the front face
    out.push(S(k.slabOf({ x: cx - 1.4, y: 9, w: 2.8, d: 2.6, r: 0.8 }, 3.4, 3.4, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(cx, 13.6, 2.8, 2, 6.4, P, 22), { tone: "mid" }));
    out.push(L(k.knurl(cx, 13.6, 2.8, 2, 8.4, 20, P), { tone: "lo" }));
    out.push(D([at([cx, 13.6, 8.4])], { size: 0.5, tone: "hi" }));
    // guide pin behind the pencil
    out.push(S(k.cylinder(cx, -5.4, 0.9, CRADLE_TOP, 2.6, P, 14), { tone: "hi" }));
  } else {
    out.push(S(k.cylinder(cx, 5.4, 0.9, CRADLE_TOP, 2.6, P, 14), { tone: "hi" }));
  }
  return out.join("");
}

// ---------- the pencil ----------
function eraser() {
  const [s0, s1] = PENCIL.eraser;
  return S(G.solidOf([[s0, ER_R], [s1 - 1.6, ER_R, 1], [s1 - 0.6, ER_R - 0.9, 1], [s1, 0]], F, P), { tone: "hi" });
}

function shoulder(upper) {
  const [s0, s1] = PENCIL.shoulder;
  const inner = upper ? "" : L(grooveLines(s0, s1), { tone: "faint" });
  return S(G.prismOf(F, halfDisc(SH_R, upper), s0, s1, P), { tone: "hi", inner });
}

function ferrule() {
  const [s0, s1] = PENCIL.ferrule;
  const seams = [s0 + 1.6, s0 + 2.6, s1 - 2.6, s1 - 1.6].map((s) => G.arcOf(F, s, FER_R, P)).join("");
  const ribs = G.ribsOf(F, s0 + 4, s1 - 4, FER_R, 18, P, { seams: true });
  return S(G.ringBand(s0, s1, SH_R, FER_R, F, P), { tone: "hi", inner: L(seams, { tone: "lo" }) + L(ribs, { tone: "faint" }) });
}

function slat(upper) {
  const paths = G.prismOf(F, upper ? UPPER_HEX : LOWER_HEX, 0, PENCIL.body, P);
  const lines = [L(lacquer(upper ? UPPER_HEX : LOWER_HEX), { tone: "lo" })];
  if (!upper) lines.push(L(grooveLines(0, PENCIL.body), { tone: "faint" }));
  let text = "";
  if (upper) text = k.faceTextSvg(k.topMatrix([X0 - 64, 0.9], ZC + APO, P, "x"), PENCIL.grade, { size: 2.2, tone: "lo" });
  return { paths, svg: S(paths, { tone: "hi", inner: lines.join("") }) + text };
}

const lower = slat(false);
const lowerShoulder = G.prismOf(F, halfDisc(SH_R, false), ...PENCIL.shoulder, P);
const upperSlat = slat(true);

// The core lies in the groove: whatever is below the slat's top face stays hidden behind it.
const mask = `<defs><mask id="pc-groove" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${lower.paths.fill}" fill="#000"/><path d="${lowerShoulder.fill}" fill="#000"/><path d="${lower.paths.top}" fill="#fff"/><path d="${lowerShoulder.top}" fill="#fff"/></mask></defs>`;
const coreBody = S(G.disc(0, PENCIL.shoulder[1], CORE_R, F, P), { tone: "hi", lit: true, crease: "none" });
const coreCap = S(G.disc(0, 0.05, CORE_R, F, P, { steps: 24 }), { tone: "hi", lit: true, crease: "none" });

const moving = (id, svg, extra = "") => {
  const [mx, my, mz] = PIECES[id].move;
  return `<g data-move="${id}" data-m="${mx},${my},${mz}"${extra}>${svg}</g>`;
};

const FIGURE_LABEL =
  "A new, unsharpened HB pencil lying in two cradles on a bench plate, over a millimetre rule. Taken apart, the eraser and the aluminium ferrule slide off its end, the upper cedar slat lifts away, and the thin graphite core rises out of the groove in the lower slat.";
const BODY = [
    mask,
    plate(),
    fence(),
    ...CRADLES.map((cx) => cradle(cx, false)),
    moving("eraser", eraser()),
    shoulder(false),
    moving("upper", shoulder(true)),
    moving("ferrule", ferrule()),
    lower.svg,
    ...CRADLES.map((cx) => cradle(cx, true)),
    `<g mask="url(#pc-groove)">${moving("core", coreBody, ' data-core-body="" style="visibility:hidden"')}</g>`,
    moving("upper", upperSlat.svg),
    moving("core", coreCap),
  ];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });
// A still of the assembled pencil for the home page.
if (theme === "light") writeFileSync(join(HERE, "thumb.svg"), k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY, standalone: "light" }).replace("<style>", "<style>[data-lit]>.iso-fill{fill:#3d3d3b}[data-lit]>.iso-top{fill:#5a5a57;stroke:#5a5a57}[data-lit]>.iso-shade{fill:#2f2f2d;stroke:#2f2f2d}"));

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = { EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]), stagger: STAGGER, spring: SPRING, length: PENCIL.length, grade: PENCIL.grade };

const live = `
const D = ${JSON.stringify(DATA)};
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const nodes = [...stage.querySelectorAll("[data-move]")].map((el) => ({ el, id: el.dataset.move, m: el.dataset.m.split(",").map(Number), shown: "" }));
const coreBody = stage.querySelector("[data-core-body]");
const piece = Object.fromEntries(D.stagger.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
let clock = 0, apart = false, touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0;

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? D.stagger : [...D.stagger].reverse()) {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * D.spring.stagger) };
  }
  run();
}

function steer(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) { state.target = state.pending.value; state.pending = null; }
  if (calm) { state.x = state.target; state.v = 0; return state.pending !== null; }
  for (let i = 0; i < D.spring.substeps; i++) {
    const h = dt / D.spring.substeps;
    state.v += ((state.target - state.x) * D.spring.stiffness - state.v * D.spring.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) { state.x = state.target; state.v = 0; return state.pending !== null; }
  return true;
}

function place() {
  for (const node of nodes) {
    const share = piece[node.id].x;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = share === 0 ? "" : "translate(" + tx.toFixed(2) + " " + ty.toFixed(2) + ")";
    if (text !== node.shown) { node.shown = text; if (text) node.el.setAttribute("transform", text); else node.el.removeAttribute("transform"); }
  }
  const open = piece.upper.x > 0.03 || piece.core.x > 0.03;
  coreBody.style.visibility = open ? "visible" : "hidden";
  const shares = D.stagger.map((id) => piece[id].x);
  const text = shares.every((x) => x === 0) ? "assembled · " + D.length + " mm · " + D.grade
    : shares.every((x) => x === 1) ? "apart · 5 parts"
    : apart ? "taking apart" : "putting together";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-pressed", apart ? "true" : "false");
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) { tourClock += dt; setApart(Math.floor(tourClock / 3.6) % 2 === 1); }
  let busy = false;
  for (const id of D.stagger) busy = steer(piece[id], dt, still.matches) || busy;
  place();
  frame = visible && (busy || touring) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
function takeOver(on) {
  touring = false;
  clearTimeout(idleTimer);
  setApart(on);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; tourClock = apart ? 3.6 : 0; run(); } }, 5000);
}

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") takeOver(true); });
stage.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") takeOver(false); });
stage.addEventListener("pointerdown", (event) => { if (event.pointerType !== "mouse") takeOver(!apart); });
stage.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter" || event.key === "e" || event.key === "E") { event.preventDefault(); takeOver(!apart); }
  if (event.key === "Escape") takeOver(false);
});
place();
`;

const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Pencil · HB",
  hint: "Hover or press E to take apart",
  readout: `assembled · ${PENCIL.length} mm · ${PENCIL.grade}`,
  keys: [
    { mark: "lit", label: "The core: graphite and clay, the only part that writes" },
    { mark: "raised", label: "Cedar slats, ferrule and eraser: everything that holds it" },
  ],
  caption: `A new ${PENCIL.grade} pencil, ${PENCIL.length} mm long and ${PENCIL.flats} mm across the flats. Its ${PENCIL.core} mm core is glued into grooves between two cedar slats, and a lacquer coat seals the hexagonal body. At the far end the wood is turned down to a shoulder, and an aluminium ferrule is crimped over it and over the eraser's plug.`,
  body: `<div class="iso-stage" tabindex="0" role="button" aria-pressed="false" aria-label="Pencil: hover, tap, or press E to take it apart and put it back together">${svg}</div>`,
});

const PARTS = [
  ["Core", "Not lead. It's graphite mixed with clay and fired. More clay makes a harder, lighter line (the H grades), and more graphite a softer, darker one (the B grades). HB sits in the middle."],
  ["Casing", "Two slats of cedar, picked because it sharpens cleanly without splitting. Each slat has a groove, the core is glued between them, and the sandwich is cut into pencils."],
  ["Finish", "Several coats of lacquer seal the wood against moisture and give the grip its feel. The hexagon keeps the pencil from rolling off the desk."],
  ["Ferrule", "A crimped aluminium band that joins two materials that won't glue well: wood and rubber. The wood is turned down to a shoulder so the band sits flush."],
  ["Eraser", "A plug of rubber or vinyl. It works by being slightly stickier than paper, so graphite particles cling to it instead."],
];

const ARTICLE_CSS = `
[data-theme="light"] .iso-svg [data-lit]>.iso-fill{fill:#3d3d3b}
[data-theme="light"] .iso-svg [data-lit]>.iso-top{fill:#5a5a57;stroke:#5a5a57}
[data-theme="light"] .iso-svg [data-lit]>.iso-shade{fill:#2f2f2d;stroke:#2f2f2d}
.pc-nav{max-width:650px;margin:0 auto;padding:24px 16px 0;font:14px/1.4 ui-monospace,Menlo,monospace}
.pc-nav a{color:var(--anatomy-muted);text-decoration:none}.pc-nav a:hover{color:var(--anatomy-text)}
.pc-head,.pc-parts{max-width:650px;margin:0 auto;padding:0 16px;color:var(--anatomy-text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.pc-head h1{font:600 34px/1.15 Georgia,serif;margin:28px 0 8px;color:var(--anatomy-strong)}
.pc-head p{margin:0 0 8px;color:var(--anatomy-muted)}
.pc-parts{padding-bottom:64px}.pc-parts ol{list-style:none;margin:0;padding:0;counter-reset:p}
.pc-parts li{counter-increment:p;display:grid;grid-template-columns:40px 1fr;gap:2px 12px;padding:16px 0;border-top:1px solid color-mix(in srgb,var(--anatomy-muted) 30%,transparent)}
.pc-parts li::before{content:counter(p,decimal-leading-zero);grid-row:span 2;font:13px ui-monospace,Menlo,monospace;color:var(--anatomy-muted);padding-top:3px}
.pc-parts h3{margin:0;font:600 18px/1.3 Georgia,serif;color:var(--anatomy-strong)}.pc-parts li p{margin:0;color:var(--anatomy-muted)}
.pc-parts h2{font:13px ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--anatomy-muted);margin:40px 0 8px}
`;
const body = `<style>${ARTICLE_CSS}</style>
<nav class="pc-nav"><a href="../">← anatomy/of</a></nav>
<header class="pc-head"><h1>Anatomy of a pencil</h1><p>A wooden pencil looks like one thing. It's five, each solving a problem the others can't.</p></header>
${plateBody}
<section class="pc-parts"><h2>The parts</h2><ol>${PARTS.map(([title, text]) => `<li><h3>${title}</h3><p>${text}</p></li>`).join("")}</ol></section>`;

const name = theme === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomy of a pencil", theme, body, script: kitScript() + live }));
console.log("wrote", name);
