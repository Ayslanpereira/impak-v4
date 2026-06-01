-- ============================================================
-- IMPAK v4.0 — Schema completo (Supabase / PostgreSQL)
-- Cole este SQL no SQL Editor do Supabase e clique Run
-- ============================================================

-- ─── Processos de importação ──────────────────────────────────
create table if not exists processos (
  id              uuid primary key default gen_random_uuid(),
  proc            text not null unique,
  cliente         text,
  fornecedor      text,
  agente          text,
  navio           text,
  porto           text,
  eta             date,
  container       text,
  free_time       integer default 14,
  quant           integer default 1,
  bl              text,
  ce              text,
  di              text,
  pi_num          text,
  status          text default 'Em produção',
  anuen           text default 'Pendente',
  pendencia       text,
  obs             text,
  cadastrado_em   date default current_date,
  entrada_usd     numeric(12,2) default 0,
  entrada_venc    date,
  entrada_status  text default 'pendente',
  entrada_auto    boolean default false,
  saldo_usd       numeric(12,2) default 0,
  saldo_venc      date,
  saldo_status    text default 'pendente',
  saldo_auto      boolean default false,
  saldo_condicao  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Itens do packing list ────────────────────────────────────
create table if not exists processo_items (
  id          uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  descricao   text,
  qtd         numeric(12,3),
  unidade     text,
  peso_bruto  numeric(10,3),
  peso_liq    numeric(10,3),
  ncm         text,
  created_at  timestamptz default now()
);

-- ─── Log de alterações ────────────────────────────────────────
create table if not exists logs (
  id          uuid primary key default gen_random_uuid(),
  proc        text not null,
  usuario     text not null,
  campo       text not null,
  valor_de    text,
  valor_para  text,
  created_at  timestamptz default now()
);

-- ─── Documentos (upload) ──────────────────────────────────────
create table if not exists documentos (
  id           uuid primary key default gen_random_uuid(),
  processo_id  uuid references processos(id) on delete cascade,
  proc         text not null,
  nome         text not null,
  tipo         text,
  storage_path text not null,
  tamanho      bigint,
  uploaded_by  text,
  created_at   timestamptz default now()
);

-- ─── Histórico de câmbio ─────────────────────────────────────
create table if not exists cambio_historico (
  id         uuid primary key default gen_random_uuid(),
  usd_brl    numeric(8,4),
  eur_brl    numeric(8,4),
  cny_brl    numeric(8,4),
  created_at timestamptz default now()
);

-- ─── Cotações (Analisador de Preço) ──────────────────────────
create table if not exists cotacoes (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text,
  ncm         text,
  criado_por  text not null,
  processo_id uuid references processos(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Fornecedores por cotação ─────────────────────────────────
create table if not exists cotacao_fornecedores (
  id              uuid primary key default gen_random_uuid(),
  cotacao_id      uuid references cotacoes(id) on delete cascade,
  nome            text not null,
  pais            text default 'China',
  incoterm        text default 'FOB',
  moeda           text default 'USD',
  descricao       text,
  ncm             text,
  qtd_unid        numeric(12,3),
  unidade         text default 'PAR',
  preco_unit      numeric(12,4),
  frete_mar       numeric(12,2),
  frete_int       numeric(12,2),
  seguro          numeric(12,2),
  ii              numeric(6,2),
  ipi             numeric(6,2),
  pis             numeric(6,2),
  cofins          numeric(6,2),
  icms            numeric(6,2),
  afrmm           numeric(12,2),
  siscomex        numeric(12,2),
  desp_aduaneiras numeric(12,2),
  armazenagem     numeric(12,2),
  agenciamento    numeric(12,2),
  desp_bancarias  numeric(12,2),
  outros          numeric(12,2),
  cambio          numeric(8,4),
  obs             text,
  created_at      timestamptz default now()
);

-- ─── Conferências documentais (v3.0) ─────────────────────────
create table if not exists conferencias (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null,
  exportador  text,
  status      text default 'divergencias',
  resultado   jsonb,
  criado_por  text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Trigger: atualiza updated_at ────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger processos_updated_at
  before update on processos
  for each row execute function set_updated_at();

create trigger cotacoes_updated_at
  before update on cotacoes
  for each row execute function set_updated_at();

create trigger conferencias_updated_at
  before update on conferencias
  for each row execute function set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────
alter table processos             enable row level security;
alter table processo_items        enable row level security;
alter table logs                  enable row level security;
alter table documentos            enable row level security;
alter table cambio_historico      enable row level security;
alter table cotacoes              enable row level security;
alter table cotacao_fornecedores  enable row level security;
alter table conferencias          enable row level security;

-- Políticas: autenticados têm acesso total (controle fino no app)
do $$ declare t text; begin
  foreach t in array array['processos','processo_items','logs','documentos','cambio_historico','cotacoes','cotacao_fornecedores','conferencias'] loop
    execute format('create policy "auth_select_%s" on %s for select using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth_all_%s" on %s for all using (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;
