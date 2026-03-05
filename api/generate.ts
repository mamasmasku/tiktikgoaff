import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// Inisialisasi Upstash Redis — aman walau env variable belum diset
// Jika belum setup Upstash, redis = null dan app tetap jalan normal tanpa cache
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const CACHE_TTL_SECONDS = 60 * 60 * 48; // 48 jam

// Ekstrak nama brand dari userPrompt
const extractBrandName = (userPrompt: string): string => {
  const match = userPrompt.match(/Nama & Deskripsi(?:\s*Singkat|Produk)?:\s*([^\n]+)/i);
  if (!match) return '';
  // Ambil teks sebelum tanda "-" atau koma sebagai brand key
  const brandRaw = match[1].split(/[-,]/)[0].trim().toLowerCase();
  return brandRaw;
};

export default async function handler(req: any, res: any) {
  // Hanya terima POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userPrompt, systemInstruction, temperature = 0.8, useSearch = false } = req.body;

  if (!userPrompt || !systemInstruction) {
    return res.status(400).json({ error: 'userPrompt dan systemInstruction wajib diisi' });
  }

  // ── Mode dengan Google Search (Bebas & Rapi) → cache by brand ──
  if (useSearch) {
    const brandName = extractBrandName(userPrompt);

    if (brandName) {
      const brandCacheKey = `brand__${crypto
        .createHash('md5')
        .update(brandName)
        .digest('hex')}`;

      // Cek cache di Upstash (hanya jika Redis sudah disetup)
      if (redis) {
        try {
          const cached = await redis.get<string>(brandCacheKey);
          if (cached) {
            console.log('Cache HIT (Upstash):', brandName);
            return res.status(200).json({ text: cached, fromCache: true });
          }
        } catch (cacheError) {
          // Redis error → tetap lanjut panggil Gemini, jangan sampai app mati
          console.warn('Redis get error:', cacheError);
        }
      }

      // Cache miss atau Redis belum disetup → panggil Gemini
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // @ts-ignore
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature,
            tools: [{ googleSearch: {} }],
          },
        });

        const text = response.text || '';

        // Simpan ke Upstash (hanya jika Redis sudah disetup)
        if (redis) {
          try {
            await redis.set(brandCacheKey, text, { ex: CACHE_TTL_SECONDS });
            console.log('Cache SAVED (Upstash):', brandName);
          } catch (cacheError) {
            console.warn('Redis set error:', cacheError);
          }
        }

        return res.status(200).json({ text });
      } catch (error: any) {
        console.error('Gemini error:', error);
        return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server' });
      }
    }
  }

  // ── Mode tanpa Search (Urai & Skrip Jualan) → selalu fresh, tidak di-cache ──
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // @ts-ignore
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature,
      },
    });

    return res.status(200).json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Gemini error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server' });
  }
}
