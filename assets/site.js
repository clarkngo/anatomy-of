// Renders the home-page plates from anatomies.json.
(async function () {
  const grid = document.getElementById("grid");
  const filters = document.getElementById("filters");
  const count = document.getElementById("count");
  if (!grid) return;

  let entries = [];
  try {
    const res = await fetch("anatomies.json", { cache: "no-cache" });
    entries = await res.json();
  } catch (err) {
    grid.innerHTML = '<p class="empty">Could not load anatomies.json.</p>';
    return;
  }

  const kinds = ["all", ...new Set(entries.map((e) => e.kind))];
  let active = "all";
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function renderFilters() {
    filters.innerHTML = "";
    if (kinds.length < 3) return; // one kind: nothing to filter
    for (const kind of kinds) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = kind === "all" ? "all" : kind + "s";
      b.setAttribute("aria-pressed", String(kind === active));
      b.onclick = () => { active = kind; renderFilters(); renderGrid(); };
      filters.appendChild(b);
    }
  }

  function renderGrid() {
    const shown = entries.filter((e) => active === "all" || e.kind === active);
    count.textContent = plural(shown.length, "figure") + ", all live";
    if (!shown.length) {
      grid.innerHTML = '<p class="empty">Nothing dissected here yet.</p>';
      return;
    }
    grid.innerHTML = "";
    shown.forEach((e, i) => {
      const a = document.createElement("a");
      a.className = "plate";
      a.href = e.slug + "/";
      a.innerHTML = `
        <span class="corner tl"></span>
        <span class="corner tr"></span>
        <img alt="" loading="lazy">
        <div class="cap"><strong></strong><span></span></div>`;
      a.querySelector(".tl").textContent = "Fig " + (entries.indexOf(e) + 1);
      a.querySelector(".tr").textContent = e.kind + (e.parts ? " · " + e.parts + " parts" : "");
      const img = a.querySelector("img");
      if (e.thumb) img.src = e.thumb; else img.remove();
      a.querySelector("strong").textContent = "Anatomy of " + e.title;
      a.querySelector(".cap span").textContent = e.summary;
      a.setAttribute("aria-label", "Anatomy of " + e.title + ". " + e.summary);
      grid.appendChild(a);
    });
  }

  renderFilters();
  renderGrid();
})();
