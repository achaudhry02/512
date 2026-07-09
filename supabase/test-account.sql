-- Optional local/demo test account for authenticated browser testing.
-- Run in the Supabase SQL editor for a development project only.
-- Login:
--   email: codex.pos.tester@gmail.com
--   password: TestPass123!

do $$
declare
  test_user_id uuid;
  test_email text := 'codex.pos.tester@gmail.com';
  test_password text := 'TestPass123!';
  store_id uuid;
begin
  select id into test_user_id from auth.users where email = test_email limit 1;

  if test_user_id is null then
    test_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      email_change_confirm_status,
      reauthentication_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      test_user_id,
      'authenticated',
      'authenticated',
      test_email,
      crypt(test_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      0,
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Codex POS Tester"}'::jsonb,
      now(),
      now(),
      false,
      false
    );

    insert into auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      test_user_id::text,
      test_user_id,
      jsonb_build_object('sub', test_user_id::text, 'email', test_email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.users
    set encrypted_password = crypt(test_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '',
        email_change_token_current = '',
        email_change_confirm_status = 0,
        reauthentication_token = '',
        updated_at = now(),
        deleted_at = null,
        banned_until = null
    where id = test_user_id;

    update auth.identities
    set identity_data = jsonb_build_object('sub', test_user_id::text, 'email', test_email, 'email_verified', true, 'phone_verified', false),
        updated_at = now()
    where user_id = test_user_id and provider = 'email';
  end if;

  insert into public.users (id, email, full_name)
  values (test_user_id, test_email, 'Codex POS Tester')
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, updated_at = now();

  select id into store_id from public.stores where user_id = test_user_id order by created_at limit 1;
  if store_id is null then
    insert into public.stores (user_id, name, address, city, state, zip)
    values (test_user_id, 'POS Test Store', null, null, null, null);
  end if;
end $$;
