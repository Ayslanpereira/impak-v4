// src/App.jsx — IMPAK v4.0
import { useState, useEffect } from 'react'
import { login, logout, onAuthChange, listarProcessos, listarLogs, registrarLog, buscarCambioAtual } from './db.js'
import { C, INP, BTN_GHOST, BTN_GOLD, Spin } from './components/ui.jsx'
import TabProcessos  from './tabs/TabProcessos.jsx'
import TabFollowup   from './tabs/TabFollowup.jsx'
import TabCaixa      from './tabs/TabCaixa.jsx'
import TabConferencia from './tabs/TabConferencia.jsx'
import TabAnalisador from './tabs/TabAnalisador.jsx'
import TabImportar   from './tabs/TabImportar.jsx'
import TabLogs       from './tabs/TabLogs.jsx'

// ─── Permissões por e-mail ────────────────────────────────────
const PERMISSOES = {
  'paula@impak.com.br':    { nome:'Paula',    perm:'full' },
  'narcelio@impak.com.br': { nome:'Narcelio', perm:'full' },
  'bianca@impak.com.br':   { nome:'Bianca',   perm:'full' },
  'italo@impak.com.br':    { nome:'Italo',    perm:'sem_caixa' },
  'emanuele@impak.com.br': { nome:'Emanuele', perm:'sem_caixa' },
  'maria@impak.com.br':    { nome:'Maria',    perm:'sem_caixa' },
  'joyce@impak.com.br':    { nome:'Joyce',    perm:'sem_caixa' },
  'neide@impak.com.br':    { nome:'Neide',    perm:'sem_caixa' },
}

function obterPermissao(email) {
  return PERMISSOES[email] || { nome: email?.split('@')[0] || 'Usuário', perm: 'sem_caixa' }
}

export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [procs, setProcs]     = useState([])
  const [logs, setLogs]       = useState([])
  const [cambio, setCambio]   = useState({ usd:5.72, eur:6.31, cny:0.79, ts:'--:--' })
  const [tab, setTab]         = useState('processos')
  const [erro, setErro]       = useState(null)

  useEffect(() => {
    const { data: { subscription } } = onAuthChange(async (u) => {
      setUser(u ? { ...u, ...obterPermissao(u.email) } : null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    carregarDados()
    buscarCambioAtual().then(setCambio)
    const iv = setInterval(() => buscarCambioAtual().then(setCambio), 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [user])

  async function carregarDados() {
    try {
      const [ps, ls] = await Promise.all([listarProcessos(), listarLogs()])
      setProcs(ps); setLogs(ls)
    } catch (e) { setErro('Erro ao carregar: ' + e.message) }
  }

  async function handleSalvar(proc) {
    const { salvarProcesso } = await import('./db.js')
    try { await salvarProcesso(proc, user.nome); await carregarDados() }
    catch (e) { setErro('Erro ao salvar: ' + e.message) }
  }

  async function addLog(entries) {
    for (const e of entries) await registrarLog({ proc:e.proc, usuario:e.user, campo:e.campo, valor_de:e.de, valor_para:e.para }).catch(() => {})
    const ls = await listarLogs()
    setLogs(ls)
  }

  if (loading) return (
    <div style={{ background:C.navy, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Spin />
    </div>
  )

  if (!user) return <LoginScreen onLogin={async (email, senha) => {
    try { await login(email, senha) }
    catch { throw new Error('E-mail ou senha incorretos') }
  }} />

  const tabs = [
    { id:'processos',   l:'📋 Processos' },
    { id:'followup',    l:'📅 Follow-up' },
    { id:'conferencia', l:'✦ Conferência' },
    { id:'analisador',  l:'📊 Analisador' },
    { id:'importar',    l:'✦ Importar doc' },
    ...(user.perm !== 'sem_caixa' ? [{ id:'caixa', l:'💰 Caixa' }] : []),
    { id:'logs',        l:'📝 Log' },
  ]

  return (
    <div style={{ background:C.navy, minHeight:'100vh', fontFamily:'sans-serif', color:C.white }}>
      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', borderBottom:`0.5px solid ${C.border}`, background:C.navyMid }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:18, fontWeight:700, letterSpacing:-0.5 }}>
            <span style={{ color:C.gold }}>im</span>pak<sup style={{ color:C.gold, fontSize:10 }}>®</sup>
          </div>
          <span style={{ fontSize:10, color:C.muted, letterSpacing:'0.5px', textTransform:'uppercase', borderLeft:`0.5px solid ${C.border}`, paddingLeft:10 }}>
            Gestão de Importações
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:12, color:C.muted }}>USD <strong style={{ color:C.white }}>{cambio.usd?.toFixed(2)}</strong></span>
          <span style={{ fontSize:12, color:C.muted }}>Olá, <strong style={{ color:C.gold }}>{user.nome}</strong></span>
          <button onClick={logout} style={{ ...BTN_GHOST, fontSize:12, padding:'3px 9px' }}>Sair</button>
        </div>
      </div>

      {/* Barra de câmbio */}
      <div style={{ background:C.navy, borderBottom:`0.5px solid ${C.border}`, padding:'5px 20px', display:'flex', alignItems:'center', gap:18, fontSize:12, flexWrap:'wrap' }}>
        {[['USD/BRL',cambio.usd],['EUR/BRL',cambio.eur],['CNY/BRL',cambio.cny]].map(([l,v]) => (
          <div key={l} style={{ display:'flex', gap:5 }}>
            <span style={{ color:C.muted }}>{l}</span>
            <span style={{ fontWeight:500 }}>{v?.toFixed(4)||'—'}</span>
          </div>
        ))}
        <span style={{ color:C.muted, fontSize:11, marginLeft:'auto' }}>{cambio.ts}</span>
        <button onClick={() => buscarCambioAtual().then(setCambio)} style={{ ...BTN_GHOST, fontSize:11, padding:'2px 7px' }}>↻</button>
      </div>

      {erro && (
        <div style={{ background:'#2a1010', borderBottom:`0.5px solid #6b2020`, padding:'8px 20px', fontSize:12, color:C.red, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {erro}
          <button onClick={() => setErro(null)} style={{ background:'none', border:'none', color:C.red, cursor:'pointer', fontSize:14 }}>×</button>
        </div>
      )}

      <div style={{ padding:'0 16px' }}>
        {/* Abas */}
        <div style={{ display:'flex', borderBottom:`0.5px solid ${C.border}`, marginBottom:16, flexWrap:'wrap', gap:0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'10px 14px', fontSize:12, cursor:'pointer', background:'none', border:'none',
              borderBottom: tab===t.id ? `2px solid ${C.gold}` : '2px solid transparent',
              color: tab===t.id ? C.gold : C.muted,
              fontWeight: tab===t.id ? 500 : 400,
              transition:'all 0.15s',
            }}>{t.l}</button>
          ))}
        </div>

        {tab === 'processos'   && <TabProcessos  procs={procs} logs={logs} onSave={handleSalvar} addLog={addLog} user={user} onReload={carregarDados} />}
        {tab === 'followup'    && <TabFollowup   procs={procs} />}
        {tab === 'conferencia' && <TabConferencia user={user} cambio={cambio} />}
        {tab === 'analisador'  && <TabAnalisador  user={user} procs={procs} cambio={cambio} />}
        {tab === 'importar'    && <TabImportar    procs={procs} onSave={handleSalvar} addLog={addLog} user={user} onDone={() => setTab('processos')} />}
        {tab === 'caixa'       && user.perm !== 'sem_caixa' && <TabCaixa procs={procs} cambio={cambio} perm={user.perm} />}
        {tab === 'logs'        && <TabLogs logs={logs} />}
      </div>
    </div>
  )
}

// ─── Tela de Login ────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro]   = useState('')
  const [load, setLoad]   = useState(false)

  async function go() {
    if (!email || !senha) return
    setLoad(true); setErro('')
    try { await onLogin(email, senha) }
    catch (e) { setErro(e.message) }
    finally { setLoad(false) }
  }

  return (
    <div style={{ background:C.navy, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <div style={{ background:C.navyMid, border:`0.5px solid ${C.border}`, borderRadius:14, padding:'2.2rem', width:320 }}>
        <div style={{ textAlign:'center', marginBottom:'1.6rem' }}>
          <div style={{ fontSize:28, fontWeight:700, letterSpacing:-1 }}>
            <span style={{ color:C.gold }}>im</span>pak<sup style={{ color:C.gold, fontSize:14 }}>®</sup>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2, letterSpacing:1, textTransform:'uppercase' }}>Comercial Importadora</div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:11, color:C.muted, marginBottom:4 }}>E-mail</label>
          <input style={INP} type="email" value={email} placeholder="seu@impak.com.br" onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && go()} />
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:11, color:C.muted, marginBottom:4 }}>Senha</label>
          <input style={INP} type="password" value={senha} placeholder="••••••" onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key==='Enter' && go()} />
        </div>
        {erro && <div style={{ color:C.red, fontSize:12, marginBottom:8 }}>{erro}</div>}
        <button onClick={go} disabled={load} style={{ ...BTN_GOLD, width:'100%', padding:10, fontSize:14, opacity:load?0.7:1 }}>
          {load ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
