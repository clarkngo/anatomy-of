// Renders the home-page grid from anatomies.json.
(async function () {
  const grid = document.getElementById("grid");
  const filters = document.getElementById("filters");
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

  function renderFilters() {
    filters.innerHTML = "";
    for (const k of kinds) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = k === "all" ? "Everything" : k[0].toUpperCase() + k.slice(1) + "s";
      b.setAttribute("aria-pressed", String(k === active));
      b.onclick = () => { active = k; renderFilters(); renderGrid(); };
      filters.appendChild(b);
    }
  }

  function renderGrid() {
    const shown = entries.filter((e) => active === "all" || e.kind === active);
    if (!shown.length) {
      grid.innerHTML = '<p class="empty">Nothing dissected here yet.</p>';
      return;
    }
    grid.innerHTML = "";
    for (const e of shown) {
      const a = document.createElement("a");
      a.className = "card";
      a.href = e.slug + "/";
      a.innerHTML = `
        <span class="kind"></span>
        <h2></h2>
        <p></p>
        <span class="parts"></span>`;
      a.querySelector(".kind").textContent = e.kind;
      a.querySelector("h2").textContent = "Anatomy of " + e.title;
      a.querySelector("p").textContent = e.summary;
      a.querySelector(".parts").textContent = e.parts ? `${e.parts} parts` : "";
      grid.appendChild(a);
    }
  }

  renderFilters();
  renderGrid();
})();
