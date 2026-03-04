import { useState, useMemo } from 'react';
import { ParsedSkrip, CopiedKey } from '../types';

function parseSkrip(raw: string): ParsedSkrip[] {
  const blocks = [...raw.matchAll(/===SKRIP (\d+)===([\s\S]*?)===END SKRIP \1===/g)];
  if (blocks.length === 0) return [];

  return blocks.map((match, idx) => {
    const block = match[2];

    const infoMatch = block.match(/ℹ️ Hook #(\S+)\s*\|\s*Rumus:\s*(.+)/);
    const hookNumber = infoMatch?.[1]?.trim() ?? '?';
    const rumusName = infoMatch?.[2]?.trim() ?? '?';

    const skripMatch = block.match(/📜 SKRIP:\s*([\s\S]*?)(?=📝 CAPTION|#️⃣ HASHTAG|🎬 PROMPT SORA|===END)/);
    const captionMatch = block.match(/📝 CAPTION:\s*([\s\S]*?)(?=#️⃣|🎬|===END)/);
    const hashtagMatch = block.match(/(?:#️⃣\s*)?HASHTAG:\s*([\s\S]*?)(?=🎬|===END)/);
    const soraMatch = block.match(/🎬 PROMPT SORA:\s*([\s\S]*)/);

    return {
      index: idx + 1,
      hookNumber,
      rumusName,
      hook: skripMatch?.[1]?.trim() ?? '',
      story: '',
      produk: '',
      bukti: '',
      cta: '',
      caption: captionMatch?.[1]?.trim() ?? '',
      hashtags: hashtagMatch?.[1]?.trim() ?? '',
      soraPrompt: soraMatch?.[1]?.trim(),
    };
  });
}

const extractSoraSegments = (soraText: string): string[] =>
  soraText.split(/(?=▶ SEGMEN)/).filter(s => s.trim().startsWith('▶ SEGMEN'));

interface Props {
  rawOutput: string;
  isLoading: boolean;
  loadingText: string;
}

export default function SkripJualanOutput({ rawOutput, isLoading, loadingText }: Props) {
  const [copiedKey, setCopiedKey] = useState<CopiedKey | null>(null);
  const [expandedSora, setExpandedSora] = useState<Record<number, boolean>>({});
  const [copiedSoraSegment, setCopiedSoraSegment] = useState<string | null>(null);
  // ✅ State untuk menyimpan hasil edit sora per skrip index
  const [editedSora, setEditedSora] = useState<Record<number, string>>({});

  const parsed = useMemo(() => parseSkrip(rawOutput), [rawOutput]);

  // Ambil teks sora terkini (edited atau original)
  const getSoraText = (s: ParsedSkrip): string =>
    editedSora[s.index] !== undefined ? editedSora[s.index] : (s.soraPrompt ?? '');

  const handleCopy = (text: string, key: CopiedKey) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copySoraSegment = (text: string, key: string) => {
    const withoutHeader = text.trim().replace(/^▶ SEGMEN \d+ \(\d+ detik\)\n?/, '').trim();
    navigator.clipboard.writeText(withoutHeader);
    setCopiedSoraSegment(key);
    setTimeout(() => setCopiedSoraSegment(null), 2000);
  };

  const buildFullSkrip = (s: ParsedSkrip): string =>
    [s.hook, s.caption ? `📝 CAPTION:\n${s.caption}` : '', s.hashtags ? `#️⃣ HASHTAG:\n${s.hashtags}` : '']
      .filter(Boolean).join('\n\n');

  const downloadAll = () => {
    if (parsed.length === 0) return;
    const content = parsed.map(s => {
      const soraText = getSoraText(s);
      let text = `${'═'.repeat(50)}\nSKRIP #${s.index} — Hook #${s.hookNumber} | Rumus: ${s.rumusName}\n${'═'.repeat(50)}\n\n${buildFullSkrip(s)}`;
      if (soraText) text += `\n\n🎬 PROMPT SORA:\n${soraText}`;
      return text;
    }).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'skrip-jualan.txt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-800/50 border border-purple-700 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          {[0, 0.2, 0.4].map((delay, i) => (
            <div key={i} className="w-3 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: `${delay}s` }} />
          ))}
        </div>
        <p className="text-zinc-400 text-center">{loadingText}</p>
      </div>
    );
  }

  if (parsed.length === 0 && !rawOutput) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-800/50 border border-dashed border-purple-600 rounded-xl">
        <p className="text-purple-400 text-center">Skrip jualan akan muncul di sini.</p>
      </div>
    );
  }

  if (parsed.length === 0 && rawOutput) {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-yellow-900/30 border border-yellow-600/60 rounded-lg px-4 py-3">
          <p className="text-xs text-yellow-400 font-semibold">⚠️ Format tidak terbaca. Raw output:</p>
        </div>
        <textarea readOnly value={rawOutput} className="w-full h-64 bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-3 text-sm text-zinc-300 resize-y" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{parsed.length} skrip berhasil dibuat</p>
        <button onClick={downloadAll} className="flex items-center gap-2 text-sm bg-purple-700 text-zinc-300 px-3 py-1.5 rounded-md hover:bg-purple-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download All
        </button>
      </div>

      {parsed.map(s => (
        <div key={s.index} className="flex flex-col gap-4 p-5 bg-gray-800/40 border border-purple-700/60 rounded-xl">

          {/* Header */}
          <div className="flex items-start justify-between border-b border-purple-800/60 pb-3">
            <div>
              <h3 className="text-base font-bold text-yellow-400">🛒 Skrip #{s.index}</h3>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="text-xs bg-blue-900/40 border border-blue-700/60 text-blue-300 px-2.5 py-1 rounded-full font-medium">Hook #{s.hookNumber}</span>
                <span className="text-xs bg-purple-900/40 border border-purple-700/60 text-purple-300 px-2.5 py-1 rounded-full font-medium">{s.rumusName}</span>
              </div>
            </div>
            <button
              onClick={() => handleCopy(buildFullSkrip(s), `full-${s.index}` as CopiedKey)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${copiedKey === `full-${s.index}` ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-zinc-300 border-gray-600 hover:bg-gray-600'}`}
            >
              {copiedKey === `full-${s.index}` ? '✓ Tersalin' : '📋 Salin Semua'}
            </button>
          </div>

          {/* Skrip */}
          {s.hook && (
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-purple-900/20 border border-purple-600/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-300 tracking-wider">📜 SKRIP</span>
                <button
                  onClick={() => handleCopy(s.hook, `hook-${s.index}` as CopiedKey)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${copiedKey === `hook-${s.index}` ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-zinc-300 border-gray-600 hover:bg-gray-600'}`}
                >
                  {copiedKey === `hook-${s.index}` ? '✓ Tersalin' : 'Salin'}
                </button>
              </div>
              <p className="text-sm text-zinc-100 leading-relaxed">{s.hook}</p>
            </div>
          )}

          {/* Caption */}
          {s.caption && (
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-gray-900/40 border border-gray-700/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 tracking-wider">📝 CAPTION</span>
                <button
                  onClick={() => handleCopy(s.caption, `caption-${s.index}` as CopiedKey)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${copiedKey === `caption-${s.index}` ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-zinc-300 border-gray-600 hover:bg-gray-600'}`}
                >
                  {copiedKey === `caption-${s.index}` ? '✓ Tersalin' : 'Salin'}
                </button>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed">{s.caption}</p>
            </div>
          )}

          {/* Hashtag */}
          {s.hashtags && (
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-gray-900/40 border border-gray-700/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 tracking-wider">#️⃣ HASHTAG</span>
                <button
                  onClick={() => handleCopy(s.hashtags, `hashtag-${s.index}` as CopiedKey)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${copiedKey === `hashtag-${s.index}` ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-zinc-300 border-gray-600 hover:bg-gray-600'}`}
                >
                  {copiedKey === `hashtag-${s.index}` ? '✓ Tersalin' : 'Salin'}
                </button>
              </div>
              <p className="text-sm text-blue-300 leading-relaxed">{s.hashtags}</p>
            </div>
          )}

          {/* Sora Prompt */}
          {s.soraPrompt && (
            <div className="flex flex-col gap-2 border-t border-purple-800/40 pt-3">
              <button
                onClick={() => setExpandedSora(prev => ({ ...prev, [s.index]: !prev[s.index] }))}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-xs font-bold text-purple-300">🎬 PROMPT SORA</span>
                <span className="text-xs text-zinc-500">{expandedSora[s.index] ? '▲ Tutup' : '▼ Tampilkan'}</span>
              </button>

              {expandedSora[s.index] && (
                <div className="flex flex-col gap-3">

                  {/* Baris atas: info edit + tombol reset + salin semua */}
                  <div className="flex items-center justify-between">
                    {editedSora[s.index] !== undefined ? (
                      <button
                        onClick={() => setEditedSora(prev => {
                          const next = { ...prev };
                          delete next[s.index];
                          return next;
                        })}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        ↩ Reset ke semula
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600 italic">✏️ Klik teks di bawah untuk mengedit</span>
                    )}
                    <button
                      onClick={() => handleCopy(getSoraText(s), `sora-${s.index}` as CopiedKey)}
                      className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${copiedKey === `sora-${s.index}` ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-zinc-300 border-gray-600 hover:bg-gray-600'}`}
                    >
                      {copiedKey === `sora-${s.index}` ? '✓ Tersalin' : 'Salin Semua Sora'}
                    </button>
                  </div>

                  {/* Tombol copy per segmen — pakai teks yang sudah diedit */}
                  {(() => {
                    const segments = extractSoraSegments(getSoraText(s));
                    return segments.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {segments.map((seg, segIdx) => {
                          const key = `sora-seg-${s.index}-${segIdx}`;
                          const isCopied = copiedSoraSegment === key;
                          return (
                            <button
                              key={segIdx}
                              onClick={() => copySoraSegment(seg, key)}
                              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 ${isCopied ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'bg-gray-800 text-zinc-300 border-gray-600 hover:bg-gray-700 hover:border-purple-500 hover:text-white'}`}
                            >
                              {isCopied ? (
                                <><span>✓</span><span>Segmen {segIdx + 1} Tersalin!</span></>
                              ) : (
                                <><span>📋</span><span>Salin Segmen {segIdx + 1}</span></>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}

                  {/* ✅ Textarea yang bisa diedit langsung */}
                  <textarea
                    value={getSoraText(s)}
                    onChange={e => setEditedSora(prev => ({ ...prev, [s.index]: e.target.value }))}
                    rows={12}
                    className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-4 py-3 text-xs text-zinc-300 font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    spellCheck={false}
                  />

                </div>
              )}
            </div>
          )}

        </div>
      ))}
    </div>
  );
}
