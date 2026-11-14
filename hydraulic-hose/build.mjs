// Anatomy of a hydraulic hose: builds hydraulic-hose/index.html (light) or dark.html (--dark).
// A ½ in two-wire-braid hose (SAE 100R2AT, -8) with a crimped fitting, screwed into a test block.
// Uses the Anatomy kit (MIT, vendored in tools/anatomy). World units are millimetres.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../tools/anatomy/kit/lathe.mjs";
import { kitBundle } from "../tools/kit-bundle.mjs";
import { EXPAND_BUTTON, EXPAND_CSS, EXPAND_JS } from "../tools/expand.mjs";
import { hoseSvg } from "./hose.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const K = { ...k, ...G };

// ---------- the model: SAE 100R2AT, -8 (½ in) ----------
const HOSE = {
  spec: "SAE 100R2AT",
  dash: "-8",
  id: 12.7, // bore, mm
  od: 22.6, // over the cover
  working: 27.5, // MPa, = 4,000 psi
  psi: 4000,
  burst: 110, // MPa minimum, 4 × working
  bend: 178, // minimum bend radius, mm
  angle: 54.7, // braid angle: the neutral angle, tan² = 2
  thread: 1.59, // 3/4-16 UNF, the -8 JIC thread
};
const X0 = 100; // the cut end, s = 0
const ZC = 18; // the hose's axis height
const M = {
  X0, ZC,
  layers: [
    { id: "cover", part: "cover", r: [9.6, HOSE.od / 2], kind: "rubber", tone: "hi" },
    { id: "braid2", part: "braid", r: [9.0, 9.6], kind: "braid", tone: "hi" },
    { id: "mid", part: "mid", r: [8.6, 9.0], kind: "rubber", tone: "hi" },
    { id: "braid1", part: "braid", r: [8.0, 8.6], kind: "braid", tone: "hi" },
    { id: "tube", part: "tube", r: [HOSE.id / 2, 8.0], kind: "rubber", tone: "hi" },
  ],
  carriers: 12,
  braidAngle: HOSE.angle,
  hoseEnd: 200,
  ferrule: [164, 202],
  layline: [70, 128],
  print: `${HOSE.spec} · ½ in · ${HOSE.working} MPa`,
};
const TELESCOPE = 15; // how far each inner layer slides out past the one around it
const FERRULE_BACK = 44;
const STEPS_OFF = (step) => M.layers.map((_, i) => (i === 0 ? 0 : TELESCOPE * Math.min(step, i)));

const W = 640;
const H = 300;
const F = G.frameOf([X0, 0, ZC], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
const COVER_R = HOSE.od / 2;

// fitting, along s
const COLLAR = [200, 208, 9.8];
const NUT = [208, 226, 22.2 / 2]; // hex, 22.2 mm across the flats
const THREAD = [222, 236, 9.4];
const ADAPTER_HEX = [236, 244, 19 / 2];
const FACE_X = X0 - 244; // the test block's face

// test block, gauge and pump
const BLOCK = { x: FACE_X - 40, y: -24, w: 40, d: 48, r: 3 };
const BLOCK_H = 46;
const GAUGE = { x0: FACE_X - 26, x1: FACE_X - 18, y: 0, z: BLOCK_H + 22, r: 16 };
const GAUGE_MAX = 40; // MPa, full scale
const SWEEP = (270 * Math.PI) / 180;
const PUMP = { x: FACE_X - 9, y: -15, r: 5, z: [BLOCK_H, BLOCK_H + 22], rod: 1.6, top: BLOCK_H + 38, stroke: 11 };

const PLATE = { x: FACE_X - 52, y: -36, w: X0 + 4 * TELESCOPE + 26 - (FACE_X - 52), d: 72, r: 8 };
const PLATE_H = 9;
const FOOT_H = 5;
const CRADLES = [46, 128].map((s) => X0 - s);
const CRADLE_TOP = ZC - COVER_R;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PUMP.x, PUMP.y, PUMP.top + 4], [GAUGE.x1, GAUGE.r, GAUGE.z + GAUGE.r], [GAUGE.x1, -GAUGE.r, GAUGE.z + GAUGE.r]],
  W,
  H,
  { pad: 18, azimuth: 60 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(...a) - depth(...b));
const screws = (list, z, size = 0.45) => Dt(list.map(([x, y]) => at([x, y, z])), { size });
const hexAround = (apothem, turn = 0) => Array.from({ length: 6 }, (_, i) => {
  const a = turn + (Math.PI / 3) * i + Math.PI / 6;
  const r = apothem / Math.cos(Math.PI / 6);
  return [r * Math.cos(a), r * Math.sin(a)];
});

// ---------- bench ----------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const corners = k.corners(PLATE, 10);
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dt(corners.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // millimetre rule along the hose, zero at the cut end
  const strip = { x: FACE_X + 4, y: 22, w: X0 - FACE_X - 2, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(FACE_X + 8, X0, 2, 5, strip.y + 0.6, 0.6, [1.6, 3.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dt([at([strip.x + 2, strip.y + 4.4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4.4, 0.6])], { size: 0.4 }));
  // label plate, front right of the cut end
  const label = { x: X0 + 18, y: 15, w: 34, d: 13, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 4.5, label.y + 6.4], 0.8, P, "x"), `${HOSE.dash} · R2AT`, { size: 3, tone: "mid" }));
  out.push(L(k.lineOnTop([label.x + 4.5, label.y + 9.6], [label.x + 24, label.y + 9.6], 0.8, P), { tone: "lo", free: true }));
  out.push(screws([[label.x + 2.4, label.y + 2.4], [label.x + label.w - 2.4, label.y + label.d - 2.4]], 0.8, 0.4));
  return out.join("");
}

function cradle(cx, front) {
  const pinY = COVER_R + 1.4;
  const pin = (y) => S(k.cylinder(cx, y, 1.1, CRADLE_TOP, COVER_R - 2, P, 14), { tone: "hi" });
  if (front) return pin(pinY);
  const block = { x: cx - 8, y: -15, w: 16, d: 30, r: 1.5 };
  const out = [S(k.slabOf(block, 0, CRADLE_TOP, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(block, 2.5), CRADLE_TOP, P, 3), { tone: "faint" }));
  out.push(screws([[cx - 5.5, -12.5], [cx + 5.5, -12.5], [cx - 5.5, 12.5], [cx + 5.5, 12.5]], CRADLE_TOP, 0.42));
  out.push(pin(-pinY));
  return out.join("");
}

// ---------- test block, pump and gauge ----------
function block() {
  const out = [S(k.slabOf(BLOCK, 0, BLOCK_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BLOCK, 6, P, 4), { tone: "faint" }) })];
  out.push(screws([[BLOCK.x + 4, BLOCK.y + 4], [BLOCK.x + BLOCK.w - 4, BLOCK.y + 4], [BLOCK.x + 4, BLOCK.y + BLOCK.d - 4], [BLOCK.x + BLOCK.w - 4, BLOCK.y + BLOCK.d - 4]], BLOCK_H));
  // a bleed screw on the front face and the port boss on the hose side
  const front = BLOCK.y + BLOCK.d;
  const Fb = G.frameOf([BLOCK.x + 12, front, 30], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  out.push(S(G.disc(0, 2.4, 4.2, Fb, P), { tone: "mid" }));
  out.push(S(G.disc(2.4, 6.4, 2.8, Fb, P), { tone: "hi" }), L(G.ribsOf(Fb, 2.4, 6.4, 2.8, 18, P), { tone: "lo" }));
  out.push(k.faceTextSvg(k.sideMatrix([BLOCK.x + 20, front], 33, P, "left"), "BLEED", { size: 2.6, tone: "lo" }));
  out.push(Dt([at([BLOCK.x + BLOCK.w - 4, front, 12]), at([BLOCK.x + 4, front, 12])], { size: 0.45 }));
  return out.join("");
}

function pumpBarrel() {
  const out = [S(k.cylinder(PUMP.x, PUMP.y, PUMP.r + 1.5, PUMP.z[0], 3, P, 28), { tone: "mid" })];
  out.push(S(k.cylinder(PUMP.x, PUMP.y, PUMP.r, PUMP.z[0] + 3, PUMP.z[1] - PUMP.z[0] - 3, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(PUMP.x, PUMP.y, PUMP.r - 1.4, PUMP.z[1], 2.4, P, 6), { tone: "mid" }));
  out.push(L(k.sideArc(PUMP.x, PUMP.y, PUMP.r, PUMP.z[0] + 9, P), { tone: "faint" }));
  return out.join("");
}
const ROD_BASE = PUMP.z[1] + 2.4;
// the clip keeps the rod above the gland, whatever its stroke
const rodClip = (() => {
  const ring = (z) => Array.from({ length: 32 }, (_, i) => at([PUMP.x + Math.cos((i / 32) * 2 * Math.PI) * (PUMP.rod + 0.4), PUMP.y + Math.sin((i / 32) * 2 * Math.PI) * (PUMP.rod + 0.4), z]));
  const near = ring(ROD_BASE).filter(([, y], i, list) => y >= at([PUMP.x, PUMP.y, ROD_BASE])[1]);
  return k.pathOf(G.hullOf([...ring(ROD_BASE + 40), ...near]), true);
})();
function pumpRod() {
  return S(k.cylinder(PUMP.x, PUMP.y, PUMP.rod, ROD_BASE - PUMP.stroke, PUMP.top - (ROD_BASE - PUMP.stroke), P, 16), { tone: "hi" });
}
function pumpHandle() {
  const bar = { x: PUMP.x - 1.8, y: PUMP.y - 12, w: 3.6, d: 24, r: 1.2 };
  const out = [S(k.slabOf(bar, PUMP.top, 3, P, 2, 0.4), { tone: "hi" })];
  for (const y of [bar.y + 1.8, bar.y + bar.d - 1.8]) out.push(S(k.cylinder(PUMP.x, y, 2.4, PUMP.top + 3, 2.2, P, 18), { tone: "mid" }), Dt([at([PUMP.x, y, PUMP.top + 5.2])], { size: 0.45 }));
  return out.join("");
}

const Fg = G.frameOf([GAUGE.x0, GAUGE.y, GAUGE.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const DIAL = GAUGE.x1 - GAUGE.x0;
// a point on the dial face: right on the dial is -y, up is +z, angle measured as on a clock face's maths
const onDial = (r, a) => [GAUGE.x1 + 0.01, GAUGE.y - r * Math.cos(a), GAUGE.z + r * Math.sin(a)];
const angleOf = (mpa) => (225 * Math.PI) / 180 - (SWEEP * Math.min(GAUGE_MAX, Math.max(0, mpa))) / GAUGE_MAX;
const needleD = (mpa) => k.pathOf([at(onDial(-2.6, angleOf(mpa))), at(onDial(GAUGE.r - 4.6, angleOf(mpa)))]);
function gauge() {
  const out = [S(k.cylinder(GAUGE.x0 + DIAL / 2, 0, 3, BLOCK_H, GAUGE.z - GAUGE.r - BLOCK_H + 2, P, 18), { tone: "mid" })];
  out.push(S(k.cylinder(GAUGE.x0 + DIAL / 2, 0, 4.6, BLOCK_H, 2, P, 6), { tone: "mid" }));
  const bezel = GAUGE.r - 1.6;
  out.push(S(G.disc(0, DIAL, GAUGE.r, Fg, P), { tone: "mid", inner: L(G.arcOf(Fg, DIAL, bezel, P), { tone: "lo" }) }));
  let minor = "", major = "";
  for (let i = 0; i <= 40; i++) {
    const a = angleOf(i);
    const d = k.pathOf([at(onDial(i % 10 ? GAUGE.r - 4.2 : GAUGE.r - 5.6, a)), at(onDial(bezel, a))]);
    if (i % 10) { if (i % 2 === 0) minor += d; } else major += d;
  }
  out.push(L(minor, { tone: "lo", free: "start" }), L(major, { tone: "mid", free: "start" }));
  // a mark at the hose's working pressure
  out.push(L(k.pathOf([at(onDial(GAUGE.r - 7.2, angleOf(HOSE.working))), at(onDial(bezel, angleOf(HOSE.working)))]), { tone: "hi", free: "start" }));
  for (const v of [0, 20, 40]) {
    const [x, y, z] = onDial(GAUGE.r - 9, angleOf(v));
    out.push(k.faceTextSvg(k.sideMatrix([x, y], z - 1, P, "right"), String(v), { size: 2.6, tone: "lo", anchor: "middle" }));
  }
  out.push(k.faceTextSvg(k.sideMatrix([GAUGE.x1 + 0.01, 0], GAUGE.z - 9.2, P, "right"), "MPa", { size: 2.2, tone: "lo", anchor: "middle" }));
  out.push(`<path class="iso-line" data-tone="hi" data-needle data-free="both" d="${needleD(0)}" style="stroke-width:1.1"/>`);
  out.push(Dt([at(onDial(0, 0))], { size: 0.9, tone: "hi" }));
  return out.join("");
}

const PUMP_SVG = () => pumpBarrel() + `<g clip-path="url(#hh-rod)"><g data-plunger>${pumpRod()}</g></g><g data-plunger>${pumpHandle()}</g>`;

// ---------- the fitting ----------
function adapter() {
  const out = [S(G.prismOf(F, hexAround(ADAPTER_HEX[2]), ADAPTER_HEX[0], ADAPTER_HEX[1], P), { tone: "mid" })];
  const [s0, s1, r] = THREAD;
  const threads = [];
  for (let s = s0 + 0.8; s < s1 - 0.4; s += HOSE.thread) threads.push(G.arcOf(F, s, r, P));
  out.push(S(G.disc(s0, s1, r, F, P), { tone: "hi", inner: L(threads.join(""), { tone: "lo" }) }));
  return out.join("");
}
function nut() {
  const [s0, s1, apo] = NUT;
  return S(G.prismOf(F, hexAround(apo), s0, s1, P), { tone: "hi" });
}
function collar() {
  const [s0, s1, r] = COLLAR;
  return S(G.solidOf([[s0, r - 0.6], [s0 + 0.6, r, 1], [s1, r]], F, P), { tone: "hi" });
}
function ferrule() {
  const [s0, s1] = M.ferrule;
  const R = 13.5;
  const body = G.solidOf([[s0, COVER_R + 0.4], [s0 + 1.6, R], [s1 - 3.2, R], [s1 - 2, 12.4], [s1, 12.4]], F, P);
  // eight crimp-die flats leave eight faint lines; two rolled seams near the ends
  const dies = G.ribsOf(F, s0 + 4, s1 - 6, R, 8, P, { phase: Math.PI / 8 });
  const seams = [s0 + 4, s1 - 6].map((s) => G.arcOf(F, s, R, P)).join("");
  return S(body, { tone: "hi", inner: L(dies, { tone: "faint" }) + L(seams, { tone: "lo" }) });
}

// ---------- assemble ----------
const OFF0 = STEPS_OFF(0);
const hose0 = hoseSvg(K, M, P, OFF0, 0);
const part = (id, svg, extra = "") => `<g data-part="${id}"${extra}>${svg}</g>`;

const FIGURE_LABEL =
  "A half-inch hydraulic hose lying in two cradles on a bench plate, its crimped fitting screwed into a test block with a hand pump and a pressure gauge. Taken apart, its layers slide out of the cut end one by one: the outer cover, an outer steel braid, a thin rubber layer, an inner steel braid and the rubber tube that carries the oil.";
const BODY = [
  `<defs><clipPath id="hh-rod"><path d="${rodClip}"/></clipPath></defs>`,
  plate(),
  ...CRADLES.map((cx) => cradle(cx, false)),
  part("tester", block() + (depth(PUMP.x, PUMP.y) < depth(GAUGE.x1, GAUGE.y) ? PUMP_SVG() + gauge() : gauge() + PUMP_SVG())),
  part("fitting", adapter() + nut() + collar()),
  `<g data-part="cover" data-hose-behind>${hose0.behind}</g>`,
  part("fitting", ferrule(), " data-ferrule"),
  `<g data-hose-front>${hose0.front}</g>`,
  ...CRADLES.map((cx) => cradle(cx, true)),
];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });
// A standalone .svg is XML: every attribute needs a value.
const xmlSafe = (text) => text.replace(/ (data-[\w-]+)(?=[\s>\/])/g, ' $1=""');
// The thumbnail shows it apart down to the tube, so the layers read at a glance.
const hoseThumb = hoseSvg(K, M, P, STEPS_OFF(4), 0);
const THUMB = BODY.map((b) => b.replace(hose0.behind, hoseThumb.behind).replace(hose0.front, hoseThumb.front));
if (theme === "light") writeFileSync(join(HERE, "thumb.svg"), xmlSafe(k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: THUMB, standalone: "light" })));

// ---------- steps and parts ----------
const STEPS = [
  { say: `½ in · ${HOSE.spec} · ${HOSE.working} MPa`, next: "Cut back the cover" },
  { say: "outer braid showing", next: "Cut back the braid" },
  { say: "middle layer showing", next: "Cut back the middle layer" },
  { say: "inner braid showing", next: "Cut back the inner braid" },
  { say: `tube showing · ${HOSE.id} mm bore`, next: "Slide back the ferrule" },
  { say: "ferrule back · hose on the nipple", next: "Put it back together" },
];
const PARTS = [
  { id: "tube", step: 4, title: "Tube", fact: `tube · oil-resistant rubber · ${HOSE.id} mm bore`, text: "The only layer that touches the oil: a seamless tube of synthetic rubber (usually nitrile) that keeps the fluid in. It seals, but it would burst at a small fraction of the working pressure on its own." },
  { id: "braid", step: 3, title: "Braids", fact: `braids · two layers of steel wire at ${HOSE.angle}°`, text: `Two braids of high-tensile steel wire carry the load. They're laid at about ${HOSE.angle}°, the "neutral angle": there, the pull along the hose and the pull around it balance, so under pressure the hose barely grows longer or shorter. A second braid is what lifts a ½ in hose from about 16 MPa (one braid, R1) to ${HOSE.working} MPa (R2).` },
  { id: "mid", step: 2, title: "Middle layer", fact: "middle layer · a thin rubber friction layer", text: "A thin layer of rubber between the braids bonds them together and stops the two wire layers rubbing through each other as the hose flexes and pulses." },
  { id: "cover", step: 1, title: "Cover", fact: `cover · ${HOSE.od} mm outside, printed with its rating`, text: "Tough synthetic rubber that keeps water and grit off the wire, which would otherwise rust and fray. It carries the layline: the standard, the size, the working pressure and the date, so a fitter can tell exactly what the hose is." },
  { id: "fitting", step: 5, title: "Fitting", fact: `fitting · crimped ferrule, nipple and ${HOSE.dash} JIC nut`, text: "A barbed nipple goes inside the hose and a steel ferrule goes over it. A crimping press squeezes the ferrule down, pinching the hose between them for good. The swivel nut seals on a 37° cone (JIC), so it can be done up without twisting the hose." },
  { id: "tester", step: 0, title: "Test bench", fact: `test · working ${HOSE.working} MPa, burst ≥ ${HOSE.burst} MPa`, text: `Each stroke of the hand pump pushes a little more oil into a closed hose, and the gauge climbs. The rated working pressure is ${HOSE.working} MPa (${HOSE.psi.toLocaleString("en")} psi); the hose must hold at least four times that, ${HOSE.burst} MPa, before it bursts. It shouldn't be bent tighter than ${HOSE.bend} mm in radius.` },
];

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  EX: unit([1, 0, 0]), EZ: unit([0, 0, 1]),
  P, M, telescope: TELESCOPE, ferruleBack: FERRULE_BACK,
  steps: STEPS,
  parts: Object.fromEntries(PARTS.map(({ id, step, fact }) => [id, { step, fact }])),
  working: HOSE.working, psi: HOSE.psi, max: GAUGE_MAX, stroke: PUMP.stroke,
  gauge: GAUGE, sweep: SWEEP,
};

const live = `
const D = ${JSON.stringify(DATA)};
const hoseSvg = ${hoseSvg.toString()};
const LAST = D.steps.length - 1;
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const liveText = document.querySelector("[data-live]");
const prev = document.querySelector("[data-prev]");
const next = document.querySelector("[data-next]");
const dots = [...document.querySelectorAll("[data-dot]")];
const items = [...document.querySelectorAll("[data-select]")];
const pressButton = document.querySelector("[data-press]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const behindEl = stage.querySelector("[data-hose-behind]");
const frontEl = stage.querySelector("[data-hose-front]");
const ferruleEl = stage.querySelector("[data-ferrule]");
const plungers = [...stage.querySelectorAll("[data-plunger]")];
const needle = stage.querySelector("[data-needle]");
const N = D.M.layers.length;
const at = (p) => K.iso(p, D.P);
const onDial = (r, a) => [D.gauge.x1 + 0.01, D.gauge.y - r * Math.cos(a), D.gauge.z + r * Math.sin(a)];
const angleOf = (mpa) => (225 * Math.PI) / 180 - (D.sweep * Math.min(D.max, Math.max(0, mpa))) / D.max;
const needleD = (mpa) => K.pathOf([at(onDial(-2.6, angleOf(mpa))), at(onDial(D.gauge.r - 4.6, angleOf(mpa)))]);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.01 ? target : nx; };
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };

let step = 0, selected = null, job = null, pressure = 0, plunge = 0;
let touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0;
const off = D.M.layers.map(() => 0);
let fer = 0, shownKey = "";

const goalOff = () => D.M.layers.map((_, i) => (i === 0 ? 0 : D.telescope * Math.min(step, i)));
const goalFer = () => (step >= 5 ? D.ferruleBack : 0);
const settled = () => goalOff().every((g, i) => g === off[i]) && fer === goalFer();
const fmt = (mpa) => mpa.toFixed(1) + " MPa · " + Math.round((mpa * D.psi) / D.working).toLocaleString("en") + " psi";

function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }

function setStep(n) {
  n = Math.max(0, Math.min(LAST, n));
  if (job && job.t >= 0) return;
  if (n === step) return;
  step = n;
  controls();
  if (!touring) announce(D.steps[step].say);
  run();
}

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const g of stage.querySelectorAll("[data-part]")) { if (id && g.dataset.part === id) g.setAttribute("data-on", ""); else g.removeAttribute("data-on"); }
  if (id) stage.setAttribute("data-focus", ""); else stage.removeAttribute("data-focus");
  for (const item of items) { if (item.dataset.select === id) item.setAttribute("data-on", ""); else item.removeAttribute("data-on"); }
  if (id) announce(D.parts[id].fact);
  place();
}

function controls() {
  prev.disabled = step === 0 || !!job;
  next.disabled = !!job;
  next.querySelector("span").textContent = D.steps[step].next;
  next.setAttribute("aria-label", D.steps[step].next);
  dots.forEach((dot, index) => (index < step ? dot.setAttribute("data-on", "") : dot.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(step));
  stage.setAttribute("aria-valuetext", D.steps[step].say);
  pressButton.disabled = !!job;
}

// The pressure test: reassemble, six strokes of the pump, hold, release.
const STROKES = 6, STROKE = 0.62, HOLD = 1.8, RELEASE = 1.1;
function pressurize() {
  hold();
  if (job) return;
  select(null);
  job = { t: -1 };
  if (step !== 0) setStep(0);
  controls();
  run();
}
function runJob(dt) {
  if (job.t < 0) { if (step === 0 && settled()) job.t = 0; return; }
  if (still.matches) { pressure = 0; plunge = 0; job = null; announce("held " + fmt(D.working)); controls(); return; }
  job.t += dt;
  const pumping = STROKES * STROKE;
  if (job.t < pumping) {
    const k = Math.floor(job.t / STROKE), phase = (job.t % STROKE) / STROKE;
    const down = phase < 0.55 ? ease(phase / 0.55) : 1 - ease((phase - 0.55) / 0.45);
    plunge = down;
    pressure = (D.working * (k + (phase < 0.55 ? ease(phase / 0.55) : 1))) / STROKES;
  } else if (job.t < pumping + HOLD) { plunge = 0; pressure = D.working; }
  else if (job.t < pumping + HOLD + RELEASE) { pressure = D.working * (1 - ease((job.t - pumping - HOLD) / RELEASE)); }
  else { pressure = 0; job = null; announce(D.steps[0].say); controls(); }
}

function rebuild() {
  const key = off.map((o) => o.toFixed(1)).join(",") + "|" + fer.toFixed(1);
  if (key === shownKey) return;
  shownKey = key;
  const svg = hoseSvg(K, D.M, D.P, off, fer);
  behindEl.innerHTML = svg.behind;
  frontEl.innerHTML = svg.front;
  if (selected) { const id = selected; selected = null; select(id); }
}

function place() {
  rebuild();
  setT(ferruleEl, [D.EX[0] * fer, D.EX[1] * fer]);
  for (const p of plungers) setT(p, [-D.EZ[0] * D.stroke * plunge, -D.EZ[1] * D.stroke * plunge]);
  needle.setAttribute("d", needleD(pressure));
  const text = job && job.t >= 0 ? (job.t < STROKES * STROKE ? "pumping · " : pressure >= D.working - 0.01 ? "holding · " : "releasing · ") + fmt(pressure)
    : selected ? D.parts[selected].fact
    : !settled() ? (step === 0 ? "putting together" : D.steps[step].say)
    : D.steps[step].say;
  if (readout.textContent !== text) readout.textContent = text;
}

const TOUR = 1.7;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring && !job) {
    tourClock += dt;
    const beat = Math.floor(tourClock / TOUR) % (2 * (LAST + 1));
    setStep(beat <= LAST ? beat : 2 * LAST + 1 - beat);
  }
  const g = goalOff();
  for (let i = 0; i < N; i++) off[i] = still.matches ? g[i] : follow(off[i], g[i], 7, dt);
  fer = still.matches ? goalFer() : follow(fer, goalFer(), 6, dt);
  if (job) runJob(dt);
  place();
  frame = visible && (!settled() || job || touring) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

function hold() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (still.matches || selected || stage.matches(":hover, :focus-within")) return hold();
    touring = true;
    tourClock = step * TOUR;
    run();
  }, 8000);
}
const go = (n) => { hold(); if (!job) setStep(n); };
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
  const keys = { ArrowRight: () => go(step + 1), ArrowDown: () => go(step + 1), ArrowLeft: () => go(step - 1), ArrowUp: () => go(step - 1), Home: () => go(0), End: () => go(LAST), " ": forward, Enter: forward, Escape: () => { hold(); select(null); go(0); }, p: pressurize, P: pressurize };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
prev.addEventListener("click", () => go(step - 1));
next.addEventListener("click", forward);
pressButton.addEventListener("click", pressurize);

for (const item of items) {
  const id = item.dataset.select;
  item.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") { hold(); select(id); } });
  item.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
  const pick = () => { hold(); select(id); if (!job) setStep(D.parts[id].step); };
  item.addEventListener("click", pick);
  item.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } });
  item.addEventListener("focus", () => { hold(); select(id); });
  item.addEventListener("blur", () => select(null));
}
controls();
place();
`;

const plateBody = k.plateHtml({
  fig: "Fig 3",
  title: `Hydraulic hose · ${HOSE.spec}`,
  hint: "← → take apart · P pressurize · F expand",
  readout: STEPS[0].say,
  keys: [
    { mark: "lit", label: "The steel braids: the only layers that hold the pressure" },
    { mark: "raised", label: "Tube, rubber layers, cover and fitting: everything that seals and protects them" },
  ],
  caption: `A half-inch two-braid hose (${HOSE.spec}): a ${HOSE.id} mm rubber tube, two steel braids laid at the ${HOSE.angle}° neutral angle with a thin rubber layer between them, and a ${HOSE.od} mm rubber cover. A crimped fitting joins it to a test block. Pump it to its working pressure of ${HOSE.working} MPa (${HOSE.psi.toLocaleString("en")} psi) and it is a quarter of the way to bursting: the standard asks for at least ${HOSE.burst} MPa.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Hydraulic hose. Arrow keys take it apart one layer at a time, P pressurizes it; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="${STEPS[0].say}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Put the last layer back" disabled>←</button><span class="pc-dots" aria-hidden="true">${STEPS.slice(1).map(() => "<i data-dot></i>").join("")}</span><button type="button" class="pc-btn pc-press" data-press aria-keyshortcuts="P"><span>Pressurize</span></button><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const ARTICLE_CSS = `
.iso-stage [data-part]{cursor:pointer}
.iso-stage[data-focus] [data-part]:not([data-on]) *{stroke:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-fill{fill:var(--anatomy-paper)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-top{fill:var(--anatomy-top)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-shade{fill:var(--anatomy-shade-3)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) text{fill:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-dots circle{opacity:.1!important}
.pc-controls{position:relative;display:flex;align-items:center;gap:12px;margin-top:-34px;padding:0 16px 14px;font:12px/1 var(--anatomy-mono,ui-monospace,Menlo,monospace);z-index:1}
.pc-btn{font:inherit;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-mid);padding:7px 10px;cursor:pointer;min-height:30px}
.pc-btn:hover{border-color:var(--anatomy-strong)}
.pc-btn:disabled{color:var(--anatomy-lo);border-color:var(--anatomy-faint);cursor:default}
.pc-press{margin-left:auto}
.pc-dots{display:flex;gap:5px}
.pc-dots i{width:6px;height:6px;border:1px solid var(--anatomy-mid);border-radius:50%}
.pc-dots i[data-on]{background:var(--anatomy-strong);border-color:var(--anatomy-strong)}
.pc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iso-plate{padding-bottom:84px}
@media (max-width:600px){.pc-controls{flex-wrap:wrap;margin-top:8px;padding:0 4px 4px}.iso-plate{padding-bottom:72px}}
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
<header class="pc-head"><h1>Anatomy of a hydraulic hose</h1><p>It looks like a rubber tube. The rubber only seals; two layers of steel wire do the holding.</p></header>
${plateBody}
<section class="pc-parts"><h2>The parts</h2><p class="tip">Point at a part to find it in the figure; click it to take the hose apart down to it.</p><ol>${PARTS.map(({ id, title, text }, index) => `<li data-select="${id}" tabindex="0" role="button" aria-label="${title}: show it in the figure"><span class="num">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></li>`).join("")}</ol></section>`;

const name = theme === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomy of a hydraulic hose", theme, body, script: kitBundle() + live + EXPAND_JS }));
console.log("wrote", name);
