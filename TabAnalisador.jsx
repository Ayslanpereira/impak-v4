// src/tabs/TabProcessos.jsx — IMPAK v4.0
import { useState } from 'react'
import { atualizarCampo, uploadDocumento, listarDocumentos, urlDocumento } from '../db.js'
import { C, INP, INP_F, SEL, BTN_GOLD, BTN_GHOST, Fld, SecT, Spin, Bdg, Card, Modal } from '../components/ui.jsx'

const TODAY = new Date().toISOString().slice(0,10)
const SALDO_TERMS = ['against doc','against document','a/d','after shipment','sight','à vista','a vista','d/p']

function addDays(s, n) {
  if (!s) return ''
  const d = new Date(s); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0,10)
}
function isSaldoAuto(t) {
  const tl = (t||'').toLowerCase().trim()
  return !tl || SALDO_TERMS.some(k => tl.includes(k))
}

export default function TabProcessos({ procs, logs, onSave, addLog, user, onReload }) {
  const [q, setQ]           = useState('')
  const [fs, setFs]         = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [showF, setShowF]   = useState(false)
  const today = new Date(TODAY)

  const crit = procs.filter(p => { if(!p.eta) return false; const d=Math.floor((today-new Date(p.eta))/86400000); return d>0&&(p.freeTime-d)<=0 }).length
  const warn = procs.filter(p => { if(!p.eta) return false; const d=Math.floor((today-new Date(p.eta))/86400000); if(d<=0) return false; const r=p.freeTime-d; return r>0&&r<=5 }).length
  const pagV = procs.filter(p => { const chk=(v,s)=>v&&s!=='pago'&&new Date(v)<=today; return chk(p.entradaVenc,p.entradaStatus)||chk(p.saldoVenc,p.saldoStatus) }).length

  const filtered = procs.filter(p => {
    if (fs && p.status !== fs) return false
    if (q && !JSON.stringify(p).toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  function demC(p) {
    if (!p.eta) return <span style={{ color:C.muted, fontSize:10 }}>—</span>
    const arr = Math.floor((today - new Date(p.eta)) / 86400000)
    if (arr <= 0) return <span style={{ color:C.muted, fontSize:10 }}>ETA em {Math.abs(arr)}d</span>
    const rem = p.freeTime - arr
    if (rem <= 0) return <span style={{ background:'#2a1010', color:C.red, fontSize:10, padding:'2px 5px', borderRadius:4 }}>+{Math.abs(rem)}d demurrage</span>
    if (rem <= 5) return <span style={{ background:'#2a1e08', color:C.amber, fontSize:10, padding:'2px 5px', borderRadius:4 }}>{rem}d</span>
    return <span style={{ color:C.muted, fontSize:10 }}>{rem}d livres</span>
  }

  function pagM(usd, venc, st, auto) {
    if (!usd) return <span style={{ color:C.muted, fontSize:10 }}>—</span>
    const col = st==='pago'?C.green:st==='atrasado'?C.red:C.amber
    return (
      <div style={{ lineHeight:1.6 }}>
        <span style={{ color:col, fontSize:11 }}>{st==='pago'?'Pago':st==='atrasado'?'Atrasado':'Pendente'}</span>
        <div style={{ fontSize:10, color:C.muted }}>USD {Number(usd).toLocaleString()}{auto&&<span style={{ color:C.blue }}> ⚡</span>}</div>
      </div>
    )
  }

  async function save(novo) {
    const ts = new Date().toISOString().slice(0,16).replace('T',' ')
    if (editIdx !== null) {
      const old = procs[editIdx]
      const le = []
      [['status','Status'],['anuen','Anuência'],['di','DI'],['pendencia','Pendência'],['entradaStatus','St.entrada'],['saldoStatus','St.saldo'],['entradaVenc','Venc.entrada'],['saldoVenc','Venc.saldo']].forEach(([k,l]) => {
        if (old[k] !== novo[k]) le.push({ ts, user:user.nome, proc:old.proc, campo:l, de:old[k]||'', para:novo[k]||'' })
      })
      if (le.length) await addLog(le)
    } else {
      const le = [{ ts, user:user.nome, proc:novo.proc, campo:'Criação', de:'', para:'Processo criado' }]
      if (novo.entradaAuto) le.push({ ts, user:'Sistema', proc:novo.proc, campo:'Entrada venc.', de:'(vazio)', para:`${novo.entradaVenc} (D+2 auto)` })
      if (novo.saldoAuto)   le.push({ ts, user:'Sistema', proc:novo.proc, campo:'Saldo venc.',   de:'(vazio)', para:`${novo.saldoVenc} (ETA−10d auto)` })
      await addLog(le)
    }
    await onSave(novo)
    setShowF(false); setEditIdx(null)
  }

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:8, marginBottom:16 }}>
        {[[crit,'Demurrage',C.red,'#2a1010','#6b2020'],[warn,'Free time ≤5d',C.amber,'#2a1e08','#6b4a10'],[pagV,'Pagtos vencidos',C.amber,'#2a1e08','#6b4a10'],[procs.filter(p=>p.status==='Em trânsito').length,'Em trânsito',C.blue,C.navyMid,C.border],[procs.filter(p=>p.status==='Chegou').length,'Chegaram',C.green,C.navyMid,C.border]].map(([n,l,col,bg,bdr],i) => (
          <div key={i} style={{ background:bg, border:`0.5px solid ${bdr}`, borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:22, fontWeight:500, color:col }}>{n}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input style={{ ...INP, flex:1, minWidth:160 }} placeholder="Buscar processo, cliente, navio..." value={q} onChange={e => setQ(e.target.value)} />
        <select style={{ ...SEL, width:'auto' }} value={fs} onChange={e => setFs(e.target.value)}>
          <option value="">Todos os status</option>
          {['Em produção','Em trânsito','Chegou','Desembaraçado'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button style={BTN_GOLD} onClick={() => { setEditIdx(null); setShowF(true) }}>+ Novo</button>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>{['Processo','Cliente','Fornecedor','Navio','Porto','ETA','Status','Free time','Anuência','Entrada PI','Saldo PI',''].map(h => (
              <th key={h} style={{ textAlign:'left', padding:'5px 7px', fontSize:10, color:C.muted, borderBottom:`0.5px solid ${C.border}`, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map((p,i) => {
              const ri = procs.indexOf(p)
              const stT = p.status==='Em produção'?'prod':p.status==='Em trânsito'?'transit':p.status==='Chegou'?'arrived':'cleared'
              return (
                <tr key={p.proc||i} onMouseEnter={e => e.currentTarget.style.background=C.navyMid} onMouseLeave={e => e.currentTarget.style.background=''}>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, fontWeight:500, color:C.gold }}>{p.proc}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{p.cliente}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.fornecedor}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.navio}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{p.porto}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{p.eta||'—'}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}><Bdg text={p.status} type={stT} /></td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{demC(p)}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}><Bdg text={p.anuen} type={p.anuen==='Deferida'?'deferida':'pendente'} /></td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{pagM(p.entradaUSD,p.entradaVenc,p.entradaStatus,p.entradaAuto)}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{pagM(p.saldoUSD,p.saldoVenc,p.saldoStatus,p.saldoAuto)}</td>
                  <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>
                    <button style={{ ...BTN_GHOST, fontSize:11, padding:'2px 7px' }} onClick={() => { setEditIdx(ri); setShowF(true) }}>Editar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showF && (
        <ProcModal
          initial={editIdx !== null ? procs[editIdx] : null}
          logs={logs}
          user={user}
          onSave={save}
          onClose={() => { setShowF(false); setEditIdx(null) }}
        />
      )}
    </div>
  )
}

// ─── Modal de processo ────────────────────────────────────────
function ProcModal({ initial, logs, user, onSave, onClose }) {
  const p = initial || {}
  const [f, setF] = useState({
    proc:p.proc||'', cliente:p.cliente||'', fornecedor:p.fornecedor||'', agente:p.agente||'',
    navio:p.navio||'', porto:p.porto||'', eta:p.eta||'', container:p.container||'',
    freeTime:p.freeTime||14, quant:p.quant||1, bl:p.bl||'', ce:p.ce||'', di:p.di||'',
    status:p.status||'Em produção', anuen:p.anuen||'Pendente', pendencia:p.pendencia||'', obs:p.obs||'',
    eUSD:p.entradaUSD||'', eVenc:p.entradaVenc||'', eSt:p.entradaStatus||'pendente',
    sCond:p.saldoCondicao||'', sUSD:p.saldoUSD||'', sVenc:p.saldoVenc||'', sSt:p.saldoStatus||'pendente',
  })
  const [docs, setDocs]       = useState([])
  const [uploading, setUpl]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const fileRef               = useRef()
  const s = (k,v) => setF(prev => ({ ...prev, [k]:v }))

  const cadEm  = initial ? (p.cadastradoEm || TODAY) : TODAY
  const d2     = addDays(cadEm, 2)
  const eta10  = addDays(f.eta, -10)
  const eHint  = !f.eVenc
  const sHint  = !f.sVenc && isSaldoAuto(f.sCond)

  useEffect(() => {
    if (p.proc) listarDocumentos(p.proc).then(setDocs).catch(() => {})
  }, [p.proc])

  async function save() {
    setSaving(true)
    let eV = f.eVenc, eA = false
    if (!eV) { eV = addDays(cadEm, 2); eA = true }
    let sV = f.sVenc, sA = false
    if (!sV && isSaldoAuto(f.sCond) && f.eta) { sV = addDays(f.eta, -10); sA = true }
    await onSave({ ...f, entradaUSD:parseFloat(f.eUSD)||0, entradaVenc:eV, entradaStatus:f.eSt, entradaAuto:eA, saldoUSD:parseFloat(f.sUSD)||0, saldoVenc:sV, saldoStatus:f.sSt, saldoAuto:sA, saldoCondicao:f.sCond, cadastradoEm:cadEm, items:p.items||[] })
    setSaving(false)
  }

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setUpl(true)
    try {
      const tipo = guessDocType(file.name)
      await uploadDocumento(p.id, p.proc, file, tipo, user.nome || user.email)
      const d = await listarDocumentos(p.proc)
      setDocs(d)
    } catch (err) { alert('Erro no upload: ' + err.message) }
    finally { setUpl(false) }
  }

  const pLogs = logs.filter(l => l.proc === p.proc)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(5,12,28,0.88)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 12px', overflowY:'auto' }}>
      <div style={{ background:C.navyMid, border:`0.5px solid ${C.border}`, borderRadius:14, width:700, maxWidth:'100%', padding:'1.4rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', paddingBottom:10, borderBottom:`0.5px solid ${C.border}` }}>
          <span style={{ fontSize:15, fontWeight:500, color:C.gold }}>{initial ? `Editar — ${p.proc}` : 'Novo processo'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:20, cursor:'pointer' }}>×</button>
        </div>

        <SecT>Identificação</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
          {[['proc','Processo'],['cliente','Cliente'],['fornecedor','Fornecedor / Marca'],['agente','Agente / Armador']].map(([k,l]) => (
            <Fld key={k} label={l}><input style={INP} value={f[k]} onChange={e => s(k,e.target.value)} /></Fld>
          ))}
        </div>

        <SecT>Transporte</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:10 }}>
          <Fld label="Navio"><input style={INP} value={f.navio} onChange={e => s('navio',e.target.value)} /></Fld>
          <Fld label="Porto"><input style={INP} value={f.porto} onChange={e => s('porto',e.target.value)} /></Fld>
          <Fld label="ETA"><input type="date" style={INP} value={f.eta} onChange={e => s('eta',e.target.value)} /></Fld>
          <Fld label="Container"><input style={INP} value={f.container} onChange={e => s('container',e.target.value)} /></Fld>
          <Fld label="Free time (dias)"><input type="number" style={INP} value={f.freeTime} onChange={e => s('freeTime',e.target.value)} /></Fld>
          <Fld label="Qtd. containers"><input type="number" style={INP} value={f.quant} onChange={e => s('quant',e.target.value)} /></Fld>
        </div>

        <SecT>Documentos</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:10 }}>
          {[['bl','BL / HBL'],['ce','CE'],['di','DI / DUIMP']].map(([k,l]) => (
            <Fld key={k} label={l}><input style={INP} value={f[k]} onChange={e => s(k,e.target.value)} /></Fld>
          ))}
        </div>

        {/* Upload de arquivos — só aparece em edição */}
        {initial && (
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:8, padding:'10px 12px', marginBottom:10 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Arquivos do processo (PI, BL, CE...)</div>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display:'none' }} onChange={handleUpload} />
            <button style={{ ...BTN_GHOST, fontSize:11, padding:'4px 10px' }} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Enviando...' : '+ Anexar arquivo'}
            </button>
            {docs.length > 0 && (
              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:5 }}>
                {docs.map(d => (
                  <button key={d.id} style={{ ...BTN_GHOST, fontSize:10, padding:'2px 8px' }}
                    onClick={async () => { const u = await urlDocumento(d.storage_path); window.open(u) }}>
                    📄 {d.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <SecT>Status</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
          <Fld label="Status">
            <select style={SEL} value={f.status} onChange={e => s('status',e.target.value)}>
              {['Em produção','Em trânsito','Chegou','Desembaraçado'].map(v => <option key={v}>{v}</option>)}
            </select>
          </Fld>
          <Fld label="Anuência / LI">
            <select style={SEL} value={f.anuen} onChange={e => s('anuen',e.target.value)}>
              {['Deferida','Pendente LI','Sem LI','Pendente'].map(v => <option key={v}>{v}</option>)}
            </select>
          </Fld>
          <Fld label="Pendência" full><textarea style={{ ...INP, minHeight:44, resize:'vertical' }} value={f.pendencia} onChange={e => s('pendencia',e.target.value)} /></Fld>
          <Fld label="Obs. internas" full><textarea style={{ ...INP, minHeight:44, resize:'vertical' }} value={f.obs} onChange={e => s('obs',e.target.value)} /></Fld>
        </div>

        <SecT>Financeiro — PI</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:10, padding:11 }}>
            <div style={{ marginBottom:7 }}><span style={{ background:'#0e2a4a', color:C.blue, fontSize:10, padding:'1px 6px', borderRadius:6 }}>Entrada</span></div>
            <Fld label="Valor USD"><input type="number" style={INP} value={f.eUSD} onChange={e => s('eUSD',e.target.value)} /></Fld>
            <div style={{ marginTop:6 }}><Fld label={<span>Vencimento <span style={{ color:C.blue, fontSize:10 }}>(vazio=D+2)</span></span>}><input type="date" style={INP} value={f.eVenc} onChange={e => s('eVenc',e.target.value)} /></Fld></div>
            <div style={{ marginTop:6 }}><Fld label="Status"><select style={SEL} value={f.eSt} onChange={e => s('eSt',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option></select></Fld></div>
            {eHint && <div style={{ marginTop:5, background:'#0e2a4a', color:C.blue, fontSize:10, padding:'3px 7px', borderRadius:5 }}>⚡ Sem data → D+2 ({d2})</div>}
          </div>
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:10, padding:11 }}>
            <div style={{ marginBottom:7 }}><span style={{ background:'#1a0e3a', color:C.purple, fontSize:10, padding:'1px 6px', borderRadius:6 }}>Saldo</span></div>
            <Fld label={<span>Condição <span style={{ color:C.purple, fontSize:10 }}>(against doc...)</span></span>}><input style={INP} value={f.sCond} onChange={e => s('sCond',e.target.value)} placeholder="ex: against doc, 30 dias..." /></Fld>
            <div style={{ marginTop:6 }}><Fld label="Valor USD"><input type="number" style={INP} value={f.sUSD} onChange={e => s('sUSD',e.target.value)} /></Fld></div>
            <div style={{ marginTop:6 }}><Fld label={<span>Vencimento <span style={{ color:C.purple, fontSize:10 }}>(vazio=ETA−10d)</span></span>}><input type="date" style={INP} value={f.sVenc} onChange={e => s('sVenc',e.target.value)} /></Fld></div>
            <div style={{ marginTop:6 }}><Fld label="Status"><select style={SEL} value={f.sSt} onChange={e => s('sSt',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option></select></Fld></div>
            {sHint && <div style={{ marginTop:5, background:'#1a0e3a', color:C.purple, fontSize:10, padding:'3px 7px', borderRadius:5 }}>⚡ "{f.sCond||'sem condição'}" → ETA−10d{eta10 ? ` (${eta10})` : ''}</div>}
          </div>
        </div>

        {pLogs.length > 0 && (
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:8, padding:'9px 11px', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:500, color:C.muted, marginBottom:5 }}>Log deste processo</div>
            {pLogs.slice(0,4).map((l,i) => (
              <div key={i} style={{ fontSize:11, color:C.muted, padding:'2px 0', borderBottom:`0.5px solid ${C.border}` }}>
                {l.ts} — <span style={{ color:C.goldDim }}>{l.user}</span>: {l.campo} → <strong style={{ color:C.white }}>{l.para}</strong>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:12, borderTop:`0.5px solid ${C.border}` }}>
          <button onClick={onClose} style={BTN_GHOST}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ ...BTN_GOLD, opacity:saving?0.7:1 }}>
            {saving ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Follow-up ────────────────────────────────────────────
function ProcModal({ initial, logs, user, onSave, onClose }) {
  const p = initial || {}
  const [f, setF] = useState({
    proc:p.proc||'', cliente:p.cliente||'', fornecedor:p.fornecedor||'', agente:p.agente||'',
    navio:p.navio||'', porto:p.porto||'', eta:p.eta||'', container:p.container||'',
    freeTime:p.freeTime||14, quant:p.quant||1, bl:p.bl||'', ce:p.ce||'', di:p.di||'',
    status:p.status||'Em produção', anuen:p.anuen||'Pendente', pendencia:p.pendencia||'', obs:p.obs||'',
    eUSD:p.entradaUSD||'', eVenc:p.entradaVenc||'', eSt:p.entradaStatus||'pendente',
    sCond:p.saldoCondicao||'', sUSD:p.saldoUSD||'', sVenc:p.saldoVenc||'', sSt:p.saldoStatus||'pendente',
  })
  const [docs, setDocs]       = useState([])
  const [uploading, setUpl]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const fileRef               = useRef()
  const s = (k,v) => setF(prev => ({ ...prev, [k]:v }))

  const cadEm  = initial ? (p.cadastradoEm || TODAY) : TODAY
  const d2     = addDays(cadEm, 2)
  const eta10  = addDays(f.eta, -10)
  const eHint  = !f.eVenc
  const sHint  = !f.sVenc && isSaldoAuto(f.sCond)

  useEffect(() => {
    if (p.proc) listarDocumentos(p.proc).then(setDocs).catch(() => {})
  }, [p.proc])

  async function save() {
    setSaving(true)
    let eV = f.eVenc, eA = false
    if (!eV) { eV = addDays(cadEm, 2); eA = true }
    let sV = f.sVenc, sA = false
    if (!sV && isSaldoAuto(f.sCond) && f.eta) { sV = addDays(f.eta, -10); sA = true }
    await onSave({ ...f, entradaUSD:parseFloat(f.eUSD)||0, entradaVenc:eV, entradaStatus:f.eSt, entradaAuto:eA, saldoUSD:parseFloat(f.sUSD)||0, saldoVenc:sV, saldoStatus:f.sSt, saldoAuto:sA, saldoCondicao:f.sCond, cadastradoEm:cadEm, items:p.items||[] })
    setSaving(false)
  }

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setUpl(true)
    try {
      const tipo = guessDocType(file.name)
      await uploadDocumento(p.id, p.proc, file, tipo, user.nome || user.email)
      const d = await listarDocumentos(p.proc)
      setDocs(d)
    } catch (err) { alert('Erro no upload: ' + err.message) }
    finally { setUpl(false) }
  }

  const pLogs = logs.filter(l => l.proc === p.proc)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(5,12,28,0.88)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 12px', overflowY:'auto' }}>
      <div style={{ background:C.navyMid, border:`0.5px solid ${C.border}`, borderRadius:14, width:700, maxWidth:'100%', padding:'1.4rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', paddingBottom:10, borderBottom:`0.5px solid ${C.border}` }}>
          <span style={{ fontSize:15, fontWeight:500, color:C.gold }}>{initial ? `Editar — ${p.proc}` : 'Novo processo'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:20, cursor:'pointer' }}>×</button>
        </div>

        <SecT>Identificação</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
          {[['proc','Processo'],['cliente','Cliente'],['fornecedor','Fornecedor / Marca'],['agente','Agente / Armador']].map(([k,l]) => (
            <Fld key={k} label={l}><input style={INP} value={f[k]} onChange={e => s(k,e.target.value)} /></Fld>
          ))}
        </div>

        <SecT>Transporte</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:10 }}>
          <Fld label="Navio"><input style={INP} value={f.navio} onChange={e => s('navio',e.target.value)} /></Fld>
          <Fld label="Porto"><input style={INP} value={f.porto} onChange={e => s('porto',e.target.value)} /></Fld>
          <Fld label="ETA"><input type="date" style={INP} value={f.eta} onChange={e => s('eta',e.target.value)} /></Fld>
          <Fld label="Container"><input style={INP} value={f.container} onChange={e => s('container',e.target.value)} /></Fld>
          <Fld label="Free time (dias)"><input type="number" style={INP} value={f.freeTime} onChange={e => s('freeTime',e.target.value)} /></Fld>
          <Fld label="Qtd. containers"><input type="number" style={INP} value={f.quant} onChange={e => s('quant',e.target.value)} /></Fld>
        </div>

        <SecT>Documentos</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:10 }}>
          {[['bl','BL / HBL'],['ce','CE'],['di','DI / DUIMP']].map(([k,l]) => (
            <Fld key={k} label={l}><input style={INP} value={f[k]} onChange={e => s(k,e.target.value)} /></Fld>
          ))}
        </div>

        {/* Upload de arquivos — só aparece em edição */}
        {initial && (
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:8, padding:'10px 12px', marginBottom:10 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Arquivos do processo (PI, BL, CE...)</div>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display:'none' }} onChange={handleUpload} />
            <button style={{ ...BTN_GHOST, fontSize:11, padding:'4px 10px' }} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Enviando...' : '+ Anexar arquivo'}
            </button>
            {docs.length > 0 && (
              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:5 }}>
                {docs.map(d => (
                  <button key={d.id} style={{ ...BTN_GHOST, fontSize:10, padding:'2px 8px' }}
                    onClick={async () => { const u = await urlDocumento(d.storage_path); window.open(u) }}>
                    📄 {d.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <SecT>Status</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
          <Fld label="Status">
            <select style={SEL} value={f.status} onChange={e => s('status',e.target.value)}>
              {['Em produção','Em trânsito','Chegou','Desembaraçado'].map(v => <option key={v}>{v}</option>)}
            </select>
          </Fld>
          <Fld label="Anuência / LI">
            <select style={SEL} value={f.anuen} onChange={e => s('anuen',e.target.value)}>
              {['Deferida','Pendente LI','Sem LI','Pendente'].map(v => <option key={v}>{v}</option>)}
            </select>
          </Fld>
          <Fld label="Pendência" full><textarea style={{ ...INP, minHeight:44, resize:'vertical' }} value={f.pendencia} onChange={e => s('pendencia',e.target.value)} /></Fld>
          <Fld label="Obs. internas" full><textarea style={{ ...INP, minHeight:44, resize:'vertical' }} value={f.obs} onChange={e => s('obs',e.target.value)} /></Fld>
        </div>

        <SecT>Financeiro — PI</SecT>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:10, padding:11 }}>
            <div style={{ marginBottom:7 }}><span style={{ background:'#0e2a4a', color:C.blue, fontSize:10, padding:'1px 6px', borderRadius:6 }}>Entrada</span></div>
            <Fld label="Valor USD"><input type="number" style={INP} value={f.eUSD} onChange={e => s('eUSD',e.target.value)} /></Fld>
            <div style={{ marginTop:6 }}><Fld label={<span>Vencimento <span style={{ color:C.blue, fontSize:10 }}>(vazio=D+2)</span></span>}><input type="date" style={INP} value={f.eVenc} onChange={e => s('eVenc',e.target.value)} /></Fld></div>
            <div style={{ marginTop:6 }}><Fld label="Status"><select style={SEL} value={f.eSt} onChange={e => s('eSt',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option></select></Fld></div>
            {eHint && <div style={{ marginTop:5, background:'#0e2a4a', color:C.blue, fontSize:10, padding:'3px 7px', borderRadius:5 }}>⚡ Sem data → D+2 ({d2})</div>}
          </div>
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:10, padding:11 }}>
            <div style={{ marginBottom:7 }}><span style={{ background:'#1a0e3a', color:C.purple, fontSize:10, padding:'1px 6px', borderRadius:6 }}>Saldo</span></div>
            <Fld label={<span>Condição <span style={{ color:C.purple, fontSize:10 }}>(against doc...)</span></span>}><input style={INP} value={f.sCond} onChange={e => s('sCond',e.target.value)} placeholder="ex: against doc, 30 dias..." /></Fld>
            <div style={{ marginTop:6 }}><Fld label="Valor USD"><input type="number" style={INP} value={f.sUSD} onChange={e => s('sUSD',e.target.value)} /></Fld></div>
            <div style={{ marginTop:6 }}><Fld label={<span>Vencimento <span style={{ color:C.purple, fontSize:10 }}>(vazio=ETA−10d)</span></span>}><input type="date" style={INP} value={f.sVenc} onChange={e => s('sVenc',e.target.value)} /></Fld></div>
            <div style={{ marginTop:6 }}><Fld label="Status"><select style={SEL} value={f.sSt} onChange={e => s('sSt',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option></select></Fld></div>
            {sHint && <div style={{ marginTop:5, background:'#1a0e3a', color:C.purple, fontSize:10, padding:'3px 7px', borderRadius:5 }}>⚡ "{f.sCond||'sem condição'}" → ETA−10d{eta10 ? ` (${eta10})` : ''}</div>}
          </div>
        </div>

        {pLogs.length > 0 && (
          <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:8, padding:'9px 11px', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:500, color:C.muted, marginBottom:5 }}>Log deste processo</div>
            {pLogs.slice(0,4).map((l,i) => (
              <div key={i} style={{ fontSize:11, color:C.muted, padding:'2px 0', borderBottom:`0.5px solid ${C.border}` }}>
                {l.ts} — <span style={{ color:C.goldDim }}>{l.user}</span>: {l.campo} → <strong style={{ color:C.white }}>{l.para}</strong>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:12, borderTop:`0.5px solid ${C.border}` }}>
          <button onClick={onClose} style={BTN_GHOST}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ ...BTN_GOLD, opacity:saving?0.7:1 }}>
            {saving ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Follow-up ────────────────────────────────────────────
