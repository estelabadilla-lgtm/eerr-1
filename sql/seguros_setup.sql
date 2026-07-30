-- ══════════════════════════════════════════════════════════════
--  MÓDULO SEGUROS — Dashboard Financiero Grantt
--  Ejecutar completo en Supabase → SQL Editor → New query → Run
--  (Se puede volver a correr sin problema: usa IF NOT EXISTS / ON CONFLICT)
-- ══════════════════════════════════════════════════════════════

-- ── Tabla: Vehículos ──────────────────────────────────────────
create table if not exists seguros_vehiculos (
  id uuid primary key default gen_random_uuid(),
  patente text,
  tipo text,
  anio int,
  modelo text,
  marca text,
  color text,
  n_motor text,
  n_chasis text,
  uso text,
  asignado text,
  created_at timestamptz not null default now()
);

-- ── Tabla: Pólizas (vinculadas a un vehículo o a una entidad, ej. la bodega) ──
create table if not exists seguros_polizas (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid references seguros_vehiculos(id) on delete cascade,
  entidad text,
  categoria text not null check (categoria in ('robo_accidentes','robo_incendio','mercancia')),
  corredor text,
  n_poliza text,
  aseguradora text,
  moneda text default 'UF',
  total_cuotas int,
  valor_cuota numeric,
  valor_total numeric,
  renovacion boolean default true,
  dia_pago int check (dia_pago between 1 and 31),
  fecha_inicio date,
  fecha_termino date,
  notas text,
  updated_at timestamptz not null default now()
);

-- ── Tabla: Documentos subidos por póliza ─────────────────────
create table if not exists seguros_documentos (
  id uuid primary key default gen_random_uuid(),
  poliza_id uuid not null references seguros_polizas(id) on delete cascade,
  nombre_archivo text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- ── Actualiza updated_at automáticamente al editar una póliza ──
create or replace function seg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_seg_polizas_updated on seguros_polizas;
create trigger trg_seg_polizas_updated
before update on seguros_polizas
for each row execute function seg_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
-- Acceso abierto con la anon/publishable key, igual que el resto del
-- dashboard (que hoy no tiene login). Si más adelante quieren restringir
-- la edición, esto es lo primero que hay que endurecer.
alter table seguros_vehiculos enable row level security;
alter table seguros_polizas enable row level security;
alter table seguros_documentos enable row level security;

drop policy if exists "acceso total" on seguros_vehiculos;
create policy "acceso total" on seguros_vehiculos for all using (true) with check (true);

drop policy if exists "acceso total" on seguros_polizas;
create policy "acceso total" on seguros_polizas for all using (true) with check (true);

drop policy if exists "acceso total" on seguros_documentos;
create policy "acceso total" on seguros_documentos for all using (true) with check (true);

-- Permisos de tabla para los roles de la API (necesario porque el proyecto
-- se creó con "Automatically expose new tables" desactivado — sin esto,
-- PostgREST responde "Could not find the table ... in the schema cache"
-- aunque la tabla exista, porque el rol anon no tiene ningún privilegio sobre ella).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on seguros_vehiculos, seguros_polizas, seguros_documentos to anon, authenticated;

-- ── Storage: bucket para los PDF/fotos de pólizas ─────────────
insert into storage.buckets (id, name, public)
values ('polizas-docs', 'polizas-docs', true)
on conflict (id) do nothing;

drop policy if exists "polizas-docs acceso total" on storage.objects;
create policy "polizas-docs acceso total" on storage.objects
for all using (bucket_id = 'polizas-docs') with check (bucket_id = 'polizas-docs');


-- ══════════════════════════════════════════════════════════════
--  DATOS INICIALES — cargados desde "POLIZAS GRANTT 2026 ACTUALIZADA.xlsx",
--  pestaña "2026" (la más actualizada al 30-07-2026)
-- ══════════════════════════════════════════════════════════════

-- Vehículos (11 con patente + 1 pendiente de patente: Citroën Jumpy)
insert into seguros_vehiculos (id, patente, tipo, anio, modelo, marca, color, n_motor, n_chasis, uso, asignado) values
('a1a1a1a1-0000-4000-8000-000000000001','JFCW38',    'Furgón',        2016,'Transporter',            'Volkswagen',       'Blanco Ártico',   'CAA863802',          'WV1ZZZ7HZFH164590','Comercial','Bodega'),
('a1a1a1a1-0000-4000-8000-000000000002','TKBH69',    'Minibús',       2024,'Jumper',                 'Citroën',          'Blanco Ártico',   '10DZ934048676',     'VSSZZZ5FZL6500180','Comercial','Bodega'),
('a1a1a1a1-0000-4000-8000-000000000003','VSKR98',    'Camión',        2026,'FTR 1524 2AB',           'Chevrolet',        'Blanco',          '6HK1AA6389',         'JALFTR34PT7000210','Comercial','Bodega'),
('a1a1a1a1-0000-4000-8000-000000000004','LXYF36',    'Station Wagon', 2020,'Ateca',                  'Seat',             'Blanco Ártico',   'CZE833085',          'VSSZZZ5FZL6500180','Comercial','Cristóbal Vigil'),
('a1a1a1a1-0000-4000-8000-000000000005','PCVH-63',   'Camioneta',     2021,'Saveiro',                'Volkswagen',       'Gris Platino',    'CFZU69657',          '9BWJB45U6MP025445','Comercial','Alejandra'),
('a1a1a1a1-0000-4000-8000-000000000006','PBGG14-4',  'Camión',        2021,'Accelo 1016/44 (Euro V)','Mercedes Benz',    'Blanco Ártico',   '924990U1332996',     '9BM979078NB206633','Comercial','Bodega'),
('a1a1a1a1-0000-4000-8000-000000000007','THJC-77',   'Camioneta',     2024,'Saveiro',                'Volkswagen',       'Blanco Ártico',   'CWS589893',          '9BWJL45U9PP075205','Comercial','Marcelo'),
('a1a1a1a1-0000-4000-8000-000000000008','VYLP-49',   'Camioneta',     2026,'New Maverick',           'Ford',             'Gris Carbonizado','TRA59833',           '3FTTW8NAXTRA59833','Comercial','Cristóbal Vigil'),
('a1a1a1a1-0000-4000-8000-000000000009','VDDV 99-K', 'Camioneta',     2025,'Saveiro',                'Volkswagen',       'Blanco Candy',    'CWS661377',          '9BWJL45U8SP069579','Comercial','Alejandra'),
('a1a1a1a1-0000-4000-8000-000000000010','VZKD-91',   'Camioneta',     2026,'Poer',                   'Great Wall Motors','Plateado',        'GW4D20M26557000865','LGWCCF165VJ605136','Comercial','José Pérez'),
('a1a1a1a1-0000-4000-8000-000000000011', null,       'Furgón',        2026,'Jumpy',                  'Citroën',          'Blanco Hielo',    '101BAV4043999',      'VF7VLEHT0TZ004305','Comercial','Bodega');

-- Pólizas — Robo y Accidentes de Vehículos
insert into seguros_polizas (vehiculo_id, categoria, corredor, n_poliza, aseguradora, moneda, total_cuotas, valor_cuota, valor_total, renovacion, dia_pago, fecha_inicio, fecha_termino, notas) values
('a1a1a1a1-0000-4000-8000-000000000001','robo_accidentes','Ossa Covarrubias y Cía Ltda','40007',      'Mapfre','UF',10,3.640,36.400,true,20,'2026-06-27','2027-06-27',null),
('a1a1a1a1-0000-4000-8000-000000000002','robo_accidentes','Ossa Covarrubias y Cía Ltda','300560937',  'Reale', 'UF',10,2.764,27.640,true,5, '2026-04-16','2026-04-16','Fecha de término igual a la de inicio en el archivo original de la corredora — confirmar vigencia real.'),
('a1a1a1a1-0000-4000-8000-000000000003','robo_accidentes','Ossa Covarrubias y Cía Ltda','300550711',  'Reale', 'UF',10,8.036,80.360,true,5, '2026-02-04','2027-02-04',null),
('a1a1a1a1-0000-4000-8000-000000000004','robo_accidentes','Ossa Covarrubias y Cía Ltda','300573170',  'Reale', 'UF',10,2.259,22.590,true,5, '2026-06-08','2027-06-08',null),
('a1a1a1a1-0000-4000-8000-000000000005','robo_accidentes','Ossa Covarrubias y Cía Ltda','300538160',  'Reale', 'UF',11,2.003,22.033,true,5, '2025-12-29','2026-12-29',null),
('a1a1a1a1-0000-4000-8000-000000000006','robo_accidentes','Ossa Covarrubias y Cía Ltda','300566805',  'Reale', 'UF',10,3.305,33.050,true,5, '2026-05-12','2027-05-12',null),
('a1a1a1a1-0000-4000-8000-000000000007','robo_accidentes','Ossa Covarrubias y Cía Ltda','300549429',  'Reale', 'UF',10,2.227,22.270,true,5, '2026-02-01','2027-02-01',null),
('a1a1a1a1-0000-4000-8000-000000000008','robo_accidentes','Ossa Covarrubias y Cía Ltda','MP3723733-7','BCI',   'UF',10,1.620,16.200,true,10,'2026-06-16','2027-06-16',null),
('a1a1a1a1-0000-4000-8000-000000000009','robo_accidentes','Ossa Covarrubias y Cía Ltda','300561578',  'Reale', 'UF',10,2.142,21.420,true,5, '2026-04-30','2027-04-30',null),
('a1a1a1a1-0000-4000-8000-000000000010','robo_accidentes','Ossa Covarrubias y Cía Ltda','MP3736804',  'BCI',   'UF',11,1.830,20.130,true,10,'2026-07-09','2027-07-09',null),
('a1a1a1a1-0000-4000-8000-000000000011','robo_accidentes','Ossa Covarrubias y Cía Ltda','MP3742681-4','BCI',   'UF',10,2.020,20.200,true,20,'2026-07-24','2027-07-24','Falta ingresar la patente de este vehículo.');

-- Póliza — Robo e Incendio (bodega, sin vehículo asociado)
insert into seguros_polizas (vehiculo_id, entidad, categoria, corredor, n_poliza, aseguradora, moneda, total_cuotas, valor_cuota, valor_total, renovacion, dia_pago, fecha_inicio, fecha_termino) values
(null,'Bodega Santa Margarita 742','robo_incendio','Ossa Covarrubias y Cía Ltda','100089918','Reale','UF',10,21.925,219.250,true,5,'2026-03-17','2027-03-17');

-- Pólizas — Mercancía en Vehículos de la Bodega (transporte)
insert into seguros_polizas (vehiculo_id, categoria, corredor, n_poliza, aseguradora, moneda, total_cuotas, valor_cuota, valor_total, renovacion, dia_pago, fecha_inicio, fecha_termino, notas) values
('a1a1a1a1-0000-4000-8000-000000000006','mercancia','Ossa Covarrubias y Cía Ltda','243887-01','Contempora','UF',10,1.950,19.500,true,20,'2026-05-17','2027-05-17',null),
('a1a1a1a1-0000-4000-8000-000000000001','mercancia','Ossa Covarrubias y Cía Ltda',null,'Contempora','UF',10,2.499,24.990,true,20,'2026-06-27','2027-06-27','N° de póliza pendiente de confirmar con la corredora.'),
('a1a1a1a1-0000-4000-8000-000000000002','mercancia','Ossa Covarrubias y Cía Ltda',null,'Contempora','UF',10,2.499,24.990,true,20,'2026-06-27','2027-06-27','N° de póliza pendiente de confirmar con la corredora.'),
('a1a1a1a1-0000-4000-8000-000000000003','mercancia','Ossa Covarrubias y Cía Ltda',null,'Contempora','UF',10,2.499,24.990,true,20,'2026-06-27','2027-06-27','N° de póliza pendiente de confirmar con la corredora.');


-- ══════════════════════════════════════════════════════════════
--  MIGRACIÓN — Centro de Costo por vehículo (para agrupar la tabla
--  igual que el resto del dashboard: Logística, Ventas, Gerencia, etc.)
-- ══════════════════════════════════════════════════════════════
alter table seguros_vehiculos add column if not exists centro_costo text;

update seguros_vehiculos set centro_costo = 'Logística' where asignado = 'Bodega';
update seguros_vehiculos set centro_costo = 'Ventas'    where asignado in ('José Pérez','Alejandra','Marcelo');
update seguros_vehiculos set centro_costo = 'Gerencia'  where asignado = 'Cristóbal Vigil';


-- ══════════════════════════════════════════════════════════════
--  MIGRACIÓN — Documentos a nivel de vehículo, con categoría
--  (antes quedaban colgados de una póliza puntual; ahora "viven" con el
--  vehículo para que no se pierdan si se edita/borra una póliza, y para
--  poder subir también factura de compra, permiso de circulación, etc.)
-- ══════════════════════════════════════════════════════════════
alter table seguros_documentos add column if not exists vehiculo_id uuid references seguros_vehiculos(id) on delete cascade;
alter table seguros_documentos add column if not exists tipo_documento text not null default 'poliza_seguro';
alter table seguros_documentos alter column poliza_id drop not null;
grant select, insert, update, delete on seguros_documentos to anon, authenticated;

-- Documentos ya subidos: heredan el vehículo de su póliza...
update seguros_documentos d
set vehiculo_id = p.vehiculo_id
from seguros_polizas p
where d.poliza_id = p.id and p.vehiculo_id is not null and d.vehiculo_id is null;

-- ...y se desvinculan de esa póliza puntual (quedan solo del vehículo,
-- para que sobrevivan si esa póliza se edita o se elimina).
update seguros_documentos
set poliza_id = null
where vehiculo_id is not null;
