/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Input from './components/Input';
import Select from './components/Select';
import StyleButton from './components/StyleButton';
import Textarea from './components/Textarea';
import SkripJualanForm from './modes/skrip-jualan/components/SkripJualanForm';
import SkripJualanOutput from './modes/skrip-jualan/components/SkripJualanOutput';
import { buildSkripJualanSystemPrompt, buildSkripJualanUserPrompt } from './modes/skrip-jualan/buildSkripJualanPrompt';
import type { SkripJualanConfig } from './modes/skrip-jualan/types';

const contentStyles = [
  { id: 'ugc', number: 1, title: 'UGC (User Generated Content)', description: 'Terasa dibuat oleh pengguna biasa, otentik dan jujur.' },
  { id: 'storytelling', number: 2, title: 'Storytelling', description: 'Memiliki alur cerita yang jelas untuk membangun emosi.' },
  { id: 'soft-selling', number: 3, title: 'Soft Selling', description: 'Edukasi halus & informatif, fokus pada manfaat.' },
  { id: 'problem-solution', number: 4, title: 'Problem–Solution', description: 'Mulai dari masalah yang relevan dengan audiens.' },
  { id: 'cinematic', number: 5, title: 'Cinematic', description: 'Visual dominan, minim dialog, membangun kesan premium.' },
  { id: 'listicle', number: 6, title: 'Listicle', description: 'Informasi terstruktur & jelas, mudah dipahami.' },
];

const characterAppearanceOptions = [
  { id: 'adegan-1-2', label: 'Adegan 1 & 2', description: 'Karakter on-screen di 2 adegan pertama tiap segmen' },
  { id: 'adegan-1-saja', label: 'Adegan 1 saja', description: 'Karakter on-screen hanya di adegan pembuka tiap segmen' },
  { id: 'adegan-1-dan-penutup', label: 'Adegan 1 & penutup segmen terakhir', description: 'On-screen di adegan 1 tiap segmen + adegan terakhir segmen terakhir' },
  { id: 'adegan-1-2-dan-penutup', label: 'Adegan 1, 2 & penutup segmen terakhir', description: 'On-screen di adegan 1 & 2 tiap segmen + adegan terakhir segmen terakhir' },
];

const dialogStrategyOptions = [
  { id: 'voice-over-penuh', label: 'Voice Over Penuh', description: 'Dialog berjalan di semua adegan sepanjang video. Karakter tidak perlu on-screen untuk bernarasi — suara VO tetap terdengar di atas visual produk.' },
  { id: 'hanya-on-screen', label: 'Dialog Hanya Saat On-Screen', description: 'Dialog hanya ada saat karakter muncul di layar. Adegan tanpa karakter = visual diam tanpa narasi.' },
];

const countDialogWords = (segmentText: string): number => {
  const dialogMatches = segmentText.match(/Dialog:\s*"([^"]+)"/g) || [];
  const allDialog = dialogMatches
    .map(d => d.replace(/Dialog:\s*"/, '').replace(/"$/, '').trim())
    .filter(d => d.length > 0)
    .join(' ');
  return allDialog.trim().split(/\s+/).filter(Boolean).length;
};

const validateDialogLength = (promptText: string, segDuration: string, isUrai = false): string[] => {
  const maxWords = isUrai
    ? (segDuration === '10' ? 40 : 60)
    : (segDuration === '10' ? 25 : 37);
  const segments = promptText.split(/(?=▶ SEGMEN)/).filter(s => s.trim().startsWith('▶ SEGMEN'));
  return segments
    .map((seg, i) => {
      const wordCount = countDialogWords(seg);
      if (wordCount > maxWords) return `Segmen ${i + 1}: ${wordCount} kata (batas ${maxWords} kata untuk ${segDuration} detik)`;
      return null;
    })
    .filter(Boolean) as string[];
};

const getSegmentWordCounts = (promptText: string, segDuration: string, isUrai = false): { count: number; max: number }[] => {
  const maxWords = isUrai
    ? (segDuration === '10' ? 40 : 60)
    : (segDuration === '10' ? 25 : 37);
  const segments = promptText.split(/(?=▶ SEGMEN)/).filter(s => s.trim().startsWith('▶ SEGMEN'));
  return segments.map(seg => ({ count: countDialogWords(seg), max: maxWords }));
};

const getOnScreenScenes = (appearanceId: string, totalScenes: number): string => {
  switch (appearanceId) {
    case 'adegan-1-saja': return `adegan 1 (semua segmen)`;
    case 'adegan-1-dan-penutup': return `adegan 1 (semua segmen) dan adegan ${totalScenes} dari segmen terakhir`;
    case 'adegan-1-2-dan-penutup': return `adegan 1 & 2 (semua segmen) dan adegan ${totalScenes} dari segmen terakhir`;
    default: return `adegan 1 & 2 (semua segmen)`;
  }
};

const buildCharacterRule = (appearanceId: string, totalScenes: number): string => {
  const onScreen = getOnScreenScenes(appearanceId, totalScenes);
  const sceneList = Array.from({ length: totalScenes }, (_, i) => i + 1);
  const isOnScreen = (sceneNum: number, isLastSegment = false): boolean => {
    switch (appearanceId) {
      case 'adegan-1-saja': return sceneNum === 1;
      case 'adegan-1-dan-penutup': return sceneNum === 1 || (sceneNum === totalScenes && isLastSegment);
      case 'adegan-1-2-dan-penutup': return sceneNum <= 2 || (sceneNum === totalScenes && isLastSegment);
      default: return sceneNum <= 2;
    }
  };
  const offScreenScenes = sceneList.filter(n => !isOnScreen(n));
  const offScreenText = offScreenScenes.length > 0
    ? `adegan ${offScreenScenes.join(', ')} (dan semua adegan kecuali penutup segmen terakhir jika berlaku)`
    : '';

  return `**ATURAN KEMUNCULAN KARAKTER ON-SCREEN — KERAS, TIDAK BOLEH DILANGGAR:**

Karakter HANYA BOLEH TERLIHAT DI LAYAR pada: ${onScreen}.

Pada adegan lainnya (${offScreenText}):
- Karakter TIDAK BOLEH terlihat on-screen dalam bentuk apapun
- TIDAK bicara ke kamera, TIDAK memegang produk, TIDAK ada gestur, TIDAK ada bagian tubuhnya
- Visual HARUS 100% fokus pada: produk close-up, suasana tempat, detail makanan/fasilitas, atau elemen dekoratif

PERBEDAAN ON-SCREEN dan VOICE OVER:
- On-screen = karakter terlihat di video (wajah/tubuh tampak)
- Voice over = suara narasi yang terdengar di atas visual, TANPA karakter terlihat
- Adegan tanpa karakter on-screen TETAP BISA memiliki dialog voice over — suaranya terdengar tapi orangnya tidak terlihat

CEK WAJIB sebelum menulis setiap adegan: apakah ini termasuk adegan on-screen karakter?
→ Jika YA: deskripsikan karakter secara visual (ekspresi, gestur, dll.)
→ Jika TIDAK: deskripsikan HANYA visual produk/tempat. Karakter tidak boleh disebut secara visual.`;
};

const buildDialogRule = (
  strategyId: string,
  appearanceId: string,
  segmentDuration: string,
  maxWords: number,
  totalScenes: number
): string => {
  const isOnScreen = (sceneNum: number, isLastSegment = false): boolean => {
    switch (appearanceId) {
      case 'adegan-1-saja': return sceneNum === 1;
      case 'adegan-1-dan-penutup': return sceneNum === 1 || (sceneNum === totalScenes && isLastSegment);
      case 'adegan-1-2-dan-penutup': return sceneNum <= 2 || (sceneNum === totalScenes && isLastSegment);
      default: return sceneNum <= 2;
    }
  };

  if (strategyId === 'voice-over-penuh') {
    const wordsPerScene = Math.floor(maxWords / totalScenes);
    const onScreenWords = Math.round(wordsPerScene * 1.3);
    const voWords = Math.round(wordsPerScene * 0.8);

    return `**ATURAN DIALOG — VOICE OVER PENUH:**

Konsep: dialog berjalan TERUS-MENERUS dari adegan 1 hingga adegan ${totalScenes} seperti narasi video. Karakter tidak harus terlihat untuk bernarasi — suara voice over tetap terdengar di atas visual produk/tempat.

SEMUA adegan dari 1 hingga ${totalScenes} WAJIB memiliki dialog. TIDAK ada adegan tanpa dialog.

POLA DIALOG per adegan dalam 1 segmen (${segmentDuration} detik, maks ${maxWords} kata total):
${Array.from({ length: totalScenes }, (_, i) => {
  const n = i + 1;
  const onScr = isOnScreen(n);
  const isHook = n === 1;
  const isCTA = n === totalScenes;
  const words = onScr ? onScreenWords : voWords;
  const role = isHook ? 'hook / pembuka — sedikit lebih panjang' : isCTA ? 'jembatan ke segmen berikutnya atau CTA penutup' : onScr ? 'narasi keunggulan utama' : 'narasi detail visual — pendek, padat';
  const type = onScr ? '🎭 on-screen' : '🎙️ voice over';
  return `- Adegan ${n} (${type}): ~${words} kata — ${role}`;
}).join('\n')}

CARA MENULIS dialog adegan non-karakter (voice over):
- Tulis narasi pendek yang MENDESKRIPSIKAN atau MEMPERKUAT visual yang sedang tampil
- Contoh: saat close-up ayam geprek ditampilkan, VO berkata "dagingnya tebal banget, dibalut tepung krispy yang bikin nagih"
- Suara terdengar natural seperti orang yang sedang melihat dan berkomentar, bukan membaca skrip
- JANGAN tulis "seperti yang kamu lihat" atau "di sini kita bisa melihat" — langsung ke deskripsi sensorik

CEK WAJIB sebelum finalisasi setiap segmen:
- Hitung total kata semua dialog (termasuk VO) → harus ≤ ${maxWords} kata
- Pastikan SEMUA adegan 1–${totalScenes} memiliki dialog yang tidak kosong
- Jika melebihi batas → potong dialog VO di adegan non-karakter terlebih dahulu (bukan hook/CTA)`;
  }

  const onScreenSceneNums = Array.from({ length: totalScenes }, (_, i) => i + 1).filter(n => isOnScreen(n));
  const offScreenSceneNums = Array.from({ length: totalScenes }, (_, i) => i + 1).filter(n => !isOnScreen(n));
  const maxWordsOnScreen = Math.round(maxWords / onScreenSceneNums.length * 1.1);

  return `**ATURAN DIALOG — HANYA SAAT KARAKTER ON-SCREEN:**

Dialog HANYA ADA di adegan di mana karakter terlihat on-screen.
Adegan tanpa karakter = Dialog: "" (tanda kutip kosong, wajib ditulis, TIDAK boleh dihilangkan).

Adegan BERNARASI: adegan ${onScreenSceneNums.join(', ')} → WAJIB ada dialog
Adegan TANPA NARASI: adegan ${offScreenSceneNums.join(', ')} → WAJIB Dialog: ""

ALOKASI KATA untuk ${onScreenSceneNums.length} adegan bernarasi (total maks ${maxWords} kata):
- Rata-rata sekitar ${maxWordsOnScreen} kata per adegan on-screen
- Adegan 1 (hook): prioritas utama, jangan dipotong
- Adegan terakhir segmen terakhir (CTA): prioritas utama, jangan dipotong
- Adegan on-screen tengah: bisa dikurangi jika mendekati batas

FORMAT Dialog kosong yang BENAR: Dialog: ""
FORMAT SALAH: Dialog: "-" | Dialog: "(tidak ada)" | menghapus baris Dialog sama sekali

CEK WAJIB: hitung kata semua dialog berisi (bukan Dialog: "") → harus ≤ ${maxWords} kata total per segmen.`;
};

const buildUraiDialogRule = (
  appearanceId: string,
  segmentDuration: string,
  maxWords: number,
  totalScenes: number
): string => {
  const isOnScreen = (sceneNum: number): boolean => {
    switch (appearanceId) {
      case 'adegan-1-saja': return sceneNum === 1;
      case 'adegan-1-dan-penutup': return sceneNum === 1 || sceneNum === totalScenes;
      case 'adegan-1-2-dan-penutup': return sceneNum <= 2 || sceneNum === totalScenes;
      default: return sceneNum <= 2;
    }
  };
  const wordsPerScene = Math.floor(maxWords / totalScenes);
  const onScreenWords = Math.round(wordsPerScene * 1.2);
  const voWords = Math.round(wordsPerScene * 0.85);

  return `**ATURAN DISTRIBUSI DIALOG DARI SKRIP — MODE URAI:**

Konsep: SKRIP yang diberikan adalah dialog/narasi FINAL. Tugasmu:
1. Membagi skrip ke dalam segmen berdasarkan durasi yang dipilih.
2. Mendistribusikan kalimat-kalimat dari skrip ke dalam adegan per segmen.
3. JANGAN UBAH kata-kata dari skrip. Potong HANYA di jeda natural (koma, titik, jeda napas).
4. Setiap adegan berisi 1–2 kalimat pendek dari skrip yang natural diucapkan dalam ~2 detik.

POLA DISTRIBUSI DIALOG per adegan dalam 1 segmen (${segmentDuration} detik, ~${totalScenes} adegan, maks ${maxWords} kata):
${Array.from({ length: totalScenes }, (_, i) => {
  const n = i + 1;
  const onScr = isOnScreen(n);
  const words = onScr ? onScreenWords : voWords;
  const type = onScr ? '🎭 on-screen' : '🎙️ voice over';
  const role = n === 1 ? 'pembuka / hook dari skrip' : n === totalScenes ? 'penutup / CTA dari skrip' : 'narasi lanjutan dari skrip';
  return `- Adegan ${n} (${type}): ~${words} kata — ${role}`;
}).join('\n')}

SEMUA adegan WAJIB memiliki dialog dari skrip (voice over penuh).
Dialog adegan non-karakter (off-screen) = suara VO terdengar di atas visual, karakter tidak tampak.
JIKA SKRIP HABIS sebelum segmen terakhir, adegan sisa boleh Dialog: "" tapi hanya jika benar-benar tidak ada kata skrip tersisa.

CEK WAJIB: total kata dialog per segmen ≤ ${maxWords} kata. Potong di batas segmen yang natural.`;
};

const buildStyleGuide = (styleIds: string[]): string => {
  const allGuides: Record<string, string> = {
    'ugc': `**[UGC] User Generated Content:**
NADA: Jujur, spontan, seperti orang biasa yang beneran nyobain — bukan influencer berbayar.
HOOK WAJIB GAYA INI: Pembuka terasa pengakuan jujur + info lokasi hemat. Contoh: "Eh jujur ya, aku baru tau kalau pesan lewat tag lokasi di bawah itu harganya beda — lebih murah dari beli langsung. Nih, aku buktiin sendiri."
STRUKTUR SKRIP: Hook jujur (info hemat) → cerita pengalaman pertama → detail yang bikin kaget/senang → manfaat spesifik → CTA natural.
CIRI KHAS DIALOG: Filler natural (eh, loh, beneran deh, serius), bahasa sehari-hari informal, cerita pengalaman personal, hindari kalimat terlalu halus atau terstruktur.
VISUAL: Selfie-style medium shot wajah natural, close-up produk spontan tidak sempurna, wide shot suasana ramai/natural.`,

    'storytelling': `**[Storytelling]:**
NADA: Emosional, membangun rasa penasaran, ada konflik kecil dan resolusi yang memuaskan.
HOOK WAJIB GAYA INI: Buka dengan situasi/kebutuhan yang relatable, lalu info lokasi hemat muncul sebagai "temuan penting". Contoh: "Waktu aku lagi nyari tempat makan yang beneran worth it, aku nemuin satu hal yang bikin aku langsung balik lagi — pesan lewat tag lokasi di bawah, harganya turun. Dan itu baru awal ceritanya."
STRUKTUR SKRIP: Hook situasi (+ info hemat sebagai temuan) → konflik/kebutuhan yang membangun → pertemuan dengan produk → momen "wow" yang emosional → resolusi memuaskan → CTA.
CIRI KHAS DIALOG: Kalimat membangun antisipasi ("dan ternyata…", "yang bikin aku kaget adalah…", "sampai akhirnya…"), satu momen emosional/klimaks di tengah sebelum CTA.
VISUAL: Wide shot dramatis pembuka, close-up ekspresi karakter di momen emosional, slow detail produk, lighting mood-ful.`,

    'soft-selling': `**[Soft Selling]:**
NADA: Edukatif, informatif — terasa seperti berbagi pengetahuan berguna, bukan menjual.
HOOK WAJIB GAYA INI: Buka dengan fakta atau insight menarik tentang sistem harga. Contoh: "Yang banyak orang belum tau — pesan lewat tag lokasi di bawah itu harganya lebih rendah dari datang langsung. Ini bukan promo musiman, ini memang sistemnya begitu."
STRUKTUR SKRIP: Hook fakta (+ info hemat sebagai insight) → edukasi manfaat utama produk → perbandingan/konteks yang memperkuat → tips atau insight tambahan → CTA yang terasa logis bukan memaksa.
CIRI KHAS DIALOG: "faktanya…", "yang bikin ini beda adalah…", "banyak yang belum tau…", "masuk akal kan kalau…", CTA terasa seperti kesimpulan logis.
VISUAL: Close-up detail produk yang indah dan informatif, medium shot yang menunjukkan proses/kualitas, shot yang memperkuat klaim edukatif.`,

    'problem-solution': `**[Problem–Solution]:**
NADA: Empati dulu — bangun rasa "iya bener banget!" — lalu berikan solusi yang tegas dan meyakinkan.
HOOK WAJIB GAYA INI: Buka dengan masalah yang sangat relatable, lalu info hemat muncul sebagai solusi langsung. Contoh: "Pernah nggak sih kamu ngerasa udah capek-capek datang langsung, eh malah bayar lebih mahal? Aku juga. Solusinya simpel — klik tag lokasi di bawah, harganya beda jauh."
STRUKTUR SKRIP: Hook masalah relatable (+ solusi hemat sebagai pivot) → perburukan masalah yang membangun urgensi → produk/tempat sebagai solusi konkret → bukti bahwa solusi berhasil (detail produk) → resolusi melegakan → CTA.
CIRI KHAS DIALOG: "pernah nggak kamu…?", "capek nggak sih kalau…", "aku dulu juga gitu…", "tapi sekarang…", resolusi terasa seperti napas lega.
VISUAL: Wide shot situasi problematik → ekspresi berubah saat ketemu solusi → close-up solusi (produk), ekspresi lega dan puas.`,

    'cinematic': `**[Cinematic]:**
NADA: Tenang, premium, minimal tapi setiap kata berdampak — kesan aspirasional dan elegan.
HOOK WAJIB GAYA INI: Kalimat sangat pendek dan puitis, info hemat disampaikan dengan tone elegan dan eksklusif. Contoh: "Harga terbaik bukan di kasir. Ada di tag lokasi di bawah." atau "Mereka yang tahu cara yang benar, pesan lewat lokasi bawah. Harganya berbeda."
STRUKTUR SKRIP: Opening satu kalimat kuat (info hemat, elegan) → keistimewaan produk disampaikan puitis → satu atau dua detail sensorik yang kuat → CTA elegan dan pendek.
CIRI KHAS DIALOG: Kalimat sangat pendek (5–8 kata per kalimat), puitis, biarkan visual berbicara lebih banyak dari dialog, tone aspirasional. HINDARI kalimat panjang atau penjelasan berlebihan.
VISUAL: Sinematik penuh — slow motion, golden hour lighting, macro shot detail produk, depth of field dangkal, komposisi simetris, transisi elegan.`,

    'listicle': `**[Listicle]:**
NADA: Jelas, terstruktur, to-the-point — penonton tahu persis apa yang akan mereka dapat sejak detik pertama.
HOOK WAJIB GAYA INI: Buka dengan janji konten yang jelas + info hemat sebagai poin pertama. Contoh: "Ada 3 hal yang kamu harus tau sebelum ke sini — dan yang pertama, dan ini paling penting: pesan lewat tag lokasi di bawah itu harganya lebih murah dari datang langsung."
STRUKTUR SKRIP: Hook "ada N hal yang harus kamu tau" (poin 1 = info hemat) → poin 2 (keunggulan produk utama) → poin 3 (favorit/climax — yang paling bikin penasaran) → bonus poin opsional → CTA yang terasa sebagai tindakan logis setelah mendengar list.
CIRI KHAS DIALOG: "pertama…", "kedua…", "yang ketiga dan ini yang paling bikin aku balik lagi…", "bonus:", kalimat pendek dan padat per poin, tidak bertele-tele.
VISUAL: Shot yang clean dan terorganisir — setiap adegan visual merepresentasikan satu poin dengan jelas, medium shot informatif, close-up produk tepat di poin yang relevan.`,
  };

  const uniqueStyles = [...new Set(styleIds)];
  return uniqueStyles.map(id => allGuides[id] ?? allGuides['ugc']).join('\n\n');
};

const INDONESIAN_CONTEXT_RULE = `**ATURAN KONTEKS VISUAL INDONESIA — WAJIB DITERAPKAN DI SEMUA ADEGAN:**

Semua elemen visual HARUS spesifik Indonesia. Jangan biarkan Sora menggunakan default Western.
Setiap kali elemen di bawah muncul dalam deskripsi visual, WAJIB tambahkan kata kunci spesifik berikut:

UANG / TRANSAKSI:
- Selalu tulis: "uang kertas Rupiah Indonesia", "lembaran Rupiah merah pecahan 100 ribu", "uang Rupiah berwarna merah-biru"
- JANGAN tulis: "uang", "cash", "bills", "money" tanpa keterangan
- Contoh BENAR: "tangan memegang lembaran uang Rupiah Indonesia pecahan 100 ribu berwarna merah"
- Contoh SALAH: "tangan memegang uang"

MAKANAN & MINUMAN:
- Selalu sebut nama makanan Indonesia secara eksplisit: "nasi goreng dengan telur ceplok di atas", "ayam geprek sambal merah", "es teh manis gelas plastik bening"
- Tambahkan: "piring putih khas warung Indonesia", "meja kayu warung makan Indonesia", "wadah styrofoam khas Indonesia"
- Tambahkan detail visual lokal: "nasi pulen mengepul", "sambal merah di mangkok kecil", "kerupuk di sisi piring"

TEMPAT / SETTING:
- Untuk brand/tempat LOKAL Indonesia: tambahkan "suasana warung makan Indonesia", "interior kafe Indonesia modern"
- Untuk hotel lokal: "lobby hotel bintang Indonesia", "kamar hotel Indonesia dengan AC split di dinding"
- Untuk wisata: "pemandangan alam Indonesia tropis", "pantai Indonesia dengan pohon kelapa"
- PENGECUALIAN — brand internasional seperti KFC, McDonald's, Starbucks, Pizza Hut, dan sejenisnya: JANGAN tambahkan kata "Indonesia". Gunakan visual identity brand tersebut apa adanya (interior, warna, logo sesuai standar brand). Cukup pastikan pengunjung/figuran di latar terlihat seperti orang Asia Tenggara.

ORANG / LATAR / FIGURAN:
- Untuk orang di LATAR atau figuran (bukan karakter utama): tambahkan "pengunjung berkulit sawo matang", "orang Indonesia"
- JANGAN ubah atau tambahkan deskripsi fisik pada karakter utama — karakter utama sudah ditentukan oleh input user, gunakan persis seperti yang diberikan
- Contoh BENAR untuk figuran: "wide shot suasana kafe, pengunjung Indonesia berkulit sawo matang"
- Contoh SALAH: menambahkan "berkulit sawo matang" atau detail fisik apapun pada karakter utama

TEKS / TULISAN DI FRAME:
- Jika ada papan nama, menu, atau tulisan di visual: tambahkan "bertuliskan huruf Latin bahasa Indonesia"
- Contoh: "papan menu bertuliskan bahasa Indonesia", "struk kasir bertuliskan Rupiah"

KEMASAN / PRODUK:
- Untuk produk lokal: tambahkan "kemasan produk Indonesia", "label berbahasa Indonesia"
- PENGECUALIAN — kemasan brand internasional (KFC, Starbucks, dll): gunakan kemasan asli brand tersebut, jangan dimodifikasi dengan label Indonesia

CARA MENERAPKAN — WAJIB:
Setiap deskripsi visual adegan yang melibatkan elemen di atas, sisipkan kata kunci Indonesia secara langsung dalam kalimat deskripsi.
Contoh penerapan lengkap:
- SALAH: "close-up tangan memegang uang, tersenyum ke kamera"
- BENAR: "close-up tangan memegang lembaran Rupiah Indonesia pecahan 100 ribu warna merah, tersenyum ke kamera"

- SALAH: "wide shot suasana restoran mewah, pengunjung ramai"  
- BENAR: "wide shot suasana restoran Indonesia modern, pengunjung berkulit sawo matang berpakaian kasual, dekorasi batik di dinding"`;

export default function App() {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStyles, setActiveStyles] = useState<string[]>(['ugc']);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedSegmentKey, setCopiedSegmentKey] = useState<string | null>(null);
  const [promptWarnings, setPromptWarnings] = useState<string[][]>([]);

  const [category, setCategory] = useState('Makanan/Minuman');
  const [nameDesc, setNameDesc] = useState('');
  const [character, setCharacter] = useState('');
  const [segmentDuration, setSegmentDuration] = useState('15');
  const [totalDuration, setTotalDuration] = useState('45');
  const [contentCount, setContentCount] = useState('1');
  const [promptMode, setPromptMode] = useState<'bebas' | 'rapi' | 'urai' | 'skrip-jualan'>('bebas');
  const [loadingText, setLoadingText] = useState('Menganalisa & membuat prompt...');

  const [characterAppearance, setCharacterAppearance] = useState('adegan-1-2');
  const [dialogStrategy, setDialogStrategy] = useState('voice-over-penuh');
  const [scriptInput, setScriptInput] = useState('');

  // ── State Skrip Jualan ──
  const [skripJualanOutput, setSkripJualanOutput] = useState('');
  const [isSkripJualanLoading, setIsSkripJualanLoading] = useState(false);
  const [skripJualanLoadingText, setSkripJualanLoadingText] = useState('Membuat skrip...');

  const skripJualanLoadingMessages = [
    'Memilih hook yang tepat...',
    'Menyusun rumus storytelling...',
    'Merangkai narasi produk...',
    'Memeriksa kalimat aman...',
    'Menulis caption & hashtag...',
    'Finalisasi skrip...',
  ];

  const loadingMessages = [
    'Mencari ide-ide sinematik...',
    'Meracik hook yang menarik...',
    'Mengembangkan detail visual...',
    'Menyusun narasi yang kuat...',
    'Finalisasi prompt video...',
  ];

  const uraiLoadingMessages = [
    'Membaca skrip...',
    'Menentukan jumlah segmen...',
    'Membagi dialog ke setiap adegan...',
    'Merancang visual per adegan...',
    'Finalisasi prompt Sora...',
  ];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      const messages = promptMode === 'urai' ? uraiLoadingMessages : loadingMessages;
      let i = 0;
      setLoadingText(messages[0]);
      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingText(messages[i]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const toggleStyle = (styleId: string) => {
    setActiveStyles(prev => {
      if (prev.includes(styleId)) return prev.length > 1 ? prev.filter(s => s !== styleId) : prev;
      return [...prev, styleId];
    });
  };

  const downloadPrompts = () => {
    const content = prompts.join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sora-prompts.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePromptChange = (newText: string, index: number) => {
    const updatedPrompts = [...prompts];
    updatedPrompts[index] = newText;
    setPrompts(updatedPrompts);
    if (promptMode === 'rapi' || promptMode === 'urai') {
      const updatedWarnings = [...promptWarnings];
      updatedWarnings[index] = validateDialogLength(newText, segmentDuration, promptMode === 'urai');
      setPromptWarnings(updatedWarnings);
    }
  };

  const copyPrompt = (text: string, index: number) => {
    const promptStartIndex = text.indexOf('▶ SEGMEN');
    const promptToCopy = promptStartIndex !== -1 ? text.substring(promptStartIndex) : text;
    navigator.clipboard.writeText(promptToCopy);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copySegment = (fullText: string, promptIndex: number, segmentIndex: number) => {
    const segments = fullText.split(/(?=▶ SEGMEN)/).filter(s => s.trim().startsWith('▶ SEGMEN'));
    const target = segments[segmentIndex];
    if (target) {
      navigator.clipboard.writeText(target.trim());
      const key = `${promptIndex}-${segmentIndex}`;
      setCopiedSegmentKey(key);
      setTimeout(() => setCopiedSegmentKey(null), 2000);
    }
  };

  const extractSegments = (text: string): string[] =>
    text.split(/(?=▶ SEGMEN)/).filter(s => s.trim().startsWith('▶ SEGMEN'));

  const getScenePreview = () => {
    const totalScenes = segmentDuration === '10' ? 5 : 7;
    const isOnScreen = (n: number): boolean => {
      switch (characterAppearance) {
        case 'adegan-1-saja': return n === 1;
        case 'adegan-1-dan-penutup': return n === 1 || n === totalScenes;
        case 'adegan-1-2-dan-penutup': return n <= 2 || n === totalScenes;
        default: return n <= 2;
      }
    };
    return Array.from({ length: totalScenes }, (_, i) => {
      const n = i + 1;
      const onScreen = isOnScreen(n);
      return { n, onScreen, hasDialog: dialogStrategy === 'voice-over-penuh' ? true : onScreen };
    });
  };

  const getUraiScenePreview = () => {
    const totalScenes = segmentDuration === '10' ? 5 : 8;
    const isOnScreen = (n: number): boolean => {
      switch (characterAppearance) {
        case 'adegan-1-saja': return n === 1;
        case 'adegan-1-dan-penutup': return n === 1 || n === totalScenes;
        case 'adegan-1-2-dan-penutup': return n <= 2 || n === totalScenes;
        default: return n <= 2;
      }
    };
    return Array.from({ length: totalScenes }, (_, i) => {
      const n = i + 1;
      return { n, onScreen: isOnScreen(n), hasDialog: true };
    });
  };

  // ── Handler Skrip Jualan ──
  const handleSkripJualanGenerate = async (config: SkripJualanConfig) => {
    setIsSkripJualanLoading(true);
    setSkripJualanOutput('');

    let i = 0;
    setSkripJualanLoadingText(skripJualanLoadingMessages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % skripJualanLoadingMessages.length;
      setSkripJualanLoadingText(skripJualanLoadingMessages[i]);
    }, 1500);

    try {
      const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPrompt: buildSkripJualanUserPrompt(config),
    systemInstruction: buildSkripJualanSystemPrompt(config),
    temperature: 0.8,
    useSearch: false,
  }),
});
const data = await response.json();
setSkripJualanOutput(data.text || '');
    } catch (error) {
      console.error('Error generating skrip jualan:', error);
      setSkripJualanOutput('Maaf, terjadi kesalahan. Silakan coba lagi.');
    } finally {
      clearInterval(interval);
      setIsSkripJualanLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setPrompts([]);
    setPromptWarnings([]);

    const getStyleTitle = (id: string) => contentStyles.find(s => s.id === id)?.title || id;
    const count = parseInt(contentCount) || 1;
    const styleDistribution = Array.from({ length: count }, (_, i) => activeStyles[i % activeStyles.length]);
    const stylePerContent = styleDistribution.map((s, i) => `Konten ${i + 1}: ${getStyleTitle(s)}`).join('\n');

    const isUraiMode = promptMode === 'urai';
    const totalScenes = isUraiMode ? (segmentDuration === '10' ? 5 : 8) : (segmentDuration === '10' ? 5 : 7);
    const maxWords = isUraiMode ? (segmentDuration === '10' ? 40 : 60) : (segmentDuration === '10' ? 25 : 37);

    const characterRule = buildCharacterRule(characterAppearance, totalScenes);
    const dialogRule = buildDialogRule(dialogStrategy, characterAppearance, segmentDuration, maxWords, totalScenes);
    const activeStyleGuide = buildStyleGuide(activeStyles);

    // ── MODE BEBAS
    const bebasModeInstruction = `Kamu adalah AI pembuat Sora Video Prompt Mamas dalam Bahasa Indonesia yang dibekali kemampuan pencarian Google. Tugas utamamu adalah MENCARI INFORMASI tentang input user, lalu membuat prompt video yang SANGAT SPESIFIK, deskriptif, dan sinematik berdasarkan format dan aturan baru di bawah ini.

**PROSES BERPIKIR (WAJIB DIIKUTI):**
1.  **PENCARIAN & RISET:** Gunakan Google Search untuk mencari informasi detail tentang [NAMA & DESKRIPSI] yang diberikan user. Cari tahu tentang varian produk, keunikan, target pasar, suasana tempat, atau poin menarik lainnya.
2.  **KEMBANGKAN DESKRIPSI:** Berdasarkan hasil pencarian, buat paragraf deskripsi yang kaya dan menggugah selera/minat. Jelaskan seperti apa produk/tempat itu, apa saja kelebihannya, dan apa yang membuatnya spesial. Ini akan menjadi bagian utama dari prompt.
3.  **IDENTIFIKASI MANFAAT/USE-CASE:** Dari hasil riset, tentukan untuk siapa atau untuk momen apa produk/tempat ini cocok (misal: 'cocok untuk teman ngopi, bekal anak sekolah', atau 'ideal untuk honeymoon, liburan keluarga').
4.  **KONSTRUKSI PROMPT:** Susun semua elemen (deskripsi, hook, detail visual, persona model, manfaat, dan CTA) menjadi sebuah prompt video yang utuh sesuai format di bawah.

**FORMAT PROMPT BARU (WAJIB DIIKUTI 100%):**
'Buatkan video realistic [KARAKTER] sedang review [NAMA & DESKRIPSI HASIL RISET YANG DETAIL].

Hook "[PILIH HOOK DARI BANK HOOK BOLEH DI KREASIKAN]".

Setelah hook, kembangkan informasi produk secara menarik dan menggugah selera untuk dialog selama [DURASI SEGMEN] detik, MULTI SCENE, NO TEXT, CLEAR SUBJECT LOCK ,ANTI BLUR VIDEO , Tiap adegan visual sekitar 2–3 detik, Dialog langsung muncul di opening scene, tanpa intro shot.  tanpa jeda. Tampilkan [DETAIL VISUAL HASIL RISET, misal: close up produk, suasana tempat, dll].

Model yang berbicara adalah [KARAKTER] dengan gaya santai dan meyakinkan, menjelaskan kelebihan [NAMA PRODUK/TEMPAT] dengan antusias supaya orang tertarik datang dan beli.

Jelaskan bahwa [PRODUK/TEMPAT] ini cocok untuk [MANFAAT/USE-CASE HASIL RISET].

Buat tampilan video yang hidup, menarik, real dan realistis seperti konten TikTok Go. Videonya berkualitas ultra HD 4K keren. Video tertata rapi dari opening, review rasa, penjelasan harga dan varian, sampai closing tanpa terpotong.

video tanpa musik tanpa teks'

**ATURAN HOOK (SANGAT PENTING):**
-   **UNTUK SEGMEN 1:** Hook HARUS dipilih atau dikreasikan dari "BANK HOOK SEGMEN 1". Pesan utamanya adalah tentang mendapatkan harga lebih terjangkau melalui tag lokasi di banding datang langsung.
-   **UNTUK SEGMEN 2 DST:** Hook HARUS dipilih atau dikreasikan dari "BANK HOOK LANJUTAN" yang sesuai dengan kategori.
-   **SETIAP KONTEN BARU (setelah *****) adalah video TERPISAH dan INDEPENDEN.**
-   **Segmen pertama dari SETIAP konten (termasuk konten ke-2, ke-3, dst.) WAJIB menggunakan hook dari BANK HOOK SEGMEN 1 — bukan hook lanjutan.**
-   **Hook lanjutan HANYA untuk segmen 2, 3, dst. dalam konten yang SAMA.**

**ATURAN CTA PENUTUP (WAJIB):**
- HANYA ditambahkan di prompt SEGMEN TERAKHIR dari setiap konten, tidak di segmen lainnya.
- Jika hanya ada 1 segmen, segmen itu sekaligus menjadi segmen terakhir.
- Inti pesan yang WAJIB tersampaikan: ajak penonton klik tag lokasi di bawah untuk dapat harga lebih hemat dan cek lokasi terdekat.
- Kalimatnya BEBAS dikreasikan — boleh ubah susunan kata, tambahkan ekspresi natural, atau sesuaikan dengan tone konten. Yang penting inti pesannya sama.
- DILARANG menggunakan kalimat yang persis sama antar konten jika membuat lebih dari 1.

**ATURAN FORMAT OUTPUT LAINNYA:**
-   Awali setiap segmen dengan '▶ SEGMEN [N] ([X] detik)'.
-   Pisahkan segmen dengan '--'.
-   Pisahkan beberapa konsep video dengan '*****'.
-   JANGAN gunakan format list atau poin, seluruh output harus dalam format paragraf naratif yang menyatu sesuai template.
- DILARANG menuliskan kata "Karakter" sebelum nama/handle karakter. Langsung tulis nama/handle-nya. Contoh BENAR: "@batop40 tersenyum ramah ke kamera" — Contoh SALAH: "Karakter @batop40 tersenyum ramah ke kamera"

**ATURAN PEMILIHAN HOOK (WAJIB):**
- PILIH SECARA ACAK salah satu hook dari bank yang sesuai kategori — JANGAN selalu ambil yang pertama.
- Setelah memilih, boleh MEMODIFIKASI KREATIF hook tersebut: ubah susunan kata, tambahkan ekspresi natural (contoh: "Eh wait—", "Guys,", "Oke jujur nih,"), atau gabungkan elemen dari dua hook berbeda.
- Inti pesan TIDAK BOLEH berubah (harga lebih murah lewat lokasi bawah).
- Jika menghasilkan lebih dari 1 konten, WAJIB gunakan hook yang BERBEDA di setiap konten. Tidak boleh ada hook yang mirip antar konten.
---
**BANK HOOK SEGMEN 1 (Pilih salah satu untuk segmen pertama sesuaikan dengan kategori):**
===========================
 MAKANAN / RESTO

-"Serius, kalau kamu klik lokasi di bawah, harganya beda. Lebih hemat dibanding beli langsung di tempat. Jangan skip."
-"Yang datang langsung bayar lebih tinggi. Kalau mau lebih hemat, klik lokasi bawah aja. Sistemnya memang begitu."
-"Langsung klik lokasi bawah ya. Lewat sini harganya lebih bersahabat dibanding pesan langsung di kasir."
-"Biar nggak keluar biaya lebih besar, pesan lewat tag lokasi bawah. Yang beli langsung selalu kena harga lebih tinggi."
-"Jangan beli langsung—lebih tinggi. Klik lokasi bawah, kamu dapat harga yang lebih enak."
-"Beneran beda harganya. Klik lokasi bawah kalau kamu mau versi yang lebih hemat daripada beli di tempat."
-"Kalau kamu klik lokasi bawah, harganya turun. Kalau beli langsung, ya… beda. Pilih yang lebih hemat lah."
-"Aku selalu klik lokasi bawah, soalnya harganya *lebih rendah* daripada pesan langsung. Cobain sendiri."
-"Kalau mau hemat, klik lokasi bawah. Yang beli langsung selalu bayar lebih mahal."
-"Pesan lewat tag lokasi bawah itu harganya lebih bersahabat. Datang langsung? Nggak dapet harga itu."

===========================
 HOTEL

-"Booking lewat lokasi bawah itu harganya lebih rendah daripada walk-in. Mau hemat? Klik lokasi bawah aja."
-"Yang check-in langsung biasanya bayar lebih. Klik lokasi bawah, kamu dapat harga yang lebih ramah."
-"Serius, klik lokasi bawah. Harga di sana jauh lebih hemat dibanding datang langsung ke counter."
-"Kalau kamu booking walk-in, harganya beda. Klik lokasi bawah biar dapat harga yang lebih enak."
-"Jangan langsung datang ya—harga walk-in lebih tinggi. Akses dari lokasi bawah jauh lebih hemat."
-"Hematnya kerasa banget kalau booking lewat lokasi bawah. Walk-in itu lebih mahal."
-"Klik lokasi bawah sebelum booking. Harganya lebih turun dibanding bayar langsung di resepsionis."
-"Aku nggak pernah walk-in karena harganya lebih tinggi. Lokasi bawah selalu lebih hemat."
-"Kalau kamu mau harga yang lebih ringan, booking lewat lokasi bawah. Jangan ambil langsung di tempat."
-"Klik lokasi bawah—di sana harganya lebih lembut. Walk-in itu jauh lebih berat di kantong."

===========================
 TEMPAT WISATA / TIKET

-"Tiket lewat lokasi bawah itu lebih murah dibanding beli langsung di loket. Klik dulu sebelum datang."
-"Jangan beli on the spot. Loket harganya lebih tinggi. Klik lokasi bawah buat harga yang lebih hemat."
-"Harganya beda ya. Lokasi bawah kasih kamu harga lebih rendah dibanding beli langsung di pintu masuk."
-"Kalau mau hemat, ambil tiket lewat tag lokasi bawah. Yang beli langsung selalu bayar lebih."
-"Klik lokasi bawah. Tiket di sana lebih ramah harga dibanding beli di loket."
-"Tiket online lewat lokasi bawah lebih hemat daripada harga di tempat. Serius, beda banget."
-"Yang beli di loket itu bayar versi lebih mahal. Klik lokasi bawah buat harga yang lebih enak."
-"Ambil tiket lewat lokasi bawah—lebih hemat. Jangan beli langsung kalau nggak mau keluar lebih."
-"Harganya lebih ringan kalau lewat lokasi bawah. Beli langsung di tempat? Pasti lebih tinggi."
-"Klik lokasi bawah untuk dapat harga yang lebih rendah. Loket itu versi yang lebih mahal."

===
**BANK HOOK LANJUTAN - KATEGORI MAKANAN/MINUMAN (Pilih untuk segmen 2+ jika kategori makanan):**
- "Setelah tadi nyobain bagian pertamanya, sekarang aku mau tunjukin bagian yang bikin menu ini makin menarik."
- "Oke lanjut ya, tadi aku belum sempet bahas isiannya yang melimpah banget."
- "Tadi baru nyobain satu varian, sekarang aku mau cobain yang lainnya biar lengkap."

===
**BANK HOOK LANJUTAN - KATEGORI HOTEL (Pilih untuk segmen 2+ jika kategori hotel):**
- "Setelah tadi lihat kamarnya, sekarang aku mau tunjukin fasilitas lainnya."
- "Oke lanjut ya, aku mau bahas bagian hotel yang paling aku suka."
- "Tadi baru review kamar, sekarang kita lihat area umum dan fasilitasnya."

===
**BANK HOOK LANJUTAN - KATEGORI TEMPAT WISATA (Pilih untuk segmen 2+ jika kategori wisata):**
- "Setelah tadi lihat spot utamanya, sekarang aku mau tunjukin area lainnya."
- "Oke lanjut ya, soalnya tempat ini luas dan banyak spot menarik."
- "Tadi baru lihat bagian depan, sekarang kita keliling lebih jauh."
===`;

    // ── MODE RAPI
    const rapiModeInstruction = `Kamu adalah AI Scriptwriter dan Visual Director untuk konten review TikTok dalam Bahasa Indonesia, DIBEKALI KEMAMPUAN PENCARIAN GOOGLE. Cari info dulu, tulis skrip penuh sesuai gaya, lalu bagi ke segmen.

**ALUR KERJA WAJIB — 4 TAHAP:**

TAHAP 1 — RISET
Gunakan Google Search untuk mencari info mendalam tentang nama & deskripsi yang diberikan. Cari keunikan, menu/fasilitas, varian, suasana, harga, target pasar. JANGAN mulai menulis skrip sebelum selesai riset.

TAHAP 2 — TULIS SKRIP PENUH (SESUAI GAYA)
Berdasarkan hasil riset dan GAYA KONTEN yang ditentukan, tulis skrip narasi LENGKAP untuk satu konten video dari awal sampai akhir.
- Skrip adalah teks yang akan diucapkan karakter dari detik pertama hingga terakhir
- Panjang skrip disesuaikan total durasi: hitung maks kata = (Total Detik ÷ Durasi Segmen) × Maks Kata Per Segmen
- KALIMAT PERTAMA skrip WAJIB mengandung pesan inti: lewat tag lokasi di bawah harganya lebih hemat dari datang langsung. Kalimatnya bebas dikreasikan SESUAI GAYA, tapi inti pesan ini TIDAK BOLEH digeser ke tengah atau akhir — HARUS di pembuka.
- Kembangkan narasi sesuai panduan gaya di bawah hingga CTA penutup.
- JANGAN langsung ke format segmen di tahap ini — tulis skrip penuh dulu.

TAHAP 3 — BAGI SKRIP KE SEGMEN & ADEGAN
- Hitung segmen: Total Durasi ÷ Durasi per Segmen
- Bagi skrip secara proporsional ke tiap segmen, potong di jeda natural (koma, titik, jeda napas)
- Distribusikan kalimat skrip ke adegan dalam segmen sesuai aturan dialog di bawah
- Rancang visual sinematik yang mendukung tiap adegan, sesuai panduan visual per gaya

TAHAP 4 — FORMAT OUTPUT
LANGSUNG mulai output dengan ▶ SEGMEN 1 tanpa penjelasan, tanpa intro, tanpa komentar apapun.

===

**PANDUAN GAYA KONTEN — IKUTI GAYA YANG DIMINTA UNTUK SETIAP KONTEN:**

${activeStyleGuide}

===

${dialogRule}

===

${characterRule}

===

**FORMAT OUTPUT — IKUTI 100%:**

▶ SEGMEN [N] ([X] detik)
Buatkan video realistic ${character || 'faceless'} sedang review ${nameDesc} dengan gaya [GAYA KONTEN], Durasi [DURASI SEGMEN] detik, MULTI SCENE, NO TEXT, CLEAR SUBJECT LOCK, ANTI BLUR VIDEO. Tiap adegan visual sekitar 2–3 detik, Dialog langsung muncul di opening scene, tanpa intro shot, tanpa jeda. Tanpa teks, tanpa musik, tanpa watermark. Tone visual realistis seperti TikTok, bukan animasi. Ultra HD 4K. Video tertata rapi dari opening hingga closing tanpa terpotong.

Deskripsi visual adegan 1, Dialog: "kalimat dialog 1"

Deskripsi visual adegan 2, Dialog: "kalimat dialog 2"

Deskripsi visual adegan 3, Dialog: "kalimat dialog 3"

Deskripsi visual adegan 4, Dialog: "kalimat dialog 4"

Deskripsi visual adegan 5, Dialog: "kalimat dialog 5"

Deskripsi visual adegan 6 — jika durasi 15 detik, Dialog: "kalimat dialog 6"

Deskripsi visual adegan 7 — jika durasi 15 detik, Dialog: "kalimat dialog 7"


===

${INDONESIAN_CONTEXT_RULE}
===
**ATURAN FORMAT TAMBAHAN:**
- WAJIB awali tiap segmen dengan '▶ SEGMEN [N] ([X] detik)'.
- WAJIB pisahkan segmen dengan '--', pisahkan konten dengan '*****'.
- DILARANG tanda kurung [ ] dalam deskripsi visual output.
- DILARANG penjelasan/komentar apapun sebelum atau sesudah output. Langsung mulai dengan '▶ SEGMEN 1'.
- DILARANG menuliskan kata "Karakter" sebelum nama/handle karakter. Langsung tulis nama/handle-nya.
- Jika membuat lebih dari 1 konten: SETIAP konten WAJIB menggunakan gaya berbeda sesuai distribusi. Hook dan struktur narasi HARUS berbeda antar konten — tidak boleh copy-paste struktur dari konten sebelumnya.
- ATURAN VISUAL — WAJIB FOKUS KE OBJEK REVIEW:
  Mayoritas adegan (minimal 5 dari 7 adegan per segmen) HARUS menampilkan visual objek review, bukan karakter.
  Karakter hanya muncul di adegan on-screen yang sudah ditentukan — adegan lainnya WAJIB fokus ke visual produk/tempat.

  UNTUK REVIEW MAKANAN/MINUMAN:
  Prioritaskan visual: close-up tekstur makanan mengepul/berair/crispy, detail bahan topping, penampang potongan,
  suasana meja makan, interior outlet yang nyaman, proses penyajian, minuman dengan es batu segar,
  wide shot suasana ramai outlet, detail dekorasi/branding tempat.

  UNTUK REVIEW HOTEL:
  Prioritaskan visual: interior kamar dengan pencahayaan hangat, detail kasur dan bantal rapi,
  pemandangan dari jendela kamar, kolam renang/fasilitas, lobby mewah, detail amenities kamar mandi,
  wide shot eksterior hotel, area sarapan/restoran hotel, detail furnitur dan dekorasi.

  UNTUK REVIEW TEMPAT WISATA:
  Prioritaskan visual: wide shot panorama lokasi, detail arsitektur/landmark, suasana pengunjung ramai,
  spot foto ikonik, detail keunikan tempat, aktivitas yang bisa dilakukan,
  golden hour atau pencahayaan terbaik lokasi, area yang paling instagramable.

  KOMPOSISI SHOT — ATURAN KETAT:
  - DOMINASI wide shot dan medium shot — minimal 5 dari 7 adegan harus wide atau medium
  - Close-up MAKSIMAL 1 kali per segmen, dan hanya untuk detail yang benar-benar impactful (tekstur makanan,
    detail unik produk) — JANGAN close-up wajah karakter
  - Wide shot WAJIB memperlihatkan objek review SEKALIGUS suasana/lingkungan sekitarnya —
    contoh: "wide shot meja makan dengan hidangan lengkap, suasana outlet ramai di latar belakang"
  - Medium shot juga harus memperlihatkan konteks tempat —
    contoh: "medium shot ayam geprek di piring dengan meja kayu dan dekorasi warung terlihat di sekitarnya"

  URUTAN SHOT YANG DISARANKAN per segmen (7 adegan):
  wide shot suasana outlet/tempat lengkap → medium shot produk dengan latar tempat terlihat →
  medium shot sudut berbeda dengan suasana → wide shot area lain yang menarik →
  medium shot detail produk dengan konteks → close-up detail impactful (1x saja) →
  wide shot/medium shot penutup suasana keseluruhan.

  PRINSIP UTAMA: Setiap shot harus menjawab pertanyaan "terlihat seperti apa tempatnya?"
  bukan hanya "seperti apa produknya?". Penonton harus bisa membayangkan suasana
  berada di tempat tersebut, bukan hanya melihat produk secara terisolasi.

  DILARANG: close-up yang memotong konteks tempat/suasana dari frame.
  DILARANG: adegan off-screen diisi deskripsi karakter dalam bentuk apapun.
  DILARANG: mendominasi segmen dengan shot karakter lebih dari 2 adegan per segmen.
`;

    // ── MODE URAI
    const uraiDialogRule = buildUraiDialogRule(characterAppearance, segmentDuration, maxWords, totalScenes);

    const uraiModeInstruction = `Kamu adalah AI Visual Director untuk konten video TikTok dalam Bahasa Indonesia. Tugasmu adalah mengurai skrip yang diberikan menjadi prompt video Sora yang padat, sinematik, dan siap produksi.

PENTING: Kamu TIDAK PERLU mencari informasi tambahan. Gunakan HANYA skrip yang diberikan sebagai sumber dialog — jangan tambah, ubah, atau kurangi kata-kata skrip.

**PERANMU SEBAGAI SUTRADARA:**
Kamu bertindak seperti sutradara film yang membaca naskah lalu menentukan:
- Berapa segmen yang dibutuhkan berdasarkan panjang skrip dan durasi per segmen
- Shot size yang tepat per adegan (wide, medium, close-up)
- Timing dialog per adegan agar terasa natural dan padat (~2 detik per adegan)
- Di mana karakter muncul vs kapan visual produk/tempat mendominasi

**PROSES BERPIKIR WAJIB:**
1. BACA SKRIP PENUH: Pahami alur, tone, dan pesan keseluruhan skrip.
2. HITUNG SEGMEN: Bagi skrip berdasarkan durasi. Contoh: skrip ~90 kata, durasi 15 detik (maks ${maxWords} kata/segmen) → ~${Math.ceil(90 / maxWords)} segmen. Sesuaikan dengan alur dialog yang natural.
3. BAGI DIALOG: Distribusikan kalimat skrip ke adegan per segmen. Potong HANYA di jeda natural (koma, titik, jeda napas). JANGAN potong di tengah kalimat yang janggal.
4. RANCANG VISUAL: Untuk setiap adegan, buat deskripsi visual sinematik yang mendukung dialog.
5. IKUTI aturan kemunculan karakter dengan ketat.
6. FINALISASI ke format output.

===

${uraiDialogRule}

===

${characterRule}

===

**FORMAT OUTPUT — IKUTI 100%:**

▶ SEGMEN [N] ([X] detik)
Buatkan video realistic ${character || 'faceless'} mereview ${nameDesc}, gaya bicara padat dan natural, Durasi [DURASI SEGMEN] detik, MULTI SCENE, NO TEXT, CLEAR SUBJECT LOCK, ANTI BLUR VIDEO. Tiap adegan visual sekitar 2 detik, dialog langsung muncul di opening scene, tanpa intro shot, tanpa jeda. Tanpa teks, tanpa musik, tanpa watermark. Tone visual realistis seperti TikTok, bukan animasi. Ultra HD 4K. Video mengalir natural dari opening hingga closing tanpa terpotong.

Deskripsi visual adegan 1, Dialog: "penggalan skrip adegan 1"

Deskripsi visual adegan 2, Dialog: "penggalan skrip adegan 2"

[lanjutkan untuk semua adegan dalam segmen]

--

[segmen berikutnya jika ada]

===

${INDONESIAN_CONTEXT_RULE}

===

**ATURAN FORMAT WAJIB:**
- Awali tiap segmen dengan '▶ SEGMEN [N] ([X] detik)'.
- Pisahkan segmen dengan '--'.
- Jika ada beberapa konten, pisahkan dengan '*****'.
- DILARANG tanda kurung [ ] dalam output deskripsi visual.
- DILARANG penjelasan/komentar apapun sebelum atau sesudah output. Langsung mulai dengan '▶ SEGMEN 1'.
- DILARANG menuliskan kata "Karakter" sebelum nama/handle karakter. Langsung tulis nama/handle-nya.
- DILARANG mengubah kata-kata dari skrip asli. Hanya boleh memotong di jeda natural.

**ATURAN VISUAL PER ADEGAN:**
- Dominasi wide shot dan medium shot. Close-up produk MAKSIMAL 1 kali per segmen.
- Urutan shot yang disarankan: wide → medium → medium → close-up (1x) → medium → wide → medium → medium.
- Adegan on-screen karakter: deskripsikan ekspresi, gestur, dan posisi karakter secara spesifik.
- Adegan off-screen (VO): deskripsikan visual produk/tempat/suasana yang mendukung kata-kata dialog.
- Deskripsi visual harus sinematik dan spesifik — contoh: "medium shot nasi goreng mengepul di wajan besi hitam, asap tipis mengular ke atas".
`;

    const systemInstruction =
      promptMode === 'bebas' ? bebasModeInstruction :
      promptMode === 'rapi' ? rapiModeInstruction :
      uraiModeInstruction;

    const userPrompt = promptMode === 'urai'
      ? `Urai skrip berikut menjadi prompt video Sora yang siap produksi:

Kategori: ${category}
Nama & Deskripsi: ${nameDesc}
Karakter: ${character || 'faceless'}
Durasi per Segmen: ${segmentDuration} detik
Jumlah Adegan per Segmen: ${totalScenes} adegan (~2 detik per adegan)

SKRIP YANG HARUS DIURAI:
"""
${scriptInput}
"""

Tentukan berapa segmen yang dibutuhkan berdasarkan panjang skrip di atas, lalu buat prompt Sora-nya.`
      : `Buatkan ${contentCount} konten video yang berbeda berdasarkan detail berikut:

Kategori: ${category}
Nama & Deskripsi Singkat: ${nameDesc}
Karakter: ${character || 'faceless'}
Durasi per Segmen: ${segmentDuration} detik
Total Durasi: ${totalDuration} detik

Gaya Konten per video (WAJIB DIIKUTI — setiap konten harus mengikuti panduan gaya yang tertera):
${stylePerContent}
`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const toolsConfig = promptMode === 'urai' ? undefined : [{ googleSearch: {} }];

      // @ts-ignore
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPrompt,
    systemInstruction,
    temperature: promptMode === 'urai' ? 0.65 : 0.8,
    useSearch: promptMode !== 'urai',
  }),
});
const data = await response.json();
const responseText = (data.text || '')
        .replace(/\*\*\*\*\*/g, '---')
        .replace(/^---$/gm, '---')
        .replace(/^\[([^\]]+)\],/gm, '$1,')
        .replace(/^\[([^\]]+)\]$/gm, '$1');

      const generatedPrompts = responseText
        .split('---')
        .map(p => p.trim())
        .filter(p => p.includes('▶ SEGMEN'));

      const formattedPrompts = generatedPrompts.map((prompt, i) => {
        const styleId = styleDistribution[i] ?? activeStyles[0];
        const styleTitle = getStyleTitle(styleId);
        const totalSegments = (prompt.match(/▶ SEGMEN/g) || []).length;
        const label = promptMode === 'urai' ? 'URAI SKRIP' : styleTitle.toUpperCase();
        return `═══════════════════════════════════════
KONTEN #${i + 1} — ${label}
═══════════════════════════════════════
Kategori: ${category}
${promptMode === 'urai'
  ? `Durasi per Segmen: ${segmentDuration} detik (${totalSegments} segmen Sora)`
  : `Durasi Target: ${totalDuration} detik (${totalSegments} segmen Sora)`}

${prompt}`;
      });

      setPrompts(formattedPrompts);

      if (promptMode === 'rapi' || promptMode === 'urai') {
        const warnings = formattedPrompts.map(p => validateDialogLength(p, segmentDuration, promptMode === 'urai'));
        setPromptWarnings(warnings);
      }

    } catch (error) {
      console.error("Error generating prompts:", error);
      setPrompts(['Maaf, terjadi kesalahan saat membuat prompt. Silakan coba lagi.']);
    } finally {
      setIsLoading(false);
    }
  };

  const scenePreview = promptMode === 'urai' ? getUraiScenePreview() : getScenePreview();

  // ── Mode selector (dipakai di kedua kondisi) ──
  const ModeSelector = () => (
    <div className="flex flex-col gap-4 p-6 bg-gray-800/50 border border-purple-700 rounded-xl">
      <h2 className="text-2xl font-semibold text-yellow-400 border-b border-purple-700 pb-3">⚙️ Mode Prompt</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
{[
  { id: 'bebas', label: 'Bebas', badge: 'TikTok GO' },
  { id: 'rapi', label: 'Rapi', badge: 'TikTok GO' },
  { id: 'urai', label: 'Urai Skrip', badge: 'TikTok GO' },
  { id: 'skrip-jualan', label: 'Skrip Jualan', badge: 'Produk Affiliate' },
].map(({ id, label, badge }) => (
  <button
    key={id}
    onClick={() => setPromptMode(id as typeof promptMode)}
    className={`py-3 px-2 rounded-lg font-semibold transition-all text-sm leading-tight flex flex-col items-center gap-1 ${promptMode === id ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700/50 text-white hover:bg-gray-700'}`}
  >
    <span>{label}</span>
    <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${promptMode === id ? 'bg-gray-900/20 text-gray-800' : badge === 'Produk Affiliate' ? 'bg-green-900/50 text-green-400' : 'bg-purple-900/50 text-purple-400'}`}>
      {badge}
    </span>
  </button>
))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-zinc-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-purple-500">SoraPrompt TikTok GO & Product Affiliate</h1>
          <p className="text-lg text-purple-300 mt-2">AI pembuat prompt video sinematik untuk konten TikTok GO & Produk Affiliate.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* ── MODE SKRIP JUALAN ── */}
          {promptMode === 'skrip-jualan' ? (
            <>
              <div className="flex flex-col gap-8">
                <ModeSelector />
                <SkripJualanForm
                  onGenerate={handleSkripJualanGenerate}
                  isLoading={isSkripJualanLoading}
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col gap-8"
              >
                <div className="border-b border-purple-700 pb-3">
                  <h2 className="text-2xl font-semibold text-yellow-400">🛒 Hasil Skrip Jualan</h2>
                </div>
                <SkripJualanOutput
                  rawOutput={skripJualanOutput}
                  isLoading={isSkripJualanLoading}
                  loadingText={skripJualanLoadingText}
                />
              </motion.div>
            </>
          ) : (

          /* ── MODE BEBAS / RAPI / URAI (tidak ada perubahan) ── */
          <>
            <div className="flex flex-col gap-8">

              {/* Mode Prompt */}
              <div className="flex flex-col gap-4 p-6 bg-gray-800/50 border border-purple-700 rounded-xl">
                <h2 className="text-2xl font-semibold text-yellow-400 border-b border-purple-700 pb-3">⚙️ Mode Prompt</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
{[
  { id: 'bebas', label: 'Bebas', badge: 'TikTok GO' },
  { id: 'rapi', label: 'Rapi', badge: 'TikTok GO' },
  { id: 'urai', label: 'Urai Skrip', badge: 'TikTok GO' },
  { id: 'skrip-jualan', label: 'Skrip Jualan', badge: 'Produk Affiliate' },
].map(({ id, label, badge }) => (
  <button
    key={id}
    onClick={() => setPromptMode(id as typeof promptMode)}
    className={`py-3 px-2 rounded-lg font-semibold transition-all text-sm leading-tight flex flex-col items-center gap-1 ${promptMode === id ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700/50 text-white hover:bg-gray-700'}`}
  >
    <span>{label}</span>
    <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${promptMode === id ? 'bg-gray-900/20 text-gray-800' : badge === 'Produk Affiliate' ? 'bg-green-900/50 text-green-400' : 'bg-purple-900/50 text-purple-400'}`}>
      {badge}
    </span>
  </button>
))}
                </div>

                {promptMode === 'rapi' && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6 mt-2 pt-4 border-t border-purple-800">
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-purple-300">🎭 Karakter On-Screen</p>
                      <p className="text-xs text-zinc-500 -mt-1">Adegan mana saja karakter terlihat di layar</p>
                      <div className="grid grid-cols-1 gap-2">
                        {characterAppearanceOptions.map(opt => (
                          <button key={opt.id} onClick={() => setCharacterAppearance(opt.id)} className={`flex items-start gap-3 text-left px-4 py-3 rounded-lg border transition-all ${characterAppearance === opt.id ? 'bg-purple-700/50 border-purple-400 text-white' : 'bg-gray-900/40 border-gray-700 text-zinc-400 hover:border-purple-600 hover:text-zinc-200'}`}>
                            <span className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 transition-all ${characterAppearance === opt.id ? 'border-yellow-400 bg-yellow-400' : 'border-gray-500'}`} />
                            <span className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold leading-tight">{opt.label}</span>
                              <span className="text-xs text-zinc-500 leading-snug">{opt.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-purple-300">🗣️ Strategi Dialog</p>
                      <p className="text-xs text-zinc-500 -mt-1">Apakah narasi terus berjalan atau hanya saat karakter on-screen</p>
                      <div className="grid grid-cols-1 gap-2">
                        {dialogStrategyOptions.map(opt => (
                          <button key={opt.id} onClick={() => setDialogStrategy(opt.id)} className={`flex items-start gap-3 text-left px-4 py-3 rounded-lg border transition-all ${dialogStrategy === opt.id ? 'bg-purple-700/50 border-purple-400 text-white' : 'bg-gray-900/40 border-gray-700 text-zinc-400 hover:border-purple-600 hover:text-zinc-200'}`}>
                            <span className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 transition-all ${dialogStrategy === opt.id ? 'border-yellow-400 bg-yellow-400' : 'border-gray-500'}`} />
                            <span className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold leading-tight">{opt.label}</span>
                              <span className="text-xs text-zinc-500 leading-snug">{opt.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-900/60 border border-purple-800/60 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-purple-300 mb-2">📋 Pola per segmen ({segmentDuration} detik = {segmentDuration === '10' ? 5 : 7} adegan):</p>
                      <div className="flex flex-wrap gap-2">
                        {scenePreview.map(({ n, onScreen, hasDialog }) => (
                          <div key={n} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium ${onScreen ? 'bg-purple-800/50 border-purple-500 text-purple-200' : 'bg-gray-800/60 border-gray-600 text-zinc-400'}`}>
                            <span className="font-bold">A{n}</span>
                            <span>{onScreen ? '🎭' : '🎬'}</span>
                            <span className="text-zinc-500">{hasDialog ? '🗣️' : '🔇'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-600">
                        <span>🎭 karakter on-screen</span><span>🎬 visual produk</span><span>🗣️ ada dialog</span><span>🔇 tanpa dialog</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {promptMode === 'urai' && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6 mt-2 pt-4 border-t border-purple-800">
                    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-yellow-400 mb-1">✂️ Cara Kerja Mode Ini</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">Berikan skripmu → AI bertindak sebagai sutradara: menentukan jumlah segmen, membagi dialog ke setiap adegan (~2 detik/adegan), dan merancang visual sinematik. Dialog tidak diubah, hanya dibagi.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-purple-300">🎭 Karakter On-Screen</p>
                      <p className="text-xs text-zinc-500 -mt-1">Adegan mana saja karakter terlihat di layar</p>
                      <div className="grid grid-cols-1 gap-2">
                        {characterAppearanceOptions.map(opt => (
                          <button key={opt.id} onClick={() => setCharacterAppearance(opt.id)} className={`flex items-start gap-3 text-left px-4 py-3 rounded-lg border transition-all ${characterAppearance === opt.id ? 'bg-purple-700/50 border-purple-400 text-white' : 'bg-gray-900/40 border-gray-700 text-zinc-400 hover:border-purple-600 hover:text-zinc-200'}`}>
                            <span className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 transition-all ${characterAppearance === opt.id ? 'border-yellow-400 bg-yellow-400' : 'border-gray-500'}`} />
                            <span className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold leading-tight">{opt.label}</span>
                              <span className="text-xs text-zinc-500 leading-snug">{opt.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-900/60 border border-purple-800/60 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-purple-300 mb-2">📋 Pola per segmen ({segmentDuration} detik = {segmentDuration === '10' ? 5 : 8} adegan, ~2 detik/adegan):</p>
                      <div className="flex flex-wrap gap-2">
                        {scenePreview.map(({ n, onScreen, hasDialog }) => (
                          <div key={n} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium ${onScreen ? 'bg-purple-800/50 border-purple-500 text-purple-200' : 'bg-gray-800/60 border-gray-600 text-zinc-400'}`}>
                            <span className="font-bold">A{n}</span>
                            <span>{onScreen ? '🎭' : '🎬'}</span>
                            <span className="text-zinc-500">{hasDialog ? '🗣️' : '🔇'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-600">
                        <span>🎭 karakter on-screen</span><span>🎬 visual</span><span>🗣️ VO dari skrip</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Input User */}
              <div className="flex flex-col gap-6 p-6 bg-gray-800/50 border border-purple-700 rounded-xl">
                <h2 className="text-2xl font-semibold text-yellow-400 border-b border-purple-700 pb-3">📥 Input User</h2>
                <Select label="Kategori" id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Makanan/Minuman</option>
                  <option>Hotel</option>
                  <option>Tempat Wisata</option>
                </Select>
                <Textarea label="Nama & Deskripsi Singkat" id="nameDesc" value={nameDesc} onChange={(e) => setNameDesc(e.target.value)} placeholder="Contoh: Roti Gembul - roti lembut isi selai coklat lumer..." />
                <Input label="Karakter (kosongkan = faceless)" id="character" value={character} onChange={(e) => setCharacter(e.target.value)} placeholder="Contoh: Pria review makanan, gaya santai" />

                {promptMode !== 'urai' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <Select label="Durasi per Segmen" id="segmentDuration" value={segmentDuration} onChange={(e) => setSegmentDuration(e.target.value)}>
                      <option value="10">10 detik</option>
                      <option value="15">15 detik</option>
                    </Select>
                    <Input label="Total Durasi (detik)" id="totalDuration" type="number" step="5" value={totalDuration} onChange={(e) => setTotalDuration(e.target.value)} placeholder="Contoh: 45" />
                    <Input label="Jumlah Konten" id="contentCount" type="number" min="1" value={contentCount} onChange={(e) => setContentCount(e.target.value)} placeholder="1" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Durasi per Segmen" id="segmentDuration" value={segmentDuration} onChange={(e) => setSegmentDuration(e.target.value)}>
                      <option value="10">10 detik</option>
                      <option value="15">15 detik</option>
                    </Select>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-zinc-400">Adegan per Segmen</label>
                      <div className="flex items-center h-10 px-3 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-zinc-400">
                        {segmentDuration === '10' ? '5 adegan' : '8 adegan'} (~2 dtk/adegan)
                      </div>
                    </div>
                  </div>
                )}

                {promptMode === 'urai' && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2">
                    <label htmlFor="scriptInput" className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
                      ✍️ Skrip / Narasi
                      <span className="text-xs font-normal text-zinc-500">(dijadikan dialog/voice over — tidak diubah)</span>
                    </label>
                    <textarea
                      id="scriptInput"
                      value={scriptInput}
                      onChange={(e) => setScriptInput(e.target.value)}
                      placeholder={`Tulis atau tempel skripmu di sini...\n\nContoh:\n"Hei, aku mau kasih tau rahasia buat dapet harga lebih murah. Klik aja lokasi di bawah, karena lewat situ harganya turun. Ini ayam geprek favoritku — dagingnya tebal, tepungnya krispy banget. Sambel matahnya seger, nggak bikin sakit perut. Porsinya juga gede, cocok banget buat makan siang. Langsung klik lokasi bawah ya, harganya lebih hemat dari datang langsung ke sini!"`}
                      rows={8}
                      className="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y leading-relaxed"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-zinc-600">AI otomatis menentukan jumlah segmen sesuai panjang skrip.</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${scriptInput.trim().split(/\s+/).filter(Boolean).length > 0 ? 'bg-green-900/30 border-green-700/60 text-green-400' : 'bg-gray-800 border-gray-700 text-zinc-600'}`}>
                        {scriptInput.trim().split(/\s+/).filter(Boolean).length} kata
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Gaya Konten */}
              {promptMode !== 'urai' && (
                <div className="flex flex-col gap-4 p-6 bg-gray-800/50 border border-purple-700 rounded-xl">
                  <div className="flex items-center justify-between border-b border-purple-700 pb-3">
                    <h2 className="text-2xl font-semibold text-yellow-400">🎨 Gaya Konten</h2>
                    <span className="text-xs text-purple-300 bg-purple-900/50 px-2 py-1 rounded-full">{activeStyles.length} terpilih · bisa pilih lebih dari 1</span>
                  </div>
                  {activeStyles.length > 1 && (
                    <div className="bg-gray-900/60 border border-purple-800 rounded-lg px-4 py-3">
                      <p className="text-xs text-purple-300 mb-2 font-semibold">📊 Distribusi ke {contentCount} konten:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: Math.min(parseInt(contentCount) || 1, 10) }, (_, i) => {
                          const styleId = activeStyles[i % activeStyles.length];
                          const style = contentStyles.find(s => s.id === styleId);
                          return <span key={i} className="text-xs bg-purple-800/60 text-purple-200 px-2 py-0.5 rounded-full">#{i + 1} {style?.title.split(' ')[0]}</span>;
                        })}
                        {(parseInt(contentCount) || 1) > 10 && <span className="text-xs text-purple-400 italic px-1">+{(parseInt(contentCount) || 1) - 10} lagi...</span>}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contentStyles.map(style => (
                      <StyleButton key={style.id} number={style.number} title={style.title} description={style.description} isActive={activeStyles.includes(style.id)} onClick={() => toggleStyle(style.id)} />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isLoading || (promptMode === 'urai' && !scriptInput.trim())}
                className="w-full bg-gradient-to-r from-yellow-500 to-purple-600 text-white font-bold py-4 rounded-lg text-lg hover:from-yellow-400 hover:to-purple-500 transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Menghasilkan...' : promptMode === 'urai' ? '✂️ Urai Skrip Jadi Prompt' : '✨ Hasilkan Prompt'}
              </button>
              {promptMode === 'urai' && !scriptInput.trim() && !isLoading && (
                <p className="text-xs text-center text-zinc-600 -mt-4">Isi skrip terlebih dahulu untuk mengaktifkan tombol</p>
              )}
            </div>

            {/* Output Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-col gap-8">
              <div className="flex justify-between items-center border-b border-purple-700 pb-3">
                <h2 className="text-2xl font-semibold text-yellow-400">🚀 Hasil Prompt</h2>
                {prompts.length > 0 && (
                  <button onClick={downloadPrompts} className="flex items-center gap-2 text-sm bg-purple-700 text-zinc-300 px-3 py-1.5 rounded-md hover:bg-purple-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download All
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-6">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center h-64 bg-gray-800/50 border border-purple-700 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <p className="text-zinc-400 text-center">{loadingText}</p>
                  </div>
                )}
                {!isLoading && prompts.length === 0 && (
                  <div className="flex items-center justify-center h-64 bg-gray-800/50 border border-dashed border-purple-600 rounded-xl">
                    <p className="text-purple-400 text-center">Hasil prompt akan muncul di sini.</p>
                  </div>
                )}

                {prompts.map((prompt, index) => {
                  const segments = extractSegments(prompt);
                  const showWordCount = promptMode === 'rapi' || promptMode === 'urai';
                  const wordCounts = showWordCount ? getSegmentWordCounts(prompt, segmentDuration, promptMode === 'urai') : [];
                  const hasWarning = (promptWarnings[index]?.length ?? 0) > 0;

                  return (
                    <div key={index} className="flex flex-col gap-3">
                      <div className="relative group">
                        <Textarea id={`prompt-${index}`} value={prompt} onChange={(e) => handlePromptChange(e.target.value, index)} className="h-48" />
                        <button onClick={() => copyPrompt(prompt, index)} className="absolute top-3 right-3 bg-purple-700/80 text-white px-3 py-1.5 rounded-md text-xs transition-all hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-semibold">
                          {copiedIndex === index ? '✓ Tersalin!' : 'Salin Semua'}
                        </button>
                      </div>

                      {showWordCount && wordCounts.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                          {wordCounts.map((wc, wi) => {
                            const isOver = wc.count > wc.max;
                            return (
                              <span key={wi} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${isOver ? 'bg-red-900/40 border-red-600 text-red-300' : 'bg-green-900/30 border-green-700/60 text-green-300'}`}>
                                {isOver ? '⚠️' : '✓'} Seg {wi + 1}: {wc.count}/{wc.max} kata
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {showWordCount && hasWarning && (
                        <div className="bg-yellow-900/30 border border-yellow-600/60 rounded-lg px-4 py-3">
                          <p className="text-xs font-semibold text-yellow-400 mb-1.5">⚠️ Dialog melebihi batas — kemungkinan terpotong di Sora:</p>
                          {promptWarnings[index].map((w, wi) => <p key={wi} className="text-xs text-yellow-300 ml-2">· {w}</p>)}
                          <p className="text-xs text-yellow-500/70 italic mt-2">Edit di kolom teks atau generate ulang.</p>
                        </div>
                      )}

                      {segments.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                          {segments.map((_, segIdx) => {
                            const key = `${index}-${segIdx}`;
                            const isCopied = copiedSegmentKey === key;
                            return (
                              <button key={segIdx} onClick={() => copySegment(prompt, index, segIdx)}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 ${isCopied ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'bg-gray-800 text-zinc-300 border-gray-600 hover:bg-gray-700 hover:border-purple-500 hover:text-white'}`}>
                                {isCopied ? <><span>✓</span><span>Segmen {segIdx + 1} Tersalin!</span></> : <><span>📋</span><span>Salin Segmen {segIdx + 1}</span></>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
          )}
        </main>
      </div>
    </div>
  );
}
