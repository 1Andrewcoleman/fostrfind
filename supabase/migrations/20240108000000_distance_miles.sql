-- Haversine distance in miles between two lat/lng pairs.
--
-- Phase 2 Step 22 filters by distance client-side so the foster's location
-- never has to round-trip to the server when they drag the slider. This
-- function exists so that future work can push the filter server-side
-- (e.g. `dogs.select(..., .rpc('dogs_within_miles', {...}))`) without
-- re-teaching the UI a new distance contract.
--
-- Inputs may be null (shelters/fosters without geocoded locations) — returns
-- null in that case so the caller can treat it as "unknown distance" rather
-- than "0 miles away".
create or replace function public.distance_miles(
  lat_a double precision,
  lon_a double precision,
  lat_b double precision,
  lon_b double precision
) returns double precision
language plpgsql
immutable
parallel safe
as $$
declare
  earth_radius_miles constant double precision := 3958.8;
  d_lat double precision;
  d_lon double precision;
  r_lat1 double precision;
  r_lat2 double precision;
  h double precision;
begin
  if lat_a is null or lon_a is null or lat_b is null or lon_b is null then
    return null;
  end if;

  d_lat := radians(lat_b - lat_a);
  d_lon := radians(lon_b - lon_a);
  r_lat1 := radians(lat_a);
  r_lat2 := radians(lat_b);

  h := sin(d_lat / 2) ^ 2
     + cos(r_lat1) * cos(r_lat2) * sin(d_lon / 2) ^ 2;

  return earth_radius_miles * 2 * atan2(sqrt(h), sqrt(1 - h));
end;
$$;
