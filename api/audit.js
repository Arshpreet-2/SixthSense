// /api/audit — reads a street photo and her own words, returns structured fields.
// The key lives in Vercel (GEMINI_API_KEY), never in the app.
// Without a key, the app falls back to on-phone keyword rules and says so.

const MODEL = 'gemini-2.5-flash';

const RULES = `You read a short remark written by a woman about a street she just walked,
and sometimes a photo of that street, for a women's safety travel app in India.

Return ONLY a JSON object, no prose, no markdown:

{
  "light":      "dark" | "some" | "lit" | null,
  "people":     "empty" | "few" | "some" | "busy" | null,
  "shops":      "shut" | "some" | "open" | null,
  "path":       "broken" | "uneven" | "even" | null,
  "dogs":       true | false | null,
  "unusual":    null | { "what": "<a few words>", "severity": "low"|"medium"|"high" },
  "summary":    "<one plain sentence, max 18 words, describing conditions>",
  "tags":       ["<up to 4 short tags>"],
  "targets_person": true | false,
  "confidence": 0.0-1.0
}

Rules you must follow:
- Describe CONDITIONS only. Never say a place is safe or unsafe, never rate it.
- Never name or describe an individual. If the remark accuses or identifies a person,
  set "targets_person": true and keep "summary" about the place only.
- "unusual" is for something out of the ordinary that other women should know tonight:
  a street with every light out, a blocked or dug-up road, a crowd or fight, a stalled
  vehicle blocking a footpath, an unlit underpass, a shut metro gate. Everyday darkness
  or quiet is NOT unusual.
- If the photo and the remark disagree, trust the remark and lower "confidence".
- If you cannot tell a field, use null. Do not guess.
- The remark may be in Hindi, Hinglish or English.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no-key' });   // the app then uses its own rules

  const { remark = '', image = null, mime = 'image/jpeg', place = '', hour = null } = req.body || {};
  if (!remark && !image) return res.status(400).json({ error: 'Nothing to read.' });
  if (remark.length > 1200) return res.status(400).json({ error: 'Remark too long.' });
  if (image && image.length > 7_000_000) return res.status(413).json({ error: 'Photo too large.' });

  const parts = [{ text: `${RULES}\n\nPLACE: ${place || 'unknown'}\nHOUR: ${hour ?? 'unknown'}\nHER REMARK: ${remark || '(none)'}` }];
  if (image) parts.push({ inline_data: { mime_type: mime, data: image } });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 400, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'The reader is busy; try again.' });
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let out;
    try { out = JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch (e) { return res.status(502).json({ error: 'Could not read the reply.' }); }
    out.source = 'gemini';
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: 'The reader could not be reached.' });
  }
}
