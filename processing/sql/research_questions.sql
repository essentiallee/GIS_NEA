-- Dollar losses and percentage losses answer different questions.
-- A zero or negative baseline does not yield a meaningful funding-loss percentage.
SELECT id,name,recipient_count,
       cents2024/100.0 AS fy2024_usd,cents2025/100.0 AS fy2025_usd,
       (cents2025-cents2024)/100.0 AS change_usd,
       CASE WHEN cents2024 > 0 THEN 100.0*(cents2025-cents2024)/cents2024 END AS change_percent
FROM nta_funding
WHERE cents2024<>0 OR cents2025<>0
ORDER BY change_usd,name;
