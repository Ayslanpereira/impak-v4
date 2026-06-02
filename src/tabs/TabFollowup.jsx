// src/tabs/TabFollowup.jsx — IMPAK v4.0
import { C, Bdg, Card } from '../components/ui.jsx'

const TODAY = new Date().toISOString().slice(0,10)

export default function TabFollowup({ procs }) {
  const [q, setQ] = useState('')
  const f = procs.filter(p => !q || JSON.stringify(p).toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <input style={{ ...INP, maxWidth:380, marginBottom:12 }} placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr>{['Referência','Fornecedor','HBL / MBL','Chegada terminal','Container','Status atual'].map(h => (
            <th key={h} style={{ textAlign:'left', padding:'5px 7px', fontSize:10, color:C.muted, borderBottom:`0.5px solid ${C.border}`, textTransform:'uppercase' }}>{h}</th>
          ))}</tr></thead>
          <tbody>{f.map(p => (
            <tr key={p.proc} onMouseEnter={e => e.currentTarget.style.background=C.navyMid} onMouseLeave={e => e.currentTarget.style.background=''}>
              <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, color:C.gold, fontWeight:500 }}>{p.proc}</td>
              <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{p.fornecedor}</td>
              <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, color:C.muted }}>{p.bl||'—'}</td>
              <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}` }}>{p.eta||'—'}</td>
              <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, color:C.muted, fontSize:11 }}>{p.container||'—'}</td>
              <td style={{ padding:'5px 7px', borderBottom:`0.5px solid ${C.border}`, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.pendencia||'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Fluxo de caixa ───────────────────────────────────────
