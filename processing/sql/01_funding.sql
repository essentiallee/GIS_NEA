-- Keep cents as integers. Do not remove negative adjustments.
CREATE TABLE transactions AS
SELECT assistance_transaction_unique_key AS transaction_id,
       recipient_uei AS id, recipient_name AS name,
       CAST(action_date AS DATE) AS action_date,
       CAST(fy AS INTEGER) AS fiscal_year,
       CAST(cents AS BIGINT) AS cents,
       CAST(ROUND(CAST(federal_action_obligation AS DECIMAL(20,2))*100) AS BIGINT) AS checked_cents
FROM input_transactions;

-- One row per recipient, rather than one row per award or transaction.
CREATE TABLE annual_funding AS
SELECT id,
       CAST(SUM(CASE WHEN fiscal_year=2024 THEN cents ELSE 0 END) AS BIGINT) AS cents2024,
       CAST(SUM(CASE WHEN fiscal_year=2025 THEN cents ELSE 0 END) AS BIGINT) AS cents2025
FROM transactions
GROUP BY id;

CREATE TABLE recipient_locations AS
SELECT recipient_uei AS id, recipient_name AS name,
       COALESCE(NULLIF(nta2020,''),'UNMAPPED') AS nta
FROM input_locations;

CREATE TABLE geocoder AS
SELECT id, status, matched_address,
       TRY_CAST(split_part(coordinate_text, ',', 1) AS DOUBLE) AS longitude,
       TRY_CAST(split_part(coordinate_text, ',', 2) AS DOUBLE) AS latitude
FROM input_geocoder;

CREATE TABLE recipients AS
SELECT a.*, l.name, l.nta,
       CASE WHEN g.status='Match' AND g.longitude BETWEEN -74.3 AND -73.6
                 AND g.latitude BETWEEN 40.4 AND 41.0 THEN g.longitude END AS longitude,
       CASE WHEN g.status='Match' AND g.longitude BETWEEN -74.3 AND -73.6
                 AND g.latitude BETWEEN 40.4 AND 41.0 THEN g.latitude END AS latitude,
       g.status AS geocode_status,
       a.cents2025-a.cents2024 AS change_cents
FROM annual_funding a
LEFT JOIN recipient_locations l USING(id)
LEFT JOIN geocoder g USING(id);

CREATE TABLE accounting AS
SELECT y.fiscal_year,
       CAST(SUM(CASE WHEN y.fiscal_year=2024 THEN cents2024 ELSE cents2025 END) AS BIGINT) AS total_cents,
       CAST(SUM(CASE WHEN longitude IS NOT NULL
                     THEN CASE WHEN y.fiscal_year=2024 THEN cents2024 ELSE cents2025 END ELSE 0 END) AS BIGINT) AS located_cents,
       CAST(SUM(CASE WHEN longitude IS NULL
                     THEN CASE WHEN y.fiscal_year=2024 THEN cents2024 ELSE cents2025 END ELSE 0 END) AS BIGINT) AS unlocated_cents,
       CAST(SUM(CASE WHEN nta='UNMAPPED'
                     THEN CASE WHEN y.fiscal_year=2024 THEN cents2024 ELSE cents2025 END ELSE 0 END) AS BIGINT) AS unassigned_nta_cents
FROM recipients CROSS JOIN (VALUES (2024),(2025)) y(fiscal_year)
GROUP BY y.fiscal_year ORDER BY y.fiscal_year;
