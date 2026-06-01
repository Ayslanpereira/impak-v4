// src/tabs/TabImportar.jsx — IMPAK v4.0
import { useState, useRef } from 'react'
import { extrairDocumentoIA, salvarProcesso, uploadDocumento } from '../db.js'
import { C, INP, INP_F, SEL, BTN_GOLD, BTN_GHOST, Fld, SecT, Spin, Card, StepH } from '../components/ui.jsx'

const SALDO_TERMS = ['against doc','against document','a/d','after shipment','sight','à vista','a vista','d/p']
const TODAY = new Date().toISOString().slice(0,10)
function addDays(s, n) { if (!s) return ''; const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
function isSaldoAuto(t) { const tl = (t||'').toLowerCase().trim(); return !tl || SALDO_TERMS.some(k => tl.includes(k)) }
function guessDocType(name) {
  const n = name.toLowerCase()
  if (n.includes('pi') || n.includes('proforma') || n.includes('invoice')) return 'PI'
  if (n.includes('pack') || n.includes('packing')) return 'Packing List'
  if (n.includes('bl') || n.includes('bill') || n.includes('lading')) return 'BL'
  if (n.includes('ce') || n.includes('conhec')) return 'CE'
  return 'Outro'
}
async function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file) })
}

export default function TabImportar({ procs, onSave, addLog, user, onDone }) {
  const [ref, setRef]       = useState('')
  const [action, setAction] = useState('create')
  const [files, setFiles]   = useState([])
  const [docTypes, setDocTypes] = useState({})
  const [status, setStatus] = useState(null)
  const [extracted, setExtracted] = useState(null)
  const [form, setFormState] = useState(null)
  const [done, setDone]     = useState(null)
  const [drag, setDrag]     = useState(false)
  const fileRef = useRef()
  const setF = (k,v) => setFormState(prev => ({ ...prev, [k]:v }))

  const handleFiles = useCallback((incoming) => {
    const arr = Array.from(incoming)
    setFiles(prev => { const names = prev.map(f=>f.name); return [...prev, ...arr.filter(f=>!names.includes(f.name))] })
    setDocTypes(prev => { const n={...prev}; arr.forEach(f=>{ if(!n[f.name]) n[f.name]=guessDocType(f.name) }); return n })
  }, [])

  const remFile = (name) => { setFiles(f=>f.filter(x=>x.name!==name)); setDocTypes(d=>{const n={...d};delete n[name];return n}) }

  async function run() {
    if (!ref.trim() || files.length===0) return
    setStatus({ msg:'Preparando documentos...', type:'loading' }); setExtracted(null)
    try {
      const partes = []
      for (const file of files) {
        const b64  = await fileToBase64(file)
        const tipo = docTypes[file.name] || 'Documento'
        partes.push({ type:'text', text:`[Documento: ${tipo} — ${file.name}]` })
        if (file.type==='application/pdf') {
          partes.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } })
        } else {
          partes.push({ type:'image', source:{ type:'base64', media_type:file.type||'image/jpeg', data:b64 } })
        }
      }
      setStatus({ msg:'Analisando com IA...', type:'loading' })
      const d = await extrairDocumentoIA(partes, ref)
      setExtracted(d)
      setFormState({
        proc:d.proc||ref, cliente:d.cliente||'', fornecedor:d.fornecedor||'', agente:d.agente||'',
        navio:d.navio||'', porto:d.porto||'', eta:d.eta||'', container:d.container||'',
        freeTime:d.freeTime||14, quant:d.quant||1, bl:d.bl||'', ce:d.ce||'', di:d.di||'', piNum:d.piNum||'',
        status:d.status||'Em produção', anuen:d.anuen||'Pendente', pendencia:d.pendencia||'', obs:d.obs||'',
        entUSD:d.entradaUSD||(d.totalUSD?+(d.totalUSD/2).toFixed(2):''),
        entVenc:d.entradaVenc||'', entSt:'pendente',
        salUSD:d.saldoUSD||(d.totalUSD?+(d.totalUSD/2).toFixed(2):''),
        salVenc:d.saldoVenc||'', salSt:'pendente', salCond:d.saldoCondicao||'',
        items:d.items||[], conf:d.confianca||'alta',
      })
      setStatus({ msg:'Extração concluída!', type:'ok' })
    } catch(err) {
      setStatus({ msg:'Erro: '+err.message, type:'err' })
    }
  }

  async function confirm() {
    if (!form) return
    const ts = new Date().toISOString().slice(0,16).replace('T',' ')
    let eV=form.entVenc, eA=false; if(!eV){eV=addDays(TODAY,2);eA=true}
    let sV=form.salVenc, sA=false; if(!sV&&isSaldoAuto(form.salCond)&&form.eta){sV=addDays(form.eta,-10);sA=true}
    const novo = { proc:form.proc, cliente:form.cliente, fornecedor:form.fornecedor, agente:form.agente, navio:form.navio, porto:form.porto, eta:form.eta, container:form.container, freeTime:parseInt(form.freeTime)||14, quant:parseInt(form.quant)||1, bl:form.bl, ce:form.ce, di:form.di, piNum:form.piNum, status:form.status, anuen:form.anuen, pendencia:form.pendencia, obs:form.obs, cadastradoEm:TODAY, items:form.items||[], entradaUSD:parseFloat(form.entUSD)||0, entradaVenc:eV, entradaStatus:form.entSt, entradaAuto:eA, saldoUSD:parseFloat(form.salUSD)||0, saldoVenc:sV, saldoStatus:form.salSt, saldoAuto:sA, saldoCondicao:form.salCond }
    const le = [{ ts, user:user.nome, proc:novo.proc, campo:'Criação via IA', de:'', para:'Processo criado via extração de documento' }]
    if (eA) le.push({ ts, user:'Sistema', proc:novo.proc, campo:'Entrada venc.', de:'(vazio)', para:`${eV} (D+2 auto)` })
    if (sA) le.push({ ts, user:'Sistema', proc:novo.proc, campo:'Saldo venc.',   de:'(vazio)', para:`${sV} (ETA−10d auto — ${form.salCond})` })
    await addLog(le)
    await onSave(novo)
    setDone({ proc:novo.proc, eV, eA, sV, sA })
  }

  if (done) return (
    <div style={{ padding:'40px 0', textAlign:'center' }}>
      <div style={{ background:'#0a2318', border:`0.5px solid #1a5c3a`, borderRadius:12, padding:'24px 20px', maxWidth:480, margin:'0 auto' }}>
        <div style={{ fontSize:30, color:C.green, marginBottom:8 }}>✓</div>
        <p style={{ color:C.green, fontSize:15, fontWeight:500 }}>Processo <strong>{done.proc}</strong> salvo!</p>
        <p style={{ color:C.muted, fontSize:12, marginTop:6 }}>Entrada: {done.eV}{done.eA?' (D+2 auto)':''} · Saldo: {done.sV||'sem data'}{done.sA?' (ETA−10d auto)':''}</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:14 }}>
          <button onClick={() => { setDone(null); setFiles([]); setDocTypes({}); setRef(''); setExtracted(null); setFormState(null); setStatus(null) }} style={BTN_GHOST}>Importar outro</button>
          <button onClick={onDone} style={BTN_GOLD}>Ver processos →</button>
        </div>
      </div>
    </div>
  )

  const eHint = form && !form.entVenc
  const sHint = form && !form.salVenc && isSaldoAuto(form?.salCond)
  const box = (title, bg, col, children) => (
    <div style={{ background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:10, padding:11 }}>
      <div style={{ marginBottom:7 }}><span style={{ background:bg, color:col, fontSize:10, padding:'1px 6px', borderRadius:6 }}>{title}</span></div>
      {children}
    </div>
  )

  return (
    <div>
      <Card>
        <StepH num={1} title="Referência do processo" sub="Número que será criado ou atualizado" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
          <Fld label="Número do processo *"><input style={INP} value={ref} onChange={e => setRef(e.target.value)} placeholder="ex: BR26R034A" /></Fld>
          <Fld label="Ação">
            <select style={SEL} value={action} onChange={e => setAction(e.target.value)}>
              <option value="create">Criar novo processo</option>
              <option value="update">Atualizar existente</option>
            </select>
          </Fld>
        </div>
      </Card>

      <Card>
        <StepH num={2} title="Documentos" sub="PI, Packing List, BL, CE — PDF ou imagem, múltiplos arquivos" />
        <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFiles(e.dataTransfer.files)}} onClick={()=>fileRef.current?.click()}
          style={{ border:`1.5px dashed ${drag?C.goldDim:C.border}`, borderRadius:9, padding:24, textAlign:'center', cursor:'pointer', background:drag?'rgba(200,168,75,0.04)':'transparent' }}>
          <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
          <div style={{ fontSize:24, color:C.goldDim, marginBottom:6 }}>☁</div>
          <div style={{ fontSize:13, color:C.muted }}><strong style={{ color:C.gold }}>Clique</strong> ou arraste aqui</div>
        </div>
        {files.length > 0 && (
          <div style={{ marginTop:10 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
              {files.map(f => <div key={f.name} style={{ display:'flex', alignItems:'center', gap:5, background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:20, padding:'2px 9px', fontSize:11 }}><span style={{ fontSize:9, color:C.goldDim }}>{docTypes[f.name]}</span>📄 {f.name}<span onClick={()=>remFile(f.name)} style={{ color:C.muted, cursor:'pointer', marginLeft:2 }}>×</span></div>)}
            </div>
            {files.map(f => <div key={f.name} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginBottom:3 }}><span style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📄 {f.name}</span><select style={{ ...SEL, width:'auto', fontSize:11, padding:'3px 7px' }} value={docTypes[f.name]||'Outro'} onChange={e=>setDocTypes(d=>({...d,[f.name]:e.target.value}))}>{['PI','Packing List','BL','CE','CO','DI','Outro'].map(t=><option key={t}>{t}</option>)}</select></div>)}
          </div>
        )}
      </Card>

      <Card>
        <StepH num={3} title="Extração com IA" sub="Claude analisa e preenche os campos automaticamente" />
        <button onClick={run} disabled={files.length===0||!ref.trim()||status?.type==='loading'}
          style={{ ...BTN_GOLD, width:'100%', padding:11, fontSize:14, opacity:(files.length===0||!ref.trim())?0.5:1, cursor:(files.length===0||!ref.trim())?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {status?.type==='loading' ? <Spin /> : '✦'} Extrair dados dos documentos
        </button>
        {status && (
          <div style={{ marginTop:10, background:C.navy, border:`0.5px solid ${status.type==='ok'?'#1a5c3a':status.type==='err'?'#5c1a1a':C.border}`, borderRadius:7, padding:'9px 12px', fontSize:12, color:status.type==='ok'?C.green:status.type==='err'?C.red:C.muted, display:'flex', alignItems:'center', gap:7 }}>
            {status.type==='loading' && <Spin />} {status.msg}
          </div>
        )}
      </Card>

      {form && extracted && (
        <Card>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingBottom:10, borderBottom:`0.5px solid ${C.border}` }}>
            <span style={{ fontSize:14, fontWeight:500, color:C.gold }}>✓ Revise os dados extraídos</span>
            {(() => { const m={alta:['#0c2318',C.green,'Alta confiança'],média:['#2a1e08',C.amber,'Média'],baixa:['#2a1010',C.red,'Baixa']}; const [bg,col,l]=m[form.conf]||m.alta; return <span style={{ fontSize:11, padding:'2px 9px', borderRadius:10, background:bg, color:col }}>{l}</span> })()}
          </div>
          <SecT>Identificação</SecT>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
            {[['proc','Processo'],['cliente','Cliente'],['fornecedor','Fornecedor'],['agente','Agente']].map(([k,l]) => <Fld key={k} label={l}><input style={form[k]?INP_F:INP} value={form[k]||''} onChange={e=>setF(k,e.target.value)} /></Fld>)}
          </div>
          <SecT>Transporte</SecT>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:10 }}>
            {[['navio','Navio'],['porto','Porto']].map(([k,l]) => <Fld key={k} label={l}><input style={form[k]?INP_F:INP} value={form[k]||''} onChange={e=>setF(k,e.target.value)} /></Fld>)}
            <Fld label="ETA"><input type="date" style={form.eta?INP_F:INP} value={form.eta||''} onChange={e=>setF('eta',e.target.value)} /></Fld>
            <Fld label="Container"><input style={form.container?INP_F:INP} value={form.container||''} onChange={e=>setF('container',e.target.value)} /></Fld>
            <Fld label="Free time"><input type="number" style={INP_F} value={form.freeTime||14} onChange={e=>setF('freeTime',e.target.value)} /></Fld>
            <Fld label="Qtd"><input type="number" style={INP_F} value={form.quant||1} onChange={e=>setF('quant',e.target.value)} /></Fld>
          </div>
          <SecT>Documentos</SecT>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
            {[['bl','BL / HBL'],['ce','CE'],['di','DI / DUIMP'],['piNum','Número PI']].map(([k,l]) => <Fld key={k} label={l}><input style={form[k]?INP_F:INP} value={form[k]||''} onChange={e=>setF(k,e.target.value)} /></Fld>)}
          </div>
          <SecT>Financeiro — PI</SecT>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            {box('Entrada','#0e2a4a',C.blue, <>
              <Fld label="Valor USD"><input type="number" style={form.entUSD?INP_F:INP} value={form.entUSD||''} onChange={e=>setF('entUSD',e.target.value)} /></Fld>
              <div style={{ marginTop:5 }}><Fld label="Vencimento"><input type="date" style={form.entVenc?INP_F:INP} value={form.entVenc||''} onChange={e=>setF('entVenc',e.target.value)} /></Fld></div>
              <div style={{ marginTop:5 }}><Fld label="Status"><select style={SEL} value={form.entSt} onChange={e=>setF('entSt',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option></select></Fld></div>
              {eHint && <div style={{ marginTop:5, background:'#0e2a4a', color:C.blue, fontSize:10, padding:'3px 7px', borderRadius:5 }}>⚡ D+2 ({addDays(TODAY,2)})</div>}
            </>)}
            {box('Saldo','#1a0e3a',C.purple, <>
              <Fld label="Condição"><input style={form.salCond?INP_F:INP} value={form.salCond||''} onChange={e=>setF('salCond',e.target.value)} placeholder="against doc..." /></Fld>
              <div style={{ marginTop:5 }}><Fld label="Valor USD"><input type="number" style={form.salUSD?INP_F:INP} value={form.salUSD||''} onChange={e=>setF('salUSD',e.target.value)} /></Fld></div>
              <div style={{ marginTop:5 }}><Fld label="Vencimento"><input type="date" style={form.salVenc?INP_F:INP} value={form.salVenc||''} onChange={e=>setF('salVenc',e.target.value)} /></Fld></div>
              <div style={{ marginTop:5 }}><Fld label="Status"><select style={SEL} value={form.salSt} onChange={e=>setF('salSt',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option></select></Fld></div>
              {sHint && <div style={{ marginTop:5, background:'#1a0e3a', color:C.purple, fontSize:10, padding:'3px 7px', borderRadius:5 }}>⚡ ETA−10d{form.eta?` (${addDays(form.eta,-10)})`:''}</div>}
            </>)}
          </div>
          <SecT>Status</SecT>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
            <Fld label="Status"><select style={SEL} value={form.status} onChange={e=>setF('status',e.target.value)}>{['Em produção','Em trânsito','Chegou','Desembaraçado'].map(s=><option key={s}>{s}</option>)}</select></Fld>
            <Fld label="Anuência"><select style={SEL} value={form.anuen} onChange={e=>setF('anuen',e.target.value)}>{['Pendente','Deferida','Pendente LI','Sem LI'].map(s=><option key={s}>{s}</option>)}</select></Fld>
            <Fld label="Obs" full><textarea style={{ ...INP, minHeight:44, resize:'vertical' }} value={form.obs||''} onChange={e=>setF('obs',e.target.value)} /></Fld>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:12, borderTop:`0.5px solid ${C.border}` }}>
            <button onClick={() => { setExtracted(null); setFormState(null); setStatus(null) }} style={BTN_GHOST}>↺ Reextrair</button>
            <button onClick={confirm} style={BTN_GOLD}>✓ Confirmar e salvar processo</button>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Tab Logs ─────────────────────────────────────────────────
