import React, { useState, useCallback } from 'react';

export default function VerificationZone() {
    const [isDragActive, setIsDragActive] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<{ success: boolean; projectId?: string; createdAt?: string; error?: string } | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(false);

        const file = e.dataTransfer.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setResult({ success: false, error: 'PDFファイルのみ対応しています' });
            return;
        }

        verifyFile(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        verifyFile(file);
    };

    const verifyFile = async (file: File) => {
        setIsVerifying(true);
        setResult(null);

        try {
            // 1. ファイルのバイナリを読み込む
            const arrayBuffer = await file.arrayBuffer();

            // 2. フロントエンドでSHA-256ハッシュを計算
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // 3. バックエンドAPI (/api/admin/verify-hash) に送信して検証
            const res = await fetch('/api/admin/verify-hash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: hashHex }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setResult(data);
            } else {
                setResult({ success: false, error: data.error || '検証に失敗しました' });
            }

        } catch (err: any) {
            console.error(err);
            setResult({ success: false, error: 'ハッシュ計算または通信中にエラーが発生しました' });
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6 bg-slate-50 pt-20">
            <div className="w-full max-w-2xl bg-white p-10 rounded-3xl shadow-lg border border-slate-200">
                <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">ドキュメントの真正性検証</h2>
                <p className="text-center text-slate-500 mb-8">
                    発行済みの要件定義PDFをアップロードし、改ざんが行われていないか確認します。
                </p>

                {/* Dropzone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                        }`}
                    onClick={() => document.getElementById('file-upload')?.click()}
                >
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept="application/pdf"
                        onChange={handleFileSelect}
                    />
                    <div className="text-5xl mb-4">📄</div>
                    {isVerifying ? (
                        <p className="font-bold text-teal-600 animate-pulse">ハッシュを計算＆検証中...</p>
                    ) : (
                        <>
                            <p className="font-bold text-slate-700">PDFファイルをドラッグ＆ドロップ</p>
                            <p className="text-sm text-slate-500 mt-2">またはクリックしてファイルを選択</p>
                        </>
                    )}
                </div>

                {/* 結果表示エリア */}
                {result && (
                    <div className={`mt-8 p-6 rounded-xl border animate-fade-in-up ${result.success ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'
                        }`}>
                        {result.success ? (
                            <div className="flex items-start space-x-4">
                                <div className="text-4xl">✅</div>
                                <div>
                                    <h3 className="text-lg font-bold text-teal-800">真正性が確認されました</h3>
                                    <p className="text-teal-700 mt-1 text-sm">このPDFはシステムから発行されたオリジナルデータに間違いありません。</p>
                                    <div className="mt-3 bg-white p-3 rounded border border-teal-100 text-sm space-y-1">
                                        <p><span className="font-semibold text-slate-500">プロジェクトID:</span> <span className="text-slate-700">{result.projectId}</span></p>
                                        <p><span className="font-semibold text-slate-500">発行日時:</span> <span className="text-slate-700">{result.createdAt ? new Date(result.createdAt).toLocaleString('ja-JP') : '-'}</span></p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start space-x-4">
                                <div className="text-4xl text-red-500">⚠️</div>
                                <div>
                                    <h3 className="text-lg font-bold text-red-800">改ざんの可能性あり</h3>
                                    <p className="text-red-700 mt-1 text-sm">{result.error}</p>
                                    <p className="text-red-600 text-xs mt-2">このファイルの内容は、発行時の状態から変更されているか、システムに記録されていません。</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
