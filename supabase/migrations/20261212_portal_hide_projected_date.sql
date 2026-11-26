-- Clients see only the studio's planned delivery date; the internal projection stays private.
create or replace view public.portal_projects as
 SELECT id, code, title, client_id, type, status, hard_deadline, promised_date,
    CASE WHEN promised_date IS NOT NULL AND forecast_date > promised_date THEN promised_date + 1 ELSE promised_date END AS forecast_date,
    health, cover_image_url, emoji, review_link_url, runtime_seconds, aspect_ratios,
    ( SELECT g.name FROM studio_gates g
       WHERE g.id = p.current_gate_id AND g.portal_visible = true AND g.archived_at IS NULL) AS current_stage,
    updated_at, closed_at
   FROM studio_projects p
  WHERE portal_visible = true AND archived_at IS NULL
    AND status = ANY (ARRAY['lead','quoted','active','on_hold','parked','delivered','paid'])
    AND client_id IN ( SELECT portal_client_ids() AS portal_client_ids);
