select u.email, u.raw_app_meta_data->>'member_id' as member_id, u.raw_app_meta_data->>'role' as role
from auth.users u
where lower(trim(u.email)) in ('resepsjon@motus-skarnes.no', 'ruudlene@gmail.com')
order by u.email;
