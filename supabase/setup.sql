-- Run once in Supabase > SQL Editor. This table is private: browser users cannot read emails.
create table if not exists public.account_directory (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  constraint valid_username check (username ~ '^[a-z0-9_]{3,20}$')
);
alter table public.account_directory enable row level security;
revoke all on public.account_directory from anon, authenticated;
grant select on public.account_directory to service_role;

create or replace function public.sync_pickle_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_directory(id, username, email)
  values (new.id, lower(new.raw_user_meta_data->>'username'), new.email)
  on conflict (id) do update set username = excluded.username, email = excluded.email;
  return new;
end;
$$;
revoke all on function public.sync_pickle_account() from public, anon, authenticated;
drop trigger if exists pickle_account_sync on auth.users;
create trigger pickle_account_sync after insert or update of email, raw_user_meta_data
on auth.users for each row execute function public.sync_pickle_account();
