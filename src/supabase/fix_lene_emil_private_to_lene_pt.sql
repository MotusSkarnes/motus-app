-- Keep Lene Ruud and Emil Ringstad private to lene@motus-skarnes.no (not iben@motus-skarnes.no).
-- Applied 2026-05-18.

-- Lene: member row m1 owned by Lene PT auth id
-- update public.members
-- set owner_user_id = (select id from auth.users where lower(email) = lower('lene@motus-skarnes.no') limit 1),
--     customer_type = 'PT-kunde'
-- where id = 'm1';

-- Emil: duplicate shared Medlem row deactivated; data moved to member-c1pntb7
-- update public.training_programs
-- set member_id = 'member-c1pntb7',
--     owner_user_id = (select id from auth.users where lower(email) = lower('lene@motus-skarnes.no') limit 1)
-- where member_id = 'member-nmn08uu';
-- update public.workout_logs ...
-- update public.chat_messages ...
-- update public.members set is_active = false where id = 'member-nmn08uu';

-- Verify:
select id, name, email, customer_type, owner_user_id, is_active
from public.members
where lower(trim(email)) in (lower('leneruud@msn.com'), lower('emil.ringstad@icloud.com'))
   or id in ('m1', 'm2', 'member-c1pntb7', 'member-nmn08uu')
order by email, id;
