import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import MainGenerator from './components/MainGenerator';
import VerificationZone from './components/VerificationZone';

// 簡易的なログインUI
function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDevLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/dev-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (res.ok) {
                onLoginSuccess(data.user);
            } else {
                setError(data.error || 'ログインに失敗しました');
            }
        } catch (err) {
            setError('ネットワークエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                <h1 className="text-2xl font-bold text-center text-teal-700 mb-6">ワクワク試作室 : Real Wall</h1>
                <p className="text-sm text-slate-500 mb-6 text-center">アクセスするにはログインしてください</p>

                {/* 開発時の簡易ログインフォーム */}
                <form onSubmit={handleDevLogin} className="space-y-4 border-t pt-6">
                    <p className="text-xs font-bold text-indigo-500 bg-indigo-50 p-2 rounded text-center">開発用ダミーログイン</p>
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="メールアドレス (INITIAL_ADMIN_GMAILで管理者)"
                        className="w-full p-3 border rounded focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-800 text-white font-bold py-3 rounded hover:bg-slate-900 transition disabled:opacity-50"
                    >
                        {loading ? 'ログイン中...' : 'ログイン (Dev)'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function App() {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'main' | 'verify' | 'admin'>('main');

    useEffect(() => {
        // セッションチェック
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                }
            } catch (err) {
                console.error('Session check failed', err);
            } finally {
                setIsLoading(false);
            }
        };
        checkSession();
    }, []);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
    }

    // ログインしていない場合
    if (!user) {
        return <LoginScreen onLoginSuccess={setUser} />;
    }

    // アカウント無効化されている場合
    if (user.isActive === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md bg-white p-8 rounded-2xl shadow-xl border-t-4 border-red-500 text-center">
                    <div className="text-5xl mb-4">🚫</div>
                    <h2 className="text-xl font-bold text-red-700 mb-2">アカウント無効</h2>
                    <p className="text-slate-600">このアカウントは管理者によって無効化されています。アクセスできません。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* 統一ナビゲーションバー */}
            <nav className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40 h-16 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <h1 className="text-xl font-bold text-teal-700">ワクワク試作室</h1>

                        <div className="flex space-x-1 pl-6 border-l border-slate-200">
                            <button
                                onClick={() => setView('main')}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${view === 'main' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                生成 (Main)
                            </button>
                            <button
                                onClick={() => setView('verify')}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${view === 'verify' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                検証 (Verify)
                            </button>

                            {user.role === 'admin' && (
                                <button
                                    onClick={() => setView('admin')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${view === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    管理 (Admin)
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                            <div className="text-sm font-bold text-slate-800">{user.name}</div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">{user.role}</div>
                        </div>
                        <button
                            onClick={() => {
                                // セッション破棄は今回省略(CookieをJSで消すかログアウトAPIを呼ぶ)
                                document.cookie = 'session_token=; Max-Age=0; path=/;';
                                setUser(null);
                            }}
                            className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-100 text-slate-600 transition"
                        >
                            ログアウト
                        </button>
                    </div>
                </div>
            </nav>

            {/* コンテンツの切り替え */}
            <main>
                {view === 'main' && <MainGenerator user={user} />}
                {view === 'verify' && <VerificationZone />}
                {view === 'admin' && user.role === 'admin' && <AdminDashboard currentUserId={user.id} />}
            </main>
        </div>
    );
}
