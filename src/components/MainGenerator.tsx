import React, { useState, useEffect, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export default function MainGenerator({ user }: { user: any }) {
    const [requirements, setRequirements] = useState('');
    const [prompts, setPrompts] = useState<any[]>([]);
    const [constraints, setConstraints] = useState<any[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState('');
    const [selectedConstraintIds, setSelectedConstraintIds] = useState<string[]>([]);

    const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
    const [isCopied, setIsCopied] = useState(false);

    const [jsonResult, setJsonResult] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [parsedResult, setParsedResult] = useState<{ newRequirements: string; considerations: any[] } | null>(null);

    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/generate/config');
                if (res.ok) {
                    const data = await res.json();
                    setPrompts(data.prompts || []);
                    setConstraints(data.constraints || []);
                    if (data.prompts?.length > 0) {
                        setSelectedPromptId(data.prompts[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to load constraints/prompts');
            }
        };
        fetchConfig();
    }, []);

    const groupedConstraints = useMemo(() => {
        return constraints.reduce((acc, curr) => {
            const key = [curr.mainCategory ?? curr.main_category, curr.subCategory ?? curr.sub_category].filter(Boolean).join(' / ') || 'Uncategorized';
            (acc[key] = acc[key] || []).push(curr);
            return acc;
        }, {} as Record<string, any[]>);
    }, [constraints]);

    const handleToggleConstraint = (id: string) => {
        setSelectedConstraintIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleGeneratePrompt = () => {
        if (!requirements || !selectedPromptId) return;

        const promptTemplate = prompts.find(p => p.id === selectedPromptId)?.content || '';
        const selectedDescriptions = constraints.filter(c => selectedConstraintIds.includes(c.id)).map(c => c.description);
        const constraintsText = selectedDescriptions.join(', ');
        const filledTemplate = promptTemplate
            .replace(/{{\s*constraints\s*}}/g, constraintsText)
            .replace(/{{\s*old_requirements\s*}}/g, requirements);

        const promptText = `
以下の要件と制約に基づき、設計の検討内容と新しいシステム要件を生成してください。

【プロンプト】
${filledTemplate}

出力は必ず以下のJSONスキーマに従うこと。
\`\`\`json
{
  "newRequirements": "Markdown形式の要件定義テキスト",
  "considerations": [
    {
      "type": "trade-off または biz-design",
      "title": "検討内容のタイトル",
      "content": "詳細な検討内容"
    }
  ]
}
\`\`\`
`.trim();

        setGeneratedPrompt(promptText);

        // クリップボードへコピー
        navigator.clipboard.writeText(promptText)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 3000);
            })
            .catch((err) => {
                console.error('Failed to copy text: ', err);
                alert('クリップボードへのコピーに失敗しました。手動でコピーしてください。');
            });
    };

    const handleJsonPaste = (text: string) => {
        setJsonResult(text);
        if (!text.trim()) {
            setParsedResult(null);
            setJsonError('');
            return;
        }

        try {
            // MarkDown形式のJSONコードブロックとして貼り付けられた場合の除去処理
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
            }

            const parsed = JSON.parse(cleanText);

            // Zodなどのスキーマ検証がないため手動バリデーション
            if (typeof parsed !== 'object' || parsed === null) {
                throw new Error('ルート要素はJSONオブジェクトである必要があります');
            }
            if (typeof parsed.newRequirements !== 'string') {
                throw new Error('newRequirements キーが存在しないか型が不正です (文字列が必要)');
            }
            if (!Array.isArray(parsed.considerations)) {
                throw new Error('considerations キーが存在しないか型が不正です (配列が必要)');
            }

            for (let i = 0; i < parsed.considerations.length; i++) {
                const c = parsed.considerations[i];
                if (!c.type || !['trade-off', 'biz-design'].includes(c.type)) {
                    throw new Error(`considerations[${i}].type が不正です ("trade-off" または "biz-design" が必要)`);
                }
                if (typeof c.title !== 'string') {
                    throw new Error(`considerations[${i}].title が不正です (文字列が必要)`);
                }
                if (typeof c.content !== 'string') {
                    throw new Error(`considerations[${i}].content が不正です (文字列が必要)`);
                }
            }

            setParsedResult(parsed);
            setJsonError('');
        } catch (err: any) {
            setParsedResult(null);
            setJsonError(`JSONパース・検証エラー: ${err.message || '形式が正しくありません'}`);
        }
    };

    const handleGeneratePDF = async () => {
        if (!parsedResult) return;
        setIsPdfGenerating(true);

        try {
            // 1. Doc Content Hash生成 (ドキュメントの内容に紐づく一意なハッシュ・検証ID用)
            const selectedDescriptions = constraints.filter(c => selectedConstraintIds.includes(c.id)).map(c => c.description);
            const textToHash = requirements + selectedDescriptions.join('') + parsedResult.newRequirements;
            const docHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(textToHash));
            const docHash = Array.from(new Uint8Array(docHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);

            // 2. PDFの作成
            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);

            const fontRes = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf');
            if (!fontRes.ok) throw new Error('Font download failed');
            const fontBytes = await fontRes.arrayBuffer();
            const customFont = await pdfDoc.embedFont(fontBytes);

            const wrapText = (text: string, maxWidth: number, fontSize: number) => {
                return text.split('\n').reduce((acc, line) => {
                    let currentLine = '';
                    for (const char of line) {
                        const testLine = currentLine + char;
                        const width = customFont.widthOfTextAtSize(testLine, fontSize);
                        if (width > maxWidth && currentLine.length > 0) {
                            acc.push(currentLine);
                            currentLine = char;
                        } else {
                            currentLine = testLine;
                        }
                    }
                    acc.push(currentLine);
                    return acc;
                }, [] as string[]);
            };

            let page = pdfDoc.addPage();
            const { width, height } = page.getSize();
            let y = height - 50;

            const drawText = (text: string, size: number) => {
                const lines = wrapText(text, width - 100, size);
                for (const line of lines) {
                    if (y < 50) {
                        page = pdfDoc.addPage();
                        y = height - 50;
                        page.drawText(`Verification Hash (Doc): ${docHash}`, { x: 50, y: 30, size: 8, font: customFont });
                    }
                    page.drawText(line, { x: 50, y, size, font: customFont });
                    y -= size + 5;
                }
                y -= 10;
            };

            page.drawText(`Verification Hash (Doc): ${docHash}`, { x: 50, y: 30, size: 8, font: customFont });

            drawText('リアルウォール：アーキテクチャ・要件検討書', 18);
            drawText(`発行日: ${new Date().toLocaleDateString('ja-JP')}`, 10);
            drawText('----------------------------------------------------', 12);

            drawText('■ 元の要件', 14);
            drawText(requirements, 12);

            drawText('■ 適用されたシステム制約', 14);
            selectedDescriptions.forEach(d => drawText(`・ ${d}`, 10));

            drawText('----------------------------------------------------', 12);
            drawText('■ 生成された新要件 (New Requirements)', 14);
            drawText(parsedResult.newRequirements, 12);

            if (parsedResult.considerations && parsedResult.considerations.length > 0) {
                drawText('----------------------------------------------------', 12);
                drawText('■ アーキテクチャ・ビジネス上の検討事項 (Considerations)', 14);
                parsedResult.considerations.forEach(c => {
                    drawText(`[${c.type.toUpperCase()}] ${c.title}`, 12);
                    drawText(c.content, 10);
                });
            }

            const pdfFinalBytes = await pdfDoc.save();

            // 3. 真正性担保: 完成版PDFバイナリ全体の File Hash を計算
            const fileHashBuffer = await crypto.subtle.digest('SHA-256', pdfFinalBytes);
            const fileHash = Array.from(new Uint8Array(fileHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            // 4. APIにハッシュを送ってDBに保存 (ログ登録)
            const saveRes = await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfHash: fileHash, considerations: parsedResult.considerations })
            });

            if (saveRes.ok) {
                const blob = new Blob([pdfFinalBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Spec_${docHash}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert('PDFハッシュのサーバー保存に失敗しました。');
            }

        } catch (err) {
            console.error(err);
            alert('PDF作成中にエラーが発生しました');
        } finally {
            setIsPdfGenerating(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-[calc(100vh-4rem)] p-6 pt-20">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_160px_minmax(340px,1fr)] gap-6 items-stretch">
                {/* ===== 左カラム: 入力と制約選択 ===== */}
                <div className="flex flex-col space-y-6 min-w-0">

                    {/* プロンプトと要件 */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-teal-500 pl-3">事前準備・要件の入力</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">適用するプロンプトマスター</label>
                            <select
                                value={selectedPromptId}
                                onChange={e => setSelectedPromptId(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                            >
                                <option value="" disabled>選択してください</option>
                                {prompts.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">旧要件のペースト</label>
                            <textarea
                                value={requirements}
                                onChange={e => setRequirements(e.target.value)}
                                rows={8}
                                className="w-full p-3 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="ここに現在の要件やアイデアを貼り付けてください..."
                            />
                        </div>
                    </div>

                    {/* 制限事項(壁) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-y-auto min-h-[260px]">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-indigo-500 pl-3">壁 (制約事項)</h2>
                        <div className="space-y-6">
                            {Object.entries(groupedConstraints).map(([category, items]) => (
                                <div key={category}>
                                    <h3 className="font-bold text-sm text-indigo-700 bg-indigo-50 px-3 py-1 rounded inline-block mb-3">{category}</h3>
                                    <div className="space-y-2">
                                        {items.map(item => (
                                            <label key={item.id} className="flex items-start space-x-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedConstraintIds.includes(item.id)}
                                                    onChange={() => handleToggleConstraint(item.id)}
                                                    className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                                                />
                                                <span className="text-sm text-slate-700 group-hover:text-slate-900 leading-snug">
                                                    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 mr-2">
                                                        {item.detailCategory}
                                                    </span>
                                                    <span>{item.description}</span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {constraints.length === 0 && <p className="text-slate-500 text-sm">制約マスターが登録されていません。</p>}
                        </div>
                    </div>

                </div>

                {/* ===== 中央カラム: STEP1ボタン（縦長） ===== */}
                <div className="min-w-0">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">STEP 1</div>
                        <button
                            onClick={handleGeneratePrompt}
                            disabled={!requirements || !selectedPromptId || selectedConstraintIds.length === 0}
                            className={`w-full flex-1 rounded-2xl shadow-md transition-all px-2 py-6 ${(!requirements || !selectedPromptId || selectedConstraintIds.length === 0)
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-b from-teal-600 to-blue-600 text-white hover:opacity-90 active:scale-[0.98]'
                                }`}
                        >
                            <span className="h-full w-full flex flex-col items-center justify-center gap-3">
                                <span className="flex items-center justify-center">
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 20 20"
                                        className="w-6 h-6 shrink-0"
                                        fill="currentColor"
                                    >
                                        <path d="M7.5 4.5v11l9-5.5-9-5.5Z" />
                                    </svg>
                                </span>
                                <span className="[writing-mode:vertical-rl] [text-orientation:upright] text-lg font-extrabold leading-none tracking-[0.08em]">
                                    プロンプトを生成
                                </span>
                            </span>
                        </button>

                        <div className="mt-3 min-h-[2.75rem] text-center">
                            {isCopied && (
                                <div className="text-teal-600 font-bold animate-pulse text-sm">
                                    ✅ コピーしました
                                    <div className="text-xs text-slate-500 font-semibold mt-1">LLMに貼り付けてください</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== 右カラム: 生成プロンプト＆STEP2＆プレビュー ===== */}
                <div className="flex flex-col space-y-6 min-w-0">

                {/* 生成されたプロンプト */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 mb-2 border-l-4 border-blue-500 pl-3">生成されたプロンプト (手動コピー用)</h2>
                    <textarea
                        readOnly
                        value={generatedPrompt}
                        rows={8}
                        className="w-full p-3 border border-slate-100 bg-slate-50 text-slate-600 rounded text-sm focus:outline-none"
                        placeholder="STEP 1 を押すとここに生成プロンプトが表示されます（クリックで全選択）"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                </div>

                {/* AI結果の貼り付け領域 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 mb-2 border-l-4 border-orange-500 pl-3">STEP 2: プロンプトから生成されたLLMの出力 (新要件定義JSON) を貼り付け</h2>
                    <textarea
                        value={jsonResult}
                        onChange={e => handleJsonPaste(e.target.value)}
                        rows={8}
                        className={`w-full p-3 border rounded focus:ring-2 focus:outline-none text-sm font-mono ${jsonError ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:ring-orange-500'
                            }`}
                        placeholder={`{"newRequirements": "...", "considerations": [...]}`}
                    />
                    {jsonError && (
                        <p className="text-red-500 text-sm mt-2 font-bold">{jsonError}</p>
                    )}
                </div>

                {/* プレビューとPDF生成 */}
                {parsedResult && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-y-auto">
                        <div className="space-y-8 animate-fade-in-up">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h2 className="text-lg font-bold text-slate-800">パース成功 / プレビュー</h2>
                                <button
                                    onClick={handleGeneratePDF}
                                    disabled={isPdfGenerating}
                                    className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition disabled:opacity-50 flex items-center"
                                >
                                    {isPdfGenerating ? 'PDF作成中...' : 'PDFを発行（検証ハッシュ付）'}
                                </button>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">新要件 (New Requirements)</h3>
                                <div className="prose prose-sm text-slate-700 max-w-none whitespace-pre-wrap">
                                    {parsedResult.newRequirements}
                                </div>
                            </div>

                            {parsedResult.considerations && parsedResult.considerations.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">検討内容 (Considerations)</h3>
                                    <div className="space-y-4">
                                        {parsedResult.considerations.map((c, idx) => (
                                            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${c.type === 'trade-off' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {c.type.toUpperCase()}
                                                    </span>
                                                    <h4 className="font-bold text-slate-800">{c.title}</h4>
                                                </div>
                                                <p className="text-sm text-slate-600">{c.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                </div>
            </div>
        </div>
    );
}
