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
