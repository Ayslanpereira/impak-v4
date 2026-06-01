// src/components/ui.jsx — IMPAK v4.0
// Componentes visuais reutilizados em todas as abas

export const C = {
  navy:'#0d1f3c', navyMid:'#162847', border:'#2a4570',
  gold:'#c8a84b', goldLight:'#e2c97e', goldDim:'#9a7a2e',
  white:'#f0f4fa', muted:'#7a95b8',
  green:'#1fbe7a', red:'#e05252', amber:'#e6a030', purple:'#b09aee', blue:'#6eb3f7',
}

export const INP   = { background:C.navy, border:`0.5px solid ${C.border}`, color:C.white, borderRadius:7, padding:'7px 10px', fontSize:13, width:'100%', outline:'none' }
export const INP_F = { ...INP, background:'rgba(200,168,75,0.07)', border:`0.5px solid ${C.goldDim}` }
export const SEL   = { ...INP, cursor:'pointer' }
export const BTN_GOLD  = { background:C.gold, color:C.navy, border:'none', borderRadius:7, padding:'7px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }
export const BTN_GHOST = { background:'none', border:`0.5px solid ${C.border}`, color:C.muted, borderRadius:7, padding:'7px 14px', fontSize:13, cursor:'pointer' }
export const BTN_RED   = { background:'rgba(224,82,82,0.15)', border:`0.5px solid ${C.red}`, color:C.red, borderRadius:7, padding:'7px 14px', fontSize:13, cursor:'pointer' }

export function Fld({ label, children, full }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, gridColumn:full?'1/-1':undefined }}>
      <label style={{ fontSize:11, color:C.muted }}>{label}</label>
      {children}
    </div>
  )
}

export function SecT({ children }) {
  return <div style={{ fontSize:10, fontWeight:500, color:C.goldDim, textTransform:'uppercase', letterSpacing:'0.6px', margin:'14px 0 8px', paddingBottom:4, borderBottom:`0.5px solid ${C.border}` }}>{children}</div>
}

export function Spin() {
  return (
    <>
      <style>{'@keyframes _sp{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width:14, height:14, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:'50%', animation:'_sp 0.7s linear infinite', flexShrink:0 }} />
    </>
  )
}

export function Bdg({ text, type }) {
  const m = {
    pago:['#0a2318',C.green], pendente:['#2a1e08',C.amber], atrasado:['#2a1010',C.red],
    prod:['#0e2a4a','#6eb3f7'], transit:['#2a1e08',C.amber], arrived:['#0c2318',C.green],
    cleared:['#0a2318',C.green], deferida:['#0a2318',C.green],
    ok:['#0a2318',C.green], warn:['#2a1e08',C.amber], err:['#2a1010',C.red],
    default:[C.navyMid,C.muted],
  }
  const [bg,col] = m[type||text?.toLowerCase().replace(/\s/g,'')]||m.default
  return <span style={{ background:bg, color:col, fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:10 }}>{text}</span>
}

export function StepH({ num, title, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <div style={{ width:26, height:26, background:C.gold, color:C.navy, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{num}</div>
      <div>
        <div style={{ fontSize:14, fontWeight:500, color:C.gold }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function Card({ children, style }) {
  return <div style={{ background:C.navyMid, border:`0.5px solid ${C.border}`, borderRadius:12, padding:18, marginBottom:12, ...style }}>{children}</div>
}

export function Modal({ title, onClose, children, width = 680 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:C.navyMid, border:`0.5px solid ${C.border}`, borderRadius:14, width:'100%', maxWidth:width, maxHeight:'90vh', overflow:'auto', padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, paddingBottom:12, borderBottom:`0.5px solid ${C.border}` }}>
          <span style={{ fontSize:15, fontWeight:600, color:C.gold }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon = '📭', title, sub, action, onAction }) {
  return (
    <div style={{ padding:'48px 0', textAlign:'center', color:C.muted }}>
      <div style={{ fontSize:32, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:500, color:C.white, marginBottom:6 }}>{title}</div>
      {sub && <div style={{ fontSize:12, marginBottom:16 }}>{sub}</div>}
      {action && <button onClick={onAction} style={BTN_GOLD}>{action}</button>}
    </div>
  )
}
