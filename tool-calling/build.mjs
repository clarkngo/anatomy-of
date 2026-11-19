// Anatomy of tool calling: one tool call, from declaration to final answer.
//
// A dispatch counter split by a low wall. Behind the wall is the model's side: a sealed booth with
// a selector dial and a punch, and a desk in front of it that holds everything the model can see
// (its context). In front of the wall is the app's side: a rack of tool cards (the declarations),
// the user's tray, and a cabinet of functions wired to the app's own systems. The only thing that
// crosses the wall is paper, through one slot: the tool cards and the question go in, a call slip
// comes out, a result slip goes back in, and the answer comes out. The booth has no cable and no
// hands; the cabinet is the only part that runs anything.
//
// Every request is scripted: the questions, the model's choice and the function results are
// written by hand to show one behaviour each (a good call, a vague description that picks the wrong
// tool, a missing required argument, a question that needs no tool). Nothing is a live model.
import { k, EXPAND_BUTTON, embedHtml, partsHtml, page } from "../tools/embed.mjs";

// ---------- the script ----------
const TOOLS = [
  { name: "lookup_order", field: "order_id", type: "string", desc: ["Live status of one order,", "found by its order ID."], vague: ["Order tool.", ""], schemaDesc: "Live status of one order, found by its order ID.", vagueDesc: "Order tool." },
  { name: "search_docs", field: "query", type: "string", desc: ["Searches help-centre", "articles by keyword."], vague: ["Finds order info", "and more."], schemaDesc: "Searches help-centre articles by keyword.", vagueDesc: "Finds order info and more." },
  { name: "calculate", field: "expression", type: "string", desc: ["Evaluates one arithmetic", "expression."], vague: ["Does maths.", ""], schemaDesc: "Evaluates one arithmetic expression.", vagueDesc: "Does maths." },
];
const QUESTIONS = [
  { q: "Where is order 4417?", lines: ["WHERE IS", "ORDER 4417?"] },
  { q: "What is 17 × 23?", lines: ["WHAT IS", "17 × 23?"] },
  { q: "Where is my order?", lines: ["WHERE IS", "MY ORDER?"] },
  { q: "Say thank you in French.", lines: ["SAY THANK YOU", "IN FRENCH."] },
];
const TRACK = { top: "How to track an order", text: "Open Orders in your account to see the status." };
// what the scripted model does for question qi, with vague descriptions or not, and order_id required or not
function outcome(qi, vague, required) {
  if (qi === 0) return vague
    ? { tool: 1, input: { query: "order 4417 status" }, result: TRACK, answer: "You can track any order from the Orders page in your account.", verdict: "wrong tool", why: "Both vague descriptions mention orders, so the model picked search_docs. It got a help article, not order 4417, and answered with generic advice. Nothing failed, so nothing errored: the answer is just wrong." }
    : { tool: 0, input: { order_id: "4417" }, result: { status: "shipped", eta: "Friday" }, answer: "Order 4417 has shipped and should arrive on Friday.", verdict: "right tool", why: "The descriptions say which tool returns a live order, so the model picked lookup_order and filled order_id from the question. The schema says order_id is a string, so the model wrote \"4417\" in quotes." };
  if (qi === 1) return { tool: 2, input: { expression: "17*23" }, result: { result: 391 }, answer: "17 × 23 = 391.", verdict: "right tool", why: vague ? "Its description is vague too, but nothing else on the rack does arithmetic, so the name carried it. Vague descriptions hurt most where tools overlap." : "The model could multiply in its head, but the app declared calculate, and the description fits. The answer comes from the app's own arithmetic, not the model's." };
  if (qi === 2) {
    if (vague) return { tool: 1, input: { query: "where is my order" }, result: TRACK, answer: "You can track any order from the Orders page in your account.", verdict: "wrong tool", why: "With vague descriptions, search_docs sounds like the order tool, and it needs no ID. The model never asks which order." };
    return required
      ? { tool: -1, input: null, result: null, answer: "Which order do you mean? Please send me the order number.", verdict: "asked first", why: "order_id is required and the question has no ID, so the model writes text and asks instead of calling. It could still invent an ID: the app should check every call before it runs (the guardrail figure)." }
      : { tool: 0, input: {}, result: { error: "order_id is missing" }, answer: "Sorry, I couldn't look that order up. What is the order number?", verdict: "empty call", why: "With order_id optional, an empty call fits the schema, so the model sends {}. The function fails at run time, and the app sends the error back as the tool result. The model can only report it." };
  }
  return { tool: -1, input: null, result: null, answer: "Merci !", verdict: "no tool needed", why: "None of the three tools translates, and the model can answer from what it knows. It writes text; the app has nothing to run, so steps 3 to 5 are skipped." };
}
const SCENARIOS = {};
for (let qi = 0; qi < QUESTIONS.length; qi++) for (const vague of [0, 1]) for (const req of [0, 1]) SCENARIOS[`${qi}${vague}${req}`] = outcome(qi, vague, req);

// ---------- world ----------
const W = 640, H = 430;
const PLATE = { x: -150, y: -106, w: 290, d: 186, r: 9 };
const PLATE_H = 9, FOOT_H = 5;
const box = (cx, cy, w, d, r = 0.8) => ({ x: cx - w / 2, y: cy - d / 2, w, d, r });

// the wall and its slot
const WALL_Y = -16, WALL_D = 4, WALL_H = 10;
const SLOT = [-26, 26];
const BRIDGE_Z = 12, BRIDGE_H = 3;
const SLOT_PT = [0, WALL_Y + WALL_D / 2, 2.6];

// the model's side
const DESK = { x: -142, y: -100, w: 152, d: 66, r: 3 };
const DESK_H = 2;
const BOOTH = { x: 28, y: -98, w: 104, d: 38, r: 3 };
const BOOTH_H = 30;
const RUN = { x: BOOTH.x + 6, y: BOOTH.y + BOOTH.d, w: 58, d: 26, r: 1.4 };
const RUN_H = 2;
const DIAL = [BOOTH.x + 76, BOOTH.y + 19], DIAL_R = 12, KNOB_R = 5, KNOB_Z = [BOOTH_H + 1.6, BOOTH_H + 6];
// selector stops: idle, then the three tools, then text
const STOP_A = [0, 1, 2, 3, 4].map((i) => Math.PI * (0.25 + (i - 2) * 0.21));
const STOP_LABEL = ["", "1", "2", "3", "TXT"];
const LAMP = [BOOTH.x + 50, BOOTH.y + 30];

// the app's side
const RACK = { x: -142, y: 6, w: 110, d: 36, r: 2 };
const RACK_H = 3;
const UT = { x: -14, y: 42, w: 62, d: 34, r: 2 };
const UT_H = 3;
const CAB = { x: 54, y: 2, w: 60, d: 40, r: 2 };
const CAB_H = 28;
const DRAWER_Z = [[3, 10], [11, 18], [19, 26]]; // bottom to top: calculate, search_docs, lookup_order
const DRAWER_OF = [2, 1, 0]; // tool index -> drawer row is DRAWER_OF.indexOf(tool)
const DRAWER_OUT = 10;
const DB = [128, 63], DB_R = 7.5, DB_H = 18;

// cards and slips
const TCARD = { w: 34, d: 26, h: 0.8 };
const QCARD = { w: 50, d: 16, h: 0.8 };
const SLIP = { w: 52, d: 13, h: 0.7 };
const rackSeat = (i) => [-124 + i * 36, 24, RACK_H];
const deskSeat = (i) => [-124 + i * 36, -84, DESK_H];
const Q_HOME = [UT.x + UT.w / 2, UT.y + 11, UT_H];
const Q_DESK = [-114, -54, DESK_H];
const RES_DESK = [-58, -54, DESK_H];
const CALL_RUN = [RUN.x + RUN.w / 2, RUN.y + 9, RUN_H];
const ANS_RUN = [RUN.x + RUN.w / 2, RUN.y + 9, RUN_H];
const CALL_CAB = [CAB.x + CAB.w / 2, CAB.y + 12, CAB_H];
const RES_CAB = [CAB.x + CAB.w / 2, CAB.y + 28, CAB_H];
const ANS_USER = [UT.x + UT.w / 2, UT.y + 25, UT_H];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOOTH.x, BOOTH.y, BOOTH_H + 8], [BOOTH.x + BOOTH.w, BOOTH.y, BOOTH_H + 8], [BOOTH.x + BOOTH.w, BOOTH.y + BOOTH.d, BOOTH_H]],
  W, H, { pad: 18, azimuth: 46 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(...a) - depth(...b));
const screws = (list, z, size = 0.45) => Dt(list.map(([x, y]) => at([x, y, z])), { size });
const pinned = (from, to, z, tone = "faint") => L(k.lineOnTop(from, to, z, P), { tone }) + screws([from, to], z, 0.4);
const topText = (x, y, z, text, size, tone = "mid", anchor = "start", extra = "") => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), text, { size, tone, anchor }).replace("<text", `<text${extra}`);
const frontText = (x, y, z, text, size, tone = "mid", anchor = "start", extra = "") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), text, { size, tone, anchor }).replace("<text", `<text${extra}`);

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
  // the two sides, engraved on the plate beside the wall
  out.push(topText(PLATE.x + 9, WALL_Y - 4, 0, "MODEL SIDE · READS, WRITES", 2.6, "lo"));
  out.push(topText(PLATE.x + 9, WALL_Y + WALL_D + 6.5, 0, "APP SIDE · RUNS CODE", 2.6, "lo"));
  // label plate, front left
  const label = { x: -132, y: 52, w: 56, d: 18, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(topText(label.x + 5, label.y + 7, 0.8, "DISPATCH · ONE CALL", 2.8, "mid"));
  out.push(L([[11, 36], [14, 22]].map(([dy, len]) => k.lineOnTop([label.x + 5, label.y + dy], [label.x + 5 + len, label.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(screws([[label.x + 2.6, label.y + 2.6], [label.x + label.w - 2.6, label.y + label.d - 2.6]], 0.8, 0.4));
  return out.join("");
}

// ---------- the model's side ----------
function desk() {
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(DESK, 0.9, P, 4), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(DESK, 3), DESK_H, P, 3), { tone: "faint" }));
  // a seat outline for each tool card, the question and the result
  const seats = [0, 1, 2].map((i) => box(deskSeat(i)[0], deskSeat(i)[1], TCARD.w + 2, TCARD.d + 2, 1));
  seats.push(box(Q_DESK[0], Q_DESK[1], QCARD.w + 2, QCARD.d + 2, 1), box(RES_DESK[0], RES_DESK[1], SLIP.w + 2, SLIP.d + 2, 1));
  out.push(L(seats.map((s) => k.planOutline(s, DESK_H, P, 2)).join(""), { tone: "faint" }));
  out.push(topText(DESK.x + DESK.w - 5, DESK.y + DESK.d - 4.5, DESK_H, "CONTEXT", 2.6, "lo", "end"));
  out.push(screws(k.corners(DESK, 2.6), DESK_H, 0.4));
  return out.join("");
}
function runout() {
  const out = [S(k.slabOf(RUN, 0, RUN_H, P, 3, 0.4), { tone: "mid" })];
  out.push(L(k.planOutline(box(CALL_RUN[0], CALL_RUN[1], SLIP.w + 2, SLIP.d + 2, 1), RUN_H, P, 2), { tone: "faint" }));
  out.push(pinned([RUN.x + 3, RUN.y + RUN.d - 2.6], [RUN.x + RUN.w - 3, RUN.y + RUN.d - 2.6], RUN_H, "lo"));
  return out.join("");
}
function booth() {
  const out = [S(k.slabOf(BOOTH, 0, BOOTH_H, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(BOOTH, BOOTH_H - 4, P, 5), { tone: "faint" }) + L(k.sideSeam(BOOTH, 3, P, 5), { tone: "faint" }) })];
  // vents on the top, as closed slots
  const vx = BOOTH.x + 8;
  out.push(L([0, 1, 2, 3, 4, 5].map((j) => k.planOutline({ x: vx, y: BOOTH.y + 7 + j * 4.2, w: 22, d: 1.6, r: 0.6 }, BOOTH_H, P, 2)).join(""), { tone: "lo" }));
  out.push(topText(BOOTH.x + 36, BOOTH.y + 10, BOOTH_H, "MODEL", 3.2, "mid"));
  out.push(topText(BOOTH.x + 36, BOOTH.y + 14.4, BOOTH_H, "no cable · no hands", 2.1, "lo"));
  // the punch's output slot on the front face, over the run-out
  const fy = BOOTH.y + BOOTH.d;
  const sx0 = CALL_RUN[0] - SLIP.w / 2 - 1.5, sx1 = CALL_RUN[0] + SLIP.w / 2 + 1.5;
  out.push(L(k.pathOf([at([sx0, fy, 3]), at([sx1, fy, 3]), at([sx1, fy, 6]), at([sx0, fy, 6]), at([sx0, fy, 3])]), { tone: "hi" }));
  out.push(frontText(sx1 + 4, fy, 6, "OUT", 2.3, "lo"));
  // name plate on the front face
  out.push(frontText(BOOTH.x + BOOTH.w - 5, fy, BOOTH_H - 9, "writes JSON or text", 2.4, "lo", "end"));
  out.push(screws(k.corners(BOOTH, 3), BOOTH_H, 0.45));
  // the thinking lamp: lit while the model works
  const [lx, ly] = LAMP;
  out.push(S(k.cylinder(lx, ly, 3.4, BOOTH_H, 0.8, P, 24), { tone: "mid" }));
  out.push(`<g data-think>${S(k.cylinder(lx, ly, 2.3, BOOTH_H + 0.8, 1.6, P, 20), { tone: "hi" })}</g>`);
  return out.join("");
}
// the selector: a dial plate with five stops and a knurled knob whose pointer turns to the choice
function selector() {
  const [cx, cy] = DIAL;
  const out = [S(k.cylinder(cx, cy, DIAL_R + 1.6, BOOTH_H, 1.6, P, 40), { tone: "mid" })];
  out.push(L(k.ring(cx, cy, DIAL_R, BOOTH_H + 1.6, P, 40), { tone: "faint" }));
  const ticks = STOP_A.map((a, i) => {
    const r0 = KNOB_R + 1.4, r1 = DIAL_R - (i === 0 ? 2.2 : 0);
    return k.lineOnTop([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], BOOTH_H + 1.6, P);
  });
  out.push(L(ticks.join(""), { tone: "mid", free: "both" }));
  // stop numbers outside the dial ring: 1–3 match the cards' corner numbers
  STOP_A.forEach((a, i) => { if (STOP_LABEL[i]) out.push(topText(cx + Math.cos(a) * (DIAL_R + 4.4), cy + Math.sin(a) * (DIAL_R + 4.4) + 1, BOOTH_H, STOP_LABEL[i], 2.3, "mid", "middle")); });
  out.push(S(k.cylinder(cx, cy, KNOB_R, BOOTH_H + 1.6, KNOB_Z[1] - BOOTH_H - 1.6, P, 32), { tone: "hi" }));
  out.push(L(k.knurl(cx, cy, KNOB_R, BOOTH_H + 1.6, KNOB_Z[1], 26, P), { tone: "lo" }));
  out.push(`<path class="iso-line" data-tone="lit" data-pointer data-free="both" d="${pointer(STOP_A[0])}" style="stroke-width:1.1"/>`);
  out.push(Dt([at([cx, cy, KNOB_Z[1]])], { size: 0.55, tone: "hi" }));
  return out.join("");
}
function pointer(a) {
  const [cx, cy] = DIAL;
  return k.lineOnTop([cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.2], [cx + Math.cos(a) * (KNOB_R - 0.6), cy + Math.sin(a) * (KNOB_R - 0.6)], KNOB_Z[1], P);
}

// ---------- the wall and its slot ----------
function wall() {
  const out = [];
  for (const [x0, x1] of [[PLATE.x + 6, SLOT[0]], [SLOT[1], PLATE.x + PLATE.w - 6]]) {
    const plan = { x: x0, y: WALL_Y, w: x1 - x0, d: WALL_D, r: 0.8 };
    out.push(S(k.slabOf(plan, 0, WALL_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, 3, P, 3), { tone: "faint" }) }));
    out.push(screws([[x0 + 3, WALL_Y + WALL_D / 2], [x1 - 3, WALL_Y + WALL_D / 2]], WALL_H, 0.4));
  }
  // the deal tray through the slot: the one way across
  const tray = { x: SLOT[0] + 1, y: WALL_Y - 10, w: SLOT[1] - SLOT[0] - 2, d: WALL_D + 20, r: 1.2 };
  out.push(S(k.slabOf(tray, 0, 1.6, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(tray, 2.2), 1.6, P, 2), { tone: "faint" }));
  // posts and the bridge over the slot
  for (const x of [SLOT[0] - 2.2, SLOT[1] + 2.2]) out.push(S(k.cylinder(x, WALL_Y + WALL_D / 2, 1.6, WALL_H, BRIDGE_Z - WALL_H, P, 16), { tone: "mid" }));
  const bridge = { x: SLOT[0] - 4.4, y: WALL_Y, w: SLOT[1] - SLOT[0] + 8.8, d: WALL_D, r: 0.8 };
  out.push(S(k.slabOf(bridge, BRIDGE_Z, BRIDGE_H, P, 3, 0.4), { tone: "mid" }));
  out.push(frontText(0, WALL_Y + WALL_D, BRIDGE_Z + 2.3, "JSON ONLY", 1.9, "mid", "middle"));
  out.push(screws([[bridge.x + 2.2, WALL_Y + WALL_D / 2], [bridge.x + bridge.w - 2.2, WALL_Y + WALL_D / 2]], BRIDGE_Z + BRIDGE_H, 0.4));
  return out.join("");
}

// ---------- the app's side ----------
function rack() {
  const out = [S(k.slabOf(RACK, 0, RACK_H, P, 4, 0.5), { tone: "mid" })];
  out.push(S(k.slabOf({ x: RACK.x, y: RACK.y, w: RACK.w, d: 2.4, r: 0.6 }, RACK_H, 3, P, 2), { tone: "mid" }));
  out.push(L([0, 1, 2].map((i) => k.planOutline(box(rackSeat(i)[0], rackSeat(i)[1], TCARD.w + 2, TCARD.d + 2, 1), RACK_H, P, 2)).join(""), { tone: "faint" }));
  out.push(topText(RACK.x + 4, RACK.y + RACK.d - 1.4, RACK_H, "tools=[…] · DECLARED", 2.2, "lo"));
  out.push(screws([[RACK.x + RACK.w - 2.5, RACK.y + RACK.d - 2.5], [RACK.x + RACK.w - 2.5, RACK.y + 4.6]], RACK_H, 0.4));
  return out.join("");
}
function userTray() {
  const out = [S(k.slabOf(UT, 0, UT_H, P, 4, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(UT, 2.6), UT_H, P, 3), { tone: "faint" }));
  out.push(S(k.slabOf({ x: UT.x, y: UT.y, w: UT.w, d: 2.4, r: 0.6 }, UT_H, 3, P, 2), { tone: "mid" }));
  out.push(topText(UT.x + 4, UT.y + UT.d - 1.2, UT_H, "USER", 2.4, "lo"));
  return out.join("");
}
function cabinet() {
  const out = [S(k.slabOf(CAB, 0, CAB_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CAB, CAB_H - 1.6, P, 4), { tone: "faint" }) })];
  // the in-tray (call slips land here) and the out-slot (results come up here)
  out.push(L(k.planOutline(box(CALL_CAB[0], CALL_CAB[1], SLIP.w + 2, SLIP.d + 2, 1), CAB_H, P, 2), { tone: "lo" }));
  out.push(L(k.planOutline(box(RES_CAB[0], RES_CAB[1] + 4, SLIP.w + 2, 2, 0.6), CAB_H, P, 2), { tone: "hi" }));
  out.push(topText(CAB.x + 4, CAB.y + 4.6, CAB_H, "APP · YOUR CODE", 2.3, "mid"));
  // the run lamp: lit only while a function runs
  out.push(S(k.cylinder(CAB.x + CAB.w - 6, CAB.y + 5, 2.8, CAB_H, 0.7, P, 20), { tone: "mid" }));
  out.push(`<g data-runlamp>${S(k.cylinder(CAB.x + CAB.w - 6, CAB.y + 5, 1.9, CAB_H + 0.7, 1.4, P, 18), { tone: "hi" })}</g>`);
  out.push(screws([[CAB.x + 2.6, CAB.y + CAB.d - 2.6], [CAB.x + CAB.w - 2.6, CAB.y + CAB.d - 2.6]], CAB_H, 0.4));
  // the +x face: a socket where the cable to the database leaves
  out.push(S(k.slabOf({ x: CAB.x + CAB.w, y: CAB.y + 28, w: 1.4, d: 6, r: 0.4 }, CAB_H - 9, 5, P, 1), { tone: "mid" }));
  return out.join("");
}
const drawerFront = (row) => ({ x: CAB.x + 4, y: CAB.y + CAB.d, w: CAB.w - 8, d: 1.6, r: 0.4 });
function drawer(row) {
  const t = TOOLS[DRAWER_OF[row]], [z0, z1] = DRAWER_Z[row], f = drawerFront(row);
  const out = [S(k.slabOf(f, z0, z1 - z0, P, 2, 0.3), { tone: "mid", inner: frontText(f.x + 3, f.y + f.d, z1 - 2, t.name + "()", 2.4, "mid") })];
  // pull handle and its two screws
  const hx = f.x + f.w - 12;
  out.push(S(k.slabOf({ x: hx, y: f.y + f.d, w: 8, d: 1.2, r: 0.3 }, (z0 + z1) / 2 - 0.9, 1.8, P, 1), { tone: "hi" }));
  out.push(Dt([at([f.x + 1.6, f.y + f.d, z1 - 1.4]), at([f.x + f.w - 1.6, f.y + f.d, z1 - 1.4])], { size: 0.35 }));
  return out.join("");
}
function database() {
  const [x, y] = DB;
  const out = [S(k.cylinder(x, y, DB_R, 0, DB_H, P, 36), { tone: "mid" })];
  out.push(L([5, 9.5, 14].map((z) => k.sideArc(x, y, DB_R, z, P, 28)).join(""), { tone: "faint" }));
  out.push(L(k.ring(x, y, DB_R - 2, DB_H, P, 28), { tone: "faint" }));
  out.push(topText(x, y + 1, DB_H, "ORDERS", 2.1, "mid", "middle"));
  return out.join("");
}
function cable() {
  // from the cabinet's socket to the database's top: the app's only line to the outside
  const from = at([CAB.x + CAB.w + 1.4, CAB.y + 31, CAB_H - 6.5]);
  const to = at([DB[0] - 1, DB[1] - 3, DB_H]);
  const via = [at([CAB.x + CAB.w + 5, CAB.y + 31, CAB_H - 7]), at([DB[0] - 2, DB[1] - 5, DB_H + 4])];
  return k.wireSvg(from, to, { via, tone: "mid", size: 0.9 });
}

// ---------- cards and slips (drawn at their homes, moved in the page) ----------
function toolCard(i) {
  const [cx, cy, z] = rackSeat(i), t = TOOLS[i];
  const plan = box(cx, cy, TCARD.w, TCARD.d, 0.8), top = z + TCARD.h;
  const x0 = plan.x, y0 = plan.y;
  const inset = k.insetPlan(plan, 1.3);
  let inner = L(k.planOutline(inset, top, P, 3), { tone: "faint" });
  inner += topText(x0 + 3, y0 + 5.4, top, t.name, 2.6, "hi");
  inner += topText(x0 + plan.w - 3, y0 + 5.4, top, String(i + 1), 2.6, "mid", "end");
  inner += t.desc.map((line, n) => topText(x0 + 3, y0 + 9.4 + n * 3.2, top, line, 1.9, "mid", "start", ` data-desc="${i}-${n}"`)).join("");
  inner += L(k.lineOnTop([inset.x, y0 + 15.4], [inset.x + inset.w, y0 + 15.4], top, P), { tone: "faint" });
  // the schema stencil: one field slot, with a dot when the field is required
  const slot = { x: x0 + 3, y: y0 + 17.4, w: plan.w - 6, d: 6, r: 0.8 };
  inner += L(k.planOutline(slot, top, P, 2), { tone: "mid" });
  inner += topText(slot.x + 1.8, slot.y + 4, top, `${t.field}: ${t.type}`, 1.9, "hi");
  inner += `<g data-req="${i}">${Dt([at([slot.x + slot.w - 2.2, slot.y + slot.d / 2, top])], { size: 0.55, tone: "hi" })}</g>`;
  return S(k.slabOf(plan, z, TCARD.h, P, 3, 0.3), { tone: "hi", inner });
}
function questionCard() {
  const [cx, cy, z] = Q_HOME, plan = box(cx, cy, QCARD.w, QCARD.d, 0.8), top = z + QCARD.h;
  const inner = L(k.planOutline(k.insetPlan(plan, 1.3), top, P, 3), { tone: "faint" }) +
    topText(plan.x + 3, plan.y + 4.4, top, "role: user", 1.9, "lo") +
    [0, 1].map((n) => topText(plan.x + 3, plan.y + 8.6 + n * 4.2, top, QUESTIONS[0].lines[n], 2.7, "hi", "start", ` data-qline="${n}"`)).join("");
  return S(k.slabOf(plan, z, QCARD.h, P, 3, 0.3), { tone: "hi", inner });
}
function slip(kind, home) {
  const [cx, cy, z] = home, plan = box(cx, cy, SLIP.w, SLIP.d, 0.6), top = z + SLIP.h;
  const inner = topText(plan.x + 2.6, plan.y + 4.6, top, "", 2.2, kind === "ans" ? "hi" : "mid", "start", ` data-${kind}="0"`) +
    topText(plan.x + 2.6, plan.y + 9.4, top, "", 2.2, "hi", "start", ` data-${kind}="1"`);
  return S(k.slabOf(plan, z, SLIP.h, P, 2), { tone: "hi", crease: "none", inner });
}

// ---------- assemble ----------
const part = (id, svg, extra = "") => `<g data-part="${id}"${extra}>${svg}</g>`;
const FIGURE_LABEL = "A dispatch counter split by a low wall with one slot. Behind the wall, the model's side: a sealed booth labelled model, with a selector dial and a thinking lamp on top and an output slot in front, and a desk labelled context. In front of the wall, the app's side: a rack of three tool cards (lookup_order, search_docs and calculate), each with a description and a schema slot, a user tray holding the question, and a cabinet of functions with three drawers and a cable to an orders database. The cards and question cross to the desk, the booth's dial turns to a tool and it punches a call slip, the slip crosses to the cabinet, which runs the function, a result slip crosses back to the desk, and the booth punches the answer, which crosses to the user tray.";

const BODY = [
  plate(),
  part("context", desk()),
  part("model", runout() + booth()),
  part("selector", selector()),
  part("slot", wall()),
  part("declarations", rack()),
  part("functions", cabinet() + [0, 1, 2].map((row) => `<g data-drawerbody="${row}"></g><g data-drawer="${row}">${drawer(row)}</g>`).join("") + cable() + database()),
  part("question", userTray()),
  `<g data-fly>` +
    [0, 1, 2].map((i) => `<g data-part="declarations" data-tcard="${i}">${toolCard(i)}</g>`).join("") +
    `<g data-part="question" data-qcard>${questionCard()}</g>` +
    `<g data-part="result" data-res>${slip("res", RES_CAB)}</g>` +
    `<g data-part="call" data-call>${slip("call", CALL_RUN)}</g>` +
    `<g data-part="answer" data-ans>${slip("ans", ANS_RUN)}</g>` +
  `</g>`,
];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });

// ---------- steps and parts ----------
const STEPS = [
  { say: "ready · 3 tools declared, 1 question", next: "Send the request" },
  { say: "request · tools + question → model", next: "Let it choose" },
  { say: "choose", next: "Write the call" },
  { say: "call", next: "App runs it" },
  { say: "run", next: "Send the result" },
  { say: "result", next: "Write the answer" },
  { say: "answer", next: "Ask another" },
];
const PARTS = [
  { id: "declarations", step: 1, title: "Tool declarations", fact: "tools · name + description + input_schema", text: "The app declares each tool on a card: a name, a description in plain words, and a JSON schema for its arguments (here one field each). The cards travel with every request, alongside the question. They are only descriptions: the code behind them stays in the app's cabinet. Switch to vague descriptions and watch the model pick the wrong card." },
  { id: "question", step: 1, title: "Question", fact: "messages · role user", text: "What the user asked. It goes to the model together with the tool cards, and the final answer comes back to the same tray." },
  { id: "context", step: 1, title: "Context desk", fact: "context · all the model can see", text: "Everything the model reads lies on this desk: the tool cards, the question and, later, the tool result. The model has no other view of the world. If something isn't on the desk, the model doesn't know it." },
  { id: "model", step: 2, title: "Model", fact: "model · writes JSON or text, runs nothing", text: "The booth has no cable and no hands. It can only write: either a call slip (a tool name and arguments, as JSON) or plain text. When it writes a call, it stops and waits; the app decides whether to run it." },
  { id: "selector", step: 2, title: "Selector dial", fact: "choice · tool 1, 2, 3 or text", text: "The model's choice, made by reading the names and descriptions on the cards against the question. Stops 1–3 match the cards' corner numbers; TXT means no tool, just an answer. A question that needs no tool, or one missing a required argument, turns the dial to TXT." },
  { id: "call", step: 3, title: "Call slip", fact: "tool_use · name + input that fits the schema", text: "The structured call: the chosen tool's name and its arguments. The schema shapes it: the field is named order_id because the card says so, and the value is a string because the type says string. Make order_id optional and ask “Where is my order?”: an empty {} fits the schema too, and the model sends it." },
  { id: "slot", step: 3, title: "The slot", fact: "only JSON and text cross", text: "The only way between the two sides. Paper goes through it, never a hand: the model's call is a request the app can read, check, refuse or run. The guardrail figure shows the check: a call that fails validation goes back to the model with its error." },
  { id: "functions", step: 4, title: "Function cabinet", fact: "app · runs the real function", text: "The app's own code, one drawer per tool, wired to the app's systems (here an orders database). It reads the call slip, runs the function with those arguments and writes down what came back, including errors. This is the only part of the counter that does anything." },
  { id: "result", step: 5, title: "Result slip", fact: "tool_result · goes back to the model", text: "What the function returned, sent back to the model as a tool result tied to the call. It lands on the desk next to the question, so the model can read it. An error goes back the same way: the model can explain it, but not fix the function." },
  { id: "answer", step: 6, title: "Answer", fact: "text · written from the result", text: "The model reads the question and the result and writes the final answer in plain text. It can only be as right as the tool it chose: with the wrong tool, the answer is fluent and wrong." },
];

const unit = (vector) => { const o = at([0, 0, 0]); const p = at(vector); return [p[0] - o[0], p[1] - o[1]]; };
const DATA = {
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  P, steps: STEPS, tools: TOOLS, questions: QUESTIONS, scenarios: SCENARIOS,
  parts: Object.fromEntries(PARTS.map(({ id, step, fact }) => [id, { step, fact }])),
  rack: [0, 1, 2].map(rackSeat), desk: [0, 1, 2].map(deskSeat), qHome: Q_HOME, qDesk: Q_DESK,
  callRun: CALL_RUN, callCab: CALL_CAB, resCab: RES_CAB, resDesk: RES_DESK, ansRun: ANS_RUN, ansUser: ANS_USER, slot: SLOT_PT,
  dial: DIAL, knobR: KNOB_R, knobZ: KNOB_Z[1], stops: STOP_A,
  drawerOf: DRAWER_OF, drawerZ: DRAWER_Z, drawerOut: DRAWER_OUT, front: drawerFront(0),
};

const live = `
const D = ${JSON.stringify(DATA)};
const LAST = D.steps.length - 1;
const stage = ROOT.querySelector(".iso-stage");
const readout = ROOT.querySelector("[data-readout]");
const liveText = ROOT.querySelector("[data-live]");
const prev = ROOT.querySelector("[data-prev]");
const next = ROOT.querySelector("[data-next]");
const dots = [...ROOT.querySelectorAll("[data-dot]")];
const items = [...ROOT.querySelectorAll("[data-select]")];
const askButton = ROOT.querySelector("[data-ask]");
const vagueButton = ROOT.querySelector("[data-vague]");
const reqButton = ROOT.querySelector("[data-required]");
const logEl = ROOT.querySelector("[data-log]");
const whyEl = ROOT.querySelector("[data-why]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const sorted = (sel, key) => [...stage.querySelectorAll(sel)].sort((a, b) => a.dataset[key] - b.dataset[key]);
const tcards = sorted("[data-tcard]", "tcard");
const descs = [...stage.querySelectorAll("[data-desc]")];
const reqDots = sorted("[data-req]", "req");
const qcard = stage.querySelector("[data-qcard]");
const qlines = sorted("[data-qline]", "qline");
const callEl = stage.querySelector("[data-call]"), resEl = stage.querySelector("[data-res]"), ansEl = stage.querySelector("[data-ans]");
const callT = sorted("[data-call]:not(g)", "call"), resT = sorted("[data-res]:not(g)", "res"), ansT = sorted("[data-ans]:not(g)", "ans");
const pointerEl = stage.querySelector("[data-pointer]");
const thinkEl = stage.querySelector("[data-think] .iso-solid");
const runLampEl = stage.querySelector("[data-runlamp] .iso-solid");
const drawers = sorted("[data-drawer]", "drawer");
const drawerBodies = sorted("[data-drawerbody]", "drawerbody");
const groups = [...stage.querySelectorAll("[data-part]")];

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const shift = (dx, dy, dz) => [D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz, D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz];
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };
const setO = (el, o) => { const v = o >= 0.999 ? "" : o.toFixed(2); if (el._o !== v) { el._o = v; el.style.opacity = v; } };
const setLit = (el, on) => { if (!!el._lit === on) return; el._lit = on; on ? el.setAttribute("data-lit", "") : el.removeAttribute("data-lit"); };
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.002 ? target : nx; };
const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
// a path through the slot: from a to the slot, then on to b, with a small hop over each leg
function viaSlot(a, b, t) {
  const f = ease(t), s = D.slot;
  const p = f < 0.5 ? lerp3(a, s, f * 2) : lerp3(s, b, f * 2 - 1);
  const leg = f < 0.5 ? f * 2 : f * 2 - 1;
  return [p[0], p[1], p[2] + Math.sin(Math.PI * leg) * 9];
}
const moveTo = (el, home, p) => setT(el, shift(p[0] - home[0], p[1] - home[1], p[2] - home[2]));
const json = (o) => JSON.stringify(o);
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

let qi = 0, vague = 0, required = 1, step = 0, selected = null;
let touring = !still.matches, tourClock = 0, tourLap = 0, idleTimer = 0, visible = false, frame = 0, last = 0;
let decl = 0, qd = 0, dialA = D.stops[0], call = 0, run = 0, res = 0, ans = 0, emerge = 0;
const O = () => D.scenarios["" + qi + vague + required];
const hasCall = () => O().tool >= 0;

function goals() {
  const o = O(), t = hasCall();
  return {
    decl: step >= 1 ? 1 : 0,
    dial: step >= 2 ? D.stops[t ? o.tool + 1 : 4] : D.stops[0],
    call: t && step >= 3 ? (step >= 4 ? 2 : 1) : 0,
    run: t && step === 4 ? 1 : 0,
    res: t && step >= 4 ? (step >= 5 ? 2 : 1) : 0,
    ans: step >= 6 ? 1 : 0,
  };
}

function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }
function stepText(n) {
  const o = O(), t = hasCall(), name = t ? D.tools[o.tool].name : "";
  if (n === 0) return D.steps[0].say;
  if (n === 1) return "request · 3 tools + “" + short(D.questions[qi].q, 26) + "”";
  if (n === 2) return t ? "choose · tool " + (o.tool + 1) + ", " + name : "choose · no tool, it answers in text";
  if (n === 3) return t ? "tool_use · " + name + " " + json(o.input) : "no call · nothing for the app to run";
  if (n === 4) return t ? "app runs " + name + "() · the model waits" : "nothing to run";
  if (n === 5) return t ? "tool_result · " + short(json(o.result), 34) : "no result";
  return "answer · " + o.verdict;
}

function fillText() {
  const o = O(), t = hasCall();
  qlines.forEach((el, n) => (el.textContent = D.questions[qi].lines[n]));
  descs.forEach((el) => { const [i, n] = el.dataset.desc.split("-").map(Number); el.textContent = D.tools[i][vague ? "vague" : "desc"][n]; });
  setO(reqDots[0], required ? 1 : 0);
  callT[0].textContent = t ? "tool_use · " + D.tools[o.tool].name : "";
  callT[1].textContent = t ? short(json(o.input), 34) : "";
  resT[0].textContent = t ? "tool_result" : "";
  resT[1].textContent = t ? short(json(o.result), 34) : "";
  const lines = ["", ""];
  for (const w of o.answer.split(" ")) { const n = lines[1] || (lines[0] + " " + w).trim().length > 32 ? 1 : 0; lines[n] = (lines[n] + " " + w).trim(); }
  lines[1] = short(lines[1], 33);
  ansT[0].textContent = lines[0]; ansT[1].textContent = lines[1];
  whyEl.innerHTML = "<b>" + o.verdict + ".</b> " + o.why;
  fillLog();
}

// the same exchange as the messages an app and a model API would trade (shaped like the Claude Messages API)
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function fillLog() {
  const o = O(), t = hasCall();
  const tools = D.tools.map((tool, i) => '  { "name": "' + tool.name + '", "description": "' + (vague ? tool.vagueDesc : tool.schemaDesc) + '",\\n    "input_schema": { "type": "object", "properties": { "' + tool.field + '": { "type": "string" } }' + (i === 0 && !required ? "" : ', "required": ["' + tool.field + '"]') + " } }").join(",\\n");
  const blocks = [
    { at: 1, who: "app → model", text: '"tools": [\\n' + tools + '\\n],\\n"messages": [{ "role": "user", "content": ' + json(D.questions[qi].q) + " }]" },
    t
      ? { at: 3, who: "model → app", text: '"stop_reason": "tool_use",\\n"content": [{ "type": "tool_use", "id": "call_1", "name": "' + D.tools[o.tool].name + '", "input": ' + json(o.input) + " }]" }
      : { at: 6, who: "model → app", text: '"stop_reason": "end_turn",\\n"content": [{ "type": "text", "text": ' + json(o.answer) + " }]" },
  ];
  if (t) {
    blocks.push({ at: 4, who: "app, not the model", text: D.tools[o.tool].name + "(" + Object.entries(o.input).map(([k, v]) => k + "=" + json(v)).join(", ") + ")  →  " + json(o.result) });
    blocks.push({ at: 5, who: "app → model", text: '"messages": [ …, { "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "call_1", "content": ' + json(json(o.result)) + " }] }]" });
    blocks.push({ at: 6, who: "model → app", text: '"stop_reason": "end_turn",\\n"content": [{ "type": "text", "text": ' + json(o.answer) + " }]" });
  }
  logEl.innerHTML = blocks.map((b) => '<div class="pc-msg" data-at="' + b.at + '"><span class="pc-who">' + b.who + '</span><pre>' + esc(b.text) + "</pre></div>").join("");
  markLog();
}
function markLog() {
  [...logEl.children].forEach((el) => { const a = Number(el.dataset.at); el.toggleAttribute("data-on", a === step || (a === 1 && step === 2) ); el.toggleAttribute("data-later", a > step); });
}

function setStep(n) {
  n = Math.max(0, Math.min(LAST, n));
  if (n === step) return;
  step = n;
  controls();
  markLog();
  if (!touring) announce(stepText(step));
  run_();
}
// with no call, the app has nothing to run: skip from the choice straight to the answer
const stepFwd = (s) => (!hasCall() && s >= 2 && s < LAST ? LAST : s + 1);
const stepBack = (s) => (!hasCall() && s === LAST ? 2 : s - 1);

function setScenario(nqi, nv, nr, { keepStep = true } = {}) {
  const changed = nqi !== qi;
  qi = nqi; vague = nv; required = nr;
  fillText();
  if (changed) step = 0; else if (keepStep && step > 2) step = 2; else if (step < 2) step = 2;
  controls();
  run_();
}
function ask() { hold(); select(null); setScenario((qi + 1) % D.questions.length, vague, required); announce("question · “" + D.questions[qi].q + "”"); }
function toggleVague() { hold(); setScenario(qi, vague ? 0 : 1, required); announce((vague ? "vague" : "clear") + " descriptions · " + stepText(step)); }
function toggleRequired() { hold(); setScenario(qi, vague, required ? 0 : 1); announce("order_id " + (required ? "required" : "optional") + " · " + stepText(step)); }

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
  const skip = !hasCall();
  dots.forEach((dot, index) => { const s = index + 1; dot.toggleAttribute("data-on", s <= step); dot.toggleAttribute("data-skip", skip && s >= 3 && s <= 5); });
  stage.setAttribute("aria-valuenow", String(step));
  stage.setAttribute("aria-valuetext", stepText(step));
  vagueButton.setAttribute("aria-pressed", String(!!vague));
  vagueButton.querySelector("span").textContent = vague ? "vague" : "clear";
  reqButton.setAttribute("aria-pressed", String(!required));
  reqButton.querySelector("span").textContent = required ? "required" : "optional";
}

function update(dt, calm) {
  const g = goals();
  let busy = false;
  const go = (x, target, rate) => { const nx = calm ? target : follow(x, target, rate, dt); if (nx !== target) busy = true; return nx; };
  decl = go(decl, g.decl, 2.2);
  dialA = go(dialA, g.dial, 4);
  call = go(call, g.call, 2.4);
  run = go(run, g.run, 3);
  res = go(res, g.res, 2.4);
  ans = go(ans, g.ans, 2.2);
  return busy;
}

function place() {
  const o = O(), t = hasCall();
  // tool cards and the question ride from the app's side to the desk, staggered
  tcards.forEach((el, i) => moveTo(el, D.rack[i], viaSlot(D.rack[i], D.desk[i], clamp01(decl * 1.3 - i * 0.1))));
  moveTo(qcard, D.qHome, viaSlot(D.qHome, D.qDesk, clamp01(decl * 1.3 - 0.3)));
  tcards.forEach((el, i) => setLit(el.querySelector(".iso-solid"), step >= 2 && t && o.tool === i && Math.abs(dialA - D.stops[i + 1]) < 0.05));
  // the dial
  const a = dialA, [cx, cy] = D.dial;
  pointerEl.setAttribute("d", lineOnTop([cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.2], [cx + Math.cos(a) * (D.knobR - 0.6), cy + Math.sin(a) * (D.knobR - 0.6)], D.knobZ, D.P));
  // the call slip: out of the booth onto the run-out, then through the slot to the cabinet's in-tray
  const cIn = clamp01(call), cOver = clamp01(call - 1);
  const cp = cOver > 0 ? viaSlot(D.callRun, D.callCab, cOver) : [D.callRun[0], D.callRun[1] - 6 * (1 - ease(cIn)), D.callRun[2]];
  moveTo(callEl, D.callRun, cp);
  setO(callEl, t ? (cOver > 0 ? (step >= 5 ? clamp01(1 - (res - 1) * 1.6) : 1) : ease(cIn)) : 0);
  // the drawer of the chosen tool slides out while it runs
  const row = t ? D.drawerOf.indexOf(o.tool) : -1;
  drawers.forEach((el, r) => {
    const e = r === row ? ease(run) * D.drawerOut : 0;
    setT(el, shift(0, e, 0));
    const key = e.toFixed(1);
    if (drawerBodies[r]._k !== key) {
      drawerBodies[r]._k = key;
      const [z0, z1] = D.drawerZ[r], f = D.front;
      drawerBodies[r].innerHTML = e > 0.05 ? solidSvg(slabOf({ x: f.x + 1.5, y: f.y, w: f.w - 3, d: e, r: 0.3 }, z0 + 0.6, z1 - z0 - 1.2, D.P, 1), { tone: "mid" }) : "";
    }
  });
  // the result slip: up out of the cabinet's slot once the function has run, then over to the desk
  const rUp = clamp01(res), rOver = clamp01(res - 1);
  const rp = rOver > 0 ? viaSlot(D.resCab, D.resDesk, rOver) : [D.resCab[0], D.resCab[1], D.resCab[2] - 2 * (1 - ease(rUp))];
  moveTo(resEl, D.resCab, rp);
  setO(resEl, t ? ease(clamp01(rUp * 2 - 1)) : 0);
  // the answer: out of the booth, then through the slot to the user
  const aOut = clamp01(ans * 2.2), aOver = clamp01(ans * 1.3 - 0.3);
  const ap = aOver > 0 ? viaSlot(D.ansRun, D.ansUser, aOver) : [D.ansRun[0], D.ansRun[1] - 6 * (1 - ease(aOut)), D.ansRun[2]];
  moveTo(ansEl, D.ansRun, ap);
  setO(ansEl, ease(aOut));
  // lamps: the model works while choosing, writing a call and writing the answer; the cabinet while running
  setLit(thinkEl, step === 2 || (step === 3 && t) || (step === 6 && ans < 0.95));
  setLit(runLampEl, t && step === 4);
  const text = selected ? D.parts[selected].fact : stepText(step);
  if (readout.textContent !== text) readout.textContent = text;
}

// the idle tour: each question, then the failures the controls show
const TOUR = [[0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1], [0, 1, 1], [2, 0, 0]];
const BEAT = 2.4;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    tourClock += dt;
    if (tourClock >= BEAT) {
      tourClock = 0;
      if (step === LAST) {
        tourLap = (tourLap + 1) % TOUR.length;
        const [a, b, c] = TOUR[tourLap];
        qi = a; vague = b; required = c; step = 0; fillText(); controls(); markLog();
      } else setStep(stepFwd(step));
    }
  }
  const busy = update(dt, still.matches);
  place();
  frame = visible && (busy || touring) ? requestAnimationFrame(tick) : 0;
}
function run_() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

function hold() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (still.matches || selected || stage.matches(":hover, :focus-within") || ROOT.matches(":focus-within")) return hold();
    touring = true;
    tourClock = 0;
    run_();
  }, 9000);
}
const go = (n) => { hold(); setStep(n); };
const forward = () => { if (step === LAST) ask(); else go(stepFwd(step)); };
const back = () => go(stepBack(step));

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run_(); }, { rootMargin: "120px 0px" }).observe(stage);

const partAt = (target) => target.closest && target.closest("[data-part]");
stage.addEventListener("pointermove", (event) => { if (event.pointerType !== "mouse") return; hold(); const g = partAt(event.target); select(g ? g.dataset.part : null); });
stage.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
stage.addEventListener("click", (event) => { hold(); const g = partAt(event.target); if (!g) return select(null); if (event.pointerType !== "mouse") select(selected === g.dataset.part ? null : g.dataset.part); });
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: forward, ArrowDown: forward, ArrowLeft: back, ArrowUp: back, Home: () => go(0), End: () => go(LAST), " ": forward, Enter: forward, Escape: () => { hold(); select(null); }, q: ask, Q: ask, v: toggleVague, V: toggleVague, r: toggleRequired, R: toggleRequired };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
prev.addEventListener("click", back);
next.addEventListener("click", forward);
askButton.addEventListener("click", ask);
vagueButton.addEventListener("click", toggleVague);
reqButton.addEventListener("click", toggleRequired);
for (const item of items) {
  const id = item.dataset.select;
  item.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") { hold(); select(id); } });
  item.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
  const pickPart = () => { hold(); select(id); let s = D.parts[id].step; if (!hasCall() && s >= 3 && s <= 5) s = id === "slot" ? 2 : s; setStep(s); };
  item.addEventListener("click", pickPart);
  item.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pickPart(); } });
  item.addEventListener("focus", () => { hold(); select(id); });
  item.addEventListener("blur", () => select(null));
}
fillText();
update(0, true);
controls();
place();
`;

const plateBody = k.plateHtml({
  fig: "Fig 8",
  title: "Tool calling · one call",
  hint: "← → step · Q question · V vague · R required · F expand",
  readout: STEPS[0].say,
  keys: [
    { mark: "lit", label: "The card the model chose, and the lamp of whoever is working" },
    { mark: "raised", label: "The wall: only paper (JSON and text) crosses it" },
  ],
  caption: "One tool call. The app declares three tools (name, description, JSON schema) and sends them with the question. The model chooses one and writes a structured call instead of text; the app, not the model, runs the function and sends the result back as a tool result; the model writes the answer from it. The questions, choices and results are scripted toy examples, one behaviour each, not a live model. Real models also weigh names, examples and earlier turns.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Tool calling. Arrow keys step through one call; Q asks the next question; V switches the tool descriptions between clear and vague; R makes order_id required or optional; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="${STEPS[0].say}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Back one step" disabled>←</button><span class="pc-dots" aria-hidden="true">${STEPS.slice(1).map(() => "<i data-dot></i>").join("")}</span><button type="button" class="pc-btn pc-right" data-ask aria-keyshortcuts="Q">Next question</button><button type="button" class="pc-btn" data-vague aria-pressed="false" aria-keyshortcuts="V" aria-label="Tool descriptions: clear or vague">descriptions <span>clear</span></button><button type="button" class="pc-btn" data-required aria-pressed="false" aria-keyshortcuts="R" aria-label="order_id: required or optional">order_id <span>required</span></button><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const extra = `<h4 style="margin:6px 0 0">What happened</h4><p class="pc-why" data-why aria-live="polite"></p><h4 style="margin:14px 0 0">The same exchange as messages</h4><p class="tip">Shaped like the Claude Messages API; other model APIs use similar fields under different names. The step you are on is marked; later messages are greyed.</p><div class="pc-log" data-log></div>`;
const CSS = `
.anatomy-embed [data-think] .iso-solid[data-lit]>.iso-fill,.anatomy-embed [data-think] .iso-solid[data-lit]>.iso-top,.anatomy-embed [data-think] .iso-solid[data-lit]>.iso-shade,
.anatomy-embed [data-runlamp] .iso-solid[data-lit]>.iso-fill,.anatomy-embed [data-runlamp] .iso-solid[data-lit]>.iso-top,.anatomy-embed [data-runlamp] .iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-lit)}
.anatomy-embed [data-think] .iso-solid>*,.anatomy-embed [data-runlamp] .iso-solid>*{transition:fill .3s}
.anatomy-embed [data-req]{transition:opacity .3s}
.anatomy-embed .pc-dots i[data-skip]{border-style:dashed;opacity:.5}
.anatomy-embed .pc-why{margin:4px 0 0;color:var(--text);font-size:.95rem}
.anatomy-embed .pc-log{display:grid;gap:8px;margin:6px 0 12px}
.anatomy-embed .pc-msg{border:1px solid var(--border);background:var(--surface);padding:8px 10px;min-width:0}
.anatomy-embed .pc-msg[data-on]{border-color:var(--text)}
.anatomy-embed .pc-msg[data-later]{opacity:.45}
.anatomy-embed .pc-who{display:block;font:11px var(--anatomy-mono);color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.anatomy-embed .pc-msg pre{margin:0;font:12px/1.5 var(--anatomy-mono);color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
`;
const html = embedHtml({ slug: "tool-calling", plate: plateBody, parts: partsHtml(PARTS, { extra }), css: CSS, task: "Step “Where is order 4417?” to the end. Then switch descriptions to vague and watch the dial turn to card 2: the answer is fluent and wrong. Switch back to clear and press Q twice for “Where is my order?”: with order_id required the model asks for the number; make it optional and it sends an empty call that fails in the app. Last, “Say thank you in French.” needs no tool at all.", live });
page("tool-calling", html, {
  title: "Anatomy of tool calling",
  lede: `A dispatch counter split by a wall: the app passes tool cards and a question through the slot, the model sends back a call slip instead of an answer, and only the app's cabinet runs anything. For checking a call before it runs, see <a href="../guardrail/">the guardrail</a>.`,
});
