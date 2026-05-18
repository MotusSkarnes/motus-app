select count(*)::text as tp_m1 from public.training_programs where member_id = 'm1';
select count(*)::text as wl_m1 from public.workout_logs where member_id = 'm1';
select count(*)::text as tp_nmn from public.training_programs where member_id = 'member-nmn08uu';
