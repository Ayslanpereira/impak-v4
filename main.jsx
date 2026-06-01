// src/tabs/TabConferencia.jsx — IMPAK v4.0
// Conferência documental portada do v3.0 (HTML) para React
// Histórico salvo no Supabase — Paula vê todas, Emanuele só as dela
import { useState, useRef, useCallback, useEffect } from 'react'
import { salvarConferencia, listarConferencias, deletarConferencia } from '../db.js'
import { C, INP, BTN_GOLD, BTN_GHOST, BTN_RED, Spin, Card, StepH, Modal, EmptyState } from '../components/ui.jsx'

const TIPOS_DOC = ['CI', 'PL', 'BL', 'Pl', 'CE Mercante', 'Outro']

async function fileToBase64(file) {
  return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file) })
}

export default function TabConferencia({ user }) {
  const isGerente = user?.perm === 'full'

  const [ref, setRef]             = useState('')
  const [exportador, setExportador] = useState('')
  const [files, setFiles]         = useState([])
  const [docTypes, setDocTypes]   = useState({})
  const [drag, setDrag]           = useState(false)
  const [status, setStatus]       = useState(null)
  const [resultado, setResultado] = useState(null)
  const [divergResolved, setDivergResolved] = useState({})
  const [historico, setHistorico] = useState([])
  const [showHistorico, setShowHistorico] = useState(false)
  const [apiKey, setApiKey]       = useState(() => { try { return localStorage.getItem('impak_apikey')||'' } catch{ return '' } })
  const [apiConfirmed, setApiConfirmed] = useState(!!apiKey)
  const fileRef = useRef()

  useEffect(() => { carregarHistorico() }, [])

  async function carregarHistorico() {
    try {
      const data = await listarConferencias(user.nome, isGerente)
      setHistorico(data)
    } catch {}
  }

  const handleFiles = useCallback((incoming) => {
    const arr = Array.from(incoming)
    setFiles(prev => {
      const names = prev.map(f=>f.name)
      const novos = arr.filter(f=>!names.includes(f.name))
      const tipos = {}
      novos.forEach(f => { tipos[f.name] = guessDocType(f.name) })
      setDocTypes(d => ({...d, ...tipos}))
      return [...prev, ...novos]
    })
  }, [])

  function guessDocType(name) {
    const n = name.toLowerCase()
    if (n.includes('ci') || n.includes('invoice') || n.includes('commercial')) return 'CI'
    if (n.includes('pack') || n.includes('packing') || n.includes('pl')) return 'PL'
    if (n.includes('bl') || n.includes('bill') || n.includes('lading')) return 'BL'
    if (n.includes('ce') || n.includes('conhec') || n.includes('mercante')) return 'CE Mercante'
    return 'Outro'
  }

  async function iniciarConferencia() {
    if (!ref.trim()) { setStatus({ type:'err', msg:'Informe a referência do processo.' }); return }
    if (!files.length) { setStatus({ type:'err', msg:'Adicione pelo menos um documento.' }); return }
    if (!apiKey) { setStatus({ type:'err', msg:'Configure a API Key da Anthropic na barra lateral.' }); return }

    setStatus({ type:'loading', msg:'Preparando documentos...' })
    setResultado(null)
    setDivergResolved({})

    try {
      const partes = []
      for (const file of files) {
        const b64 = await fileToBase64(file)
        partes.push({ type:'text', text:`[${docTypes[file.name]||'Outro'}: ${file.name}]` })
        if (file.type==='application/pdf') {
          partes.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } })
        } else {
          partes.push({ type:'image', source:{ type:'base64', media_type:file.type||'image/jpeg', data:b64 } })
        }
      }

      setStatus({ type:'loading', msg:'Analisando com IA... (pode levar até 30s)' })

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages:[{ role:'user', content:[
            ...partes,
            { type:'text', text:`Você é especialista em conferência documental de importação de pneus.
Analise os documentos (CI=Commercial Invoice, PL=Packing List, BL=Bill of Lading, CE Mercante) e confira se os dados batem entre si.
Referência do processo: ${ref}

Retorne APENAS JSON válido sem markdown:
{
  "ref": "${ref}",
  "exportador": "",
  "resumo": "texto breve do resultado",
  "status": "ok|alertas|divergencias",
  "documentos": [{"tipo":"CI","numero":"","data":"","descricao":""}],
  "divergencias": [{"campo":"","docA":"","valorA":"","docB":"","valorB":"","gravidade":"alta|media|baixa","descricao":""}],
  "alertas": [{"campo":"","descricao":"","gravidade":"alta|media|baixa"}],
  "totais": {"volumes":0,"pesoBruto":0,"pesoLiquido":0,"valorUSD":0,"moeda":"USD"},
  "itens": [{"descricao":"","ncm":"","qtd":0,"unidade":"","valorUnit":0}]
}` }
          ]}]}),
      })

      const data = await resp.json()
      if (data.error) throw new Error(data.error.message)

      const raw = data.content.map(b=>b.text||'').join('').trim()
      const match = raw.replace(/```json|```/g,'').match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Resposta inesperada da IA')

      const res = JSON.parse(match[0])
      setResultado(res)
      setStatus({ type:'ok', msg:'Conferência concluída!' })

      // Salvar no Supabase
      await salvarConferencia({ ref, exportador: res.exportador||exportador, status: res.status, resultado: res }, user.nome)
      await carregarHistorico()

    } catch(e) {
      setStatus({ type:'err', msg:'Erro: ' + e.message })
    }
  }

  function toggleDiv(idx) {
    setDivergResolved(prev => ({...prev, [idx]: !prev[idx]}))
  }

  function confirmarApiKey() {
    try { localStorage.setItem('impak_apikey', apiKey) } catch {}
    setApiConfirmed(true)
  }

  const divCount    = resultado?.divergencias?.filter((_,i)=>!divergResolved[i]).length || 0
  const alertCount  = resultado?.alertas?.length || 0

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, padding:'12px 0', borderBottom:`0.5px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:C.gold }}>✦ Conferência Documental</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Análise automática de divergências nos documentos de importação</div>
        </div>
        <button onClick={()=>setShowHistorico(true)} style={BTN_GHOST}>📂 Histórico{isGerente?' (todos)':''}</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16 }}>
        {/* Coluna principal */}
        <div>
          <Card>
            <StepH num={1} title="Identificação" sub="Referência do processo" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:3 }}>Referência *</label>
                <input style={INP} value={ref} onChange={e=>setRef(e.target.value)} placeholder="ex: UD26-009" />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:3 }}>Exportador</label>
                <input style={INP} value={exportador} onChange={e=>setExportador(e.target.value)} placeholder="ex: Jinyu Tire" />
              </div>
            </div>
          </Card>

          <Card>
            <StepH num={2} title="Documentos" sub="CI, PL, BL, CE Mercante — PDF ou imagem" />
            <div
              onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);handleFiles(e.dataTransfer.files)}}
              onClick={()=>fileRef.current?.click()}
              style={{ border:`1.5px dashed ${drag?C.goldDim:C.border}`, borderRadius:9, padding:24, textAlign:'center', cursor:'pointer', background:drag?'rgba(200,168,75,0.04)':'transparent' }}
            >
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
              <div style={{ fontSize:24, color:C.goldDim, marginBottom:6 }}>☁</div>
              <div style={{ fontSize:13, color:C.muted }}><strong style={{ color:C.gold }}>Clique</strong> ou arraste os arquivos</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>PDF, PNG, JPG — múltiplos de uma vez</div>
            </div>
            {files.length>0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                  {files.map(f => (
                    <div key={f.name} style={{ display:'flex', alignItems:'center', gap:5, background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:20, padding:'2px 9px', fontSize:11 }}>
                      <span style={{ fontSize:9, color:C.goldDim }}>{docTypes[f.name]}</span> 📄 {f.name}
                      <span onClick={()=>setFiles(p=>p.filter(x=>x.name!==f.name))} style={{ color:C.muted, cursor:'pointer', marginLeft:2 }}>×</span>
                    </div>
                  ))}
                </div>
                {files.map(f => (
                  <div key={f.name} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginBottom:3 }}>
                    <span style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📄 {f.name}</span>
                    <select style={{ ...INP, width:'auto', fontSize:11, padding:'3px 7px' }} value={docTypes[f.name]||'Outro'} onChange={e=>setDocTypes(d=>({...d,[f.name]:e.target.value}))}>
                      {TIPOS_DOC.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <StepH num={3} title="Iniciar conferência" sub="IA analisa e aponta divergências" />
            <button onClick={iniciarConferencia} disabled={!files.length||!ref.trim()||status?.type==='loading'}
              style={{ ...BTN_GOLD, width:'100%', padding:11, fontSize:14, opacity:(!files.length||!ref.trim())?0.5:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {status?.type==='loading'?<Spin />:'✦'} Iniciar Conferência com IA
            </button>
            {status && (
              <div style={{ marginTop:10, background:C.navy, border:`0.5px solid ${status.type==='ok'?'#1a5c3a':status.type==='err'?'#5c1a1a':C.border}`, borderRadius:7, padding:'9px 12px', fontSize:12, color:status.type==='ok'?C.green:status.type==='err'?C.red:C.muted, display:'flex', alignItems:'center', gap:7 }}>
                {status.type==='loading'&&<Spin />} {status.msg}
              </div>
            )}
          </Card>

          {/* Resultado */}
          {resultado && (
            <>
              {/* Status geral */}
              <Card style={{ borderColor: resultado.status==='ok'?'#1a5c3a':resultado.status==='alertas'?'#6b4a10':'#6b2020' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:resultado.status==='ok'?C.green:resultado.status==='alertas'?C.amber:C.red }}>
                    {resultado.status==='ok'?'✓ Documentos conferidos':'⚠ '+resultado.resumo}
                  </span>
                  <span style={{ fontSize:11, color:C.muted }}>{ref}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:8 }}>
                  {resultado.totais && Object.entries({ Volumes:resultado.totais.volumes, 'Peso bruto':resultado.totais.pesoBruto+'kg', 'Peso líq':resultado.totais.pesoLiquido+'kg', Valor:`USD ${(resultado.totais.valorUSD||0).toLocaleString()}` }).map(([k,v])=>(
                    <div key={k}><div style={{ fontSize:10, color:C.muted }}>{k}</div><div style={{ fontSize:13, fontWeight:500 }}>{v}</div></div>
                  ))}
                </div>
              </Card>

              {/* Divergências */}
              {resultado.divergencias?.length>0 && (
                <Card>
                  <div style={{ fontSize:13, fontWeight:500, color:C.red, marginBottom:12 }}>
                    ⚠ Divergências ({divCount} pendente{divCount!==1?'s':''})
                  </div>
                  {resultado.divergencias.map((d,i) => (
                    <div key={i} style={{ background:divergResolved[i]?'rgba(31,190,122,0.05)':'rgba(224,82,82,0.05)', border:`0.5px solid ${divergResolved[i]?C.green:C.red}`, borderRadius:8, padding:12, marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                        <span style={{ fontSize:12, fontWeight:500, color:divergResolved[i]?C.green:C.red }}>{d.campo}</span>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ fontSize:10, color:C.muted, background:C.navy, padding:'1px 6px', borderRadius:4 }}>{d.gravidade}</span>
                          <button onClick={()=>toggleDiv(i)} style={{ ...BTN_GHOST, fontSize:10, padding:'2px 8px', color:divergResolved[i]?C.green:C.muted }}>
                            {divergResolved[i]?'✓ Resolvido':'Marcar resolvido'}
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{d.descricao}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <div style={{ background:C.navy, borderRadius:6, padding:'6px 8px' }}><div style={{ fontSize:10, color:C.muted }}>{d.docA}</div><div style={{ fontSize:12, color:C.white }}>{d.valorA}</div></div>
                        <div style={{ background:C.navy, borderRadius:6, padding:'6px 8px' }}><div style={{ fontSize:10, color:C.muted }}>{d.docB}</div><div style={{ fontSize:12, color:C.white }}>{d.valorB}</div></div>
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {/* Alertas */}
              {resultado.alertas?.length>0 && (
                <Card>
                  <div style={{ fontSize:13, fontWeight:500, color:C.amber, marginBottom:12 }}>⚡ Alertas ({alertCount})</div>
                  {resultado.alertas.map((a,i) => (
                    <div key={i} style={{ background:'rgba(230,160,48,0.05)', border:`0.5px solid ${C.amber}`, borderRadius:8, padding:10, marginBottom:6 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:C.amber, marginBottom:3 }}>{a.campo}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{a.descricao}</div>
                    </div>
                  ))}
                </Card>
              )}

              {/* Itens */}
              {resultado.itens?.length>0 && (
                <Card>
                  <div style={{ fontSize:13, fontWeight:500, color:C.gold, marginBottom:12 }}>Itens da carga</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr>{['Descrição','NCM','Qtd','Unidade','Valor unit.'].map(h=><th key={h} style={{ textAlign:'left', padding:'5px 7px', fontSize:10, color:C.muted, borderBottom:`0.5px solid ${C.border}`, textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {resultado.itens.map((it,i)=>(
                          <tr key={i}>
                            <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{it.descricao}</td>
                            <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, color:C.muted }}>{it.ncm}</td>
                            <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{it.qtd}</td>
                            <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, color:C.muted }}>{it.unidade}</td>
                            <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>USD {it.valorUnit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <Card>
            <div style={{ fontSize:11, fontWeight:500, color:C.goldDim, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>API Key Anthropic</div>
            <input style={{ ...INP, fontSize:12 }} type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value);setApiConfirmed(false)}} placeholder="sk-ant-..." />
            <button onClick={confirmarApiKey} style={{ ...BTN_GOLD, width:'100%', marginTop:6, fontSize:12, padding:7 }}>✓ Confirmar chave</button>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:apiConfirmed&&apiKey?C.green:C.muted }} />
              <span style={{ fontSize:10, color:C.muted }}>{apiConfirmed&&apiKey?'Configurada':'Não configurada'}</span>
            </div>
          </Card>

          {resultado && (
            <Card>
              <div style={{ fontSize:11, fontWeight:500, color:C.goldDim, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>Documentos analisados</div>
              {resultado.documentos?.map((d,i)=>(
                <div key={i} style={{ padding:'5px 0', borderBottom:`0.5px solid ${C.border}`, fontSize:12 }}>
                  <span style={{ color:C.goldDim, fontSize:10 }}>{d.tipo}</span>
                  <div style={{ color:C.white }}>{d.numero||'—'}</div>
                  <div style={{ color:C.muted, fontSize:11 }}>{d.data}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* Modal Histórico */}
      {showHistorico && (
        <Modal title={`📂 Histórico de Conferências${isGerente?' — Todas':''}`} onClose={()=>setShowHistorico(false)} width={640}>
          {historico.length===0 ? (
            <EmptyState icon="📭" title="Nenhuma conferência realizada" />
          ) : (
            historico.map(conf => {
              const res = conf.resultado || {}
              return (
                <div key={conf.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:`0.5px solid ${C.border}` }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:500, color:C.white }}>{conf.ref}</span>
                      <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:conf.status==='ok'?'#0a2318':conf.status==='alertas'?'#2a1e08':'#2a1010', color:conf.status==='ok'?C.green:conf.status==='alertas'?C.amber:C.red }}>{conf.status}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                      {conf.exportador && `${conf.exportador} · `}
                      {new Date(conf.created_at).toLocaleDateString('pt-BR')} · {conf.criado_por}
                      {res.divergencias?.length>0 && ` · ${res.divergencias.length} divergência(s)`}
                    </div>
                  </div>
                  <button onClick={async()=>{if(confirm('Excluir?')){await deletarConferencia(conf.id);await carregarHistorico()}}} style={{ ...BTN_RED, fontSize:11, padding:'4px 10px' }}>Excluir</button>
                </div>
              )
            })
          )}
        </Modal>
      )}
    </div>
  )
}
