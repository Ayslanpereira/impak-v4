// api/cotacao.js — Vercel Serverless Function
// Proxy para extração de dados de cotações/proformas via Claude

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' })

  try {
    const { partes } = req.body
    const prompt = {
      type: 'text',
      text: `Você é especialista em importação e comércio exterior brasileiro.
Analise as cotações/proformas enviadas e extraia os dados de cada fornecedor.
Retorne APENAS um array JSON válido, sem markdown, sem texto extra:
[
  {
    "nome": "Nome do fornecedor",
    "pais": "China",
    "incoterm": "FOB",
    "moeda": "USD",
    "descricao": "Descrição do produto",
    "ncm": "",
    "qtdUnid": 0,
    "unidade": "PAR",
    "precoUnit": 0,
    "freteMar": 0,
    "freteInt": 0,
    "seguro": 0,
    "ii": 16,
    "ipi": 0,
    "pis": 2.1,
    "cofins": 9.65,
    "icms": 12,
    "afrmm": 0,
    "siscomex": 185,
    "despAduaneiras": 0,
    "armazenagem": 0,
    "agenciamento": 0,
    "despBancarias": 0,
    "outros": 0,
    "cambio": 0,
    "obs": ""
  }
]

Regras:
- Um objeto por fornecedor encontrado
- Valores monetários em USD (exceto campos explicitamente BRL)
- Se não encontrar um valor: use 0 ou string vazia
- Alíquotas típicas de pneus BR se não informadas: II=16%, IPI=0%, PIS=2.1%, COFINS=9.65%, ICMS=12%
- qtdUnid: quantidade total de pares/unidades
- precoUnit: preço por unidade/par em USD`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role:'user', content:[...partes, prompt] }],
      }),
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)

    const raw = data.content.map(b=>b.text||'').join('').trim()
    const clean = raw.replace(/```json|```/g,'').trim()
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Resposta inesperada da IA')

    return res.status(200).json(JSON.parse(match[0]))
  } catch(err) {
    console.error('Erro cotacao proxy:', err)
    return res.status(500).json({ error: err.message })
  }
}
