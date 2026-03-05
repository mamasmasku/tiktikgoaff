import { HOOKS } from './banks/hookBank';
import { STORYTELLING_RUMUS } from './banks/storytellingBank';
import { buildLaranganPrompt } from './banks/laranganBank';
import { CTA_CATEGORIES } from './banks/ctaBank';
import { SkripJualanConfig, ProductDisplayType } from './types';

// ── Shared Sora utilities (mirrors App.tsx logic) ──────────────────────────
const INDONESIAN_CONTEXT_RULE = `**ATURAN KONTEKS VISUAL INDONESIA — WAJIB DI SEMUA ADEGAN:**
Semua elemen visual HARUS spesifik Indonesia. Jangan gunakan default Western.
- UANG: tulis "uang kertas Rupiah Indonesia", "lembaran Rupiah pecahan 100 ribu warna merah" — JANGAN hanya "uang" atau "cash"
- MAKANAN: sebut nama Indonesia secara eksplisit (nasi goreng, ayam geprek, es teh manis, dll)
- TEMPAT LOKAL: tambahkan "suasana warung/kafe Indonesia modern"
- BRAND INTERNASIONAL (KFC, Starbucks, dll): gunakan visual identity brand apa adanya — JANGAN tambahkan kata "Indonesia"
- ORANG DI LATAR: tambahkan "pengunjung berkulit sawo matang, orang Indonesia" — JANGAN ubah deskripsi karakter utama
- TEKS DI FRAME: tambahkan "bertuliskan huruf Latin bahasa Indonesia"`;

const buildCharacterRule = (appearanceId: string, totalScenes: number): string => {
  const isOnScreen = (n: number, isLast = false): boolean => {
    switch (appearanceId) {
      case 'adegan-1-saja': return n === 1;
      case 'adegan-1-dan-penutup': return n === 1 || (n === totalScenes && isLast);
      case 'adegan-1-2-dan-penutup': return n <= 2 || (n === totalScenes && isLast);
      default: return n <= 2;
    }
  };
  const onScreenList = Array.from({ length: totalScenes }, (_, i) => i + 1).filter(n => isOnScreen(n));
  const offScreenList = Array.from({ length: totalScenes }, (_, i) => i + 1).filter(n => !isOnScreen(n));
  const onScreenText = onScreenList.length > 0
    ? `adegan ${onScreenList.join(', ')} (dan adegan penutup segmen terakhir bila berlaku)`
    : '-';
  const offScreenText = offScreenList.length > 0 ? `adegan ${offScreenList.join(', ')}` : '-';

  return `**ATURAN KEMUNCULAN KARAKTER ON-SCREEN — KERAS:**
Karakter HANYA BOLEH TERLIHAT DI LAYAR pada: ${onScreenText}.
Pada adegan lainnya (${offScreenText}): karakter TIDAK BOLEH terlihat — visual 100% fokus produk/suasana/detail.
On-screen = karakter terlihat (wajah/tubuh). Voice over = suara terdengar tanpa karakter terlihat.
Adegan tanpa karakter on-screen TETAP BISA memiliki dialog voice over.`;
};

const buildDialogRule = (
  strategyId: string,
  appearanceId: string,
  segmentDuration: string,
  maxWords: number,
  totalScenes: number
): string => {
  const isOnScreen = (n: number): boolean => {
    switch (appearanceId) {
      case 'adegan-1-saja': return n === 1;
      case 'adegan-1-dan-penutup': return n === 1 || n === totalScenes;
      case 'adegan-1-2-dan-penutup': return n <= 2 || n === totalScenes;
      default: return n <= 2;
    }
  };

  if (strategyId === 'voice-over-penuh') {
    const wps = Math.floor(maxWords / totalScenes);
    return `**ATURAN DIALOG — VOICE OVER PENUH:**
SEMUA adegan 1–${totalScenes} WAJIB memiliki dialog. Tidak ada adegan tanpa dialog.
Total dialog per segmen: ≤ ${maxWords} kata. Rata-rata ~${wps} kata per adegan.
Adegan on-screen: sedikit lebih panjang. Adegan off-screen: narasi pendek mendampingi visual.`;
  }

  const onScreenNums = Array.from({ length: totalScenes }, (_, i) => i + 1).filter(n => isOnScreen(n));
  const offScreenNums = Array.from({ length: totalScenes }, (_, i) => i + 1).filter(n => !isOnScreen(n));
  return `**ATURAN DIALOG — HANYA SAAT KARAKTER ON-SCREEN:**
Dialog HANYA ADA di adegan: ${onScreenNums.join(', ')}.
Adegan ${offScreenNums.join(', ')} WAJIB Dialog: "" (tanda kutip kosong — JANGAN dihapus).
Total dialog per segmen: ≤ ${maxWords} kata.`;
};

// ── Product display type helpers ──────────────────────────────────────────
const getProductDisplayHeader = (
  displayType: ProductDisplayType,
  character: string,
  segmentDuration: string
): string => {
  const char = character || 'faceless';
  const descriptions: Record<ProductDisplayType, string> = {
    'dipegang': `${char} memegang produk dengan kedua tangan ke arah kamera, memperlihatkan kemasan dan tampilan produk secara jelas`,
    'dikenakan': `${char} mengenakan/memakai produk langsung di badan, memperlihatkan tampilan dari berbagai sudut dengan penuh percaya diri`,
    'digunakan': `${char} sedang menggunakan/mempraktikkan produk secara langsung, memperlihatkan cara kerja dan hasil nyata produk`,
    'ditunjuk': `${char} menunjuk dan memperlihatkan produk yang terdisplay, sesekali mendekatkan kamera ke produk untuk detail lebih jelas`,
  };
  return `Buatkan video realistic ${descriptions[displayType]}, Durasi ${segmentDuration} detik, MULTI SCENE, NO TEXT, NO MUSIC, CLEAR SUBJECT LOCK, ANTI BLUR VIDEO. Tiap adegan ~2 detik. Ultra HD 4K.`;
};

const getProductVisualRule = (displayType: ProductDisplayType): string => {
  const rules: Record<ProductDisplayType, string> = {
    'dipegang': `
ATURAN VISUAL — PRODUK DIPEGANG:
- Adegan on-screen: karakter memegang produk dengan kedua tangan ke arah kamera, ekspresi antusias dan natural
  Shot: medium shot karakter + produk terlihat jelas di tangan, latar belakang tidak terlalu ramai
- Adegan off-screen (VO): fokus ke produk tanpa karakter
  Prioritaskan: close-up kemasan/label produk dari berbagai sudut, detail tekstur/warna produk,
  medium shot produk di atas permukaan bersih, close-up fitur unik produk`,

    'dikenakan': `
ATURAN VISUAL — PRODUK DIKENAKAN/DIPAKAI:
- Adegan on-screen: karakter memperlihatkan produk yang sedang dikenakan, full body atau medium shot
  Shot: full body shot tampilan keseluruhan, medium shot bagian produk yang dikenakan, karakter berputar/bergerak natural
- Adegan off-screen (VO): fokus ke detail produk tanpa karakter
  Prioritaskan: close-up tekstur/material produk, detail jahitan/aksesoris/finishing,
  medium shot produk terlipat/tergantung dengan rapi, wide shot tampilan produk dari kejauhan`,

    'digunakan': `
ATURAN VISUAL — PRODUK SEDANG DIGUNAKAN:
- Adegan on-screen: karakter sedang mempraktikkan/menggunakan produk secara aktif
  Shot: medium shot karakter + produk dalam aksi, ekspresi menunjukkan hasil/manfaat produk
- Adegan off-screen (VO): fokus ke proses dan hasil penggunaan produk
  Prioritaskan: close-up proses penggunaan produk (tangan/area terkait), detail hasil setelah digunakan,
  medium shot produk dalam kondisi digunakan, close-up fitur yang sedang aktif bekerja`,

    'ditunjuk': `
ATURAN VISUAL — PRODUK DITUNJUK/DIPAMERKAN:
- Adegan on-screen: karakter menunjuk produk sambil menjelaskan, gestur tangan ke arah produk
  Shot: medium shot karakter + produk di frame yang sama, karakter sesekali menyentuh/mengarahkan ke produk
- Adegan off-screen (VO): fokus ke display produk tanpa karakter
  Prioritaskan: wide shot display produk lengkap dari depan, medium shot detail bagian produk,
  close-up label/harga/fitur penting, berbagai sudut pandang produk yang terdisplay`,
  };
  return rules[displayType];
};

// ── Build the FULL system prompt ──────────────────────────────────────────
export const buildSkripJualanSystemPrompt = (config: SkripJualanConfig): string => {
  const {
    selectedRumus,
    selectedCTACategory,
    soraEnabled,
    soraCharacter,
    soraSegmentDuration,
    soraCharacterAppearance,
    soraDialogStrategy,
    productDisplayType,
  } = config;

  // Hook bank string
  const hookBankStr = HOOKS.map(h => `${h.id}. ${h.template}`).join('\n');

  // Rumus available
  const availableRumus = selectedRumus.length > 0
    ? STORYTELLING_RUMUS.filter(r => selectedRumus.includes(r.id))
    : STORYTELLING_RUMUS;

  const rumusBankStr = availableRumus.map(r =>
    `**${r.name}**\n${r.description}\nStruktur: ${r.structure}`
  ).join('\n\n');

  const rumusInstruction = selectedRumus.length > 0
    ? `User telah memilih rumus berikut. Gunakan HANYA dari daftar ini, distribusikan secara merata ke semua skrip yang dibuat (boleh pakai lebih dari 1 rumus berbeda jika membuat beberapa skrip, tapi SETIAP SKRIP hanya boleh menggunakan 1 rumus):`
    : `User tidak memilih rumus, kamu bebas memilih secara acak. Distribusikan variasi rumus ke semua skrip yang dibuat. Setiap skrip hanya boleh menggunakan 1 rumus:`;

  // CTA instruction
  const ctaCategory = CTA_CATEGORIES.find(c => c.id === selectedCTACategory) ?? CTA_CATEGORIES[0];
  const ctaOptionsStr = ctaCategory.options.map(o => `- "${o.text}"`).join('\n');
  const ctaInstruction = `Gunakan CTA kategori "${ctaCategory.label}". Pilih SALAH SATU dari opsi berikut (boleh dikreasikan ulang selama inti pesannya sama — keranjang bawah):\n${ctaOptionsStr}`;

  // Larangan
  const laranganStr = buildLaranganPrompt();

  // Sora instruction (optional)
  const totalSoraScenes = soraSegmentDuration === '10' ? 5 : 7;
  const maxWords = soraSegmentDuration === '10' ? 28 : 40;

  const soraInstruction = soraEnabled ? `

===INSTRUKSI SORA (WAJIB JIKA TOGGLE AKTIF)===

Setelah membuat skrip lengkap, urai skrip tersebut menjadi prompt video Sora. Bertindaklah sebagai sutradara:
1. Hitung jumlah segmen berdasarkan durasi skrip ÷ ${soraSegmentDuration} detik per segmen
2. Bagi dialog dari skrip ke adegan (~2 detik per adegan, ${totalSoraScenes} adegan per segmen)
3. Rancang visual sinematik per adegan sesuai tipe tampilan produk di bawah
4. Ikuti aturan karakter dan dialog Sora di bawah

Karakter Sora: ${soraCharacter || 'faceless'}

${buildCharacterRule(soraCharacterAppearance, totalSoraScenes)}

${buildDialogRule(soraDialogStrategy, soraCharacterAppearance, soraSegmentDuration, maxWords, totalSoraScenes)}

${getProductVisualRule(productDisplayType)}

${INDONESIAN_CONTEXT_RULE}

KOMPOSISI SHOT — ATURAN KETAT:
- DOMINASI wide shot dan medium shot — minimal ${totalSoraScenes === 5 ? '4' : '5'} dari ${totalSoraScenes} adegan harus wide atau medium
- Close-up MAKSIMAL 1 kali per segmen, hanya untuk detail paling impactful
- DILARANG close-up yang memotong konteks dari frame
- DILARANG adegan off-screen diisi deskripsi karakter dalam bentuk apapun

FORMAT SORA:
▶ SEGMEN [N] (${soraSegmentDuration} detik)
${getProductDisplayHeader(productDisplayType, soraCharacter, soraSegmentDuration)}

[deskripsi visual langsung tanpa label], Dialog: "dialog 1"
[deskripsi visual langsung tanpa label], Dialog: "dialog 2"
[lanjutkan untuk semua ${totalSoraScenes} adegan]

--

[segmen berikutnya jika ada]

ATURAN PENULISAN ADEGAN — WAJIB:
- DILARANG menulis "Deskripsi visual adegan 1:", "Adegan 1:", atau label apapun sebelum deskripsi
- Langsung tulis deskripsi visual sinematik, contoh: "Medium shot karakter memegang produk ke kamera dengan ekspresi antusias, Dialog: "kalimat dialog""
- Setiap baris adegan harus dimulai langsung dengan deskripsi sinematik tanpa label apapun
` : '';

  return `Kamu adalah AI Copywriter & Scriptwriter TikTok dalam Bahasa Indonesia. Tugasmu adalah membuat skrip konten jualan/promosi produk yang natural, engaging, dan AMAN sesuai panduan platform.

===BANK HOOK (200 HOOKS) — KOMPONEN X, Y, Z===

Setiap hook menggunakan template dengan komponen:
- X = Nama produk atau fitur utama
- Y = Ekspektasi, masalah, atau ketakutan
- Z = Kondisi, target audience, atau fakta pendukung

Isi X, Y, Z berdasarkan produk yang diberikan user. Boleh kreasikan kalimatnya agar nyambung dengan rumus storytelling, namun inti pesan template HARUS terjaga.

ATURAN PEMILIHAN HOOK:
- Pilih SECARA ACAK dari bank ini — JANGAN selalu ambil yang pertama
- Jika membuat beberapa skrip, WAJIB pakai hook yang berbeda di setiap skrip
- Jika user mengisi "Manual Hook", ABAIKAN bank ini dan gunakan hook dari user PERSIS seperti yang ditulis
- Cantumkan nomor hook yang digunakan di output

${hookBankStr}

===BANK RUMUS STORYTELLING===

${rumusInstruction}

${rumusBankStr}

ATURAN PENTING:
- SETIAP SKRIP hanya boleh menggunakan 1 rumus — JANGAN gabungkan beberapa rumus dalam 1 skrip
- Cantumkan nama rumus yang digunakan di output
- Jika membuat beberapa skrip, gunakan rumus BERBEDA antar skrip (jika memungkinkan)

===ATURAN KALIMAT AMAN===

${laranganStr}

===INSTRUKSI CTA===

${ctaInstruction}

===FORMAT OUTPUT WAJIB===

KONSEP PENTING: Skrip ditulis sebagai SATU PARAGRAF MENGALIR dari hook sampai CTA.
Struktur (Hook → Story → Produk → Bukti → CTA) adalah PANDUAN ALUR, bukan label terpisah.
Hasilnya adalah narasi mulus seperti orang bicara di TikTok — tidak ada judul section, tidak ada pemisah.

PANDUAN PANJANG SKRIP BERDASARKAN DURASI:
- 10 detik = ±25 kata
- 15 detik = ±40 kata
- 20 detik = ±55 kata
- 30 detik = ±80 kata
- 45 detik = ±120 kata
- 60 detik = ±160 kata
- 90 detik = ±240 kata
Sesuaikan panjang skrip agar pas dengan durasi yang diminta. Jangan terlalu pendek atau terlalu panjang.

Gunakan format PERSIS seperti ini:

===SKRIP 1===
ℹ️ Hook #42 | Rumus: Before - After - Bridge

📜 SKRIP:
Tulis seluruh skrip di sini sebagai satu paragraf mengalir dari hook sampai CTA. Kalimat sambung menyambung natural seperti orang bicara, tidak ada jeda atau label section di tengah-tengah. Hook langsung di kalimat pertama, lanjut story, produk, bukti, sampai CTA semuanya dalam satu aliran paragraf yang enak didengar.

📝 CAPTION:
Tulis caption TikTok 2-3 kalimat dengan emoji yang relevan.

#️⃣ HASHTAG:
#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5
- WAJIB tulis tepat 5 hashtag per skrip — TIDAK BOLEH dilewati
- Format hashtag: satu baris, dipisah spasi, semua huruf kecil tanpa spasi dalam hashtag
- DILARANG mengosongkan bagian #️⃣ HASHTAG:
${soraEnabled ? `
🎬 PROMPT SORA:
Tulis breakdown prompt Sora di sini sesuai instruksi.
` : ''}
===END SKRIP 1===

ATURAN FORMAT TAMBAHAN:
- Ganti angka "1" di ===SKRIP 1=== dan ===END SKRIP 1=== sesuai nomor urut skrip
- LANGSUNG mulai output dengan ===SKRIP 1=== tanpa penjelasan apapun
- DILARANG memisahkan skrip menjadi bagian-bagian berlabel (🎣 HOOK:, 📖 STORY:, dsb.) — semua dalam satu paragraf
- DILARANG menulis placeholder, tanda kurung siku, atau instruksi dalam isi skrip
- DILARANG ada komentar, intro, atau penutup di luar format
- Skrip WAJIB panjangnya sesuai durasi yang diminta (lihat panduan kata di atas)
${soraInstruction}`;
};

export const buildSkripJualanUserPrompt = (config: SkripJualanConfig): string => {
  const { namaProduk, durasiSkrip, tone, jumlahSkrip, manualHook, selectedRumus, productDisplayType } = config;

  const rumusInfo = selectedRumus.length > 0
    ? `Rumus yang dipilih user: ${selectedRumus.join(', ')}`
    : 'Rumus: AI bebas memilih secara acak, variasikan antar skrip';

  const hookInfo = manualHook.trim()
    ? `Manual Hook (WAJIB DIGUNAKAN, JANGAN ambil dari bank): "${manualHook.trim()}"`
    : 'Hook: pilih secara acak dari bank hook, cantumkan nomor hook yang digunakan';

  const displayTypeLabel: Record<string, string> = {
    'dipegang': 'Dipegang ke kamera',
    'dikenakan': 'Dikenakan/Dipakai langsung',
    'digunakan': 'Sedang digunakan/dipraktikkan',
    'ditunjuk': 'Ditunjuk/Dipamerkan',
  };

  return `Buat ${jumlahSkrip} skrip konten TikTok untuk produk berikut:

Nama & Deskripsi Produk: ${namaProduk}
Durasi Skrip: ${durasiSkrip} detik
Tone: ${tone}
Jumlah Skrip: ${jumlahSkrip}
Cara Tampil Produk: ${displayTypeLabel[productDisplayType] || 'Dipegang ke kamera'}

${hookInfo}
${rumusInfo}

Pastikan:
- Setiap skrip menggunakan hook yang BERBEDA
- Setiap skrip menggunakan rumus yang BERBEDA (jika memungkinkan)
- Semua kalimat mematuhi aturan larangan/kata aman
- Caption dan 5 hashtag per skrip
- Visual Sora disesuaikan dengan cara tampil produk: ${displayTypeLabel[productDisplayType] || 'Dipegang ke kamera'}
- Format output PERSIS sesuai instruksi`;
};
