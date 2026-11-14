// Anatomy of a pencil: builds pencil/index.html (light) or pencil/dark.html (--dark).
// Uses the Anatomy kit (MIT, vendored in tools/anatomy). World units are millimetres.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../tools/anatomy/kit/lathe.mjs";
import { kitScript } from "../tools/anatomy/scripts/inline-kit.mjs";
import { EXPAND_BUTTON, EXPAND_CSS, EXPAND_JS } from "../tools/expand.mjs";

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

// Sharpening: a cone at a fixed half-angle. Each turn of the sharpener takes the tip further in.
const TAPER = (11 * Math.PI) / 180; // half-angle of the point
const LEAD = CORE_R / Math.tan(TAPER); // exposed graphite cone
const BEVEL = APO / Math.tan(TAPER); // from the tip to where the cone meets the flats
const SHARP = [0, 2, 5, 8, 11]; // millimetres gone from the tip end: new, then four sharpenings

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

const PLATE = { x: -142, y: -26, w: 272, d: 52, r: 7 };
const PLATE_H = 9;
const FOOT_H = 5;
const CRADLES = [46, 142].map((s) => X0 - s);
const CRADLE_TOP = ZC - APO;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [X0, RAD, ZC + APO + 17], [X0 - PENCIL.length, -RAD, ZC + APO + 17], [X0 + 30, 10, 30]],
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

// Half of a truncated cone, split on the plane v = 0 like the slats: a convex solid built facet by facet.
function halfFrustum(s0, r0, s1, r1, upper, steps = 24) {
  const V = G.viewOf(P);
  const LT = G.lightOf(P);
  const a0 = upper ? 0 : Math.PI;
  const angles = Array.from({ length: steps + 1 }, (_, i) => a0 + (Math.PI * i) / steps);
  const ringAt = (s, r) => angles.map((a) => G.pointOf(F, s, r, a));
  const A = ringAt(s0, r0);
  const B = ringAt(s1, r1);
  const slope = (r1 - r0) / (s1 - s0);
  const buckets = [[], [], [], [], []];
  const faceOf = (points, normal) => {
    if (G.dot3(normal, V) <= 1e-6) return false;
    buckets[G.bandOf(G.dot3(G.unit3(normal), LT))].push(k.pathOf(points.map(at), true));
    return true;
  };
  for (let j = 0; j < steps; j++) {
    const am = (angles[j] + angles[j + 1]) / 2;
    const normal = G.unit3(G.sub3(G.radialOf(F, am), G.mul3(F.a, slope)));
    faceOf([A[j], A[j + 1], B[j + 1], B[j]], normal);
  }
  const cut = [onF(s0, r0, 0), onF(s1, r1, 0), onF(s1, -r1, 0), onF(s0, -r0, 0)];
  const cutSeen = faceOf(cut, G.mul3(F.v, upper ? -1 : 1));
  faceOf(A, G.mul3(F.a, -1));
  const hull = G.hullOf([...A, ...B].map(at));
  const crease = cutSeen ? k.pathOf([cut[0], cut[1]].map(at)) + k.pathOf([cut[2], cut[3]].map(at)) : "";
  return { fill: k.pathOf(hull, true), outline: k.pathOf(hull, true), crease, top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}

// One half of the wooden body at a sharpening stage: hex prism, plus the half cone once it has a point.
function slat(upper, cut) {
  const hex = upper ? UPPER_HEX : LOWER_HEX;
  const flat = cut === 0;
  const start = flat ? 0 : cut + BEVEL;
  const prism = G.prismOf(F, hex, start, PENCIL.body, P);
  const cone = flat ? null : halfFrustum(cut + LEAD, CORE_R, start, APO, upper);
  let svg = S(prism, { tone: "hi", inner: flat ? L(lacquer(hex), { tone: "lo" }) : "" });
  if (cone) svg += S(cone, { tone: "hi" });
  if (!upper) {
    const from = flat ? 0 : cut + GROOVE / Math.tan(TAPER);
    svg += L(grooveLines(from, PENCIL.body), { tone: "faint" });
  }
  if (upper) svg += k.faceTextSvg(k.topMatrix([X0 - 64, 0.9], ZC + APO, P, "x"), PENCIL.grade, { size: 2.2, tone: "lo" });
  return { prism, cone, svg };
}

const staged = (list) => list.map((svg, i) => `<g data-stage="${i}"${i ? ' style="display:none"' : ""}>${svg}</g>`).join("");
const lowers = SHARP.map((cut) => slat(false, cut));
const uppers = SHARP.map((cut) => slat(true, cut));
const lowerShoulder = G.prismOf(F, halfDisc(SH_R, false), ...PENCIL.shoulder, P);

// The core lies in the groove: whatever is below the slat's top faces stays hidden behind it.
const mask = `<defs>${lowers.map((low, i) => {
  const black = [low.prism.fill, low.cone?.fill, lowerShoulder.fill].filter(Boolean).map((d) => `<path d="${d}" fill="#000"/>`).join("");
  const white = [low.prism.top, low.cone?.top, lowerShoulder.top].filter(Boolean).map((d) => `<path d="${d}" fill="#fff"/>`).join("");
  return `<mask id="pc-groove-${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${black}${white}</mask>`;
}).join("")}</defs>`;
const coreBodies = SHARP.map((cut) => S(G.disc(cut ? cut + LEAD : 0, PENCIL.shoulder[1], CORE_R, F, P), { tone: "hi", lit: true, crease: "none" }));
const coreTips = SHARP.map((cut) => (cut ? S(G.solidOf([[cut, 0], [cut + LEAD, CORE_R]], F, P), { tone: "hi", lit: true }) : S(G.disc(0, 0.05, CORE_R, F, P, { steps: 24 }), { tone: "hi", lit: true, crease: "none" })));

// ---------- the sharpener: a block with a conical bore, on a carriage that runs on two rails ----------
const SH_HOME = X0 + 5; // the bore face, parked just past the pencil's end
const SH_BODY = { x: SH_HOME, y: -8, w: 22, d: 16, r: 2 };
const SH_Z = [5, 23];
const CRANK = [SH_HOME + 11, 0];
const CRANK_Z = SH_Z[1] + 4;
const RAILS = { from: X0 - 34, to: X0 + 30 };
const travelFor = (cut) => SH_HOME - (X0 - (cut + BEVEL) - 1);

function rails() {
  const out = [];
  for (const y of [-9.5, 6.5]) {
    out.push(S(k.slabOf({ x: RAILS.from, y, w: RAILS.to - RAILS.from, d: 3, r: 0.8 }, 0, 1.6, P, 2, 0.3), { tone: "mid" }));
    out.push(D([RAILS.from + 3, RAILS.to - 3].map((x) => at([x, y + 1.5, 1.6])), { size: 0.4 }));
  }
  out.push(S(k.slabOf({ x: RAILS.to, y: -11, w: 4, d: 22, r: 1 }, 0, 6, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([RAILS.to + 2, -7, 6]), at([RAILS.to + 2, 7, 6])], { size: 0.45 }));
  return out.join("");
}

const crankPointer = (turn) => {
  const a = turn * Math.PI * 2;
  return k.lineOnTop([CRANK[0] - Math.cos(a) * 1.6, CRANK[1] - Math.sin(a) * 1.6], [CRANK[0] + Math.cos(a) * 4.2, CRANK[1] + Math.sin(a) * 4.2], CRANK_Z, P);
};

function sharpener() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(SH_BODY, 2), 1.6, 0.1, P)}" style="filter:blur(3px)"/>`];
  const carriage = { x: SH_HOME - 2, y: -11, w: 26, d: 22, r: 2 };
  out.push(S(k.slabOf(carriage, 1.6, SH_Z[0] - 1.6, P, 3, 0.5), { tone: "mid" }));
  out.push(D([[carriage.x + 3, -8.5], [carriage.x + carriage.w - 3, -8.5], [carriage.x + 3, 8.5], [carriage.x + carriage.w - 3, 8.5]].map(([x, y]) => at([x, y, SH_Z[0]])), { size: 0.4 }));
  const seam = k.sideSeam(SH_BODY, SH_Z[0] + 13, P, 4);
  out.push(S(k.slabOf(SH_BODY, SH_Z[0], SH_Z[1] - SH_Z[0], P, 4, 0.8), { tone: "mid", inner: L(seam, { tone: "faint" }) }));
  // blade, held by two screws on the visible side
  const blade = { x: SH_HOME + 4, y: SH_BODY.y + SH_BODY.d, w: 12, d: 0.6, r: 0.2 };
  out.push(S(k.slabOf(blade, ZC + 1, 5, P, 2), { tone: "hi", crease: "none" }));
  out.push(D([at([blade.x + 3, blade.y + 0.6, ZC + 3.5]), at([blade.x + 9, blade.y + 0.6, ZC + 3.5])], { size: 0.5, tone: "hi" }));
  out.push(D([[SH_BODY.x + 3, -5], [SH_BODY.x + 3, 5], [SH_BODY.x + 19, -5], [SH_BODY.x + 19, 5]].map(([x, y]) => at([x, y, SH_Z[1]])), { size: 0.4 }));
  // the crank: a knurled knob on top whose pointer turns as it cuts
  out.push(S(k.cylinder(CRANK[0], CRANK[1], 5.2, SH_Z[1], CRANK_Z - SH_Z[1], P, 32), { tone: "mid" }));
  out.push(L(k.knurl(CRANK[0], CRANK[1], 5.2, SH_Z[1], CRANK_Z, 30, P), { tone: "lo" }));
  out.push(L(k.ring(CRANK[0], CRANK[1], 3.4, CRANK_Z, P, 28), { tone: "faint" }));
  out.push(`<path class="iso-line" data-tone="hi" data-crank data-free="both" d="${crankPointer(0)}" style="stroke-width:1"/>`);
  out.push(D([at([CRANK[0], CRANK[1], CRANK_Z])], { size: 0.55, tone: "hi" }));
  return out.join("");
}

const moving = (id, part, svg, extra = "") => {
  const [mx, my, mz] = PIECES[id].move;
  return `<g data-move="${id}" data-m="${mx},${my},${mz}" data-part="${part}"${extra}>${svg}</g>`;
};
const still = (part, svg) => `<g data-part="${part}">${svg}</g>`;

const FIGURE_LABEL =
  "A new, unsharpened HB pencil lying in two cradles on a bench plate, over a millimetre rule. Taken apart, the eraser and the aluminium ferrule slide off its end, the upper cedar slat lifts away, and the thin graphite core rises out of the groove in the lower slat.";
const BODY = [
    mask,
    plate(),
    fence(),
    rails(),
    ...CRADLES.map((cx) => cradle(cx, false)),
    moving("eraser", "eraser", eraser()),
    still("casing", shoulder(false)),
    moving("upper", "casing", shoulder(true)),
    moving("ferrule", "ferrule", ferrule()),
    still("casing", staged(lowers.map((low) => low.svg))),
    ...CRADLES.map((cx) => cradle(cx, true)),
    `<g mask="url(#pc-groove-0)" data-groove>${moving("core", "core", staged(coreBodies), ' data-core-body="" style="visibility:hidden"')}</g>`,
    moving("upper", "casing", staged(uppers.map((up) => up.svg))),
    moving("core", "core", staged(coreTips)),
    `<g data-sharpener>${sharpener()}</g>`,
  ];
// A standalone .svg is XML: every attribute needs a value.
const xmlSafe = (text) => text.replace(/ (data-[\w-]+)(?=[\s>\/])/g, ' $1=""');
const svg = k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY });
// A still of the assembled pencil for the home page.
if (theme === "light") writeFileSync(join(HERE, "thumb.svg"), xmlSafe(k.figureSvg({ width: W, height: H, label: FIGURE_LABEL, body: BODY, standalone: "light" }).replace("<style>", "<style>[data-lit]>.iso-fill{fill:#3d3d3b}[data-lit]>.iso-top{fill:#5a5a57;stroke:#5a5a57}[data-lit]>.iso-shade{fill:#2f2f2d;stroke:#2f2f2d}")));

// Steps: how many assemblies are off, in STAGGER order.
const STEPS = [
  { say: `assembled · ${PENCIL.length} mm · ${PENCIL.grade}`, next: "Take off the eraser" },
  { say: "eraser off", next: "Slide off the ferrule" },
  { say: "ferrule off · shoulder showing", next: "Lift the upper slat" },
  { say: "upper slat off · core in its groove", next: "Lift out the core" },
  { say: "apart · 5 parts", next: "Put it back together" },
];
// Parts, as listed under the figure: what each shows on the plate and the step that exposes it.
const PARTS = [
  { id: "core", show: "core", step: 4, title: "Core", fact: `core · ⌀${PENCIL.core} mm · graphite and clay, fired`, text: "Not lead. It's graphite mixed with clay and fired. More clay makes a harder, lighter line (the H grades), and more graphite a softer, darker one (the B grades). HB sits in the middle." },
  { id: "casing", show: "casing", step: 3, title: "Casing", fact: "casing · two grooved cedar slats, glued", text: "Two slats of cedar, picked because it sharpens cleanly without splitting. Each slat has a groove, the core is glued between them, and the sandwich is cut into pencils." },
  { id: "finish", show: "casing", step: 0, title: "Finish", fact: `finish · lacquer over a ${PENCIL.flats} mm hexagon`, text: "Several coats of lacquer seal the wood against moisture and give the grip its feel. The hexagon keeps the pencil from rolling off the desk." },
  { id: "ferrule", show: "ferrule", step: 2, title: "Ferrule", fact: `ferrule · aluminium, ${PENCIL.ferrule[1] - PENCIL.ferrule[0]} mm, crimped`, text: "A crimped aluminium band that joins two materials that won't glue well: wood and rubber. The wood is turned down to a shoulder so the band sits flush." },
  { id: "eraser", show: "eraser", step: 1, title: "Eraser", fact: `eraser · ${PENCIL.eraser[1] - PENCIL.eraser[0]} mm plug, ${PENCIL.eraser[1] - PENCIL.ferrule[1]} mm showing`, text: "A plug of rubber or vinyl. It works by being slightly stickier than paper, so graphite particles cling to it instead." },
];

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  stagger: STAGGER, spring: SPRING,
  steps: STEPS,
  parts: Object.fromEntries(PARTS.map(({ id, show, step, fact }) => [id, { show, step, fact }])),
  sharp: SHARP.map((cut) => ({ length: PENCIL.length - cut, travel: travelFor(cut) })),
  grade: PENCIL.grade,
  P, crank: CRANK, crankZ: CRANK_Z,
};

const live = `
const D = ${JSON.stringify(DATA)};
const LAST = D.steps.length - 1;
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const liveText = document.querySelector("[data-live]");
const prev = document.querySelector("[data-prev]");
const next = document.querySelector("[data-next]");
const dots = [...document.querySelectorAll("[data-dot]")];
const items = [...document.querySelectorAll("[data-select]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const nodes = [...stage.querySelectorAll("[data-move]")].map((el) => ({ el, id: el.dataset.move, m: el.dataset.m.split(",").map(Number), shown: "" }));
const groups = [...stage.querySelectorAll("[data-part]")];
const coreBody = stage.querySelector("[data-core-body]");
const piece = Object.fromEntries(D.stagger.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
let cut = 0, job = null;
const LAST_CUT = D.sharp.length - 1;
const groove = stage.querySelector("[data-groove]");
const stagedEls = [...stage.querySelectorAll("[data-stage]")];
const sharpener = stage.querySelector("[data-sharpener]");
const crank = stage.querySelector("[data-crank]");
const sharpenButton = document.querySelector("[data-sharpen]");
const crankPointer = ${crankPointer.toString().replace("k.lineOnTop", "lineOnTop").replace(/CRANK_Z/g, "D.crankZ").replace(/CRANK/g, "D.crank").replace(/, P\)/, ", D.P)")};
// Sharpening timeline, in seconds: slide on, cut while the crank turns, slide off.
const IN = 0.7, CUT = 1.4, OUT = 0.7, TURNS = 3;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
let clock = 0, step = 0, selected = null, touring = !still.matches, tourClock = 0, idleTimer = 0, visible = false, frame = 0, last = 0;

const goalOf = (state) => (state.pending ? state.pending.value : state.target);
const moving = () => D.stagger.some((id) => piece[id].pending || piece[id].x !== piece[id].target);

const lengthNow = () => D.sharp[cut].length;
const restText = () => (cut ? "sharpened · " : "new · ") + lengthNow() + " mm · " + D.grade;
const stepText = (n) => (n === 0 ? restText() : D.steps[n].say);

function setCut(n) {
  cut = n;
  for (const el of stagedEls) el.style.display = Number(el.dataset.stage) === cut ? "" : "none";
  groove.setAttribute("mask", "url(#pc-groove-" + cut + ")");
  controls();
}

function sharpen() {
  hold();
  if (job) return;
  if (cut === LAST_CUT) { setCut(0); announce("a new pencil · " + lengthNow() + " mm"); place(); return; }
  select(null);
  job = { t: -1, to: cut + 1, swapped: false };
  if (step !== 0) setStep(0);
  controls();
  run();
}

function runJob(dt) {
  if (job.t < 0) {
    if (step === 0 && !moving()) job.t = 0;
    return 0;
  }
  if (still.matches) { setCut(job.to); job = null; announce(restText()); controls(); return 0; }
  job.t += dt;
  if (!job.swapped && job.t >= IN + CUT / 2) { setCut(job.to); job.swapped = true; }
  if (job.t >= IN + CUT + OUT) { job = null; announce(restText()); controls(); return 0; }
  const slide = job.t < IN ? ease(job.t / IN) : job.t < IN + CUT ? 1 : 1 - ease((job.t - IN - CUT) / OUT);
  const turn = TURNS * Math.max(0, Math.min(1, (job.t - IN) / CUT));
  crank.setAttribute("d", crankPointer(turn));
  return slide;
}
let slideNow = 0;

function announce(text) { if (liveText.textContent !== text) liveText.textContent = text; }

function setStep(n) {
  n = Math.max(0, Math.min(LAST, n));
  if (job && job.t >= 0) return;
  if (n === step) return;
  const opening = n > step;
  step = n;
  let index = 0;
  for (const id of opening ? D.stagger : [...D.stagger].reverse()) {
    const state = piece[id];
    const goal = D.stagger.indexOf(id) < n ? 1 : 0;
    if (goalOf(state) === goal) continue;
    if (state.target === goal) { state.pending = null; continue; }
    state.pending = { value: goal, at: clock + (still.matches ? 0 : index++ * D.spring.stagger) };
  }
  controls();
  if (!touring) announce(stepText(step));
  run();
}

function select(id) {
  if (selected === id) return;
  selected = id;
  const show = id ? D.parts[id].show : null;
  for (const g of groups) { if (show && g.dataset.part === show) g.setAttribute("data-on", ""); else g.removeAttribute("data-on"); }
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
  stage.setAttribute("aria-valuetext", stepText(step));
  sharpenButton.querySelector("span").textContent = cut === LAST_CUT ? "New pencil" : "Sharpen";
  sharpenButton.disabled = !!job;
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
  coreBody.style.visibility = piece.upper.x > 0.03 || piece.core.x > 0.03 ? "visible" : "hidden";
  const tx = -D.EX[0] * D.sharp[job ? job.to : cut].travel * slideNow, ty = -D.EX[1] * D.sharp[job ? job.to : cut].travel * slideNow;
  if (slideNow) sharpener.setAttribute("transform", "translate(" + tx.toFixed(2) + " " + ty.toFixed(2) + ")"); else sharpener.removeAttribute("transform");
  const text = job && job.t >= 0 ? "sharpening · " + D.sharp[job.to].length + " mm left"
    : selected ? D.parts[selected].fact
    : moving() ? (step === 0 ? "putting together" : D.steps[step].say.split(" · ")[0])
    : stepText(step);
  if (readout.textContent !== text) readout.textContent = text;
}

// The idle tour walks the steps out and back: 0 1 2 3 4 4 3 2 1 0.
const TOUR = 1.5;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring && !job) {
    tourClock += dt;
    const beat = Math.floor(tourClock / TOUR) % (2 * (LAST + 1));
    setStep(beat <= LAST ? beat : 2 * LAST + 1 - beat);
  }
  let busy = false;
  for (const id of D.stagger) busy = steer(piece[id], dt, still.matches) || busy;
  if (job) { slideNow = runJob(dt); busy = true; } else slideNow = 0;
  place();
  frame = visible && (busy || touring) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

// Any action by the reader stops the tour where it is; it resumes after a quiet spell.
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
  select(g ? PART_OF[g.dataset.part] : null);
});
stage.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
stage.addEventListener("click", (event) => {
  hold();
  const g = partAt(event.target);
  if (!g) return select(null);
  const id = PART_OF[g.dataset.part];
  if (event.pointerType !== "mouse") select(selected === id ? null : id);
});
const PART_OF = { core: "core", casing: "casing", ferrule: "ferrule", eraser: "eraser" };

stage.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: () => go(step + 1), ArrowDown: () => go(step + 1), ArrowLeft: () => go(step - 1), ArrowUp: () => go(step - 1), Home: () => go(0), End: () => go(LAST), " ": forward, Enter: forward, e: forward, E: forward, Escape: () => { hold(); select(null); go(0); }, s: sharpen, S: sharpen };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});
prev.addEventListener("click", () => go(step - 1));
next.addEventListener("click", forward);
sharpenButton.addEventListener("click", sharpen);

for (const item of items) {
  const id = item.dataset.select;
  item.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") { hold(); select(id); } });
  item.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") select(null); });
  const pick = () => { hold(); select(id); setStep(Math.max(D.parts[id].step, id === "finish" ? 0 : step)); };
  item.addEventListener("click", pick);
  item.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } });
  item.addEventListener("focus", () => { hold(); select(id); });
  item.addEventListener("blur", () => select(null));
}
controls();
place();
`;

const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Pencil · HB",
  hint: "← → take apart · S sharpen · F expand",
  readout: `new · ${PENCIL.length} mm · ${PENCIL.grade}`,
  keys: [
    { mark: "lit", label: "The core: graphite and clay, the only part that writes" },
    { mark: "raised", label: "Cedar slats, ferrule and eraser: everything that holds it" },
  ],
  caption: `A new ${PENCIL.grade} pencil, ${PENCIL.length} mm long and ${PENCIL.flats} mm across the flats. Its ${PENCIL.core} mm core is glued into grooves between two cedar slats, and a lacquer coat seals the hexagonal body. At the far end the wood is turned down to a shoulder, and an aluminium ferrule is crimped over it and over the eraser's plug. Sharpen it and the blade cuts wood and graphite into one cone: the core runs the whole length, so there is always more of it to bring to a point.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Pencil. Arrow keys take it apart one part at a time, S sharpens it; hover or tap a part to read about it." aria-valuemin="0" aria-valuemax="${STEPS.length - 1}" aria-valuenow="0" aria-valuetext="new · ${PENCIL.length} mm · ${PENCIL.grade}">${svg}</div>
<div class="pc-controls"><button type="button" class="pc-btn" data-prev aria-label="Put the last part back" disabled>←</button><span class="pc-dots" aria-hidden="true">${STAGGER.map(() => "<i data-dot></i>").join("")}</span><button type="button" class="pc-btn pc-sharpen" data-sharpen aria-keyshortcuts="S"><span>Sharpen</span></button><button type="button" class="pc-btn pc-next" data-next><span>${STEPS[0].next}</span> →</button>${EXPAND_BUTTON}<span class="pc-live" aria-live="polite" data-live></span></div>`,
});

const ARTICLE_CSS = `
[data-theme="light"] .iso-svg [data-lit]>.iso-fill{fill:#3d3d3b}
[data-theme="light"] .iso-svg [data-lit]>.iso-top{fill:#5a5a57;stroke:#5a5a57}
[data-theme="light"] .iso-svg [data-lit]>.iso-shade{fill:#2f2f2d;stroke:#2f2f2d}
.iso-stage [data-part]{cursor:pointer}
.iso-stage[data-focus] [data-part]:not([data-on]) *{stroke:var(--anatomy-faint)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-fill{fill:var(--anatomy-paper)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-top{fill:var(--anatomy-top)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) .iso-shade{fill:var(--anatomy-shade-3)!important}
.iso-stage[data-focus] [data-part]:not([data-on]) text{fill:var(--anatomy-faint)!important}
.pc-controls{position:relative;display:flex;align-items:center;gap:12px;margin-top:-34px;padding:0 16px 14px;font:12px/1 var(--anatomy-mono,ui-monospace,Menlo,monospace);z-index:1}
.pc-btn{font:inherit;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-mid);padding:7px 10px;cursor:pointer;min-height:30px}
.pc-btn:hover{border-color:var(--anatomy-strong)}
.pc-btn:disabled{color:var(--anatomy-lo);border-color:var(--anatomy-faint);cursor:default}
.pc-sharpen{margin-left:auto}
.pc-dots{display:flex;gap:5px}
.pc-dots i{width:6px;height:6px;border:1px solid var(--anatomy-mid);border-radius:50%}
.pc-dots i[data-on]{background:var(--anatomy-strong);border-color:var(--anatomy-strong)}
.pc-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iso-plate{padding-bottom:84px}
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
<header class="pc-head"><h1>Anatomy of a pencil</h1><p>A wooden pencil looks like one thing. It's five, each solving a problem the others can't.</p></header>
${plateBody}
<section class="pc-parts"><h2>The parts</h2><p class="tip">Point at a part to find it in the figure; click it to take the pencil apart down to it.</p><ol>${PARTS.map(({ id, title, text }, index) => `<li data-select="${id}" tabindex="0" role="button" aria-label="${title}: show it in the figure"><span class="num">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></li>`).join("")}</ol></section>`;

const name = theme === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomy of a pencil", theme, body, script: kitScript() + live + EXPAND_JS }));
console.log("wrote", name);
