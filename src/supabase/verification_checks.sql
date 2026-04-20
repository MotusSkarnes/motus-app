-- Quick sanity checks after setup / migration.

-- Counts per table
select 'members' as table_name, count(*) as row_count from public.members
union all
select 'training_programs', count(*) from public.training_programs
union all
select 'chat_messages', count(*) from public.chat_messages
union all
select 'workout_logs', count(*) from public.workout_logs;

-- Sample rows
select id, name, email, level, membership_type, customer_type
from public.members
order by created_at desc
limit 10;

select id, member_id, title, goal, created_at
from public.training_programs
order by created_at desc
limit 10;

select id, member_id, sender, text, created_at
from public.chat_messages
order by created_at desc
limit 20;

select id, member_id, program_title, date, status, created_at
from public.workout_logs
order by created_at desc
limit 20;
