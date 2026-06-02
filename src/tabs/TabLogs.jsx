// src/tabs/TabLogs.jsx — IMPAK v4.0
import { useState } from 'react'
import { C, INP } from '../components/ui.jsx'

export default function TabLogs({ logs }) {
  const [q, setQ] = useState('')
  const f = logs.filter(l => !q || JSON.stringify(l).toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <input style={{ ...INP, maxWidth:380, marginBottom:12 }} placeholder="Filtrar logs..." value={q} onChange={e => setQ(e.target.value)} />
      {f.map((l,i) => (
        <div key={i} style={{ fontSize:11, color:C.muted, padding:'5px 0', borderBottom:`0.5px solid ${C.border}` }}>
          <span>{l.ts}</span> — <span style={{ color:C.goldDim }}>{l.user}</span> · <span style={{ color:C.gold }}>{l.proc}</span> · {l.campo}: "{l.de}" → <strong style={{ color:C.white }}>{l.para}</strong>
        </div>
      ))}
      {f.length === 0 && <p style={{ color:C.muted, fontSize:13, padding:'20px 0' }}>Nenhum log encontrado.</p>}
    </div>
  )
}
