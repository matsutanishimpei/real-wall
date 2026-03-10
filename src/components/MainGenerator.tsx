import React, { useState, useEffect, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Interface definitions
interface DesignIssue {
    id: string;
    title: string;
    optA: string;
    optB: string;
    hint: string;
}

interface Deliberation {
    selectedOption: string;
    differentiator: string;
    expectedFeedback: string;
    tradeoffDecision: string;
}

type Phase = 'INPUT' | 'ISSUES' | 'DELIBERATION' | 'RESULT';

export default function MainGenerator({ user }: { user: any }) {
    // --- Basic States ---
    const [phase, setPhase] = useState<Phase>('INPUT');
    const [requirements, setRequirements] = useState('');
    const [prompts, setPrompts] = useState<any[]>([]);
    const [constraints, setConstraints] = useState<any[]>([]);
    const [selectedConstraintIds, setSelectedConstraintIds] = useState<string[]>([]);

    // --- Step 1 States (Issue Extraction) ---
    const [extractionPromptId, setExtractionPromptId] = useState('');
    const [generatedStep1Prompt, setGeneratedStep1Prompt] = useState('');
    const [pastedIssuesJSON, setPastedIssuesJSON] = useState('');
    const [issues, setIssues] = useState<DesignIssue[]>([]);
    const [issueError, setIssueError] = useState('');

    // --- Step 2 States (Deliberation) ---
    const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
    const [delibData, setDelibData] = useState<Record<string, Deliberation>>({});
    const [reportPromptId, setReportPromptId] = useState('');
    const [generatedStep2Prompt, setGeneratedStep2Prompt] = useState('');
    const [pastedReportJSON, setPastedReportJSON] = useState('');
    const [finalReport, setFinalReport] = useState<any>(null);
    const [reportError, setReportError] = useState('');

    // --- Others ---
    const [isCopied, setIsCopied] = useState(false);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // --- Persistence (Auto-save) ---
    useEffect(() => {
        const saved = localStorage.getItem(`realwall-project-${user.id}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.requirements) setRequirements(data.requirements);
                if (data.selectedConstraintIds) setSelectedConstraintIds(data.selectedConstraintIds);
                if (data.extractionPromptId) setExtractionPromptId(data.extractionPromptId);
                if (data.pastedIssuesJSON) setPastedIssuesJSON(data.pastedIssuesJSON);
                if (data.issues) setIssues(data.issues);
                if (data.selectedIssueIds) setSelectedIssueIds(data.selectedIssueIds);
                if (data.delibData) setDelibData(data.delibData);
                if (data.reportPromptId) setReportPromptId(data.reportPromptId);
                if (data.pastedReportJSON) setPastedReportJSON(data.pastedReportJSON);
                if (data.finalReport) setFinalReport(data.finalReport);
                if (data.phase) setPhase(data.phase);
            } catch (e) {
                console.error("Failed to load saved project", e);
            }
        }
        setIsLoaded(true);
    }, [user.id]);

    useEffect(() => {
        if (!isLoaded) return;
        const data = {
            requirements, selectedConstraintIds, extractionPromptId,
            pastedIssuesJSON, issues, selectedIssueIds, delibData,
            reportPromptId, pastedReportJSON, finalReport, phase
        };
        localStorage.setItem(`realwall-project-${user.id}`, JSON.stringify(data));
    }, [requirements, selectedConstraintIds, extractionPromptId, pastedIssuesJSON, issues, selectedIssueIds, delibData, reportPromptId, pastedReportJSON, finalReport, phase, isLoaded, user.id]);

    const resetProject = () => {
        if (confirm('プロジェクトを完全にリセットしてもよろしいですか？入力内容はすべて消去されます。')) {
            setRequirements('');
            setSelectedConstraintIds([]);
            setPastedIssuesJSON('');
            setIssues([]);
            setSelectedIssueIds([]);
            setDelibData({});
            setPastedReportJSON('');
            setFinalReport(null);
            setPhase('INPUT');
            localStorage.removeItem(`realwall-project-${user.id}`);
        }
    };

    const canJumpTo = (p: Phase) => {
        if (p === 'INPUT') return true;
        if (p === 'ISSUES') return issues.length > 0;
        if (p === 'DELIBERATION') return selectedIssueIds.length >= 5;
        if (p === 'RESULT') return finalReport !== null;
        return false;
    };

    // Initial load
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/generate/config');
                if (res.ok) {
                    const data = await res.json();
                    setPrompts(data.prompts || []);
                    setConstraints(data.constraints || []);

                    const extPrompts = data.prompts?.filter((p: any) => p.category === 'extraction');
                    if (extPrompts?.length > 0) setExtractionPromptId(extPrompts[0].id);

                    const repPrompts = data.prompts?.filter((p: any) => p.category === 'report');
                    if (repPrompts?.length > 0) setReportPromptId(repPrompts[0].id);
                }
            } catch (err) {
                console.error('Failed to load config');
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

    // --- Handlers ---
    const handleToggleConstraint = (id: string) => {
        setSelectedConstraintIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 3000);
        });
    };

    // Step 1: Generate Extraction Prompt
    const generateExtractionPrompt = () => {
        const template = prompts.find(p => p.id === extractionPromptId)?.content || '';
        const selectedDescriptions = constraints.filter(c => selectedConstraintIds.includes(c.id)).map(c => c.description);
        const constraintsText = selectedDescriptions.join(', ');
        const filled = template.replace(/{{\s*constraints\s*}}/g, constraintsText).replace(/{{\s*old_requirements\s*}}/g, requirements);

        const fullPrompt = `${filled}\n\n出力は必ず以下のJSON形式のリレーショナルデータとして出力してください。デザインの分岐点を5つ提示すること。\n\`\`\`json\n{\n  "issues": [\n    {\n      "title": "論点のタイトル",\n      "optA": "選択肢Aの概要",\n      "optB": "選択肢Bの概要",\n      "hint": "設計上のヒントやトレードオフの視点"\n    }\n  ]\n}\n\`\`\``.trim();
        setGeneratedStep1Prompt(fullPrompt);
        copyToClipboard(fullPrompt);
    };

    // Step 1: Paste & Parse Issues
    const handlePasteIssues = (text: string) => {
        setPastedIssuesJSON(text);
        try {
            let clean = text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(clean);
            if (!Array.isArray(parsed.issues)) throw new Error('issues配列が見つかりません');

            const issuesWithId = parsed.issues.map((iss: any, idx: number) => ({
                ...iss,
                id: `iss-${idx}-${Date.now()}`
            }));
            setIssues(issuesWithId);
            setIssueError('');
            setPhase('ISSUES');
        } catch (e: any) {
            setIssueError(`JSON解析エラー: ${e.message}`);
        }
    };

    // Step 2: Toggle Issue Selection
    const handleToggleIssue = (id: string) => {
        setSelectedIssueIds(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= 5) return prev; // Limit to 5
            return [...prev, id];
        });
    };

    const updateDelib = (issueId: string, field: keyof Deliberation, value: string) => {
        setDelibData(prev => ({
            ...prev,
            [issueId]: {
                ...(prev[issueId] || { selectedOption: '', differentiator: '', expectedFeedback: '', tradeoffDecision: '' }),
                [field]: value
            }
        }));
    };

    // Step 2: Generate Report Prompt
    const generateReportPrompt = () => {
        const template = prompts.find(p => p.id === reportPromptId)?.content || '';
        const selectedDescriptions = constraints.filter(c => selectedConstraintIds.includes(c.id)).map(c => c.description);

        // Build deliberation text
        const delibSummary = selectedIssueIds.map(id => {
            const iss = issues.find(i => i.id === id);
            const data = delibData[id];
            return `【論点: ${iss?.title}】\n- ユーザーの選択: ${data?.selectedOption}\n- 既存との違い: ${data?.differentiator}\n- 予想フィードバック: ${data?.expectedFeedback}\n- トレードオフ決断: ${data?.tradeoffDecision}`;
        }).join('\n\n');

        const filled = template
            .replace(/{{\s*constraints\s*}}/g, selectedDescriptions.join(', '))
            .replace(/{{\s*old_requirements\s*}}/g, requirements)
            .replace(/{{\s*deliberations\s*}}/g, delibSummary);

        const fullPrompt = `${filled}\n\n出力は必ず以下の5章構成のJSON形式で出力してください。A4で5〜10枚相当の重厚なドキュメントを目指し、各章の内容を詳細に記述すること。\n\`\`\`json\n{\n  "chapter1": "システム要件の概況と設計背景",\n  "chapter2": "設計上の分岐点と代替案の比較検討",\n  "chapter3": "主要な差別化要因と既存システムとの整合性",\n  "chapter4": "ステークホルダーへの公開と予想されるフィードバック",\n  "chapter5": "最終的なアーキテクチャ方針とトレードオフの決断"\n}\n\`\`\``.trim();
        setGeneratedStep2Prompt(fullPrompt);
        copyToClipboard(fullPrompt);
    };

    // Step 2: Paste & Parse Report
    const handlePasteReport = (text: string) => {
        setPastedReportJSON(text);
        try {
            let clean = text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(clean);
            if (!parsed.chapter1 || !parsed.chapter5) throw new Error('5章構成のJSONではありません');
            setFinalReport(parsed);
            setReportError('');
            setPhase('RESULT');
        } catch (e: any) {
            setReportError(`JSON解析エラー: ${e.message}`);
        }
    };

    // --- PDF Generation (Enhanced for 5 chapters) ---
    const handleGeneratePDF = async () => {
        if (!finalReport) return;
        setIsPdfGenerating(true);

        try {
            const textToHash = requirements + JSON.stringify(finalReport);
            const docHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(textToHash) as unknown as ArrayBuffer);
            const docHash = Array.from(new Uint8Array(docHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);

            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);

            const fontRes = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf');
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

            const drawText = (text: string, size: number, isTitle = false) => {
                const color = isTitle ? { r: 0.1, g: 0.3, b: 0.3 } : { r: 0.2, g: 0.2, b: 0.2 };
                const lines = wrapText(text, width - 100, size);
                for (const line of lines) {
                    if (y < 60) {
                        page = pdfDoc.addPage();
                        y = height - 50;
                        page.drawText(`Verify: ${docHash}`, { x: width - 80, y: 30, size: 8, font: customFont });
                    }
                    page.drawText(line, { x: 50, y, size, font: customFont, color: { type: 'RGB' as any, ...color } as any });
                    y -= size + 5;
                }
                y -= 12;
            };

            // Header
            drawText('リアルウォール：アーキテクチャ設計・要件検討報告書', 20, true);
            drawText(`発行日: ${new Date().toLocaleDateString('ja-JP')} | 検証ID: ${docHash}`, 9);
            y -= 20;

            // Chapters
            const chapters = [
                { t: '第1章：システム要件の概況と設計背景', c: finalReport.chapter1 },
                { t: '第2章：設計上の分岐点と代替案の比較検討', c: finalReport.chapter2 },
                { t: '第3章：主要な差別化要因と既存システムとの整合性', c: finalReport.chapter3 },
                { t: '第4章：ステークホルダーへの公開と予想されるフィードバック', c: finalReport.chapter4 },
                { t: '第5章：最終的なアーキテクチャ方針とトレードオフの決断', c: finalReport.chapter5 },
            ];

            chapters.forEach(ch => {
                drawText(ch.t, 14, true);
                drawText(ch.c, 11);
                y -= 10;
            });

            const pdfBytes = await pdfDoc.save();
            const fileHashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes as unknown as ArrayBuffer);
            const fileHash = Array.from(new Uint8Array(fileHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfHash: fileHash, considerations: [] }) // considerations could be mapped from delibData
            });

            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Architectural_Report_${docHash}.pdf`;
            a.click();
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error(e);
            alert('PDF出力エラーが発生しました');
        } finally {
            setIsPdfGenerating(false);
        }
    };

    // --- Render Helpers ---

    return (
        <div className="bg-slate-50 min-h-[calc(100vh-4rem)] p-6 pt-20">
            <div className="max-w-7xl mx-auto">

                {/* Progress Bar */}
                <div className="flex justify-between items-center mb-8 px-4">
                    {[
                        { step: 'INPUT', label: '1. 要件・制約入力' },
                        { step: 'ISSUES', label: '2. 設計論点の抽出' },
                        { step: 'DELIBERATION', label: '3. 設計検討・解決' },
                        { step: 'RESULT', label: '4. 最終報告書' }
                    ].map((s, i) => {
                        const clickable = canJumpTo(s.step as Phase);
                        return (
                            <React.Fragment key={s.step}>
                                <div
                                    onClick={() => clickable && setPhase(s.step as Phase)}
                                    className={`flex items-center space-x-3 transition-all ${clickable ? 'cursor-pointer' : 'cursor-not-allowed'} ${phase === s.step ? 'text-teal-600 scale-105 opacity-100' : 'text-slate-400 opacity-60'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${phase === s.step ? 'bg-teal-600 text-white shadow-lg' : clickable ? 'bg-teal-100 text-teal-600' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</div>
                                    <span className={`text-sm font-bold whitespace-nowrap hidden md:inline`}>{s.label}</span>
                                </div>
                                {i < 3 && <div className={`flex-1 h-px mx-4 hidden md:block ${canJumpTo(['ISSUES', 'DELIBERATION', 'RESULT'][i] as Phase) ? 'bg-teal-200' : 'bg-slate-200'}`}></div>}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* ===== LEFT: Main Inputs & Navigation ===== */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Requirements & Constraints (Common for Step 1) */}
                        <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-opacity ${phase !== 'INPUT' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                <span className="w-1.5 h-6 bg-teal-500 rounded-full mr-3"></span>
                                基本情報の入力
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">旧要件定義のペースト</label>
                                    <textarea
                                        value={requirements}
                                        onChange={e => setRequirements(e.target.value)}
                                        rows={8}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm transition"
                                        placeholder="ここに現在の仕様やドラフト要件を入力してください..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">設計者の選択（論点抽出用プロンプト）</label>
                                    <select
                                        value={extractionPromptId}
                                        onChange={e => setExtractionPromptId(e.target.value)}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                    >
                                        {prompts.filter(p => p.category === 'extraction' || p.category === 'general').map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Wall Selection */}
                        <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-opacity ${phase !== 'INPUT' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                                壁 (システム制約の適用)
                            </h2>
                            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                                {Object.entries(groupedConstraints).map(([category, items]) => (
                                    <div key={category}>
                                        <h3 className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md inline-block mb-3">{category}</h3>
                                        <div className="space-y-2">
                                            {(items as any[]).map((item: any) => (
                                                <label key={item.id} className="flex items-start space-x-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedConstraintIds.includes(item.id)}
                                                        onChange={() => handleToggleConstraint(item.id)}
                                                        className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 transition"
                                                    />
                                                    <span className="text-xs text-slate-600 group-hover:text-slate-900 leading-snug">
                                                        <span className="font-bold text-indigo-700 mr-2">[{item.detailCategory}]</span>
                                                        {item.description}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Reset / Navigation Back */}
                        <div className="space-y-3">
                            {phase !== 'INPUT' && (
                                <button
                                    onClick={() => {
                                        const prevPhase = phase === 'ISSUES' ? 'INPUT' : phase === 'DELIBERATION' ? 'ISSUES' : 'DELIBERATION';
                                        setPhase(prevPhase);
                                    }}
                                    className="w-full py-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition flex items-center justify-center space-x-2 shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                    <span>前の工程に戻る</span>
                                </button>
                            )}
                            <button
                                onClick={resetProject}
                                className="w-full py-3 border-2 border-dashed border-red-200 hover:border-red-300 rounded-2xl text-red-400 font-bold hover:bg-red-50 transition flex items-center justify-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                <span>プロジェクトをリセット</span>
                            </button>
                        </div>
                    </div>

                    {/* ===== RIGHT: Step Output & Interaction ===== */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Phase 1: Point of Contention Extraction */}
                        {phase === 'INPUT' && (
                            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center justify-center min-h-[500px] space-y-8 animate-fade-in-up">
                                <div className="text-center space-y-4">
                                    <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800">STEP 1: 論点の抽出</h2>
                                    <p className="text-slate-500 max-w-md mx-auto">入力された要件とリアルウォールの制約から、設計上のトレードオフや不確実な論点（デザインの分岐点）をAIに抽出させます。</p>
                                </div>

                                <button
                                    onClick={generateExtractionPrompt}
                                    disabled={!requirements || selectedConstraintIds.length === 0}
                                    className="px-12 py-5 bg-gradient-to-r from-teal-600 to-indigo-600 text-white rounded-2xl font-extrabold text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    設計論点を抽出する（プロンプト生成）
                                </button>

                                {isCopied && (
                                    <div className="text-teal-600 font-bold animate-pulse text-sm">✅ プロンプトをコピーしました。LLMに貼り付けてください。</div>
                                )}

                                <div className="w-full space-y-4 pt-8">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">LLMからの出力JSONをペースト</label>
                                        {issueError && <span className="text-xs text-red-500">{issueError}</span>}
                                    </div>
                                    <textarea
                                        value={pastedIssuesJSON}
                                        onChange={e => handlePasteIssues(e.target.value)}
                                        className="w-full p-4 bg-slate-900 text-teal-400 font-mono text-sm rounded-2xl border-2 border-slate-800 focus:border-teal-500 outline-none transition h-40"
                                        placeholder={`{"issues": [{"title": "...", "optA": "...", "optB": "...", "hint": "..."}]}`}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Phase 2: Design Deliberation (Issues View) */}
                        {phase === 'ISSUES' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">設計論点の検討</h2>
                                        <p className="text-slate-500 mt-2">提示された論点から、このプロジェクトで深く検討すべきものを<strong className="text-indigo-600">5つ</strong>選択してください。</p>
                                    </div>
                                    <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-black border border-indigo-100">
                                        選択中: {selectedIssueIds.length} / 5
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {issues.map(iss => (
                                        <div
                                            key={iss.id}
                                            onClick={() => handleToggleIssue(iss.id)}
                                            className={`p-6 rounded-3xl border-2 transition-all cursor-pointer group hover:bg-white ${selectedIssueIds.includes(iss.id) ? 'bg-white border-teal-500 shadow-xl' : 'bg-slate-100/50 border-transparent hover:border-slate-300'}`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors uppercase tracking-tight">{iss.title}</h3>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${selectedIssueIds.includes(iss.id) ? 'bg-teal-500 border-teal-500' : 'border-slate-300'}`}>
                                                    {selectedIssueIds.includes(iss.id) && <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="p-3 bg-white/50 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-500"><span className="text-indigo-500 block mb-1">Option A</span> {iss.optA}</div>
                                                <div className="p-3 bg-white/50 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-500"><span className="text-indigo-500 block mb-1">Option B</span> {iss.optB}</div>
                                            </div>
                                            <div className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                💡 {iss.hint}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-center pt-8">
                                    <button
                                        disabled={selectedIssueIds.length < 5}
                                        onClick={() => setPhase('DELIBERATION')}
                                        className="px-12 py-5 bg-slate-800 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-slate-900 transition-all disabled:opacity-20"
                                    >
                                        次へ進む（検討フォーム入力）
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Phase 3: Deliberation Input Form */}
                        {phase === 'DELIBERATION' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">設計決断の言語化</h2>
                                <p className="text-slate-500">選択した5つの論点に対し、あなたの設計意志を反映させてください。</p>

                                <div className="space-y-12">
                                    {selectedIssueIds.map(id => {
                                        const iss = issues.find(i => i.id === id);
                                        return (
                                            <div key={id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <span className="bg-indigo-600 text-white w-2 h-8 rounded-full"></span>
                                                    <h3 className="text-xl font-bold text-slate-800">{iss?.title}</h3>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">採用する案（なぜそれか）</label>
                                                            <textarea
                                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                                                placeholder="例: Option Aを採用。将来の拡張性を優先するため。"
                                                                rows={3}
                                                                value={delibData[id]?.selectedOption || ''}
                                                                onChange={e => updateDelib(id, 'selectedOption', e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">既存サービスとの違い</label>
                                                            <textarea
                                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                                                placeholder="例: 汎用ツールに比べ、本ドメイン特化のUIで差別化。"
                                                                rows={3}
                                                                value={delibData[id]?.differentiator || ''}
                                                                onChange={e => updateDelib(id, 'differentiator', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">予想されるFB / 懸念点</label>
                                                            <textarea
                                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                                                placeholder="例: 初期コストの増大について指摘が入る可能性がある。"
                                                                rows={3}
                                                                value={delibData[id]?.expectedFeedback || ''}
                                                                onChange={e => updateDelib(id, 'expectedFeedback', e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">トレードオフの決断</label>
                                                            <textarea
                                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                                                placeholder="例: パフォーマンスを犠牲にし、開発速度(Time to Market)を取る。"
                                                                rows={3}
                                                                value={delibData[id]?.tradeoffDecision || ''}
                                                                onChange={e => updateDelib(id, 'tradeoffDecision', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="bg-slate-800 p-8 rounded-3xl text-white space-y-6">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold mb-2">FINAL STEP: 報告書の生成</h3>
                                            <select
                                                value={reportPromptId}
                                                onChange={e => setReportPromptId(e.target.value)}
                                                className="bg-slate-700 border-none rounded-xl text-sm px-4 py-2 w-full max-w-sm outline-none focus:ring-2 focus:ring-teal-400"
                                            >
                                                {prompts.filter(p => p.category === 'report' || p.category === 'general').map(p => (
                                                    <option key={p.id} value={p.id}>{p.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={generateReportPrompt}
                                            className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-2xl font-black shadow-lg transition-transform active:scale-95 whitespace-nowrap"
                                        >
                                            最終報告書プロンプトを生成
                                        </button>
                                    </div>

                                    {generatedStep2Prompt && (
                                        <div className="space-y-4 animate-fade-in-up">
                                            <div className="text-xs font-bold opacity-50 uppercase tracking-widest">最終報告書 JSON ペースト</div>
                                            <textarea
                                                value={pastedReportJSON}
                                                onChange={e => handlePasteReport(e.target.value)}
                                                className="w-full p-4 bg-slate-900 text-teal-400 font-mono text-xs rounded-2xl border border-slate-700 focus:border-teal-400 outline-none transition h-40"
                                                placeholder={`{"chapter1": "...", ... "chapter5": "..."}`}
                                            />
                                            {reportError && <p className="text-red-400 text-xs font-bold">{reportError}</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Phase 4: Result View & PDF */}
                        {phase === 'RESULT' && finalReport && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">設計報告書の完成</h2>
                                    <button
                                        onClick={handleGeneratePDF}
                                        disabled={isPdfGenerating}
                                        className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center space-x-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        <span>{isPdfGenerating ? 'PDF生成中...' : '検証ハッシュ付PDFを発行'}</span>
                                    </button>
                                </div>

                                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-12">
                                    <div className="prose prose-slate max-w-none">
                                        {[
                                            { t: '第1章：システム要件の概況と設計背景', c: finalReport.chapter1 },
                                            { t: '第2章：設計上の分岐点と代替案の比較検討', c: finalReport.chapter2 },
                                            { t: '第3章：主要な差別化要因と既存システムとの整合性', c: finalReport.chapter3 },
                                            { t: '第4章：ステークホルダーへの公開と予想されるフィードバック', c: finalReport.chapter4 },
                                            { t: '第5章：最終的なアーキテクチャ方針とトレードオフの決断', c: finalReport.chapter5 },
                                        ].map((ch, i) => (
                                            <div key={i} className="mb-12 last:mb-0">
                                                <h3 className="text-xl font-black text-slate-800 border-b-4 border-teal-500/20 pb-2 mb-6">{ch.t}</h3>
                                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{ch.c}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
