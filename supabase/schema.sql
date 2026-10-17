-- =====================================================================
--  SISTEMA CRIADERO — Esquema completo de base de datos (Supabase)
--  Cómo usarlo: Supabase > SQL Editor > New query > pegar todo > Run
--  Ejecutar UNA sola vez sobre un proyecto nuevo.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Utilidades
-- ---------------------------------------------------------------------

-- Fecha de hoy en hora argentina (el servidor de Supabase trabaja en UTC)
create or replace function public.hoy()
returns date
language sql stable
as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- Categoría de un animal según sus días de vida
create or replace function public.categoria_por_dias(p_dias int)
returns text
language sql immutable
as $$
  select case
    when p_dias < 70  then 'lechon'
    when p_dias < 120 then 'cachorro'
    else 'capon'
  end
$$;

-- ---------------------------------------------------------------------
--  Perfiles de usuario y roles
--    dueno     : acceso total (ventas, gastos, balance, usuarios)
--    empleado  : carga de datos operativos
--    pendiente : sin acceso hasta que el dueño lo habilite
-- ---------------------------------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nombre     text not null default '',
  rol        text not null default 'pendiente'
             check (rol in ('dueno', 'empleado', 'pendiente')),
  creado_en  timestamptz not null default now()
);

create or replace function public.mi_rol()
returns text
language sql stable security definer set search_path = public
as $$ select rol from public.perfiles where id = auth.uid() $$;

create or replace function public.es_dueno()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol() = 'dueno', false) $$;

create or replace function public.es_usuario()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol() in ('dueno', 'empleado'), false) $$;

-- El primer usuario que se crea es el dueño; los demás quedan "pendiente"
create or replace function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.perfiles where rol = 'dueno')
         then 'pendiente' else 'dueno' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Nunca dejar el sistema sin dueño
create or replace function public.proteger_ultimo_dueno()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.rol = 'dueno'
     and (tg_op = 'DELETE' or new.rol <> 'dueno')
     and not exists (select 1 from public.perfiles where rol = 'dueno' and id <> old.id) then
    raise exception 'Debe existir al menos un usuario dueño';
  end if;
  return coalesce(new, old);
end $$;

create trigger perfiles_proteger_dueno
  before update or delete on public.perfiles
  for each row execute function public.proteger_ultimo_dueno();

-- ---------------------------------------------------------------------
--  Insumos (catálogo de materias primas y remedios)
-- ---------------------------------------------------------------------
create table public.insumos (
  id         bigint generated always as identity primary key,
  nombre     text not null unique check (length(trim(nombre)) > 0),
  tipo       text not null check (tipo in ('nucleo', 'cereal', 'medicamento', 'otro')),
  unidad     text not null default 'kg' check (unidad in ('kg', 'l', 'unidad', 'dosis')),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

insert into public.insumos (nombre, tipo, unidad) values
  ('Núcleo Fase 1',       'nucleo', 'kg'),
  ('Núcleo Fase 2',       'nucleo', 'kg'),
  ('Núcleo Fase 3',       'nucleo', 'kg'),
  ('Núcleo Fase 4',       'nucleo', 'kg'),
  ('Núcleo Desarrollo',   'nucleo', 'kg'),
  ('Núcleo Terminación',  'nucleo', 'kg'),
  ('Núcleo Gestación',    'nucleo', 'kg'),
  ('Núcleo Lactancia',    'nucleo', 'kg'),
  ('Expeler de soja',     'cereal', 'kg'),
  ('Maíz',                'cereal', 'kg'),
  ('Afrechillo de trigo', 'cereal', 'kg');

-- ---------------------------------------------------------------------
--  Compras de materia prima / remedios
-- ---------------------------------------------------------------------
create table public.compras (
  id               bigint generated always as identity primary key,
  fecha            date not null default public.hoy(),
  insumo_id        bigint not null references public.insumos(id) on delete restrict,
  cantidad         numeric(12,2) not null check (cantidad > 0),
  precio_unitario  numeric(14,4) not null check (precio_unitario >= 0),
  total            numeric(16,2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  proveedor        text,
  notas            text,
  creado_por       uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en        timestamptz not null default now()
);
create index compras_fecha_idx  on public.compras (fecha);
create index compras_insumo_idx on public.compras (insumo_id);

-- ---------------------------------------------------------------------
--  Moliendas (preparación de alimento) con costo "congelado" del día
-- ---------------------------------------------------------------------
create table public.moliendas (
  id             bigint generated always as identity primary key,
  fecha          date not null default public.hoy(),
  preparacion    text not null check (preparacion in (
                   'fase_1', 'fase_2', 'fase_3', 'fase_4',
                   'desarrollo', 'terminacion', 'gestacion', 'lactancia')),
  kilos_totales  numeric(12,2) not null default 0,
  costo_total    numeric(16,2) not null default 0,
  costo_kg       numeric(14,4) not null default 0,
  notas          text,
  creado_por     uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now()
);
create index moliendas_fecha_idx on public.moliendas (fecha);

create table public.molienda_items (
  id           bigint generated always as identity primary key,
  molienda_id  bigint not null references public.moliendas(id) on delete cascade,
  insumo_id    bigint not null references public.insumos(id) on delete restrict,
  kilos        numeric(12,2) not null check (kilos > 0),
  precio_kg    numeric(14,4) not null check (precio_kg >= 0),   -- precio congelado ese día
  subtotal     numeric(16,2) generated always as (round(kilos * precio_kg, 2)) stored,
  unique (molienda_id, insumo_id)
);
create index molienda_items_insumo_idx on public.molienda_items (insumo_id);

-- ---------------------------------------------------------------------
--  Cerdas madres
-- ---------------------------------------------------------------------
create table public.cerdas (
  id             bigint generated always as identity primary key,
  caravana       text not null unique check (length(trim(caravana)) > 0),
  origen         text,
  fecha_ingreso  date not null default public.hoy(),
  precio_compra  numeric(14,2) check (precio_compra >= 0),
  estado         text not null default 'activa' check (estado in ('activa', 'descartada', 'muerta')),
  fecha_baja     date,
  motivo_baja    text,
  notas          text,
  creado_en      timestamptz not null default now(),
  check ((estado = 'activa') = (fecha_baja is null)),
  check (fecha_baja is null or fecha_baja >= fecha_ingreso)
);

-- ---------------------------------------------------------------------
--  Servicios (inseminaciones)
-- ---------------------------------------------------------------------
create table public.servicios (
  id                    bigint generated always as identity primary key,
  cerda_id              bigint not null references public.cerdas(id) on delete cascade,
  fecha                 date not null default public.hoy(),
  dosis                 smallint not null default 2 check (dosis between 1 and 10),
  fecha_probable_parto  date generated always as (fecha + 114) stored,
  resultado             text not null default 'pendiente'
                        check (resultado in ('pendiente', 'prenada', 'vacia', 'parida')),
  notas                 text,
  creado_en             timestamptz not null default now()
);
create index servicios_cerda_idx on public.servicios (cerda_id, fecha desc);

-- ---------------------------------------------------------------------
--  Partos (cada parto es una camada del stock)
-- ---------------------------------------------------------------------
create table public.partos (
  id               bigint generated always as identity primary key,
  cerda_id         bigint not null references public.cerdas(id) on delete restrict,
  servicio_id      bigint unique references public.servicios(id) on delete set null,
  fecha            date not null default public.hoy(),
  nacidos_totales  int not null check (nacidos_totales between 0 and 40),
  nacidos_muertos  int not null default 0 check (nacidos_muertos >= 0),
  nacidos_vivos    int generated always as (nacidos_totales - nacidos_muertos) stored,
  fecha_destete    date,
  destetados       int check (destetados >= 0),
  notas            text,
  creado_en        timestamptz not null default now(),
  check (nacidos_muertos <= nacidos_totales),
  check ((fecha_destete is null) = (destetados is null)),
  check (fecha_destete is null or fecha_destete >= fecha),
  check (destetados is null or destetados <= nacidos_totales - nacidos_muertos)
);
create index partos_cerda_idx on public.partos (cerda_id, fecha desc);
create index partos_fecha_idx on public.partos (fecha);

-- ---------------------------------------------------------------------
--  Ventas de animales (Vía 1 = banco con IVA, Vía 2 = sin factura)
-- ---------------------------------------------------------------------
create table public.ventas (
  id             bigint generated always as identity primary key,
  fecha          date not null default public.hoy(),
  via            smallint not null check (via in (1, 2)),
  categoria      text not null default 'capon'
                 check (categoria in ('capon', 'cachorro', 'lechon', 'descarte')),
  cantidad       int not null check (cantidad > 0),
  kilos          numeric(12,2) not null check (kilos > 0),
  devaste_pct    numeric(5,2) not null default 3 check (devaste_pct >= 0 and devaste_pct < 100),
  precio_kg      numeric(14,2) not null check (precio_kg >= 0),
  iva_pct        numeric(5,2) not null default 0 check (iva_pct >= 0 and iva_pct <= 50),
  kilos_netos    numeric(12,2) generated always as
                 (round(kilos * (1 - devaste_pct / 100), 2)) stored,
  kilo_promedio  numeric(10,2) generated always as
                 (round(kilos / cantidad, 2)) stored,
  subtotal       numeric(16,2) generated always as
                 (round(round(kilos * (1 - devaste_pct / 100), 2) * precio_kg, 2)) stored,
  iva            numeric(16,2) generated always as
                 (round(round(round(kilos * (1 - devaste_pct / 100), 2) * precio_kg, 2) * iva_pct / 100, 2)) stored,
  total          numeric(16,2) generated always as
                 (round(round(kilos * (1 - devaste_pct / 100), 2) * precio_kg, 2)
                  + round(round(round(kilos * (1 - devaste_pct / 100), 2) * precio_kg, 2) * iva_pct / 100, 2)) stored,
  comprador      text,
  notas          text,
  creado_en      timestamptz not null default now(),
  check (via = 1 or iva_pct = 0)
);
create index ventas_fecha_idx on public.ventas (fecha);

-- ---------------------------------------------------------------------
--  Bajas de stock (muertes, ventas, consumo propio)
-- ---------------------------------------------------------------------
create table public.bajas (
  id          bigint generated always as identity primary key,
  parto_id    bigint not null references public.partos(id) on delete cascade,
  fecha       date not null default public.hoy(),
  cantidad    int not null check (cantidad > 0),
  motivo      text not null check (motivo in ('muerte', 'venta', 'consumo', 'otro')),
  venta_id    bigint references public.ventas(id) on delete cascade,
  es_destete  boolean not null default false,
  notas       text,
  creado_en   timestamptz not null default now(),
  check ((motivo = 'venta') = (venta_id is not null))
);
create index bajas_parto_idx on public.bajas (parto_id);
create index bajas_venta_idx on public.bajas (venta_id);

-- ---------------------------------------------------------------------
--  Gastos (mano de obra, combustible, veterinaria, semen, extras)
-- ---------------------------------------------------------------------
create table public.gastos (
  id           bigint generated always as identity primary key,
  fecha        date not null default public.hoy(),
  categoria    text not null check (categoria in (
                 'mano_obra', 'combustible', 'veterinaria', 'semen', 'extras', 'otros')),
  descripcion  text not null check (length(trim(descripcion)) > 0),
  cantidad     numeric(12,2) check (cantidad > 0),
  monto        numeric(16,2) not null check (monto >= 0),
  notas        text,
  creado_en    timestamptz not null default now()
);
create index gastos_fecha_idx on public.gastos (fecha);

-- =====================================================================
--  Reglas de integridad (triggers)
-- =====================================================================

-- Las bajas nunca pueden superar los animales vivos de la camada
create or replace function public.validar_baja()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_vivos  int;
  v_fecha  date;
  v_total  int;
begin
  select nacidos_vivos, fecha into v_vivos, v_fecha
  from partos where id = new.parto_id;

  if new.fecha < v_fecha then
    raise exception 'La fecha (%) es anterior al nacimiento de la camada (%)',
      to_char(new.fecha, 'DD/MM/YYYY'), to_char(v_fecha, 'DD/MM/YYYY');
  end if;

  select coalesce(sum(cantidad), 0) into v_total from bajas where parto_id = new.parto_id;

  if v_total > v_vivos then
    raise exception 'La camada no tiene suficientes animales. Disponibles: %',
      greatest(v_vivos - (v_total - new.cantidad), 0);
  end if;
  return null;
end $$;

create trigger bajas_validar
  after insert or update on public.bajas
  for each row execute function public.validar_baja();

-- Al editar un parto, los vivos no pueden quedar por debajo de las bajas
-- y el servicio vinculado debe ser de la misma cerda
create or replace function public.validar_parto()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_bajas     int;
  v_serv      record;
begin
  if new.servicio_id is not null then
    select cerda_id, fecha into v_serv from servicios where id = new.servicio_id;
    if v_serv.cerda_id <> new.cerda_id then
      raise exception 'El servicio seleccionado pertenece a otra cerda';
    end if;
    if new.fecha < v_serv.fecha then
      raise exception 'La fecha de parto es anterior a la fecha de servicio';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(cantidad), 0) into v_bajas from bajas where parto_id = new.id;
    if new.nacidos_totales - new.nacidos_muertos < v_bajas then
      raise exception 'Esta camada ya tiene % bajas registradas; los nacidos vivos no pueden ser menos', v_bajas;
    end if;
    if exists (select 1 from bajas where parto_id = new.id and fecha < new.fecha) then
      raise exception 'Hay bajas registradas con fecha anterior a la nueva fecha de parto';
    end if;
  end if;
  return new;
end $$;

create trigger partos_validar
  before insert or update on public.partos
  for each row execute function public.validar_parto();

-- Mantener el resultado del servicio sincronizado con el parto
create or replace function public.sync_servicio_parto()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.servicio_id is not null
     and (tg_op = 'DELETE' or old.servicio_id is distinct from new.servicio_id) then
    update servicios set resultado = 'prenada' where id = old.servicio_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.servicio_id is not null then
    update servicios set resultado = 'parida' where id = new.servicio_id;
  end if;
  return null;
end $$;

create trigger partos_sync_servicio
  after insert or update or delete on public.partos
  for each row execute function public.sync_servicio_parto();

-- =====================================================================
--  Funciones de negocio (se llaman desde la aplicación)
-- =====================================================================

-- Guarda una molienda con sus ingredientes en una sola operación
create or replace function public.guardar_molienda(datos jsonb)
returns bigint
language plpgsql security invoker set search_path = public
as $$
declare
  v_id     bigint := nullif(datos->>'id', '')::bigint;
  v_item   jsonb;
  v_kilos  numeric;
  v_costo  numeric;
begin
  if jsonb_typeof(datos->'items') is distinct from 'array'
     or jsonb_array_length(datos->'items') = 0 then
    raise exception 'Agregá al menos un ingrediente a la molienda';
  end if;

  if v_id is null then
    insert into moliendas (fecha, preparacion, notas)
    values ((datos->>'fecha')::date, datos->>'preparacion', nullif(trim(datos->>'notas'), ''))
    returning id into v_id;
  else
    update moliendas
       set fecha = (datos->>'fecha')::date,
           preparacion = datos->>'preparacion',
           notas = nullif(trim(datos->>'notas'), '')
     where id = v_id;
    if not found then raise exception 'La molienda no existe'; end if;
    delete from molienda_items where molienda_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(datos->'items') loop
    if exists (select 1 from insumos where id = (v_item->>'insumo_id')::bigint and unidad <> 'kg') then
      raise exception 'Solo se pueden usar insumos medidos en kg dentro de una molienda';
    end if;
    insert into molienda_items (molienda_id, insumo_id, kilos, precio_kg)
    values (v_id, (v_item->>'insumo_id')::bigint, (v_item->>'kilos')::numeric, (v_item->>'precio_kg')::numeric);
  end loop;

  select sum(kilos), sum(subtotal) into v_kilos, v_costo
  from molienda_items where molienda_id = v_id;

  update moliendas
     set kilos_totales = v_kilos,
         costo_total   = v_costo,
         costo_kg      = round(v_costo / nullif(v_kilos, 0), 4)
   where id = v_id;

  return v_id;
end $$;

-- Guarda una venta y descuenta el stock automáticamente
-- (toma primero los animales más viejos de la categoría vendida)
create or replace function public.guardar_venta(datos jsonb)
returns bigint
language plpgsql security invoker set search_path = public
as $$
declare
  v_id     bigint   := nullif(datos->>'id', '')::bigint;
  v_fecha  date     := (datos->>'fecha')::date;
  v_via    smallint := (datos->>'via')::smallint;
  v_cat    text     := datos->>'categoria';
  v_cant   int      := (datos->>'cantidad')::int;
  v_resto  int;
  v_tomar  int;
  v_nombre text;
  r        record;
begin
  perform pg_advisory_xact_lock(hashtext('stock_animales'));

  if v_id is null then
    insert into ventas (fecha, via, categoria, cantidad, kilos, devaste_pct, precio_kg, iva_pct, comprador, notas)
    values (v_fecha, v_via, v_cat, v_cant,
            (datos->>'kilos')::numeric,
            coalesce((datos->>'devaste_pct')::numeric, 0),
            (datos->>'precio_kg')::numeric,
            case when v_via = 1 then coalesce((datos->>'iva_pct')::numeric, 10.5) else 0 end,
            nullif(trim(datos->>'comprador'), ''),
            nullif(trim(datos->>'notas'), ''))
    returning id into v_id;
  else
    update ventas set
      fecha = v_fecha, via = v_via, categoria = v_cat, cantidad = v_cant,
      kilos = (datos->>'kilos')::numeric,
      devaste_pct = coalesce((datos->>'devaste_pct')::numeric, 0),
      precio_kg = (datos->>'precio_kg')::numeric,
      iva_pct = case when v_via = 1 then coalesce((datos->>'iva_pct')::numeric, 10.5) else 0 end,
      comprador = nullif(trim(datos->>'comprador'), ''),
      notas = nullif(trim(datos->>'notas'), '')
    where id = v_id;
    if not found then raise exception 'La venta no existe'; end if;
    delete from bajas where venta_id = v_id;
  end if;

  if v_cat <> 'descarte' then
    v_resto := v_cant;
    for r in
      select p.id,
             p.nacidos_vivos - coalesce((select sum(b.cantidad) from bajas b where b.parto_id = p.id), 0) as vivos
        from partos p
       where p.fecha <= v_fecha
         and categoria_por_dias(v_fecha - p.fecha) = v_cat
       order by p.fecha, p.id
    loop
      exit when v_resto = 0;
      continue when r.vivos <= 0;
      v_tomar := least(r.vivos, v_resto);
      insert into bajas (parto_id, fecha, cantidad, motivo, venta_id)
      values (r.id, v_fecha, v_tomar, 'venta', v_id);
      v_resto := v_resto - v_tomar;
    end loop;

    if v_resto > 0 then
      v_nombre := case v_cat when 'capon' then 'capones' when 'cachorro' then 'cachorros' else 'lechones' end;
      raise exception 'Stock insuficiente: al % hay % % disponibles',
        to_char(v_fecha, 'DD/MM/YYYY'), v_cant - v_resto, v_nombre;
    end if;
  end if;

  return v_id;
end $$;

-- Registra (o corrige / anula) el destete de una camada.
-- La diferencia entre vivos y destetados se registra como muertes en lactancia.
create or replace function public.registrar_destete(p_parto bigint, p_fecha date, p_destetados int)
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  v_nac    int;
  v_pfecha date;
  v_vivos  int;
begin
  perform pg_advisory_xact_lock(hashtext('stock_animales'));

  select nacidos_vivos, fecha into v_nac, v_pfecha from partos where id = p_parto;
  if not found then raise exception 'Parto no encontrado'; end if;

  delete from bajas where parto_id = p_parto and es_destete;

  if p_destetados is null then
    update partos set fecha_destete = null, destetados = null where id = p_parto;
    return;
  end if;

  if p_fecha is null or p_fecha < v_pfecha then
    raise exception 'La fecha de destete debe ser igual o posterior al parto (%)', to_char(v_pfecha, 'DD/MM/YYYY');
  end if;
  if p_destetados < 0 then raise exception 'Cantidad de destetados inválida'; end if;

  select v_nac - coalesce(sum(cantidad), 0) into v_vivos
    from bajas where parto_id = p_parto and fecha <= p_fecha;

  if p_destetados > v_vivos then
    raise exception 'No se pueden destetar % lechones: hay % vivos registrados en la camada', p_destetados, v_vivos;
  end if;

  if v_vivos - p_destetados > 0 then
    insert into bajas (parto_id, fecha, cantidad, motivo, es_destete, notas)
    values (p_parto, p_fecha, v_vivos - p_destetados, 'muerte', true, 'Muertes en lactancia (registradas al destete)');
  end if;

  update partos set fecha_destete = p_fecha, destetados = p_destetados where id = p_parto;
end $$;

-- =====================================================================
--  Vistas (respetan los permisos del usuario que consulta)
-- =====================================================================

-- Stock por camada, con categoría según días de vida
create view public.v_stock_camadas with (security_invoker = true) as
select p.id                                   as parto_id,
       p.cerda_id,
       c.caravana,
       p.fecha                                as fecha_nacimiento,
       (public.hoy() - p.fecha)               as dias,
       public.categoria_por_dias(public.hoy() - p.fecha) as categoria,
       p.nacidos_vivos,
       p.destetados,
       p.fecha_destete,
       coalesce(b.total, 0)                   as bajas,
       p.nacidos_vivos - coalesce(b.total, 0) as vivos
  from public.partos p
  join public.cerdas c on c.id = p.cerda_id
  left join (select parto_id, sum(cantidad)::int as total
               from public.bajas group by parto_id) b on b.parto_id = p.id;

-- Resumen de stock por categoría
create view public.v_stock_resumen with (security_invoker = true) as
select cat.categoria,
       coalesce(sum(s.vivos), 0)::int                       as animales,
       count(s.parto_id) filter (where s.vivos > 0)::int    as camadas
  from (values ('lechon'), ('cachorro'), ('capon')) as cat(categoria)
  left join public.v_stock_camadas s on s.categoria = cat.categoria and s.vivos > 0
 group by cat.categoria;

-- Ficha resumida de cada cerda
create view public.v_cerdas with (security_invoker = true) as
select c.*,
       coalesce(pa.partos, 0)          as partos,
       coalesce(pa.total_vivos, 0)     as total_vivos,
       pa.prom_vivos,
       pa.prom_destetados,
       pa.ultimo_parto,
       up.destetado                    as ultimo_parto_destetado,
       s.id                            as ultimo_servicio_id,
       s.fecha                         as ultimo_servicio,
       s.fecha_probable_parto,
       s.resultado                     as ultimo_resultado
  from public.cerdas c
  left join lateral (
    select count(*)::int                                   as partos,
           sum(p.nacidos_vivos)::int                       as total_vivos,
           round(avg(p.nacidos_vivos), 1)                  as prom_vivos,
           round(avg(p.destetados), 1)                     as prom_destetados,
           max(p.fecha)                                    as ultimo_parto
      from public.partos p where p.cerda_id = c.id
  ) pa on true
  left join lateral (
    select (p.destetados is not null) as destetado
      from public.partos p where p.cerda_id = c.id
     order by p.fecha desc, p.id desc limit 1
  ) up on true
  left join lateral (
    select sv.id, sv.fecha, sv.fecha_probable_parto, sv.resultado
      from public.servicios sv where sv.cerda_id = c.id
     order by sv.fecha desc, sv.id desc limit 1
  ) s on true;

-- Último precio de compra de cada insumo (sugerencia para la molienda)
create view public.v_insumos with (security_invoker = true) as
select i.*,
       uc.precio_unitario as ultimo_precio,
       uc.fecha           as ultima_compra,
       coalesce(co.cant, 0) - coalesce(mo.cant, 0) as stock
  from public.insumos i
  left join lateral (
    select c.precio_unitario, c.fecha from public.compras c
     where c.insumo_id = i.id order by c.fecha desc, c.id desc limit 1
  ) uc on true
  left join (select insumo_id, sum(cantidad) as cant from public.compras group by insumo_id) co
         on co.insumo_id = i.id
  left join (select insumo_id, sum(kilos) as cant from public.molienda_items group by insumo_id) mo
         on mo.insumo_id = i.id;

-- Resumen mensual de moliendas por preparación
create view public.v_moliendas_mensual with (security_invoker = true) as
select date_trunc('month', fecha)::date as mes,
       preparacion,
       count(*)::int                    as moliendas,
       sum(kilos_totales)               as kilos,
       sum(costo_total)                 as costo_total,
       round(sum(costo_total) / nullif(sum(kilos_totales), 0), 4) as costo_kg
  from public.moliendas
 group by 1, 2;

-- Resumen mensual de ventas por vía
create view public.v_ventas_mensual with (security_invoker = true) as
select date_trunc('month', fecha)::date as mes,
       via,
       count(*)::int      as operaciones,
       sum(cantidad)::int as animales,
       sum(kilos)         as kilos,
       sum(kilos_netos)   as kilos_netos,
       sum(subtotal)      as subtotal,
       sum(iva)           as iva,
       sum(total)         as total
  from public.ventas
 group by 1, 2;

-- Balance mensual: ingresos, egresos, resultado y rentabilidad
create view public.v_balance_mensual with (security_invoker = true) as
with movimientos as (
  select date_trunc('month', fecha)::date as mes, 'ventas_via1' as concepto, subtotal as monto from public.ventas where via = 1
  union all
  select date_trunc('month', fecha)::date, 'ventas_via2', subtotal from public.ventas where via = 2
  union all
  select date_trunc('month', fecha)::date, 'iva_ventas', iva from public.ventas
  union all
  select date_trunc('month', c.fecha)::date,
         case when i.tipo in ('nucleo', 'cereal') then 'alimento' else 'medicamentos_alimento' end,
         c.total
    from public.compras c join public.insumos i on i.id = c.insumo_id
  union all
  select date_trunc('month', fecha)::date, categoria, monto from public.gastos
  union all
  select date_trunc('month', fecha_ingreso)::date, 'reposicion', precio_compra
    from public.cerdas where precio_compra is not null
)
select mes,
       coalesce(sum(monto) filter (where concepto = 'ventas_via1'), 0)           as ventas_via1,
       coalesce(sum(monto) filter (where concepto = 'ventas_via2'), 0)           as ventas_via2,
       coalesce(sum(monto) filter (where concepto = 'iva_ventas'), 0)            as iva_ventas,
       coalesce(sum(monto) filter (where concepto = 'alimento'), 0)              as alimento,
       coalesce(sum(monto) filter (where concepto = 'medicamentos_alimento'), 0) as medicamentos_alimento,
       coalesce(sum(monto) filter (where concepto = 'mano_obra'), 0)             as mano_obra,
       coalesce(sum(monto) filter (where concepto = 'combustible'), 0)           as combustible,
       coalesce(sum(monto) filter (where concepto = 'veterinaria'), 0)           as veterinaria,
       coalesce(sum(monto) filter (where concepto = 'semen'), 0)                 as semen,
       coalesce(sum(monto) filter (where concepto = 'extras'), 0)                as extras,
       coalesce(sum(monto) filter (where concepto = 'otros'), 0)                 as otros,
       coalesce(sum(monto) filter (where concepto = 'reposicion'), 0)            as reposicion,
       coalesce(sum(monto) filter (where concepto in ('ventas_via1', 'ventas_via2')), 0) as ingresos,
       coalesce(sum(monto) filter (where concepto not in ('ventas_via1', 'ventas_via2', 'iva_ventas')), 0) as egresos
  from movimientos
 group by mes;

-- =====================================================================
--  Seguridad: Row Level Security
-- =====================================================================
alter table public.perfiles       enable row level security;
alter table public.insumos        enable row level security;
alter table public.compras        enable row level security;
alter table public.moliendas      enable row level security;
alter table public.molienda_items enable row level security;
alter table public.cerdas         enable row level security;
alter table public.servicios      enable row level security;
alter table public.partos         enable row level security;
alter table public.bajas          enable row level security;
alter table public.ventas         enable row level security;
alter table public.gastos         enable row level security;

-- Perfiles: cada uno ve el suyo; el dueño ve y administra todos
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_dueno());
create policy perfiles_update on public.perfiles for update to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy perfiles_delete on public.perfiles for delete to authenticated
  using (public.es_dueno() and id <> auth.uid());

-- Datos operativos: dueño y empleado cargan y editan; solo el dueño elimina
do $$
declare t text;
begin
  foreach t in array array['insumos', 'compras', 'moliendas', 'molienda_items',
                           'cerdas', 'servicios', 'partos', 'bajas']
  loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.es_usuario())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.es_usuario())', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.es_usuario()) with check (public.es_usuario())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.es_dueno())', t);
  end loop;
end $$;

-- Las moliendas se reescriben completas al editarlas: el empleado puede
-- reemplazar los ingredientes de una molienda
drop policy molienda_items_delete on public.molienda_items;
create policy molienda_items_delete on public.molienda_items for delete to authenticated
  using (public.es_usuario());

-- El destete recalcula su propia baja automática: el empleado puede hacerlo
drop policy bajas_delete on public.bajas;
create policy bajas_delete on public.bajas for delete to authenticated
  using (public.es_dueno() or (public.es_usuario() and es_destete));

-- Información económica sensible: solo el dueño
create policy ventas_all on public.ventas for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy gastos_all on public.gastos for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

-- Los visitantes sin sesión no ven nada
revoke all on all tables in schema public from anon;