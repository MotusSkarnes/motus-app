-- Ytelsesindekser for Motus PT-app (kjør i Supabase SQL Editor).
-- Reduserer seq scans og høy shared_blks_io på members, training_programs, workout_logs og chat_messages.
--
-- Viktig: Supabase SQL Editor kjører i transaksjon — bruk IKKE CONCURRENTLY her.
-- (CONCURRENTLY krever én setning om gangen utenfor transaksjon, f.eks. via psql.)
-- For normal størrelse på denne databasen er vanlig CREATE INDEX helt ok.

create index if not exists members_owner_user_id_created_at_idx
  on public.members (owner_user_id, created_at);

create index if not exists members_email_lower_idx
  on public.members (lower(trim(email)));

create index if not exists members_customer_type_idx
  on public.members (lower(trim(customer_type)))
  where customer_type is not null;

create index if not exists training_programs_owner_created_at_idx
  on public.training_programs (owner_user_id, created_at desc);

create index if not exists training_programs_member_created_at_idx
  on public.training_programs (member_id, created_at desc);

create index if not exists training_programs_template_idx
  on public.training_programs (member_id)
  where member_id = '__template__';

create index if not exists workout_logs_owner_created_at_idx
  on public.workout_logs (owner_user_id, created_at desc);

create index if not exists workout_logs_member_created_at_idx
  on public.workout_logs (member_id, created_at desc);

create index if not exists chat_messages_owner_created_at_idx
  on public.chat_messages (owner_user_id, created_at);

create index if not exists chat_messages_member_created_at_idx
  on public.chat_messages (member_id, created_at);

create index if not exists exercise_bank_active_name_idx
  on public.exercise_bank (name)
  where is_active is not false;

-- Etter indeksbygging: oppdater planlegger-statistikk
analyze public.members;
analyze public.training_programs;
analyze public.workout_logs;
analyze public.chat_messages;
analyze public.exercise_bank;
