-- Diagnose: PT-kunde synlig for alle PT pga. hydrate-trainer-data som matchet customer_type ILIKE '%medlem%'
-- (treffer også «PT-kunde»). Kode er rettet til eksakt «medlem».
-- Kjør diagnose for Lene:

select id, name, email, customer_type, owner_user_id::text, is_active
from public.members
where lower(trim(email)) = 'leneruud@msn.com'
order by created_at;

-- Sikre at alle rader er PT-kunde (ikke delt Medlem):
-- update public.members
-- set customer_type = 'PT-kunde'
-- where lower(trim(email)) = 'leneruud@msn.com'
--   and lower(trim(customer_type)) <> 'medlem';
