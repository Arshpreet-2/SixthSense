// /api/ask — runs on Vercel, not in the browser, so the key stays private.
// Set GEMINI_API_KEY in Vercel → Settings → Environment Variables, then redeploy.
// Free tier is enough for a demo; without the key the app falls back to its
// on-phone answers and says so.

const MODEL = 'gemini-2.0-flash';

const RULES = `You are the assistant inside SixthSense, a women's safety travel app used in India.

Answer only from the DATA given below and from these rules. If the data does not
contain the answer, say plainly that you do not know and suggest where in the app
to look. Never invent street names, timings, fares or conditions.

How the app works, so you can explain it:
- It compares the routes available for one trip. It never labels a street safe or unsafe, and never gives a safety score.
- Each 50 m of a walking route is scored on six senses: SEE (light, openness, visibility), HEAR (sound, activity, shops), RUN (footpath steadiness, exits), CALL (signal, help points), TRIBE (people around), GUT (dog packs).
- Missing data is left out and lowers "How sure", which is shown as high, medium or low.
- Readings expire after two hours.
- A warning from a member counts at reduced weight until confirmed. A claim that a place is BETTER counts only when a verified woman or the phone's own sensors agree. This is deliberate: it stops anyone luring women onto a bad route.
- The agent watches battery, network, signal, GPS, movement and sound during a trip, and either suggests or acts. Graded help: uncomfortable is not the same as emergency.
- Everything needed during a trip works offline. Nothing raw leaves the phone: sound becomes one number, a camera frame becomes one brightness value.

Style: plain English, short. Use Rs. for money. Do not tell her a route is safe.
If she describes being in danger right now, tell her to hold the Emergency bar on
Home, and that 112 and 1091 are one tap away.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'No GEMINI_API_KEY set on the server.' });

  const { question, context } = req.body || {};
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'No question.' });
  if (question.length > 500) return res.status(400).json({ error: 'Question too long.' });

  const prompt = `${RULES}\n\nDATA (facts from her app right now, no personal details):\n${JSON.stringify(context || {}, null, 1)}\n\nHER QUESTION: ${question}`;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'The assistant is busy; try again.' });
    const j = await r.json();
    const answer = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) return res.status(502).json({ error: 'No answer came back.' });
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(502).json({ error: 'The assistant could not be reached.' });
  }
}
