begin;

alter table public.movies
  add column if not exists continents text[] not null default ARRAY['Worldwide']::text[],
  add column if not exists regions text[] not null default ARRAY['Global']::text[],
  add column if not exists territories text[] not null default ARRAY['WW']::text[];

alter table public.tv_shows
  add column if not exists continents text[] not null default ARRAY['Worldwide']::text[],
  add column if not exists regions text[] not null default ARRAY['Global']::text[],
  add column if not exists territories text[] not null default ARRAY['WW']::text[];

update public.movies
set continents = case when continents is null or cardinality(continents) = 0 then ARRAY['Worldwide']::text[] else continents end,
    regions = case when regions is null or cardinality(regions) = 0 then ARRAY['Global']::text[] else regions end,
    territories = case when territories is null or cardinality(territories) = 0 then ARRAY['WW']::text[] else territories end;

update public.tv_shows
set continents = case when continents is null or cardinality(continents) = 0 then ARRAY['Worldwide']::text[] else continents end,
    regions = case when regions is null or cardinality(regions) = 0 then ARRAY['Global']::text[] else regions end,
    territories = case when territories is null or cardinality(territories) = 0 then ARRAY['WW']::text[] else territories end;

create table if not exists public.geographic_territories (
  code text primary key,
  name text not null,
  region_name text not null,
  continent_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.geographic_territories (code, name, region_name, continent_name) values
  ('WW', 'Worldwide', 'Global', 'Worldwide'),
  ('DZ', 'Algeria', 'North Africa', 'Africa'), ('AO', 'Angola', 'Central Africa', 'Africa'), ('BJ', 'Benin', 'West Africa', 'Africa'),
  ('BW', 'Botswana', 'Southern Africa', 'Africa'), ('BF', 'Burkina Faso', 'West Africa', 'Africa'), ('CM', 'Cameroon', 'Central Africa', 'Africa'),
  ('CV', 'Cape Verde', 'West Africa', 'Africa'), ('TD', 'Chad', 'Central Africa', 'Africa'), ('CD', 'Democratic Republic of the Congo', 'Central Africa', 'Africa'),
  ('CG', 'Republic of the Congo', 'Central Africa', 'Africa'), ('CI', 'Côte d’Ivoire', 'West Africa', 'Africa'), ('EG', 'Egypt', 'North Africa', 'Africa'),
  ('ET', 'Ethiopia', 'East Africa', 'Africa'), ('GA', 'Gabon', 'Central Africa', 'Africa'), ('GM', 'Gambia', 'West Africa', 'Africa'),
  ('GH', 'Ghana', 'West Africa', 'Africa'), ('GN', 'Guinea', 'West Africa', 'Africa'), ('KE', 'Kenya', 'East Africa', 'Africa'),
  ('LR', 'Liberia', 'West Africa', 'Africa'), ('LY', 'Libya', 'North Africa', 'Africa'), ('ML', 'Mali', 'West Africa', 'Africa'),
  ('MR', 'Mauritania', 'West Africa', 'Africa'), ('MA', 'Morocco', 'North Africa', 'Africa'), ('MZ', 'Mozambique', 'Southern Africa', 'Africa'),
  ('NA', 'Namibia', 'Southern Africa', 'Africa'), ('NE', 'Niger', 'West Africa', 'Africa'), ('NG', 'Nigeria', 'West Africa', 'Africa'),
  ('RW', 'Rwanda', 'East Africa', 'Africa'), ('SN', 'Senegal', 'West Africa', 'Africa'), ('SL', 'Sierra Leone', 'West Africa', 'Africa'),
  ('SO', 'Somalia', 'East Africa', 'Africa'), ('ZA', 'South Africa', 'Southern Africa', 'Africa'), ('SS', 'South Sudan', 'East Africa', 'Africa'),
  ('TZ', 'Tanzania', 'East Africa', 'Africa'), ('TG', 'Togo', 'West Africa', 'Africa'), ('TN', 'Tunisia', 'North Africa', 'Africa'),
  ('UG', 'Uganda', 'East Africa', 'Africa'), ('ZM', 'Zambia', 'Southern Africa', 'Africa'), ('ZW', 'Zimbabwe', 'Southern Africa', 'Africa'),
  ('CA', 'Canada', 'North America', 'North America'), ('MX', 'Mexico', 'North America', 'North America'), ('US', 'United States', 'North America', 'North America'),
  ('AR', 'Argentina', 'South America', 'South America'), ('BR', 'Brazil', 'South America', 'South America'), ('CL', 'Chile', 'South America', 'South America'),
  ('CO', 'Colombia', 'South America', 'South America'), ('PE', 'Peru', 'South America', 'South America'), ('CN', 'China', 'East Asia', 'Asia'),
  ('IN', 'India', 'South Asia', 'Asia'), ('ID', 'Indonesia', 'Southeast Asia', 'Asia'), ('JP', 'Japan', 'East Asia', 'Asia'),
  ('MY', 'Malaysia', 'Southeast Asia', 'Asia'), ('PK', 'Pakistan', 'South Asia', 'Asia'), ('PH', 'Philippines', 'Southeast Asia', 'Asia'),
  ('SA', 'Saudi Arabia', 'Western Asia', 'Asia'), ('KR', 'South Korea', 'East Asia', 'Asia'), ('TW', 'Taiwan', 'East Asia', 'Asia'),
  ('TH', 'Thailand', 'Southeast Asia', 'Asia'), ('AE', 'United Arab Emirates', 'Western Asia', 'Asia'), ('AT', 'Austria', 'Central Europe', 'Europe'),
  ('BE', 'Belgium', 'Western Europe', 'Europe'), ('DK', 'Denmark', 'Northern Europe', 'Europe'), ('FI', 'Finland', 'Northern Europe', 'Europe'),
  ('FR', 'France', 'Western Europe', 'Europe'), ('DE', 'Germany', 'Western Europe', 'Europe'), ('IE', 'Ireland', 'Northern Europe', 'Europe'),
  ('IT', 'Italy', 'Southern Europe', 'Europe'), ('NL', 'Netherlands', 'Western Europe', 'Europe'), ('NO', 'Norway', 'Northern Europe', 'Europe'),
  ('PT', 'Portugal', 'Southern Europe', 'Europe'), ('ES', 'Spain', 'Southern Europe', 'Europe'), ('SE', 'Sweden', 'Northern Europe', 'Europe'),
  ('CH', 'Switzerland', 'Western Europe', 'Europe'), ('GB', 'United Kingdom', 'Northern Europe', 'Europe'), ('AU', 'Australia', 'Australia and New Zealand', 'Oceania'),
  ('NZ', 'New Zealand', 'Australia and New Zealand', 'Oceania')
on conflict (code) do update set
  name = excluded.name,
  region_name = excluded.region_name,
  continent_name = excluded.continent_name,
  active = true;

create index if not exists geographic_territories_region_idx on public.geographic_territories(region_name);
create index if not exists geographic_territories_continent_idx on public.geographic_territories(continent_name);
create index if not exists movies_regions_gin_idx on public.movies using gin(regions);
create index if not exists movies_territories_gin_idx on public.movies using gin(territories);
create index if not exists tv_shows_regions_gin_idx on public.tv_shows using gin(regions);
create index if not exists tv_shows_territories_gin_idx on public.tv_shows using gin(territories);

create table if not exists public.content_availability (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('movie', 'tv_show')),
  content_id uuid not null,
  continent text,
  region text,
  territory_code text,
  territory_name text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (content_type, content_id, continent, region, territory_code)
);

create index if not exists content_availability_lookup_idx
  on public.content_availability(content_type, content_id, territory_code);

alter table public.geographic_territories enable row level security;
alter table public.content_availability enable row level security;

drop policy if exists "Territories readable by everyone" on public.geographic_territories;
create policy "Territories readable by everyone" on public.geographic_territories
  for select using (active = true);

drop policy if exists "Content availability readable by everyone" on public.content_availability;
create policy "Content availability readable by everyone" on public.content_availability
  for select using (true);

drop policy if exists "Admins can manage territories" on public.geographic_territories;
create policy "Admins can manage territories" on public.geographic_territories
  for all using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Admins can manage content availability" on public.content_availability;
create policy "Admins can manage content availability" on public.content_availability
  for all using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create or replace function public.validate_content_territories()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  invalid_code text;
begin
  if new.territories is null or cardinality(new.territories) = 0 then
    raise exception 'At least one territory is required';
  end if;

  select code into invalid_code
  from unnest(new.territories) as code
  where not exists (
    select 1 from public.geographic_territories gt
    where gt.code = code and gt.active = true
  )
  limit 1;

  if invalid_code is not null then
    raise exception 'Unknown or inactive territory code: %', invalid_code;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_movie_territories on public.movies;
create trigger validate_movie_territories
before insert or update of territories on public.movies
for each row execute function public.validate_content_territories();

drop trigger if exists validate_tv_show_territories on public.tv_shows;
create trigger validate_tv_show_territories
before insert or update of territories on public.tv_shows
for each row execute function public.validate_content_territories();

commit;
