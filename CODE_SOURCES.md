# Code sources and learning notes

## Sources

- Course tutorial: [Interactive Mapping Part 2](https://designpractices.org/tutorials/09-interactive-mapping-part-2/).
- Starting pattern: [Design Practices plain HTML MapLibre template](https://github.com/design-practices/html-maplibre-template/), particularly `full-page-map.html` and `maps/full-page.yaml` (consulted November 12, 2026).
- Mapping engine: [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/).
- YAML/custom-element library: [maplibre-yaml documentation](https://docs.maplibre-yaml.org/).
- Assignment: [04 Representation & Interactivity](https://designpractices.org/assignments/04-representation/).


## Figma visual redesign - November 17, 2026

Visual source: [GIS_Final, desktop frame 1:2](https://www.figma.com/design/PaYGMeDTtFoZWBah2SaZfV/GIS_Final?node-id=1-2).

Codex used the Figma design-to-code skill and the frame's design context/screenshot to implement its two rounded panels, spacing, colors, typography, circle asset, and source-footer placement in plain HTML/CSS. The left panel contains the existing interactive map; the right panel keeps the sparse composition from Figma. The placeholder title and footer copy were replaced with the project name and actual source links. Mobile stacking is an implementation adaptation because the supplied design has one desktop frame.

The original Figma SVG is stored at `assets/figma-title-circle.svg`. No screenshot of the Figma design is used as a website asset. MapLibre/YAML and the existing geographic data remain the mapping foundation.
# Interactive storyboard implementation — November 18, 2026

- Figma storyboard: https://www.figma.com/design/PaYGMeDTtFoZWBah2SaZfV/GIS_Final?node-id=21-25
- MapLibre GL JS map/camera/GeoJSON API: https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/
- MapLibre fill-extrusion specification: https://maplibre.org/maplibre-style-spec/layers/#fill-extrusion
- Course template reviewed: https://github.com/essentiallee/astro-maplibre-template/blob/main/src/stories/nyc.yaml
- `js/story.js` adapts the template's chapter/camera/layer concept to the existing plain HTML site. It does not install Astro or use the template's over-map scrolling layout. The earlier YAML map remains available in `maps/nyc.yaml` as a course reference; the interactive story uses MapLibre directly for the independent right-panel scroll and animated funding heights.
- All eight texts are draft storyboard copy, not a completed research narrative.
- Data-driven columns are drawn from local GeoJSON and funding JSON, not screenshots of Figma. The old circle SVG is no longer used because that element is absent from the updated design.
- Columns use exaggerated diagram heights, not actual building heights. Chapters 2–4 share a recipient scale; Chapter 5 has a separately labeled neighborhood scale.
- The browser shows negative NTA net amounts as outlined ground marks with signed values in popups. This replaces Figma's below-ground sketch because MapLibre extrusion heights cannot be negative.
- No closure history, poverty surface, audience travel, or actual redistribution is inferred. Chapter 8's illustrative nearest-neighbor connections do not calculate transfers.


## Python and DuckDB processing

- `processing/pipeline.py` orchestrates GeoPandas and DuckDB Spatial, with readable SQL in `processing/sql/`.
- `processing/query.py` provides a read-only SQL query tool for the local database; `processing/workflow.ipynb` provides the local VS Code notebook with Python comment annotations.
- `content/chapters.json` is the editable writing source; generated `data/chapters.json` refreshes key metrics.
- Geographic footprints, buffers, nearby counts, spatial joins, and proposed network geometry are computed in Python/SQL and exported to `data/map-sources.json`. Browser JavaScript now only loads, styles, and animates prepared layers.
- The original eligibility decisions and cached Census matches remain upstream inputs; no fresh geocoding or undisclosed filtering is performed.
- DuckDB Spatial documentation: https://duckdb.org/docs/1.4/core_extensions/spatial/overview
