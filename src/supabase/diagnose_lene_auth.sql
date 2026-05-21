select u.email, u.raw_app_meta_data->>'member_id' as member_id from auth.users u where lower(trim(u.email)) = lower('leneruud@msn.com');
