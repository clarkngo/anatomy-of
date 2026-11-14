// The hose body, drawn from offsets: shared by the build and (via toString) the page,
// which rebuilds it as layers slide. Self-contained: everything comes in as arguments.
// K is the iso kit plus the lathe kit; M is the model; off[i] is how far layer i has slid
// out of the cut end (toward +x); ferrule is how far the ferrule has slid back along the hose.
export function hoseSvg(K, M, P, off, ferrule) {
  const F = K.frameOf([M.X0, 0, M.ZC], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const V = K.viewOf(P);
  const at = (p) => K.iso(p, P);
  const tan = Math.tan((M.braidAngle * Math.PI) / 180);
  const S = (paths, style) => K.solidSvg(paths, style);
  const L = (d, style) => K.lineSvg(d, style);

  // braid wires: two families of helices at the braid angle, drawn where they face the viewer
  const helices = (s0, s1, r, slide) => {
    let d = "";
    for (const sign of [1, -1]) {
      for (let c = 0; c < M.carriers; c++) {
        const theta0 = (2 * Math.PI * c) / M.carriers + (sign > 0 ? 0 : Math.PI / M.carriers);
        let run = [];
        const flush = () => { if (run.length > 1) d += K.pathOf(run); run = []; };
        const n = Math.max(2, Math.ceil((s1 - s0) / 0.5));
        for (let j = 0; j <= n; j++) {
          const s = s0 + ((s1 - s0) * j) / n;
          const theta = theta0 + (sign * (s + slide) * tan) / r;
          const facing = K.dot3(K.radialOf(F, theta), V);
          if (facing > 0.04) run.push(at(K.pointOf(F, s, r, theta)));
          else flush();
        }
        flush();
      }
    }
    return d;
  };

  const out = { behind: "", front: "", layers: [] };
  const ff = M.ferrule[0] - ferrule; // where the hose disappears into the ferrule
  M.layers.forEach((layer, i) => {
    const [rIn, rOut] = layer.r;
    const s0 = -off[i];
    const lit = layer.kind === "braid";
    const style = { tone: layer.tone, lit };
    let svg = "";
    if (i === 0) {
      // the cover: one piece behind the ferrule, one in front of it
      out.behind = S(K.ringBand(ff, M.hoseEnd, rIn, rOut, F, P), style);
      svg = S(K.ringBand(s0, ff, rIn, rOut, F, P), style);
      svg += K.faceTextSvg(K.topMatrix([M.X0 - M.layline[1], 1.2], M.ZC + rOut, P, "x"), M.print, { size: 2.1, tone: "lo" });
    } else {
      const s1 = Math.max(s0 + 0.02, -off[i - 1]);
      const inner = lit && s1 - s0 > 0.5 ? L(helices(s0, s1, rOut, off[i]), { tone: "mid" }) : "";
      svg = S(K.ringBand(s0, s1, rIn, rOut, F, P), { ...style, inner });
      if (i === M.layers.length - 1) {
        // the bore: looking into the tube
        const ring = K.pathOf(Array.from({ length: 48 }, (_, j) => at(K.pointOf(F, s0, rIn, (2 * Math.PI * j) / 48))), true);
        svg += `<path class="iso-shade" data-shade="0" d="${ring}"/>` + L(ring, { tone: "lo" });
      }
      if (lit) svg += K.dotsSvg(Array.from({ length: M.carriers * 2 }, (_, j) => at(K.pointOf(F, s0, (rIn + rOut) / 2, (Math.PI * j) / M.carriers))), { size: 0.32, tone: "hi" });
    }
    out.layers.push(`<g data-part="${layer.part}">${svg}</g>`);
  });
  out.front = out.layers.join("");
  return out;
}
