-- Full-resolution geography is used for analysis. Simplification happens only at export.
CREATE TABLE ntas AS
SELECT nta2020 AS id, ntaname AS name, boroname AS borough,
       ST_GeomFromWKB(wkb) AS geom
FROM input_ntas;

CREATE TABLE recipient_points AS
SELECT *, ST_Transform(ST_Point(longitude,latitude), 'EPSG:4326','EPSG:2263',always_xy:=true) AS geom
FROM recipients WHERE longitude IS NOT NULL;

-- Keep all boundary candidates in this audit. The historical NTA assignment is
-- retained for the funding series, rather than silently overwritten.
CREATE TABLE spatial_candidates AS
SELECT p.id, n.id AS spatial_nta
FROM recipient_points p JOIN ntas n ON ST_Covers(n.geom,p.geom);

CREATE TABLE nta_assignment_audit AS
SELECT p.id,p.name,p.nta AS recorded_nta,
       string_agg(c.spatial_nta, ', ' ORDER BY c.spatial_nta) AS spatial_candidates,
       count(c.spatial_nta) AS candidate_count,
       CASE WHEN count(c.spatial_nta)=0 THEN 'no polygon match'
            WHEN bool_or(c.spatial_nta=p.nta) THEN 'agrees'
            ELSE 'different assignment' END AS result
FROM recipient_points p LEFT JOIN spatial_candidates c USING(id)
GROUP BY p.id,p.name,p.nta;

CREATE TABLE nta_funding AS
SELECT n.id,n.name,n.borough,n.geom,
       CAST(COALESCE(sum(p.cents2024),0) AS BIGINT) AS cents2024,
       CAST(COALESCE(sum(p.cents2025),0) AS BIGINT) AS cents2025,
       count(p.id) FILTER(WHERE p.cents2024<>0 OR p.cents2025<>0) AS recipient_count
FROM ntas n LEFT JOIN recipients p ON p.nta=n.id
GROUP BY n.id,n.name,n.borough,n.geom;

-- Preserve directory row identity. Empty coordinates do not turn into (0,0).
CREATE TABLE directory_all AS
SELECT CAST(row_number() OVER()-1 AS INTEGER) AS record_id,
       "Organization Name" AS name, NULLIF("Discipline",'') AS discipline,
       TRY_CAST("Longitude" AS DOUBLE) AS longitude,
       TRY_CAST("Latitude" AS DOUBLE) AS latitude
FROM input_directory;

CREATE TABLE directory AS
SELECT *, ST_Transform(ST_Point(longitude,latitude),'EPSG:4326','EPSG:2263',always_xy:=true) AS geom
FROM directory_all
WHERE longitude BETWEEN -74.3 AND -73.6 AND latitude BETWEEN 40.4 AND 41.0;

CREATE INDEX directory_spatial_index ON directory USING RTREE(geom);

-- An independently inspectable directory-to-neighborhood spatial join.
CREATE TABLE directory_nta_candidates AS
SELECT d.record_id,n.id AS nta FROM directory d JOIN ntas n ON ST_Covers(n.geom,d.geom);

-- Largest dollar decline, one example per rounded coordinate. No random sample.
CREATE TABLE anchors AS
SELECT * FROM (
  SELECT *,row_number() OVER(
    PARTITION BY round(longitude,5),round(latitude,5)
    ORDER BY change_cents,name,id) AS coordinate_rank
  FROM recipient_points WHERE change_cents<0
) WHERE coordinate_rank=1
ORDER BY change_cents,name,id LIMIT 12;

-- EPSG:2263 uses US survey feet: 0.5 mile = 2,640 feet.
CREATE TABLE buffers AS SELECT id,ST_Buffer(geom,2640) AS geom FROM anchors;

CREATE TABLE nearby_counts AS
SELECT a.id,count(d.record_id) AS nearby_records
FROM anchors a LEFT JOIN directory d ON ST_DWithin(a.geom,d.geom,2640)
GROUP BY a.id;

-- A design proposal, not a discovered organizational or financial relationship.
CREATE TABLE proposal_links AS
WITH nearest AS (
  SELECT a.id AS from_id,b.id AS to_id,ST_Distance(a.geom,b.geom) AS distance_feet,
         row_number() OVER(PARTITION BY a.id ORDER BY ST_Distance(a.geom,b.geom),b.id) AS rank
  FROM anchors a JOIN anchors b ON a.id<>b.id
), unique_pairs AS (
  SELECT least(from_id,to_id) AS from_id,greatest(from_id,to_id) AS to_id,
         min(distance_feet) AS distance_feet
  FROM nearest WHERE rank=1 GROUP BY 1,2
)
SELECT p.*,ST_MakeLine(a.geom,b.geom) AS geom
FROM unique_pairs p JOIN anchors a ON p.from_id=a.id JOIN anchors b ON p.to_id=b.id;
