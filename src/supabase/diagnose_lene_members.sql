select m.id, m.name, m.email, m.owner_user_id::text, u.email as owner_email
from public.members m
left join auth.users u on u.id = m.owner_user_id
where m.id in ('m1', 'member-nmn08uu') or lower(trim(m.email)) = lower('leneruud@msn.com');
