// src/tabs/TabAnalisador.jsx — IMPAK v4.0
// Analisador de Preço com salvamento de cotações no Supabase
import { useState, useRef, useCallback, useEffect } from 'react'
import { salvarCotacao, listarCotacoes, deletarCotacao, analisarCotacaoIA } from '../db.js'
import { C, INP, INP_F, SEL, BTN_GOLD, BTN_GHOST, BTN_RED, Fld, SecT, Spin, Card, StepH, Modal, EmptyState } from '../components/ui.jsx'

function n(v, d=2) { return isNaN(v) ? 0 : parseFloat(Number(v).toFixed(d)) }
function fmt(v, d=2) { return n(v,d).toLocaleString('pt-BR', { minimumFractionDigits:d, maximumFractionDigits:d }) }
function fmtUSD(v) { return 'USD ' + fmt(v,2) }
function fmtBRL(v) { return 'R$ ' + fmt(v,2) }
async function fileToBase64(file) {
  return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file) })
}

function fornecedorVazio(id) {
  return { id, nome:'', pais:'China', incoterm:'FOB', moeda:'USD', descricao:'', ncm:'', qtdUnid:'', unidade:'PAR', precoUnit:'', freteMar:'', freteInt:'', seguro:'', ii:'', ipi:'', pis:'', cofins:'', icms:'', afrmm:'', siscomex:'', despAduaneiras:'', armazenagem:'', agenciamento:'', despBancarias:'', outros:'', cambio:'', obs:'' }
}

function calcularCusto(f, cambioAtual) {
  const cambio = parseFloat(f.cambio) || cambioAtual
  const qtd    = parseFloat(f.qtdUnid) || 1
  const pUnit  = parseFloat(f.precoUnit) || 0
  const valorMerc = qtd * pUnit
  const freteMar  = parseFloat(f.freteMar) || 0
  const seguro    = parseFloat(f.seguro) || 0
  const cif = (valorMerc + freteMar + seguro) * cambio
  const iiPct     = parseFloat(f.ii)     / 100 || 0
  const ipiPct    = parseFloat(f.ipi)    / 100 || 0
  const pisPct    = parseFloat(f.pis)    / 100 || 0
  const cofinsPct = parseFloat(f.cofins) / 100 || 0
  const icmsPct   = parseFloat(f.icms)   / 100 || 0
  const iiVal     = cif * iiPct
  const ipiVal    = (cif + iiVal) * ipiPct
  const pisVal    = cif * pisPct
  const cofinsVal = cif * cofinsPct
  const baseAnteIcms = cif + iiVal + ipiVal + pisVal + cofinsVal
  const icmsVal   = icmsPct > 0 ? (baseAnteIcms * icmsPct) / (1 - icmsPct) : 0
  const totalImpostos = iiVal + ipiVal + pisVal + cofinsVal + icmsVal
  const afrmm     = parseFloat(f.afrmm)         || freteMar * cambio * 0.08
  const siscomex  = parseFloat(f.siscomex)       || 185
  const despAduan = parseFloat(f.despAduaneiras) || 0
  const armaz     = parseFloat(f.armazenagem)    || 0
  const agenc     = parseFloat(f.agenciamento)   || 0
  const despBanc  = parseFloat(f.despBancarias)  || 0
  const outros    = parseFloat(f.outros)         || 0
  const freteInt  = parseFloat(f.freteInt)       || 0
  const totalDespesas = afrmm + siscomex + despAduan + armaz + agenc + despBanc + outros + freteInt
  const totalBRL = cif + totalImpostos + totalDespesas
  return {
    cambio, qtd, valorMerc, valorMercBRL: valorMerc*cambio, freteMar, freteMarBRL: freteMar*cambio,
    seguro, seguroBRL: seguro*cambio, cif, iiVal, ipiVal, pisVal, cofinsVal, icmsVal,
    totalImpostos, afrmm, siscomex, despAduan, armaz, agenc, despBanc, outros, freteInt,
    totalDespesas, totalBRL, custoUnitBRL: qtd>0?totalBRL/qtd:0, custoUnitUSD: cambio>0?(qtd>0?totalBRL/qtd:0)/cambio:0,
  }
}


export default function TabAnalisador({ user, procs, cambio: cambioGlobal }) {
  const [cambio, setCambio]           = useState(cambioGlobal || { usd:5.72, eur:6.31, cny:0.79, ts:'--:--' })
  const [fornecedores, setFornecedores] = useState([fornecedorVazio(1), fornecedorVazio(2)])
  const [activeTab, setActiveTab]     = useState('manual')
  const [aiStatus, setAiStatus]       = useState(null)
  const [saveStatus, setSaveStatus]   = useState(null)
  const [files, setFiles]             = useState([])
  const [aiRef, setAiRef]             = useState('')
  const [titulo, setTitulo]           = useState('')
  const [drag, setDrag]               = useState(false)
  const [historico, setHistorico]     = useState([])
  const [showHistorico, setShowHistorico] = useState(false)
  const fileRef = useRef()

  useEffect(() => { carregarHistorico() }, [])

  async function carregarHistorico() {
    try { const data = await listarCotacoes(); setHistorico(data) } catch {}
  }

  function setF(id, key, val) {
    setFornecedores(prev => prev.map(f => f.id===id ? {...f,[key]:val} : f))
  }
  function addFornecedor() {
    const newId = Math.max(...fornecedores.map(f=>f.id)) + 1
    setFornecedores(prev => [...prev, fornecedorVazio(newId)])
  }
  function removeFornecedor(id) {
    if (fornecedores.length <= 1) return
    setFornecedores(prev => prev.filter(f => f.id!==id))
  }

  const resultados = fornecedores.map(f => ({ id:f.id, nome:f.nome||`Fornecedor ${f.id}`, resultado:calcularCusto(f, cambio.usd) }))
  const melhorIdx = resultados.reduce((best,cur,i) => cur.resultado.totalBRL>0 && cur.resultado.totalBRL<resultados[best].resultado.totalBRL ? i : best, 0)

  const handleFiles = useCallback((incoming) => {
    const arr = Array.from(incoming)
    setFiles(prev => { const names = prev.map(f=>f.name); return [...prev, ...arr.filter(f=>!names.includes(f.name))] })
  }, [])

  async function runAiExtraction() {
    if (!files.length) return
    setAiStatus({ msg:'Preparando documentos...', type:'loading' })
    try {
      const parts = []
      for (const file of files) {
        const b64 = await fileToBase64(file)
        parts.push({ type:'text', text:`[Documento: ${file.name}]` })
        if (file.type==='application/pdf') {
          parts.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } })
        } else {
          parts.push({ type:'image', source:{ type:'base64', media_type:file.type||'image/jpeg', data:b64 } })
        }
      }
      setAiStatus({ msg:'Analisando cotações com IA...', type:'loading' })
      const result = await analisarCotacaoIA(parts)
      if (Array.isArray(result) && result.length > 0) {
        setFornecedores(result.map((f,i) => ({ ...fornecedorVazio(i+1), ...f, id:i+1 })))
        setAiStatus({ msg:`✓ ${result.length} fornecedor(es) extraído(s). Revise os dados na aba Manual.`, type:'ok' })
        setActiveTab('manual')
      } else { throw new Error('Nenhum fornecedor encontrado nos documentos') }
    } catch(e) { setAiStatus({ msg:'Erro: ' + e.message, type:'err' }) }
  }

  async function salvar() {
    if (!titulo.trim()) { setSaveStatus({ msg:'Informe um título para a cotação', type:'err' }); return }
    setSaveStatus({ msg:'Salvando...', type:'loading' })
    try {
      await salvarCotacao({ titulo, fornecedores }, user.nome)
      setSaveStatus({ msg:'✓ Cotação salva com sucesso!', type:'ok' })
      await carregarHistorico()
      setTimeout(() => setSaveStatus(null), 3000)
    } catch(e) { setSaveStatus({ msg:'Erro: ' + e.message, type:'err' }) }
  }

  async function deletar(id) {
    if (!confirm('Excluir esta cotação?')) return
    try { await deletarCotacao(id); await carregarHistorico() } catch {}
  }

  function carregarCotacao(cot) {
    const fns = (cot.cotacao_fornecedores || []).map((f,i) => ({
      id: i+1, nome:f.nome||'', pais:f.pais||'China', incoterm:f.incoterm||'FOB', moeda:f.moeda||'USD',
      descricao:f.descricao||'', ncm:f.ncm||'', qtdUnid:f.qtd_unid||'', unidade:f.unidade||'PAR',
      precoUnit:f.preco_unit||'', freteMar:f.frete_mar||'', freteInt:f.frete_int||'',
      seguro:f.seguro||'', ii:f.ii||'', ipi:f.ipi||'', pis:f.pis||'', cofins:f.cofins||'',
      icms:f.icms||'', afrmm:f.afrmm||'', siscomex:f.siscomex||'',
      despAduaneiras:f.desp_aduaneiras||'', armazenagem:f.armazenagem||'',
      agenciamento:f.agenciamento||'', despBancarias:f.desp_bancarias||'',
      outros:f.outros||'', cambio:f.cambio||'', obs:f.obs||'',
    }))
    setTitulo(cot.titulo)
    setFornecedores(fns.length ? fns : [fornecedorVazio(1)])
    setShowHistorico(false)
    setActiveTab('manual')
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, padding:'12px 0', borderBottom:`0.5px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:C.gold }}>📊 Analisador de Preço</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Calcule e compare o custo real de importação</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:C.muted }}>USD {cambio.usd?.toFixed(4)}</span>
          <button onClick={() => setShowHistorico(true)} style={BTN_GHOST}>📂 Histórico</button>
          <button onClick={salvar} style={BTN_GOLD}>💾 Salvar cotação</button>
        </div>
      </div>

      {/* Campo título */}
      <div style={{ marginBottom:12, display:'flex', gap:8, alignItems:'center' }}>
        <input style={{ ...INP, flex:1 }} value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Título da cotação (ex: Pneus 175/70R13 — jun/26)" />
        {saveStatus && (
          <span style={{ fontSize:12, color:saveStatus.type==='ok'?C.green:saveStatus.type==='err'?C.red:C.muted }}>
            {saveStatus.msg}
          </span>
        )}
      </div>

      {/* Subtabs */}
      <div style={{ display:'flex', borderBottom:`0.5px solid ${C.border}`, marginBottom:16 }}>
        {[{id:'manual',l:'Preenchimento manual'},{id:'ia',l:'✦ Extrair de cotação (IA)'},{id:'resultado',l:'Comparativo'}].map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'8px 16px', fontSize:12, cursor:'pointer', background:'none', border:'none', borderBottom:activeTab===t.id?`2px solid ${t.id==='ia'?C.purple:C.gold}`:'2px solid transparent', color:activeTab===t.id?(t.id==='ia'?C.purple:C.gold):C.muted, fontWeight:activeTab===t.id?500:400 }}>{t.l}</button>
        ))}
      </div>

      {/* Tab Manual */}
      {activeTab==='manual' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ color:C.muted, fontSize:13 }}>{fornecedores.length} fornecedor(es)</span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={addFornecedor} style={BTN_GHOST}>+ Adicionar fornecedor</button>
              <button onClick={()=>setActiveTab('resultado')} style={BTN_GOLD}>Ver comparativo →</button>
            </div>
          </div>
          {fornecedores.map(f => {
            const res = calcularCusto(f, cambio.usd)
            return (
              <Card key={f.id}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, paddingBottom:10, borderBottom:`0.5px solid ${C.border}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:24, height:24, background:C.goldDim, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:C.navy }}>{f.id}</div>
                    <input style={{ ...INP, width:220, fontWeight:500, color:C.gold }} value={f.nome} onChange={e=>setF(f.id,'nome',e.target.value)} placeholder={`Fornecedor ${f.id}`} />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {res.totalBRL>0 && <span style={{ fontSize:13, color:C.white }}>Total: <strong style={{ color:C.gold }}>{fmtBRL(res.totalBRL)}</strong> <span style={{ color:C.muted, fontSize:11 }}>({fmtBRL(res.custoUnitBRL)}/un)</span></span>}
                    {fornecedores.length>1 && <button onClick={()=>removeFornecedor(f.id)} style={{ ...BTN_GHOST, fontSize:11, padding:'2px 8px', color:C.red, borderColor:C.red }}>✕</button>}
                  </div>
                </div>
                <SecT>Produto</SecT>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9, marginBottom:10 }}>
                  <Fld label="Descrição" full><input style={INP} value={f.descricao} onChange={e=>setF(f.id,'descricao',e.target.value)} placeholder="ex: Pneu 175/70R13" /></Fld>
                  <Fld label="NCM"><input style={INP} value={f.ncm} onChange={e=>setF(f.id,'ncm',e.target.value)} placeholder="4011.10.00" /></Fld>
                  <Fld label="Quantidade"><input type="number" style={INP} value={f.qtdUnid} onChange={e=>setF(f.id,'qtdUnid',e.target.value)} /></Fld>
                  <Fld label="Unidade"><select style={SEL} value={f.unidade} onChange={e=>setF(f.id,'unidade',e.target.value)}>{['PAR','UN','PÇ','KG','CAIXA'].map(u=><option key={u}>{u}</option>)}</select></Fld>
                  <Fld label="Preço unit. (USD)"><input type="number" style={INP} value={f.precoUnit} onChange={e=>setF(f.id,'precoUnit',e.target.value)} /></Fld>
                  <Fld label="Incoterm"><select style={SEL} value={f.incoterm} onChange={e=>setF(f.id,'incoterm',e.target.value)}>{['FOB','CIF','CFR','EXW','DDP'].map(i=><option key={i}>{i}</option>)}</select></Fld>
                </div>
                <SecT>Frete, seguro e câmbio</SecT>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:9, marginBottom:10 }}>
                  <Fld label="Frete marítimo (USD)"><input type="number" style={INP} value={f.freteMar} onChange={e=>setF(f.id,'freteMar',e.target.value)} /></Fld>
                  <Fld label="Frete interno (BRL)"><input type="number" style={INP} value={f.freteInt} onChange={e=>setF(f.id,'freteInt',e.target.value)} /></Fld>
                  <Fld label="Seguro (USD)"><input type="number" style={INP} value={f.seguro} onChange={e=>setF(f.id,'seguro',e.target.value)} /></Fld>
                  <Fld label={`Câmbio USD (atual: ${cambio.usd?.toFixed(4)})`}><input type="number" style={INP} value={f.cambio} onChange={e=>setF(f.id,'cambio',e.target.value)} placeholder={cambio.usd?.toFixed(4)} /></Fld>
                </div>
                <SecT>Impostos (%)</SecT>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:9, marginBottom:10 }}>
                  {[['ii','II'],['ipi','IPI'],['pis','PIS'],['cofins','COFINS'],['icms','ICMS']].map(([k,l]) => (
                    <Fld key={k} label={l+' (%)'}><input type="number" style={INP} value={f[k]} onChange={e=>setF(f.id,k,e.target.value)} placeholder="0" /></Fld>
                  ))}
                </div>
                <SecT>Despesas nacionais (BRL)</SecT>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:9, marginBottom:10 }}>
                  {[['afrmm','AFRMM'],['siscomex','Siscomex'],['despAduaneiras','Desp. aduaneiras'],['armazenagem','Armazenagem'],['agenciamento','Agenciamento'],['despBancarias','Desp. bancárias'],['outros','Outros']].map(([k,l]) => (
                    <Fld key={k} label={l}><input type="number" style={INP} value={f[k]} onChange={e=>setF(f.id,k,e.target.value)} placeholder="0" /></Fld>
                  ))}
                </div>
                {res.totalBRL>0 && (
                  <div style={{ marginTop:12, background:C.navy, borderRadius:8, padding:'10px 12px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8 }}>
                    {[['Mercadoria',fmtBRL(res.valorMercBRL)],['CIF total',fmtBRL(res.cif)],['Total impostos',fmtBRL(res.totalImpostos)],['Despesas nac.',fmtBRL(res.totalDespesas)],['Custo total',fmtBRL(res.totalBRL),C.gold],['Custo/unidade',fmtBRL(res.custoUnitBRL),C.green]].map(([l,v,c]) => (
                      <div key={l}><div style={{ fontSize:10, color:C.muted }}>{l}</div><div style={{ fontSize:13, fontWeight:500, color:c||C.white }}>{v}</div></div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Tab IA */}
      {activeTab==='ia' && (
        <div>
          <Card>
            <StepH num={1} title="Referência (opcional)" sub="Para identificar a análise" />
            <input style={{ ...INP, maxWidth:320 }} value={aiRef} onChange={e=>setAiRef(e.target.value)} placeholder="ex: Análise pneus 175/70R13 — jun/26" />
          </Card>
          <Card>
            <StepH num={2} title="Cotações / Proformas" sub="PDF ou imagem dos fornecedores" />
            <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFiles(e.dataTransfer.files)}} onClick={()=>fileRef.current?.click()} style={{ border:`1.5px dashed ${drag?C.goldDim:C.border}`, borderRadius:9, padding:24, textAlign:'center', cursor:'pointer', background:drag?'rgba(200,168,75,0.04)':'transparent' }}>
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
              <div style={{ fontSize:24, color:C.goldDim, marginBottom:6 }}>☁</div>
              <div style={{ fontSize:13, color:C.muted }}><strong style={{ color:C.gold }}>Clique</strong> ou arraste aqui</div>
            </div>
            {files.length>0 && <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:10 }}>{files.map(f=><div key={f.name} style={{ display:'flex', alignItems:'center', gap:5, background:C.navy, border:`0.5px solid ${C.border}`, borderRadius:20, padding:'2px 9px', fontSize:11 }}>📄 {f.name}<span onClick={()=>setFiles(prev=>prev.filter(x=>x.name!==f.name))} style={{ color:C.muted, cursor:'pointer', marginLeft:2 }}>×</span></div>)}</div>}
          </Card>
          <Card>
            <StepH num={3} title="Extração com IA" sub="Claude lê as cotações e preenche todos os campos" />
            <button onClick={runAiExtraction} disabled={!files.length||aiStatus?.type==='loading'} style={{ ...BTN_GOLD, width:'100%', padding:11, fontSize:14, opacity:!files.length?0.5:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {aiStatus?.type==='loading'?<Spin />:'✦'} Extrair dados das cotações
            </button>
            {aiStatus && <div style={{ marginTop:10, background:C.navy, border:`0.5px solid ${aiStatus.type==='ok'?'#1a5c3a':aiStatus.type==='err'?'#5c1a1a':C.border}`, borderRadius:7, padding:'9px 12px', fontSize:12, color:aiStatus.type==='ok'?C.green:aiStatus.type==='err'?C.red:C.muted, display:'flex', alignItems:'center', gap:7 }}>{aiStatus.type==='loading'&&<Spin />} {aiStatus.msg}</div>}
          </Card>
        </div>
      )}

      {/* Tab Comparativo */}
      {activeTab==='resultado' && (
        <div>
          {resultados.filter(r=>r.resultado.totalBRL>0).length===0 ? (
            <EmptyState icon="📊" title="Nenhum dado para comparar" sub="Preencha os dados de pelo menos um fornecedor" action="Preencher dados" onAction={()=>setActiveTab('manual')} />
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:10, marginBottom:20 }}>
                {resultados.map((r,idx) => {
                  const isBest = idx===melhorIdx && r.resultado.totalBRL>0
                  return (
                    <div key={r.id} style={{ background:isBest?'rgba(31,190,122,0.08)':C.navyMid, border:`0.5px solid ${isBest?C.green:C.border}`, borderRadius:12, padding:16, position:'relative' }}>
                      {isBest && <div style={{ position:'absolute', top:10, right:10, background:C.green, color:C.navy, fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>MELHOR PREÇO</div>}
                      <div style={{ fontSize:14, fontWeight:600, color:C.gold, marginBottom:8 }}>{r.nome}</div>
                      <div style={{ fontSize:22, fontWeight:700, color:isBest?C.green:C.white }}>{fmtBRL(r.resultado.totalBRL)}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{fmtBRL(r.resultado.custoUnitBRL)}/un · {fmtUSD(r.resultado.custoUnitUSD)}/un</div>
                    </div>
                  )
                })}
              </div>
              <Card>
                <div style={{ fontSize:13, fontWeight:500, color:C.gold, marginBottom:12 }}>Comparativo detalhado</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr>
                      <th style={{ textAlign:'left', padding:'6px 8px', fontSize:10, color:C.muted, borderBottom:`0.5px solid ${C.border}`, textTransform:'uppercase' }}>Item</th>
                      {resultados.map(r=><th key={r.id} style={{ textAlign:'right', padding:'6px 8px', fontSize:10, color:r.id===resultados[melhorIdx].id&&r.resultado.totalBRL>0?C.green:C.muted, borderBottom:`0.5px solid ${C.border}`, textTransform:'uppercase' }}>{r.nome}</th>)}
                    </tr></thead>
                    <tbody>
                      {[['Valor mercadoria',r=>fmtBRL(r.valorMercBRL)],['Frete marítimo',r=>fmtBRL(r.freteMarBRL)],['Seguro',r=>fmtBRL(r.seguroBRL)],['— CIF total',r=>fmtBRL(r.cif),true],['II',r=>fmtBRL(r.iiVal)],['IPI',r=>fmtBRL(r.ipiVal)],['PIS',r=>fmtBRL(r.pisVal)],['COFINS',r=>fmtBRL(r.cofinsVal)],['ICMS',r=>fmtBRL(r.icmsVal)],['— Total impostos',r=>fmtBRL(r.totalImpostos),true],['AFRMM',r=>fmtBRL(r.afrmm)],['Siscomex',r=>fmtBRL(r.siscomex)],['Desp. aduaneiras',r=>fmtBRL(r.despAduan)],['Armazenagem',r=>fmtBRL(r.armaz)],['Agenciamento',r=>fmtBRL(r.agenc)],['Desp. bancárias',r=>fmtBRL(r.despBanc)],['Frete interno',r=>fmtBRL(r.freteInt)],['Outros',r=>fmtBRL(r.outros)],['— Total despesas',r=>fmtBRL(r.totalDespesas),true]].map(([label,fn,bold])=>(
                        <tr key={label}>
                          <td style={{ padding:'5px 8px', borderBottom:`0.5px solid ${C.border}`, color:bold?C.white:C.muted, fontWeight:bold?500:400 }}>{label}</td>
                          {resultados.map(r=><td key={r.id} style={{ padding:'5px 8px', borderBottom:`0.5px solid ${C.border}`, textAlign:'right', fontWeight:bold?500:400 }}>{fn(r.resultado)}</td>)}
                        </tr>
                      ))}
                      <tr style={{ background:'rgba(200,168,75,0.06)' }}>
                        <td style={{ padding:'8px 8px', borderTop:`0.5px solid ${C.goldDim}`, color:C.gold, fontWeight:700, fontSize:13 }}>CUSTO TOTAL</td>
                        {resultados.map((r,idx)=><td key={r.id} style={{ padding:'8px 8px', borderTop:`0.5px solid ${C.goldDim}`, textAlign:'right', fontWeight:700, fontSize:13, color:idx===melhorIdx&&r.resultado.totalBRL>0?C.green:C.gold }}>{fmtBRL(r.resultado.totalBRL)}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Modal Histórico */}
      {showHistorico && (
        <Modal title="📂 Cotações salvas" onClose={()=>setShowHistorico(false)} width={600}>
          {historico.length===0 ? (
            <EmptyState icon="📭" title="Nenhuma cotação salva" />
          ) : (
            historico.map(cot => (
              <div key={cot.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:`0.5px solid ${C.border}` }}>
                <div>
                  <div style={{ fontWeight:500, color:C.white }}>{cot.titulo}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                    {new Date(cot.created_at).toLocaleDateString('pt-BR')} · {cot.criado_por} · {(cot.cotacao_fornecedores||[]).length} fornecedor(es)
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>carregarCotacao(cot)} style={{ ...BTN_GHOST, fontSize:11, padding:'4px 10px' }}>Carregar</button>
                  <button onClick={()=>deletar(cot.id)} style={{ ...BTN_RED, fontSize:11, padding:'4px 10px' }}>Excluir</button>
                </div>
              </div>
            ))
          )}
        </Modal>
      )}
    </div>
  )
}
