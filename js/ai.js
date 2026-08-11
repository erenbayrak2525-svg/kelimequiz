// Google AI Studio (Gemini) ile çeviri ve örnek cümle üretimi.
// API anahtarı tarayıcıda localStorage içinde tutulur, hiçbir zaman
// koda veya repoya gömülmez.

const MODEL = "gemini-2.5-flash";
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

export function getGeminiKey() {
  return localStorage.getItem("gemini_api_key") || "";
}

export function setGeminiKey(key) {
  localStorage.setItem("gemini_api_key", key.trim());
}

export function hasGeminiKey() {
  return !!getGeminiKey();
}

async function callGemini(prompt) {
  const key = getGeminiKey();
  if (!key) {
    throw new Error("Gemini API anahtarı ayarlanmamış. Önce Ayarlar sayfasından ekle.");
  }
  const res = await fetch(ENDPOINT(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 200 }
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini isteği başarısız oldu (${res.status}). ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return text.trim();
}

export async function aiTranslate(word, languageName) {
  const prompt = `Sen bir sözlük asistanısın. "${languageName}" dilindeki "${word}" kelimesinin/ifadesinin Türkçe karşılığını ver.
Sadece kısa ve net Türkçe anlamı yaz, başka hiçbir açıklama, tırnak işareti veya ek cümle ekleme.`;
  return callGemini(prompt);
}

export async function aiExample(word, meaning, languageName) {
  const prompt = `Sen bir dil öğrenme asistanısın. "${languageName}" dilinde, "${word}" kelimesini/ifadesini doğal bir şekilde kullanan TEK bir örnek cümle yaz.
Cümleden hemen sonra parantez içinde Türkçe çevirisini ver. Başka açıklama ekleme.
Format tam olarak şöyle olsun: <örnek cümle> (<Türkçe çeviri>)`;
  return callGemini(prompt);
}
