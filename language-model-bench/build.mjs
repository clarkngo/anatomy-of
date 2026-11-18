// Anatomy of a language model, first version (the bench): builds language-model-bench/index.html
// (light) or dark.html (--dark). Kept alongside the tall machine in language-model/.
// A next-word bench: the model reads the context, scores every candidate word, turns the
// scores into probabilities (softmax, shaped by temperature), draws one at random and appends it.
// Uses the Anatomy kit (MIT, vendored in tools/anatomy). The numbers are a small toy model.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../tools/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../tools/anatomy/scripts/inline-kit.mjs";
import { EXPAND_BUTTON, EXPAND_CSS, EXPAND_JS } from "../tools/expand.mjs";
import { CONTRAST_CSS } from "../tools/contrast.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

// ---------- the model (toy numbers, true arithmetic) ----------
// Three example sentences: the context, six candidates and their scores (shared with the other versions).
const CONTEXTS = [
  { words: ["the", "cat", "sat", "on", "the"], cands: ["mat", "floor", "sofa", "bed", "roof", "moon"], logits: [3.0, 2.2, 1.6, 1.3, 0.4, -1.0],
    attn: [[1], [0.35, 0.65], [0.1, 0.6, 0.3], [0.05, 0.2, 0.45, 0.3], [0.1, 0.3, 0.1, 0.35, 0.15]],
    notes: ["“the” is a determiner: a noun comes next", "it closes the phrase “on the …”", "“on” here means on top of a surface", "the one doing the sitting is “cat”", "cats sit on mats, floors, sofas, beds", "ready to score: somewhere flat to sit"] },
  { words: ["the", "ship", "sailed", "on", "the"], cands: ["sea", "ocean", "river", "waves", "lake", "road"], logits: [3.2, 2.6, 1.4, 1.2, 0.8, -1.2],
    attn: [[1], [0.35, 0.65], [0.1, 0.62, 0.28], [0.05, 0.25, 0.42, 0.28], [0.08, 0.38, 0.14, 0.3, 0.1]],
    notes: ["“the” is a determiner: a noun comes next", "it closes the phrase “on the …”", "“on” after “sailed” means on water", "the one doing the sailing is “ship”", "ships sail on seas, oceans, rivers", "ready to score: a stretch of water"] },
  { words: ["the", "bird", "flew", "over", "the"], cands: ["trees", "house", "city", "river", "clouds", "moon"], logits: [2.4, 2.2, 2.0, 1.6, 1.4, 0.2],
    attn: [[1], [0.35, 0.65], [0.1, 0.6, 0.3], [0.05, 0.22, 0.45, 0.28], [0.08, 0.34, 0.16, 0.3, 0.12]],
    notes: ["“the” is a determiner: a noun comes next", "it closes the phrase “over the …”", "“over” here means passing above", "the one doing the flying is “bird”", "birds fly over trees, houses, cities", "ready to score: something below the sky"] },
];
// notes say what each layer adds to the last token: illustrative, not read out of a real model
// attention rows are toy weights: row i is token i looking back at tokens 0..i, and each row adds to 1
const TOPKS = [6, 3, 1]; // the top-k gate: all six, the best three, only the best
const CONTEXT = CONTEXTS[0].words;
const WORDS = CONTEXTS[0].cands;
const LOGITS = CONTEXTS[0].logits;
const TEMPS = [0.25, 0.5, 1, 1.5, 2];
const T0 = 2; // index into TEMPS: T = 1
const LAYERS = 6;
const softmax = (logits, t) => {
  const top = Math.max(...logits);
  const e = logits.map((z) => Math.exp((z - top) / t));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / sum);
};

// ---------- world ----------
const W = 640;
const H = 400;
const PLATE = { x: -134, y: -94, w: 270, d: 178, r: 9 };
const PLATE_H = 9;
const FOOT_H = 5;

// context rail, front left
const SLOT = 30; // tile pitch
const TILE = { w: 26, d: 13, h: 6 };
const RAIL = { x: -128, y: 36, w: 6 * SLOT + 8, d: 19, r: 2 };
const RAIL_H = 4;
const slotX = (i) => RAIL.x + 4 + SLOT / 2 + i * SLOT; // tile centre
const TILE_Y = RAIL.y + RAIL.d / 2;

// read head: a carriage on a tall rail just behind the tiles, a finger over each tile
const READ = { x: RAIL.x, y: 22, w: RAIL.w, d: 7, r: 1.2 };
const READ_H = 15;
const HEAD = { w: 12, d: 11 };
const HEAD_Z = [READ_H, READ_H + 8];

// layer stack, back left
const STACK = { x: -126, y: -86, w: 66, d: 54, r: 3 };
const STACK_BASE = 7;
const LAYER_PITCH = 7.5;
const LAYER_H = 4;
const STACK_TOP = STACK_BASE + LAYERS * LAYER_PITCH;

// rack of candidate pistons, back right
const COL = 19;
const colX = (i) => 6 + COL / 2 + i * COL;
const COL_Y = -58;
const SLEEVE = { w: 13, d: 13, h: 9 };
const PISTON = { w: 8, d: 8 };
const CAND = { w: 17, d: 13, h: 4.5 };
const RISE = 62; // piston travel for p = 1
const LOGIT_FLOOR = -1.5;
const LOGIT_SCALE = 9; // piston travel per unit of score
const PANEL = { x: 0, y: -84, w: COL * 6 + 12, d: 5, r: 1 };
const PANEL_H = RISE + SLEEVE.h + CAND.h + 6;

// manifold from the stack to the rack
const BUS = { x: STACK.x + STACK.w - 2, y: COL_Y - 4, w: colX(0) - SLEEVE.w / 2 - (STACK.x + STACK.w) + 2, d: 8, r: 1 };
const BUS_H = 5;

// sampling tape: 100 units long = probability 1
const TAPE = { x: 6, len: 114, y: -38, d: 13 };
const TAPE_Z = 1.2;
const TAPE_K = TAPE.len; // units per probability
const CARR_RAIL = { x: TAPE.x - 6, y: TAPE.y + TAPE.d + 1.5, w: TAPE.len + 12, d: 5, r: 1 };
const CARR = { w: 10, d: 9, h: 6 };

// temperature knob, front right
const KNOB = [100, 44];
const KNOB_R = 9;
const KNOB_Z = [4, 11];
const DIAL_R = 15;
const KNOB_SPAN = (Math.PI * 4) / 3;
// top-k gate: a slide switch in front of the knob, three detents
const GATE = { x: 64, y: 65, w: 54, d: 12, r: 1.2 };
const GATE_H = 1.2;
const GATE_X = [75, 91, 107];
const GATE_Y = 69.5;
// attention threads: anchored on the front of each context tile's top
const ATTN = { y: TILE_Y + 5.4, z: RAIL_H + TILE.h };
const knobAngle = (i) => -Math.PI / 2 - KNOB_SPAN / 2 + (KNOB_SPAN * i) / (TEMPS.length - 1) + Math.PI / 4;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PANEL.x, PANEL.y, PANEL_H], [PANEL.x + PANEL.w, PANEL.y, PANEL_H], [STACK.x, STACK.y, STACK_TOP + 10], [STACK.x + STACK.w, STACK.y, STACK_TOP + 10]],
  W,
  H,
  { pad: 18, azimuth: 50 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(...a) - depth(...b));
const box = (cx, cy, w, d, r = 0.8) => ({ x: cx - w / 2, y: cy - d / 2, w, d, r });
const screws = (list, z, size = 0.45) => Dt(list.map(([x, y]) => at([x, y, z])), { size });
// a line on a top face that ends on a screw at each end
const pinned = (from, to, z, tone = "faint") => L(k.lineOnTop(from, to, z, P), { tone }) + screws([from, to], z, 0.4);

// ---------- bench plate ----------
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
  // label plate, front middle, with an engraved title and two rule lines
  const label = { x: -40, y: 62, w: 46, d: 15, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 5, label.y + 7], 0.8, P, "x"), "NEXT WORD", { size: 3.2, tone: "mid" }));
  out.push(L([[10.5, 30], [12.5, 18]].map(([dy, len]) => k.lineOnTop([label.x + 5, label.y + dy], [label.x + 5 + len, label.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(screws([[label.x + 2.6, label.y + 2.6], [label.x + label.w - 2.6, label.y + label.d - 2.6]], 0.8, 0.4));
  return out.join("");
}

// ---------- layer stack: six plates on four guide posts ----------
function stack() {
  const out = [];
  const base = STACK;
  out.push(S(k.slabOf(base, 0, STACK_BASE, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(base, 2.5, P, 6), { tone: "faint" }) }));
  const posts = k.corners(base, 6);
  const [back, ...rest] = byDepth(posts);
  const postSvg = ([x, y]) => S(k.cylinder(x, y, 1.8, STACK_BASE, STACK_TOP - STACK_BASE + 4, P, 16), { tone: "mid" });
  out.push(postSvg(back));
  for (let i = 0; i < LAYERS; i++) {
    const z = STACK_BASE + 3.5 + i * LAYER_PITCH;
    const plan = k.insetPlan(base, 2);
    // one lamp per context token, on the plate's right edge: every token passes through every layer
    const lamps = [0, 1, 2, 3, 4].map((j) => at([plan.x + plan.w - 0.01, plan.y + 10 + j * 7.5, z + LAYER_H / 2]));
    // two phase lamps on the front face: look (attention), then think (feed-forward)
    const phase = (dx) => Dt([at([plan.x + dx, plan.y + plan.d + 0.01, z + LAYER_H / 2])], { size: 0.9, tone: "lo" });
    out.push(`<g data-layer="${i}">${S(k.slabOf(plan, z, LAYER_H, P, 6, 0.5), { tone: "hi" })}${Dt(lamps, { size: 0.65, tone: "lo" })}<g data-look>${phase(16)}</g><g data-think>${phase(23)}</g></g>`);
    // spacer collars on the posts between plates
    if (i < LAYERS - 1) for (const [x, y] of rest.slice(0, 2)) out.push(S(k.cylinder(x, y, 2.4, z + LAYER_H, LAYER_PITCH - LAYER_H, P, 16), { tone: "mid" }));
  }
  for (const p of rest) out.push(postSvg(p));
  // top cap nut on each post
  for (const [x, y] of posts) out.push(S(k.cylinder(x, y, 2.6, STACK_TOP + 4, 1.6, P, 6), { tone: "mid" }), Dt([at([x, y, STACK_TOP + 5.6])], { size: 0.45 }));
  // engraved layer count on the top plate
  const topZ = STACK_BASE + 3.5 + (LAYERS - 1) * LAYER_PITCH + LAYER_H;
  out.push(k.faceTextSvg(k.topMatrix([base.x + 10, base.y + 30], topZ, P, "x"), `${LAYERS} LAYERS`, { size: 3.4, tone: "lo" }));
  out.push(L(k.lineOnTop([base.x + 10, base.y + 34], [base.x + 40, base.y + 34], topZ, P), { tone: "faint", free: true }));
  return out.join("");
}

function bus() {
  const out = [S(k.slabOf(BUS, 0, BUS_H, P, 3, 0.4), { tone: "mid", inner: pinned([BUS.x + 10, BUS.y + BUS.d / 2], [BUS.x + BUS.w - 10, BUS.y + BUS.d / 2], BUS_H) })];
  out.push(screws([[BUS.x + 6, BUS.y + 2], [BUS.x + 6, BUS.y + BUS.d - 2], [BUS.x + BUS.w - 6, BUS.y + 2], [BUS.x + BUS.w - 6, BUS.y + BUS.d - 2]], BUS_H, 0.4));
  return out.join("");
}

// ---------- the rack ----------
function panel() {
  const out = [S(k.slabOf(PANEL, 0, PANEL_H, P, 3, 0.5), { tone: "mid" })];
  // a percentage rule on the panel face: 0 at the sleeve tops, 100% at full travel
  const face = PANEL.y + PANEL.d;
  const z0 = SLEEVE.h;
  const tick = (z, len) => k.pathOf([at([PANEL.x + 1.5, face, z]), at([PANEL.x + 1.5 + len, face, z])]);
  let minor = "", major = "";
  for (let i = 0; i <= 20; i++) (i % 5 ? (minor += tick(z0 + (RISE * i) / 20, 2.2)) : (major += tick(z0 + (RISE * i) / 20, 4)));
  out.push(L(minor, { tone: "lo", free: "end" }), L(major, { tone: "mid", free: "end" }));
  for (const [z, text] of [[z0, "0"], [z0 + RISE / 2, "50"], [z0 + RISE, "100%"]]) {
    out.push(k.faceTextSvg(k.sideMatrix([PANEL.x + 6.5, face], z - 1.1, P, "left"), text, { size: 2.6, tone: "lo" }));
  }
  // a rule line across each column at the top, and screws
  // a guide slot behind each column, from the sleeve top to full travel, with a stop screw at each end
  for (let i = 0; i < 6; i++) {
    const x = colX(i);
    out.push(L(k.pathOf([at([x, face, z0 + 2]), at([x, face, z0 + RISE + CAND.h])]), { tone: "faint" }));
    out.push(Dt([at([x, face, z0 + 2]), at([x, face, z0 + RISE + CAND.h])], { size: 0.45 }));
  }
  out.push(Dt([[PANEL.x + 3, PANEL_H - 3], [PANEL.x + PANEL.w - 3, PANEL_H - 3], [PANEL.x + PANEL.w - 3, 3]].map(([x, z]) => at([x, face, z])), { size: 0.45 }));
  out.push(screws([[PANEL.x + 2.5, PANEL.y + 2.5], [PANEL.x + PANEL.w - 2.5, PANEL.y + 2.5]], PANEL_H, 0.4));
  return out.join("");
}

function rackBase() {
  const plan = { x: PANEL.x, y: COL_Y - 10, w: PANEL.w, d: 20, r: 1.5 };
  return S(k.slabOf(plan, 0, 2, P, 3, 0.4), { tone: "lo" }) + screws([[plan.x + 3, plan.y + 3], [plan.x + 3, plan.y + plan.d - 3], [plan.x + plan.w - 3, plan.y + plan.d - 3]], 2, 0.4);
}

function sleeve(i) {
  const cx = colX(i);
  const plan = box(cx, COL_Y, SLEEVE.w, SLEEVE.d, 1);
  const out = [S(k.slabOf(plan, 2, SLEEVE.h - 2, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(box(cx, COL_Y, PISTON.w + 1.6, PISTON.d + 1.6, 0.6), SLEEVE.h, P, 2), { tone: "lo" }));
  out.push(screws([[plan.x + 1.8, plan.y + 1.8], [plan.x + plan.w - 1.8, plan.y + plan.d - 1.8]], SLEEVE.h, 0.35));
  return out.join("");
}

// the piston column, rebuilt in the page as it rises (drawn here at a rest height)
const pistonSvg = (cx, rise) => {
  const h = Math.max(0.6, rise);
  const plan = box(cx, COL_Y, PISTON.w, PISTON.d, 0.6);
  return S(k.slabOf(plan, SLEEVE.h - 0.5, h + 0.5, P, 2), { tone: "mid" });
};

// a word tile, drawn at a given centre and base height
function tileSvg(cx, cy, z, word, size, key) {
  const plan = box(cx, cy, size.w, size.d, 1.2);
  const top = z + size.h;
  const inner = L(k.planOutline(k.insetPlan(plan, 1.3), top, P, 3), { tone: "faint" });
  const text = k.faceTextSvg(k.topMatrix([cx, cy + 1.3], top, P, "x"), word, { size: word.length > 4 ? 3.4 : 3.9, tone: "hi", anchor: "middle" }).replace("<text ", `<text data-word="${key}" `);
  return S(k.slabOf(plan, z, size.h, P, 3, 0.6), { tone: "hi", inner: inner + text });
}

// ---------- sampling tape and carriage ----------
function tape() {
  const out = [];
  const strip = { x: TAPE.x - 3, y: TAPE.y, w: TAPE.len + 6, d: TAPE.d, r: 1 };
  out.push(S(k.slabOf(strip, 0, TAPE_Z, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(TAPE.x, TAPE.x + TAPE.len, TAPE.len / 20, 5, TAPE.y + TAPE.d, TAPE_Z, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([TAPE.x, TAPE.y + 1.6], [TAPE.x + TAPE.len, TAPE.y + 1.6], TAPE_Z, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([TAPE.x, TAPE.y + 1.2], [TAPE.x, TAPE.y + TAPE.d], TAPE_Z, P) + k.lineOnTop([TAPE.x + TAPE.len, TAPE.y + 1.2], [TAPE.x + TAPE.len, TAPE.y + TAPE.d], TAPE_Z, P), { tone: "mid" }));
  out.push(Dt([at([strip.x + 1.5, strip.y + 1.5, TAPE_Z]), at([strip.x + strip.w - 1.5, strip.y + 1.5, TAPE_Z])], { size: 0.4 }));
  // end blocks
  for (const x of [TAPE.x - 7, TAPE.x + TAPE.len + 3]) out.push(S(k.slabOf({ x, y: TAPE.y - 1, w: 4, d: CARR_RAIL.y + CARR_RAIL.d - TAPE.y + 1, r: 0.8 }, 0, 4, P, 2, 0.3), { tone: "mid" }), screws([[x + 2, TAPE.y + 2]], 4, 0.4));
  // carriage rail
  out.push(S(k.slabOf(CARR_RAIL, 0, 2.2, P, 2, 0.3), { tone: "mid" }));
  out.push(pinned([CARR_RAIL.x + 3, CARR_RAIL.y + CARR_RAIL.d / 2], [CARR_RAIL.x + CARR_RAIL.w - 3, CARR_RAIL.y + CARR_RAIL.d / 2], 2.2));
  return out.join("");
}

// segment dividers: thin fences standing on the tape, one at each running total (drawn at x = 0)
const dividerSvg = () => S(k.slabOf({ x: -0.5, y: TAPE.y + 0.4, w: 1, d: TAPE.d - 0.8, r: 0.2 }, TAPE_Z, 3.2, P, 1), { tone: "mid", crease: "none" });
// the segment's word, engraved on the tape between dividers (drawn at x = 0)
const segText = (word, i) => k.faceTextSvg(k.topMatrix([0, TAPE.y + 8.6], TAPE_Z, P, "x"), word, { size: 3.4, tone: "hi", anchor: "middle" }).replace("<text ", `<text data-word="seg-${i}" `);

function carriage() {
  const x = TAPE.x;
  const plan = box(x, CARR_RAIL.y + CARR_RAIL.d / 2, CARR.w, CARR.d, 1.2);
  const out = [S(k.slabOf(plan, 2.2, CARR.h, P, 3, 0.5), { tone: "mid" })];
  out.push(screws([[plan.x + 2, plan.y + 2], [plan.x + plan.w - 2, plan.y + plan.d - 2]], 2.2 + CARR.h, 0.4));
  // the pin: an arm reaching back over the tape, ending in a needle point
  const armY0 = plan.y + 2;
  const arm = { x: x - 1, y: TAPE.y + 3, w: 2, d: armY0 - TAPE.y - 3, r: 0.4 };
  out.push(S(k.slabOf(arm, 2.2 + CARR.h - 1.6, 1.6, P, 1), { tone: "hi" }));
  out.push(S(k.cylinder(x, TAPE.y + 4, 0.9, TAPE_Z, 2.2 + CARR.h - 1.6 - TAPE_Z, P, 12), { tone: "hi", lit: true }));
  out.push(Dt([at([x, TAPE.y + 4, 2.2 + CARR.h])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

// ---------- context rail and read head ----------
function rail() {
  const out = [S(k.slabOf(RAIL, 0, RAIL_H, P, 4, 0.5), { tone: "mid" })];
  out.push(L(k.sideSeam(RAIL, 1.5, P, 4), { tone: "faint" }));
  // slot marks between tiles and end stops
  for (let i = 0; i <= 6; i++) {
    const x = slotX(i) - SLOT / 2;
    out.push(L(k.lineOnTop([x, RAIL.y + 1.5], [x, RAIL.y + 3.5], RAIL_H, P), { tone: "lo", free: true }));
  }
  for (const x of [RAIL.x + 1, RAIL.x + RAIL.w - 3]) out.push(S(k.slabOf({ x, y: RAIL.y + 2, w: 2, d: RAIL.d - 4, r: 0.4 }, RAIL_H, 3, P, 1), { tone: "mid" }));
  // the empty slot: an inset outline and a caret
  const sx = slotX(5);
  out.push(L(k.planOutline(box(sx, TILE_Y, TILE.w - 2, TILE.d - 2, 1), RAIL_H, P, 3), { tone: "lo", dashed: true }));
  out.push(`<g data-caret>${L(k.lineOnTop([sx - 4, TILE_Y + 3], [sx - 4, TILE_Y - 3], RAIL_H, P), { tone: "hi", free: "both" })}</g>`);
  out.push(screws([[RAIL.x + 6, RAIL.y + RAIL.d - 2.5], [RAIL.x + RAIL.w - 6, RAIL.y + RAIL.d - 2.5]], RAIL_H, 0.4));
  return out.join("");
}

function readRail() {
  const out = [S(k.slabOf(READ, 0, READ_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(READ, 4, P, 3), { tone: "faint" }) })];
  out.push(pinned([READ.x + 3, READ.y + READ.d / 2], [READ.x + READ.w - 3, READ.y + READ.d / 2], READ_H, "lo"));
  return out.join("");
}

// the head over slot 0 (moved along x in the page)
function head() {
  const cx = slotX(0);
  const plan = box(cx, READ.y + READ.d / 2, HEAD.w, HEAD.d, 1.4);
  const out = [S(k.slabOf(plan, HEAD_Z[0], HEAD_Z[1] - HEAD_Z[0], P, 3, 0.6), { tone: "hi" })];
  out.push(screws([[plan.x + 2, plan.y + 2], [plan.x + plan.w - 2, plan.y + 2]], HEAD_Z[1], 0.4));
  // a finger reaching forward over the tile, with a reading lens at its tip
  const finger = { x: cx - 1.6, y: plan.y + plan.d, w: 3.2, d: TILE_Y - (plan.y + plan.d), r: 0.5 };
  out.push(S(k.slabOf(finger, HEAD_Z[0] + 1.5, 2, P, 1), { tone: "hi" }));
  out.push(S(k.cylinder(cx, TILE_Y, 2.4, HEAD_Z[0] + 0.5, 3, P, 20), { tone: "hi" }));
  out.push(L(k.ring(cx, TILE_Y, 1.4, HEAD_Z[0] + 3.5, P, 18), { tone: "lo" }));
  return out.join("");
}

// ---------- temperature knob ----------
function knob() {
  const [cx, cy] = KNOB;
  const out = [S(k.cylinder(cx, cy, DIAL_R + 2, 0, 1.4, P, 40), { tone: "mid" })];
  out.push(L(k.ring(cx, cy, DIAL_R, 1.4, P, 40), { tone: "faint" }));
  const ticks = TEMPS.map((_, i) => {
    const a = knobAngle(i);
    const r0 = KNOB_R + 1.6, r1 = DIAL_R - (i === T0 ? 0 : 1);
    return k.lineOnTop([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], 1.4, P);
  });
  out.push(L(ticks.join(""), { tone: "mid", free: "both" }));
  out.push(S(k.cylinder(cx, cy, KNOB_R, KNOB_Z[0] - 2.6, 2.6, P, 36), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, KNOB_R - 1, KNOB_Z[0], KNOB_Z[1] - KNOB_Z[0], P, 36), { tone: "hi" }));
  out.push(L(k.knurl(cx, cy, KNOB_R - 1, KNOB_Z[0], KNOB_Z[1], 30, P), { tone: "lo" }));
  out.push(L(k.ring(cx, cy, KNOB_R - 3.4, KNOB_Z[1], P, 30), { tone: "faint" }));
  out.push(`<path class="iso-line" data-tone="hi" data-knob data-free="both" d="${knobPointer(knobAngle(T0))}" style="stroke-width:1.1"/>`);
  out.push(Dt([at([cx, cy, KNOB_Z[1]])], { size: 0.55, tone: "hi" }));
  // engraved T beside the dial
  out.push(k.faceTextSvg(k.topMatrix([cx - DIAL_R - 6, cy + DIAL_R - 2], 0, P, "x"), "T", { size: 4, tone: "mid", anchor: "middle" }));
  return out.join("");
}
function knobPointer(a) {
  const [cx, cy] = KNOB;
  return k.lineOnTop([cx + Math.cos(a) * 1.4, cy + Math.sin(a) * 1.4], [cx + Math.cos(a) * (KNOB_R - 2), cy + Math.sin(a) * (KNOB_R - 2)], KNOB_Z[1], P);
}

// ---------- top-k gate ----------
function gate() {
  const out = [S(k.slabOf(GATE, 0, GATE_H, P, 3, 0.4), { tone: "mid" })];
  out.push(L(k.planOutline(box(91, GATE_Y, 40, 2.6, 1), GATE_H, P, 2), { tone: "lo" }));
  out.push(L(GATE_X.map((x) => k.lineOnTop([x, GATE_Y + 2.6], [x, GATE_Y + 4], GATE_H, P)).join(""), { tone: "mid", free: "both" }));
  TOPKS.forEach((n, i) => out.push(k.faceTextSvg(k.topMatrix([GATE_X[i], GATE_Y + 6.6], GATE_H, P, "x"), String(n), { size: 2.6, tone: "mid", anchor: "middle" })));
  out.push(k.faceTextSvg(k.topMatrix([67.4, GATE_Y + 1.4], GATE_H, P, "x"), "k", { size: 3.4, tone: "mid", anchor: "middle" }));
  out.push(screws([[GATE.x + 2, GATE.y + 2], [GATE.x + GATE.w - 2, GATE.y + GATE.d - 2]], GATE_H, 0.4));
  return out.join("");
}
// the slider, drawn at the first detent (moved along x in the page)
function slider() {
  const plan = box(GATE_X[0], GATE_Y, 6, 6, 1);
  return S(k.slabOf(plan, GATE_H, 3.6, P, 3, 0.5), { tone: "hi" }) + Dt([at([GATE_X[0], GATE_Y, GATE_H + 3.6])], { size: 0.55, tone: "hi" });
}

// ---------- assemble ----------
const part = (id, svg, extra = "") => `<g data-part="${id}"${extra}>${svg}</g>`;
const columns = WORDS.map((_, i) => i).sort((a, b) => depth(colX(a), COL_Y) - depth(colX(b), COL_Y));
const probs0 = softmax(LOGITS, TEMPS[T0]);

const FIGURE_LABEL =
  "A next-word bench. Five word tiles reading 'the cat sat on the' sit on a rail with one empty slot. A read head slides over them, a stack of six layer plates stands behind, and a rack of six pistons lifts the candidate words mat, floor, sofa, bed, roof and moon to heights set first by their scores and then by their probabilities. A temperature knob reshapes the probabilities, a top-k gate can shut out all but the best few words, a tape in front of the rack is divided into lengths that match them, and a pin stops at a random point on the tape to pick the next word.";

const BODY = [
  plate(),
  part("layers", stack()),
  part("scores", panel() + rackBase()),
  part("layers", bus()),
  ...columns.map((i) =>
    part("scores", sleeve(i) + `<g data-piston="${i}">${pistonSvg(colX(i), probs0[i] * RISE)}</g>` + `<g data-home="${i}"><g data-tile="${i}">${tileSvg(colX(i), COL_Y, SLEEVE.h, WORDS[i], CAND, `cand-${i}`)}</g></g>`),
  ),
  part("sampler", tape() + `<g data-segs>${WORDS.map((w, i) => `<g data-seg="${i}">${segText(w, i)}</g>`).join("")}</g>` + `<g data-dividers>${WORDS.slice(0, -1).map((_, i) => `<g data-divider="${i}">${dividerSvg()}</g>`).join("")}</g>` + `<g data-carriage>${carriage()}</g>`),
  part("layers", readRail()),
  part("context", rail() + CONTEXT.map((w, i) => `<g data-ctx="${i}">${tileSvg(slotX(i), TILE_Y, RAIL_H, w, TILE, `ctx-${i}`)}</g>`).join("")),
  part("layers", `<g data-head>${head()}</g>`),
  part("layers", `<g data-attn style="opacity:0"></g>`),
  part("temperature", knob()),
  part("topk", gate() + `<g data-slider>${slider()}</g>`),
  `<g data-fly></g>`,
];
// A standalone .svg is XML: every attribute needs a value.
const xmlSafe = (text) => text.replace(/ (data-[\w-]+)(?=[\s>\/])/g, ' $1=""');
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });
if (theme === "light") writeFileSync(join(HERE, "thumb.svg"), xmlSafe(k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY, standalone: "light" })));

// ---------- steps and parts ----------
const STEPS = [
  { say: `context · ${CONTEXT.length} tokens`, next: "Read" },
  { say: `reading · ${LAYERS} layers, bottom to top`, next: "Score" },
  { say: "scores · one per candidate", next: "Odds" },
  { say: "softmax · odds add to 100%", next: "Draw" },
  { say: "draw", next: "Append" },
  { say: "appended", next: "Again" },
];
const PARTS = [
  { id: "context", step: 0, title: "Context", fact: "context · the words so far, as tokens", text: "Everything written so far. A real model cuts text into tokens, which are often whole words and sometimes pieces of words, and it sees every one of them at each step. Change the sentence with C (or the Sentence button) to see other examples." },
  { id: "layers", step: 1, title: "Layers", fact: `layers · ${LAYERS} here, often dozens in practice`, text: "A stack of identical layers. Every token carries a running note up the stack (a long list of numbers, called the residual stream), and each layer adds a little to that note rather than replacing it. The plates light up one after another from the bottom because each one works on what the layer below handed up. The five lamps on a plate's side are the five tokens; the two on its front are the layer's two moves, look and then think. Lower layers tend to sort out grammar, higher ones meaning and what may come next. The close-up under the figure shows what each layer adds to the last word." },
  { id: "attention", on: "layers", step: 1, title: "Look: attention, inside each layer", fact: "attention · each token looks back, never ahead", text: "Inside every layer, each token takes in information from the tokens before it, more from some than others. The threads over the rail show it: the thicker a thread, the more the lit token draws on the word at its other end. In “the cat sat on the”, the last “the” leans on “on” and “cat”. That is how a word comes to mean that word in this sentence. A token never looks ahead, which is why the model writes left to right. The table under the figure shows every token's threads; pick a row (or press A) to see it on the bench." },
  { id: "think", on: "layers", step: 1, title: "Think: feed-forward, inside each layer", fact: "feed-forward · each token on its own, using what training stored", text: "The second move in every layer. Each token's note goes through a small network on its own, with no looking around, and comes out with something added: facts and patterns the model stored during training, such as “cats sit on mats”. Look gathers what the sentence says; think adds what the model knows. Most of a model's numbers live in these feed-forward parts." },
  { id: "scores", step: 2, title: "Scores", fact: "scores · one per word in the vocabulary", text: "The model gives a score (a logit) to every token it knows, tens of thousands of them. Here only six are shown. A score is not a probability yet: it can be any number, even negative." },
  { id: "temperature", step: 3, title: "Temperature", fact: "temperature · divides every score before softmax", text: "Softmax turns scores into odds that add up to 100%. Before that, every score is divided by the temperature. Below 1 the odds sharpen towards the top word, and above 1 they flatten towards an even spread." },
  { id: "topk", step: 3, title: "Top-k gate", fact: "top-k · only the k best words can be drawn", text: "Many systems cut the list before drawing: only the k highest-scoring words keep their odds, the rest drop to zero, and the odds are shared out again. Slide the gate to 3 (K, or the Top-k button) and long shots like moon can never be picked; at 1 the machine always writes the top word, which is called greedy decoding. Together with temperature, this is how a product trades surprise for safety." },
  { id: "sampler", step: 4, title: "Sampler", fact: "sampler · a random point on the odds", text: "The odds are laid end to end along a tape, so each word gets a length equal to its chance. A random number between 0 and 1 picks a point on the tape, and the word under it is the one written next. Likely words win most draws but not all of them." },
];

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  P, contexts: CONTEXTS, temps: TEMPS, t0: T0, layers: LAYERS,
  steps: STEPS,
  parts: Object.fromEntries(PARTS.map(({ id, on, step, fact }) => [id, { step, fact, on: on || id }])),
  colX: WORDS.map((_, i) => colX(i)), colY: COL_Y, sleeveH: SLEEVE.h, piston: PISTON, rise: RISE,
  logitFloor: LOGIT_FLOOR, logitScale: LOGIT_SCALE,
  tape: TAPE, slot: [slotX(5), TILE_Y, RAIL_H], slots: [0, 1, 2, 3, 4].map(slotX), candZ: SLEEVE.h,
  topks: TOPKS, gateX: GATE_X, attn: ATTN,
  knob: KNOB, knobR: KNOB_R, knobZ: KNOB_Z[1], knobAngles: TEMPS.map((_, i) => knobAngle(i)),
};

const live = `
const D = ${JSON.stringify(DATA)};
const LAST = D.steps.length - 1;
const stage = document.querySelector(".iso-stage");
const svgEl = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const liveText = document.querySelector("[data-live]");
const prev = document.querySelector("[data-prev]");
const next = document.querySelector("[data-next]");
const dots = [...document.querySelectorAll("[data-dot]")];
const items = [...document.querySelectorAll("[data-select]")];
const cooler = document.querySelector("[data-cooler]");
const warmer = document.querySelector("[data-warmer]");
const drawButton = document.querySelector("[data-draw]");
const bars = [...document.querySelectorAll("[data-bar]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const N = 6;
let ctx = 0, C = D.contexts[0];
const contextButton = document.querySelector("[data-context]");
const word = (key) => stage.querySelector('[data-word="' + key + '"]');
const pistons = [...stage.querySelectorAll("[data-piston]")].sort((a, b) => a.dataset.piston - b.dataset.piston);
const tiles = [...stage.querySelectorAll("[data-tile]")].sort((a, b) => a.dataset.tile - b.dataset.tile);
const homes = [...stage.querySelectorAll("[data-home]")].sort((a, b) => a.dataset.home - b.dataset.home);
const dividers = [...stage.querySelectorAll("[data-divider]")].sort((a, b) => a.dataset.divider - b.dataset.divider);
const segs = [...stage.querySelectorAll("[data-seg]")].sort((a, b) => a.dataset.seg - b.dataset.seg);
const segLayer = stage.querySelector("[data-segs]");
const dividerLayer = stage.querySelector("[data-dividers]");
const carriage = stage.querySelector("[data-carriage]");
const head = stage.querySelector("[data-head]");
const caret = stage.querySelector("[data-caret]");
const knobLine = stage.querySelector("[data-knob]");
const fly = stage.querySelector("[data-fly]");
const layers = [...stage.querySelectorAll("[data-layer]")];
const groups = [...stage.querySelectorAll("[data-part]")];
const attnLayer = stage.querySelector("[data-attn]");
const sliderEl = stage.querySelector("[data-slider]");
const topkButton = document.querySelector("[data-topk]");
const guessButtons = [...document.querySelectorAll("[data-guess]")].sort((a, b) => a.dataset.guess - b.dataset.guess);
const guessResult = document.querySelector("[data-guess-result]");
const layerPicks = [...document.querySelectorAll("[data-lp]")].sort((a, b) => a.dataset.lp - b.dataset.lp);
const lnTitle = document.querySelector("[data-ln-title]");
const lnText = document.querySelector("[data-ln-text]");
const lnBars = [...document.querySelectorAll("[data-lb]")].sort((a, b) => a.dataset.lb - b.dataset.lb);
const attnRows = [...document.querySelectorAll("[data-q]")].sort((a, b) => a.dataset.q - b.dataset.q);

let kIdx = 0;
// the top-k gate: only the k best scores keep their odds
const kept = () => { const order = C.logits.map((_, i) => i).sort((a, b) => C.logits[b] - C.logits[a]); return new Set(order.slice(0, D.topks[kIdx])); };
const softmax = (t) => { const keep = kept(); const top = Math.max(...C.logits); const e = C.logits.map((z, i) => (keep.has(i) ? Math.exp((z - top) / t) : 0)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
const pct = (p) => (p === 1 ? "100" : p === 0 ? "0" : p >= 0.995 ? "99" : p < 0.005 ? "<1" : Math.round(p * 100)) + "%";
const tText = (t) => "T " + (t < 1 ? t.toFixed(2).replace(/0$/, "") : t.toFixed(1));
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const shift = (dx, dy, dz) => [D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz, D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz];
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };

let temp = D.t0, probs = softmax(D.temps[temp]);
let step = 0, selected = null, u = 0.5, winner = 0;
let touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0, clock = 0;
// eased quantities
const h = Array(N).fill(0); // piston rise
const cut = Array(N).fill(0); // divider positions (running totals)
let pin = 0, flight = 0, readAt = 0, segShow = 0, readClock = 0;
// one pass of reading: the head sweeps the tiles, then the layers light bottom to top
const SWEEP = 0.9, LAYER_T = 0.4, PASS = SWEEP + D.layers * LAYER_T + 0.5;
let layerPin = null; // a layer the reader picked: the wave holds there
const wave = () => (step !== 1 ? -1 : layerPin !== null ? layerPin + 0.99 : ((readClock % PASS) - SWEEP) / LAYER_T); // < 0 while sweeping, then the layer index (fraction: look, then think)
const pinPos = (n) => (step >= 4 ? u : 0);
// attention: which token is looking back (the last one unless the reader picks one)
let query = 4, pinned = false, attnKey = "";
// predict, then reveal
let guess = null, tries = 0, hits = 0, expected = 0, guessP = 0;

function cumulative() { const c = []; let s = 0; for (let i = 0; i < N - 1; i++) { s += probs[i]; c.push(s); } return c; }
function pick(r) { let s = 0; for (let i = 0; i < N; i++) { s += probs[i]; if (r < s) return i; } return N - 1; }

function goals() {
  const g = {};
  g.h = C.logits.map((z, i) => (step < 2 ? 0 : step === 2 ? (z - D.logitFloor) * D.logitScale : probs[i] * D.rise));
  g.cut = cumulative();
  g.seg = step >= 3 ? 1 : 0;
  g.pin = step >= 4 ? u : 0;
  g.flight = step >= 5 ? 1 : 0;
  return g;
}

function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }
const sentence = () => C.words.join(" ") + " " + C.cands[winner];
const topList = () => C.cands.map((w, i) => [w, probs[i]]).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, p]) => w + " " + pct(p)).join(" · ");
function lookText(q) {
  const row = C.attn[q];
  const top = row.map((w, j) => [C.words[j] + (j === q ? " (itself)" : ""), w]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return "“" + C.words[q] + "” looks back · " + top.map(([w, p]) => w + " " + Math.round(p * 100) + "%").join(" · ");
}
function stepText(n) {
  if (n === 0) return "“" + C.words.join(" ") + " …” · " + C.words.length + " tokens";
  if (n === 1 && pinned) return lookText(query);
  if (n === 1 && layerPin !== null) return "layer " + (layerPin + 1) + " · " + C.notes[layerPin];
  if (n === 1) { const v = wave(), w = Math.floor(v); return w < 0 ? "reading · head takes in tokens" : w < D.layers ? "layer " + (w + 1) + " of " + D.layers + (v - w < 0.5 ? " · look back" : " · think") : "reading · summary to scoring"; }
  if (n === 2) return "scores · " + C.cands.slice(0, 3).map((w, i) => w + " " + C.logits[i].toFixed(1)).join(" · ");
  if (n === 3) return tText(D.temps[temp]) + (D.topks[kIdx] < N ? " · top-" + D.topks[kIdx] : "") + " · " + topList();
  if (n === 4) return "draw · " + u.toFixed(2) + " → " + C.cands[winner];
  if (n === 5) return "“" + sentence() + "”";
  return D.steps[n].say;
}

function setStep(n) {
  n = Math.max(0, Math.min(LAST, n));
  if (n === step) return;
  if (n >= 4 && step < 4) { u = Math.random(); winner = pick(u); }
  if (n < 5) markWinner(false);
  if (n === 1) readClock = 0;
  if (n !== 1 && pinned) { pinned = false; query = 4; heat(); }
  if (n !== 1 && layerPin !== null) { layerPin = null; layerPanel(); }
  step = n;
  controls();
  if (!touring) announce(stepText(step));
  run();
}

function markWinner(on) {
  tiles.forEach((tile, i) => { const solid = tile.querySelector(".iso-solid"); if (on && i === winner) solid.setAttribute("data-lit", ""); else solid.removeAttribute("data-lit"); });
}

function setTopK(n) {
  n = (n + D.topks.length) % D.topks.length;
  kIdx = n;
  probs = softmax(D.temps[temp]);
  if (step >= 4) winner = pick(u);
  setT(sliderEl, shift(D.gateX[kIdx] - D.gateX[0], 0, 0));
  if (step < 3) setStep(3);
  controls();
  announce((D.topks[kIdx] === N ? "top-k off · all " + N + " words" : "top-" + D.topks[kIdx] + " · " + topList()));
  run();
}

function setLayer(i) {
  hold();
  select(null);
  pinned = false; query = 4; heat();
  layerPin = Math.max(0, Math.min(D.layers - 1, i));
  if (step !== 1) setStep(1);
  layerPanel();
  announce(stepText(1));
  run();
}
// the close-up under the figure: what the picked layer adds, and the odds if scored there
let panelLayer = D.layers - 1;
function layerPanel() {
  if (layerPin !== null) panelLayer = layerPin;
  const i = panelLayer;
  layerPicks.forEach((b, j) => (j === i ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
  lnTitle.textContent = "Layer " + (i + 1) + " of " + D.layers + (i === 0 ? " · bottom" : i === D.layers - 1 ? " · top" : "");
  lnText.textContent = C.notes[i];
  const f = (i + 1) / D.layers, top = Math.max(...C.logits);
  const e = C.logits.map((z) => Math.exp((z - top) * f)), sum = e.reduce((a, b) => a + b, 0);
  lnBars.forEach((bar, j) => { const p = e[j] / sum; bar.style.setProperty("--p", p.toFixed(4)); bar.querySelector("span").textContent = C.cands[j]; bar.querySelector("b").textContent = Math.round(p * 100) + "%"; });
}

function setQuery(q) {
  hold();
  select(null);
  layerPin = null;
  query = (q + C.words.length) % C.words.length;
  pinned = true;
  if (step !== 1) setStep(1);
  heat();
  announce(lookText(query));
  run();
}
// the threads over the rail: one from the looking token back to each earlier token
function attnSvg(q) {
  const row = C.attn[q];
  const end = (j) => [D.slots[j], D.attn.y, D.attn.z];
  let out = "";
  for (let j = 0; j < q; j++) {
    const a = end(q), b = end(j);
    const lift = 5 + Math.abs(a[0] - b[0]) * 0.2;
    const pts = [];
    for (let s = 0; s <= 24; s++) { const t = s / 24; pts.push(iso([a[0] + (b[0] - a[0]) * t, a[1], a[2] + Math.sin(Math.PI * t) * lift], D.P)); }
    out += '<path class="iso-line" data-tone="lit" style="stroke-width:' + (0.45 + row[j] * 2.6).toFixed(2) + '" d="' + pathOf(pts) + '"/>';
  }
  for (let j = 0; j <= q; j++) out += dotsSvg([iso(end(j), D.P)], { size: j === q ? 0.9 : 0.45 + row[j] * 1.6, tone: j === q ? "lit" : "hi" }) + (j === q ? linesRing(end(j)) : "");
  return out;
}
// a ring round the looking token's anchor
const linesRing = ([x, y, z]) => '<path class="iso-line" data-tone="lit" d="' + pathOf(Array.from({ length: 20 }, (_, i) => iso([x + Math.cos((i / 20) * 2 * Math.PI) * 2.4, y + Math.sin((i / 20) * 2 * Math.PI) * 0.9, z], D.P)), true) + '"/>';
function heat() {
  attnRows.forEach((row, i) => (pinned && i === query ? row.setAttribute("data-on", "") : row.removeAttribute("data-on")));
}
function fillHeat() {
  document.querySelectorAll("[data-aw]").forEach((el) => (el.textContent = C.words[el.dataset.aw]));
  document.querySelectorAll("[data-c]").forEach((cell) => { const [i, j] = cell.dataset.c.split("-").map(Number); const w = C.attn[i][j]; cell.style.setProperty("--w", w.toFixed(2)); w >= 0.4 ? cell.setAttribute("data-strong", "") : cell.removeAttribute("data-strong"); cell.textContent = Math.round(w * 100); });
}

function guessWord(i) {
  if (probs[i] === 0) return;
  hold();
  guess = i;
  guessP = probs[i];
  guessButtons.forEach((b, j) => { b.removeAttribute("data-win"); j === i ? b.setAttribute("data-on", "") : b.removeAttribute("data-on"); });
  guessResult.textContent = "drawing …";
  draw();
}
function reveal() {
  tries += 1;
  expected += guessP;
  const right = winner === guess;
  if (right) hits += 1;
  guessButtons[winner].setAttribute("data-win", "");
  const text = (right ? "Right: " : "Not this time: ") + "you picked " + C.cands[guess] + " (" + pct(guessP) + "), it drew " + C.cands[winner] + ". " + hits + " of " + tries + " right; the odds expected " + expected.toFixed(1) + ".";
  guessResult.textContent = text;
  announce(text);
  guess = null;
}

function setTemp(n) {
  n = Math.max(0, Math.min(D.temps.length - 1, n));
  if (n === temp) return;
  temp = n;
  probs = softmax(D.temps[temp]);
  if (step >= 4) winner = pick(u);
  knobLine.setAttribute("d", lineOnTop([D.knob[0] + Math.cos(D.knobAngles[temp]) * 1.4, D.knob[1] + Math.sin(D.knobAngles[temp]) * 1.4], [D.knob[0] + Math.cos(D.knobAngles[temp]) * (D.knobR - 2), D.knob[1] + Math.sin(D.knobAngles[temp]) * (D.knobR - 2)], D.knobZ, D.P));
  if (step < 3) setStep(3);
  controls();
  announce(tText(D.temps[temp]) + " · " + topList());
  run();
}

function setContext(n, auto) {
  if (!auto) { hold(); select(null); }
  ctx = (n + D.contexts.length) % D.contexts.length;
  C = D.contexts[ctx];
  probs = softmax(D.temps[temp]);
  const fit = (el, w, long) => { el.textContent = w; el.setAttribute("font-size", w.length > long ? 3.4 : 3.9); };
  C.words.forEach((w, i) => fit(word("ctx-" + i), w, 4));
  C.cands.forEach((w, i) => { fit(word("cand-" + i), w, 4); word("seg-" + i).textContent = w; guessButtons[i].textContent = w; guessButtons[i].removeAttribute("data-on"); guessButtons[i].removeAttribute("data-win"); });
  attnKey = "";
  fillHeat();
  layerPanel();
  if (!auto) { tries = hits = 0; expected = 0; guess = null; guessResult.textContent = ""; }
  markWinner(false);
  flight = 0;
  step = -1;
  setStep(0);
  if (!auto) setTimeout(() => { if (!touring && step === 0) setStep(1); }, 350);
  controls();
  announce("new sentence · “" + C.words.join(" ") + " …”");
}

function draw() {
  hold();
  select(null);
  u = Math.random(); winner = pick(u);
  markWinner(false);
  if (step >= 4) { step = 3; flight = Math.min(flight, 1); }
  setStep(4);
  drawTimer = 1.6;
}
let drawTimer = 0;

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const g of groups) { if (id && g.dataset.part === D.parts[id].on) g.setAttribute("data-on", ""); else g.removeAttribute("data-on"); }
  if (id) stage.setAttribute("data-focus", ""); else stage.removeAttribute("data-focus");
  for (const item of items) { if (item.dataset.select === id) item.setAttribute("data-on", ""); else item.removeAttribute("data-on"); }
  if (id) announce(D.parts[id].fact);
  place();
}

function controls() {
  prev.disabled = step <= 0;
  next.querySelector("span").textContent = D.steps[step].next;
  next.setAttribute("aria-label", D.steps[step].next);
  dots.forEach((dot, index) => (index < step ? dot.setAttribute("data-on", "") : dot.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(step));
  stage.setAttribute("aria-valuetext", stepText(step));
  cooler.disabled = temp === 0;
  warmer.disabled = temp === D.temps.length - 1;
  document.querySelector("[data-temp]").textContent = tText(D.temps[temp]);
  topkButton.textContent = "k " + (D.topks[kIdx] === N ? "all" : D.topks[kIdx]);
  guessButtons.forEach((b, i) => (b.disabled = probs[i] === 0));
  bars.forEach((bar) => { const i = Number(bar.dataset.bar); bar.style.setProperty("--p", probs[i].toFixed(4)); bar.querySelector("span").textContent = C.cands[i]; bar.querySelector("b").textContent = pct(probs[i]); });
}

// exponential follow: calm, frame-rate independent
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.002 ? target : nx; };

function update(dt, calm) {
  const g = goals();
  let busy = false;
  const go = (x, target, rate) => { const nx = calm ? target : follow(x, target, rate, dt); if (nx !== target) busy = true; return nx; };
  for (let i = 0; i < N; i++) h[i] = go(h[i], g.h[i], 6);
  for (let i = 0; i < N - 1; i++) cut[i] = go(cut[i], g.cut[i], 6);
  segShow = go(segShow, g.seg, 8);
  pin = go(pin, g.pin, 3.2);
  // the tile leaves only once the pin has settled
  flight = go(flight, step >= 5 ? (Math.abs(pin - g.pin) < 0.01 ? 1 : 0) : 0, 3.5);
  if (step === 1 && !calm) { readClock += dt; const t = readClock % PASS; readAt = Math.min(4, (t / SWEEP) * 4); busy = true; } else readAt = go(readAt, 0, 6);
  if (drawTimer > 0) { drawTimer -= dt; if (drawTimer <= 0 && step === 4) setStep(5); busy = true; }
  return busy || step === 1;
}

function rebuildPiston(i) {
  const rise = Math.max(0.6, h[i]);
  const key = rise.toFixed(1);
  if (pistons[i]._k === key) return;
  pistons[i]._k = key;
  const plan = { x: D.colX[i] - D.piston.w / 2, y: D.colY - D.piston.d / 2, w: D.piston.w, d: D.piston.d, r: 0.6 };
  pistons[i].innerHTML = solidSvg(slabOf(plan, D.sleeveH - 0.5, rise + 0.5, D.P, 2), { tone: "mid" });
}

function place() {
  for (let i = 0; i < N; i++) rebuildPiston(i);
  // tiles ride on their pistons, or fly to the empty slot
  for (let i = 0; i < N; i++) {
    const rise = Math.max(0.6, h[i]);
    const f = i === winner ? ease(flight) : 0;
    const tile = tiles[i];
    if (f > 0.001) {
      if (tile.parentNode !== fly) fly.appendChild(tile);
      const from = [D.colX[i], D.colY, D.candZ + rise];
      const to = D.slot;
      const lift = Math.sin(Math.PI * f) * 34;
      setT(tile, shift((to[0] - from[0]) * f, (to[1] - from[1]) * f, rise + (to[2] - from[2]) * f + lift));
    } else {
      if (tile.parentNode !== homes[i]) homes[i].appendChild(tile);
      setT(tile, shift(0, 0, rise));
    }
  }
  if (flight > 0.999 && step >= 5) { markWinner(true); if (guess !== null) reveal(); }
  // excluded words sit faded once the gate has cut them
  homes.forEach((home, i) => (step >= 3 && probs[i] === 0 ? home.setAttribute("data-cut", "") : home.removeAttribute("data-cut")));
  // attention threads: while the layers work, or while the reader looks at attention
  const showAttn = selected === "attention" || (step === 1 && (pinned || wave() >= 0));
  const key = ctx + ":" + query;
  if (showAttn && attnKey !== key) { attnKey = key; attnLayer.innerHTML = attnSvg(query); }
  attnLayer.style.opacity = showAttn ? 1 : 0;

  caret.style.opacity = flight > 0.2 ? 0 : 1;
  // the tape: dividers at running totals, words centred in their segments
  dividerLayer.style.opacity = segShow.toFixed(2);
  segLayer.style.opacity = segShow.toFixed(2);
  for (let i = 0; i < N - 1; i++) setT(dividers[i], shift(D.tape.x + cut[i] * D.tape.len, 0, 0));
  for (let i = 0; i < N; i++) {
    const a = i ? cut[i - 1] : 0, b = i < N - 1 ? cut[i] : 1;
    setT(segs[i], shift(D.tape.x + ((a + b) / 2) * D.tape.len, 0, 0));
    segs[i].style.visibility = (b - a) * D.tape.len > C.cands[i].length * 2.2 + 2 ? "visible" : "hidden";
  }
  setT(carriage, shift(pin * D.tape.len, 0, 0));
  // the read head sweeps the tiles while reading
  const slot = Math.min(4, readAt);
  setT(head, shift(slot * (D.slots[1] - D.slots[0]), 0, 0));
  // the layer the reading has reached is lit; the ones below it are done
  const w = Math.floor(wave());
  layers.forEach((layer, i) => {
    const on = step === 1 && i === w;
    const solid = layer.querySelector(".iso-solid");
    if (!!solid._on !== on) { solid._on = on; on ? solid.setAttribute("data-lit", "") : solid.removeAttribute("data-lit"); }
    layer.querySelector(".iso-dots").setAttribute("data-tone", on ? "hi" : step === 1 && i < w ? "mid" : "lo");
    const frac = wave() - w;
    const tone = (el, t) => { if (el._t2 !== t) { el._t2 = t; el.setAttribute("data-tone", t); } };
    tone(layer.querySelector("[data-look] .iso-dots"), on && frac < 0.5 ? "hi" : step === 1 && i < w ? "mid" : "lo");
    tone(layer.querySelector("[data-think] .iso-dots"), on && frac >= 0.5 ? "hi" : step === 1 && i < w ? "mid" : "lo");
  });
  const text = selected ? D.parts[selected].fact : stepText(step);
  if (readout.textContent !== text) readout.textContent = text;
}

// The idle tour walks the loop: context, read, score, softmax, draw, append, and again.
const TOUR = 2.4;
const BEATS = D.steps.map((_, i) => (i === 1 ? PASS + 0.3 : TOUR));
const TOUR_ALL = BEATS.reduce((a, b) => a + b, 0);
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) {
    tourClock += dt;
    let t = tourClock % TOUR_ALL, beat = 0;
    while (t >= BEATS[beat]) t -= BEATS[beat++];
    if (beat === 0 && step === LAST) setContext(ctx + 1, true);
    else if (beat !== step) setStep(beat);
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
    tourClock = BEATS.slice(0, Math.max(0, step)).reduce((a, b) => a + b, 0);
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
  const keys = { ArrowRight: () => go(step + 1), ArrowDown: () => go(step + 1), ArrowLeft: () => go(step - 1), ArrowUp: () => go(step - 1), Home: () => go(0), End: () => go(LAST), " ": forward, Enter: forward, Escape: () => { hold(); select(null); go(0); }, d: draw, D: draw, c: () => setContext(ctx + 1), C: () => setContext(ctx + 1), k: () => { hold(); setTopK(kIdx + 1); }, l: () => setLayer(layerPin === null ? 0 : (layerPin + 1) % D.layers), L: () => setLayer(layerPin === null ? 0 : (layerPin + 1) % D.layers), K: () => { hold(); setTopK(kIdx + 1); }, a: () => setQuery(pinned ? query + 1 : 1), A: () => setQuery(pinned ? query + 1 : 1), "[": () => { hold(); setTemp(temp - 1); }, "]": () => { hold(); setTemp(temp + 1); }, "-": () => { hold(); setTemp(temp - 1); }, "=": () => { hold(); setTemp(temp + 1); }, "+": () => { hold(); setTemp(temp + 1); } };
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
topkButton.addEventListener("click", () => { hold(); setTopK(kIdx + 1); });
guessButtons.forEach((b, i) => b.addEventListener("click", () => guessWord(i)));
layerPicks.forEach((b, i) => b.addEventListener("click", () => setLayer(i)));
attnRows.forEach((row, i) => { row.addEventListener("click", () => setQuery(i)); row.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse" && !pinned) { hold(); select("attention"); query = i; } }); row.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse" && !pinned) { query = 4; select(null); } }); });

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
  fig: "Fig 2 · v1",
  title: "Language model · next word",
  hint: "← → step · D draw · C sentence",
  readout: STEPS[0].say,
  keys: [
    { mark: "lit", label: "The pin: a random number, the only part that chooses" },
    { mark: "raised", label: "Rail, layers, pistons and tape: everything that sets the odds" },
  ],
  caption: `A language model writes one token at a time. It reads the whole context through a stack of layers, one layer after another, and gives every word it knows a score. Softmax turns the scores into odds that add up to 100%, after dividing each score by the temperature. Then it draws: the odds are laid end to end along a tape, a random number picks a point, and the word under that point is appended to the context. The loop repeats for the next token. A top-k gate can first shut out all but the k best words. The scores and attention weights here are toy numbers; the arithmetic is real.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Language model. Arrow keys step through how it picks the next word; D draws a word; C changes the sentence; [ and ] change the temperature; K moves the top-k gate; A shows where a token looks; L picks a layer; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="${STEPS[0].say}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Back one step" disabled>←</button><span class="pc-dots" aria-hidden="true">${STEPS.slice(1).map(() => "<i data-dot></i>").join("")}</span><button type="button" class="pc-btn pc-context" data-context aria-keyshortcuts="C">Sentence ↻</button><span class="pc-temp"><button type="button" class="pc-btn" data-cooler aria-label="Lower the temperature" aria-keyshortcuts="[">−</button><span data-temp>T 1.0</span><button type="button" class="pc-btn" data-warmer aria-label="Raise the temperature" aria-keyshortcuts="]">+</button></span><button type="button" class="pc-btn" data-topk aria-keyshortcuts="K" aria-label="Top-k gate: change how many words may be drawn">k all</button><button type="button" class="pc-btn" data-draw aria-keyshortcuts="D">Draw</button><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>
<div class="pc-guess"><span class="pc-guess-q">Guess the next word</span><span class="pc-guess-words">${WORDS.map((w, i) => `<button type="button" class="pc-btn" data-guess="${i}">${w}</button>`).join("")}</span><span class="pc-guess-result" data-guess-result></span></div>`,
});

const ARTICLE_CSS = `
.iso-stage [data-part]{cursor:pointer}
.iso-stage[data-focus] [data-part]:not([data-on]) *{stroke:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-fill{fill:var(--anatomy-paper)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-top{fill:var(--anatomy-top)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-shade{fill:var(--anatomy-shade-3)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) text{fill:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-dots circle{opacity:.1!important}
[data-segs],[data-dividers]{transition:none}
.pc-controls{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:-10px;padding:0 16px 14px;font:12px/1 var(--anatomy-mono,ui-monospace,Menlo,monospace);z-index:1}
.pc-btn{font:inherit;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-mid);padding:7px 10px;cursor:pointer;min-height:30px}
.pc-btn:hover{border-color:var(--anatomy-strong)}
.pc-btn:disabled{color:var(--anatomy-lo);border-color:var(--anatomy-faint);cursor:default}
.pc-context{margin-left:auto}
[data-layer]>.iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-hi)}
[data-layer]:has(>.iso-solid[data-lit]) .iso-dots circle{fill:var(--anatomy-paper)}
[data-layer]:has(>.iso-solid[data-lit]) .iso-dots[data-tone="lo"] circle{opacity:.35}
.pc-temp{display:inline-flex;align-items:center;gap:6px;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.pc-temp [data-temp]{min-width:44px;text-align:center}
.pc-temp .pc-btn{padding:7px 9px}
[data-home][data-cut]{opacity:.28}
[data-home]{transition:opacity .4s}
[data-attn]{transition:opacity .35s;pointer-events:none}
.pc-guess{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:0 16px 14px;font:12px/1 var(--anatomy-mono,ui-monospace,Menlo,monospace);color:var(--anatomy-muted)}
.pc-guess-words{display:flex;flex-wrap:wrap;gap:6px}
.pc-guess .pc-btn{padding:6px 8px;min-height:28px}
.pc-guess .pc-btn[data-on]{border-color:var(--anatomy-strong);box-shadow:inset 0 0 0 1px var(--anatomy-strong)}
.pc-guess .pc-btn[data-win]{background:var(--anatomy-strong);color:var(--anatomy-card);border-color:var(--anatomy-strong)}
.pc-guess-result{flex-basis:100%;min-height:14px;line-height:1.4;color:var(--anatomy-text)}
.pc-layers{display:grid;grid-template-columns:auto 1fr;gap:16px;margin-top:8px}
.pc-layer-pick{display:flex;flex-direction:column-reverse;gap:4px}
.pc-layer-pick .pc-btn{width:36px;padding:5px 0;min-height:26px}
.pc-layer-pick .pc-btn[data-on]{background:var(--anatomy-strong);color:var(--anatomy-card);border-color:var(--anatomy-strong)}
.pc-layer-note b{display:block;font:12px ui-monospace,Menlo,monospace;color:var(--anatomy-muted);font-weight:400}
.pc-layer-note p{margin:4px 0 10px;color:var(--anatomy-strong);font:600 17px/1.35 Georgia,serif}
.pc-attn{display:grid;gap:4px;margin-top:8px;font:12px ui-monospace,Menlo,monospace;color:var(--anatomy-muted)}
.pc-attn-head,.pc-attn-row{display:grid;grid-template-columns:64px repeat(5,minmax(0,1fr));gap:4px;align-items:center}
.pc-attn-head span{text-align:center;overflow:hidden;text-overflow:ellipsis}
.pc-attn-row{font:inherit;color:inherit;background:none;border:1px solid transparent;padding:2px;cursor:pointer;text-align:left}
.pc-attn-row:hover,.pc-attn-row[data-on]{border-color:var(--anatomy-mid);background:var(--anatomy-card)}
.pc-attn-row .w{color:var(--anatomy-text)}
.pc-attn i{font-style:normal;display:block;height:26px;line-height:26px;text-align:center;color:var(--anatomy-text);background:color-mix(in srgb,var(--anatomy-hi) calc(var(--w) * 100%),transparent);border:1px solid var(--anatomy-faint)}
.pc-attn i[data-strong]{color:var(--anatomy-card)}
.pc-attn i.ahead{background:repeating-linear-gradient(45deg,transparent 0 4px,color-mix(in srgb,var(--anatomy-faint) 60%,transparent) 4px 5px);border-color:transparent}
.pc-dots{display:flex;gap:5px}
.pc-dots i{width:6px;height:6px;border:1px solid var(--anatomy-mid);border-radius:50%}
.pc-dots i[data-on]{background:var(--anatomy-strong);border-color:var(--anatomy-strong)}
.pc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iso-plate{padding-bottom:60px}
@media (max-width:600px){.pc-controls{margin-top:8px;padding:0 4px 4px}.pc-context{margin-left:0}.iso-plate{padding-bottom:72px}}
@media (min-width:700px) and (min-height:860px){.iso-figure{position:sticky;top:0;z-index:2;background:var(--anatomy-page);padding:16px 0 14px;margin-top:-16px;box-shadow:0 1px 0 color-mix(in srgb,var(--anatomy-muted) 30%,transparent)}}
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
.pc-odds li{display:grid;grid-template-columns:48px 1fr 40px;align-items:center;gap:10px;padding:0;margin:0;border:0;cursor:default}
.pc-odds li:hover{background:none}
.pc-odds i{display:block;height:6px;background:var(--anatomy-faint);position:relative}
.pc-odds i::after{content:"";position:absolute;inset:0 auto 0 0;width:calc(var(--p) * 100%);background:var(--anatomy-hi);transition:width .4s var(--anatomy-ease)}
.pc-odds b{font-weight:400;text-align:right;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
`;
const odds = `<h2>The odds now</h2><p class="tip">Change the temperature with − and + (or [ and ]), slide the top-k gate with K, or change the sentence with C, and watch the spread.</p><ol class="pc-odds">${WORDS.map((w, i) => `<li data-bar="${i}" style="--p:${probs0[i].toFixed(4)}"><span>${w}</span><i></i><b>${Math.round(probs0[i] * 100)}%</b></li>`).join("")}</ol>`;
const C0 = CONTEXTS[0];
const layerClose = `<h2>Inside the stack · what each layer adds</h2><p class="tip">Pick a layer (or press L) to hold the bench there. The note is what that layer adds to the last “${C0.words[4]}”, and the bars are the odds if scoring happened right after it: nearly even low down, sharp at the top. Notes and numbers are illustrative.</p>
<div class="pc-layers"><div class="pc-layer-pick" role="group" aria-label="Pick a layer">${Array.from({ length: LAYERS }, (_, i) => `<button type="button" class="pc-btn" data-lp="${i}"${i === LAYERS - 1 ? " data-on" : ""}>${i + 1}</button>`).join("")}</div>
<div class="pc-layer-note"><b data-ln-title>Layer ${LAYERS} of ${LAYERS} · top</b><p data-ln-text>${C0.notes[LAYERS - 1]}</p><ol class="pc-odds">${C0.cands.map((w, i) => `<li data-lb="${i}" style="--p:${probs0[i].toFixed(4)}"><span>${w}</span><i></i><b>${Math.round(probs0[i] * 100)}%</b></li>`).join("")}</ol></div></div>`;
const attnTable = `<h2>Inside a layer · attention</h2><p class="tip">Each row is one token looking back at the tokens before it; the numbers are how much it draws on each (a row adds to 100). Nothing looks ahead. Click a row (or press A) to light its threads on the bench.</p>
<div class="pc-attn"><div class="pc-attn-head"><span></span>${C0.words.map((w, j) => `<span data-aw="${j}">${w}</span>`).join("")}</div>${C0.words.map((w, i) => `<button type="button" class="pc-attn-row" data-q="${i}" aria-label="Show where token ${i + 1} looks"><span class="w" data-aw="${i}">${w}</span>${C0.words.map((_, j) => (j <= i ? `<i data-c="${i}-${j}" style="--w:${C0.attn[i][j]}"${C0.attn[i][j] >= 0.4 ? " data-strong" : ""}>${Math.round(C0.attn[i][j] * 100)}</i>` : `<i class="ahead" aria-hidden="true"></i>`)).join("")}</button>`).join("")}</div>`;
const body = `<style>${CONTRAST_CSS}${ARTICLE_CSS}${EXPAND_CSS}</style>
<nav class="pc-nav"><a href="../">← anatomy/of</a><span class="pc-versions">version <a href="../language-model-computer/">computer</a> · <a href="../language-model/">tower</a> · <a href="../language-model-bench/" aria-current="page">bench</a></span></nav>
<header class="pc-head"><h1>Anatomy of a language model</h1><p>It doesn't plan a sentence. It picks one next word, from odds it works out fresh each time, and then does it again.</p></header>
${plateBody}
<section class="pc-parts"><h2>The parts</h2><p class="tip">Point at a part to find it in the figure; click it to step the machine to it.</p><ol>${PARTS.map(({ id, title, text }, index) => `<li><div class="pc-part" data-select="${id}" tabindex="0" role="button" aria-label="${title}: show it in the figure"><span class="num">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></div></li>`).join("")}</ol>${odds}${layerClose}${attnTable}</section>`;

const name = theme === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomy of a language model (bench)", theme, body, script: kitScript() + live + EXPAND_JS }));
console.log("wrote", name);
