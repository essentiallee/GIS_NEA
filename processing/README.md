# Python data preparation and query guide

The website reads prepared data. It does not perform spatial joins, choose examples,
calculate nearby counts, or create geographic buffers in JavaScript.

## What each tool does

- **Python** runs the steps, checks results, and writes the exports.
- **DuckDB + SQL** reads CSVs, joins recipient IDs, sums integer cents, sorts losses,
  groups neighborhoods, and stores a local database you can query again.
- **DuckDB Spatial** joins points to full NTA polygons, creates half-mile buffers,
  counts nearby records, and prepares proposed nearest-neighbor connections.
- **GeoPandas** reads the original tract shapefile and dissolves it into NTAs.
  Shapely geometry is used through GeoPandas. Display simplification occurs only
  after the full-resolution analytical geography is built.
- **JavaScript / MapLibre** draws the exported layers, handles scrolling and clicks,
  and animates heights and colors. Those animation calculations are presentation,
  not a second data-analysis pipeline.

## Starting inputs

This pipeline begins with the **previously audited eligible transactions**, not
unfiltered USAspending downloads. It retains those earlier inclusion decisions.
It checks the existing integer cents against transaction obligation amounts and
checks federal fiscal years against action dates. It never adds award summaries
or subawards to transaction totals.

It reuses the saved Census batch-geocoder response. It does **not** contact the
geocoder again or treat every automated match as a verified venue entrance.
Historical recipient names and NTA assignments come from the existing location
accounting table. The independent full-polygon spatial join is kept as an audit;
it does not silently overwrite historical assignments.

Required files:

1. `eligible_transactions.csv`, `organization_locations.csv`,
   `census_geocoder_response.csv`, and `observed_organization_year_cents.csv`.
2. Original `dcp_ct2020_wi.shp` and its `.dbf`, `.shx`, and `.prj` companions.
3. Raw `DCLA_Cultural_Organizations_20261022.csv`.
4. Editable chapter writing in `content/chapters.json`.

## Run locally

From the `GIS_NEA` folder:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r processing/requirements.txt
python processing/pipeline.py --config processing/config.local.json
```

A local configuration file is set up on this computer. It is ignored by Git
because it contains local file paths. For a different computer, copy
`config.example.json` to `config.local.json` and update its three paths.
Relative paths are resolved from the configuration file's folder.

The first run downloads DuckDB's official spatial extension. Later runs reuse it.
Source data is read without modification. Validation finishes before web exports
are replaced. A failed validation leaves the previous web exports in place.

## Use the query tool

The pipeline builds `processing/build/analysis.duckdb`. The query helper opens it
in read-only mode. The database and extension cache are ignored by Git.

```sh
python processing/query.py --sql "SELECT * FROM accounting"
python processing/query.py --file processing/sql/research_questions.sql
python processing/query.py --sql "SELECT * FROM nearby_counts" --csv processing/build/nearby.csv
```

For example, this query answers which neighborhoods have the largest dollar
losses. A zero or negative FY2024 baseline produces no percentage estimate:

```python
import duckdb
con = duckdb.connect("processing/build/analysis.duckdb", read_only=True)
con.sql("""
    SELECT name,
           cents2024 / 100.0 AS fy2024_usd,
           cents2025 / 100.0 AS fy2025_usd,
           (cents2025-cents2024) / 100.0 AS change_usd,
           CASE WHEN cents2024 > 0 THEN 100.0*(cents2025-cents2024)/cents2024 END AS change_percent
    FROM nta_funding
    ORDER BY change_usd
""").show()
con.close()
```

Use `workflow.ipynb` directly in VS Code with the local `.venv` Python kernel.
All explanations are `#` comments inside Python code cells. Its final cells query
the resulting database directly.

## Important tables

| Table | One row represents |
|---|---|
| `transactions` | One audited eligible transaction, with signed integer cents |
| `annual_funding` | One recipient's FY2024 and FY2025 net funding |
| `recipients` | Recipient funding joined to historical location accounting |
| `accounting` | Annual totals split into located/unlocated amounts |
| `ntas` | A full-resolution neighborhood polygon in EPSG:2263 |
| `nta_assignment_audit` | A comparison of recorded and newly joined NTA codes |
| `nta_funding` | Signed funding totals grouped by recorded NTA |
| `directory_all` / `directory` | Raw directory records / coordinate-valid records |
| `directory_nta_candidates` | Directory records spatially joined to NTA polygons |
| `anchors` | Twelve mapped decline examples, one per rounded coordinate |
| `nearby_counts` | Number of directory records within each example's half-mile |
| `proposal_links` | Illustrative nearest-neighbor pairs, not observed partnerships |

## Geographic rules and checks

- Analysis uses EPSG:2263 in **US survey feet**. Half a mile is 2,640 feet.
- Point coordinates are interpreted as longitude, latitude using `always_xy`.
- The polygon join uses `ST_Covers`, so points on boundaries remain inspectable.
  All candidates are retained in the audit, including any multiple matches.
- Nearby counts use `ST_DWithin`; a spatial index is available on directory points.
  This replaces Python loops comparing every point pair.
- Anchor selection sorts by dollar decline, then name and ID; one example is
  retained per coordinate rounded to five decimal places. It is not random.
- DCLA duplicates and co-located records remain included. A count is a count of
  records, potentially including the anchor itself, not verified unique open venues.
- Projection is a documented change from the first web prototype's spherical
  distance. In the current inputs, Lincoln Center's nearby count changes from
  60 to 59. The other eleven counts agree.
- The export includes 82 NTAs with nonzero net funding in either year. The earlier 81-NTA graphic omitted Astoria (North)–Ditmars–Steinway, which has $0 in FY2024 and a −$5,000 FY2025 net adjustment. Including that NTA changes the displayed count, not the overall annual totals.
- Negative funding is retained. It is never converted to zero in analysis;
  upward map columns encode positive values and popups retain signed amounts.

Checks reject duplicate transaction/location/geocoder identifiers, missing
location-accounting records, mismatched dollar/cents or fiscal-year values,
differences from the accepted annual series, and unreconciled funding totals.
Unlocated recipients stay in the accounting. No location is invented.

## Exports

- `data/funding.json`: signed amounts, recipient metadata, selected examples, statistics.
- `data/map-sources.json`: ready-to-draw footprints, buffers, points, and proposal lines.
- `data/story-ntas.geojson`, `data/nyc-ntas.geojson`: display geography, simplified 35 feet.
- `data/dcla-organizations.geojson`: cleaned directory points.
- `data/chapters.json`: draft writing with key quantitative metrics refreshed.
- `data/processing-manifest.json`: counts, method, versions, input hashes, and audit summary.
- `processing/build/reports/`: accounting, NTA audit, unlocated records, nearby counts,
  neighborhood summaries, and columnar Parquet summaries.

The private local build database contains intermediate tables. GitHub Pages only
needs the public JSON/GeoJSON exports, not Python, DuckDB, or a database server.

## What is still outside this pipeline

It does not verify 2019–2025 institutional closures, establish a policy cause for
funding changes, join poverty estimates, measure visitor journeys, match DCLA
disciplines to NEA recipients, or calculate redistribution/survival outcomes.
Those remain explicit research or scenario steps.

## Documentation

- DuckDB Python API: https://duckdb.org/docs/1.4/clients/python/overview
- DuckDB Spatial: https://duckdb.org/docs/1.4/core_extensions/spatial/overview
- DuckDB Spatial functions: https://duckdb.org/docs/1.4/core_extensions/spatial/functions
- GeoPandas dissolve: https://geopandas.org/en/stable/docs/user_guide/aggregation_with_dissolve.html
- Census geocoder: https://geocoding.geo.census.gov/



## Venue rings and discipline colors (Chapters 1 and 7)

All 2,268 geolocated DCLA records are drawn as equal-size, single-outline rings. Color comes from the recorded DCLA discipline field, with 21 categories including Not recorded. The Python export supplies type colors and category record counts. Ring size changes only with zoom for legibility; it never represents funding, distance, density, or importance. Co-located records remain at their original coordinates and can overlap. There is no clustering, jitter, or invented venue location. The earlier ornamental concentric rings and squares have been removed from Chapter 1 and from the public data exports.

The website and Figma use the same type palette in Chapters 1 and 7. The full category key shows record counts, not a historical count of open venues and not discipline-specific NEA funding. The directory-to-NEA discipline linkage remains pending.
