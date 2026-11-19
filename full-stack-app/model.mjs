// The request, as a small pure model: which stations a request visits and how long each takes.
// The figure's motion, readout, stopwatch and timing bars all come from trace().
//
// Toy numbers with a real order of magnitude: about 20 ms each way to a nearby server, a session
// lookup and a cache round trip of about 1 ms, an indexed lookup of a few ms, and a sequential scan
// of a million-row table in the tens of milliseconds. Real values vary with hardware and load.

export const ROWS = 1000000; // rows in the orders table
export const USER = 7; // the signed-in user
export const ORDERS = [
  { id: 42, status: "shipped", total: "38.50" },
  { id: 57, status: "packed", total: "12.00" },
  { id: 61, status: "paid", total: "74.25" },
];
export const COST = { click: 0, request: 20, route: 0.1, auth: 1, handler: 2, cache: 1, orm: 0.5, dbIndex: 2, dbScan: 90, response: 20, render: 8 };
export const HOPS = ["click", "request", "route", "auth", "handler", "cache", "orm", "db", "response", "render"];

// state: { signedIn, warm (the cache already holds this user's orders), indexed (orders.user_id has an index) }
export function trace({ signedIn, warm, indexed }) {
  const hit = signedIn && warm;
  const ran = {
    click: true, request: true, route: true, auth: true,
    handler: signedIn, cache: signedIn, orm: signedIn && !hit, db: signedIn && !hit,
    response: true, render: true,
  };
  const ms = {};
  for (const h of HOPS) ms[h] = !ran[h] ? 0 : h === "db" ? (indexed ? COST.dbIndex : COST.dbScan) : COST[h];
  const total = HOPS.reduce((a, h) => a + ms[h], 0);
  return {
    status: signedIn ? 200 : 401,
    hit,
    fills: signedIn && !hit, // a miss writes the result into the cache on the way back
    rowsRead: ran.db ? (indexed ? ORDERS.length : ROWS) : 0,
    ran, ms, total: Math.round(total * 10) / 10,
  };
}
