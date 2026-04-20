-- Minimal seed data for fast end-to-end validation.
-- Run after schema setup.

insert into public.members (
  id, name, email, phone, birth_date, weight, height, level,
  membership_type, customer_type, days_since_activity, goal, focus,
  personal_goals, injuries, coach_notes
) values
  ('m1', 'Emma Hansen', 'emma@example.com', '900 11 111', '1991-06-14', '72', '168', 'Litt øvet',
   'Premium', 'PT-kunde', '1', 'Bli sterkere i hele kroppen', 'Helkroppsstyrke', 'Bygge gode rutiner', 'Ingen registrerte skader', 'Svarte godt på første program'),
  ('m2', 'Martin Johansen', 'martin@example.com', '900 22 222', '1984-03-05', '96', '182', 'Nybegynner',
   'Standard', 'Oppfølging', '9', 'Gå ned i fettprosent', 'Vaner og jevn aktivitet', 'Bedre kondisjon', 'Stiv hofte ved løping', 'Trenger enkel struktur')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  birth_date = excluded.birth_date,
  weight = excluded.weight,
  height = excluded.height,
  level = excluded.level,
  membership_type = excluded.membership_type,
  customer_type = excluded.customer_type,
  days_since_activity = excluded.days_since_activity,
  goal = excluded.goal,
  focus = excluded.focus,
  personal_goals = excluded.personal_goals,
  injuries = excluded.injuries,
  coach_notes = excluded.coach_notes;

insert into public.training_programs (id, member_id, title, goal, notes, exercises)
values
  ('11111111-1111-4111-8111-111111111111', 'm1', 'Helkropp 2 dager i uka', 'Bygge grunnstyrke', 'Start rolig og fokuser på teknikk.',
   '[
      {"id":"pe1","exerciseId":"e1","exerciseName":"Knebøy","sets":"3","reps":"8","weight":"40","restSeconds":"120","notes":"Kontrollert tempo"},
      {"id":"pe2","exerciseId":"e3","exerciseName":"Nedtrekk","sets":"3","reps":"10","weight":"35","restSeconds":"75","notes":"Trekk til bryst"}
    ]'::jsonb)
on conflict (id) do update set
  member_id = excluded.member_id,
  title = excluded.title,
  goal = excluded.goal,
  notes = excluded.notes,
  exercises = excluded.exercises;

insert into public.chat_messages (member_id, sender, text)
values
  ('m1', 'trainer', 'Husk rolig start denne uka.'),
  ('m1', 'member', 'Supert, jeg logger økten i kveld.'),
  ('m2', 'member', 'Kan du se over ukeplanen min?');
