export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return response.status(503).json({ error: 'Gemini is not configured on the server' })

  const { question, context, instructions } = request.body || {}
  if (!String(question || '').trim()) return response.status(400).json({ error: 'Question is required' })
  const prompt = instructions || `You are Atlantic Coast Tours' customer assistant. Answer using only this live context: ${context}\nCustomer question: ${question}`

  try {
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    if (!result.ok) return response.status(502).json({ error: 'Gemini request failed' })
    const payload = await result.json()
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return response.status(502).json({ error: 'Gemini returned no answer' })
    return response.status(200).json({ text })
  } catch {
    return response.status(502).json({ error: 'Unable to reach Gemini' })
  }
}
