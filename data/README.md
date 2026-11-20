# Data preparation for this starter

## dcla-organizations.geojson

- Input: `DCLA_Cultural_Organizations_20261022.csv`, supplied directory snapshot, 2,535 records.
- Longitude/latitude converted to numbers; retain latitude 40.4-41.0 and longitude -74.3 to -73.6.
- Output: 2,268 real points in WGS84 longitude/latitude (EPSG:4326).
- 267 missing/out-of-range coordinate rows are not drawn. No locations were guessed or newly geocoded.
- Attributes: source row ID, organization name, and discipline. Phone numbers and street addresses are not included in the web export.
- Each point is a directory record, not a verified open public venue. Potential aliases are not silently consolidated.

## nyc-ntas.geojson

- Input: supplied DCP `dcp_ct2020_wi.shp`, 2,327 tracts, project release 26b.
- Project to EPSG:2263, dissolve by `nta2020`, retain NTA name and borough.
- Simplify 35 feet with topology preservation for display, then transform to EPSG:4326.
- Output: 262 NTA areas. This display simplification was not used for earlier spatial assignments.
- No funding, population, poverty, or zoning measures are stored in these polygons yet.

Original downloads remain outside this public website folder.

## Interactive funding story additions — November 18, 2026

`funding.json` combines the existing processed `observed_organization_year_cents.csv`, `organization_locations.csv`, `census_geocoder_response.csv`, and `NEA_NTA_observed_2024_2025_cents.csv`. Original source records are not modified.

- Funding source: NEA assistance transactions downloaded through USAspending, https://www.usaspending.gov/ . NEA grant search: https://apps.nea.gov/grantsearch/ . Annual measures are federal fiscal years, not calendar years.
- The processed scope totals $15,415,348.31 for FY2024 and $6,465,444.37 for FY2025, a 58.1% decrease. It is the earlier project’s filtered transaction scope, not a claim about all NEA spending everywhere.
- There are 434 recipients with positive FY2024 net funding, 177 with positive FY2025 net funding, and 358 recipients whose annual net amount decreased. Recipient identifiers, not transaction rows or physical venue counts, are counted.
- All signed net amounts remain in the accounting and popups. Positive recipient amounts produce upward columns; no grant is not proof of closure.
- Locations use the preserved Census geocoder batch matches, restricted to the NYC display extent. No new addresses are guessed or geocoded. Locations are recipient addresses, not necessarily public program locations or audience catchments.
- $235,000 of FY2024 net funding and $109,948.80 of FY2025 net funding lack coordinates in this web export. Those amounts remain in the annual totals. Coordinate availability and NTA assignment are separate conditions; a located point can still have an unknown processed NTA assignment.
- `story-ntas.geojson` adds categorical colors to the existing display geography. Colors identify NTAs, not funding rank. Earlier unsimplified spatial assignments are retained.
- Chapter 5 pairs neighborhood net totals at representative points inside the NTA polygons. It uses a different scale from recipient columns, shared by both fiscal years. Negative NTA net values appear as outlined ground markers, with signed values in popups.
- Half-mile examples are the twelve largest recorded dollar declines among mapped recipients, sorted by decline and then name, with one example per coordinate rounded to five decimals. Nearby counts now use DuckDB Spatial ST_DWithin in EPSG:2263, with a projected radius of 2,640 US survey feet. The previous web prototype used a 0.804672 km great-circle distance; Lincoln Center changes from 60 to 59 nearby records under the projected method. Directory duplicates, co-located records, and the recipient itself where present remain included; these are record counts, not verified counts of distinct open venues.
- Chapter 7 uses DCLA directory discipline categories. The directory-to-NEA recipient linkage has not been completed.
- Chapter 8 connects selected examples to their nearest other example by projected EPSG:2263 distance in DuckDB Spatial. These are illustrative proposed connections, not observed organizational partnerships or financial transfers. No reserve or survival model is run here.

## Direct source links

- DCLA Cultural Organizations, supplied October 2026 snapshot: https://data.cityofnewyork.us/d/u35m-9t32
- NYC DCP census geography / 2020 NTA framework: https://www.nyc.gov/content/planning/pages/resources/datasets/census-tracts
- U.S. Census address geocoder: https://geocoding.geo.census.gov/
- USAspending transaction data: https://www.usaspending.gov/
- NEA grant search: https://apps.nea.gov/grantsearch/


## Python rebuild and query workflow

All data preparation is now in `processing/pipeline.py` and its SQL files. The annotated `processing/workflow.ipynb` runs the same workflow locally in VS Code. Edit chapter writing in `content/chapters.json`; `data/chapters.json` is regenerated. See `processing/README.md` for input paths, accounting rules, query examples, and outputs. `data/processing-manifest.json` records hashes, versions, counts, and the NTA audit. The local DuckDB database, extension cache, and CSV/Parquet reports are in the ignored `processing/build/` directory.


## Chapter 1: directory scope and historical context

Chapter 1 maps 2,268 of 2,535 records in the supplied file
`DCLA_Cultural_Organizations_20261022.csv`. October 22, 2026 is the date
encoded in the supplied filename, not a verified last-update date for each
organization. The map does not establish a complete 2026 inventory, current
operating status, NEA funding receipt, or change since 2019. Equal-size point
symbols use the directory's recorded discipline; co-located records may overlap.

- [DCLA Cultural Organizations, NYC Open Data (u35m-9t32)](https://data.cityofnewyork.us/d/u35m-9t32).
- [National Endowment for the Arts, About](https://www.arts.gov/about): agency role and arts participation.
- [National Endowment for the Arts, 1989 Annual Report](https://www.arts.gov/sites/default/files/NEA-Annual-Report-1989.pdf): historical context for funding controversy.
