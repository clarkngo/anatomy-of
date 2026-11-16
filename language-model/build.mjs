// Anatomy of a language model: builds language-model/index.html (light) or dark.html (--dark).
// One tall machine, read top to bottom: the context sits on a shelf, each word drops its own
// column through a stack of layers, attention threads tie the last column back to the earlier
// ones, the last column runs into a scoring head, pistons lift the candidate words to their
// scores and then their odds, a pin draws one, and the winner flies back up into the context.
// Uses the Anatomy kit (MIT, vendored in tools/anatomy). The numbers are a small toy model.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../tools/anatomy/kit/lathe.mjs";
import { kitScript } from "../tools/anatomy/scripts/inline-kit.mjs";
import { EXPAND_BUTTON, EXPAND_CSS, EXPAND_JS } from "../tools/expand.mjs";
import { CONTRAST_CSS } from "../tools/contrast.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

// ---------- the model (toy numbers, true arithmetic) ----------
// For each context: the candidates and their scores, and per layer how strongly the last word
// attends to each earlier word (each row sums to 1 over the four earlier words).
const CONTEXTS = [
  {
    words: ["the", "cat", "sat", "on", "the"],
    cands: ["mat", "floor", "sofa", "bed", "roof", "moon"],
    logits: [3.0, 2.2, 1.6, 1.3, 0.4, -1.0],
    attn: [[0.1, 0.15, 0.2, 0.55], [0.05, 0.6, 0.25, 0.1], [0.05, 0.3, 0.55, 0.1], [0.1, 0.45, 0.3, 0.15]],
  },
  {
    words: ["the", "ship", "sailed", "on", "the"],
    cands: ["sea", "ocean", "river", "waves", "lake", "road"],
    logits: [3.2, 2.6, 1.4, 1.2, 0.8, -1.2],
    attn: [[0.1, 0.15, 0.2, 0.55], [0.05, 0.65, 0.2, 0.1], [0.05, 0.25, 0.6, 0.1], [0.1, 0.5, 0.3, 0.1]],
  },
  {
    words: ["the", "bird", "flew", "over", "the"],
    cands: ["trees", "house", "city", "river", "clouds", "moon"],
    logits: [2.4, 2.2, 2.0, 1.6, 1.4, 0.2],
    attn: [[0.1, 0.15, 0.25, 0.5], [0.05, 0.55, 0.3, 0.1], [0.05, 0.3, 0.45, 0.2], [0.1, 0.4, 0.35, 0.15]],
  },
];
const TEMPS = [0.25, 0.5, 1, 1.5, 2];
const T0 = 2;
const softmax = (logits, t) => {
  const top = Math.max(...logits);
  const e = logits.map((z) => Math.exp((z - top) / t));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / sum);
};
const N = 6; // candidates shown
const CTX = CONTEXTS[0];

// ---------- world (z up; the viewer sees the +x and +y faces) ----------
const W = 560;
const H = 720;
const PITCH = 24;
const posX = (i) => -60 + i * PITCH; // context slots 0..5 and piston columns 0..5 share one pitch
const TILE = { w: 22, d: 8, h: 11 };
const PLINTH = { x: -100, y: -40, w: 200, d: 98, r: 6 };
const PLINTH_H = 10;
const POSTS = [[-90, -26], [90, -26], [-90, 26], [90, 26]];
const POST_R = 2.6;

// top shelf with the context
const SHELF = { x: -92, y: -10, w: 184, d: 20, r: 2 };
const SHELF_Z = 254;
const SHELF_H = 5;
const TILE_Z = SHELF_Z + SHELF_H;
const SLOT = 5; // the empty slot

// layers
const LAYERS = [100, 140, 180, 220]; // plate bottoms
const PLATE = { x: -84, y: -12, w: 168, d: 24, r: 3 };
const PLATE_H = 3.4;
const ROD_R = 1.5;
const BEAD = { r: 2.5, h: 1.6, up: 9 }; // thread anchors, this far above each plate
const LAST = 4; // the last context position: its column runs on into the scoring head

// scoring head, pistons, panel
const HEAD = { x: -70, y: -7, w: 140, d: 14, r: 2 };
const HEAD_Z = [74, 86];
const SLEEVE = { w: 15, d: 13, h: 8 };
const PISTON = { w: 8, d: 7 };
const CAND = { w: 22, d: 8, h: 10 };
const RISE = 48; // piston travel for p = 1
const LOGIT_FLOOR = -1.5;
const LOGIT_SCALE = 8.5;
const PANEL = { x: -72, y: -24, w: 144, d: 4, r: 1 };
const PANEL_H = HEAD_Z[1];

// tape and carriage, on the plinth front
const TAPE = { x: posX(0) - CAND.w / 2, len: 5 * PITCH + CAND.w, y: 22, d: 12 };
const TAPE_Z = 1.2;
const CARR_RAIL = { x: TAPE.x - 6, y: TAPE.y + TAPE.d + 2, w: TAPE.len + 12, d: 5, r: 1 };
const CARR = { w: 10, d: 9, h: 6 };

// temperature knob on the plinth's front right
const KNOB = [88, 46];
const KNOB_R = 6;
const KNOB_Z = [3, 8];
const DIAL_R = 9.5;
const KNOB_SPAN = (Math.PI * 4) / 3;
const knobAngle = (i) => Math.PI / 2 - KNOB_SPAN / 2 + (KNOB_SPAN * i) / (TEMPS.length - 1) + Math.PI;

const P = k.fitProjection(
  [...k.boxCorners(PLINTH, -PLINTH_H - 5, 0), [SHELF.x, SHELF.y, TILE_Z + TILE.h + 2], [SHELF.x + SHELF.w, SHELF.y + SHELF.d, TILE_Z + TILE.h + 2], [-92, 26, SHELF_Z + 8], [92, -26, SHELF_Z + 8]],
  W,
  H,
  { pad: 14, azimuth: 60 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const box = (cx, cy, w, d, r = 0.8) => ({ x: cx - w / 2, y: cy - d / 2, w, d, r });
const screws = (list, z, size = 0.45) => Dt(list.map(([x, y]) => at([x, y, z])), { size });
const part = (id, svg, extra = "") => `<g data-part="${id}"${extra}>${svg}</g>`;

// ---------- parts ----------
function plinth() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLINTH, -PLINTH_H - 5, PLINTH_H, P)}"/>`];
  for (const [x, y] of k.corners(PLINTH, 12)) {
    out.push(S(k.cylinder(x, y, 6, -PLINTH_H - 5, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -PLINTH_H - 3.6, 3.6, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLINTH, -PLINTH_H, PLINTH_H, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(PLINTH, -PLINTH_H + 3, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 4), 0, P), { tone: "lo" }));
  const corners = k.corners(PLINTH, 7.5);
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 1.9, 0, P, 16)).join(""), { tone: "lo" }), Dt(corners.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // engraved label on the plinth's front face
  out.push(k.faceTextSvg(k.sideMatrix([PLINTH.x + 10, PLINTH.y + PLINTH.d], -3.4, P, "left"), "NEXT WORD · TOY MODEL", { size: 3.6, tone: "lo" }));
  return out.join("");
}

const post = ([x, y]) => S(k.cylinder(x, y, POST_R, 0, SHELF_Z + SHELF_H + 3, P, 18), { tone: "mid" }) + S(k.cylinder(x, y, POST_R + 1.2, 0, 3, P, 18), { tone: "mid" }) + Dt([at([x, y, SHELF_Z + SHELF_H + 3])], { size: 0.5 });

function crossbar(y) {
  const bar = { x: -90, y: y - 2, w: 180, d: 4, r: 1 };
  return S(k.slabOf(bar, SHELF_Z - 2, 4, P, 2, 0.3), { tone: "mid" }) + screws([[-84, y], [84, y]], SHELF_Z + 2, 0.4);
}

// a word tile, with its word on the front face (the text has an id so the page can change it)
function tileSvg(cx, cy, z, word, size, key) {
  const plan = box(cx, cy, size.w, size.d, 1.4);
  const face = cy + size.d / 2;
  const inner = L(k.pathOf([at([plan.x + 1.8, face, z + 1.6]), at([plan.x + plan.w - 1.8, face, z + 1.6])]), { tone: "faint" }) + screws([[plan.x + 1.8, face], [plan.x + plan.w - 1.8, face]].map(([x, y]) => [x, y]), z + 1.6, 0.35).replace(/cy="([\d.]+)"/g, (m) => m);
  const text = k.faceTextSvg(k.sideMatrix([cx, face], z + 3.6, P, "left"), word, { size: word.length > 5 ? 4.6 : 5.6, tone: "hi", anchor: "middle" }).replace("<text ", `<text data-word="${key}" `);
  return S(k.slabOf(plan, z, size.h, P, 3, 0.7), { tone: "hi", inner: inner + text });
}

function shelf() {
  const out = [S(k.slabOf(SHELF, SHELF_Z, SHELF_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(SHELF, SHELF_Z + 1.8, P, 3), { tone: "faint" }) })];
  // a socket under every slot: the top of each column
  for (let i = 0; i <= SLOT; i++) out.push(L(k.planOutline(box(posX(i), 0, TILE.w + 1.2, TILE.d + 1.2, 1.6), TILE_Z, P, 3), { tone: "lo" }));
  // the empty slot: a dashed outline and a caret
  out.push(`<g data-caret>${L(k.lineOnTop([posX(SLOT) - 5, 3], [posX(SLOT) - 5, -3], TILE_Z, P), { tone: "hi", free: "both" })}</g>`);
  return out.join("");
}

// a column: one rod per context word, from the shelf down to the bottom plate (the last one runs on)
const rod = (x, z0, z1) => S(k.cylinder(x, 0, ROD_R, z0, z1 - z0, P, 14), { tone: "mid", crease: "none" });

function plate(z, index) {
  const out = [S(k.slabOf(PLATE, z, PLATE_H, P, 4, 0.5), { tone: "hi", inner: L(k.sideSeam(PLATE, z + 1.2, P, 4), { tone: "faint" }) })];
  // where the columns pass through, and a layer number engraved on the front edge
  out.push(L(Array.from({ length: 5 }, (_, i) => k.ring(posX(i), 0, ROD_R + 1, z + PLATE_H, P, 18)).join(""), { tone: "lo" }));
  out.push(k.faceTextSvg(k.sideMatrix([PLATE.x + 4, PLATE.y + PLATE.d], z + 0.6, P, "left"), `L${index + 1}`, { size: 2.6, tone: "lo" }));
  out.push(screws([[PLATE.x + 2.5, 0], [PLATE.x + PLATE.w - 2.5, 0]], z + PLATE_H, 0.4));
  // brackets to the back posts
  for (const x of [-92, 84]) out.push(S(k.slabOf({ x, y: -27, w: 8, d: 15.5, r: 0.6 }, z + 0.4, 2.6, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

// attention threads at one layer: from the last column back to each earlier one, hanging a little
const threadZ = (layer) => LAYERS[layer] + PLATE_H + BEAD.up;
function thread(layer, j) {
  const z = threadZ(layer) + BEAD.h / 2;
  const a = [posX(j) + BEAD.r, 0, z];
  const b = [posX(LAST) - BEAD.r, 0, z];
  const span = b[0] - a[0];
  const pts = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return at([a[0] + span * t, 0, z - Math.sin(Math.PI * t) * (1.5 + span * 0.05)]);
  });
  return `<path class="iso-line lm-thread" data-thread="${layer}-${j}" d="${k.pathOf(pts)}"/>`;
}
const bead = (layer, i) => S(k.cylinder(posX(i), 0, BEAD.r, threadZ(layer), BEAD.h, P, 16), { tone: i === LAST ? "hi" : "mid", crease: "none" });

function layerBand(layer) {
  // rods from this plate's top up to the next plate (or the shelf), with this layer's beads and threads
  const z0 = LAYERS[layer] + PLATE_H;
  const z1 = layer < LAYERS.length - 1 ? LAYERS[layer + 1] : SHELF_Z;
  const out = [];
  for (let i = 0; i < 5; i++) out.push(rod(posX(i), z0, z1), bead(layer, i));
  out.push(`<g data-threads="${layer}">${[0, 1, 2, 3].map((j) => thread(layer, j)).join("")}</g>`);
  return out.join("");
}

function head() {
  const out = [S(k.slabOf(HEAD, HEAD_Z[0], HEAD_Z[1] - HEAD_Z[0], P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(HEAD, HEAD_Z[0] + 4, P, 3), { tone: "faint" }) })];
  out.push(k.faceTextSvg(k.sideMatrix([HEAD.x + 5, HEAD.y + HEAD.d], HEAD_Z[0] + 2.6, P, "left"), "SCORES", { size: 2.8, tone: "lo" }));
  // the last column enters through a gland on top
  out.push(S(k.cylinder(posX(LAST), 0, 3.4, HEAD_Z[1], 2.4, P, 18), { tone: "mid" }));
  // an output port above every piston, on the underside's front edge
  out.push(Dt(Array.from({ length: N }, (_, i) => at([posX(i), HEAD.y + HEAD.d, HEAD_Z[0] + 1.4])), { size: 0.55, tone: "hi" }));
  out.push(screws([[HEAD.x + 3, 0], [HEAD.x + HEAD.w - 3, 0]], HEAD_Z[1], 0.4));
  return out.join("");
}

function panel() {
  const out = [S(k.slabOf(PANEL, 0, PANEL_H, P, 2, 0.4), { tone: "mid" })];
  const face = PANEL.y + PANEL.d;
  const z0 = SLEEVE.h;
  let minor = "", major = "";
  for (let i = 0; i <= 20; i++) (i % 5 ? (minor += k.pathOf([at([PANEL.x + 0.3, face, z0 + (RISE * i) / 20]), at([PANEL.x + 3.4, face, z0 + (RISE * i) / 20])])) : (major += k.pathOf([at([PANEL.x + 0.3, face, z0 + (RISE * i) / 20]), at([PANEL.x + 5, face, z0 + (RISE * i) / 20])])));
  out.push(L(minor, { tone: "lo", free: "end" }), L(major, { tone: "mid", free: "end" }));
  for (const [z, text] of [[z0, "0"], [z0 + RISE / 2, "50"], [z0 + RISE, "100%"]]) out.push(k.faceTextSvg(k.sideMatrix([PANEL.x + 6, face], z - 1, P, "left"), text, { size: 2.6, tone: "lo" }));
  // a guide slot behind each piston, ending on a stop screw at each end
  for (let i = 0; i < N; i++) {
    const x = posX(i);
    out.push(L(k.pathOf([at([x, face, z0 + 2]), at([x, face, z0 + RISE + CAND.h])]), { tone: "faint" }), Dt([at([x, face, z0 + 2]), at([x, face, z0 + RISE + CAND.h])], { size: 0.4 }));
  }
  return out.join("");
}

function sleeve(i) {
  const plan = box(posX(i), 0, SLEEVE.w, SLEEVE.d, 1);
  return S(k.slabOf(plan, 0, SLEEVE.h, P, 3, 0.5), { tone: "mid" }) + L(k.planOutline(box(posX(i), 0, PISTON.w + 1.6, PISTON.d + 1.6, 0.6), SLEEVE.h, P, 2), { tone: "lo" });
}
const pistonSvg = (i, rise) => S(k.slabOf(box(posX(i), 0, PISTON.w, PISTON.d, 0.6), SLEEVE.h - 0.5, Math.max(0.6, rise) + 0.5, P, 2), { tone: "mid" });

function tape() {
  const out = [];
  const strip = { x: TAPE.x - 3, y: TAPE.y, w: TAPE.len + 6, d: TAPE.d, r: 1 };
  out.push(S(k.slabOf(strip, 0, TAPE_Z, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(TAPE.x, TAPE.x + TAPE.len, TAPE.len / 20, 5, TAPE.y + TAPE.d, TAPE_Z, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([TAPE.x, TAPE.y + 1.2], [TAPE.x + TAPE.len, TAPE.y + 1.2], TAPE_Z, P) + k.lineOnTop([TAPE.x, TAPE.y + 0.8], [TAPE.x, TAPE.y + TAPE.d], TAPE_Z, P) + k.lineOnTop([TAPE.x + TAPE.len, TAPE.y + 0.8], [TAPE.x + TAPE.len, TAPE.y + TAPE.d], TAPE_Z, P), { tone: "mid" }));
  for (const x of [TAPE.x - 7, TAPE.x + TAPE.len + 3]) out.push(S(k.slabOf({ x, y: TAPE.y - 1, w: 4, d: CARR_RAIL.y + CARR_RAIL.d - TAPE.y + 1, r: 0.8 }, 0, 4, P, 2, 0.3), { tone: "mid" }), screws([[x + 2, TAPE.y + 2]], 4, 0.4));
  out.push(S(k.slabOf(CARR_RAIL, 0, 2.2, P, 2, 0.3), { tone: "mid" }));
  out.push(L(k.lineOnTop([CARR_RAIL.x + 3, CARR_RAIL.y + 2.5], [CARR_RAIL.x + CARR_RAIL.w - 3, CARR_RAIL.y + 2.5], 2.2, P), { tone: "faint" }), screws([[CARR_RAIL.x + 3, CARR_RAIL.y + 2.5], [CARR_RAIL.x + CARR_RAIL.w - 3, CARR_RAIL.y + 2.5]], 2.2, 0.4));
  return out.join("");
}
const dividerSvg = () => S(k.slabOf({ x: -0.5, y: TAPE.y + 0.4, w: 1, d: TAPE.d - 0.8, r: 0.2 }, TAPE_Z, 3.2, P, 1), { tone: "mid", crease: "none" });
const segText = (word, i) => k.faceTextSvg(k.topMatrix([0, TAPE.y + 8.4], TAPE_Z, P, "x"), word, { size: 3.6, tone: "hi", anchor: "middle" }).replace("<text ", `<text data-word="seg-${i}" `);

function carriage() {
  const x = TAPE.x;
  const plan = box(x, CARR_RAIL.y + CARR_RAIL.d / 2, CARR.w, CARR.d, 1.2);
  const out = [S(k.slabOf(plan, 2.2, CARR.h, P, 3, 0.5), { tone: "mid" })];
  out.push(screws([[plan.x + 2, plan.y + 2], [plan.x + plan.w - 2, plan.y + plan.d - 2]], 2.2 + CARR.h, 0.4));
  const arm = { x: x - 1, y: TAPE.y + 3, w: 2, d: plan.y + 2 - TAPE.y - 3, r: 0.4 };
  out.push(S(k.slabOf(arm, 2.2 + CARR.h - 1.6, 1.6, P, 1), { tone: "hi" }));
  out.push(S(k.cylinder(x, TAPE.y + 4, 0.9, TAPE_Z, 2.2 + CARR.h - 1.6 - TAPE_Z, P, 12), { tone: "hi", lit: true }));
  out.push(Dt([at([x, TAPE.y + 4, 2.2 + CARR.h])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

function knobPointer(a) {
  const [cx, cy] = KNOB;
  return k.lineOnTop([cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.2], [cx + Math.cos(a) * (KNOB_R - 1.6), cy + Math.sin(a) * (KNOB_R - 1.6)], KNOB_Z[1], P);
}
function knob() {
  const [cx, cy] = KNOB;
  const out = [S(k.cylinder(cx, cy, DIAL_R + 1.5, 0, 1.2, P, 36), { tone: "mid" })];
  out.push(L(TEMPS.map((_, i) => {
    const a = knobAngle(i);
    return k.lineOnTop([cx + Math.cos(a) * (KNOB_R + 1.2), cy + Math.sin(a) * (KNOB_R + 1.2)], [cx + Math.cos(a) * (DIAL_R - (i === T0 ? 0 : 0.8)), cy + Math.sin(a) * (DIAL_R - (i === T0 ? 0 : 0.8))], 1.2, P);
  }).join(""), { tone: "mid", free: "both" }));
  out.push(S(k.cylinder(cx, cy, KNOB_R, KNOB_Z[0] - 1.8, 1.8, P, 30), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, KNOB_R - 0.8, KNOB_Z[0], KNOB_Z[1] - KNOB_Z[0], P, 30), { tone: "hi" }));
  out.push(L(k.knurl(cx, cy, KNOB_R - 0.8, KNOB_Z[0], KNOB_Z[1], 24, P), { tone: "lo" }));
  out.push(`<path class="iso-line" data-tone="hi" data-knob data-free="both" d="${knobPointer(knobAngle(T0))}" style="stroke-width:1.1"/>`);
  out.push(Dt([at([cx, cy, KNOB_Z[1]])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// ---------- assemble, back to front and bottom to top ----------
const probs0 = softmax(CTX.logits, TEMPS[T0]);
const [backL, backR, frontL, frontR] = POSTS;
const FIGURE_LABEL =
  "A tall machine on a plinth. On a shelf at the top, five word tiles read 'the cat sat on the', with one empty slot. Under each tile a column drops through four layer plates; at each layer, threads tie the last column back to the earlier ones, thicker where it pays more attention. The last column runs on into a scoring head, under which six pistons lift the candidate words to their scores and then their odds. In front, a tape divided into those odds and a pin that draws one; the chosen word flies back up into the empty slot.";

const BODY = [
  plinth(),
  post(backL), post(backR),
  part("scores", panel()),
  ...Array.from({ length: N }, (_, i) => part("scores", sleeve(i) + `<g data-piston="${i}">${pistonSvg(i, 0)}</g>` + `<g data-home="${i}"><g data-tile="${i}">${tileSvg(posX(i), 0, SLEEVE.h, CTX.cands[i], CAND, `cand-${i}`)}</g></g>`)),
  part("scores", rod(posX(LAST), HEAD_Z[1] + 2.4, LAYERS[0]) + head()),
  ...LAYERS.flatMap((z, layer) => [part("layers", plate(z, layer)), part("attention", layerBand(layer))]),
  part("context", shelf() + CTX.words.map((w, i) => tileSvg(posX(i), 0, TILE_Z, w, TILE, `ctx-${i}`)).join("")),
  crossbar(-26),
  post(frontL), post(frontR), crossbar(26),
  part("sampler", tape() + `<g data-segs>${CTX.cands.map((w, i) => `<g data-seg="${i}">${segText(w, i)}</g>`).join("")}</g><g data-dividers>${CTX.cands.slice(0, -1).map((_, i) => `<g data-divider="${i}">${dividerSvg()}</g>`).join("")}</g><g data-carriage>${carriage()}</g>`),
  part("temperature", knob()),
  `<g data-pulses class="lm-pulses"></g>`,
  `<g data-fly></g>`,
];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });
const THREAD_CSS = `.lm-thread{fill:none;stroke:var(--anatomy-hi);stroke-linecap:round;transition:stroke-width .5s,opacity .5s}
.lm-pulses circle{fill:var(--anatomy-lit);stroke:var(--anatomy-card);stroke-width:.6}`;
const threadStyle = (w) => `stroke-width:${(0.35 + 2.6 * w).toFixed(2)};opacity:${(0.35 + 0.65 * w).toFixed(2)}`;
const styled = (text) => text.replace(/data-thread="(\d)-(\d)"/g, (m, l, j) => `${m} style="${threadStyle(CTX.attn[l][j])}"`);
const xmlSafe = (text) => text.replace(/ (data-[\w-]+)(?=[\s>\/])/g, ' $1=""');
if (theme === "light") writeFileSync(join(HERE, "thumb.svg"), xmlSafe(styled(k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY, standalone: "light" }).replace("</style>", THREAD_CSS + "</style>"))));

// ---------- steps and parts ----------
const STEPS = [
  { say: "context · 5 tokens in", next: "Read" },
  { say: `reading · ${LAYERS.length} layers, each looks back`, next: "Score" },
  { say: "scores · one per candidate", next: "Odds" },
  { say: "softmax · odds add to 100%", next: "Draw" },
  { say: "draw", next: "Append" },
  { say: "appended", next: "Again" },
];
const PARTS = [
  { id: "context", step: 0, title: "Context", fact: "context · the words so far, as tokens", text: "Everything written so far, cut into tokens: often whole words, sometimes pieces of words. Each token is turned into a long list of numbers (its embedding), and that list drops into its own column." },
  { id: "layers", step: 1, title: "Layers", fact: `layers · ${LAYERS.length} here, dozens in real models`, text: "A stack of identical layers. Every column passes through every layer, and each layer updates what the column holds, so a word's numbers come to mean that word in this sentence. Real models stack dozens of layers, and each column carries thousands of numbers." },
  { id: "attention", step: 1, title: "Attention", fact: "attention · each word looks back, never ahead", text: "Inside each layer, a column takes in information from the columns before it, more from some than others. These threads show how much the last word takes from each earlier one: one layer leans on 'on', another on the subject or the verb. A word can only look back, which is why a model writes left to right. Real layers run many of these patterns side by side (heads); the weights here are illustrative." },
  { id: "scores", step: 2, title: "Scores", fact: "scores · one per word in the vocabulary", text: "Only the last column is used to predict what comes next. The scoring head compares its numbers with every token in the vocabulary, tens of thousands of them, and gives each a score (a logit). Six are shown. A score is not a probability yet: it can be any number, even negative." },
  { id: "temperature", step: 3, title: "Temperature", fact: "temperature · divides every score before softmax", text: "Softmax turns scores into odds that add up to 100%. Before that, every score is divided by the temperature. Below 1 the odds sharpen towards the top word; above 1 they flatten towards an even spread." },
  { id: "sampler", step: 4, title: "Sampler", fact: "sampler · a random point on the odds", text: "The odds are laid end to end along a tape, so each word gets a length equal to its chance. A random number picks a point, and the word under it is written next. Then it joins the context, and the whole machine runs again for the word after." },
];

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  P, contexts: CONTEXTS, temps: TEMPS, t0: T0, steps: STEPS,
  parts: Object.fromEntries(PARTS.map(({ id, step, fact }) => [id, { step, fact }])),
  posX: Array.from({ length: 6 }, (_, i) => posX(i)), sleeveH: SLEEVE.h, piston: PISTON, rise: RISE,
  logitFloor: LOGIT_FLOOR, logitScale: LOGIT_SCALE, tape: TAPE,
  slot: [posX(SLOT), 0, TILE_Z], candZ: SLEEVE.h,
  layers: LAYERS.map((_, l) => threadZ(l) + BEAD.h / 2), shelfZ: SHELF_Z, headZ: HEAD_Z,
  knob: KNOB, knobR: KNOB_R, knobZ: KNOB_Z[1], knobAngles: TEMPS.map((_, i) => knobAngle(i)),
};

const live = `
const D = ${JSON.stringify(DATA)};
const LASTSTEP = D.steps.length - 1;
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const liveText = document.querySelector("[data-live]");
const prev = document.querySelector("[data-prev]");
const next = document.querySelector("[data-next]");
const dots = [...document.querySelectorAll("[data-dot]")];
const items = [...document.querySelectorAll("[data-select]")];
const cooler = document.querySelector("[data-cooler]");
const warmer = document.querySelector("[data-warmer]");
const drawButton = document.querySelector("[data-draw]");
const contextButton = document.querySelector("[data-context]");
const bars = [...document.querySelectorAll("[data-bar]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const N = 6;
const byIndex = (sel, key) => [...stage.querySelectorAll(sel)].sort((a, b) => a.dataset[key] - b.dataset[key]);
const pistons = byIndex("[data-piston]", "piston");
const tiles = byIndex("[data-tile]", "tile");
const homes = byIndex("[data-home]", "home");
const dividers = byIndex("[data-divider]", "divider");
const segs = byIndex("[data-seg]", "seg");
const segLayer = stage.querySelector("[data-segs]");
const dividerLayer = stage.querySelector("[data-dividers]");
const carriage = stage.querySelector("[data-carriage]");
const caret = stage.querySelector("[data-caret]");
const knobLine = stage.querySelector("[data-knob]");
const fly = stage.querySelector("[data-fly]");
const pulseLayer = stage.querySelector("[data-pulses]");
const threads = [...stage.querySelectorAll("[data-thread]")].map((el) => { const [l, j] = el.dataset.thread.split("-").map(Number); return { el, l, j }; });
const groups = [...stage.querySelectorAll("[data-part]")];
const word = (key) => stage.querySelector('[data-word="' + key + '"]');

let ctx = 0, C = D.contexts[0];
let temp = D.t0;
const softmax = (t) => { const top = Math.max(...C.logits); const e = C.logits.map((z) => Math.exp((z - top) / t)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
let probs = softmax(D.temps[temp]);
const pct = (p) => (p >= 0.995 ? "99" : p < 0.005 ? "<1" : Math.round(p * 100)) + "%";
const tText = (t) => "T " + (t < 1 ? t.toFixed(2).replace(/0$/, "") : t.toFixed(1));
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const shift = (dx, dy, dz) => [D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz, D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz];
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.002 ? target : nx; };

let step = 0, selected = null, u = 0.5, winner = 0;
let touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0, clock = 0;
const h = Array(N).fill(0), cut = Array(N - 1).fill(0);
let pin = 0, flight = 0, segShow = 0, readClock = 0, drawTimer = 0;
const weight = threads.map(() => 0);

function cumulative() { const c = []; let s = 0; for (let i = 0; i < N - 1; i++) { s += probs[i]; c.push(s); } return c; }
function pick(r) { let s = 0; for (let i = 0; i < N; i++) { s += probs[i]; if (r < s) return i; } return N - 1; }
function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }
const sentence = () => C.words.join(" ") + " " + C.cands[winner];
const topList = () => C.cands.map((w, i) => [w, probs[i]]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, p]) => w + " " + pct(p)).join(" · ");
function stepText(n) {
  if (n === 1) { const top = C.attn.map((row) => row.indexOf(Math.max(...row))); return "reading · last word looks back at " + [...new Set(top.map((j) => "“" + C.words[j] + "”"))].join(", "); }
  if (n === 2) return "scores · " + C.cands.slice(0, 3).map((w, i) => w + " " + C.logits[i].toFixed(1)).join(" · ");
  if (n === 3) return tText(D.temps[temp]) + " · " + topList();
  if (n === 4) return "draw · " + u.toFixed(2) + " → " + C.cands[winner];
  if (n === 5) return "“" + sentence() + "”";
  return "“" + C.words.join(" ") + " …” · 5 tokens";
}

function setStep(n) {
  n = Math.max(0, Math.min(LASTSTEP, n));
  if (n === step) return;
  if (n >= 4 && step < 4) { u = Math.random(); winner = pick(u); }
  if (n === 1) readClock = 0;
  if (n < 5) markWinner(false);
  step = n;
  controls();
  if (!touring) announce(stepText(step));
  run();
}
function markWinner(on) { tiles.forEach((tile, i) => { const solid = tile.querySelector(".iso-solid"); if (on && i === winner) solid.setAttribute("data-lit", ""); else solid.removeAttribute("data-lit"); }); }

function setTemp(n) {
  n = Math.max(0, Math.min(D.temps.length - 1, n));
  if (n === temp) return;
  temp = n;
  probs = softmax(D.temps[temp]);
  if (step >= 4) winner = pick(u);
  const a = D.knobAngles[temp];
  knobLine.setAttribute("d", lineOnTop([D.knob[0] + Math.cos(a) * 1.2, D.knob[1] + Math.sin(a) * 1.2], [D.knob[0] + Math.cos(a) * (D.knobR - 1.6), D.knob[1] + Math.sin(a) * (D.knobR - 1.6)], D.knobZ, D.P));
  if (step < 3) setStep(3);
  controls();
  announce(tText(D.temps[temp]) + " · " + topList());
  run();
}

function setContext(n) {
  hold();
  select(null);
  ctx = (n + D.contexts.length) % D.contexts.length;
  C = D.contexts[ctx];
  probs = softmax(D.temps[temp]);
  C.words.forEach((w, i) => (word("ctx-" + i).textContent = w));
  C.cands.forEach((w, i) => { word("cand-" + i).textContent = w; word("seg-" + i).textContent = w; });
  markWinner(false);
  step = -1;
  setStep(0);
  setTimeout(() => { if (!touring && step === 0) setStep(1); }, 350);
  controls();
  announce("new context · “" + C.words.join(" ") + " …”");
}

function draw() {
  hold();
  select(null);
  u = Math.random(); winner = pick(u);
  markWinner(false);
  if (step >= 4) step = 3;
  setStep(4);
  drawTimer = 1.6;
}

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
  prev.disabled = step <= 0;
  next.querySelector("span").textContent = D.steps[Math.max(0, step)].next;
  next.setAttribute("aria-label", D.steps[Math.max(0, step)].next);
  dots.forEach((dot, index) => (index < step ? dot.setAttribute("data-on", "") : dot.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(Math.max(0, step)));
  stage.setAttribute("aria-valuetext", stepText(Math.max(0, step)));
  cooler.disabled = temp === 0;
  warmer.disabled = temp === D.temps.length - 1;
  document.querySelector("[data-temp]").textContent = tText(D.temps[temp]);
  bars.forEach((bar) => { const i = Number(bar.dataset.bar); bar.style.setProperty("--p", probs[i].toFixed(4)); bar.querySelector("span").textContent = C.cands[i]; bar.querySelector("b").textContent = pct(probs[i]); });
}

// Reading: a pulse drops down every column; as it passes a layer, that layer's threads draw tight.
const READ = 2.2; // seconds for a pulse from the shelf to the scoring head
const pulseZ = (t) => D.shelfZ - (D.shelfZ - D.headZ[1]) * Math.min(1, t / READ);

function update(dt, calm) {
  let busy = false;
  const go = (x, target, rate) => { const nx = calm ? target : follow(x, target, rate, dt); if (nx !== target) busy = true; return nx; };
  if (step === 1 && !calm) { readClock += dt; if (readClock < READ + 0.4) busy = true; }
  const z = step === 1 && !calm ? pulseZ(readClock) : step >= 1 ? -1e9 : 1e9;
  threads.forEach((t, i) => { weight[i] = go(weight[i], z <= D.layers[t.l] ? C.attn[t.l][t.j] : 0, 5); });
  const goalH = (i) => (step < 2 ? 0 : step === 2 ? (C.logits[i] - D.logitFloor) * D.logitScale : probs[i] * D.rise);
  for (let i = 0; i < N; i++) h[i] = go(h[i], goalH(i), 6);
  const c = cumulative();
  for (let i = 0; i < N - 1; i++) cut[i] = go(cut[i], c[i], 6);
  segShow = go(segShow, step >= 3 ? 1 : 0, 8);
  pin = go(pin, step >= 4 ? u : 0, 3.2);
  flight = go(flight, step >= 5 && Math.abs(pin - u) < 0.01 ? 1 : 0, 3);
  if (drawTimer > 0) { drawTimer -= dt; if (drawTimer <= 0 && step === 4) setStep(5); busy = true; }
  return busy;
}

function rebuildPiston(i) {
  const rise = Math.max(0.6, h[i]);
  const key = rise.toFixed(1);
  if (pistons[i]._k === key) return;
  pistons[i]._k = key;
  const plan = { x: D.posX[i] - D.piston.w / 2, y: -D.piston.d / 2, w: D.piston.w, d: D.piston.d, r: 0.6 };
  pistons[i].innerHTML = solidSvg(slabOf(plan, D.sleeveH - 0.5, rise + 0.5, D.P, 2), { tone: "mid" });
}

function place() {
  threads.forEach((t, i) => { const w = weight[i]; const s = "stroke-width:" + (0.35 + 2.6 * w).toFixed(2) + ";opacity:" + (w < 0.01 ? 0 : 0.35 + 0.65 * w).toFixed(2); if (t.el._s !== s) { t.el._s = s; t.el.setAttribute("style", s); } });
  // pulses
  if (step === 1 && readClock < READ) {
    const z = pulseZ(readClock);
    let html = "";
    for (let i = 0; i < 5; i++) {
      const zi = i === 4 ? z : Math.max(z, D.layers[0] - 6);
      if (i < 4 && z < D.layers[0] - 6) continue;
      const q = iso([D.posX[i], 0, zi], D.P);
      html += '<circle r="2.1" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '"/>';
    }
    pulseLayer.innerHTML = html;
  } else if (pulseLayer.firstChild) pulseLayer.innerHTML = "";
  for (let i = 0; i < N; i++) rebuildPiston(i);
  for (let i = 0; i < N; i++) {
    const rise = Math.max(0.6, h[i]);
    const f = i === winner ? ease(flight) : 0;
    const tile = tiles[i];
    if (f > 0.001) {
      if (tile.parentNode !== fly) fly.appendChild(tile);
      const from = [D.posX[i], 0, D.candZ + rise];
      const to = D.slot;
      const lift = Math.sin(Math.PI * f) * 30;
      setT(tile, shift((to[0] - from[0]) * f + 14 * Math.sin(Math.PI * f), 0, rise + (to[2] - from[2]) * f + lift));
    } else {
      if (tile.parentNode !== homes[i]) homes[i].appendChild(tile);
      setT(tile, shift(0, 0, rise));
    }
  }
  if (flight > 0.999 && step >= 5) markWinner(true);
  caret.style.opacity = flight > 0.2 ? 0 : 1;
  dividerLayer.style.opacity = segShow.toFixed(2);
  segLayer.style.opacity = segShow.toFixed(2);
  for (let i = 0; i < N - 1; i++) setT(dividers[i], shift(D.tape.x + cut[i] * D.tape.len, 0, 0));
  for (let i = 0; i < N; i++) {
    const a = i ? cut[i - 1] : 0, b = i < N - 1 ? cut[i] : 1;
    setT(segs[i], shift(D.tape.x + ((a + b) / 2) * D.tape.len, 0, 0));
    segs[i].style.visibility = (b - a) * D.tape.len > C.cands[i].length * 2.4 + 2 ? "visible" : "hidden";
  }
  setT(carriage, shift(pin * D.tape.len, 0, 0));
  const text = selected ? D.parts[selected].fact : stepText(Math.max(0, step));
  if (readout.textContent !== text) readout.textContent = text;
}

const TOUR = [2.6, 3.2, 2.6, 2.8, 2.4, 3.4];
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) {
    tourClock += dt;
    if (tourClock > TOUR[step]) { tourClock = 0; if (step === LASTSTEP) setContext(ctx + 1), (touring = true), setStep(0); else setStep(step + 1); }
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
const forward = () => go(step === LASTSTEP ? 0 : step + 1);

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
  const keys = { ArrowRight: () => go(step + 1), ArrowDown: () => go(step + 1), ArrowLeft: () => go(step - 1), ArrowUp: () => go(step - 1), Home: () => go(0), End: () => go(LASTSTEP), " ": forward, Enter: forward, Escape: () => { hold(); select(null); go(0); }, d: draw, D: draw, c: () => setContext(ctx + 1), C: () => setContext(ctx + 1), "[": () => { hold(); setTemp(temp - 1); }, "]": () => { hold(); setTemp(temp + 1); } };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
prev.addEventListener("click", () => go(step - 1));
next.addEventListener("click", forward);
drawButton.addEventListener("click", draw);
contextButton.addEventListener("click", () => setContext(ctx + 1));
cooler.addEventListener("click", () => { hold(); setTemp(temp - 1); });
warmer.addEventListener("click", () => { hold(); setTemp(temp + 1); });
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
  fig: "Fig 2",
  title: "Language model · next word",
  hint: "← → step · D draw · C context",
  readout: `“${CTX.words.join(" ")} …” · 5 tokens`,
  keys: [
    { mark: "lit", label: "The pin: a random number, the only part that chooses" },
    { mark: "raised", label: "Columns, layers and threads: everything that sets the odds" },
  ],
  caption: `A language model writes one token at a time. Each token of the context gets its own column, and the columns pass down through a stack of layers. In every layer a column takes in information from the columns before it (attention, the threads), never from those after. Only the last column is used to predict: the scoring head turns it into a score for every word in the vocabulary, softmax turns the scores into odds (after dividing by the temperature), and a random draw picks one. The chosen word joins the context and the machine runs again. The scores and thread weights are toy numbers; the arithmetic is real.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Language model. Arrow keys step through how it picks the next word; D draws a word; C changes the sentence; [ and ] change the temperature; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="${STEPS[0].say}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Back one step" disabled>←</button><span class="pc-dots" aria-hidden="true">${STEPS.slice(1).map(() => "<i data-dot></i>").join("")}</span><button type="button" class="pc-btn pc-context" data-context aria-keyshortcuts="C">Sentence ↻</button><span class="pc-temp"><button type="button" class="pc-btn" data-cooler aria-label="Lower the temperature" aria-keyshortcuts="[">−</button><span data-temp>T 1.0</span><button type="button" class="pc-btn" data-warmer aria-label="Raise the temperature" aria-keyshortcuts="]">+</button></span><button type="button" class="pc-btn" data-draw aria-keyshortcuts="D">Draw</button><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const ARTICLE_CSS = `${THREAD_CSS}
.iso-stage [data-part]{cursor:pointer}
.iso-stage[data-focus] [data-part]:not([data-on]) *{stroke:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-fill{fill:var(--anatomy-paper)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-top{fill:var(--anatomy-top)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-shade{fill:var(--anatomy-shade-3)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) text{fill:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-dots circle{opacity:.1!important}
.pc-controls{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:-10px;padding:0 16px 14px;font:12px/1 var(--anatomy-mono,ui-monospace,Menlo,monospace);z-index:1}
.pc-btn{font:inherit;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-mid);padding:7px 10px;cursor:pointer;min-height:30px}
.pc-btn:hover{border-color:var(--anatomy-strong)}
.pc-btn:disabled{color:var(--anatomy-lo);border-color:var(--anatomy-faint);cursor:default}
.pc-context{margin-left:auto}
.pc-temp{display:inline-flex;align-items:center;gap:4px;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.pc-temp [data-temp]{min-width:42px;text-align:center}
.pc-temp .pc-btn{padding:7px 9px}
.pc-dots{display:flex;gap:5px}
.pc-dots i{width:6px;height:6px;border:1px solid var(--anatomy-mid);border-radius:50%}
.pc-dots i[data-on]{background:var(--anatomy-strong);border-color:var(--anatomy-strong)}
.pc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iso-plate{padding-bottom:60px}
@media (max-width:600px){.pc-controls{margin-top:8px;padding:0 4px 4px}.pc-context{margin-left:0}.iso-plate{padding-bottom:72px}}
.pc-nav{max-width:650px;margin:0 auto;padding:24px 16px 0;font:14px/1.4 ui-monospace,Menlo,monospace}
.pc-nav a{color:var(--anatomy-muted);text-decoration:none}.pc-nav a:hover{color:var(--anatomy-text)}
.pc-nav{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.pc-versions{color:var(--anatomy-muted)}.pc-versions a[aria-current]{color:var(--anatomy-strong);text-decoration:underline;text-underline-offset:3px}
.pc-head,.pc-parts{max-width:650px;margin:0 auto;padding:0 16px;color:var(--anatomy-text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.pc-head h1{font:600 34px/1.15 Georgia,serif;margin:28px 0 8px;color:var(--anatomy-strong)}
.pc-head p{margin:0 0 8px;color:var(--anatomy-muted)}
.pc-parts{padding-bottom:64px}.pc-parts ol{list-style:none;margin:0;padding:0}
.pc-parts .pc-part{display:grid;grid-template-columns:40px 1fr;gap:2px 12px;padding:16px 8px;margin:0 -8px;border-top:1px solid color-mix(in srgb,var(--anatomy-muted) 30%,transparent);cursor:pointer;transition:background .2s}
.pc-parts .pc-part:hover,.pc-parts .pc-part[data-on]{background:var(--anatomy-card)}
.pc-parts .pc-part:focus-visible{outline:1px solid var(--anatomy-strong);outline-offset:-1px}
.pc-parts .pc-part .num{grid-row:span 2;font:13px ui-monospace,Menlo,monospace;color:var(--anatomy-muted);padding-top:3px}
.pc-parts .pc-part[data-on] .num{color:var(--anatomy-strong)}
.pc-parts h3{margin:0;font:600 18px/1.3 Georgia,serif;color:var(--anatomy-strong)}.pc-parts .pc-part p{margin:0;color:var(--anatomy-muted)}
.pc-parts h2{font:13px ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--anatomy-muted);margin:40px 0 4px}
.pc-parts .tip{font:12px ui-monospace,Menlo,monospace;color:var(--anatomy-muted);margin:0 0 12px}
.pc-odds{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px;font:12px ui-monospace,Menlo,monospace;color:var(--anatomy-muted)}
.pc-odds li{display:grid;grid-template-columns:56px 1fr 40px;align-items:center;gap:10px;padding:0;margin:0;border:0;cursor:default}
.pc-odds li:hover{background:none}
.pc-odds i{display:block;height:6px;background:var(--anatomy-faint);position:relative}
.pc-odds i::after{content:"";position:absolute;inset:0 auto 0 0;width:calc(var(--p) * 100%);background:var(--anatomy-hi);transition:width .4s var(--anatomy-ease)}
.pc-odds b{font-weight:400;text-align:right;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
`;
const odds = `<h2>The odds now</h2><p class="tip">Change the temperature with − and + (or [ and ]), or the sentence with C, and watch the spread.</p><ol class="pc-odds">${CTX.cands.map((w, i) => `<li data-bar="${i}" style="--p:${probs0[i].toFixed(4)}"><span>${w}</span><i></i><b>${Math.round(probs0[i] * 100)}%</b></li>`).join("")}</ol>`;
const body = `<style>${CONTRAST_CSS}${ARTICLE_CSS}${EXPAND_CSS}</style>
<nav class="pc-nav"><a href="../">← anatomy/of</a><span class="pc-versions">version <a href="../language-model-computer/">computer</a> · <a href="../language-model/" aria-current="page">tower</a> · <a href="../language-model-bench/">bench</a></span></nav>
<header class="pc-head"><h1>Anatomy of a language model</h1><p>It doesn't plan a sentence. It picks one next word, from odds it works out fresh each time, and then does it again.</p></header>
${plateBody}
<section class="pc-parts"><h2>The parts</h2><p class="tip">Point at a part to find it in the figure; click it to step the machine to it.</p><ol>${PARTS.map(({ id, title, text }, index) => `<li><div class="pc-part" data-select="${id}" tabindex="0" role="button" aria-label="${title}: show it in the figure"><span class="num">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></div></li>`).join("")}</ol>${odds}</section>`;

const name = theme === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomy of a language model", theme, body: styled(body), script: kitScript() + live + EXPAND_JS }));
console.log("wrote", name);
