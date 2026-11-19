// Anatomy of an agentic loop. Writes agentic-loop/index.html and thumb.svg (--dark: dark.html).
//
// A loop bench. The context is a stack of sheets on a tray between two posts; the crossbar between
// the posts is the context window. Each step the model's reading arm drops onto the stack (the model
// reads everything in it), the model issues an action card, and the decider's blade sends it one of
// two ways: a tool call rides the back lane to its tool, takes the result slip, and rides the loop
// round to the front, where it is lifted onto the stack (appended to the context); a FINAL answer is
// turned into the answer tray and the loop stops. A ratchet wheel on the model counts steps; when it
// reaches the stop pin set by the max_steps dial, the halt gate drops across the out slot.
//
// Everything here is a toy, and says so: two made-up tools, scripted model outputs, and token counts
// chosen to be easy to add up (the window is 800 tokens). The behaviour is the real loop's:
// append-only context, one model call per step, stop on a final answer or at max_steps, and when the
// context outgrows the window the oldest message after the system prompt is dropped first.
import { k, EXPAND_BUTTON, embedHtml, partsHtml, page } from "../tools/embed.mjs";

// ---------- the model (toy, scripted) ----------
const WINDOW = 800, MAX0 = 8, MAX_TOP = 14, PER_TOK = 1 / 20; // sheet thickness: 20 tokens per unit
const SYSTEM = { id: "sys", who: "system", text: "You can call weather(city) and calc(expr). Reply FINAL: … when you can answer.", label: "SYSTEM · tools: weather, calc", tok: 300 };
const GOAL = { id: "goal", who: "user", text: "Is it warmer than 60 °F in Paris right now?", label: "GOAL · warmer than 60 °F in Paris?", tok: 40 };
const WEATHER = { tool: "weather", call: 'weather("Paris")', result: "18 °C, light rain", short: "18 °C", tok: 50 };
const CALC = { tool: "calc", call: 'calc("18*9/5+32")', result: "64.4", short: "64.4", tok: 40 };
const CALC_BAD = { tool: "calc", call: 'calc("18 °C in F")', result: "error: can't parse \"°C in F\"", short: "ERROR", tok: 60, error: true };
const DOWN = { tool: "weather", call: 'weather("Paris")', result: "error 503: try again later", short: "503", tok: 55, error: true };
const FINAL = { final: true, call: "FINAL: Yes, about 64 °F, light rain.", short: "FINAL", tok: 0 };
const TASKS = [
  { name: "finishes", steps: [WEATHER, CALC, FINAL] },
  { name: "tool error, recovered", steps: [WEATHER, CALC_BAD, CALC, FINAL] },
  // the weather service is down; nothing in the prompt says when to give up, so only max_steps stops it
  { name: "never finishes", steps: [DOWN] },
];

// ---------- world ----------
const W = 640, H = 420;
const PLATE = { x: -148, y: -98, w: 280, d: 146, r: 10 };
const PLATE_H = 9, FOOT_H = 5;
const box = (cx, cy, w, d, r = 0.8) => ({ x: cx - w / 2, y: cy - d / 2, w, d, r });
const BASE_H = 2, LIP_H = 2.2;
const CARD = { w: 22, d: 8, h: 0.8 };
const TAG = { w: 20, d: 3.4, h: 0.4 };
// the model, back left, with its ratchet wheel and reading arm
const MODEL = { x: -136, y: -84, w: 50, d: 42, r: 3 };
const MODEL_H = 30;
const WHEEL = { x: -100, y: -70, r: 7.5, h: 1.6, teeth: 16 };
const COL = { x: -112, y: -48, r: 2.4 };
const ARM_Z = 56, ARM = { x: -115, y: -51, w: 6, d: 40, r: 0.8 }, ARM_H = 3.4;
const READ = { x: -112, y: -15 };
// the context: tray, posts, window crossbar, stack
const TRAY = { x: -136, y: -32, w: 50, d: 37, r: 1.6 };
const TRAY_H = 2;
const SHEET = { x: -128, y: -28, w: 34, d: 26 }; // stack centre is READ
const POST_X = [-133, -89], POST_Y = -30;
const WIN_Z = TRAY_H + WINDOW * PER_TOK; // the top of the window
const POST_H = WIN_Z + 4;
const ROD = { r: 1.1, foot: 2.6, up: 50 };
// lanes: back (out of the model, past the decider and the tools), right, front, up to the stack
const BACK = { x: -86, y: -66, w: 202, d: 12, r: 0.6 };
const BY = -60;
const RIGHT = { x: 90, y: -54, w: 26, d: 62, r: 0.6 };
const RX = 103;
const FRONT = { x: -124, y: 8, w: 240, d: 14, r: 0.6 };
const FY = 15;
const UX = -112;
// halt gate at the out slot
const GATE_X = -81, GATE = { up: 13, down: BASE_H + 0.1, h: 8 };
// decider: a blade pivoting at the back corner of the junction, and the cross lane to the answer tray
const DEC_X = -50;
const CROSS = { x: -63, y: -54, w: 26, d: 26, r: 0.6 };
const PIVOT = [CROSS.x - 1, BACK.y + 1.6];
const BLADE = { len: 28, t: 1.2, h: 3.2, deflect: (22 * Math.PI) / 180 };
const ANSWER = { x: -67, y: -28, w: 34, d: 20, r: 1.4 };
const ANS_Y = -18;
const FLAG = { x: -38, y: -24 };
// tools behind the back lane
const TOOLS = [
  { id: "weather", plan: { x: -24, y: -92, w: 46, d: 22, r: 2.4 }, stop: -1, label: "weather(city)" },
  { id: "calc", plan: { x: 30, y: -92, w: 46, d: 22, r: 2.4 }, stop: 53, label: "calc(expr)" },
];
const TOOL_H = 15;
// goal plaque, max_steps dial, label plate, inside the loop
const PLAQ = { x: -30, y: -46, w: 114, d: 24, r: 1.4 };
const PLAQ_H = 1.4;
const DIAL = { x: -98, y: 34, r: 10, knob: 5.4 };
const LABEL = { x: -28, y: -17, w: 62, d: 18, r: 1.2 };
const METER = { x: 42, y: -18, w: 42, d: 19, r: 2 };
const METER_H = 6;
// card start: just past the gate
const X0 = GATE_X + 2 + CARD.w / 2 + 1.5;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [ARM.x, ARM.y, ARM_Z + ARM_H + 2], [POST_X[0], POST_Y, POST_H + 2], [MODEL.x, MODEL.y, MODEL_H + 4]],
  W, H, { pad: 14 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(...a) - depth(...b));
const screws = (list, z, size = 0.45) => Dt(list.map(([x, y]) => at([x, y, z])), { size });
const topText = (x, y, z, text, size, tone = "mid", anchor = "start", extra = "") => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), text, { size, tone, anchor }).replace("<text", `<text${extra}`);
const frontText = (x, y, z, text, size, tone = "mid", anchor = "start", extra = "") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), text, { size, tone, anchor }).replace("<text", `<text${extra}`);
const rightText = (x, y, z, text, size, tone = "mid", anchor = "start") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "right"), text, { size, tone, anchor });
const post = (cx, cy, z0, z1, w = 5, d = 4) => S(k.slabOf(box(cx, cy, w, d, 0.8), z0, z1 - z0, P, 2, 0.4), { tone: "mid" });
const foot = (cx, cy, w = 8, d = 7) => S(k.slabOf(box(cx, cy, w, d, 1), 0, 1.2, P, 2), { tone: "lo" });

// ---------- bench plate ----------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const c = k.corners(PLATE, 11);
  out.push(L(c.map(([x, y]) => k.ring(x, y, 2.3, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dt(c.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // the two ways out of the decider, engraved beside their lanes
  out.push(topText(-28, -50.4, 0, "TOOL CALL → RUN IT, APPEND THE RESULT", 2.3, "lo"));
  out.push(topText(-30, 28.6, 0, "← EVERY RESULT GOES BACK ON THE STACK", 2.3, "lo"));
  return out.join("");
}

// ---------- the model ----------
function model() {
  const out = [S(k.slabOf(MODEL, 0, MODEL_H, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(MODEL, MODEL_H - 4, P, 5) + k.sideSeam(MODEL, 3, P, 5), { tone: "faint" }) })];
  // vents on the top, back left
  out.push(L([0, 1, 2, 3, 4].map((j) => k.planOutline({ x: MODEL.x + 6, y: MODEL.y + 5 + j * 3.6, w: 18, d: 1.5, r: 0.6 }, MODEL_H, P, 2)).join(""), { tone: "lo" }));
  out.push(topText(MODEL.x + 6, MODEL.y + 24.5, MODEL_H, "MODEL", 3.2, "mid"));
  out.push(topText(MODEL.x + 6, MODEL.y + 28, MODEL_H, "one call per step", 2, "lo"));
  // the step window on the front face
  const fy = MODEL.y + MODEL.d;
  out.push(topText(MODEL.x + 6, MODEL.y + 34, MODEL_H, "STEP", 2, "lo"));
  out.push(topText(MODEL.x + 6, MODEL.y + 39.4, MODEL_H, "1", 4.4, "hi", "start", " data-step"));
  out.push(topText(MODEL.x + 13, MODEL.y + 39.4, MODEL_H, `/ ${MAX0}`, 2.8, "lo", "start", " data-stepmax"));
  // out slot on the right face, where action cards leave
  const rx = MODEL.x + MODEL.w;
  out.push(L(k.pathOf([[rx, BACK.y + 1.5, BASE_H + 0.4], [rx, BACK.y + BACK.d - 1.5, BASE_H + 0.4], [rx, BACK.y + BACK.d - 1.5, BASE_H + 2.6], [rx, BACK.y + 1.5, BASE_H + 2.6]].map(at), true), { tone: "hi" }));
  out.push(rightText(rx, BACK.y - 1.5, 7, "OUT", 2.2, "lo"));
  out.push(screws(k.corners(MODEL, 3), MODEL_H, 0.45));
  // the reading arm's column, on the model's top
  out.push(S(k.cylinder(COL.x, COL.y, COL.r + 1.6, MODEL_H, 1.2, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(COL.x, COL.y, COL.r, MODEL_H + 1.2, ARM_Z - MODEL_H - 1.2, P, 18), { tone: "mid", inner: L(k.sideArc(COL.x, COL.y, COL.r, MODEL_H + 8, P, 18), { tone: "faint" }) }));
  return out.join("");
}
// the ratchet wheel: a pointer that moves one tooth per step, and the stop pin set by max_steps
const WHEEL_A = (n) => (n / WHEEL.teeth) * Math.PI * 2;
function wheel() {
  const z = MODEL_H + WHEEL.h, out = [];
  out.push(S(k.cylinder(WHEEL.x, WHEEL.y, WHEEL.r + 1.4, MODEL_H, 0.6, P, 36), { tone: "lo" }));
  out.push(S(k.cylinder(WHEEL.x, WHEEL.y, WHEEL.r, MODEL_H + 0.6, WHEEL.h - 0.6, P, 40), { tone: "mid", inner: L(k.knurl(WHEEL.x, WHEEL.y, WHEEL.r, MODEL_H + 0.6, z, 22, P), { tone: "faint" }) }));
  const t = k.radialTicks(WHEEL.x, WHEEL.y, WHEEL.r, WHEEL.teeth, 4, z, [1.2, 2], P);
  out.push(L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }));
  out.push(L(k.ring(WHEEL.x, WHEEL.y, 1.4, z, P, 14), { tone: "lo" }));
  out.push(topText(WHEEL.x, WHEEL.y + WHEEL.r + 4.2, MODEL_H, "STEPS", 1.9, "lo", "middle"));
  return out.join("");
}
const pinPoint = (n) => { const a = WHEEL_A(n); return [WHEEL.x + Math.sin(a) * (WHEEL.r - 2.2), WHEEL.y - Math.cos(a) * (WHEEL.r - 2.2)]; };
const pinSvg = (n) => { const [x, y] = pinPoint(n); return S(k.cylinder(x, y, 0.9, MODEL_H + WHEEL.h, 1.6, P, 12), { tone: "hi" }); };
const pointerD = (n) => { const a = WHEEL_A(n); return k.lineOnTop([WHEEL.x + Math.sin(a) * 1.4, WHEEL.y - Math.cos(a) * 1.4], [WHEEL.x + Math.sin(a) * (WHEEL.r - 0.3), WHEEL.y - Math.cos(a) * (WHEEL.r - 0.3)], MODEL_H + WHEEL.h, P); };
// the reading arm: a beam out over the stack, and a feeler rod that drops onto the top sheet
function arm() {
  const out = [S(k.slabOf(ARM, ARM_Z, ARM_H, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(ARM, ARM_Z + 1.2, P, 2), { tone: "faint" }) })];
  out.push(S(k.cylinder(COL.x, COL.y, COL.r + 0.6, ARM_Z + ARM_H, 1.4, P, 18), { tone: "mid" }) + Dt([at([COL.x, COL.y, ARM_Z + ARM_H + 1.4])], { size: 0.45 }));
  out.push(L(k.ring(READ.x, READ.y, ROD.r + 0.8, ARM_Z + ARM_H, P, 16), { tone: "lo" }));
  out.push(S(k.cylinder(READ.x, READ.y, 2.3, ARM_Z + ARM_H, 2, P, 22), { tone: "mid", inner: L(k.knurl(READ.x, READ.y, 2.3, ARM_Z + ARM_H, ARM_Z + ARM_H + 2, 14, P), { tone: "lo" }) }));
  out.push(rightText(ARM.x + ARM.w, ARM.y + ARM.d - 8, ARM_Z + 0.9, "reads all of it", 1.8, "lo"));
  return out.join("");
}
const rodSvg = (bottom) => S(k.cylinder(READ.x, READ.y, ROD.r, bottom + 1, ARM_Z - bottom - 1, P, 14), { tone: "mid" }) + S(k.cylinder(READ.x, READ.y, ROD.foot, bottom, 1, P, 20), { tone: "hi" });

// ---------- the context ----------
function trayBack() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 3, 0.4), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan({ ...SHEET, r: 0.6 }, -1.2), TRAY_H, P, 2), { tone: "faint" }));
  out.push(topText(TRAY.x + 3, TRAY.y + TRAY.d - 1.3, TRAY_H, "CONTEXT · 800-TOKEN WINDOW", 2, "lo"));
  out.push(screws([[TRAY.x + 2.4, TRAY.y + 2.4], [TRAY.x + TRAY.w - 2.4, TRAY.y + 2.4], [TRAY.x + 2.4, TRAY.y + TRAY.d - 4.6], [TRAY.x + TRAY.w - 2.4, TRAY.y + TRAY.d - 4.6]], TRAY_H, 0.4));
  // the posts and the window crossbar, behind the stack
  for (const x of POST_X) out.push(post(x, POST_Y, TRAY_H, POST_H, 4, 3.4), S(k.cylinder(x, POST_Y, 1.4, POST_H, 0.8, P, 12), { tone: "mid" }));
  const bar = { x: POST_X[0] + 2, y: POST_Y - 1, w: POST_X[1] - POST_X[0] - 4, d: 2, r: 0.3 };
  out.push(`<g data-window>${S(k.slabOf(bar, WIN_Z - 1.6, 1.6, P, 1), { tone: "hi" })}</g>`);
  // a token scale on the right post's right face: a tick every 100 tokens, major every 400
  const fx = POST_X[1] + 2, y0 = POST_Y - 1.7;
  const minor = [], major = [];
  for (let t = 100; t <= 900; t += 100) (t % 400 === 0 ? major : minor).push(k.segment([fx, y0, TRAY_H + t * PER_TOK], [fx, y0 + (t % 400 === 0 ? 2.2 : 1.3), TRAY_H + t * PER_TOK], P));
  out.push(L(minor.join(""), { tone: "lo" }) + L(major.join(""), { tone: "mid" }));
  out.push(rightText(fx, POST_Y + 1.5, WIN_Z + 0.8, "800", 1.8, "mid"));
  out.push(rightText(fx, POST_Y + 1.5, TRAY_H + 400 * PER_TOK + 0.8, "400", 1.8, "lo"));
  return out.join("");
}

// ---------- lanes ----------
function rollers(along, from, to, a, b) {
  const d = [];
  for (let t = from; t <= to; t += 5) d.push(along === "x" ? k.lineOnTop([t, a], [t, b], BASE_H, P) : k.lineOnTop([a, t], [b, t], BASE_H, P));
  return L(d.join(""), { tone: "faint" });
}
const turntable = (cx, cy, r = 5.5) => L(k.ring(cx, cy, r, BASE_H, P, 28), { tone: "faint" }) + L(k.ring(cx, cy, 1.6, BASE_H, P, 14), { tone: "lo" }) + Dt([at([cx, cy, BASE_H])], { size: 0.4 });
const lip = (plan) => S(k.slabOf({ ...plan, r: 0.4 }, BASE_H, LIP_H, P, 1), { tone: "mid" });
function backLane() {
  const out = [S(k.slabOf(BACK, 0, BASE_H, P, 2), { tone: "mid" })];
  const a = BACK.y + 1.6, b = BACK.y + BACK.d - 1.6;
  out.push(rollers("x", GATE_X + 4, CROSS.x - 3, a, b), rollers("x", CROSS.x + CROSS.w + 3, RIGHT.x - 3, a, b));
  out.push(turntable(DEC_X, BY), turntable(RX, BY));
  out.push(lip({ x: BACK.x, y: BACK.y, w: BACK.w, d: 1.6 }));
  // platens in front of the tools
  for (const t of TOOLS) out.push(L(k.planOutline(box(t.stop, BY, CARD.w + 3, CARD.d + 2, 0.6), BASE_H, P, 2), { tone: "lo" }));
  return out.join("");
}
// the front lips of the back lane, drawn after the card rides past the tools
function backLaneFront() {
  const y = BACK.y + BACK.d - 1.6;
  return lip({ x: BACK.x, y, w: CROSS.x - BACK.x, d: 1.6 }) + lip({ x: CROSS.x + CROSS.w, y, w: RIGHT.x - CROSS.x - CROSS.w, d: 1.6 });
}
function loopLanes() {
  const out = [S(k.slabOf(RIGHT, 0, BASE_H, P, 2), { tone: "mid" }), S(k.slabOf(FRONT, 0, BASE_H, P, 2), { tone: "mid" })];
  out.push(rollers("y", RIGHT.y + 3, FRONT.y - 2, RIGHT.x + 1.6, RIGHT.x + RIGHT.w - 1.6));
  out.push(rollers("x", UX + 14, RIGHT.x - 3, FRONT.y + 1.6, FRONT.y + FRONT.d - 1.6));
  out.push(turntable(RX, FY), L(k.ring(UX, FY, 7, BASE_H, P, 32), { tone: "lo" }) + turntable(UX, FY, 4.5));
  // lips: inner edge of the right lane, the front lane's back edge (open where the lift meets the stack), front and left edges
  out.push(lip({ x: RIGHT.x, y: RIGHT.y, w: 1.6, d: FRONT.y - RIGHT.y }));
  out.push(lip({ x: BACK.x + BACK.w - 1.6, y: BACK.y + 1.6, w: 1.6, d: FRONT.y + FRONT.d - BACK.y - 3.2 }));
  out.push(lip({ x: UX + 12, y: FRONT.y, w: RIGHT.x - UX - 12, d: 1.6 }));
  out.push(lip({ x: FRONT.x, y: FRONT.y, w: 1.6, d: FRONT.d }));
  out.push(lip({ x: FRONT.x + 1.6, y: FRONT.y + FRONT.d - 1.6, w: FRONT.w - 1.6, d: 1.6 }));
  out.push(screws([[RX, RIGHT.y + 5], [UX + 15, FY], [RIGHT.x - 6, FY]], BASE_H, 0.35));
  return out.join("");
}
// the token meter: what the stack weighs now
function meter() {
  const out = [S(k.slabOf(METER, 0, METER_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(METER, 2, P, 4), { tone: "faint" }) })];
  const win = { x: METER.x + 4, y: METER.y + 3.5, w: 34, d: 8, r: 0.6 };
  out.push(S(k.slabOf(win, METER_H, 0.5, P, 2), { tone: "lo", crease: "none" }));
  out.push(topText(win.x + win.w - 2, win.y + 6, METER_H + 0.5, "340 / 800", 3.2, "hi", "end", " data-tok"));
  out.push(topText(METER.x + 4, METER.y + 16.4, METER_H, "TOKENS IN CONTEXT", 2, "lo"));
  out.push(screws(k.corners(METER, 2.2), METER_H, 0.4));
  return out.join("");
}
// ---------- the halt gate ----------
const gateBack = () => post(GATE_X, BACK.y - 2.2, 0, GATE.up + GATE.h + 3, 4, 3.4);
function gateFront() {
  const out = [post(GATE_X, BACK.y + BACK.d + 2.2, 0, GATE.up + GATE.h + 3, 4, 3.4)];
  const beam = { x: GATE_X - 2, y: BACK.y - 4, w: 4, d: BACK.d + 8, r: 0.6 };
  out.push(S(k.slabOf(beam, GATE.up + GATE.h + 3, 2.2, P, 2, 0.4), { tone: "mid" }));
  out.push(screws([[GATE_X, BACK.y - 2.2], [GATE_X, BACK.y + BACK.d + 2.2]], GATE.up + GATE.h + 5.2, 0.4));
  out.push(rightText(GATE_X + 2, BACK.y + BACK.d + 1, 6.6, "HALT", 1.8, "lo"));
  return out.join("");
}
const gatePlate = () => S(k.slabOf({ x: GATE_X - 0.8, y: BACK.y + 0.6, w: 1.6, d: BACK.d - 1.2, r: 0.2 }, GATE.down, GATE.h, P, 1), { tone: "mid", inner: L(k.sideSeam({ x: GATE_X - 0.8, y: BACK.y + 0.6, w: 1.6, d: BACK.d - 1.2, r: 0.2 }, GATE.down + GATE.h - 1.6, P, 1), { tone: "faint" }) });
const gateRod = () => S(k.cylinder(GATE_X, BY, 0.7, GATE.down + GATE.h, GATE.up + 3 - GATE.down, P, 10), { tone: "mid" });

// ---------- the decider ----------
function bladeRing(angle) {
  const [px, py] = PIVOT, c = Math.cos(angle), s = Math.sin(angle), t = BLADE.t, n = [-s, c];
  const a = [px - (n[0] * t) / 2, py - (n[1] * t) / 2], b = [a[0] + c * BLADE.len, a[1] + s * BLADE.len];
  return [a, b, [b[0] + n[0] * t, b[1] + n[1] * t], [a[0] + n[0] * t, a[1] + n[1] * t]];
}
const bladeSvg = (angle) => S(k.extrude(bladeRing(angle), BASE_H, BLADE.h, P), { tone: "hi" });
const pivot = () => S(k.cylinder(PIVOT[0], PIVOT[1], 2, BASE_H, BLADE.h + 1.6, P, 18), { tone: "mid" }) + Dt([at([PIVOT[0], PIVOT[1], BASE_H + BLADE.h + 1.6])], { size: 0.45 });
// two lamps on a block behind the pivot: TOOL or FINAL, what the card says
function deciderLamps() {
  const blk = { x: PIVOT[0] - 13, y: BACK.y - 11, w: 26, d: 8, r: 1 };
  const out = [S(k.slabOf(blk, 0, 5, P, 2, 0.4), { tone: "mid" })];
  [["TOOL", blk.x + 5], ["FINAL", blk.x + 16]].forEach(([text, x], i) => {
    out.push(L(k.ring(x, blk.y + 3.2, 2, 5, P, 16), { tone: "lo" }));
    out.push(`<g data-kind="${i}">${S(k.cylinder(x, blk.y + 3.2, 1.3, 5, 1, P, 16), { tone: "mid" })}</g>`);
    out.push(topText(x, blk.y + 7.2, 5, text, 1.6, "lo", "middle", ` data-kind-text="${i}"`));
  });
  return out.join("");
}
function crossLane() {
  const out = [S(k.slabOf(CROSS, 0, BASE_H, P, 2), { tone: "mid" })];
  out.push(rollers("y", CROSS.y + 3, CROSS.y + CROSS.d - 2, CROSS.x + 1.6, CROSS.x + CROSS.w - 1.6));
  out.push(lip({ x: CROSS.x, y: CROSS.y, w: 1.6, d: CROSS.d }), lip({ x: CROSS.x + CROSS.w - 1.6, y: CROSS.y, w: 1.6, d: CROSS.d }));
  // the answer tray: a shallow box with a lip all round, open at the back to the lane
  out.push(S(k.slabOf(ANSWER, 0, BASE_H, P, 3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(ANSWER, 2.6), BASE_H, P, 2), { tone: "faint" }));
  const wall = (plan) => S(k.slabOf({ ...plan, r: 0.4 }, BASE_H, 2.6, P, 1), { tone: "mid" });
  out.push(wall({ x: ANSWER.x, y: ANSWER.y, w: CROSS.x - ANSWER.x, d: 1.6 }), wall({ x: CROSS.x + CROSS.w, y: ANSWER.y, w: ANSWER.x + ANSWER.w - CROSS.x - CROSS.w, d: 1.6 }));
  out.push(wall({ x: ANSWER.x, y: ANSWER.y + 1.6, w: 1.6, d: ANSWER.d - 1.6 }), wall({ x: ANSWER.x + ANSWER.w - 1.6, y: ANSWER.y + 1.6, w: 1.6, d: ANSWER.d - 1.6 }));
  return out.join("");
}
const answerFront = () => S(k.slabOf({ x: ANSWER.x + 1.6, y: ANSWER.y + ANSWER.d - 1.6, w: ANSWER.w - 3.2, d: 1.6, r: 0.4 }, BASE_H, 2.6, P, 1), { tone: "mid" }) + frontText(ANSWER.x + 3, ANSWER.y + ANSWER.d, 1.1, "ANSWER", 1.6, "lo");
// the done flag: a post with a flag that rises when the model answers
const flagPost = () => S(k.cylinder(FLAG.x, FLAG.y, 0.9, BASE_H, 16, P, 12), { tone: "mid" }) + S(k.cylinder(FLAG.x, FLAG.y, 1.6, BASE_H, 0.8, P, 14), { tone: "lo" });
const flagSvg = () => S(k.slabOf({ x: FLAG.x + 0.9, y: FLAG.y - 0.3, w: 8, d: 0.6, r: 0 }, 11, 5, P, 1), { tone: "hi" });

// ---------- the tools ----------
function tools() {
  return TOOLS.map((t, i) => {
    const p = t.plan, out = [S(k.slabOf(p, 0, TOOL_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(p, 3, P, 4), { tone: "faint" }) })];
    const win = { x: p.x + 5, y: p.y + 4, w: 30, d: 8, r: 0.8 };
    out.push(S(k.slabOf(win, TOOL_H, 0.5, P, 2), { tone: "lo", crease: "none" }));
    out.push(topText(win.x + win.w - 2, win.y + 5.8, TOOL_H + 0.5, "—", 3.4, "lo", "end", ` data-result="${i}"`));
    out.push(L(k.ring(p.x + p.w - 6, p.y + 8, 2.6, TOOL_H, P, 16), { tone: "lo" }));
    out.push(`<g data-busy="${i}">${S(k.cylinder(p.x + p.w - 6, p.y + 8, 1.7, TOOL_H, 1, P, 16), { tone: "mid" })}</g>`);
    out.push(L([0, 1, 2].map((j) => k.planOutline({ x: p.x + 5, y: p.y + 15 + j * 2.2, w: 22, d: 1.2, r: 0.5 }, TOOL_H, P, 2)).join(""), { tone: "lo" }));
    out.push(frontText(p.x + 4, p.y + p.d, 6.6, t.label, 2.6, "mid"));
    out.push(screws(k.corners(p, 2.6), TOOL_H, 0.45));
    return `<g data-part="tools">${out.join("")}</g>`;
  }).join("");
}

// ---------- goal plaque, dial, label ----------
function plaque() {
  const out = [S(k.slabOf(PLAQ, 0, PLAQ_H, P, 3), { tone: "mid", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(PLAQ, 1.6), PLAQ_H, P, 3), { tone: "faint" }));
  const z = PLAQ_H, x = PLAQ.x + 5;
  out.push(topText(x, PLAQ.y + 7, z, "LOOP · until FINAL, or step > max_steps", 2.2, "mid"));
  out.push(topText(x, PLAQ.y + 13, z, "1 read the stack   2 act   3 run the tool", 2.1, "lo"));
  out.push(topText(x, PLAQ.y + 18.6, z, "4 append the result   5 repeat", 2.1, "lo"));
  out.push(screws(k.corners(PLAQ, 2.6), PLAQ_H, 0.4));
  return out.join("");
}
const DIAL_A = (m) => ((m - 1) / (MAX_TOP - 1)) * 1.5 * Math.PI - 0.75 * Math.PI;
function dial() {
  const out = [S(k.cylinder(DIAL.x, DIAL.y, DIAL.r, 0, 1.6, P, 56, 0.4), { tone: "mid" })];
  const t = k.radialTicks(DIAL.x, DIAL.y, DIAL.r - 0.05, MAX_TOP - 1, 13, 1.6, [1.6, 2.6], P, -0.75 * Math.PI, 1.5 * Math.PI);
  out.push(L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }));
  out.push(L(k.ring(DIAL.x, DIAL.y, DIAL.knob + 1.4, 1.6, P, 32), { tone: "faint" }));
  for (const [m, a] of [[1, DIAL_A(1)], [MAX_TOP, DIAL_A(MAX_TOP)]]) out.push(topText(DIAL.x + Math.sin(a) * (DIAL.r + 3.4), DIAL.y - Math.cos(a) * (DIAL.r + 3.4) + 1, 0, String(m), 2, "lo", "middle"));
  out.push(topText(DIAL.x + DIAL.r + 4, DIAL.y + 1, 0, "MAX_STEPS", 2.4, "mid"));
  out.push(topText(DIAL.x + DIAL.r + 4, DIAL.y + 4.6, 0, "the stop pin", 2, "lo"));
  out.push(S(k.cylinder(DIAL.x, DIAL.y, DIAL.knob, 1.6, 4, P, 36, 0.4), { tone: "mid", inner: L(k.knurl(DIAL.x, DIAL.y, DIAL.knob, 1.6, 5.6, 24, P), { tone: "lo" }) }));
  return out.join("");
}
const dialPointerD = (m) => { const a = DIAL_A(m); return k.lineOnTop([DIAL.x + Math.sin(a) * 1.2, DIAL.y - Math.cos(a) * 1.2], [DIAL.x + Math.sin(a) * (DIAL.knob - 0.4), DIAL.y - Math.cos(a) * (DIAL.knob - 0.4)], 5.6, P); };
function label() {
  const out = [S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "mid", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(topText(LABEL.x + 5, LABEL.y + 7.4, 0.8, "AGENT LOOP · TOY TASK", 2.8, "mid"));
  out.push(topText(LABEL.x + 5, LABEL.y + 12.6, 0.8, "agent.py", 2.2, "lo"));
  out.push(L(k.lineOnTop([LABEL.x + 22, LABEL.y + 11.8], [LABEL.x + 56, LABEL.y + 11.8], 0.8, P), { tone: "faint", free: true }));
  out.push(screws([[LABEL.x + 2.6, LABEL.y + 2.6], [LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d - 2.6]], 0.8, 0.4));
  return out.join("");
}

// ---------- the card ----------
function card() {
  const plan = box(0, 0, CARD.w, CARD.d, 0.5), top = BASE_H + CARD.h;
  const tag = { x: -TAG.w / 2, y: 0.3, w: TAG.w, d: TAG.d, r: 0.3 };
  return `<g data-cardbody>${S(k.slabOf(plan, BASE_H, CARD.h, P, 1), { tone: "hi", crease: "none", lit: true, inner: topText(plan.x + 1.4, -1.2, top, "", 1.6, "hi", "start", " data-args") })}</g>` +
    `<g data-tag>${S(k.slabOf(tag, top, TAG.h, P, 1), { tone: "mid", crease: "none", inner: topText(tag.x + 1.2, tag.y + 2.5, top + TAG.h, "", 1.5, "hi", "start", " data-tagtext") })}</g>`;
}

// the starting stack (system prompt and goal), drawn at build time so the page reads before its script runs
function stackStatic() {
  let z = TRAY_H;
  return [SYSTEM, GOAL].map((m, i) => {
    const h = m.tok * PER_TOK, j = (i % 3) - 1;
    const plan = { x: SHEET.x + j * 0.5, y: SHEET.y - j * 0.4, w: SHEET.w, d: SHEET.d, r: 0.5 };
    const base = z + Math.min(h / 2 + 0.6, h - 0.4);
    const text = k.faceTextSvg(k.sideMatrix([plan.x + 1.6, plan.y + plan.d], base, P, "left"), m.label, { size: m.id === "sys" ? 1.9 : 1.45, tone: m.id === "goal" ? "hi" : "lo" });
    const inner = m.id === "sys" ? L(k.sideSeam(plan, z + 3, P, 2) + k.sideSeam(plan, z + h - 3, P, 2), { tone: "faint" }) : "";
    const out = S(k.slabOf(plan, z, h, P, 2), { tone: m.id === "goal" ? "hi" : "mid", crease: "faint", inner: inner + text });
    z += h;
    return `<g>${out}</g>`;
  }).join("");
}

// ---------- assemble ----------
const part = (id, svg) => `<g data-part="${id}">${svg}</g>`;
const FIGURE_LABEL = `A loop bench for an AI agent. At the back left a model box has a reading arm that reaches over a stack of sheets: the context, everything the model has been told and every result so far. A crossbar between two posts marks the 800-token context window. Each step the model reads the whole stack and issues an action card. A decider sends a tool call along the back lane to one of two tools, weather and calc; the tool's result is clipped to the card, which rides round the loop and is lifted onto the stack. A final answer is turned into an answer tray instead, and a flag goes up. A ratchet wheel on the model counts steps; at the stop pin set by the max_steps dial, a halt gate drops across the model's out slot. If the stack outgrows the window, the oldest message after the system prompt is pushed out.`;

const BODY = [
  plate(),
  part("model", model()),
  part("steps", wheel() + `<g data-pin>${pinSvg(MAX0)}</g>` + `<g data-pointer>${L(pointerD(0), { tone: "hi" })}</g>`),
  part("decider", deciderLamps()),
  tools(),
  part("gate", gateBack()),
  backLane(),
  part("gate", `<g data-gate>${gatePlate() + gateRod()}</g>` + gateFront()),
  part("decider", pivot() + `<g data-blade>${bladeSvg(0)}</g>`),
  crossLane(),
  part("answer", flagPost() + `<g data-flag transform="${k.translateAlong(P, [0, 0, -6])}" style="opacity:0.25">${flagSvg()}</g>`),
  `<g data-slot="a"><g data-card style="opacity:0">${card()}</g></g>`,
  backLaneFront(),
  part("answer", answerFront()),
  part("goal", plaque()),
  part("dial", dial() + `<g data-dial>${L(dialPointerD(MAX0), { tone: "hi" })}</g>`),
  label(),
  part("context", meter()),
  part("context", trayBack() + `<g data-stack>${stackStatic()}</g>`),
  loopLanes(),
  `<g data-slot="b"></g>`,
  part("model", `<g data-rod>${rodSvg(ROD.up)}</g>` + arm()),
];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });

// ---------- parts ----------
const PARTS = [
  { id: "goal", phase: "read", title: "The loop", fact: "while not done and step ≤ max_steps: read, act, run, append", text: "An agent is a model called over and over in a loop. Each turn it reads the goal and everything so far, chooses one action, and sees the result next turn. This plaque is the whole program; the rest of the bench is what each line does." },
  { id: "context", phase: "append", title: "Context stack", fact: "context · append-only, re-read in full every step", text: "Every message the model has seen: the system prompt with the tool list, the user's goal, then one sheet per step with the call and its result. Sheets are only ever added, and the model re-reads the whole stack on every step, so each step costs more than the last. The crossbar is the 800-token window (a toy size)." },
  { id: "model", phase: "act", title: "Model", fact: "model · reads the stack, writes one action", text: "The reading arm drops onto the stack: the model sees all of it, nothing else. It writes one action card, either a tool call or FINAL with the answer. It keeps no memory between steps: what isn't on the stack, it doesn't know." },
  { id: "decider", phase: "act", title: "Decider", fact: "decider · tool call → run it · FINAL → stop", text: "Your code, not the model, reads the card. A tool call goes on to the tool; FINAL turns the blade and the card drops into the answer tray. That is the normal stop condition: the model says it is done." },
  { id: "tools", phase: "run", title: "Tools", fact: "tools · weather(city), calc(expr) · toy results", text: "Two made-up tools with scripted results. A tool that fails doesn't stop the loop: its error is clipped to the card like any result, and the model reads it next step and can try again (pick the tool-error task). How each call is shaped and checked is a figure of its own: see the guardrail." },
  { id: "steps", phase: "read", title: "Step counter", fact: "max_steps · the guard when the model never says FINAL", text: "The ratchet wheel moves one tooth per model call. The raised pin is max_steps. Nothing in the model guarantees it will ever answer, so the loop needs a limit of its own: after the step at the pin, the halt gate drops and the loop stops with no answer." },
  { id: "gate", phase: "halt", title: "Halt gate", fact: "halt · stopped by the guard, not by the model", text: "Drops across the out slot when the step limit is reached. Pick the never-finishes task: the weather tool is down, nothing tells the model when to give up, and only this gate ends the loop." },
  { id: "dial", phase: "halt", title: "max_steps dial", fact: "max_steps · 1 to 14 · cost cap and safety stop", text: "Sets the stop pin. Too low and a task that would finish is cut off before its answer (try 2 on the first task). Too high and a stuck loop runs longer, costs more, and grows the stack past the window (try 12 on the never-finishes task)." },
  { id: "answer", phase: "done", title: "Answer tray", fact: "FINAL · the card leaves the loop, the flag goes up", text: "A FINAL card is the answer to the user, so it is not appended: the loop is over. The flag shows how the loop ended: up for an answer, down for a halt." },
];

const unit = (vector) => { const o = at([0, 0, 0]); const p = at(vector); return [p[0] - o[0], p[1] - o[1]]; };
const DATA = {
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  P, window: WINDOW, perTok: PER_TOK, max0: MAX0, maxTop: MAX_TOP, system: SYSTEM, goal: GOAL, tasks: TASKS,
  sheet: SHEET, trayH: TRAY_H, read: READ, rod: ROD, armZ: ARM_Z, baseH: BASE_H,
  route: { x0: X0, by: BY, rx: RX, fy: FY, ux: UX, uy: FY, decX: DEC_X, ansY: ANS_Y },
  stops: TOOLS.map((t) => t.stop), toolIds: TOOLS.map((t) => t.id),
  gate: GATE, pivot: PIVOT, blade: BLADE, wheel: WHEEL, modelH: MODEL_H, dial: DIAL,
  parts: Object.fromEntries(PARTS.map(({ id, phase, fact }) => [id, { phase, fact }])),
};

const live = `
const D = ${JSON.stringify(DATA)};
const stage = ROOT.querySelector(".iso-stage");
const readout = ROOT.querySelector("[data-readout]");
const liveText = ROOT.querySelector("[data-live]");
const prev = ROOT.querySelector("[data-prev]");
const next = ROOT.querySelector("[data-next]");
const items = [...ROOT.querySelectorAll("[data-select]")];
const fewer = ROOT.querySelector("[data-fewer]");
const more = ROOT.querySelector("[data-more]");
const taskButtons = [...ROOT.querySelectorAll("[data-task]")];
const logEl = ROOT.querySelector("[data-log]");
const meterEl = ROOT.querySelector("[data-meter]");
const meterText = ROOT.querySelector("[data-meter-text]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const slotA = stage.querySelector('[data-slot="a"]'), slotB = stage.querySelector('[data-slot="b"]');
const cardEl = stage.querySelector("[data-card]");
const argsEl = cardEl.querySelector("[data-args]");
const tagEl = cardEl.querySelector("[data-tag]");
const tagText = cardEl.querySelector("[data-tagtext]");
const tagSolid = tagEl.querySelector(".iso-solid");
const rodEl = stage.querySelector("[data-rod]");
const bladeEl = stage.querySelector("[data-blade]");
const gateEl = stage.querySelector("[data-gate]");
const flagEl = stage.querySelector("[data-flag]");
const pinEl = stage.querySelector("[data-pin]");
const pointerEl = stage.querySelector("[data-pointer]");
const dialEl = stage.querySelector("[data-dial]");
const stackEl = stage.querySelector("[data-stack]");
const windowEl = stage.querySelector("[data-window] .iso-solid");
const stepEl = stage.querySelector("[data-step]");
const stepMaxEl = stage.querySelector("[data-stepmax]");
const tokEl = stage.querySelector("[data-tok]");
const resultEls = [...stage.querySelectorAll("[data-result]")].sort((a, b) => a.dataset.result - b.dataset.result);
const busyEls = [...stage.querySelectorAll("[data-busy]")].sort((a, b) => a.dataset.busy - b.dataset.busy);
const kindEls = [...stage.querySelectorAll("[data-kind]")].sort((a, b) => a.dataset.kind - b.dataset.kind);
const kindTexts = [...stage.querySelectorAll("[data-kind-text]")].sort((a, b) => a.dataset.kindText - b.dataset.kindText);
const groups = [...stage.querySelectorAll("[data-part]")];

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const shift = (dx, dy, dz) => [D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz, D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz];
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };
const setO = (el, o) => { const v = o >= 0.999 ? "" : o.toFixed(2); if (el._o !== v) { el._o = v; el.style.opacity = v; } };
const setLit = (el, on) => { const s = el.querySelector(".iso-solid") || el; if (on) s.setAttribute("data-lit", ""); else s.removeAttribute("data-lit"); };
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.01 ? target : nx; };
const tokOf = (ctx) => ctx.reduce((s, m) => s + (m.out ? 0 : m.tok), 0);
const pathLen = (r) => r.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r[i][0], p[1] - r[i][1], p[2] - r[i][2]), 0);
function pointOn(route, dist) {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (dist <= len || i === route.length - 1) { const f = len ? Math.max(0, Math.min(1, dist / len)) : 1; return { p: [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * f), seg: i }; }
    dist -= len;
  }
}

// ---------- the loop, as phases ----------
let task = 0, maxSteps = D.max0, phases = [], ph = 0, selected = null;
function build() {
  phases = [];
  let ctx = [{ ...D.system }, { ...D.goal }];
  const script = D.tasks[task].steps;
  for (let s = 1; s < 40; s++) {
    if (s > maxSteps) { phases.push({ k: "halt", s: s - 1, ctx }); break; }
    const a = script[Math.min(s - 1, script.length - 1)];
    const goalGone = ctx.find((m) => m.id === "goal").out;
    phases.push({ k: "read", s, a, ctx, goalGone });
    phases.push({ k: "act", s, a, ctx, goalGone });
    if (a.final) { phases.push({ k: "route", s, a, ctx }, { k: "done", s, a, ctx }); break; }
    phases.push({ k: "run", s, a, ctx });
    ctx = [...ctx, { id: "s" + s, who: "step " + s, text: a.call + " → " + a.result, label: s + " " + a.call + " → " + a.short, tok: a.tok, error: a.error }];
    phases.push({ k: "append", s, a, ctx });
    // over the window: drop the oldest message after the system prompt, until it fits
    while (tokOf(ctx) > D.window) {
      const i = ctx.findIndex((m) => m.id !== "sys" && !m.out);
      const dropped = ctx[i];
      ctx = ctx.map((m, j) => (j === i ? { ...m, out: true } : m));
      phases.push({ k: "overflow", s, a, ctx, dropped });
    }
  }
}
const cur = () => phases[ph];
const NEXT = { read: "Act", act: (p) => (p.a.final ? "Stop: answer" : "Run the tool"), route: "Done", run: "Append", append: "Next step", overflow: "Next step", done: "Again", halt: "Again" };
function phaseText(p, long) {
  const m = maxSteps, tok = tokOf(p.ctx), n = p.ctx.filter((x) => !x.out).length;
  if (p.k === "read") return "step " + p.s + "/" + m + " · reads " + n + " messages, " + tok + " tok" + (p.goalGone ? " · no goal!" : "");
  if (p.k === "act") return p.a.final ? "step " + p.s + " · " + (long ? p.a.call : "FINAL: Yes, about 64 °F") : "step " + p.s + " · calls " + p.a.call + (long && p.goalGone ? ", with the goal no longer in its context" : "");
  if (p.k === "run") return p.a.tool + " → " + p.a.result + (p.a.error && long ? ". The error goes back on the stack like any result." : "");
  if (p.k === "append") return "appended · " + tok + "/" + D.window + " tok";
  if (p.k === "overflow") return "over " + D.window + " tok · dropped the oldest: " + (p.dropped.id === "goal" ? "the goal" : p.dropped.who) + (long && p.dropped.id === "goal" ? ". The model can no longer see what it was asked." : "");
  if (p.k === "route") return "FINAL → answer tray · the loop stops";
  if (p.k === "done") return "done in " + p.s + " step" + (p.s === 1 ? "" : "s") + " · " + tok + " tok read last step";
  return "halted · max_steps = " + m + " · no answer";
}

// ---------- routes the card rides (world points, z offset from the lane) ----------
const R = D.route;
function toolRoute(p) {
  const stop = D.stops[D.toolIds.indexOf(p.a.tool)];
  const live = p.ctx.filter((m) => !m.out && m.id !== "s" + p.s);
  const top = D.trayH + tokOf(live) * D.perTok - D.baseH;
  return { stopAt: Math.abs(stop - R.x0), pts: [[R.x0, R.by, 0], [stop, R.by, 0], [R.rx, R.by, 0], [R.rx, R.fy, 0], [R.ux, R.fy, 0], [R.ux, R.uy, 0], [R.ux, R.uy, top + 1.4], [R.ux, D.read.y, top + 1.4], [R.ux, D.read.y, top]] };
}
const finalRoute = () => ({ pts: [[R.x0, R.by, 0], [R.decX, R.by, 0], [R.decX, R.ansY, 0]] });
let route = null, routeKey = "", dist = 0, appear = 1, rod = 0, blade = 0, gate = 0, flag = 0, tagOn = 0, wheel = 0, dialV = D.max0;
// each sheet's eased height, slide and opacity, by id
const sheets = new Map();
function goals() {
  const p = cur();
  const tool = p.a && !p.a.final && (p.k === "act" || p.k === "run" || p.k === "append");
  const fin = p.a && p.a.final && (p.k === "act" || p.k === "route" || p.k === "done");
  const r = tool ? toolRoute(p) : fin ? finalRoute() : null;
  const total = r ? pathLen(r.pts) : 0;
  return {
    route: r,
    dist: !r ? 0 : p.k === "act" ? 0 : p.k === "run" ? r.stopAt : total,
    card: r ? 1 : 0,
    rod: p.k === "read" ? 1 : 0,
    blade: fin && p.k !== "act" ? 1 : 0,
    gate: p.k === "halt" ? 1 : 0,
    flag: p.k === "done" ? 1 : 0,
    tag: p.k === "run" || p.k === "append" ? 1 : 0,
    wheel: p.k === "halt" ? maxSteps : p.s,
  };
}
function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }

function setPhase(n, quiet) {
  n = Math.max(0, Math.min(phases.length - 1, n));
  const was = cur();
  ph = n;
  const p = cur(), g = goals();
  const key = g.route ? JSON.stringify(g.route.pts[1]) + p.s + task : "";
  const jump = !was || Math.abs(phases.indexOf(was) - n) > 1 || (was && was.s !== p.s);
  if (key !== routeKey) { routeKey = key; if (g.route) { route = g.route; appear = p.k === "act" ? 0 : 1; dist = g.dist; } }
  else if (g.route) { route = g.route; if (jump) dist = g.dist; }
  argsEl.textContent = p.a ? p.a.call : "";
  tagText.textContent = p.a && !p.a.final ? "→ " + p.a.result : "";
  if (p.a && p.a.error) tagSolid.setAttribute("data-lit", ""); else tagSolid.removeAttribute("data-lit");
  controls();
  fillLog();
  if (!quiet && !touring) announce(phaseText(p, true));
  run();
}
function setTask(n) { task = (n + D.tasks.length) % D.tasks.length; build(); routeKey = ""; setPhase(0, true); }
function setMax(n) {
  n = Math.max(1, Math.min(D.maxTop, n));
  if (n === maxSteps) return;
  maxSteps = n;
  build();
  setPhase(Math.min(ph, phases.length - 1), true);
  announce("max_steps = " + maxSteps + " · " + outcome());
}
function outcome() {
  const last = phases[phases.length - 1];
  const dropped = phases.some((p) => p.k === "overflow");
  return (last.k === "done" ? "this task answers in " + last.s + " steps" : "this task halts at step " + last.s + " with no answer") + (dropped ? ", and overflows the window on the way" : "");
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
function jumpTo(kind) {
  if (kind === "halt" && !phases.some((p) => p.k === "halt")) setTask(2);
  if ((kind === "done" || kind === "run") && !phases.some((p) => p.k === kind)) setTask(0);
  const i = phases.findIndex((p) => p.k === kind);
  if (i >= 0) setPhase(i);
}

function controls() {
  const p = cur();
  prev.disabled = ph === 0;
  const label = typeof NEXT[p.k] === "function" ? NEXT[p.k](p) : NEXT[p.k];
  next.querySelector("span").textContent = label;
  next.setAttribute("aria-label", label);
  stage.setAttribute("aria-valuemax", String(phases.length - 1));
  stage.setAttribute("aria-valuenow", String(ph));
  stage.setAttribute("aria-valuetext", "task: " + D.tasks[task].name + ". " + phaseText(p, true));
  fewer.disabled = maxSteps === 1;
  more.disabled = maxSteps === D.maxTop;
  ROOT.querySelector("[data-m]").textContent = "max_steps " + maxSteps;
  taskButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === task)));
  setText(stepEl, String(p.k === "halt" ? p.s : p.s || 0));
  setText(stepMaxEl, "/ " + maxSteps);
  setText(tokEl, tokOf(p.ctx) + " / " + D.window);
  const over = tokOf(p.ctx) > D.window || p.k === "overflow";
  if (over) windowEl.setAttribute("data-lit", ""); else windowEl.removeAttribute("data-lit");
}
// the context as text under the figure: what the model will read next
function fillLog() {
  const p = cur();
  const rows = p.ctx.map((m) => '<li' + (m.out ? ' data-out' : '') + (m.id === "s" + p.s && (p.k === "append") ? ' data-on' : '') + '><span>' + m.who + '</span><b>' + m.tok + '</b><em>' + m.text.replace(/&/g, "&amp;").replace(/</g, "&lt;") + (m.out ? " (dropped: over the window)" : "") + '</em></li>').join("");
  if (logEl._h !== rows) { logEl._h = rows; logEl.innerHTML = rows; }
  const tok = tokOf(p.ctx);
  meterEl.style.setProperty("--p", Math.min(1, tok / D.window).toFixed(3));
  meterEl.toggleAttribute("data-over", tok > D.window || p.k === "overflow");
  setText(meterText, tok + " / " + D.window + " tokens in the window · " + p.ctx.filter((m) => !m.out).length + " messages");
}

function update(dt, calm) {
  const g = goals(), p = cur();
  let busy = false;
  const go = (x, target, rate) => { const nx = calm ? target : follow(x, target, rate, dt); if (nx !== target) busy = true; return nx; };
  dist = go(dist, g.dist, 1.5);
  appear = go(appear, 1, 5);
  rod = go(rod, g.rod, 6);
  blade = go(blade, g.blade, 5);
  gate = go(gate, g.gate, 4);
  flag = go(flag, g.flag, 4);
  tagOn = go(tagOn, g.tag, p.k === "run" ? 3 : 8);
  wheel = go(wheel, g.wheel, 6);
  dialV = go(dialV, maxSteps, 8);
  // the stack: each sheet eases to its height; a dropped one slides out to the left and fades
  const landed = !(p.k === "append" && route && dist < pathLen(route.pts) - 0.6);
  let z = D.trayH;
  const seen = new Set();
  p.ctx.forEach((m, i) => {
    if (!landed && m.id === "s" + p.s) return;
    seen.add(m.id);
    let s = sheets.get(m.id);
    const tz = z, tx = m.out ? -26 : 0, to = m.out ? 0 : 1;
    if (!s) { s = { z: tz, x: tx, o: m.id === "s" + p.s && !calm ? 1 : to, m }; sheets.set(m.id, s); }
    s.m = m;
    s.z = go(s.z, tz, 6); s.x = go(s.x, tx, 3); s.o = go(s.o, to, m.out ? 2.2 : 8);
    if (!m.out) z += m.tok * D.perTok;
  });
  for (const id of [...sheets.keys()]) if (!seen.has(id)) sheets.delete(id);
  return busy;
}

function stackSvg() {
  const list = [...sheets.values()];
  const key = list.map((s) => s.m.id + s.z.toFixed(2) + s.x.toFixed(1) + s.o.toFixed(2)).join("|");
  if (stackEl._k === key) return;
  stackEl._k = key;
  const S = D.sheet;
  stackEl.innerHTML = list.filter((s) => s.o > 0.01).map((s, i) => {
    const h = s.m.tok * D.perTok, j = (i % 3) - 1;
    const plan = { x: S.x + s.x + j * 0.5, y: S.y - j * 0.4, w: S.w, d: S.d, r: 0.5 };
    const tone = s.m.id === "goal" ? "hi" : s.m.id === "sys" ? "mid" : "mid";
    const fy = plan.y + plan.d, base = s.z + Math.min(h / 2 + 0.6, h - 0.4);
    const text = faceTextSvg(sideMatrix([plan.x + 1.6, fy], base, D.P, "left"), s.m.label, { size: s.m.id === "sys" ? 1.9 : 1.45, tone: s.m.error ? "hi" : s.m.id === "goal" ? "hi" : "lo" });
    const inner = s.m.id === "sys" ? lineSvg(sideSeam(plan, s.z + 3, D.P, 2) + sideSeam(plan, s.z + h - 3, D.P, 2), { tone: "faint" }) : "";
    return '<g' + (s.o < 0.999 ? ' style="opacity:' + s.o.toFixed(2) + '"' : '') + '>' + solidSvg(slabOf(plan, s.z, h, D.P, 2), { tone, crease: "faint", inner: inner + text }) + '</g>';
  }).join("");
}

function place() {
  const p = cur();
  // the card along its route, painted in the slot where it physically sits
  if (route) {
    const { p: pt, seg } = pointOn(route.pts, dist);
    const slot = route.pts.length > 3 && seg >= 3 ? slotB : slotA;
    if (cardEl.parentNode !== slot) slot.appendChild(cardEl);
    setT(cardEl, shift(pt[0], pt[1], pt[2]));
  }
  const total = route ? pathLen(route.pts) : 0;
  const landed = p.k === "append" && route && dist >= total - 0.6;
  setO(cardEl, goals().card && !landed ? appear : 0);
  setO(tagEl, tagOn);
  // the reading arm's rod drops onto the top sheet
  const live = p.ctx.filter((m) => !m.out && !(p.k === "append" && !landed && m.id === "s" + p.s));
  const top = D.trayH + tokOf(live) * D.perTok;
  const bottom = D.rod.up + (top + 0.05 - D.rod.up) * ease(rod);
  const key = bottom.toFixed(2);
  if (rodEl._k !== key) { rodEl._k = key; rodEl.innerHTML = solidSvg(cylinder(D.read.x, D.read.y, D.rod.r, bottom + 1, D.armZ - bottom - 1, D.P, 14), { tone: "mid" }) + solidSvg(cylinder(D.read.x, D.read.y, D.rod.foot, bottom, 1, D.P, 20), { tone: "hi", lit: rod > 0.9 }); }
  stackSvg();
  // decider lamps and blade
  const kind = p.a && (p.k === "act" || p.k === "route" || p.k === "run" || p.k === "done") ? (p.a.final ? 1 : 0) : -1;
  kindEls.forEach((el, i) => setLit(el, i === kind));
  kindTexts.forEach((el, i) => el.setAttribute("data-tone", i === kind ? "hi" : "lo"));
  const bk = blade.toFixed(3);
  if (bladeEl._k !== bk) { bladeEl._k = bk; bladeEl.innerHTML = solidSvg(extrude(bladeRing(D.blade.deflect * ease(blade)), D.baseH, D.blade.h, D.P), { tone: "hi" }); }
  // the halt gate drops; the flag rises
  setT(gateEl, shift(0, 0, (D.gate.up - D.gate.down) * (1 - ease(gate))));
  setT(flagEl, shift(0, 0, -6 * (1 - ease(flag))));
  setO(flagEl, 0.25 + 0.75 * ease(flag));
  // tools: busy lamp and result window
  const ti = p.a && p.a.tool ? D.toolIds.indexOf(p.a.tool) : -1;
  const arrived = route && p.k === "run" && Math.abs(dist - goals().dist) < 2;
  busyEls.forEach((el, i) => setLit(el, i === ti && (arrived || p.k === "append")));
  resultEls.forEach((el, i) => { const on = i === ti && (arrived || p.k === "append"); const t = on ? p.a.short : "—"; if (el.textContent !== t) { el.textContent = t; el.setAttribute("data-tone", on ? "hi" : "lo"); } });
  // ratchet wheel pointer and stop pin, dial pointer
  const wk = wheel.toFixed(3);
  if (pointerEl._k !== wk) { pointerEl._k = wk; pointerEl.innerHTML = lineSvg(wheelPointer(wheel), { tone: "hi" }); }
  const pk = String(maxSteps);
  if (pinEl._k !== pk) { pinEl._k = pk; pinEl.innerHTML = pinSvg(maxSteps); }
  const dk = dialV.toFixed(3);
  if (dialEl._k !== dk) { dialEl._k = dk; dialEl.innerHTML = lineSvg(dialPointer(dialV), { tone: "hi" }); }
  const text = selected ? D.parts[selected].fact : phaseText(p);
  if (readout.textContent !== text) readout.textContent = text;
}
function bladeRing(angle) {
  const [px, py] = D.pivot, c = Math.cos(angle), s = Math.sin(angle), t = D.blade.t, n = [-s, c];
  const a = [px - n[0] * t / 2, py - n[1] * t / 2], b = [a[0] + c * D.blade.len, a[1] + s * D.blade.len];
  return [a, b, [b[0] + n[0] * t, b[1] + n[1] * t], [a[0] + n[0] * t, a[1] + n[1] * t]];
}
const W_ = D.wheel, wa = (n) => (n / W_.teeth) * Math.PI * 2;
function wheelPointer(n) { const a = wa(n), z = D.modelH + W_.h; return lineOnTop([W_.x + Math.sin(a) * 1.4, W_.y - Math.cos(a) * 1.4], [W_.x + Math.sin(a) * (W_.r - 0.3), W_.y - Math.cos(a) * (W_.r - 0.3)], z, D.P); }
function pinSvg(n) { const a = wa(n), x = W_.x + Math.sin(a) * (W_.r - 2.2), y = W_.y - Math.cos(a) * (W_.r - 2.2); return solidSvg(cylinder(x, y, 0.9, D.modelH + W_.h, 1.6, D.P, 12), { tone: "hi" }); }
const da = (m) => ((m - 1) / (D.maxTop - 1)) * 1.5 * Math.PI - 0.75 * Math.PI;
function dialPointer(m) { const a = da(m), K = D.dial; return lineOnTop([K.x + Math.sin(a) * 1.2, K.y - Math.cos(a) * 1.2], [K.x + Math.sin(a) * (K.knob - 0.4), K.y - Math.cos(a) * (K.knob - 0.4)], 5.6, D.P); }

let touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0;
const TOUR = 1.8;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    tourClock += dt;
    const k = cur().k;
    if (tourClock > TOUR * (k === "append" || k === "done" || k === "halt" || k === "overflow" ? 1.7 : 1)) {
      tourClock = 0;
      if (ph === phases.length - 1) setTask(task + 1); else setPhase(ph + 1);
    }
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
    if (still.matches || selected || stage.matches(":hover, :focus-within") || ROOT.matches(":focus-within")) return hold();
    touring = true;
    tourClock = 0;
    run();
  }, 9000);
}
const go = (n) => { hold(); setPhase(n); };
const forward = () => { hold(); if (ph === phases.length - 1) { setPhase(0); announce(phaseText(cur(), true)); } else setPhase(ph + 1); };
const pickTask = (n) => { hold(); select(null); setTask(n); announce("task: " + D.tasks[task].name + " · " + outcome()); };

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

const partAt = (target) => target.closest && target.closest("[data-part]");
stage.addEventListener("pointermove", (event) => { if (event.pointerType !== "mouse") return; hold(); const g = partAt(event.target); select(g ? g.dataset.part : null); });
stage.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
stage.addEventListener("click", (event) => { hold(); const g = partAt(event.target); if (!g) return select(null); if (event.pointerType !== "mouse") select(selected === g.dataset.part ? null : g.dataset.part); });
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: forward, ArrowDown: forward, ArrowLeft: () => go(ph - 1), ArrowUp: () => go(ph - 1), Home: () => go(0), End: () => go(phases.length - 1), " ": forward, Enter: forward, Escape: () => { hold(); select(null); }, t: () => pickTask(task + 1), T: () => pickTask(task + 1), 1: () => pickTask(0), 2: () => pickTask(1), 3: () => pickTask(2), "[": () => { hold(); setMax(maxSteps - 1); }, "]": () => { hold(); setMax(maxSteps + 1); }, "-": () => { hold(); setMax(maxSteps - 1); }, "=": () => { hold(); setMax(maxSteps + 1); }, "+": () => { hold(); setMax(maxSteps + 1); } };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
prev.addEventListener("click", () => go(ph - 1));
next.addEventListener("click", forward);
taskButtons.forEach((b, i) => b.addEventListener("click", () => pickTask(i)));
fewer.addEventListener("click", () => { hold(); setMax(maxSteps - 1); });
more.addEventListener("click", () => { hold(); setMax(maxSteps + 1); });
for (const item of items) {
  const id = item.dataset.select;
  item.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") { hold(); select(id); } });
  item.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
  const pickPart = () => { hold(); select(id); jumpTo(D.parts[id].phase); };
  item.addEventListener("click", pickPart);
  item.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pickPart(); } });
  item.addEventListener("focus", () => { hold(); select(id); });
  item.addEventListener("blur", () => select(null));
}
setTask(0);
update(0, true);
place();
`;

const first = `step 1/${MAX0} · reads 2 messages, ${SYSTEM.tok + GOAL.tok} tok`;
const plateBody = k.plateHtml({
  fig: "Fig 9",
  title: "Agentic loop · read, act, run, append",
  hint: "← → step · 1 2 3 task · [ ] max_steps · F expand",
  readout: first,
  keys: [
    { mark: "lit", label: "The action card the model writes each step" },
    { mark: "raised", label: "Context stack: one sheet per message, as thick as its tokens" },
  ],
  caption: `A toy agent on a toy task. The tools, their results and the model's moves are scripted, and the token counts are round numbers picked to add up easily (20 tokens to a unit of sheet thickness, an 800-token window). What is real is the shape of the loop: the context only grows, the model re-reads all of it every step, the loop stops on a final answer or at max_steps, and when the context outgrows the window the oldest message after the system prompt is dropped. Real agents often summarise old steps or keep the goal pinned instead.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Agentic loop. Arrow keys step through the loop; 1, 2 and 3 pick a task; [ and ] change max_steps; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="10" aria-valuenow="0" aria-valuetext="${first}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Back one step" disabled>←</button><span class="pc-group" role="group" aria-label="Task">${TASKS.map((t, i) => `<button type="button" class="pc-btn" data-task aria-pressed="${i === 0}" aria-keyshortcuts="${i + 1}">${t.name}</button>`).join("")}</span><span class="pc-group pc-right"><button type="button" class="pc-btn" data-fewer aria-label="Lower max_steps" aria-keyshortcuts="[">−</button><span data-m data-value>max_steps ${MAX0}</span><button type="button" class="pc-btn" data-more aria-label="Raise max_steps" aria-keyshortcuts="]">+</button></span><button type="button" class="pc-btn pc-next" data-next><span>Act</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const logCss = `
.anatomy-embed .al-log{list-style:none;margin:6px 0 0;padding:0;font:12px/1.45 var(--anatomy-mono);display:grid;gap:2px}
.anatomy-embed .al-log li{display:grid;grid-template-columns:62px 34px 1fr;gap:8px;padding:4px 6px;border-radius:4px;color:var(--text)}
.anatomy-embed .al-log li span{color:var(--muted)}
.anatomy-embed .al-log li b{font-weight:400;text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.anatomy-embed .al-log li em{font-style:normal;overflow-wrap:anywhere}
.anatomy-embed .al-log li[data-on]{background:var(--surface2)}
.anatomy-embed .al-log li[data-out]{color:var(--muted);text-decoration:line-through}
.anatomy-embed .al-log li[data-out] em{text-decoration:line-through}
.anatomy-embed .al-meter{display:block;height:6px;margin:10px 0 4px;background:var(--surface2);border:1px solid var(--border);position:relative}
.anatomy-embed .al-meter::after{content:"";position:absolute;inset:0 auto 0 0;width:calc(var(--p,0) * 100%);background:var(--text);transition:width .4s var(--anatomy-ease)}
.anatomy-embed .al-meter[data-over]{outline:2px solid var(--text);outline-offset:1px}
.anatomy-embed .pc-group[role="group"]{flex-wrap:wrap;max-width:100%}
@media (prefers-reduced-motion:reduce){.anatomy-embed .al-meter::after{transition:none}}
`;
const logHtml = `<h4 style="margin:6px 0 0">The context, as the model reads it</h4><p class="tip">One row per sheet on the stack, with its (toy) token count. Each step the model reads all of these and nothing else.</p><i class="al-meter" data-meter></i><p class="tip" data-meter-text style="margin:0 0 4px"></p><ol class="al-log" data-log></ol>`;
const html = embedHtml({
  slug: "agentic-loop",
  plate: plateBody,
  parts: partsHtml(PARTS, { extra: logHtml }),
  task: "Pick “never finishes” and step through it: the tool keeps failing and only the halt gate stops the loop. Then raise max_steps to 12 and watch the stack pass the window and push the goal out.",
  css: logCss,
  live,
});
page("agentic-loop", html, {
  title: "Anatomy of an agentic loop",
  lede: `A loop bench: the model reads the whole context stack, issues one action, the tool runs, and the result is lifted back onto the stack, until the model answers or the step counter halts it. How a single tool call is checked is the <a href="../guardrail/">guardrail</a>'s job.`,
});
