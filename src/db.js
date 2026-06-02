// src/db.js — IMPAK v4.0
// Todas as operações de banco em um lugar. Componentes nunca acessam o Supabase diretamente.

import { supabase } from './supabase.js'

// ─── AUTH ─────────────────────────────────────────────────────
export async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return data.user
}
export async function logout() { await supabase.auth.signOut() }
export async function usuarioAtual() {
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}
export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_e, s) => cb(s?.user || null))
}

// ─── PROCESSOS ────────────────────────────────────────────────
export async function listarProcessos() {
  const { data, error } = await supabase
    .from('processos').select('*, processo_items(*)').order('created_at', { ascending: false })
  if (error) throw error
  return data.map(dbToApp)
}

export async function salvarProcesso(proc, usuario) {
  const { data, error } = await supabase
    .from('processos').upsert(appToDb(proc), { onConflict: 'proc' }).select().single()
  if (error) throw error
  if (proc.items?.length) {
    await supabase.from('processo_items').delete().eq('processo_id', data.id)
    await supabase.from('processo_items').insert(proc.items.map(it => ({ ...it, processo_id: data.id })))
  }
  await registrarLog({ proc: proc.proc, usuario, campo: 'Criação/atualização', valor_de: '', valor_para: `por ${usuario}` })
  return data
}

export async function atualizarCampo(procNum, campo, valorDe, valorPara, usuario) {
  const col = { Status:'status', Anuência:'anuen', DI:'di', Pendência:'pendencia', 'St.entrada':'entrada_status', 'St.saldo':'saldo_status', 'Venc.entrada':'entrada_venc', 'Venc.saldo':'saldo_venc', Obs:'obs' }[campo]
  if (!col) return
  const { error } = await supabase.from('processos').update({ [col]: valorPara }).eq('proc', procNum)
  if (error) throw error
  await registrarLog({ proc: procNum, usuario, campo, valor_de: valorDe, valor_para: valorPara })
}

// ─── LOGS ─────────────────────────────────────────────────────
export async function listarLogs(limite = 300) {
  const { data, error } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(limite)
  if (error) throw error
  return data.map(l => ({ ts: new Date(l.created_at).toLocaleString('pt-BR'), user: l.usuario, proc: l.proc, campo: l.campo, de: l.valor_de || '', para: l.valor_para || '' }))
}
export async function registrarLog({ proc, usuario, campo, valor_de, valor_para }) {
  const { error } = await supabase.from('logs').insert({ proc, usuario, campo, valor_de, valor_para })
  if (error) console.error('Log error:', error)
}

// ─── DOCUMENTOS ───────────────────────────────────────────────
export async function uploadDocumento(processoId, procNum, arquivo, tipo, usuario) {
  const path = `${procNum}/${Date.now()}_${arquivo.name}`
  const { error: upErr } = await supabase.storage.from('documentos-impak').upload(path, arquivo, { contentType: arquivo.type })
  if (upErr) throw upErr
  const { data, error } = await supabase.from('documentos')
    .insert({ processo_id: processoId, proc: procNum, nome: arquivo.name, tipo, storage_path: path, tamanho: arquivo.size, uploaded_by: usuario })
    .select().single()
  if (error) throw error
  await registrarLog({ proc: procNum, usuario, campo: 'Upload', valor_de: '', valor_para: `${tipo}: ${arquivo.name}` })
  return data
}
export async function listarDocumentos(procNum) {
  const { data, error } = await supabase.from('documentos').select('*').eq('proc', procNum).order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export async function urlDocumento(storagePath) {
  const { data, error } = await supabase.storage.from('documentos-impak').createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

// ─── CÂMBIO ───────────────────────────────────────────────────
export async function buscarCambioAtual() {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,CNY-BRL')
    const d = await r.json()
    const now = new Date()
    const c = {
      usd: parseFloat(d.USDBRL?.bid || 5.72),
      eur: parseFloat(d.EURBRL?.bid || 6.31),
      cny: parseFloat(d.CNYBRL?.bid || 0.79),
      ts: `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`,
    }
    supabase.from('cambio_historico').insert({ usd_brl: c.usd, eur_brl: c.eur, cny_brl: c.cny }).then(() => {})
    return c
  } catch { return { usd: 5.72, eur: 6.31, cny: 0.79, ts: '--:--' } }
}

// ─── COTAÇÕES (Analisador de Preço) ───────────────────────────
export async function listarCotacoes() {
  const { data, error } = await supabase
    .from('cotacoes').select('*, cotacao_fornecedores(*)').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function salvarCotacao(cotacao, usuario) {
  // Upsert cotação
  const row = {
    titulo:      cotacao.titulo,
    descricao:   cotacao.descricao || '',
    ncm:         cotacao.ncm || '',
    criado_por:  usuario,
    processo_id: cotacao.processoId || null,
  }
  let id = cotacao.id
  if (id) {
    const { error } = await supabase.from('cotacoes').update(row).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('cotacoes').insert(row).select().single()
    if (error) throw error
    id = data.id
  }
  // Recriar fornecedores
  await supabase.from('cotacao_fornecedores').delete().eq('cotacao_id', id)
  if (cotacao.fornecedores?.length) {
    const rows = cotacao.fornecedores.map(f => ({
      cotacao_id:      id,
      nome:            f.nome,
      pais:            f.pais,
      incoterm:        f.incoterm,
      moeda:           f.moeda,
      descricao:       f.descricao,
      ncm:             f.ncm,
      qtd_unid:        parseFloat(f.qtdUnid) || null,
      unidade:         f.unidade,
      preco_unit:      parseFloat(f.precoUnit) || null,
      frete_mar:       parseFloat(f.freteMar) || null,
      frete_int:       parseFloat(f.freteInt) || null,
      seguro:          parseFloat(f.seguro) || null,
      ii:              parseFloat(f.ii) || null,
      ipi:             parseFloat(f.ipi) || null,
      pis:             parseFloat(f.pis) || null,
      cofins:          parseFloat(f.cofins) || null,
      icms:            parseFloat(f.icms) || null,
      afrmm:           parseFloat(f.afrmm) || null,
      siscomex:        parseFloat(f.siscomex) || null,
      desp_aduaneiras: parseFloat(f.despAduaneiras) || null,
      armazenagem:     parseFloat(f.armazenagem) || null,
      agenciamento:    parseFloat(f.agenciamento) || null,
      desp_bancarias:  parseFloat(f.despBancarias) || null,
      outros:          parseFloat(f.outros) || null,
      cambio:          parseFloat(f.cambio) || null,
      obs:             f.obs,
    }))
    const { error } = await supabase.from('cotacao_fornecedores').insert(rows)
    if (error) throw error
  }
  return id
}

export async function deletarCotacao(id) {
  const { error } = await supabase.from('cotacoes').delete().eq('id', id)
  if (error) throw error
}

// ─── CONFERÊNCIAS (v3.0) ──────────────────────────────────────
export async function listarConferencias(usuario, isGerente) {
  let q = supabase.from('conferencias').select('*').order('created_at', { ascending: false })
  if (!isGerente) q = q.eq('criado_por', usuario)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function salvarConferencia(conf, usuario) {
  const row = {
    ref:        conf.ref,
    exportador: conf.exportador || '',
    status:     conf.status || 'divergencias',
    resultado:  conf.resultado || null,
    criado_por: usuario,
  }
  if (conf.id) {
    const { error } = await supabase.from('conferencias').update(row).eq('id', conf.id)
    if (error) throw error
    return conf.id
  } else {
    const { data, error } = await supabase.from('conferencias').insert(row).select().single()
    if (error) throw error
    return data.id
  }
}

export async function deletarConferencia(id) {
  const { error } = await supabase.from('conferencias').delete().eq('id', id)
  if (error) throw error
}

// ─── IA — proxy Anthropic ─────────────────────────────────────
export async function extrairDocumentoIA(partes, referencia) {
  const resp = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partes, referencia }),
  })
  if (!resp.ok) throw new Error(`Erro no servidor: ${resp.status}`)
  return resp.json()
}

export async function analisarCotacaoIA(partes) {
  const resp = await fetch('/api/cotacao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partes }),
  })
  if (!resp.ok) throw new Error(`Erro no servidor: ${resp.status}`)
  return resp.json()
}

// ─── Helpers app ↔ banco ──────────────────────────────────────
function appToDb(p) {
  return {
    proc: p.proc, cliente: p.cliente, fornecedor: p.fornecedor, agente: p.agente,
    navio: p.navio, porto: p.porto, eta: p.eta || null, container: p.container,
    free_time: parseInt(p.freeTime) || 14, quant: parseInt(p.quant) || 1,
    bl: p.bl, ce: p.ce, di: p.di, pi_num: p.piNum, status: p.status, anuen: p.anuen,
    pendencia: p.pendencia, obs: p.obs,
    cadastrado_em: p.cadastradoEm || new Date().toISOString().slice(0,10),
    entrada_usd: parseFloat(p.entradaUSD) || 0, entrada_venc: p.entradaVenc || null,
    entrada_status: p.entradaStatus || 'pendente', entrada_auto: !!p.entradaAuto,
    saldo_usd: parseFloat(p.saldoUSD) || 0, saldo_venc: p.saldoVenc || null,
    saldo_status: p.saldoStatus || 'pendente', saldo_auto: !!p.saldoAuto,
    saldo_condicao: p.saldoCondicao,
  }
}
function dbToApp(row) {
  return {
    id: row.id, proc: row.proc, cliente: row.cliente||'', fornecedor: row.fornecedor||'',
    agente: row.agente||'', navio: row.navio||'', porto: row.porto||'', eta: row.eta||'',
    container: row.container||'', freeTime: row.free_time||14, quant: row.quant||1,
    bl: row.bl||'', ce: row.ce||'', di: row.di||'', piNum: row.pi_num||'',
    status: row.status||'Em produção', anuen: row.anuen||'Pendente',
    pendencia: row.pendencia||'', obs: row.obs||'', cadastradoEm: row.cadastrado_em||'',
    entradaUSD: parseFloat(row.entrada_usd)||0, entradaVenc: row.entrada_venc||'',
    entradaStatus: row.entrada_status||'pendente', entradaAuto: !!row.entrada_auto,
    saldoUSD: parseFloat(row.saldo_usd)||0, saldoVenc: row.saldo_venc||'',
    saldoStatus: row.saldo_status||'pendente', saldoAuto: !!row.saldo_auto,
    saldoCondicao: row.saldo_condicao||'',
    items: (row.processo_items||[]).map(it => ({
      descricao: it.descricao||'', qtd: it.qtd||0, unidade: it.unidade||'',
      pesoBruto: it.peso_bruto||0, pesoLiquido: it.peso_liq||0, ncm: it.ncm||'',
    })),
  }
}
