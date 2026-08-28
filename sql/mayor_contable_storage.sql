-- ══════════════════════════════════════════════════════════════
--  BUCKET: libro mayor contable
--  Permite que Contabilidad suba mayor.xlsx desde el dashboard y que
--  quede disponible para todos los roles sin tener que pasar por
--  GitHub/Vercel. Cada carga nueva reemplaza (upsert) a la anterior.
-- ══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('mayor-contable', 'mayor-contable', true)
on conflict (id) do nothing;

drop policy if exists "mayor-contable acceso total" on storage.objects;
create policy "mayor-contable acceso total" on storage.objects
for all using (bucket_id = 'mayor-contable') with check (bucket_id = 'mayor-contable');
