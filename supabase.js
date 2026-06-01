// src/tabs/TabCaixa.jsx — IMPAK v4.0
import { useState } from 'react'
import { C, INP, SEL, BTN_GHOST, Card, SecT } from '../components/ui.jsx'

export default function TabCaixa({ procs, cambio, perm }) {
  if (perm === 'sem_caixa') return (
    <div style={{ padding:50, textAlign:'center', color:C.muted }}>
      <div style={{ fontSize:36 }}>🔒</div>
      <p style={{ marginTop:10 }}>Sem permissão para visualizar o fluxo de caixa.</p>
    </div>
  )
  let tot=0, pago=0, pend=0, atra=0
  const rows = []
  procs.forEach(p => {
    [{usd:p.entradaUSD,venc:p.entradaVenc,st:p.entradaStatus,auto:p.entradaAuto,tag:'Entrada',tc:C.blue,tb:'#0e2a4a'},
     {usd:p.saldoUSD,  venc:p.saldoVenc,  st:p.saldoStatus,  auto:p.saldoAuto,  tag:'Saldo',  tc:C.purple,tb:'#1a0e3a'}].forEach(pc => {
      if (!pc.usd) return
      const brl = Math.round(pc.usd * cambio.usd)
      tot += pc.usd
      if (pc.st==='pago') pago += pc.usd
      else if (pc.st==='atrasado') atra += pc.usd
      else pend += pc.usd
      rows.push({ ...pc, proc:p.proc, forn:p.fornecedor, brl })
    })
  })
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:8, marginBottom:16 }}>
        {[['USD '+tot.toLocaleString(),'Total geral',C.white],['R$ '+Math.round(tot*cambio.usd).toLocaleString(),'Total BRL',C.white],['USD '+pago.toLocaleString(),'Pagos',C.green],['USD '+pend.toLocaleString(),'Pendentes',C.amber],['USD '+atra.toLocaleString(),'Em atraso',C.red]].map(([v,l,c],i) => (
          <div key={i} style={{ background:C.navyMid, border:`0.5px solid ${C.border}`, borderRadius:10, padding:12 }}>
            <div style={{ fontSize:16, fontWeight:500, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2, textTransform:'uppercase' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr>{['Processo','Fornecedor','Parcela','Valor USD','Valor BRL','Câmbio','Vencimento','Origem','Status'].map(h => (
            <th key={h} style={{ textAlign:'left', padding:'5px 7px', fontSize:10, color:C.muted, borderBottom:`0.5px solid ${C.border}`, textTransform:'uppercase' }}>{h}</th>
          ))}</tr></thead>
          <tbody>{rows.map((r,i) => {
            const stc = r.st==='pago'?C.green:r.st==='atrasado'?C.red:C.amber
            return (
              <tr key={i} onMouseEnter={e => e.currentTarget.style.background=C.navyMid} onMouseLeave={e => e.currentTarget.style.background=''}>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, color:C.gold, fontWeight:500 }}>{r.proc}</td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, color:C.muted, fontSize:11 }}>{r.forn}</td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}><span style={{ background:r.tb, color:r.tc, fontSize:10, padding:'1px 5px', borderRadius:5 }}>{r.tag}</span></td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>USD {r.usd.toLocaleString()}</td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>R$ {r.brl.toLocaleString()}</td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{cambio.usd.toFixed(2)}</td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{r.venc||'—'}{r.auto && <span style={{ color:C.blue, fontSize:10 }}> ⚡</span>}</td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, fontSize:10, color:C.muted }}>{r.auto?(r.tag==='Entrada'?'D+2':'ETA−10d'):'Manual'}</td>
                <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}><span style={{ color:stc, fontSize:11 }}>{r.st==='pago'?'Pago':r.st==='atrasado'?'Atrasado':'Pendente'}</span></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Importar documento (IA) ──────────────────────────────
