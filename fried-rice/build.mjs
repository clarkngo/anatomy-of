// Anatomy of Chinese fried rice: builds fried-rice/index.html (light) or dark.html (--dark).
// A wok on a ring burner with the mise en place around it; the food moves as particles.
// Uses the Anatomy kit (MIT, vendored in tools/anatomy). World units are 2 mm.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../tools/anatomy/kit/lathe.mjs";
import { kitScript } from "../tools/anatomy/scripts/inline-kit.mjs";
import { EXPAND_BUTTON, EXPAND_CSS, EXPAND_JS } from "../tools/expand.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

// ---------- the dish (one serving of egg fried rice) ----------
const DISH = { rice: 300, eggs: 2, oil: 15, soy: 15, scallions: 2, wokCm: 36, panC: 300, tossHz: 2 };

// ---------- world ----------
const W = 640;
const H = 400;
const PLATE = { x: -196, y: -104, w: 372, d: 208, r: 10 };
const PLATE_H = 9;
const FOOT_H = 5;

// stove and wok
const STOVE = { x: -6, y: -62, w: 142, d: 124, r: 4 };
const STOVE_H = 34;
const C = [65, 0]; // burner and wok centre
const RING = { z: [STOVE_H, 60], r: [46, 52] };
const WOK = { R: 90, depth: 50, t: 1.4 };
WOK.Rs = (WOK.R * WOK.R + WOK.depth * WOK.depth) / (2 * WOK.depth); // sphere the bowl is cut from
const WOK_Z0 = RING.z[1] - (WOK.Rs - Math.sqrt(WOK.Rs * WOK.Rs - RING.r[1] ** 2)); // wok bottom
const sag = (r, rs = WOK.Rs) => rs - Math.sqrt(Math.max(0, rs * rs - r * r)); // height of the bowl at radius r
const WOK_RIM = WOK_Z0 + WOK.depth;

// mise en place
const RICE_BOWL = { c: [-126, -34], R: 32, depth: 20, foot: 3 };
const EGG_BOWL = { c: [-138, 58], R: 22, depth: 14, foot: 2.4 };
const DISH_S = { c: [-60, 72], R: 19, depth: 5, foot: 1.2 };
const SOY = { c: [-172, -80], r: 9, h: 38 };
const KNOB = [C[0] + 36, STOVE.y + STOVE.d, 15];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [C[0] - WOK.R, 0, WOK_RIM + 40], [C[0], -WOK.R, WOK_RIM + 40], [C[0] + WOK.R + 70, 0, WOK_RIM + 14]],
  W,
  H,
  { pad: 16, azimuth: 40 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(...a) - depth(...b));
const up = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const screws = (list, z, size = 0.45) => Dt(list.map(([x, y]) => at([x, y, z])), { size });

// An open bowl: a solid outer shell, the inside surface clipped to the rim, a rim line.
// Returns the svg plus the shapes the food mask needs (outer silhouette and rim opening).
let clipCount = 0;
function vessel({ c: [cx, cy], R, depth: dep, foot }, z0, { tone = "hi", footR = R * 0.45, steel = false } = {}) {
  const Rs = (R * R + dep * dep) / (2 * dep);
  const zb = z0 + foot;
  const outer = [];
  for (let i = 0; i <= 24; i++) { const r = (R * i) / 24; outer.push([sag(r, Rs), r, 1]); }
  const F = up(cx, cy, zb);
  const shell = G.solidOf(outer.map(([s, r]) => [s, r, 1]).filter((_, i) => i > 0).reverse().concat([]).reverse(), F, P);
  const inner = [];
  for (let i = 0; i <= 24; i++) { const r = ((R - 1.2) * i) / 24; inner.push([sag(r, Rs - 1.2) + 1.2, r, 1]); }
  const inside = G.lathe([[inner[0][0], 0], ...inner.slice(1)], F, P);
  const rim = k.pathOf(Array.from({ length: 72 }, (_, i) => at([cx + Math.cos((i / 72) * Math.PI * 2) * (R - 0.6), cy + Math.sin((i / 72) * Math.PI * 2) * (R - 0.6), zb + dep])), true);
  const id = `fr-rim-${clipCount++}`;
  const out = [];
  if (foot) out.push(S(k.cylinder(cx, cy, footR, z0, foot, P, 40), { tone: "mid" }));
  out.push(S(shell, { tone }));
  // spun rings on the inside of a steel wok, at even heights
  const rings = steel ? [8, 18, 28, 38].map((h) => { const r = Math.sqrt(Math.max(0, (Rs - 1.2) ** 2 - (Rs - 1.2 - (h - 1.2)) ** 2)); return k.pathOf(Array.from({ length: 72 }, (_, i) => at([cx + Math.cos((i / 72) * Math.PI * 2) * r, cy + Math.sin((i / 72) * Math.PI * 2) * r, zb + h])), true); }).join("") : "";
  out.push(`<clipPath id="${id}"><path d="${rim}"/></clipPath><g clip-path="url(#${id})"${steel ? ' class="fr-steel"' : ""}>${S(inside, { tone: "lo", crease: "none" })}${rings ? L(rings, { tone: "lo" }) : ""}</g>`);
  out.push(L(rim, { tone }));
  return { svg: out.join(""), silhouette: shell.fill, opening: rim, top: zb + dep, base: zb, Rs, F };
}

// ---------- bench ----------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const corners = k.corners(PLATE, 11);
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 2.3, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dt(corners.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a chopping board under the mise en place, with grain lines
  const board = { x: -184, y: -94, w: 156, d: 186, r: 4 };
  out.push(S(k.slabOf(board, 0, 3, P, 4, 0.6), { tone: "mid" }));
  const grain = [0.22, 0.4, 0.61, 0.83].map((f) => k.lineOnTop([board.x + 6, board.y + board.d * f], [board.x + board.w - 6, board.y + board.d * f + 3], 3, P)).join("");
  out.push(L(grain, { tone: "faint", free: true }));
  return out.join("");
}

// ---------- stove, ring stand, burner, knob ----------
function stove() {
  const out = [S(k.slabOf(STOVE, 0, STOVE_H, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(STOVE, 8, P, 6), { tone: "faint" }) })];
  // drip tray recess and corner screws on the top
  out.push(L(k.planOutline(k.insetPlan(STOVE, 6), STOVE_H, P, 6), { tone: "lo" }));
  out.push(screws(k.corners(STOVE, 3.5), STOVE_H, 0.45));
  // vent slots on the front face
  const face = STOVE.y + STOVE.d;
  let vents = "";
  for (let i = 0; i < 7; i++) {
    const x = STOVE.x + 14 + i * 5;
    vents += k.pathOf([at([x, face, 6]), at([x, face, 16])]);
  }
  out.push(L(vents, { tone: "lo", free: "both" }));
  return out.join("");
}

function knob() {
  const [x, y, z] = KNOB;
  const F = G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const out = [S(G.disc(0, 1.6, 9, F, P), { tone: "mid" })];
  out.push(S(G.disc(1.6, 8, 6.5, F, P), { tone: "hi" }));
  out.push(L(G.ribsOf(F, 1.8, 7.8, 6.5, 24, P), { tone: "lo" }));
  out.push(`<path class="iso-line" data-tone="hi" data-knob data-free="both" d="${knobMark(0)}" style="stroke-width:1.1"/>`);
  // flame marks around it: off, low, high
  out.push(Dt([-0.9, 0, 0.9].map((a) => at([x + Math.sin(a) * 11.5, y + 1.6, z + Math.cos(a) * 11.5])), { size: 0.55 }));
  return out.join("");
}
function knobMark(turn) {
  const [x, y, z] = KNOB;
  const a = turn * 1.4;
  return k.pathOf([at([x + Math.sin(a) * 1.2, y + 8, z + Math.cos(a) * 1.2]), at([x + Math.sin(a) * 5, y + 8, z + Math.cos(a) * 5])]);
}

// vent windows in the ring stand, on the side that faces the viewer: the flame shows through them
const WINDOWS = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2 + 0.31).filter((a) => G.dot3(G.radialOf(up(C[0], C[1], 0), a), G.viewOf(P)) >= 0.25);
function ringStand() {
  const [cx, cy] = C;
  const F = up(cx, cy, RING.z[0]);
  const out = [S(G.ringBand(0, RING.z[1] - RING.z[0], RING.r[0], RING.r[1], F, P), { tone: "mid", inner: L(G.arcOf(F, 6, RING.r[1], P) + G.arcOf(F, RING.z[1] - RING.z[0] - 4, RING.r[1], P), { tone: "faint" }) })];
  // vent windows on the visible face, each a dark slot
  for (const a of WINDOWS) {
    const pts = [[a - 0.12, 9], [a + 0.12, 9], [a + 0.12, 19], [a - 0.12, 19]].map(([t, s]) => at(G.pointOf(F, s, RING.r[1] + 0.05, t)));
    out.push(`<path class="iso-shade fr-window" data-shade="0" d="${k.pathOf(pts, true)}"/>`, L(k.pathOf(pts, true), { tone: "lo" }));
  }
  return out.join("");
}

function burner() {
  const [cx, cy] = C;
  const out = [S(k.cylinder(cx, cy, 20, STOVE_H, 5, P, 40), { tone: "mid" })];
  out.push(S(k.cylinder(cx, cy, 9, STOVE_H + 5, 2, P, 32), { tone: "hi" }));
  out.push(Dt(Array.from({ length: 24 }, (_, i) => at([cx + Math.cos((i / 24) * Math.PI * 2) * 16, cy + Math.sin((i / 24) * Math.PI * 2) * 16, STOVE_H + 5])), { size: 0.5 }));
  return out.join("");
}

// ---------- the wok ----------
const wok = vessel({ c: C, R: WOK.R, depth: WOK.depth, foot: 0 }, WOK_Z0, { tone: "hi", steel: true });
function handle() {
  const a = [Math.cos(0.12), 0, Math.sin(0.12)];
  const F = G.frameOf([C[0] + WOK.R - 3, C[1], WOK_RIM - 6], a, [0, 1, 0], G.unit3(G.cross3(a, [0, 1, 0]).map((v) => -v)));
  const out = [S(G.solidOf([[0, 4.2], [8, 3.4], [30, 3.2]], F, P), { tone: "mid" })];
  out.push(S(G.solidOf([[30, 4.4], [31.5, 5.2], [70, 5.2], [72, 4.2], [72.6, 0]], F, P), { tone: "hi" }));
  out.push(L(G.arcOf(F, 36, 5.2, P) + G.arcOf(F, 66, 5.2, P), { tone: "faint" }));
  out.push(Dt([at(G.pointOf(F, 4, 4.0, Math.PI / 2))], { size: 0.6 }));
  return out.join("");
}

// ---------- mise en place ----------
const riceBowl = vessel(RICE_BOWL, 3);
const eggBowl = vessel(EGG_BOWL, 3);
const dish = vessel(DISH_S, 3, { footR: DISH_S.R * 0.6 });
function eggSurface() {
  const [cx, cy] = EGG_BOWL.c;
  const z = eggBowl.base + 7;
  const r = Math.sqrt(Math.max(0, eggBowl.Rs ** 2 - (eggBowl.Rs - 7) ** 2)) - 1;
  const F = up(cx, cy, z);
  return `<g data-egg-bowl>${S(G.disc(0, 0.3, r, F, P), { tone: "mid", crease: "none", className: "fr-yolk" })}${L(k.ring(cx, cy, r * 0.55, z + 0.3, P, 40), { tone: "faint" })}</g>`;
}
function soy() {
  const [cx, cy] = SOY.c;
  const F = up(cx, cy, 3);
  const out = [S(G.solidOf([[0, SOY.r], [SOY.h - 8, SOY.r, 1], [SOY.h - 3, 3.6, 1], [SOY.h + 4, 3.2], [SOY.h + 4, 0]], F, P), { tone: "hi" })];
  out.push(S(G.disc(SOY.h + 4, SOY.h + 9, 3.8, F, P), { tone: "mid" }));
  out.push(L(G.ribsOf(F, SOY.h + 4.2, SOY.h + 8.8, 3.8, 18, P), { tone: "lo" }));
  // paper label band
  out.push(S(G.ringBand(9, 25, SOY.r, SOY.r + 0.3, F, P), { tone: "mid" }));
  out.push(L(G.arcOf(F, 17, SOY.r + 0.3, P), { tone: "faint" }));
  return out.join("");
}

// ---------- the food: particles ----------
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const inWok = (rMax, lift) => {
  const r = Math.sqrt(rand()) * rMax;
  const a = rand() * Math.PI * 2;
  return [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, WOK_Z0 + WOK.t + sag(r) + rand() * lift];
};
const FOOD = [];
for (let i = 0; i < 150; i++) {
  const r = Math.sqrt(rand()) * 26;
  const a = rand() * Math.PI * 2;
  const mound = 9 * (1 - (r / 27) ** 2);
  FOOD.push({ kind: "grain", home: [RICE_BOWL.c[0] + Math.cos(a) * r, RICE_BOWL.c[1] + Math.sin(a) * r, riceBowl.top - 3 + mound * rand() + mound * 0.4], wok: inWok(44, 5), rot: Math.round(rand() * 180), toss: rand() });
}
for (let i = 0; i < 16; i++) FOOD.push({ kind: "egg", home: null, wok: inWok(38, 6), rot: Math.round(rand() * 180), toss: rand(), size: 1.6 + rand() * 1.4 });
for (let i = 0; i < 22; i++) {
  const r = Math.sqrt(rand()) * 13;
  const a = rand() * Math.PI * 2;
  FOOD.push({ kind: "scallion", home: [DISH_S.c[0] + Math.cos(a) * r, DISH_S.c[1] + Math.sin(a) * r, dish.base + 1.6 + rand()], wok: inWok(42, 8), rot: 0, toss: rand() });
}
const foodSvg = (f, i) => {
  const p = at(f.home || f.wok);
  const pos = `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`;
  if (f.kind === "grain") return `<ellipse class="fr-grain" data-f="${i}" rx="2.1" ry="0.95" transform="${pos} rotate(${f.rot})"/>`;
  if (f.kind === "egg") return `<path class="fr-egg" data-f="${i}" d="M${-f.size} 0a${f.size} ${f.size * 0.7} 0 1 0 ${f.size * 2} 0a${f.size} ${f.size * 0.8} 0 1 0 ${-f.size * 2} 0Z" transform="${pos} rotate(${f.rot})" style="opacity:0"/>`;
  return `<circle class="fr-scallion" data-f="${i}" r="1.25" transform="${pos}"/>`;
};

// The food is hidden where a vessel's outer wall is in front of it, and shows through each rim.
const VESSELS = [riceBowl, eggBowl, dish, wok];
const maskOf = (id, v, extra = "") => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><g${extra}><path d="${v.silhouette}" fill="#000"/><path d="${v.opening}" fill="#fff"/></g></mask>`;
const mask = `<defs>${maskOf("fr-food", wok, " data-wok-mask")}${maskOf("fr-rice", riceBowl)}${maskOf("fr-dish", dish)}</defs>`;
const homeLayer = (kind, id) => `<g data-home="${kind}" mask="url(#${id})">${FOOD.map((f, i) => (f.kind === kind ? foodSvg(f, i) : "")).join("")}</g>`;

// flame tongues around the front of the wok, above the ring stand (rebuilt in the page as they flicker)
const FLAMES = WINDOWS.flatMap((a) => [a - 0.06, a + 0.05]);
const part = (id, svg, extra = "") => `<g data-part="${id}"${extra}>${svg}</g>`;

const FIGURE_LABEL =
  "A carbon-steel wok on a ring burner set into a small stove, with a long wooden-gripped handle. On a chopping board beside it: a bowl of day-old rice, a bowl of beaten egg, a dish of sliced scallion and a bottle of soy sauce. As the steps run, the burner lights, egg and rice go into the wok, soy and scallion follow, and the wok tosses the grains up through the hot air.";

const BODY = [
  mask,
  plate(),
  part("aromatics", soy()),
  part("rice", riceBowl.svg + homeLayer("grain", "fr-rice")),
  part("burner", stove() + ringStand() + burner() + knob()),
  `<g data-flames class="fr-flames"></g>`,
  `<g data-wok>${part("wok", wok.svg)}</g>`,
  `<g data-wok-handle>${part("wok", handle())}</g>`,
  part("egg", eggBowl.svg + eggSurface()),
  part("aromatics", dish.svg + homeLayer("scallion", "fr-dish")),
  `<g data-food mask="url(#fr-food)">${FOOD.map((f, i) => (f.kind === "egg" ? foodSvg(f, i) : "")).join("")}</g>`,
];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });
const FOOD_CSS = `.fr-grain{fill:var(--anatomy-face);stroke:var(--anatomy-hi);stroke-width:.45}
[data-soy] .fr-grain{fill:var(--anatomy-shade-0)}
.fr-egg{fill:var(--fr-yolk);stroke:var(--anatomy-mid);stroke-width:.45}
.iso{--fr-yolk:#f2d77a;--fr-yolk-deep:#e8c14e}
.iso[data-theme="dark"],.iso:not([data-theme]){--fr-yolk:#7a6526;--fr-yolk-deep:#8c7430}
.fr-yolk>.iso-fill,.fr-yolk>.iso-top{fill:var(--fr-yolk)!important}.fr-yolk>.iso-shade{fill:var(--fr-yolk-deep)!important}
.fr-steel .iso-fill,.fr-steel .iso-top{fill:var(--anatomy-shade-1)}.fr-steel .iso-shade{fill:var(--anatomy-shade-0)}
.fr-scallion{fill:none;stroke:var(--anatomy-green);stroke-width:.7}
.fr-flames path{fill:none;stroke:var(--anatomy-blue);stroke-width:1;stroke-linecap:round}
[data-hot] .fr-window{fill:color-mix(in srgb,var(--anatomy-blue) 22%,var(--anatomy-shade-0));transition:fill .6s}`;
const xmlSafe = (text) => text.replace(/ (data-[\w-]+)(?=[\s>\/])/g, ' $1=""');
if (theme === "light") writeFileSync(join(HERE, "thumb.svg"), xmlSafe(k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY, standalone: "light" }).replace("</style>", FOOD_CSS + "</style>")));

// ---------- steps and parts ----------
const STEPS = [
  { say: `mise en place · ${DISH.rice} g day-old rice`, next: "Light the burner" },
  { say: `heat · wok above ${DISH.panC} °C`, next: "Oil, then egg" },
  { say: `${DISH.oil} ml oil, ${DISH.eggs} eggs · barely set`, next: "Add the rice" },
  { say: "rice in · grains stay separate", next: "Soy and scallion" },
  { say: `${DISH.soy} ml soy · ${DISH.scallions} scallions`, next: "Toss" },
  { say: `tossing · about ${DISH.tossHz} a second`, next: "Start over" },
];
const PARTS = [
  { id: "rice", step: 3, title: "Day-old rice", fact: `rice · ${DISH.rice} g, cooked the day before`, text: "Freshly cooked rice is wet and soft, so it clumps and steams. A night in the fridge dries the surface of each grain and firms the starch, so the grains stay separate and fry instead of turning to mush." },
  { id: "burner", step: 1, title: "Flame", fact: "burner · restaurant rings run 100,000 BTU/h or more", text: "A restaurant wok burner puts out several times the heat of a home ring. The point is a pan hot enough that moisture on the rice flashes off at once, so every grain sears instead of simmering." },
  { id: "wok", step: 5, title: "Wok", fact: `wok · ${DISH.wokCm} cm, thin carbon steel`, text: "Thin carbon steel heats fast and changes temperature quickly. The round bottom sits in the flame, so the base is fiercely hot while the sloped sides stay cooler: food can be pushed up the wall to rest and brought back down to sear." },
  { id: "egg", step: 2, title: "Egg", fact: `egg · ${DISH.eggs}, into hot oil first`, text: "Beaten egg goes into the hot oil before the rice and is broken up while it is still soft. It sets into small curds and coats some of the grains." },
  { id: "aromatics", step: 4, title: "Soy and scallion", fact: "soy and scallion · last, for salt and freshness", text: "Soy goes in late, around the hot wall of the wok, where it sizzles and caramelises before it reaches the rice. Scallion is added at the end so it stays bright." },
];

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  P, steps: STEPS,
  parts: Object.fromEntries(PARTS.map(({ id, step, fact }) => [id, { step, fact }])),
  food: FOOD.map((f) => ({ k: f.kind[0], h: f.home && f.home.map((v) => +v.toFixed(2)), w: f.wok.map((v) => +v.toFixed(2)), r: f.rot, t: +f.toss.toFixed(3) })),
  wok: { c: C, R: WOK.R, rim: WOK_RIM, z0: WOK_Z0, Rs: WOK.Rs }, V: G.viewOf(P), ring: RING, knob: KNOB, flames: FLAMES,
};

const live = `
const D = ${JSON.stringify(DATA)};
const LAST = D.steps.length - 1;
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const liveText = document.querySelector("[data-live]");
const prev = document.querySelector("[data-prev]");
const next = document.querySelector("[data-next]");
const tossButton = document.querySelector("[data-toss]");
const dots = [...document.querySelectorAll("[data-dot]")];
const items = [...document.querySelectorAll("[data-select]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const groups = [...stage.querySelectorAll("[data-part]")];
const foodLayer = stage.querySelector("[data-food]");
const foodEls = [...stage.querySelectorAll("[data-f]")].sort((a, b) => a.dataset.f - b.dataset.f);
const homes = { g: stage.querySelector('[data-home="grain"]'), s: stage.querySelector('[data-home="scallion"]') };
const wokEls = [stage.querySelector("[data-wok]"), stage.querySelector("[data-wok-handle]"), stage.querySelector("[data-wok-mask]")];
const flamesEl = stage.querySelector("[data-flames]");
const knobEl = stage.querySelector("[data-knob]");
const eggBowl = stage.querySelector("[data-egg-bowl]");
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const shift = (dx, dy, dz) => [D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz, D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz];
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.002 ? target : nx; };

// which step puts each kind of food in the wok
const IN_AT = { g: 3, e: 2, s: 4 };
const food = D.food.map((f, i) => ({ ...f, el: foodEls[i], x: 0, start: 0 }));
let step = 0, selected = null, touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0, clock = 0;
let heat = 0, egg = 0, soy = 0, tossClock = 0, tossing = 0, burst = 0;

function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }

function setStep(n) {
  n = Math.max(0, Math.min(LAST, n));
  if (n === step) return;
  const forward = n > step;
  step = n;
  // food that changes place leaves in a staggered stream
  let order = 0;
  for (const f of food) {
    const goal = step >= IN_AT[f.k] ? 1 : 0;
    if ((f.goal ?? 0) === goal) continue;
    f.goal = goal;
    f.start = clock + (still.matches ? 0 : (f.k === "e" ? 0 : (order++ % 60) * 0.012));
  }
  controls();
  if (!touring) announce(D.steps[step].say);
  run();
}

function toss() { hold(); select(null); if (step < LAST) setStep(LAST); burst = 1.6; run(); }

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const g of groups) { if (id && g.dataset.part === id) g.setAttribute("data-on", ""); else g.removeAttribute("data-on"); }
  if (id) stage.setAttribute("data-focus", ""); else stage.removeAttribute("data-focus");
  for (const item of items) { if (item.dataset.select === id) item.setAttribute("data-on", ""); else item.removeAttribute("data-on"); }
  if (id) announce(D.parts[id].fact);
  place();
}

function controls() {
  prev.disabled = step === 0;
  next.querySelector("span").textContent = D.steps[step].next;
  next.setAttribute("aria-label", D.steps[step].next);
  dots.forEach((dot, index) => (index < step ? dot.setAttribute("data-on", "") : dot.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(step));
  stage.setAttribute("aria-valuetext", D.steps[step].say);
}

function update(dt, calm) {
  let busy = false;
  const go = (x, target, rate) => { const nx = calm ? target : follow(x, target, rate, dt); if (nx !== target) busy = true; return nx; };
  heat = go(heat, step >= 1 ? 1 : 0, 2.5);
  egg = go(egg, step >= 2 ? 1 : 0, 3);
  soy = go(soy, step >= 4 ? 1 : 0, 2);
  for (const f of food) {
    const goal = f.goal || 0;
    if (f.x === goal) continue;
    if (clock < f.start) { busy = true; continue; }
    const speed = calm ? 99 : 1.5;
    f.x = goal > f.x ? Math.min(goal, f.x + dt * speed) : Math.max(goal, f.x - dt * speed);
    busy = true;
  }
  // tossing: a steady rhythm at the last step, or a short burst from the button
  const want = step === LAST || burst > 0 ? 1 : 0;
  if (burst > 0) burst -= dt;
  tossing = go(tossing, want, 4);
  if (tossing > 0 && !calm) { tossClock += dt; busy = true; }
  return busy || heat > 0.01;
}

const PERIOD = 0.5; // seconds per toss
function tossAt(t) { const p = (tossClock / PERIOD + t * 0.35) % 1; return p < 0.55 ? Math.sin((Math.PI * p) / 0.55) : 0; }

function place() {
  // the wok jerks back and up on each toss
  const phase = (tossClock / PERIOD) % 1;
  const jerk = tossing * (phase < 0.25 ? Math.sin((Math.PI * phase) / 0.25) : 0);
  const wokShift = shift(-5 * jerk, 0, 2.5 * jerk);
  for (const el of wokEls) setT(el, wokShift);
  // food
  for (const f of food) {
    let p;
    const t = ease(f.x);
    if (f.k === "e") {
      p = f.w;
      f.el.style.opacity = (egg * 1).toFixed(2);
    } else {
      const a = f.h, b = f.w;
      const lift = Math.sin(Math.PI * t) * 46;
      p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + lift];
    }
    let z = p[2], x = p[0];
    if (f.x === 1 || f.k === "e") {
      const h = tossing * tossAt(f.t);
      z += h * (26 + 24 * f.t);
      x += -h * 18 * f.t - 5 * jerk;
      z += 2.5 * jerk;
    }
    const layer = f.k === "e" || f.x > 0 ? foodLayer : homes[f.k];
    if (f.el.parentNode !== layer) layer.appendChild(f.el);
    const q = iso([x, p[1], z], D.P);
    const text = "translate(" + q[0].toFixed(1) + " " + q[1].toFixed(1) + ")" + (f.r ? " rotate(" + f.r + ")" : "");
    if (f.el._t !== text) { f.el._t = text; f.el.setAttribute("transform", text); }
  }
  if (soy > 0.5) foodLayer.setAttribute("data-soy", ""); else foodLayer.removeAttribute("data-soy");
  eggBowl.style.opacity = (1 - egg).toFixed(2);
  // flames flicker around the front of the wok
  if (heat > 0.01) {
    let d = "";
    D.flames.forEach((a, i) => {
      const flick = 0.65 + 0.35 * Math.sin(clock * 11 + i * 2.3) * Math.sin(clock * 7.1 + i);
      // tongues seen through the vent windows of the ring stand
      const r = D.ring.r[1] + 0.1, z0 = D.ring.z[0] + 9.6, h = heat * (3.5 + 5.5 * flick);
      const base = [D.wok.c[0] + Math.cos(a) * r, D.wok.c[1] + Math.sin(a) * r, z0];
      const tip = [D.wok.c[0] + Math.cos(a) * r, D.wok.c[1] + Math.sin(a) * r, z0 + h];
      const p0 = iso(base, D.P), p1 = iso(tip, D.P);
      d += "M" + p0[0].toFixed(1) + " " + p0[1].toFixed(1) + "Q" + (p0[0] + 2 * Math.sin(clock * 9 + i)).toFixed(1) + " " + ((p0[1] + p1[1]) / 2).toFixed(1) + " " + p1[0].toFixed(1) + " " + p1[1].toFixed(1);
    });
    flamesEl.innerHTML = '<path data-free="both" d="' + d + '"/>';
  } else if (flamesEl.firstChild) flamesEl.innerHTML = "";
  knobEl.setAttribute("d", knobMarkAt(heat));
  if (heat > 0.3) stage.setAttribute("data-hot", ""); else stage.removeAttribute("data-hot");
  const text = selected ? D.parts[selected].fact : D.steps[step].say;
  if (readout.textContent !== text) readout.textContent = text;
}
const knobMarkAt = ${knobMark.toString().replace("function knobMark", "function").replace(/KNOB/g, "D.knob").replace(/k\.pathOf/g, "pathOf").replace(/\bat\(/g, "((p) => iso(p, D.P))(")};

const TOUR = [2.4, 2.6, 2.6, 3, 2.6, 5];
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) {
    tourClock += dt;
    if (tourClock > TOUR[step]) { tourClock = 0; setStep(step === LAST ? 0 : step + 1); }
  }
  const busy = update(dt, still.matches);
  place();
  frame = visible && (busy || touring) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

function hold() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (still.matches || selected || stage.matches(":hover, :focus-within")) return hold();
    touring = true;
    tourClock = 0;
    run();
  }, 9000);
}
const go = (n) => { hold(); setStep(n); };
const forward = () => go(step === LAST ? 0 : step + 1);

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

const partAt = (target) => target.closest && target.closest("[data-part]");
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") return;
  hold();
  const g = partAt(event.target);
  select(g ? g.dataset.part : null);
});
stage.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
stage.addEventListener("click", (event) => {
  hold();
  const g = partAt(event.target);
  if (!g) return select(null);
  if (event.pointerType !== "mouse") select(selected === g.dataset.part ? null : g.dataset.part);
});
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: () => go(step + 1), ArrowDown: () => go(step + 1), ArrowLeft: () => go(step - 1), ArrowUp: () => go(step - 1), Home: () => go(0), End: () => go(LAST), " ": forward, Enter: forward, Escape: () => { hold(); select(null); go(0); }, t: toss, T: toss };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
prev.addEventListener("click", () => go(step - 1));
next.addEventListener("click", forward);
tossButton.addEventListener("click", toss);
for (const item of items) {
  const id = item.dataset.select;
  item.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") { hold(); select(id); } });
  item.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
  const pickPart = () => { hold(); select(id); setStep(D.parts[id].step); };
  item.addEventListener("click", pickPart);
  item.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pickPart(); } });
  item.addEventListener("focus", () => { hold(); select(id); });
  item.addEventListener("blur", () => select(null));
}
update(0, true);
controls();
place();
`;

const plateBody = k.plateHtml({
  fig: "Fig 4",
  title: "Egg fried rice · one serving",
  hint: "← → step · T toss · F expand",
  readout: STEPS[0].say,
  keys: [
    { mark: "lit", label: "The rice: day-old grains, the part everything else serves" },
    { mark: "raised", label: "Wok, flame and the mise en place" },
  ],
  caption: `One serving of egg fried rice: ${DISH.rice} g of rice cooked the day before, ${DISH.eggs} eggs, ${DISH.oil} ml of oil, ${DISH.soy} ml of soy sauce and ${DISH.scallions} scallions, cooked in a ${DISH.wokCm} cm carbon-steel wok in under five minutes. The wok's round base sits right in the flame. Egg sets first in the hot oil, then the rice goes in and is pressed and tossed so every grain touches the hot steel and then the air. Tossing over a big flame is also where wok hei, the smoky "breath of the wok", comes from: droplets of oil thrown through the flame catch and flavour the rice. Soy goes in around the hot wall and scallion goes in last.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Fried rice. Arrow keys step through the cooking; T tosses the wok; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="${STEPS[0].say}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Back one step" disabled>←</button><span class="pc-dots" aria-hidden="true">${STEPS.slice(1).map(() => "<i data-dot></i>").join("")}</span><button type="button" class="pc-btn pc-toss" data-toss aria-keyshortcuts="T">Toss</button><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const ARTICLE_CSS = `${FOOD_CSS}
.iso-stage [data-part]{cursor:pointer}
.iso-stage[data-focus] [data-part]:not([data-on]) *{stroke:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-fill{fill:var(--anatomy-paper)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-top{fill:var(--anatomy-top)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-shade{fill:var(--anatomy-shade-3)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-dots circle{opacity:.1!important}
.pc-controls{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:-10px;padding:0 16px 14px;font:12px/1 var(--anatomy-mono,ui-monospace,Menlo,monospace);z-index:1}
.pc-btn{font:inherit;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-mid);padding:7px 10px;cursor:pointer;min-height:30px}
.pc-btn:hover{border-color:var(--anatomy-strong)}
.pc-btn:disabled{color:var(--anatomy-lo);border-color:var(--anatomy-faint);cursor:default}
.pc-toss{margin-left:auto}
.pc-dots{display:flex;gap:5px}
.pc-dots i{width:6px;height:6px;border:1px solid var(--anatomy-mid);border-radius:50%}
.pc-dots i[data-on]{background:var(--anatomy-strong);border-color:var(--anatomy-strong)}
.pc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iso-plate{padding-bottom:60px}
@media (max-width:600px){.pc-controls{margin-top:8px;padding:0 4px 4px}.iso-plate{padding-bottom:72px}}
@media (min-width:700px) and (min-height:860px){.iso-figure{position:sticky;top:0;z-index:2;background:var(--anatomy-page);padding:16px 0 14px;margin-top:-16px;box-shadow:0 1px 0 color-mix(in srgb,var(--anatomy-muted) 30%,transparent)}}
.pc-nav{max-width:650px;margin:0 auto;padding:24px 16px 0;font:14px/1.4 ui-monospace,Menlo,monospace}
.pc-nav a{color:var(--anatomy-muted);text-decoration:none}.pc-nav a:hover{color:var(--anatomy-text)}
.pc-head,.pc-parts{max-width:650px;margin:0 auto;padding:0 16px;color:var(--anatomy-text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.pc-head h1{font:600 34px/1.15 Georgia,serif;margin:28px 0 8px;color:var(--anatomy-strong)}
.pc-head p{margin:0 0 8px;color:var(--anatomy-muted)}
.pc-parts{padding-bottom:64px}.pc-parts ol{list-style:none;margin:0;padding:0}
.pc-parts li{display:grid;grid-template-columns:40px 1fr;gap:2px 12px;padding:16px 8px;margin:0 -8px;border-top:1px solid color-mix(in srgb,var(--anatomy-muted) 30%,transparent);cursor:pointer;transition:background .2s}
.pc-parts li:hover,.pc-parts li[data-on]{background:var(--anatomy-card)}
.pc-parts li:focus-visible{outline:1px solid var(--anatomy-strong);outline-offset:-1px}
.pc-parts li .num{grid-row:span 2;font:13px ui-monospace,Menlo,monospace;color:var(--anatomy-muted);padding-top:3px}
.pc-parts li[data-on] .num{color:var(--anatomy-strong)}
.pc-parts h3{margin:0;font:600 18px/1.3 Georgia,serif;color:var(--anatomy-strong)}.pc-parts li p{margin:0;color:var(--anatomy-muted)}
.pc-parts h2{font:13px ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--anatomy-muted);margin:40px 0 4px}
.pc-parts .tip{font:12px ui-monospace,Menlo,monospace;color:var(--anatomy-muted);margin:0 0 12px}
`;
const body = `<style>${ARTICLE_CSS}${EXPAND_CSS}</style>
<nav class="pc-nav"><a href="../">← anatomy/of</a></nav>
<header class="pc-head"><h1>Anatomy of Chinese fried rice</h1><p>Five ingredients and five minutes. Most of the recipe is heat, timing and rice that was cooked yesterday.</p></header>
${plateBody}
<section class="pc-parts"><h2>The parts</h2><p class="tip">Point at a part to find it in the figure; click it to step the cooking to it.</p><ol>${PARTS.map(({ id, title, text }, index) => `<li data-select="${id}" tabindex="0" role="button" aria-label="${title}: show it in the figure"><span class="num">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></li>`).join("")}</ol></section>`;

const name = theme === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomy of Chinese fried rice", theme, body, script: kitScript() + live + EXPAND_JS }));
console.log("wrote", name);
