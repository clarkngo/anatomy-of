# anatomy-of

Labeled breakdowns of things, from real objects to abstract ideas.
Live site: https://clarkngo.github.io/anatomy-of/

## Structure

```
index.html          home page (grid built from anatomies.json)
anatomies.json      list of entries shown on the home page
assets/             shared CSS and JS
<slug>/index.html   one folder per anatomy, e.g. pencil/
_template/          starting point for a new entry
```

## Adding an anatomy

1. Copy `_template/` to a new folder named for the slug, e.g. `trust/`.
2. Edit its `index.html`: title, kind, lede, diagram, and parts.
3. Add an entry to `anatomies.json`:
   ```json
   { "slug": "trust", "title": "trust", "kind": "idea", "summary": "…", "parts": 4 }
   ```
   `kind` drives the filter buttons on the home page (e.g. `object`, `idea`, `system`).

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Deploy

GitHub Pages → Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
