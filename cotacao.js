// api/extract.js
// Vercel Serverless Function — proxy para a API da Anthropic
// A chave fica aqui no servidor, nunca chega ao navegador
//
// Para configurar no Vercel:
//   Dashboard > Settings > Environment Variables
//   ANTHROPIC_API_KEY = sua chave sk-ant-...

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' })
  }

  try {
    const { partes, referencia } = req.body

    // Monta o prompt de extração
    const mensagens = [
      ...partes,
      {
        type: 'text',
        text: `Você é especialista em importação e comércio exterior brasileiro.
Analise os documentos (PI, Packing List, BL, CE, etc.) e retorne APENAS um JSON válido — sem markdown, sem blocos de código, sem texto extra.
Referência do processo: ${referencia}

{"proc":"${referencia}","cliente":"","fornecedor":"","agente":"","navio":"","porto":"","eta":"","container":"","freeTime":14,"quant":1,"bl":"","ce":"","di":"","piNum":"","status":"Em produção","anuen":"Pendente","pendencia":"","obs":"","totalUSD":0,"entradaUSD":0,"entradaVenc":"","saldoUSD":0,"saldoVenc":"","saldoCondicao":"","items":[{"descricao":"","qtd":0,"unidade":"","pesoBruto":0,"pesoLiquido":0,"ncm":""}],"confianca":"alta"}

Regras:
- Campos não encontrados = string vazia ou 0
- Porto: NVT=Navegantes, IOA/ITP=Itapoá, ITJ=Itajaí
- saldoCondicao: copie exatamente como está no documento
- Se houver % de entrada explícito: calcule entradaUSD e saldoUSD
- Se não houver divisão: entradaUSD = totalUSD/2, saldoUSD = totalUSD/2
- eta: formato YYYY-MM-DD
- confianca: "alta" se PI com valores, "média" se só packing list, "baixa" se incompleto`
      }
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: mensagens }],
      }),
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)

    const raw   = data.content.map(b => b.text || '').join('').trim()
    const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Resposta inesperada da IA')

    const extracted = JSON.parse(match[0])
    return res.status(200).json(extracted)

  } catch (err) {
    console.error('Erro no proxy Anthropic:', err)
    return res.status(500).json({ error: err.message })
  }
}
