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
            }
        });
    };

    const handleDelete = (id: string) => {
        askConfirm('本当にこのプロンプトを削除しますか？', async () => {
            const res = await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('削除しました');
                fetchPrompts();
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex pl-1">
                <button onClick={() => setEditing({ title: '', content: '' })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 shadow-sm transition">
                    + 新規プロンプト作成
                </button>
            </div>

            {editing && (
                <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in-up">
                    <h3 className="font-bold text-lg mb-4">{editing.id ? 'プロンプト編集' : '新規プロンプト'}</h3>
                    <div className="space-y-4">
                        <input required name="title" defaultValue={editing.title} placeholder="タイトル (例: Review Master)" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                        <textarea required name="content" defaultValue={editing.content} rows={5} placeholder="プロンプト本文..." className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                        <div className="flex justify-end space-x-2 pt-2">
                            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">キャンセル</button>
                            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 shadow-sm">保存する</button>
                        </div>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {prompts.map(p => (
                    <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition group flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-800">{p.title}</h4>
                            <div className="opacity-0 group-hover:opacity-100 transition flex space-x-2">
                                <button onClick={() => setEditing(p)} className="text-blue-500 text-sm hover:underline">編集</button>
                                <button onClick={() => handleDelete(p.id)} className="text-red-500 text-sm hover:underline">削除</button>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap flex-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                            {p.content}
                        </p>
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
            (acc[curr.category] = acc[curr.category] || []).push(curr);
            return acc;
        }, {} as Record<string, any[]>);
    }, [constraints]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const category = fd.get('category') as string;
        const description = fd.get('description') as string;

        askConfirm(`制約を保存しますか？`, async () => {
            const isNew = !editing?.id;
            const url = isNew ? '/api/admin/constraints' : `/api/admin/constraints/${editing.id}`;
            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, description })
            });
            if (res.ok) {
                showToast(`制約を保存しました`);
                setEditing(null);
                fetchConstraints();
            }
        });
    };

    const handleDelete = (id: string) => {
        askConfirm('この制約を削除しますか？', async () => {
            const res = await fetch(`/api/admin/constraints/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('削除しました');
                fetchConstraints();
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex pl-1">
                <button onClick={() => setEditing({ category: '', description: '' })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 shadow-sm transition">
                    + 新規制約を作成
                </button>
            </div>

            {editing && (
                <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in-up">
                    <h3 className="font-bold text-lg mb-4">{editing.id ? '制約の編集' : '新規制約'}</h3>
                    <div className="space-y-4">
                        <input required name="category" defaultValue={editing.category} placeholder="カテゴリ (例: SECURITY, UI)" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none" />
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
                                    <p className="text-slate-700">{item.description}</p>
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
