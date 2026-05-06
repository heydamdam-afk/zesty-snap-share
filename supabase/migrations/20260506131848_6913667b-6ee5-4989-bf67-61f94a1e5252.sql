INSERT INTO public.platform_admins (user_id, email)
SELECT id, lower(email) FROM auth.users WHERE lower(email) = 'dbreteau@gmail.com'
ON CONFLICT DO NOTHING;