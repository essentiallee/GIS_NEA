# NEA / NYC Cultural Infrastructure

A beginner-friendly, black-and-white interactive mapping project for **Assignment 04: Representation & Interactivity**.

**Research question:** Where do declining NEA obligations overlap with fewer nearby listed cultural organizations, and which places warrant further investigation?

## Current version

The starter displays **2,268 DCLA directory points** and **262 NTA areas**. Click a point for its name and discipline; use the layer panel to toggle layers. Funding, buffers, poverty, and zoning are planned additions and are not yet displayed.

The directory has 2,535 records; 267 have missing or out-of-range coordinates and are not plotted. A recorded address may be an office, mailing address, or public venue. It does not confirm historic or current operating status.

## Open in VS Code and preview

1. Open this `GIS_NEA` folder in VS Code.
2. Open `index.html` to read the HTML and comments.
3. Use the **Live Server** extension and select **Go Live**.
4. Open the local URL shown by VS Code, usually `http://127.0.0.1:5500/`.

Use a local server rather than double-clicking the HTML file: the browser must load the YAML and GeoJSON files over HTTP.

Alternatively, in a terminal inside this folder:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/`. Internet access is required for the mapping libraries loaded from unpkg. No basemap API key is needed for this starter.

## Files and their roles

```text
GIS_NEA/
  index.html                      Page content and library imports
  css/site.css                    Grayscale layout and typography
  maps/nyc.yaml                   Starting view, layers, symbols, popups
  style.json                      White map canvas
  data/dcla-organizations.geojson  Supplied directory points
  data/nyc-ntas.geojson            Derived neighborhood areas
  data/README.md                  Data preparation notes
  CODE_SOURCES.md                 Tutorial, template, and AI contribution
  README.md                       Setup, research, and source links
```

**HTML** describes the page. **CSS** controls its appearance. **YAML** describes the map. **GeoJSON** contains geographic shapes and attributes.

All local paths are relative to `index.html`, following the course's plain HTML template. Do not add leading `/` characters when publishing under a GitHub repository subfolder.

## Data sources: in use

| Data | Publisher / link | Period or version | Project use |
| --- | --- | --- | --- |
| DCLA Cultural Organizations | [NYC Department of Cultural Affairs, dataset u35m-9t32](https://data.cityofnewyork.us/d/u35m-9t32) | Supplied October 22, 2026 download | Organization names, disciplines, and supplied coordinates; displayed now |
| NYC Census Tracts (2020 US Census) | [NYC Department of City Planning](https://www.nyc.gov/content/planning/pages/resources/datasets/census-tracts); [metadata](https://s-media.nyc.gov/agencies/dcp/assets/files/pdf/data-tools/bytes/nyct2020_metadata.pdf) | Supplied release 26b, 2026; 2020 geography | Tracts dissolved by `nta2020` to derive the displayed NTA areas |
| 2020 Neighborhood Tabulation Areas: definitions | [NYC DCP, dataset 9nt8-h7nd](https://data.cityofnewyork.us/d/9nt8-h7nd) | 2020 statistical geography | Reference for NTA meaning and boundaries; the current shapes were derived from the tract source above |

**NTA = Neighborhood Tabulation Area.** These are statistical groupings of census tracts, not zoning districts. They include nonresidential areas. The starter uses no population denominator or vulnerability score.

## Data sources: assembled or planned next

| Data | Publisher / link | Period | Intended use |
| --- | --- | --- | --- |
| NEA financial assistance prime transactions | [USAspending.gov award search](https://www.usaspending.gov/search) | Supplied October 8, 2026 extract; federal FY2022-FY2025, main comparison FY2024-FY2025 | Sum signed `federal_action_obligation` amounts by recipient and year; assistance listing 45.024 and the agreed named NYC recipient scope |
| DCLA Programs Funding | [NYC DCLA, dataset y6fv-k6p7](https://data.cityofnewyork.us/d/y6fv-k6p7) | Supplied October 22, 2026 download; select city FY2024-FY2025 | Compare municipal program awards with NEA changes; years are encoded in application IDs in the supplied extract |
| DCLA Cultural Institutions Group Funding | [NYC DCLA, dataset ka27-qx5k](https://data.cityofnewyork.us/d/ka27-qx5k) | Supplied October 22, 2026 download; select city FY2024-FY2025 | Compare operating and energy support for CIG institutions |
| Poverty status: ACS B17021 | [U.S. Census Bureau table](https://data.census.gov/table/ACSDT5Y2024.B17021); [field definitions](https://api.census.gov/data/2024/acs/acs5/groups/B17021.html) | 2020-2024 ACS five-year estimates, proposed | Join census-tract poverty counts to NTA geography; sum numerator and poverty universe before calculating percentages |
| Total population: ACS B01003 | [U.S. Census Bureau table](https://data.census.gov/table/ACSDT5Y2024.B01003); [field definitions](https://api.census.gov/data/2024/acs/acs5/groups/B01003.html) | 2020-2024 ACS five-year estimates, proposed | Population context and organization counts per resident, if used |
| Zoning districts and zoning map amendments | [NYC DCP GIS Zoning Features](https://www.nyc.gov/content/planning/pages/resources/datasets/gis-zoning-features); [supplied project Original folder](https://drive.google.com/drive/u/0/folders/1LXZ7jAOqARPrLm8m6oN2ULA4PVU9xMed) | Supplied 2026 files; adopted amendments filtered by effective dates October 1, 2021-September 30, 2025 in the earlier sandbox | Add a contextual zoning layer; record effective dates independently of funding changes |
| Historic venue status and program changes | Individual organizations' dated announcements, annual reports, archived websites, and verified reporting | 2024-2025; specific case sources still to be selected | Verify public venues, suspensions, closures, and program changes |

The supplied zoning sources are `dcp_zoningdistricts.shp` and `zoning.gdb`, layer `nyzma`; `nyzma_metadata.pdf` describes the amendment records. Use the retained source versions, not an undocumented replacement with the latest download. The other source files are available in the linked Original folder; private Drive access may be required.

## Earlier location processing

[Census Geocoder documentation](https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html) documents the earlier NEA address-geocoding workflow (cached October 8, 2026, benchmark `Public_AR_Current`). The current starter uses coordinates already supplied in the DCLA directory. These two location sources must be distinguished when adding NEA data.

## Policy context and interpretation

- [NEA FY2025 Agency Financial Report](https://www.arts.gov/sites/default/files/NEA-FY2025-AFR.pdf): background on the agency's FY2025 activity and priorities.
- The earlier filtered project extract totals $15,415,348.31 for federal FY2024 and $6,465,444.37 for FY2025. These are signed net obligations for the selected pool, not all NYC cultural support or cash payments.
- Federal FY2024 is October 1, 2023-September 30, 2024; FY2025 is October 1, 2024-September 30, 2025. City fiscal years run July-June.
- ACS five-year estimates describe a pooled calendar period. They are neighborhood context, not annual fiscal-year poverty measurements. Keep estimates, margins of error, and missing-value flags.
- Lower annual obligations do not establish closure or executive-order causation. Fewer nearby directory records do not establish vulnerability.
- Half-mile buffers, when added, should be labeled as straight-line proximity; they do not establish walking access or interchangeable programs.

## Course and code sources

- [Interactive Mapping Part 2](https://designpractices.org/tutorials/09-interactive-mapping-part-2/)
- [Plain HTML course template](https://github.com/design-practices/html-maplibre-template/)
- [Assignment 04: Representation & Interactivity](https://designpractices.org/assignments/04-representation/)
- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [maplibre-yaml documentation](https://docs.maplibre-yaml.org/)
- See [CODE_SOURCES.md](CODE_SOURCES.md) for what Codex helped adapt and what you should be able to explain.

## Next working steps

1. Confirm the starter opens and that point popups and layer toggles work.
2. Add reviewed FY2024/FY2025 funding fields and explanatory legends.
3. Add proximity or zoning context only when it answers a clear question.
4. Check the black-and-white hierarchy, keyboard navigation, and phone layout.
5. Use GitHub Desktop to review, commit, and push your changes; then configure GitHub Pages. This starter does not enable hosting or publish anything automatically.
