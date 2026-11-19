// Anatomy of a full stack app: writes full-stack-app/index.html (light) and thumb.svg, or
// dark.html with --dark (not committed).
//
// A request rail. A carriage is the HTTP request: it leaves the browser, runs to a turntable (the
// router) that turns it onto the line for its route, waits at a gate that reads its session cookie
// (auth), stops at the handler, then at the cache box. On a miss it goes on to the ORM, which
// turns the call into SQL and sends it down a duct to the filing cabinet (the database); a drawer
// opens and is read by index or row by row. Then the carriage runs back with the response and the
// browser's screen draws the page. A stopwatch adds up the time; the switches change the outcome.
//
// Every number comes from model.mjs: toy timings with a real order of magnitude.
import { k, EXPAND_BUTTON, embedHtml, partsHtml, page } from "../tools/embed.mjs";
import { ROWS, USER, ORDERS, COST, HOPS, trace } from "./model.mjs";

// ---------- world ----------
const W = 640, H = 420;
const PLATE = { x: -162, y: -110, w: 312, d: 190, r: 9 };
const PLATE_H = 9, FOOT_H = 5;
const box = (cx, cy, w, d, r = 0.8) => ({ x: cx - w / 2, y: cy - d / 2, w, d, r });

// the rail: line A runs along y from the browser to the turntable, line B along x to the database
const GAUGE = 3.5; // half the distance between the two rails
const RAIL_Z = [1, 3]; // rails stand on sleepers 1 high; the carriage rides at z = 3
const TT = [-108, -50], TT_R = 12; // turntable (router)
const A_Y = [TT[1] + TT_R, 60]; // line A, y from the turntable's edge to the browser buffer
const B_X = [TT[0] + TT_R, 62]; // line B, x from the turntable's edge to the end buffer
const USERS_X = [-150, TT[0] - TT_R]; // stub to /api/users/:id
const LOGIN_Y = [-100, TT[1] - TT_R]; // stub to /login
// the carriage's path coordinate u: 0..108 along line A, 108..128 turning on the deck, then line B
const U_A = 108, U_TURN = 20;
const xOnB = (u) => TT[0] + (u - U_A - U_TURN);
const uAtX = (x) => U_A + U_TURN + (x - TT[0]);
const STOP = { browser: 0, table: U_A, turned: U_A + U_TURN, gate: uAtX(-89), handler: uAtX(-31), cache: uAtX(3), orm: uAtX(34) };

// stations behind line B
const GATE_X = -76, POSTS = [[GATE_X, -59], [GATE_X, -41]], BAR_Z = [5, 17];
const HANDLER = { x: -46, y: -94, w: 30, d: 30, r: 2 }, HANDLER_H = 18;
const CACHE = { x: -9, y: -88, w: 24, d: 22, r: 1.5 }, CACHE_H = 8;
const ORM = { x: 20, y: -94, w: 30, d: 30, r: 2 }, ORM_H = 12;
const DB = { x: 78, y: -106, w: 54, d: 50, r: 2 }, DB_Z = [2, 38];
const DRAWERS = [{ name: "orders", z: [26, 35] }, { name: "users", z: [15, 24] }, { name: "items", z: [4, 13] }];
const DRAWER_OUT = 20;
// the browser, front left
const MON = { x: -156, y: 30, w: 34, d: 9, r: 1.5 }, MON_Z = [10, 38];
const SCREEN = { x0: -153, x1: -125, z0: 13, z1: 35 };
const KEYS = { x: -156, y: 52, w: 32, d: 13, r: 1.2 };
// the stopwatch and the switch panel, front
const WATCH = [-50, 38], WATCH_R = 15, WATCH_Z = 7, WATCH_MAX = 150;
const WATCH_FROM = (-150 * Math.PI) / 180, WATCH_SPAN = (300 * Math.PI) / 180;
const PANEL = { x: -2, y: 14, w: 96, d: 42, r: 2 }, PANEL_H = 4;
const SW = { x0: 42, x1: 58 }; // switch slot ends
const ROW_Y = [24, 36, 48];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [DB.x, DB.y, DB_Z[1] + 6], [DB.x + DB.w, DB.y, DB_Z[1] + 6], [MON.x, MON.y, MON_Z[1] + 2]],
  W, H, { pad: 14, azimuth: 46 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(...a) - depth(...b));
const screws = (list, z, size = 0.45) => Dt(list.map(([x, y]) => at([x, y, z])), { size });
const topText = (x, y, z, text, size, tone = "mid", anchor = "start", extra = "", along = "x") => k.faceTextSvg(k.topMatrix([x, y], z, P, along), text, { size, tone, anchor }).replace("<text", `<text${extra}`);
// text on a face that looks toward +y ("left") or +x ("right")
const sideText = (x, y, z, text, size, tone = "mid", anchor = "start", face = "left", extra = "") => k.faceTextSvg(k.sideMatrix([x, y], z, P, face), text, { size, tone, anchor }).replace("<text", `<text${extra}`);
const faceRect = (x0, x1, y, z0, z1) => k.pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);
// a station lamp: a bezel and a lens that lights while its station works
const lamp = (x, y, z, id) => S(k.cylinder(x, y, 2, z, 0.7, P, 20), { tone: "mid" }) + `<g data-lamp="${id}">${S(k.cylinder(x, y, 1.3, z + 0.7, 1, P, 16), { tone: "hi" })}</g>`;

// ---------- bench plate ----------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const corners = k.corners(PLATE, 11);
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 2.3, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dt(corners.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // the split between the browser (client) and everything on the server, engraved in the plate
  const splitY = 4;
  out.push(L(k.lineOnTop([PLATE.x + 5, splitY], [PLATE.x + PLATE.w - 5, splitY], 0, P), { tone: "faint" }));
  out.push(topText(PLATE.x + PLATE.w - 9, splitY - 2.5, 0, "SERVER", 2.8, "lo", "end"));
  out.push(topText(PLATE.x + PLATE.w - 9, splitY + 5.5, 0, "CLIENT", 2.8, "lo", "end"));
  // where the rail crosses the split: the network
  out.push(topText(TT[0] + 9, splitY - 2.5, 0, "NETWORK · HTTP", 2.4, "lo"));
  // label plate, front right
  const label = { x: 104, y: 56, w: 40, d: 17, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(topText(label.x + 4.5, label.y + 7, 0.8, "SHOP · GET /api/orders", 2.3, "mid"));
  out.push(L([[11, 28], [14, 18]].map(([dy, len]) => k.lineOnTop([label.x + 4.5, label.y + dy], [label.x + 4.5 + len, label.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(screws([[label.x + 2.6, label.y + 2.6], [label.x + label.w - 2.6, label.y + label.d - 2.6]], 0.8, 0.4));
  return out.join("");
}

// ---------- rails ----------
function sleepersAlong(axis, at0, from, to) {
  const out = [];
  for (let s = from + 3; s <= to - 2; s += 8) {
    const plan = axis === "y" ? { x: at0 - 6, y: s - 1.2, w: 12, d: 2.4, r: 0.4 } : { x: s - 1.2, y: at0 - 6, w: 2.4, d: 12, r: 0.4 };
    out.push(S(k.slabOf(plan, 0, RAIL_Z[0], P, 1), { tone: "lo", crease: "none" }));
  }
  return out;
}
function railsAlong(axis, at0, from, to) {
  return [-GAUGE, GAUGE].map((off) => {
    const plan = axis === "y" ? { x: at0 + off - 0.7, y: from, w: 1.4, d: to - from, r: 0.3 } : { x: from, y: at0 + off - 0.7, w: to - from, d: 1.4, r: 0.3 };
    return S(k.slabOf(plan, RAIL_Z[0], RAIL_Z[1] - RAIL_Z[0], P, 1), { tone: "mid" });
  });
}
function buffer(axis, at0, s, dir) {
  // an end stop: a block across the line with two rubber pads facing the carriage
  const plan = axis === "y" ? { x: at0 - 6, y: s, w: 12, d: 3, r: 0.6 } : { x: s, y: at0 - 6, w: 3, d: 12, r: 0.6 };
  let pads = "";
  for (const off of byDepth([[-GAUGE, 0], [GAUGE, 0]]).map(([o]) => o)) {
    const [px, py] = axis === "y" ? [at0 + off, s + (dir < 0 ? -0.9 : 3.9)] : [s + (dir < 0 ? -0.9 : 3.9), at0 + off];
    pads += S(k.cylinder(px, py, 1, 2.2, 2.2, P, 12), { tone: "hi" });
  }
  const block = S(k.slabOf(plan, 0, 5.4, P, 2, 0.4), { tone: "mid" }) + screws([[plan.x + 1.5, plan.y + 1.5], [plan.x + plan.w - 1.5, plan.y + plan.d - 1.5]], 5.4, 0.4);
  return dir < 0 ? pads + block : block + pads;
}
function lineA() {
  return [...sleepersAlong("y", TT[0], A_Y[0], A_Y[1]), ...railsAlong("y", TT[0], A_Y[0], A_Y[1])].join("") + buffer("y", TT[0], A_Y[1], -1);
}
function lineB() {
  return [...sleepersAlong("x", TT[1], B_X[0], B_X[1]), ...railsAlong("x", TT[1], B_X[0], B_X[1])].join("") + buffer("x", TT[1], B_X[1], -1);
}
function stubs() {
  const out = [];
  // /login, behind the turntable, and /api/users/:id to its left: routes this request doesn't match
  out.push(buffer("y", TT[0], LOGIN_Y[0] - 3, 1), ...sleepersAlong("y", TT[0], LOGIN_Y[0], LOGIN_Y[1]), ...railsAlong("y", TT[0], LOGIN_Y[0], LOGIN_Y[1]));
  out.push(buffer("x", TT[1], USERS_X[0] - 3, 1), ...sleepersAlong("x", TT[1], USERS_X[0], USERS_X[1]), ...railsAlong("x", TT[1], USERS_X[0], USERS_X[1]));
  return out.join("");
}
// the route table, engraved beside each exit with a lamp for the one that matches
const ROUTES = [
  { id: "orders", text: "GET /api/orders", at: [-96, TT[1] + 16], along: "x", lampAt: [-98.5, TT[1] + 15.2] },
  { id: "users", text: "/api/users/:id", at: [-147, TT[1] + 12], along: "x", lampAt: [-149.5, TT[1] + 11] },
  { id: "login", text: "/login", at: [-95, LOGIN_Y[0] + 2], along: "y", lampAt: [-94, LOGIN_Y[0] - 1] },
];
function routeTable() {
  return ROUTES.map((r) => (r.along === "x" ? topText(r.at[0], r.at[1], 0, r.text, 2, "lo", "start", ` data-route="${r.id}"`) : topText(r.at[0] + 1, r.at[1] + 1, 0, r.text, 2.4, "lo", "start", ` data-route="${r.id}"`, "y"))).join("") +
    ROUTES.map((r) => S(k.cylinder(r.lampAt[0], r.lampAt[1], 1, 0, 0.6, P, 14), { tone: "mid" })).join("");
}

// ---------- turntable (router) ----------
function turntableBase() {
  const [cx, cy] = TT;
  const out = [S(k.cylinder(cx, cy, TT_R + 1.6, 0, 0.6, P, 48), { tone: "lo" })];
  out.push(S(k.cylinder(cx, cy, TT_R, 0.6, 0.4, P, 48), { tone: "mid" }));
  // a ring of index marks around the pit: one per 15 degrees, a major one at each exit
  const t = k.radialTicks(cx, cy, TT_R + 1.5, 24, 6, 0.6, [0.6, 1.2], P);
  out.push(L(t.minor, { tone: "faint" }), L(t.major, { tone: "lo" }));
  out.push(L(k.ring(cx, cy, TT_R + 1.5, 0.6, P, 48), { tone: "lo" }));
  return out.join("");
}

// ---------- gate (auth) ----------
function post([x, y]) {
  return S(k.slabOf(box(x, y, 5, 5, 0.6), 0, 1.4, P, 2), { tone: "lo" }) +
    S(k.cylinder(x, y, 1.5, 1.4, 20, P, 18), { tone: "mid" }) +
    S(k.cylinder(x, y, 2, 21.4, 1.2, P, 18), { tone: "mid" }) + Dt([at([x, y, 22.6])], { size: 0.4 });
}
function reader() {
  // the key reader on the near post: it reads the session cookie the carriage carries
  const plan = { x: GATE_X - 4, y: POSTS[1][1] + 1.5, w: 8, d: 3.2, r: 0.6 };
  const fy = plan.y + plan.d;
  const out = [S(k.slabOf(plan, 8, 7, P, 2, 0.3), { tone: "mid" })];
  out.push(L(faceRect(plan.x + 1.4, plan.x + plan.w - 1.4, fy, 12, 13.4), { tone: "lo" }));
  out.push(sideText(plan.x + 1.4, fy, 10.6, "AUTH", 1.8, "lo"));
  out.push(lamp(plan.x + plan.w - 2.2, plan.y + 1.6, 15, "auth"));
  return out.join("");
}
function bar() {
  const plan = { x: GATE_X + 1.6, y: POSTS[0][1] - 2, w: 2.2, d: 22, r: 0.4 };
  const z = BAR_Z[0];
  // striped like a barrier arm: bands painted across its top
  const bands = [3, 7, 11, 15, 19].map((dy) => k.lineOnTop([plan.x, plan.y + dy], [plan.x + plan.w, plan.y + dy], z + 2, P)).join("");
  return S(k.slabOf(plan, z, 2, P, 1), { tone: "hi", inner: L(bands, { tone: "mid" }) });
}

// ---------- handler (business logic) ----------
function handler() {
  const hp = HANDLER, top = HANDLER_H, fy = hp.y + hp.d;
  const out = [S(k.slabOf(hp, 0, top, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(hp, 4, P, 4), { tone: "faint" }) })];
  out.push(L(faceRect(hp.x + 3, hp.x + hp.w - 3, fy, 6, 15.4), { tone: "lo" }));
  out.push(sideText(hp.x + 4.6, fy, 8, "orders.index()", 2.3, "mid"));
  out.push(sideText(hp.x + 4.6, fy, 11.8, "HANDLER", 2, "lo"));
  // two meshing gears on top: the business rules turning
  for (const [x, y, r] of [[-36, -84, 5.4], [-26.6, -81.2, 3.8]]) {
    out.push(S(k.cylinder(x, y, r, top, 2.2, P, 32), { tone: "hi" }));
    out.push(L(k.knurl(x, y, r, top, top + 2.2, r > 5 ? 22 : 16, P), { tone: "lo" }));
    out.push(L(k.ring(x, y, r * 0.45, top + 2.2, P, 20), { tone: "faint" }));
    out.push(Dt([at([x, y, top + 2.2])], { size: 0.5 }));
  }
  out.push(topText(hp.x + 3.4, hp.y + hp.d - 3.6, top, "user from session", 1.9, "lo"));
  out.push(lamp(hp.x + hp.w - 5, hp.y + 6, top, "handler"));
  out.push(screws([[hp.x + 2.5, hp.y + 2.5], [hp.x + 2.5, hp.y + hp.d - 2.5], [hp.x + hp.w - 2.5, hp.y + hp.d - 2.5]], top, 0.4));
  return out.join("");
}

// ---------- cache box ----------
const KEY_CARDS = ["user:7", "cart:7", `orders:user:${USER}`];
const keyCard = (j) => ({ x: CACHE.x + 3, y: CACHE.y + 4 + j * 6, w: 20, d: 1.2, r: 0.2 });
function cacheBox() {
  const c = CACHE, fy = c.y + c.d;
  const out = [S(k.slabOf(c, 0, CACHE_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(c, 2.4, P, 3), { tone: "faint" }) })];
  out.push(L([0, 1, 2].map((j) => k.planOutline(k.insetPlan(keyCard(j), -0.5), CACHE_H, P, 2)).join(""), { tone: "lo" }));
  out.push(sideText(c.x + 3, fy, 5.6, "CACHE · redis", 2.2, "mid"));
  out.push(lamp(c.x + c.w - 3.4, c.y + c.d - 3.4, CACHE_H, "cache"));
  return out.join("");
}
function keyCardSvg(j) {
  const plan = keyCard(j), fy = plan.y + plan.d;
  return S(k.slabOf(plan, CACHE_H, 6, P, 1), { tone: "hi", inner: sideText(plan.x + 1.4, fy, CACHE_H + 4.4, KEY_CARDS[j], 2, "mid") });
}

// ---------- ORM ----------
function orm() {
  const o = ORM, top = ORM_H, fy = o.y + o.d;
  const out = [S(k.slabOf(o, 0, top, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(o, 3.4, P, 4), { tone: "faint" }) })];
  // the input window: the call the handler makes
  const win = { x: o.x + 3, y: o.y + 3, w: o.w - 6, d: 11, r: 0.8 };
  out.push(L(k.planOutline(win, top, P, 3), { tone: "lo" }));
  out.push(topText(win.x + 2.4, win.y + 4.6, top, "Order.where(", 2.3, "hi"));
  out.push(topText(win.x + 2.4, win.y + 8.6, top, `  user_id: ${USER})`, 2.3, "hi"));
  // the slot the SQL tape comes out of
  out.push(L(k.planOutline({ x: o.x + 2.4, y: o.y + 16.4, w: o.w - 4.8, d: 1.2, r: 0.4 }, top, P, 2), { tone: "lo" }));
  out.push(sideText(o.x + 4, fy, 6.6, "ORM", 2.6, "mid"));
  out.push(sideText(o.x + 4, fy, 10, "objects → SQL", 2, "lo"));
  out.push(lamp(o.x + o.w - 4, fy - 3.4, top, "orm"));
  out.push(screws([[o.x + 2.5, o.y + 2.5], [o.x + o.w - 2.5, o.y + 2.5]], top, 0.4));
  // the duct to the database: a connection from the pool, flush on both faces
  const duct = { x: o.x + o.w, y: o.y + 6, w: DB.x - o.x - o.w, d: 8, r: 0.5 };
  out.push(S(k.slabOf(duct, 5, 6, P, 2), { tone: "mid", inner: L([2, 6].map((dx) => k.pathOf([at([duct.x + dx, duct.y + duct.d, 5]), at([duct.x + dx, duct.y + duct.d, 11]), at([duct.x + dx, duct.y, 11])])).join(""), { tone: "lo" }) }));
  return out.join("");
}
function tape() {
  const plan = { x: ORM.x + 3, y: ORM.y + 17, w: ORM.w - 6, d: 10.4, r: 0.4 }, z = ORM_H, top = z + 0.4;
  return S(k.slabOf(plan, z, 0.4, P, 2), { tone: "hi", crease: "none", inner: topText(plan.x + 1.6, plan.y + 4, top, "SELECT * FROM orders", 1.7, "hi") + topText(plan.x + 1.6, plan.y + 7.8, top, `WHERE user_id = ${USER}`, 1.7, "hi") });
}

// ---------- database (filing cabinet) ----------
function cabinet() {
  const d = DB, fy = d.y + d.d, top = DB_Z[1];
  const out = [S(k.slabOf(k.insetPlan(d, -1.2), 0, DB_Z[0], P, 4, 0.4), { tone: "lo" })];
  out.push(S(k.slabOf(d, DB_Z[0], top - DB_Z[0], P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(d, top - 3, P, 4), { tone: "faint" }) }));
  // the right side: a vent row and the name plate
  const rx = d.x + d.w;
  out.push(L([0, 1, 2, 3, 4].map((j) => k.pathOf([at([rx, d.y + 10 + j * 4, 28]), at([rx, d.y + 10 + j * 4 + 2.2, 28]), at([rx, d.y + 10 + j * 4 + 2.2, 32]), at([rx, d.y + 10 + j * 4, 32])], true)).join(""), { tone: "lo" }));
  out.push(sideText(rx, fy - 6, 14, "DATABASE", 2.6, "mid", "start", "right"));
  out.push(sideText(rx, fy - 6, 18, `orders · ${ROWS.toLocaleString("en-US")} rows`, 2, "lo", "start", "right"));
  out.push(topText(d.x + 4, d.y + d.d - 4, top, "POSTGRES", 2.6, "mid"));
  out.push(lamp(d.x + d.w - 5, d.y + d.d - 5, top, "db"));
  out.push(screws(k.corners(d, 2.6).filter((_, i) => i !== 3), top, 0.45));
  // the closed drawer fronts (orders is drawn on its own, it opens)
  for (const dr of DRAWERS.slice(1)) out.push(drawerFront(dr, 0));
  return out.join("");
}
function drawerFront(dr, open) {
  const fy = DB.y + DB.d + open, plan = { x: DB.x + 4, y: fy, w: DB.w - 8, d: 1.6, r: 0.3 };
  const [z0, z1] = dr.z, face = fy + 1.6;
  const holder = faceRect(plan.x + 15, plan.x + 33, face, z1 - 3.8, z1 - 1);
  const inner = L(holder, { tone: "lo" }) + sideText(plan.x + 16.4, face, z1 - 3.1, dr.name, 1.9, "mid");
  return S(k.slabOf(plan, z0, z1 - z0, P, 1), { tone: "mid", inner }) +
    S(k.slabOf({ x: plan.x + 19, y: face, w: 10, d: 1.4, r: 0.4 }, z0 + 1.4, 1.6, P, 2), { tone: "hi" });
}
function indexBox() {
  // the index on orders.user_id: a small card index on the cabinet, sorted by user
  const plan = { x: DB.x + 5, y: DB.y + 6, w: 26, d: 16, r: 1 }, z = DB_Z[1], top = z + 5;
  const tabs = L([3, 6, 9, 12].map((dy) => k.lineOnTop([plan.x, plan.y + dy], [plan.x + plan.w, plan.y + dy], top, P)).join(""), { tone: "lo" });
  return S(k.slabOf(plan, z, 5, P, 3, 0.4), { tone: "mid", inner: tabs + sideText(plan.x + 2, plan.y + plan.d, z + 3.4, "INDEX user_id", 2, "mid") });
}

// ---------- browser ----------
function browser() {
  const m = MON, fy = m.y + m.d;
  const out = [S(k.slabOf({ x: m.x + 9, y: m.y + 1, w: 16, d: 12, r: 1.2 }, 0, 1.4, P, 3, 0.3), { tone: "lo" })];
  out.push(S(k.slabOf({ x: m.x + 15, y: m.y + 2, w: 4, d: 3, r: 0.4 }, 1.4, MON_Z[0] - 1.4, P, 1), { tone: "mid" }));
  const sc = SCREEN;
  const glass = L(faceRect(sc.x0, sc.x1, fy, sc.z0, sc.z1), { tone: "hi" }) + L(k.pathOf([at([sc.x0, fy, sc.z1 - 3.6]), at([sc.x1, fy, sc.z1 - 3.6])]), { tone: "lo" });
  out.push(S(k.slabOf(m, MON_Z[0], MON_Z[1] - MON_Z[0], P, 3, 0.6), { tone: "mid", inner: glass }));
  // the address bar and four content lines, written by the page
  out.push(sideText(sc.x0 + 1.4, fy, sc.z1 - 2.4, "shop.app/orders", 1.8, "lo"));
  out.push([0, 1, 2, 3].map((n) => sideText(sc.x0 + 1.6, fy, sc.z1 - 7 - n * 4, ["My orders", "[ load ]", "", ""][n], 2.4, n ? "mid" : "hi", "start", "left", ` data-screen="${n}"`)).join(""));
  out.push(topText(m.x + 2, m.y + 4.6, MON_Z[1], "BROWSER", 2.2, "lo"));
  // keyboard, with the enter key that sends the request
  const kb = KEYS;
  out.push(S(k.slabOf(kb, 0, 2, P, 3, 0.4), { tone: "mid" }));
  out.push(Dt(k.dotGrid(kb.x + 2.6, kb.y + 2.6, 10, 3, 2.6, 2, P), { size: 0.45, tone: "lo" }));
  out.push(`<g data-enter>${S(k.slabOf({ x: kb.x + kb.w - 6, y: kb.y + kb.d - 5, w: 4.4, d: 3.4, r: 0.5 }, 2, 0.9, P, 2), { tone: "hi" })}</g>`);
  out.push(lamp(kb.x + 3, kb.y + kb.d - 2.6, 2, "browser"));
  return out.join("");
}

// ---------- stopwatch ----------
const watchAngle = (ms) => WATCH_FROM + (WATCH_SPAN * Math.min(ms, WATCH_MAX)) / WATCH_MAX;
function watch() {
  const [cx, cy] = WATCH, z = WATCH_Z;
  const out = [S(k.cylinder(cx, cy, WATCH_R + 2.4, 0, 1.6, P, 48), { tone: "lo" })];
  // the crown at twelve o'clock, behind the case
  out.push(S(k.cylinder(cx, cy - WATCH_R - 1.4, 1.8, 3, 3, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy - WATCH_R - 3, 2.4, 3.2, 2.6, P, 18), { tone: "hi" }) + L(k.knurl(cx, cy - WATCH_R - 3, 2.4, 3.2, 5.8, 14, P), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, WATCH_R, 1.6, z - 1.6, P, 48, 0.4), { tone: "mid" }));
  out.push(L(k.ring(cx, cy, WATCH_R - 1.4, z, P, 48), { tone: "lo" }));
  const t = k.radialTicks(cx, cy, WATCH_R - 1.4, 15, 5, z, [1, 2.2], P, WATCH_FROM, WATCH_SPAN);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  for (const ms of [0, 50, 100, 150]) {
    const a = watchAngle(ms), r = WATCH_R - 5.4;
    out.push(topText(cx + Math.sin(a) * r, cy - Math.cos(a) * r + 1, z, String(ms), 2.2, "mid", "middle"));
  }
  out.push(topText(cx, cy + 6.4, z, "ms", 2.2, "lo", "middle"));
  out.push(`<path class="iso-line" data-tone="lit" data-needle data-free="end" style="stroke-width:1.1" d="${needle(0)}"/>`);
  out.push(Dt([at([cx, cy, z])], { size: 0.7, tone: "hi" }));
  out.push(topText(cx, cy + WATCH_R + 6.4, 0, "STOPWATCH", 2.4, "lo", "middle"));
  return out.join("");
}
function needle(ms) {
  const [cx, cy] = WATCH, a = watchAngle(ms), r = WATCH_R - 2;
  return k.lineOnTop([cx, cy], [cx + Math.sin(a) * r, cy - Math.cos(a) * r], WATCH_Z, P);
}

// ---------- switch panel ----------
function panel() {
  const p = PANEL, top = PANEL_H;
  const out = [S(k.slabOf(p, 0, top, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(p, 1.4, P, 4), { tone: "faint" }) })];
  const rows = [
    { name: "SESSION", sub: "cookie", ends: ["OK", "EXPIRED"] },
    { name: "INDEX", sub: "orders.user_id", ends: ["ON", "OFF"] },
  ];
  rows.forEach((r, i) => {
    const y = ROW_Y[i];
    out.push(topText(p.x + 4, y + 1, top, r.name, 2.6, "mid"));
    out.push(topText(p.x + 4, y + 4.2, top, r.sub, 1.9, "lo"));
    out.push(L(k.planOutline({ x: SW.x0 - 2.4, y: y - 1.2, w: SW.x1 - SW.x0 + 4.8, d: 2.4, r: 1 }, top, P, 3), { tone: "lo" }));
    out.push(topText(SW.x0 - 5.4, y + 1, top, r.ends[0], 2.2, "hi", "end", ` data-end="${i}:0"`));
    out.push(topText(SW.x1 + 4, y + 1, top, r.ends[1], 2.2, "lo", "start", ` data-end="${i}:1"`));
  });
  // the flush button for the cache
  const y = ROW_Y[2];
  out.push(topText(p.x + 4, y + 1, top, "CACHE", 2.6, "mid"));
  out.push(topText(p.x + 4, y + 4.2, top, "flush it empty", 1.9, "lo"));
  out.push(S(k.cylinder(SW.x0 + 8, y, 3.2, top, 0.8, P, 24), { tone: "lo" }));
  out.push(topText(SW.x1 + 4, y + 1, top, "", 2.2, "lo", "start", " data-cachestate"));
  out.push(screws(k.corners(p, 2.4), top, 0.45));
  return out.join("");
}
function knob(i) {
  const y = ROW_Y[i];
  return S(k.slabOf(box(SW.x0, y, 4, 4, 0.8), PANEL_H, 2.6, P, 3, 0.4), { tone: "hi" }) + L(k.lineOnTop([SW.x0 - 1, y], [SW.x0 + 1, y], PANEL_H + 2.6, P), { tone: "lo" }) + screws([[SW.x0 - 1, y], [SW.x0 + 1, y]], PANEL_H + 2.6, 0.3);
}
function flush() {
  const [x, y] = [SW.x0 + 8, ROW_Y[2]];
  return S(k.cylinder(x, y, 2.4, PANEL_H + 0.8, 1.6, P, 24), { tone: "hi" }) + L(k.ring(x, y, 1.2, PANEL_H + 2.4, P, 16), { tone: "lo" });
}

// ---------- assemble ----------
const part = (id, svg, extra = "") => `<g data-part="${id}"${extra}>${svg}</g>`;
const FIGURE_LABEL =
  "A request rail on a bench. At the front left, a browser with a screen and a keyboard sends a small carriage, the HTTP request, along a rail to a turntable, the router, which turns it onto the line for GET /api/orders; two other lines lead to /login and /api/users. The carriage waits at a barrier whose key reader checks the session cookie, then stops at the handler, a housing with gears, and at the cache, a box of key cards. On a miss it goes on to the ORM, which prints the SQL on a tape and sends it down a duct to a filing cabinet, the database, whose orders drawer slides open and is read. Then the carriage runs back and the screen shows the orders. A stopwatch at the front adds up the milliseconds, and a panel holds a session switch, an index switch and a cache flush button.";


// ---------- steps and parts ----------
const STEPS = [
  { id: "click", next: "Send the request" },
  { id: "request", next: "Route it" },
  { id: "route", next: "Check the session" },
  { id: "auth", next: "Run the handler" },
  { id: "handler", next: "Ask the cache" },
  { id: "cache", next: "Build the query" },
  { id: "orm", next: "Run the query" },
  { id: "db", next: "Send the response" },
  { id: "response", next: "Render the page" },
  { id: "render", next: "Send it again" },
];
const PARTS = [
  { id: "browser", step: 0, title: "Browser (frontend)", fact: "browser · sends requests, draws the page", text: "The frontend: the page the user sees and the code that runs in their browser. A click doesn't read the database; it sends an HTTP request to the server and waits. When the response comes back, the frontend turns the data into what is on the screen. The screen here shows what it would draw." },
  { id: "request", step: 1, title: "HTTP request and response", fact: `request · GET /api/orders + cookie · ~${COST.request} ms each way`, text: `The carriage is the request: a method and a path (GET /api/orders), headers, and the session cookie the browser stored when the user signed in. It crosses the network to the server, and the response crosses back on the same rail with a status code (200, 401, …) and a body, here JSON. The ${COST.request} ms each way is a toy figure for a nearby server; across an ocean it is closer to 100.` },
  { id: "router", step: 2, title: "Router", fact: "router · matches method + path to a handler", text: "Looks at the method and the path and picks the code that handles it, like a turntable sending the carriage onto one line. GET /api/orders goes to orders.index; /login and /api/users/:id are other lines. A request no route matches gets 404. It is fast: a lookup in a table of routes." },
  { id: "auth", step: 3, title: "Auth (middleware)", fact: "auth · who is asking? · runs before the handler", text: "Middleware that runs before the handler. It reads the session cookie and looks the session up to learn who is asking (user 7). If the session has expired or is missing, it stops the request right here with 401 Unauthorized and the handler never runs. Flip the session switch to EXPIRED to see the barrier stay down." },
  { id: "handler", step: 4, title: "Handler (business logic)", fact: "handler · orders.index for the signed-in user", text: "The app's own rules for this route: list the orders of the user auth found, newest first, never anyone else's. Taking user_id from the session, not from the URL, is what stops user 7 from reading user 8's orders. The handler asks the cache first and only goes to the database if it has to." },
  { id: "cache", step: 5, title: "Cache", fact: `cache · key orders:user:${USER} · ~${COST.cache} ms`, text: `A fast key-value store in memory (Redis here). The handler asks for the key orders:user:${USER}. On a miss it goes on to the database and, on the way back, stores the result under that key; the next identical request is a hit and skips the ORM and the database entirely. A cached copy can go stale: when an order changes, the app has to delete the key, or the user sees old data until it expires.` },
  { id: "orm", step: 6, title: "ORM", fact: "ORM · Order.where(user_id: 7) → SQL", text: "An object-relational mapper turns code like Order.where(user_id: 7) into SQL (SELECT * FROM orders WHERE user_id = 7), sends it over a pooled connection, and turns the rows that come back into objects. Convenient, but it hides how many queries you send and whether they can use an index." },
  { id: "db", step: 7, title: "Database", fact: `database · ${ROWS.toLocaleString("en-US")} orders`, text: `Postgres keeps the orders table, ${ROWS.toLocaleString("en-US")} rows here. With an index on user_id it finds user 7's three rows by looking them up, like a card index sorted by user, in about ${COST.dbIndex} ms. Without it, it must read every row to find them: a sequential scan, about ${COST.dbScan} ms in this toy, and worse as the table grows. Turn INDEX off and watch the drawer being read card by card.` },
  { id: "stopwatch", step: 9, title: "Stopwatch", fact: "stopwatch · adds up each hop", text: "Adds up the milliseconds of every hop the request actually makes; the bars under the figure break the total down. With the index on, the network is most of the wait, so the cache saves only a few ms. With the index off, the cache saves the whole scan. Toy numbers with a real order of magnitude." },
  { id: "controls", step: 0, title: "Switch panel", fact: "switches · session, index, cache", text: "What you change to see the consequence: SESSION (OK or EXPIRED) decides whether auth lets the request in, INDEX (ON or OFF) decides how the database finds the rows, and the CACHE button empties the cache so the next request misses. Each change re-runs the same request through the model." },
];

const unit = (vector) => { const o = at([0, 0, 0]); const p = at(vector); return [p[0] - o[0], p[1] - o[1]]; };
const DATA = {
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  P, steps: STEPS, hops: HOPS, cost: COST, rows: ROWS, user: USER, orders: ORDERS,
  parts: Object.fromEntries(PARTS.map(({ id, step, fact }) => [id, { step, fact }])),
  tt: TT, ttR: TT_R, uA: U_A, uTurn: U_TURN, stop: STOP, gauge: GAUGE, railZ: RAIL_Z,
  barZ: BAR_Z, sw: SW, watchMax: WATCH_MAX, watchFrom: WATCH_FROM, watchSpan: WATCH_SPAN, watch: WATCH, watchR: WATCH_R, watchZ: WATCH_Z,
  db: DB, drawer: DRAWERS[0], drawerOut: DRAWER_OUT,
};


// The moving parts' drawing code: run here for the resting pose (page without script, thumb.svg)
// and inlined in the page, so both draw the same carriage, deck and drawer.
const MOVERS = String.raw`// ---------- drawing the moving parts ----------
function rotRing(cx, cy, a, len, wid, ch) {
  const c = Math.cos(a), s = Math.sin(a), l = len / 2, w = wid / 2;
  return [[l - ch, w], [l, w - ch], [l, -w + ch], [l - ch, -w], [-l + ch, -w], [-l, -w + ch], [-l, w - ch], [-l + ch, w]].map(([p, q]) => [cx + p * c - q * s, cy + p * s + q * c]);
}
const prism = (ring, z, h, tone, inner = "") => solidSvg(extrude(ring, z, h, D.P, { convex: true }), { tone, inner });
const depthXY = ([x, y]) => depthOf([x, y, 0], D.P);
function textOnTop(cx, cy, z, a, text, size, tone) {
  const o = iso([cx, cy, z], D.P), ux = iso([cx + Math.cos(a), cy + Math.sin(a), z], D.P), vy = iso([cx - Math.sin(a), cy + Math.cos(a), z], D.P);
  const m = [ux[0] - o[0], ux[1] - o[1], vy[0] - o[0], vy[1] - o[1], o[0], o[1]].map((v) => +v.toFixed(3)).join(" ");
  return '<text class="iso-face-text" data-tone="' + tone + '" transform="matrix(' + m + ')" font-size="' + size + '" text-anchor="middle">' + text + "</text>";
}
// the carriage's world position and heading for a path coordinate
function poseAt(u) {
  const [tx, ty] = D.tt;
  if (u <= D.uA) return { x: tx, y: ty + (D.uA - u), a: -Math.PI / 2 };
  if (u <= D.uA + D.uTurn) return { x: tx, y: ty, a: -Math.PI / 2 + (Math.PI / 2) * ease((u - D.uA) / D.uTurn) };
  return { x: tx + (u - D.uA - D.uTurn), y: ty, a: 0 };
}
function deckSvg(a) {
  const [tx, ty] = D.tt, out = [];
  out.push(prism(rotRing(tx, ty, a, D.ttR * 2 - 1, 12, 2.4), 1, 0.01, "lo"));
  const rails = [-D.gauge, D.gauge].map((off) => rotRing(tx - Math.sin(a) * off, ty + Math.cos(a) * off, a, D.ttR * 2 - 1.2, 1.4, 0.2));
  rails.sort((p, q) => depthXY(p[0]) + depthXY(p[4]) - depthXY(q[0]) - depthXY(q[4]));
  for (const r of rails) out.push(prism(r, D.railZ[0], D.railZ[1] - D.railZ[0], "mid"));
  out.push(dotsSvg([iso([tx, ty, D.railZ[0]], D.P)], { size: 0.6 }));
  return out.join("");
}
function carriageSvg(p, label) {
  const { x, y, a } = p, c = Math.cos(a), s = Math.sin(a), out = [];
  // four flanged wheels on the rails, then the chassis, the body and the slip it carries
  const wheels = [[-3.6, -D.gauge], [3.6, -D.gauge], [-3.6, D.gauge], [3.6, D.gauge]].map(([p2, q]) => [x + p2 * c - q * s, y + p2 * s + q * c]).sort((m, n) => depthXY(m) - depthXY(n));
  for (const [wx, wy] of wheels) out.push(solidSvg(cylinder(wx, wy, 1.3, 3, 1.4, D.P, 14), { tone: "mid" }));
  out.push(prism(rotRing(x, y, a, 13, 9, 1), 4.4, 1.4, "mid"));
  out.push(prism(rotRing(x, y, a, 10.4, 7.4, 1.2), 5.8, 3.2, "hi"));
  const slip = textOnTop(x, y, 9.4, a, label, 2.4, "hi");
  out.push(prism(rotRing(x + c * 0.6, y + s * 0.6, a, 7, 5.4, 0.4), 9, 0.4, "hi", slip));
  const lead = iso([x + c * 5.2, y + s * 5.2, 7.4], D.P);
  out.push(dotsSvg([lead], { size: 0.55, tone: "hi" }));
  return out.join("");
}
function drawerSvg(open, scanAt, found) {
  const db = D.db, fy = db.y + db.d, dr = D.drawer, [z0, z1] = dr.z, out = [];
  if (open > 0.05) {
    const body = { x: db.x + 5, y: fy, w: db.w - 10, d: open, r: 0.3 };
    // the cards inside, seen from above: a divider every 1.6, the three for user 7 raised and lit
    let lines = "";
    for (let yy = fy + 1.2; yy < fy + open - 0.4; yy += 1.6) lines += lineOnTop([body.x, yy], [body.x + body.w, yy], z1 - 0.6, D.P);
    out.push(solidSvg(slabOf(body, z0 + 0.6, z1 - z0 - 1.2, D.P, 1), { tone: "mid", inner: lineSvg(lines, { tone: "faint" }) }));
    found.forEach((f, j) => {
      if (f <= 0.01) return;
      const yy = fy + 3 + j * 5.2;
      if (yy > fy + open - 1) return;
      out.push(solidSvg(slabOf({ x: body.x + 8 + j * 10, y: yy, w: 9, d: 1, r: 0.2 }, z1 - 0.6, 0.4 + f * 1.8, D.P, 1), { tone: "hi", lit: f > 0.6 }));
    });
    if (scanAt !== null) {
      const sy = fy + 0.8 + scanAt * (open - 2);
      out.push(solidSvg(slabOf({ x: body.x - 1, y: sy, w: body.w + 2, d: 1.2, r: 0.3 }, z1 - 0.4, 1.4, D.P, 1), { tone: "hi", lit: true }));
    }
  }
  // the front panel, carried out with the drawer
  const plan = { x: db.x + 4, y: fy + open, w: db.w - 8, d: 1.6, r: 0.3 }, face = plan.y + 1.6;
  const holder = pathOf([iso([plan.x + 15, face, z1 - 3.8], D.P), iso([plan.x + 33, face, z1 - 3.8], D.P), iso([plan.x + 33, face, z1 - 1], D.P), iso([plan.x + 15, face, z1 - 1], D.P)], true);
  const label = faceTextSvg(sideMatrix([plan.x + 16.4, face], z1 - 3.1, D.P, "left"), dr.name, { size: 1.9, tone: "mid" });
  out.push(solidSvg(slabOf(plan, z0, z1 - z0, D.P, 1), { tone: "mid", inner: lineSvg(holder, { tone: "lo" }) + label }));
  out.push(solidSvg(slabOf({ x: plan.x + 19, y: face, w: 10, d: 1.4, r: 0.4 }, z0 + 1.4, 1.6, D.P, 2), { tone: "hi" }));
  return out.join("");
}

`;
const moving = new Function(...Object.keys(k), "D", "const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));" + MOVERS + "; return { deckSvg, carriageSvg, drawerSvg, poseAt };")(...Object.values(k), DATA);

const BODY = [
  plate(),
  part("router", stubs() + routeTable() + `<g data-routelamps>${ROUTES.map((r) => `<g data-routelamp="${r.id}">${S(k.cylinder(r.lampAt[0], r.lampAt[1], 0.7, 0.6, 0.6, P, 12), { tone: "hi" })}</g>`).join("")}</g>`),
  part("handler", handler()),
  part("cache", cacheBox() + [0, 1, 2].map((j) => `<g data-key="${j}"${j === 2 ? ' style="opacity:0"' : ""}>${keyCardSvg(j)}</g>`).join("")),
  part("orm", orm() + `<g data-tape style="opacity:0">${tape()}</g>`),
  part("request", lineB()),
  part("router", turntableBase() + `<g data-deck>${moving.deckSvg(-Math.PI / 2)}</g>`),
  part("auth", post(POSTS[0])),
  part("request", lineA()),
  part("browser", browser()),
  `<g data-part="request" data-carriage>${moving.carriageSvg(moving.poseAt(0), "GET")}</g>`,
  part("auth", post(POSTS[1]) + reader() + `<g data-bar>${bar()}</g>`),
  part("db", cabinet() + `<g data-index>${indexBox()}</g>` + `<g data-drawer>${moving.drawerSvg(0, null, [0, 0, 0])}</g>`),
  part("stopwatch", watch()),
  part("controls", panel() + [0, 1].map((i) => `<g data-knob="${i}" data-switch="${i ? "index" : "session"}">${knob(i)}</g>`).join("") + `<g data-switch="flush" data-flush>${flush()}</g>`),
];
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });

const live = `
const D = ${JSON.stringify(DATA)};
const trace = ${trace.toString()};
const HOPS = D.hops, COST = D.cost, ROWS = D.rows, ORDERS = D.orders;
const LAST = D.steps.length - 1;
const stage = ROOT.querySelector(".iso-stage");
const readout = ROOT.querySelector("[data-readout]");
const liveText = ROOT.querySelector("[data-live]");
const prev = ROOT.querySelector("[data-prev]");
const next = ROOT.querySelector("[data-next]");
const dots = [...ROOT.querySelectorAll("[data-dot]")];
const items = [...ROOT.querySelectorAll("[data-select]")];
const sessionBtn = ROOT.querySelector("[data-session]");
const indexBtn = ROOT.querySelector("[data-indexbtn]");
const flushBtn = ROOT.querySelector("[data-flushbtn]");
const bars = [...ROOT.querySelectorAll("[data-hop]")];
const totalEl = ROOT.querySelector("[data-total]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel) => stage.querySelector(sel);
const carriageEl = $("[data-carriage]"), deckEl = $("[data-deck]"), barEl = $("[data-bar]"), drawerEl = $("[data-drawer]");
const needleEl = $("[data-needle]"), tapeEl = $("[data-tape]"), indexEl = $("[data-index]"), enterEl = $("[data-enter]");
const keyEls = [...stage.querySelectorAll("[data-key]")].sort((a, b) => a.dataset.key - b.dataset.key);
const knobEls = [...stage.querySelectorAll("[data-knob]")].sort((a, b) => a.dataset.knob - b.dataset.knob);
const flushEl = $("[data-flush]");
const screenEls = [...stage.querySelectorAll("[data-screen]")].sort((a, b) => a.dataset.screen - b.dataset.screen);
const lamps = Object.fromEntries([...stage.querySelectorAll("[data-lamp]")].map((g) => [g.dataset.lamp, g.querySelector(".iso-solid")]));
const routeLamps = Object.fromEntries([...stage.querySelectorAll("[data-routelamp]")].map((g) => [g.dataset.routelamp, g]));
const routeText = $('[data-route="orders"]');
const endEls = Object.fromEntries([...stage.querySelectorAll("[data-end]")].map((t) => [t.dataset.end, t]));
const cacheState = $("[data-cachestate]");
const groups = [...stage.querySelectorAll("[data-part]")];

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const shift = (dx, dy, dz) => [D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz, D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz];
const setT = (el, [x, y]) => { const t = Math.abs(x) < 0.005 && Math.abs(y) < 0.005 ? "" : "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"; if (el._t !== t) { el._t = t; t ? el.setAttribute("transform", t) : el.removeAttribute("transform"); } };
const setO = (el, o) => { const v = o >= 0.999 ? "" : o.toFixed(2); if (el._o !== v) { el._o = v; el.style.opacity = v; } };
const setLit = (el, on) => { if (!el || !!el._lit === on) return; el._lit = on; on ? el.setAttribute("data-lit", "") : el.removeAttribute("data-lit"); };
const follow = (x, target, rate, dt) => { const nx = target + (x - target) * Math.exp(-rate * dt); return Math.abs(nx - target) < 0.01 ? target : nx; };
const fmt = (ms) => (ms < 1 ? ms.toFixed(1) : ms % 1 ? ms.toFixed(1) : String(ms));

// ---------- state ----------
let signedIn = true, indexed = true, warm = false;
let req = trace({ signedIn, warm, indexed });
let step = 0, selected = null;
let touring = !still.matches, tourClock = 0, lap = 0, idleTimer = 0, visible = false, frame = 0, last = 0;
let u = 0, deckA = Math.PI / 2, bar = 0, drawer = 0, scan = 0, tapeO = 0, hitLift = 0, cardO = 0, watchMs = 0;

const resnap = () => { req = trace({ signedIn, warm, indexed }); };
const ran = (h) => req.ran[h];
const elapsed = (n) => HOPS.slice(0, n + 1).reduce((a, h) => a + req.ms[h], 0);

// where the carriage should be at each step
function target() {
  const S = D.stop;
  if (step === 0) return S.browser;
  if (step === 1) return S.table;
  if (step === 2) return S.turned;
  if (step === 3) return S.gate;
  if (!signedIn) return step >= 8 ? S.browser : S.gate;
  if (step === 4) return S.handler;
  if (step === 5) return S.cache;
  if (step === 6 || step === 7) return req.hit ? S.cache : S.orm;
  return S.browser;
}

function stepText(n) {
  const h = HOPS[n], ms = req.ms[h];
  const t = " · " + fmt(ms) + " ms";
  switch (h) {
    case "click": return "click · “My orders” in the browser";
    case "request": return "request · GET /api/orders + cookie" + t;
    case "route": return "router · GET /api/orders → orders.index" + t;
    case "auth": return signedIn ? "auth · session OK → user " + D.user + t : "auth · session expired → 401" + t;
    case "handler": return ran(h) ? "handler · orders.index(user " + D.user + ")" + t : "handler · never runs: auth said 401";
    case "cache": return ran(h) ? "cache · GET orders:user:" + D.user + " → " + (req.hit ? "hit" : "miss") + t : "cache · skipped: 401";
    case "orm": return ran(h) ? "ORM · SELECT … WHERE user_id = " + D.user + t : "ORM · skipped: " + (signedIn ? "cache hit" : "401");
    case "db": return ran(h) ? (indexed ? "database · index → 3 rows" + t : "database · full scan, " + ROWS.toLocaleString("en-US") + " rows" + t) : "database · not touched: " + (signedIn ? "cache hit" : "401");
    case "response": return (req.status === 200 ? "response · 200 OK · JSON" : "response · 401 Unauthorized") + (req.fills ? " · cache SET" : "") + t;
    case "render": return "rendered · total " + fmt(req.total) + " ms" + (req.hit ? " · cache hit" : req.status === 200 ? " · cache miss" : " · 401");
  }
}
function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }

function setStep(n) {
  n = Math.max(0, Math.min(LAST, n));
  if (n === step) return;
  // a miss writes the cache as the response leaves, for the next request
  if (n >= 8 && step < 8 && req.fills) warm = true;
  step = n;
  controls();
  if (!touring) announce(stepText(step));
  run();
}
function sendAgain() { resnap(); step = 0; setStep(1); controls(); }

function setSession(on) { if (on === signedIn) return; signedIn = on; resnap(); controls(); announce(signedIn ? "session OK" : "session expired: the next check stops it at 401"); run(); }
function setIndex(on) { if (on === indexed) return; indexed = on; resnap(); controls(); announce(indexed ? "index on orders.user_id" : "index dropped: the database must read every row"); run(); }
function flushCache() { warm = false; resnap(); controls(); announce("cache flushed: the next request misses"); run(); }

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
  dots.forEach((dot, i) => (i < step ? dot.setAttribute("data-on", "") : dot.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(step));
  stage.setAttribute("aria-valuetext", stepText(step));
  sessionBtn.setAttribute("aria-pressed", String(!signedIn));
  sessionBtn.textContent = signedIn ? "Session: OK" : "Session: expired";
  indexBtn.setAttribute("aria-pressed", String(!indexed));
  indexBtn.textContent = indexed ? "Index: on" : "Index: off";
  flushBtn.disabled = !warm;
  endEls["0:0"].setAttribute("data-tone", signedIn ? "hi" : "lo");
  endEls["0:1"].setAttribute("data-tone", signedIn ? "lo" : "hi");
  endEls["1:0"].setAttribute("data-tone", indexed ? "hi" : "lo");
  endEls["1:1"].setAttribute("data-tone", indexed ? "lo" : "hi");
  cacheState.textContent = warm ? "WARM" : "EMPTY";
  // the timing bars: every hop of this request, the ones it skipped greyed
  const max = Math.max(...HOPS.map((h) => req.ms[h]), 20);
  bars.forEach((bar) => {
    const h = bar.dataset.hop, i = HOPS.indexOf(h), ms = req.ms[h];
    bar.style.setProperty("--p", (ms / max).toFixed(4));
    bar.querySelector("b").textContent = ran(h) ? fmt(ms) + " ms" : "skipped";
    if (ran(h)) bar.removeAttribute("data-below"); else bar.setAttribute("data-below", "");
    if (i === step) bar.setAttribute("data-on", ""); else bar.removeAttribute("data-on");
  });
  totalEl.textContent = fmt(req.total) + " ms · " + (req.status === 200 ? (req.hit ? "cache hit" : "cache miss, " + (indexed ? "index" : "full scan")) : "401") + (step < LAST ? " (when the request finishes)" : "");
  writeScreen();
}

function writeScreen() {
  let lines;
  if (step === 0) lines = ["My orders", "[ load ]", "", ""];
  else if (step < LAST) lines = ["loading …", "", "", ""];
  else if (req.status === 401) lines = ["401", "Please sign in", "", ""];
  else lines = ["My orders", ...ORDERS.map((o) => "#" + o.id + " " + o.status + " " + o.total)];
  screenEls.forEach((el, n) => { if (el.textContent !== lines[n]) el.textContent = lines[n]; });
}

${MOVERS}
// ---------- motion ----------
function update(dt, calm) {
  let busy = false;
  const go = (x, t, rate) => { const nx = calm ? t : follow(x, t, rate, dt); if (nx !== t) busy = true; return nx; };
  // the carriage runs at a steady pace with soft ends, so long runs don't take forever
  const tu = target();
  if (calm) u = tu;
  else if (u !== tu) { const d = tu - u, v = Math.max(28, Math.abs(d) * 2.4) * dt; u = Math.abs(d) <= v ? tu : u + Math.sign(d) * v; busy = true; }
  const dbRun = step === 7 && ran("db");
  bar = go(bar, signedIn && step >= 3 && !(step >= 8 && u < D.stop.gate - 4) ? 1 : 0, 4);
  drawer = go(drawer, dbRun ? 1 : 0, 3);
  // the scan: with the index the reader goes straight to user 7's cards; without, it reads every card
  const scanGoal = dbRun && drawer > 0.95 ? 1 : 0;
  if (calm) scan = scanGoal;
  else if (scan !== scanGoal) { const rate = scanGoal ? (indexed ? 3 : 0.36) : 4; scan = scanGoal ? Math.min(1, scan + rate * dt) : Math.max(0, scan - rate * dt); busy = true; }
  tapeO = go(tapeO, ran("orm") && step >= 6 && step <= 8 ? 1 : 0, 5);
  cardO = go(cardO, warm ? 1 : 0, 4);
  hitLift = go(hitLift, req.hit && step >= 5 && step <= 7 ? 1 : 0, 5);
  watchMs = go(watchMs, step === 0 ? 0 : elapsed(step), 4);
  return busy;
}

function place() {
  const p = poseAt(u);
  const label = step >= 8 && u < D.stop.gate + 2 ? String(req.status) : u > D.stop.cache - 1 && step >= 8 ? String(req.status) : "GET";
  const key = p.x.toFixed(2) + p.y.toFixed(2) + p.a.toFixed(3) + label;
  if (carriageEl._k !== key) { carriageEl._k = key; carriageEl.innerHTML = carriageSvg(p, label); }
  // the deck turns with the carriage while it is on it, and stays where it was left
  const da = u <= D.uA ? -Math.PI / 2 : u >= D.uA + D.uTurn ? 0 : p.a;
  const dk = da.toFixed(3);
  if (deckEl._k !== dk) { deckEl._k = dk; deckEl.innerHTML = deckSvg(da); }
  setT(barEl, shift(0, 0, (D.barZ[1] - D.barZ[0]) * ease(bar)));
  // the drawer: open distance, the scan bar's place, and how far each of user 7's cards is raised
  const open = D.drawerOut * ease(drawer);
  const found = [0, 1, 2].map((j) => (indexed ? ease(scan) : ease(Math.max(0, Math.min(1, (scan - (0.2 + j * 0.3)) * 8)))));
  const sAt = drawer > 0.95 && step === 7 && ran("db") ? (indexed ? 0.08 + 0.42 * ease(scan) : scan) : null;
  const dkey = open.toFixed(2) + "|" + (sAt === null ? "-" : sAt.toFixed(3)) + "|" + found.map((f) => f.toFixed(2)).join(",");
  if (drawerEl._k !== dkey) { drawerEl._k = dkey; drawerEl.innerHTML = drawerSvg(open, sAt, found); }
  setO(indexEl, indexed ? 1 : 0.15);
  setO(tapeEl, tapeO);
  setO(keyEls[2], cardO);
  setT(keyEls[2], shift(0, 0, 4 * ease(hitLift)));
  setLit(keyEls[2].querySelector(".iso-solid"), hitLift > 0.5);
  // the switches on the panel
  setT(knobEls[0], shift(signedIn ? 0 : D.sw.x1 - D.sw.x0, 0, 0));
  setT(knobEls[1], shift(indexed ? 0 : D.sw.x1 - D.sw.x0, 0, 0));
  setT(enterEl, shift(0, 0, step === 0 ? 0 : step === 1 && u < 20 ? -0.6 : 0));
  // the stopwatch
  const a = D.watchFrom + D.watchSpan * Math.min(watchMs, D.watchMax) / D.watchMax, r = D.watchR - 2;
  const nd = lineOnTop(D.watch, [D.watch[0] + Math.sin(a) * r, D.watch[1] - Math.cos(a) * r], D.watchZ, D.P);
  if (needleEl._d !== nd) { needleEl._d = nd; needleEl.setAttribute("d", nd); }
  // lamps: the station working on the request right now
  const h = HOPS[step], arrived = Math.abs(u - target()) < 0.5;
  setLit(lamps.browser, (step === 0 || step === LAST) && arrived);
  setLit(lamps.auth, step === 3 && arrived && signedIn);
  const deny = step >= 3 && !signedIn && lamps.auth;
  if (deny) lamps.auth.setAttribute("data-deny", ""); else lamps.auth.removeAttribute("data-deny");
  setLit(lamps.handler, h === "handler" && ran(h) && arrived);
  setLit(lamps.cache, h === "cache" && ran(h) && arrived);
  setLit(lamps.orm, h === "orm" && ran(h) && arrived);
  setLit(lamps.db, h === "db" && ran(h) && drawer > 0.9);
  const routed = step >= 2 && u >= D.uA + D.uTurn - 0.5 || step >= 3;
  setLit(routeLamps.orders.querySelector(".iso-solid"), routed && step <= 8);
  routeText.setAttribute("data-tone", routed && step <= 8 ? "hi" : "lo");
  const text = selected ? D.parts[selected].fact : stepText(step);
  if (readout.textContent !== text) readout.textContent = text;
}

// ---------- the tour: four requests that show the four outcomes ----------
const LAPS = [
  { say: "a cold cache: miss, then the indexed query", set: () => { signedIn = true; indexed = true; warm = false; } },
  { say: "the same request again: a cache hit", set: () => { signedIn = true; indexed = true; } },
  { say: "no index and a cold cache: a full scan", set: () => { signedIn = true; indexed = false; warm = false; } },
  { say: "an expired session: 401 at the gate", set: () => { signedIn = false; indexed = true; } },
];
const BEAT = 2.2;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    tourClock += dt;
    // wait for the database scan before moving on
    const slow = step === 7 && ran("db") && !indexed && scan < 1;
    if (!slow && tourClock > BEAT) {
      tourClock = 0;
      if (step === LAST) { lap = (lap + 1) % LAPS.length; LAPS[lap].set(); resnap(); step = 0; controls(); }
      else setStep(step + 1);
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
    touring = true; tourClock = 0; run();
  }, 12000);
}
const go = (n) => { hold(); setStep(n); };
const forward = () => { hold(); if (step === LAST) sendAgain(); else setStep(step + 1); };

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

const partAt = (target) => target.closest && target.closest("[data-part]");
stage.addEventListener("pointermove", (event) => { if (event.pointerType !== "mouse") return; const g = partAt(event.target); select(g ? g.dataset.part : null); });
stage.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
stage.addEventListener("click", (event) => {
  hold();
  const sw = event.target.closest && event.target.closest("[data-switch]");
  if (sw) { const w = sw.dataset.switch; if (w === "session") setSession(!signedIn); else if (w === "index") setIndex(!indexed); else flushCache(); return; }
  const g = partAt(event.target);
  if (!g) return select(null);
  if (event.pointerType !== "mouse") select(selected === g.dataset.part ? null : g.dataset.part);
});
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: () => go(step + 1), ArrowDown: () => go(step + 1), ArrowLeft: () => go(step - 1), ArrowUp: () => go(step - 1), Home: () => go(0), End: () => go(LAST), " ": forward, Enter: forward, Escape: () => { hold(); select(null); },
    s: () => { hold(); setSession(!signedIn); }, S: () => { hold(); setSession(!signedIn); }, i: () => { hold(); setIndex(!indexed); }, I: () => { hold(); setIndex(!indexed); }, c: () => { hold(); flushCache(); }, C: () => { hold(); flushCache(); } };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
prev.addEventListener("click", () => go(step - 1));
next.addEventListener("click", forward);
sessionBtn.addEventListener("click", () => { hold(); setSession(!signedIn); });
indexBtn.addEventListener("click", () => { hold(); setIndex(!indexed); });
flushBtn.addEventListener("click", () => { hold(); flushCache(); });
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

const HOP_NAMES = { click: "click", request: "network out", route: "router", auth: "auth", handler: "handler", cache: "cache", orm: "ORM", db: "database", response: "network back", render: "render" };
const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Full stack request · GET /api/orders",
  hint: "← → step · S I C switches",
  readout: "click · “My orders” in the browser",
  keys: [
    { mark: "lit", label: "The station working on the request now" },
    { mark: "raised", label: "Carriage: the request out, the response back" },
  ],
  caption: `One request through a full stack app: the browser sends GET /api/orders with its session cookie, the router picks the handler, auth checks the session, the handler asks the cache and, on a miss, the ORM turns the call into SQL for the database; the response goes back the same way and the browser draws the page. Timings are toy numbers with a real order of magnitude (${COST.request} ms each way on the network, ${COST.dbIndex} ms for an indexed lookup, ${COST.dbScan} ms to scan ${ROWS.toLocaleString("en-US")} rows); real ones depend on the hardware, the distance and the load.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Full stack request. Arrow keys step the request from the browser to the database and back; S switches the session, I the index, C flushes the cache; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="click">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Back one step" disabled>←</button><span class="pc-dots" aria-hidden="true">${STEPS.slice(1).map(() => "<i data-dot></i>").join("")}</span><span class="pc-group pc-right"><button type="button" class="pc-btn" data-session aria-pressed="false" aria-keyshortcuts="S">Session: OK</button><button type="button" class="pc-btn" data-indexbtn aria-pressed="false" aria-keyshortcuts="I">Index: on</button><button type="button" class="pc-btn" data-flushbtn aria-keyshortcuts="C" disabled>Flush cache</button></span><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const timing = `<h4 style="margin:6px 0 0">Where the time goes</h4><p class="tip">Each hop of this request, in toy milliseconds. Greyed hops are ones the request skipped: a cache hit skips the ORM and the database, a 401 skips everything after auth.</p><ol class="pc-bars" style="margin-bottom:6px">${HOPS.map((h) => `<li data-hop="${h}" style="--p:0"><span>${HOP_NAMES[h]}</span><i></i><b></b></li>`).join("")}</ol><p class="pc-total">total <b data-total></b></p>`;
const CSS = `
.anatomy-embed [data-lamp] .iso-solid[data-lit]>.iso-fill,.anatomy-embed [data-lamp] .iso-solid[data-lit]>.iso-top,.anatomy-embed [data-lamp] .iso-solid[data-lit]>.iso-shade,.anatomy-embed [data-routelamp] .iso-solid[data-lit]>*{fill:var(--anatomy-lit)}
.anatomy-embed [data-lamp] .iso-solid[data-deny]>.iso-fill,.anatomy-embed [data-lamp] .iso-solid[data-deny]>.iso-top,.anatomy-embed [data-lamp] .iso-solid[data-deny]>.iso-shade{fill:var(--anatomy-red)}
.anatomy-embed [data-lamp] .iso-solid>*{transition:fill .3s}
.anatomy-embed [data-switch]{cursor:pointer}
.anatomy-embed .pc-bars li[data-below]{opacity:.45}
.anatomy-embed .pc-bars li[data-below] i::after{width:0}
.anatomy-embed .pc-total{margin:4px 0 12px;font:12px var(--anatomy-mono);color:var(--muted)}
.anatomy-embed .pc-total b{color:var(--text);font-weight:700}
.anatomy-embed .pc-controls .pc-btn[aria-pressed="true"]{font-weight:700}
`;
const html = embedHtml({ slug: "full-stack-app", plate: plateBody, parts: partsHtml(PARTS, { extra: timing }), css: CSS, task: "Step one request all the way through and read the total. Send it again: the cache is warm now, so the carriage turns back at the cache box. Then turn the index off, flush the cache and send it again to watch the drawer being read row by row. Last, set the session to expired: the barrier stays down and the request never reaches the handler.", live });
page("full-stack-app", html, {
  title: "Anatomy of a full stack app",
  lede: "A request rail: a carriage carries the request from the browser through the router, auth, the handler, the cache, the ORM and the database, and brings the response back for the page to draw.",
});
