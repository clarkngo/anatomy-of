// Anatomy of a language model, computer version: builds language-model-computer/index.html
// (light) or dark.html (--dark). The model as a small rack computer, read top to bottom:
// punched cards carry the context into a card reader, five bus lanes run down a backplane,
// four layer boards plug into it (on each, traces tie the last word's chip back to the earlier
// ones), the last lane runs on to a scoring chip, a front-panel LED bar meter shows the scores
// and then the odds, a random-number chip draws a point on an LED strip, and the punch cuts the
// winning word onto a card that goes back up into the reader.
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
const N = 6;
const CTX = CONTEXTS[0];

// A toy token id for a word, punched into its card as 12 bits (shared with the page).
function tokenId(word) {
  let h = 7;
  for (const c of word) h = (h * 31 + c.charCodeAt(0)) % 4093;
  return h | 1;
}
// The punched holes on a card's front face: 2 rows of 6 bit positions.
function holesD(iso, P, cx, y, z0, id) {
  let d = "";
  for (let b = 0; b < 12; b++) {
    if (!((id >> b) & 1)) continue;
    const x = cx - 7.5 + (b % 6) * 3;
    const z = z0 + Math.floor(b / 6) * 3.4;
    const pts = [[x - 0.6, y, z], [x + 0.6, y, z], [x + 0.6, y, z + 2], [x - 0.6, y, z + 2]].map((p) => iso(p, P));
    d += "M" + pts.map((q) => q[0].toFixed(2) + " " + q[1].toFixed(2)).join("L") + "Z";
  }
  return d;
}

// ---------- world (z up; the viewer sees the +x and +y faces) ----------
const W = 560;
const H = 760;
const PITCH = 24;
const posX = (i) => -60 + i * PITCH;
const PLINTH = { x: -100, y: -40, w: 200, d: 98, r: 6 };
const PLINTH_H = 10;
const POST = 5;
const POSTS = [[-92, -30], [92, -30], [-92, 30], [92, 30]];
const DECK = 98;
const LAYERS = [118, 158, 198, 238]; // board bottoms
const POST_TOP = 266;

// lower chassis: its top is the deck with the scoring chip, its front the panel
const CHASSIS = { x: -88, y: -22, w: 176, d: 52, r: 1.5 };
const FRONT = CHASSIS.y + CHASSIS.d; // y = 30
// backplane behind everything, five bus lanes on its front face
const BACKPLANE = { x: -84, y: -27, w: 168, d: 4, r: 0.6 };
const LANE_Y = BACKPLANE.y + BACKPLANE.d; // y = -23
// layer boards
const BOARD = { x: -84, y: -23, w: 168, d: 45, r: 0.8 };
const BOARD_H = 1.6;
const CHIP = { w: 14, d: 10, h: 2.2, y: -15 };
const LAST = 4;
const traceY = (j) => -5 + (3 - j) * 5.5; // the trace from chip j runs this far forward
const traceIn = (j) => posX(LAST) + 5 - j * 3; // and enters the last chip here
// card reader on top of the backplane
const READER = { x: -80, y: -27, w: 160, d: 28, r: 2 };
const READER_Z = [POST_TOP, POST_TOP + 16];
const CARD = { w: 20, d: 2.4, h: 22, y: -4 };
const CARD_Z = READER_Z[1];
const SLOT = 5;
// front panel
const LED = { n: 12, z0: 32, pitch: 4.4, h: 3.4, w: 12 };
const STRIP = { x: -54, len: 128, n: 32, z0: 14, h: 4 };
const DISPLAY = { x0: -84, x1: -61, z0: 12.4, z1: 20.2 };
const LOGIT_FLOOR = -1.5;
const LOGIT_SCALE = 2.5; // LEDs per unit of score
// on the plinth's ledge
const RNG = { x: -88, y: 34, w: 30, d: 15 };
const KNOB = [40, 46];
const KNOB_R = 6;
const KNOB_Z = [3, 8];
const DIAL_R = 9.5;
const KNOB_SPAN = (Math.PI * 4) / 3;
const knobAngle = (i) => Math.PI / 2 - KNOB_SPAN / 2 + (KNOB_SPAN * i) / (TEMPS.length - 1) + Math.PI;
const PUNCH = { x: 66, y: 39, w: 22, d: 13, h: 9, r: 1.2 };

const P = k.fitProjection(
  [...k.boxCorners(PLINTH, -PLINTH_H - 5, 0), [READER.x, READER.y, CARD_Z + CARD.h + 2], [READER.x + READER.w, READER.y + READER.d, CARD_Z + CARD.h + 2], [-94, 32, POST_TOP + 4], [94, -32, POST_TOP + 4]],
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
// flat shapes on the front (+y) face and on the side (+x) face
const rectY = (x0, x1, z0, z1, y) => k.pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map(at), true);
const rectX = (y0, y1, z0, z1, x) => k.pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map(at), true);
const lineY = (x0, z0, x1, z1, y) => k.pathOf([at([x0, y, z0]), at([x1, y, z1])]);
const frontText = (x, y, z, text, size, tone = "lo", anchor = "start") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), text, { size, tone, anchor });
const keyed = (svg, key) => svg.replace("<text ", `<text data-word="${key}" `);
const trace = (pts, extra = "") => `<path class="iso-line lm-trace"${extra} d="${k.pathOf(pts.map(at))}"/>`;

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
  out.push(frontText(PLINTH.x + 10, PLINTH.y + PLINTH.d, -3.4, "NEXT WORD · TOY MODEL", 3.6));
  return out.join("");
}

// a square rack post with its foot and cap, slotted down its front
function post([x, y]) {
  const plan = box(x, y, POST, POST, 0.4);
  const out = [S(k.slabOf(box(x, y, POST + 3, POST + 3, 0.8), 0, 2.4, P, 2, 0.4), { tone: "mid" })];
  const holes = [];
  for (let z = 14; z < POST_TOP - 6; z += 10) holes.push(at([x, y + POST / 2, z]));
  out.push(S(k.slabOf(plan, 2.4, POST_TOP - 2.4, P, 2, 0.3), { tone: "mid", inner: Dt(holes, { size: 0.35, tone: "lo" }) }));
  out.push(S(k.slabOf(box(x, y, POST + 1.2, POST + 1.2, 0.6), POST_TOP, 1.6, P, 2, 0.3), { tone: "mid" }), Dt([at([x, y, POST_TOP + 1.6])], { size: 0.45 }));
  return out.join("");
}
// top side rails, from back post to front post
const sideRail = (x) => S(k.slabOf({ x: x - 2, y: -30, w: 4, d: 60, r: 0.4 }, POST_TOP - 4, 4, P, 2, 0.3), { tone: "mid" }) + screws([[x, -24], [x, 24]], POST_TOP, 0.38);

function backplane() {
  const out = [S(k.slabOf(BACKPLANE, 2.4, POST_TOP - 2.4, P, 2, 0.3), { tone: "lo" })];
  // the five bus lanes, top to bottom; the last runs on down to the deck
  const lanes = [];
  for (let i = 0; i < 5; i++) {
    const bottom = i === LAST ? DECK : LAYERS[0] - 4;
    lanes.push(k.pathOf([at([posX(i), LANE_Y, POST_TOP - 1]), at([posX(i), LANE_Y, bottom])]));
  }
  out.push(L(lanes.join(""), { tone: "mid" }), Dt([0, 1, 2, 3].map((i) => at([posX(i), LANE_Y, LAYERS[0] - 4])), { size: 0.55, tone: "mid" }));
  // a connector for every board
  for (const z of LAYERS) {
    out.push(S(k.slabOf({ x: -80, y: LANE_Y - 0.2, w: 160, d: 2.2, r: 0.3 }, z - 2.2, 5.4, P, 2), { tone: "mid", crease: "none" }));
    out.push(screws([[-82, LANE_Y], [82, LANE_Y]], z + 3.2, 0.38));
  }
  out.push(frontText(BACKPLANE.x + 3, LANE_Y, LAYERS[0] - 12, "BUS", 2.6));
  return out.join("");
}

// the lower chassis: deck on top, front panel with the LED bar meter, a fan on its side
function chassis() {
  const out = [S(k.slabOf(CHASSIS, 0, DECK, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(CHASSIS, DECK - 3, P, 3), { tone: "faint" }) })];
  // the deck: an engraved border, the last lane coming forward, the scoring chip
  out.push(L(k.planOutline(k.insetPlan(CHASSIS, 3), DECK, P, 3), { tone: "faint" }));
  const side = CHASSIS.x + CHASSIS.w;
  // fan behind a grille on the right side
  const [fy, fz, fr] = [2, 46, 16];
  const circle = (r) => k.pathOf(Array.from({ length: 48 }, (_, i) => at([side, fy + Math.cos((2 * Math.PI * i) / 48) * r, fz + Math.sin((2 * Math.PI * i) / 48) * r])), true);
  out.push(`<path class="iso-shade" data-shade="1" d="${circle(fr)}"/>`, L(circle(fr) + circle(fr - 4) + circle(fr - 8), { tone: "lo" }), L(circle(4.4), { tone: "mid" }));
  let spokes = "";
  for (let i = 0; i < 7; i++) {
    const a = (2 * Math.PI * i) / 7;
    spokes += k.pathOf([at([side, fy + Math.cos(a) * 4.4, fz + Math.sin(a) * 4.4]), at([side, fy + Math.cos(a + 0.5) * fr, fz + Math.sin(a + 0.5) * fr])]);
  }
  out.push(L(spokes, { tone: "lo" }), Dt([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => at([side, fy + a * (fr + 3), fz + b * (fr + 3)])), { size: 0.45 }));
  // vent slots at the back of the side
  let vents = "";
  for (let r = 0; r < 6; r++) vents += k.pathOf([at([side, -18, 20 + r * 9]), at([side, -18, 26 + r * 9])]) + k.pathOf([at([side, -14, 20 + r * 9]), at([side, -14, 26 + r * 9])]);
  out.push(L(vents, { tone: "lo", free: "both" }));
  out.push(k.faceTextSvg(k.sideMatrix([side, 26], 82, P, "right"), "SCORES · ODDS", { size: 2.6, tone: "lo" }));
  return out.join("");
}

function deck() {
  const out = [];
  const z = DECK;
  // the last lane comes forward along the deck into the scoring chip
  out.push(trace([[posX(LAST), LANE_Y, z], [posX(LAST), 6, z], [17, 6, z]]).replace("lm-trace", "lm-trace lm-in"));
  const chip = box(0, 6, 34, 14, 0.6);
  let pins = "";
  for (let i = 0; i < 9; i++) {
    const x = chip.x + 3 + i * 3.5;
    pins += k.lineOnTop([x, chip.y - 1.6], [x, chip.y], z, P) + k.lineOnTop([x, chip.y + chip.d], [x, chip.y + chip.d + 1.6], z, P);
  }
  out.push(L(pins, { tone: "mid" }));
  out.push(S(k.slabOf(chip, z, 3, P, 2, 0.4), { tone: "hi", inner: Dt([at([chip.x + 2.4, chip.y + 2.4, z + 3])], { size: 0.4, tone: "lo" }) }));
  out.push(k.faceTextSvg(k.topMatrix([-10, 9], z + 3, P, "x"), "SCORE", { size: 3.4, tone: "lo" }));
  // six output traces fanning out to the panel, then down its face to each meter
  for (let i = 0; i < N; i++) {
    const xs = chip.x + 3 + [1, 2, 3, 5, 6, 7][i] * 3.5; // on a pin
    out.push(trace([[xs, chip.y + chip.d + 1.6, z], [xs, 16, z], [posX(i), 25, z], [posX(i), FRONT, z], [posX(i), FRONT, LED.z0 + LED.n * LED.pitch + 8.6]], ` data-out="${i}"`));
  }
  out.push(Dt(Array.from({ length: N }, (_, i) => at([posX(i), FRONT, LED.z0 + LED.n * LED.pitch + 8.6])), { size: 0.5, tone: "mid" }));
  out.push(screws([[CHASSIS.x + 4, CHASSIS.y + 4], [CHASSIS.x + CHASSIS.w - 4, CHASSIS.y + 4], [CHASSIS.x + 4, FRONT - 4], [CHASSIS.x + CHASSIS.w - 4, FRONT - 4]], z, 0.45));
  return out.join("");
}

// the front panel: an LED bar meter per candidate, values above, words below, the odds strip
function panel() {
  const y = FRONT;
  const out = [];
  out.push(L(rectY(CHASSIS.x + 3, CHASSIS.x + CHASSIS.w - 3, 2, DECK - 4, y), { tone: "faint" }));
  out.push(Dt([[CHASSIS.x + 5.5, 4.5], [CHASSIS.x + CHASSIS.w - 5.5, 4.5], [CHASSIS.x + 5.5, DECK - 6.5], [CHASSIS.x + CHASSIS.w - 5.5, DECK - 6.5]].map(([x, z]) => at([x, y, z])), { size: 0.5 }));
  let off = "", on = "";
  for (let i = 0; i < N; i++) {
    const x = posX(i);
    // a bezel around the column
    out.push(L(rectY(x - LED.w / 2 - 1.4, x + LED.w / 2 + 1.4, LED.z0 - 1.4, LED.z0 + LED.n * LED.pitch + 0.4, y), { tone: "lo" }));
    for (let n = 0; n < LED.n; n++) {
      const z = LED.z0 + n * LED.pitch;
      const d = rectY(x - LED.w / 2, x + LED.w / 2, z, z + LED.h, y);
      off += d;
      on += `<path class="lm-on" data-led="${i}-${n}" d="${d}"/>`;
    }
    out.push(keyed(frontText(x, y, LED.z0 + LED.n * LED.pitch + 3, "", 3.4, "mid", "middle"), `val-${i}`));
    out.push(keyed(frontText(x, y, LED.z0 - 6.4, CTX.cands[i], CTX.cands[i].length > 5 ? 4.4 : 5.2, "hi", "middle"), `cand-${i}`));
  }
  // the scale, on the left of the meters
  const sx = posX(0) - LED.w / 2 - 6;
  let ticks = "";
  for (let n = 0; n <= LED.n; n += 3) {
    const z = LED.z0 + n * LED.pitch - 0.5;
    ticks += lineY(sx + (n % 6 ? 1.6 : 0), z, sx + 3.4, z, y);
  }
  out.push(L(lineY(sx + 3.4, LED.z0 - 0.5, sx + 3.4, LED.z0 + LED.n * LED.pitch - 0.5, y), { tone: "lo" }), L(ticks, { tone: "lo" }));
  out.push(frontText(sx - 8.5, y, LED.z0 - 1.4, "0", 2.6), frontText(sx - 10.5, y, LED.z0 + LED.n * LED.pitch - 1.4, "max", 2.6));
  // the odds strip: one LED per 1/36 of the odds
  const pitch = STRIP.len / STRIP.n;
  let soff = "", son = "";
  for (let m = 0; m < STRIP.n; m++) {
    const x0 = STRIP.x + m * pitch + 0.45;
    const d = rectY(x0, x0 + pitch - 0.9, STRIP.z0, STRIP.z0 + STRIP.h, y);
    soff += d;
    son += `<path class="lm-on" data-strip="${m}" d="${d}"/>`;
  }
  out.push(L(rectY(STRIP.x - 1.2, STRIP.x + STRIP.len + 1.2, STRIP.z0 - 1.2, STRIP.z0 + STRIP.h + 1.2, y), { tone: "lo" }));
  out.push(`<path class="lm-led" d="${off + soff}"/>`, `<g data-leds>${on}</g>`, `<g data-strips>${son}</g>`);
  out.push(frontText(STRIP.x + STRIP.len + 3, y, STRIP.z0 + 0.6, "ODDS", 2.6));
  // the power lamp
  out.push(`<path class="lm-on lm-power" d="${rectY(CHASSIS.x + CHASSIS.w - 12, CHASSIS.x + CHASSIS.w - 9, DECK - 11, DECK - 9, y)}"/>`, frontText(CHASSIS.x + CHASSIS.w - 20, y, DECK - 11, "PWR", 2.2));
  return out.join("");
}
// strip dividers (where one word's share ends) and the cursor the random number sets
const dividerSvg = () => L(lineY(0, STRIP.z0 + STRIP.h + 1.4, 0, STRIP.z0 + STRIP.h + 3.6, FRONT), { tone: "hi", free: "both" });
const cursorSvg = () => `<path class="lm-cursor" d="${rectY(-1.1, 1.1, STRIP.z0 - 0.6, STRIP.z0 + STRIP.h + 0.6, FRONT + 0.1)}"/>` + `<path class="lm-cursor" d="${k.pathOf([at([0, FRONT, STRIP.z0 - 1.4]), at([-1.4, FRONT, STRIP.z0 - 3.6]), at([1.4, FRONT, STRIP.z0 - 3.6])], true)}"/>`;

// a layer board: chips in a row, traces from each earlier chip into the last one
function board(z, layer) {
  const top = z + BOARD_H;
  const out = [];
  // card guides on both posts' sides
  for (const x of [BOARD.x - 5.5, BOARD.x + BOARD.w]) out.push(S(k.slabOf({ x, y: BOARD.y, w: 5.5, d: BOARD.d, r: 0.3 }, z - 2.4, 2.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(BOARD, z, BOARD_H, P, 2, 0.2), { tone: "mid", inner: `<path class="iso-shade" data-shade="2" d="${k.pathOf([0, 1, 3, 2].map((n) => k.corners(k.insetPlan(BOARD, 2))[n]).map(([x, y]) => at([x, y, top])), true)}"/>` + L(k.planOutline(k.insetPlan(BOARD, 2), top, P, 2), { tone: "faint" }) }));
  // the faceplate hanging under the front edge
  const fp = { x: BOARD.x, y: BOARD.y + BOARD.d, w: BOARD.w, d: 1.4, r: 0.2 };
  out.push(S(k.slabOf(fp, z - 5, 5 + BOARD_H, P, 2), { tone: "mid", inner: frontText(fp.x + 9, fp.y + fp.d, z - 3.4, `LAYER ${layer + 1}`, 2.8) + screws([[fp.x + 3, fp.y + fp.d], [fp.x + fp.w - 3, fp.y + fp.d]], z - 1.8, 0.4) }));
  out.push(`<path class="lm-led" d="${rectY(66, 70, z - 3.4, z - 1.4, fp.y + fp.d)}"/><path class="lm-on" data-board-led="${layer}" d="${rectY(66, 70, z - 3.4, z - 1.4, fp.y + fp.d)}"/>`);
  // bus fingers from the backplane connector into each chip
  let fingers = "";
  for (let i = 0; i < 5; i++) for (const dx of [-3, 0, 3]) fingers += k.lineOnTop([posX(i) + dx, BOARD.y + 0.4], [posX(i) + dx, CHIP.y - CHIP.d / 2 - 1.4], top, P);
  out.push(L(fingers, { tone: "lo" }));
  // attention traces, under the chips' pins
  const base = out.join("");
  out.length = 0;
  const threads = (`<g data-threads="${layer}">${[0, 1, 2, 3].map((j) => {
    const x0 = posX(j) + 3;
    const x1 = traceIn(j);
    const y1 = traceY(j);
    const y0 = CHIP.y + CHIP.d / 2 + 1.4;
    return `<path class="iso-line lm-thread" data-thread="${layer}-${j}" d="${k.pathOf([[x0, y0], [x0, y1 - 2], [x0 + 2, y1], [x1 - 2, y1], [x1, y1 - 2], [x1, y0]].map(([x, y]) => at([x, y, top])))}"/>`;
  }).join("")}</g>`);
  for (let i = 0; i < 5; i++) {
    const chip = box(posX(i), CHIP.y, CHIP.w, CHIP.d, 0.5);
    let pins = "";
    for (let n = 0; n < 4; n++) {
      const x = chip.x + 2.5 + n * 3;
      pins += k.lineOnTop([x, chip.y - 1.4], [x, chip.y], top, P) + k.lineOnTop([x, chip.y + chip.d], [x, chip.y + chip.d + 1.4], top, P);
    }
    out.push(L(pins, { tone: "mid" }));
    out.push(`<g data-chip="${layer}-${i}">` + S(k.slabOf(chip, top, CHIP.h, P, 2, 0.3), { tone: i === LAST ? "hi" : "mid", inner: Dt([at([chip.x + 1.8, chip.y + 1.8, top + CHIP.h])], { size: 0.35, tone: "lo" }) }) + "</g>");
  }
  // capacitors between the chips, a header at the front right
  for (let i = 0; i < 4; i++) for (const dy of [-3, 3]) out.push(S(k.cylinder(posX(i) + 12, CHIP.y + dy, 1.2, top, 2.6, P, 12), { tone: "mid", crease: "none" }));
  const header = box(70, 14, 16, 5, 0.3);
  out.push(S(k.slabOf(header, top, 3, P, 2, 0.3), { tone: "mid", inner: Dt([0, 1, 2, 3, 4].map((n) => at([header.x + 2 + n * 3, header.y + 2.5, top + 3])), { size: 0.4, tone: "lo" }) }));
  out.push(screws([[BOARD.x + 2.5, BOARD.y + 2.5], [BOARD.x + BOARD.w - 2.5, BOARD.y + 2.5], [BOARD.x + 2.5, BOARD.y + BOARD.d - 2.5], [BOARD.x + BOARD.w - 2.5, BOARD.y + BOARD.d - 2.5]], top, 0.42));
  return part("layers", base) + part("attention", threads) + part("layers", out.join(""));
}

// a punched card: the word printed near the top, its token id punched below
function cardSvg(cx, z, word, key, extra = "") {
  const plan = box(cx, CARD.y, CARD.w, CARD.d, 0.3);
  const face = CARD.y + CARD.d / 2;
  const text = keyed(frontText(cx, face, z + CARD.h - 7.4, word, word.length > 5 ? 4.6 : 5.6, "hi", "middle"), key);
  const holes = `<path class="lm-hole" data-holes="${key}" d="${holesD(k.iso, P, cx, face, z + 3.4, tokenId(word))}"/>`;
  const corner = L(k.pathOf([at([plan.x + 0.4, face, z + CARD.h - 3]), at([plan.x + 3, face, z + CARD.h - 0.4])]), { tone: "lo" });
  return `<g${extra}>${S(k.slabOf(plan, z, CARD.h, P, 2), { tone: "hi", inner: text + holes + corner })}</g>`;
}

function reader() {
  const [z0, z1] = READER_Z;
  const face = READER.y + READER.d;
  const out = [S(k.slabOf(READER, z0, z1 - z0, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(READER, z0 + 4, P, 3), { tone: "faint" }) })];
  out.push(frontText(READER.x + 6, face, z0 + 6.6, "CARD READER", 2.8));
  // a read lamp for each slot
  for (let i = 0; i <= SLOT; i++) out.push(`<path class="lm-led" d="${rectY(posX(i) - 2, posX(i) + 2, z0 + 9, z0 + 11, face)}"/><path class="lm-on" data-lamp="${i}" d="${rectY(posX(i) - 2, posX(i) + 2, z0 + 9, z0 + 11, face)}"/>`);
  out.push(screws([[READER.x + 3, READER.y + 3], [READER.x + READER.w - 3, READER.y + 3], [READER.x + 3, face - 3], [READER.x + READER.w - 3, face - 3]], z1, 0.42));
  // the throat: one slot per position
  for (let i = 0; i <= SLOT; i++) out.push(L(k.planOutline(box(posX(i), CARD.y, CARD.w + 2, CARD.d + 2, 0.6), z1, P, 2), { tone: "lo" }));
  // the input hopper with a stack of blanks, at the left end
  return out.join("");
}
const throatLip = () => S(k.slabOf({ x: posX(0) - 13, y: CARD.y + CARD.d / 2 + 0.2, w: 5 * PITCH + 26, d: 2.4, r: 0.4 }, CARD_Z, 2.2, P, 2), { tone: "mid" });

// the random-number chip and its display, on a small board on the ledge
function rng() {
  const out = [];
  for (const [x, y] of k.corners(RNG, 2.6)) out.push(S(k.cylinder(x, y, 1.2, 0, 2.2, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ ...RNG, r: 0.8 }, 2.2, 1.4, P, 2), { tone: "mid" }));
  const top = 3.6;
  const cx = RNG.x + RNG.w / 2;
  // the trace from the chip back to the panel, up its face into the display, on into the strip
  out.push(trace([[cx, RNG.y + 4.2, top], [cx, RNG.y + 1.4, top]]), trace([[cx, RNG.y, 0], [cx, FRONT, 0], [cx, FRONT, DISPLAY.z0 - 1.2]]));
  out.push(trace([[DISPLAY.x1 + 1.2, FRONT, (DISPLAY.z0 + DISPLAY.z1) / 2], [STRIP.x - 1.2, FRONT, (DISPLAY.z0 + DISPLAY.z1) / 2]]));
  const chip = box(cx, RNG.y + 8, 16, 7, 0.4);
  let pins = "";
  for (let i = 0; i < 6; i++) {
    const x = chip.x + 2 + i * 2.4;
    pins += k.lineOnTop([x, chip.y - 1.2], [x, chip.y], top, P) + k.lineOnTop([x, chip.y + chip.d], [x, chip.y + chip.d + 1.2], top, P);
  }
  out.push(L(pins, { tone: "mid" }));
  out.push(S(k.slabOf(chip, top, 2.4, P, 2, 0.3), { tone: "hi", lit: true, inner: Dt([at([chip.x + 1.4, chip.y + 1.4, top + 2.4])], { size: 0.35, tone: "lo" }) }));
  out.push(k.faceTextSvg(k.topMatrix([chip.x + 3.4, chip.y + 4.8], top + 2.4, P, "x"), "RNG", { size: 3, tone: "lo" }));
  // a crystal beside it, and a corner screw
  out.push(S(k.slabOf(box(RNG.x + 6, RNG.y + 9, 4, 6, 1.6), top, 2, P, 6, 0.3), { tone: "mid" }));
  out.push(screws([[RNG.x + RNG.w - 3, RNG.y + 3]], top, 0.4));
  // the display window on the panel: the number drawn
  const y = FRONT;
  out.push(`<path class="lm-led" d="${rectY(DISPLAY.x0, DISPLAY.x1, DISPLAY.z0, DISPLAY.z1, y)}"/>`, L(rectY(DISPLAY.x0 - 1, DISPLAY.x1 + 1, DISPLAY.z0 - 1, DISPLAY.z1 + 1, y), { tone: "lo" }));
  out.push(keyed(frontText((DISPLAY.x0 + DISPLAY.x1) / 2, y, DISPLAY.z0 + 1.6, "– –", 5, "hi", "middle"), "rnd"));
  out.push(frontText(DISPLAY.x0, y, DISPLAY.z1 + 2, "RANDOM", 2.2));
  return out.join("");
}

function punch() {
  const out = [S(k.slabOf(PUNCH, 0, PUNCH.h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(PUNCH, 3, P, 3), { tone: "faint" }) })];
  out.push(L(k.planOutline(box(PUNCH.x + PUNCH.w / 2, PUNCH.y + 5, CARD.w + 1, CARD.d + 1, 0.4), PUNCH.h, P, 2), { tone: "hi" }));
  out.push(frontText(PUNCH.x + 3, PUNCH.y + PUNCH.d, 2.6, "PUNCH", 2.6));
  out.push(screws([[PUNCH.x + 2.4, PUNCH.y + PUNCH.d - 2.4], [PUNCH.x + PUNCH.w - 2.4, PUNCH.y + PUNCH.d - 2.4]], PUNCH.h, 0.4));
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
  out.push(k.faceTextSvg(k.topMatrix([cx - 6, cy + DIAL_R + 6], 0, P, "x"), "TEMP", { size: 2.6, tone: "lo" }));
  return out.join("");
}

// ---------- assemble, back to front and bottom to top ----------
const probs0 = softmax(CTX.logits, TEMPS[T0]);
const [backL, backR, frontL, frontR] = POSTS;
const FIGURE_LABEL =
  "A small rack computer on a plinth. At the top, a card reader holds five punched cards reading 'the cat sat on the', with one empty slot. Five bus lanes run down a backplane, and four layer boards plug into it; on each board, traces tie the last word's chip back to the chips of the earlier words, thicker where it pays more attention. The last lane runs on to a scoring chip on the deck, and six traces run from it down to an LED bar meter on the front panel, one bar per candidate word. Under the bars, an LED strip lays out the odds; a random-number chip on the ledge sets a cursor on it, and a punch cuts the chosen word onto a card that goes back up into the reader.";

const BODY = [
  plinth(),
  post(backL), post(backR),
  part("layers", backplane()),
  `<g data-pulses class="lm-pulses"></g>`,
  part("scores", chassis() + deck()),
  `<g data-pulses-deck class="lm-pulses"></g>`,
  ...LAYERS.map((z, layer) => board(z, layer)),
  part("context", reader() + CTX.words.map((w, i) => cardSvg(posX(i), CARD_Z, w, `ctx-${i}`)).join("") + cardSvg(posX(SLOT), CARD_Z, "", "slot", ' data-slotcard style="opacity:0"') + throatLip()),
  sideRail(-92), sideRail(92),
  post(frontL), post(frontR),
  part("meter", panel() + `<g data-dividers>${CTX.cands.slice(0, -1).map((_, i) => `<g data-divider="${i}">${dividerSvg()}</g>`).join("")}</g><g data-cursor style="opacity:0">${cursorSvg()}</g>`),
  part("sampler", rng() + punch()),
  part("temperature", knob()),
  `<g data-fly style="opacity:0">${cardSvg(posX(SLOT), CARD_Z, "", "fly")}</g>`,
];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });
const LM_CSS = `.lm-thread{fill:none;stroke:var(--anatomy-hi);stroke-linecap:round;stroke-linejoin:round;transition:stroke-width .5s,opacity .5s}
.lm-trace{fill:none;stroke:var(--anatomy-mid);stroke-linejoin:round;transition:stroke .4s}
.lm-trace[data-on]{stroke:var(--anatomy-hi);stroke-width:1.1}
.lm-led{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.lm-on{fill:var(--anatomy-hi);opacity:0}
.lm-on[data-lit],.lm-power{fill:var(--anatomy-lit)}
.lm-power{opacity:1}
.lm-hole{fill:var(--anatomy-shade-0);stroke:var(--anatomy-mid);stroke-width:.35}
.lm-cursor{fill:var(--anatomy-lit);stroke:var(--anatomy-card);stroke-width:.4}
[data-chip]>.iso-solid[data-lit]>.iso-top,[data-chip]>.iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-hi)}
.lm-pulses circle{fill:var(--anatomy-lit);stroke:var(--anatomy-card);stroke-width:.6}
.iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit);font-weight:700}`;
const threadStyle = (w) => `stroke-width:${(0.4 + 2.2 * w).toFixed(2)};opacity:${(0.35 + 0.65 * w).toFixed(2)}`;
const styled = (text) => text.replace(/data-thread="(\d)-(\d)"/g, (m, l, j) => `${m} style="${threadStyle(CTX.attn[l][j])}"`);
const xmlSafe = (text) => text.replace(/ (data-[\w-]+)(?=[\s>\/])/g, ' $1=""');
// the thumbnail shows the odds on the meter
const thumbBars = (text) => text.replace(/class="lm-on" data-led="(\d)-(\d+)"/g, (m, i, n) => `${m} style="opacity:${Math.max(0, Math.min(1, probs0[i] * LED.n - n)).toFixed(2)}"`);
if (theme === "light") writeFileSync(join(HERE, "thumb.svg"), xmlSafe(thumbBars(styled(k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY, standalone: "light" }).replace("</style>", LM_CSS + "</style>")))));

// ---------- steps and parts ----------
const STEPS = [
  { say: "context · 5 cards in the reader", next: "Read" },
  { say: `reading · ${LAYERS.length} boards, each looks back`, next: "Score" },
  { say: "scores · one per candidate", next: "Odds" },
  { say: "softmax · odds add to 100%", next: "Draw" },
  { say: "draw", next: "Append" },
  { say: "appended", next: "Again" },
];
const PARTS = [
  { id: "context", step: 0, title: "Context", fact: "context · the words so far, as tokens", text: "Everything written so far, cut into tokens: often whole words, sometimes pieces of words. Each token has a number (its id, punched into its card here), and the reader turns each one into a long list of numbers (its embedding) that travels down its own lane." },
  { id: "layers", step: 1, title: "Layer boards", fact: `layers · ${LAYERS.length} boards here, dozens in real models`, text: "A stack of identical layers, plugged into one backplane. Every lane passes through every board, and each board updates what the lane carries, so a word's numbers come to mean that word in this sentence. Real models stack dozens of layers, and each lane carries thousands of numbers." },
  { id: "attention", step: 1, title: "Attention", fact: "attention · each word looks back, never ahead", text: "On each board, the last word's chip takes in information from the chips of the words before it, more from some than others. The traces show how much: thicker means more. One board leans on 'on', another on the subject or the verb. There are no traces to later words, which is why a model writes left to right. Real layers run many of these patterns side by side (heads); the weights here are illustrative." },
  { id: "scores", step: 2, title: "Scoring chip", fact: "scores · one per word in the vocabulary", text: "Only the last lane is used to predict what comes next. The scoring chip compares its numbers with every token in the vocabulary, tens of thousands of them, and gives each a score (a logit). Six are shown on the meter. A score is not a probability yet: it can be any number, even negative." },
  { id: "meter", step: 3, title: "Meter", fact: "softmax · scores become odds that add to 100%", text: "Softmax turns the scores into odds that add up to 100%, and the bars drop to show them. The strip underneath lays the same odds end to end, each word's share as a run of LEDs." },
  { id: "temperature", step: 3, title: "Temperature", fact: "temperature · divides every score before softmax", text: "Before softmax, every score is divided by the temperature. Below 1 the odds sharpen towards the top word; above 1 they flatten towards an even spread." },
  { id: "sampler", step: 4, title: "Random-number chip", fact: "sampler · a random point on the odds", text: "The only part that chooses. It makes a number between 0 and 1 and sets the cursor that far along the strip; the word whose share it lands in is written next. The punch cuts that word onto a card, it goes up into the reader, and the whole machine runs again for the word after." },
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
  posX: Array.from({ length: 6 }, (_, i) => posX(i)), leds: LED.n, strip: STRIP,
  logitFloor: LOGIT_FLOOR, logitScale: LOGIT_SCALE,
  layers: LAYERS.map((z) => z + BOARD_H), laneTop: POST_TOP - 1, laneY: LANE_Y, deck: DECK, laneEnd: LAYERS[0] - 4,
  deckPath: [[posX(LAST), LANE_Y, DECK], [posX(LAST), 6, DECK], [17, 6, DECK]],
  card: { y: CARD.y + CARD.d / 2, z: CARD_Z }, front: FRONT,
  punch: [PUNCH.x + PUNCH.w / 2, PUNCH.y + 5, PUNCH.h], slot: [posX(SLOT), CARD.y, CARD_Z],
  knob: KNOB, knobR: KNOB_R, knobZ: KNOB_Z[1], knobAngles: TEMPS.map((_, i) => knobAngle(i)),
};

const live = `
const D = ${JSON.stringify(DATA)};
${tokenId.toString()}
${holesD.toString()}
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
const dividers = byIndex("[data-divider]", "divider");
const dividerLayer = stage.querySelector("[data-dividers]");
const cursor = stage.querySelector("[data-cursor]");
const strips = byIndex("[data-strip]", "strip");
const lamps = byIndex("[data-lamp]", "lamp");
const boardLeds = byIndex("[data-board-led]", "boardLed");
const chips = [...stage.querySelectorAll("[data-chip]")].map((el) => { const [l, i] = el.dataset.chip.split("-").map(Number); return { el: el.querySelector(".iso-solid"), l, i }; });
const outs = byIndex("[data-out]", "out");
const inTrace = stage.querySelector(".lm-in");
const leds = [...stage.querySelectorAll("[data-led]")].map((el) => { const [i, n] = el.dataset.led.split("-").map(Number); return { el, i, n }; });
const knobLine = stage.querySelector("[data-knob]");
const flyCard = stage.querySelector("[data-fly]");
const slotCard = stage.querySelector("[data-slotcard]");
const pulseLayer = stage.querySelector("[data-pulses]");
const deckPulseLayer = stage.querySelector("[data-pulses-deck]");
const threads = [...stage.querySelectorAll("[data-thread]")].map((el) => { const [l, j] = el.dataset.thread.split("-").map(Number); return { el, l, j }; });
const groups = [...stage.querySelectorAll("[data-part]")];
const word = (key) => stage.querySelector('[data-word="' + key + '"]');
const holes = (key) => stage.querySelector('[data-holes="' + key + '"]');

let ctx = 0, C = D.contexts[0];
let temp = D.t0;
const softmax = (t) => { const top = Math.max(...C.logits); const e = C.logits.map((z) => Math.exp((z - top) / t)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
let probs = softmax(D.temps[temp]);
const pct = (p) => (p >= 0.995 ? "99" : p < 0.005 ? "<1" : Math.round(p * 100)) + "%";
const tText = (t) => "T " + (t < 1 ? t.toFixed(2).replace(/0$/, "") : t.toFixed(1));
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const shift = (dx, dy, dz) => [D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz, D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz];
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };
const setO = (el, o) => { const s = o.toFixed(2); if (el._o !== s) { el._o = s; el.style.opacity = s; } };
const setLit = (el, on) => { if (!!el._lit !== on) { el._lit = on; on ? el.setAttribute("data-lit", "") : el.removeAttribute("data-lit"); } };
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.002 ? target : nx; };
function setCard(key, w) { setText(word(key), w); holes(key).setAttribute("d", w ? holesD(iso, D.P, Number(holes(key).dataset.cx), D.card.y, D.card.z + 3.4, tokenId(w)) : ""); }
holes("ctx-0").parentNode; // cards keep their x on the holes path
[0, 1, 2, 3, 4].forEach((i) => (holes("ctx-" + i).dataset.cx = D.posX[i]));
holes("slot").dataset.cx = D.posX[5];
holes("fly").dataset.cx = D.posX[5];

let step = 0, selected = null, u = 0.5, winner = 0;
let touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0, clock = 0;
const level = Array(N).fill(0), cut = Array(N - 1).fill(0);
let pin = 0, flight = 0, segShow = 0, readClock = 0, drawTimer = 0, outGlow = 0;
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
  step = n;
  controls();
  if (!touring) announce(stepText(step));
  run();
}

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
  C.words.forEach((w, i) => setCard("ctx-" + i, w));
  C.cands.forEach((w, i) => { const el = word("cand-" + i); setText(el, w); el.setAttribute("font-size", w.length > 5 ? 4.4 : 5.2); });
  step = -1;
  flight = 0;
  setStep(0);
  setTimeout(() => { if (!touring && step === 0) setStep(1); }, 350);
  controls();
  announce("new context · “" + C.words.join(" ") + " …”");
}

function draw() {
  hold();
  select(null);
  u = Math.random(); winner = pick(u);
  flight = 0;
  if (step >= 4) step = 3;
  setStep(4);
  drawTimer = 1.8;
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

// Reading: a pulse drops down every lane; as it passes a board, that board's traces carry their weights.
const READ = 2.4;
const deckLen = Math.abs(D.deckPath[1][1] - D.deckPath[0][1]) + Math.abs(D.deckPath[2][0] - D.deckPath[1][0]);
const laneLen = D.laneTop - D.deck;
const total = laneLen + deckLen;
const travel = (t) => Math.min(1, t / READ) * total; // distance along the last lane
const laneZ = (s) => D.laneTop - Math.min(s, laneLen);

function update(dt, calm) {
  let busy = false;
  const go = (x, target, rate) => { const nx = calm ? target : follow(x, target, rate, dt); if (nx !== target) busy = true; return nx; };
  if (step === 1 && !calm) { readClock += dt; if (readClock < READ + 0.4) busy = true; }
  const z = step === 1 && !calm ? laneZ(travel(readClock)) : step >= 1 ? -1e9 : 1e9;
  threads.forEach((t, i) => { weight[i] = go(weight[i], z <= D.layers[t.l] ? C.attn[t.l][t.j] : 0, 5); });
  const goal = (i) => (step < 2 ? 0 : step === 2 ? (C.logits[i] - D.logitFloor) * D.logitScale : probs[i] * D.leds);
  for (let i = 0; i < N; i++) level[i] = go(level[i], goal(i), 6);
  const c = cumulative();
  for (let i = 0; i < N - 1; i++) cut[i] = go(cut[i], c[i], 6);
  segShow = go(segShow, step >= 3 ? 1 : 0, 8);
  outGlow = go(outGlow, step === 2 ? 1 : 0, 6);
  pin = go(pin, step >= 4 ? u : 0, 2.6);
  flight = step >= 5 && Math.abs(pin - u) < 0.01 ? (calm ? 1 : Math.min(1, flight + dt / 1.8)) : step >= 5 ? flight : 0;
  if (step >= 5 && flight < 1) busy = true;
  if (drawTimer > 0) { drawTimer -= dt; if (drawTimer <= 0 && step === 4) setStep(5); busy = true; }
  return busy;
}

// the card's path: up out of the punch, back over the reader, down into the empty slot
function flightAt(f) {
  const [px, py, pz] = D.punch, [sx, sy, sz] = D.slot;
  const up = sz + 2;
  if (f < 0.55) { const t = ease(f / 0.55); return [px, py, pz - 22 + (up - pz + 22) * t]; }
  if (f < 0.85) { const t = ease((f - 0.55) / 0.3); return [px + (sx - px) * t, py + (sy - py) * t, up]; }
  const t = ease((f - 0.85) / 0.15);
  return [sx, sy, up + (sz - up) * t];
}

function place() {
  threads.forEach((t, i) => { const w = weight[i]; const s = "stroke-width:" + (0.4 + 2.2 * w).toFixed(2) + ";opacity:" + (w < 0.01 ? 0 : 0.35 + 0.65 * w).toFixed(2); if (t.el._s !== s) { t.el._s = s; t.el.setAttribute("style", s); } });
  // reading: lamps, pulses, board LEDs
  const reading = step === 1 && readClock < READ;
  const s = travel(readClock);
  lamps.forEach((lamp, i) => setO(lamp, reading && i < 5 && readClock < 0.8 ? 1 : 0));
  const near = (l) => reading && laneZ(s) <= D.layers[l] + 4 && laneZ(s) > D.layers[l] - 30;
  boardLeds.forEach((led, l) => setO(led, near(l) ? 1 : 0));
  for (const c of chips) setLit(c.el, near(c.l) && (c.i === 4 || laneZ(s) > D.laneEnd));
  if (reading) {
    const z = laneZ(s);
    let html = "", deckHtml = "";
    for (let i = 0; i < 5; i++) {
      if (i < 4 && z < D.laneEnd) continue;
      if (i === 4 && s > laneLen) {
        let r = s - laneLen; const [a, b, c] = D.deckPath;
        const leg = Math.abs(b[1] - a[1]);
        const p = r < leg ? [a[0], a[1] + r, D.deck] : [b[0] - (r - leg), b[1], D.deck];
        const q = iso(p, D.P);
        deckHtml += '<circle r="2.1" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '"/>';
        continue;
      }
      const q = iso([D.posX[i], D.laneY, z], D.P);
      html += '<circle r="2.1" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '"/>';
    }
    pulseLayer.innerHTML = html;
    deckPulseLayer.innerHTML = deckHtml;
  } else {
    if (pulseLayer.firstChild) pulseLayer.innerHTML = "";
    if (deckPulseLayer.firstChild) deckPulseLayer.innerHTML = "";
  }
  if (inTrace) (step >= 2 || (reading && s > laneLen)) ? inTrace.setAttribute("data-on", "") : inTrace.removeAttribute("data-on");
  outs.forEach((o) => (step >= 2 ? o.setAttribute("data-on", "") : o.removeAttribute("data-on")));
  // the meter
  const done = step >= 5 && flight >= 1;
  for (const led of leds) { setO(led.el, Math.max(0, Math.min(1, level[led.i] - led.n))); setLit(led.el, step >= 4 && pin === u && led.i === winner); }
  for (let i = 0; i < N; i++) {
    const v = word("val-" + i);
    setText(v, step === 2 ? C.logits[i].toFixed(1) : step >= 3 ? pct(probs[i]) : "");
    const w = word("cand-" + i);
    w.setAttribute("data-tone", step >= 4 && pin === u && i === winner ? "lit" : "hi");
  }
  // the strip: each word's share, alternately bright and dim, and the cursor
  const M = strips.length;
  for (let m = 0; m < M; m++) {
    const t = (m + 0.5) / M;
    let seg = 0; while (seg < N - 1 && t > cut[seg]) seg++;
    const hit = step >= 4 && pin === u && seg === winner;
    setO(strips[m], segShow * (hit ? 1 : seg % 2 ? 0.28 : 0.62));
    setLit(strips[m], hit);
  }
  dividerLayer.style.opacity = segShow.toFixed(2);
  for (let i = 0; i < N - 1; i++) setT(dividers[i], shift(D.strip.x + cut[i] * D.strip.len, 0, 0));
  setO(cursor, step >= 4 ? 1 : 0);
  setT(cursor, shift(D.strip.x + pin * D.strip.len, 0, 0));
  const rnd = word("rnd");
  setText(rnd, step < 4 ? "– –" : pin !== u ? "." + String(Math.floor(Math.random() * 100)).padStart(2, "0") : "." + String(Math.min(99, Math.floor(u * 100))).padStart(2, "0"));
  // the new card
  if (step >= 5 && flight > 0) {
    if (word("fly").textContent !== C.cands[winner]) setCard("fly", C.cands[winner]);
    const p = flightAt(flight);
    setT(flyCard, shift(p[0] - D.slot[0], p[1] - D.slot[1], p[2] - D.slot[2]));
    setO(flyCard, done ? 0 : Math.min(1, flight * 10));
  } else setO(flyCard, 0);
  if (done) { if (word("slot").textContent !== C.cands[winner]) setCard("slot", C.cands[winner]); }
  setO(slotCard, done ? 1 : 0);
  setLit(slotCard.querySelector(".iso-solid"), done);
  const text = selected ? D.parts[selected].fact : stepText(Math.max(0, step));
  if (readout.textContent !== text) readout.textContent = text;
}

const TOUR = [2.6, 3.4, 2.6, 2.8, 2.8, 3.6];
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
  fig: "Fig 2 · v3",
  title: "Language model · next word",
  hint: "← → step · D draw · C context",
  readout: `“${CTX.words.join(" ")} …” · 5 tokens`,
  keys: [
    { mark: "lit", label: "The random-number chip: the only part that chooses" },
    { mark: "raised", label: "Cards, boards and traces: everything that sets the odds" },
  ],
  caption: `A language model writes one token at a time. Each token of the context goes down its own lane, through a stack of layers. In every layer the last word takes in information from the words before it (attention, the traces), never from those after. Only the last lane is used to predict: the scoring chip gives every word in the vocabulary a score, softmax turns the scores into odds (after dividing by the temperature), and a random number picks one. The chosen word joins the context and the machine runs again. The scores, weights and token ids are toy numbers; the arithmetic is real.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Language model as a computer. Arrow keys step through how it picks the next word; D draws a word; C changes the sentence; [ and ] change the temperature; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="${STEPS[0].say}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Back one step" disabled>←</button><span class="pc-dots" aria-hidden="true">${STEPS.slice(1).map(() => "<i data-dot></i>").join("")}</span><button type="button" class="pc-btn pc-context" data-context aria-keyshortcuts="C">Sentence ↻</button><span class="pc-temp"><button type="button" class="pc-btn" data-cooler aria-label="Lower the temperature" aria-keyshortcuts="[">−</button><span data-temp>T 1.0</span><button type="button" class="pc-btn" data-warmer aria-label="Raise the temperature" aria-keyshortcuts="]">+</button></span><button type="button" class="pc-btn" data-draw aria-keyshortcuts="D">Draw</button><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const ARTICLE_CSS = `${LM_CSS}
.iso-stage [data-part]{cursor:pointer}
.iso-stage[data-focus] [data-part]:not([data-on]) *{stroke:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-fill{fill:var(--anatomy-paper)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-top{fill:var(--anatomy-top)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-shade{fill:var(--anatomy-shade-3)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) text{fill:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-dots circle{opacity:.1!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .lm-on{fill:var(--anatomy-faint)!important}
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
export const VERSIONS = (current) => `<span class="pc-versions">version ${[["computer", "language-model-computer"], ["tower", "language-model"], ["bench", "language-model-bench"]].map(([name, slug]) => `<a href="../${slug}/"${name === current ? ' aria-current="page"' : ""}>${name}</a>`).join(" · ")}</span>`;
const body = `<style>${CONTRAST_CSS}${ARTICLE_CSS}${EXPAND_CSS}</style>
<nav class="pc-nav"><a href="../">← anatomy/of</a>${VERSIONS("computer")}</nav>
<header class="pc-head"><h1>Anatomy of a language model</h1><p>It doesn't plan a sentence. It picks one next word, from odds it works out fresh each time, and then does it again.</p></header>
${plateBody}
<section class="pc-parts"><h2>The parts</h2><p class="tip">Point at a part to find it in the figure; click it to step the machine to it.</p><ol>${PARTS.map(({ id, title, text }, index) => `<li><div class="pc-part" data-select="${id}" tabindex="0" role="button" aria-label="${title}: show it in the figure"><span class="num">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></div></li>`).join("")}</ol>${odds}</section>`;

const name = theme === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomy of a language model (computer)", theme, body: styled(body), script: kitScript() + live + EXPAND_JS }));
console.log("wrote", name);
