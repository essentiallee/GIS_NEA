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

Official sources, dates, and source limitations are linked in the main README. Original downloads remain outside this public website folder.
