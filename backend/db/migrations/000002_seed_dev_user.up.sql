insert into users (id, email, native_language, target_language)
values (
    '00000000-0000-0000-0000-000000000001',
    'dev@project-pn.local',
    'ko',
    'en'
)
on conflict (id) do nothing;
