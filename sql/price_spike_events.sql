-- One row per spike event: a run of consecutive 5-min intervals with RRP >= $300/MWh in a region.
CREATE OR REPLACE TABLE mellabs_006.default.price_spike_events
COMMENT 'NEM price spike events (RRP >= $300/MWh, consecutive 5-min intervals grouped). Derived from workshop_demo.energy_utilities.aemo_price_demand_5min.'
AS
WITH flagged AS (
  SELECT region_id, interval_start, interval_end, rrp_aud_mwh, total_demand_mw,
         CASE WHEN LAG(interval_end) OVER (PARTITION BY region_id ORDER BY interval_end) = interval_start
              THEN 0 ELSE 1 END AS new_run
  FROM workshop_demo.energy_utilities.aemo_price_demand_5min
  WHERE rrp_aud_mwh >= 300
),
runs AS (
  SELECT *, SUM(new_run) OVER (PARTITION BY region_id ORDER BY interval_end) AS run_no FROM flagged
)
SELECT
  concat(region_id, '-', date_format(MIN(interval_start), 'yyyyMMddHHmm')) AS event_id,
  region_id,
  MIN(interval_start) AS event_start,
  MAX(interval_end) AS event_end,
  CAST(COUNT(*) * 5 AS INT) AS duration_min,
  ROUND(MAX(rrp_aud_mwh), 2) AS peak_price,
  ROUND(AVG(rrp_aud_mwh), 2) AS avg_price,
  ROUND(MAX(total_demand_mw), 1) AS peak_demand_mw,
  -- $ above threshold x hours: rewards both height and length
  ROUND(SUM((rrp_aud_mwh - 300) * total_demand_mw / 12.0) / 1e6, 3) AS severity_m_aud,
  to_date(MIN(interval_start)) AS event_date,
  hour(MIN(interval_start)) AS start_hour
FROM runs
GROUP BY region_id, run_no
