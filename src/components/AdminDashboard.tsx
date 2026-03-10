import React, { useState, useEffect, useMemo } from 'react';

// === UIコンポーネント (Toast & Dialog) ===
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    const bg = type === 'success' ? 'bg-teal-600' : 'bg-red-500';
    return (
        <div className={`fixed bottom-4 right-4 ${bg} text-white px-6 py-3 rounded-lg shadow-lg font-medium tracking-wide animate-fade-in-up z-50`}>
            {message}
        </div>
    );
};

const ConfirmDialog = ({ isOpen, message, onConfirm, onCancel }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl space-y-6 animate-scale-in">
                <h3 className="text-lg font-bold text-slate-800">確認</h3>
                <p className="text-slate-600">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 transition">
                        キャンセル
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-700 text-white font-medium transition shadow-md">
                        実行する
                    </button>
                </div>
            </div>
        </div>
    );
};

// === メインダッシュボード ===
export default function AdminDashboard({ currentUserId }: { currentUserId: string }) {
    const [activeTab, setActiveTab] = useState<'users' | 'prompts' | 'constraints'>('users');
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const [confirm, setConfirm] = useState<{ isOpen: boolean, message: string, action: () => void }>({ isOpen: false, message: '', action: () => { } });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ show: true, message, type });
    const askConfirm = (message: string, action: () => void) => setConfirm({ isOpen: true, message, action });

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800 font-sans pt-16">
            <header className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600">
                        ワクワク試作室 : Admin Dashboard
                    </h1>
                    <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                        {(['users', 'prompts', 'constraints'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === tab ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === 'users' && <UsersPanel currentUserId={currentUserId} showToast={showToast} askConfirm={askConfirm} />}
                {activeTab === 'prompts' && <PromptsPanel showToast={showToast} askConfirm={askConfirm} />}
                {activeTab === 'constraints' && <ConstraintsPanel showToast={showToast} askConfirm={askConfirm} />}
            </main>

            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
            <ConfirmDialog isOpen={confirm.isOpen} message={confirm.message} onCancel={() => setConfirm({ ...confirm, isOpen: false })} onConfirm={() => { confirm.action(); setConfirm({ ...confirm, isOpen: false }); }} />
        </div>
    );
}

// === 1. Users Panel ===
function UsersPanel({ currentUserId, showToast, askConfirm }: any) {
    const [users, setUsers] = useState<any[]>([]);

    const fetchUsers = async () => {
        const res = await fetch('/api/admin/users');
        if (res.ok) setUsers((await res.json()).users);
    };
    useEffect(() => { fetchUsers(); }, []);

    const toggleStatus = async (user: any, field: 'role' | 'isActive') => {
        // 自分自身は操作不可
        if (user.id === currentUserId) return;

        const newValue = field === 'role' ? (user.role === 'admin' ? 'user' : 'admin') : (user.isActive === 1 ? 0 : 1);

        askConfirm(`${user.name} の ${field} を変更しますか？`, async () => {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: newValue })
            });
            if (res.ok) {
                showToast(`ユーザー情報を更新しました`);
                fetchUsers();
            } else {
                showToast(`更新に失敗しました`, 'error');
            }
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500 text-sm">
                    <tr>
                        <th className="p-4 font-semibold">Name / Email</th>
                        <th className="p-4 font-semibold w-32 text-center">Role</th>
                        <th className="p-4 font-semibold w-32 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(u => {
                        const isMe = u.id === currentUserId;
                        return (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition">
                                <td className="p-4">
                                    <div className="font-medium text-slate-800">{u.name} {isMe && <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">You</span>}</div>
                                    <div className="text-sm text-slate-500">{u.email}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <button
                                        disabled={isMe}
                                        onClick={() => toggleStatus(u, 'role')}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                            } ${isMe ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 transition-transform'}`}
                                    >
                                        {u.role.toUpperCase()}
                                    </button>
                                </td>
                                <td className="p-4 text-center">
                                    <button
                                        disabled={isMe}
                                        onClick={() => toggleStatus(u, 'isActive')}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border ${u.isActive === 1 ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-red-100 text-red-700 border-red-200'
                                            } ${isMe ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 transition-transform'}`}
                                    >
                                        {u.isActive === 1 ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// === 2. Prompts Panel ===
function PromptsPanel({ showToast, askConfirm }: any) {
    const [prompts, setPrompts] = useState<any[]>([]);
    const [editing, setEditing] = useState<any>(null);
    const [viewing, setViewing] = useState<any>(null);
    const [previewMode, setPreviewMode] = useState(false);

    const fetchPrompts = async () => {
        const res = await fetch('/api/admin/prompts');
        if (res.ok) setPrompts((await res.json()).prompts);
    };
    useEffect(() => { fetchPrompts(); }, []);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const title = fd.get('title');
        const content = fd.get('content');

        askConfirm(`プロンプトを${editing?.id ? '更新' : '作成'}しますか？`, async () => {
            const isNew = !editing?.id;
            const url = isNew ? '/api/admin/prompts' : `/api/admin/prompts/${editing.id}`;
            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            if (res.ok) {
                showToast(`保存しました`);
                setEditing(null);
                fetchPrompts();
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(`保存に失敗しました: ${errData.error || res.statusText}`, 'error');
            }
        });
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        askConfirm('本当にこのプロンプトを削除しますか？', async () => {
            const res = await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('削除しました');
                fetchPrompts();
            } else {
                showToast('削除に失敗しました', 'error');
            }
        });
    };

    const renderPromptContent = (content: string) => {
        // {{ placeholder }} をハイライト
        const parts = content.split(/({{[^}]+}})/g);
        return parts.map((part, i) =>
            part.match(/{{[^}]+}}/) ? (
                <span key={i} className="bg-amber-100 text-amber-800 font-mono font-bold px-1 rounded mx-0.5 border border-amber-200">
                    {part}
                </span>
            ) : part
        );
    };

    const handleDuplicate = (p: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditing({ title: `${p.title} (Copy)`, content: p.content });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
                <button onClick={() => setEditing({ title: '', content: '' })} className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-100 transition-all flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    <span>新規プロンプト作成</span>
                </button>
                <div className="text-xs text-slate-400 font-medium">全 {prompts.length} 件のプロンプト</div>
            </div>

            {/* Editing / Creating Modal Overlay */}
            {editing && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                        <form onSubmit={handleSave}>
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800">{editing.id ? 'プロンプトの編集' : '新規プロンプトの作成'}</h3>
                                <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">タイトル</label>
                                    <input required name="title" defaultValue={editing.title} placeholder="例: システム要件定義マスターv1" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">プロンプト本文</label>
                                    <div className="text-[10px] text-slate-400 mb-2 whitespace-pre-line bg-slate-50 p-2 rounded">
                                        利用可能な変数: {"{{ constraints }} (選択された制約文)"}, {"{{ old_requirements }} (入力された旧要件)"}
                                    </div>
                                    <textarea required name="content" defaultValue={editing.content} rows={12} placeholder="AIへの指示を入力してください..." className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono text-sm leading-relaxed transition" />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
                                <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition">キャンセル</button>
                                <button type="submit" className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow-md transition shadow-slate-200">
                                    {editing.id ? '更新を保存する' : '新規作成する'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Viewing / Checking Modal Overlay */}
            {viewing && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0">
                            <div>
                                <div className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">Prompt Detail & Verification</div>
                                <h3 className="font-bold text-lg text-slate-800">{viewing.title}</h3>
                            </div>
                            <button onClick={() => { setViewing(null); setPreviewMode(false); }} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="mb-6 flex space-x-2 border-b border-slate-100">
                                <button
                                    onClick={() => setPreviewMode(false)}
                                    className={`pb-2 px-4 text-sm font-bold transition ${!previewMode ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    内容の確認 (Template)
                                </button>
                                <button
                                    onClick={() => setPreviewMode(true)}
                                    className={`pb-2 px-4 text-sm font-bold transition ${previewMode ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    レンダリング・チェック (Preview)
                                </button>
                            </div>

                            {previewMode ? (
                                <div className="space-y-6">
                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-700 leading-relaxed italic">
                                        💡 ここでのプレビューは、実際にユーザー画面で「制約」と「旧要件」が挿入された状態のシミュレーションです。
                                    </div>
                                    <div className="space-y-4">
                                        <div className="text-xs font-bold text-slate-400 uppercase">Output Prompt Preview:</div>
                                        <div className="p-5 bg-slate-900 text-slate-100 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap border-2 border-slate-800 shadow-inner">
                                            {viewing.content
                                                .replace(/{{\s*constraints\s*}}/g, "[ダミー制約：データ正規化の徹底, 高可用なインフラ構成]")
                                                .replace(/{{\s*old_requirements\s*}}/g, "[ダミー旧要件：オンプレミスでの運用を前提とした既存の基幹システムを、セキュアにクラウド移行したい。]")
                                            }
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-xs font-bold text-slate-400 uppercase">Template Definition:</div>
                                    <div className="p-6 bg-slate-50 text-slate-700 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                                        {renderPromptContent(viewing.content)}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 sticky bottom-0">
                            <button onClick={() => { setViewing(null); setPreviewMode(false); }} className="px-5 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition">閉じる</button>
                            <button
                                onClick={(e) => {
                                    const p = viewing;
                                    setViewing(null);
                                    setPreviewMode(false);
                                    setEditing(p);
                                }}
                                className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 shadow-md transition"
                            >
                                このまま編集する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {prompts.map(p => (
                    <div
                        key={p.id}
                        onClick={() => setViewing(p)}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-start">
                            <h4 className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors uppercase tracking-tight">{p.title}</h4>
                            <div className="flex space-x-1">
                                <button
                                    onClick={(e) => handleDuplicate(p, e)}
                                    title="複製"
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                                    title="編集"
                                    className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                    onClick={(e) => handleDelete(p.id, e)}
                                    title="削除"
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-5 flex-1 bg-gradient-to-br from-white to-slate-50/30">
                            <p className="text-sm text-slate-500 whitespace-pre-wrap overflow-hidden leading-relaxed italic" style={{ display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
                                {p.content}
                            </p>
                        </div>
                        <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">View Details →</span>
                            <div className="flex -space-x-1">
                                {p.content.includes('{{') && (
                                    <span className="w-5 h-5 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-amber-700" title="変数を含む">V</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// === 3. Constraints Panel ===
function ConstraintsPanel({ showToast, askConfirm }: any) {
    const [constraints, setConstraints] = useState<any[]>([]);
    const [editing, setEditing] = useState<any>(null);

    const fetchConstraints = async () => {
        const res = await fetch('/api/admin/constraints');
        if (res.ok) setConstraints((await res.json()).constraints);
    };
    useEffect(() => { fetchConstraints(); }, []);

    // カテゴリごとにグループ化
    const grouped = useMemo(() => {
        return constraints.reduce((acc, curr) => {
            const key = [curr.mainCategory ?? curr.main_category, curr.subCategory ?? curr.sub_category].filter(Boolean).join(' / ') || 'Uncategorized';
            (acc[key] = acc[key] || []).push(curr);
            return acc;
        }, {} as Record<string, any[]>);
    }, [constraints]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const mainCategory = fd.get('mainCategory') as string;
        const subCategory = fd.get('subCategory') as string;
        const detailCategory = fd.get('detailCategory') as string;
        const description = fd.get('description') as string;

        askConfirm(`制約を保存しますか？`, async () => {
            const isNew = !editing?.id;
            const url = isNew ? '/api/admin/constraints' : `/api/admin/constraints/${editing.id}`;
            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mainCategory, subCategory, detailCategory, description })
            });
            if (res.ok) {
                showToast(`制約を保存しました`);
                setEditing(null);
                fetchConstraints();
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(`保存に失敗しました: ${errData.error || res.statusText}`, 'error');
            }
        });
    };

    const handleDelete = (id: string) => {
        askConfirm('この制約を削除しますか？', async () => {
            const res = await fetch(`/api/admin/constraints/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('削除しました');
                fetchConstraints();
            } else {
                showToast('削除に失敗しました', 'error');
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex pl-1">
                <button onClick={() => setEditing({ mainCategory: '', subCategory: '', detailCategory: '', description: '' })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 shadow-sm transition">
                    + 新規制約を作成
                </button>
            </div>

            {editing && (
                <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in-up">
                    <h3 className="font-bold text-lg mb-4">{editing.id ? '制約の編集' : '新規制約'}</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input required name="mainCategory" defaultValue={editing.mainCategory ?? editing.main_category} placeholder="Main Category" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                            <input required name="subCategory" defaultValue={editing.subCategory ?? editing.sub_category} placeholder="Sub Category" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                            <input required name="detailCategory" defaultValue={editing.detailCategory ?? editing.detail_category} placeholder="Detail Category" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                        </div>
                        <textarea required name="description" defaultValue={editing.description} rows={3} placeholder="制約内容..." className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                        <div className="flex justify-end space-x-2 pt-2">
                            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">キャンセル</button>
                            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 shadow-sm">保存する</button>
                        </div>
                    </div>
                </form>
            )}

            {/* カテゴリごとに表示 */}
            <div className="space-y-8">
                {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100/70 border-b border-slate-200 px-5 py-3 flex items-center">
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">CATEGORY</span>
                            <h3 className="ml-3 font-bold text-slate-800 text-lg">{category}</h3>
                        </div>
                        <ul className="divide-y divide-slate-100">
                            {(items as any[]).map(item => (
                                <li key={item.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition">
                                    <div className="text-slate-700">
                                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 mr-2">
                                            {item.detailCategory ?? item.detail_category}
                                        </span>
                                        <span>{item.description}</span>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition flex space-x-3 ml-4">
                                        <button onClick={() => setEditing(item)} className="text-blue-500 text-sm hover:underline">編集</button>
                                        <button onClick={() => handleDelete(item.id)} className="text-red-500 text-sm hover:underline">削除</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}
