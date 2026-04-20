import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, User, LogIn } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../../firebase';
import { useAppStore } from '../../store/useAppStore';

const LoginPage = () => {
    const navigate = useNavigate();
    const { loginAsEmployee } = useAppStore();
    
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        try {
            setErrorMsg('');
            setLoading(true);
            const result = await signInWithPopup(auth, googleProvider);
            if (result.user.email !== 'alung.chen@gmail.com') {
                setErrorMsg('拒絕存取：只有系統管理員 alung.chen@gmail.com 擁有登入權限。');
                // 為了安全，也可以在此呼叫 auth.signOut(), 但我們只擋住進入系統
                return;
            }
            // 這裡使用 Firebase 拿到的電子信箱作為員工 ID，並帶入 Google 大頭貼
            loginAsEmployee(result.user.email, result.user.photoURL);
            navigate('/', { replace: true });
        } catch (error) {
            console.error(error);
            setErrorMsg('Google 登入失敗：' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setErrorMsg('請輸入電子信箱與密碼');
            return;
        }
        
        try {
            setErrorMsg('');
            setLoading(true);
            
            let result;
            if (mode === 'login') {
                result = await signInWithEmailAndPassword(auth, email, password);
            } else {
                result = await createUserWithEmailAndPassword(auth, email, password);
            }
            if (result.user.email !== 'alung.chen@gmail.com') {
                setErrorMsg('拒絕存取：只有系統管理員 alung.chen@gmail.com 擁有登入權限。');
                return;
            }
            
            loginAsEmployee(result.user.email, result.user.photoURL);
            navigate('/', { replace: true });
        } catch (error) {
            console.error(error);
            // 處理 Firebase 常見錯誤訊息
            if (error.code === 'auth/invalid-credential') {
                setErrorMsg('帳號或密碼錯誤');
            } else if (error.code === 'auth/email-already-in-use') {
                setErrorMsg('此信箱已被註冊');
            } else if (error.code === 'auth/weak-password') {
                setErrorMsg('密碼太弱，至少需 6 個字元');
            } else {
                setErrorMsg('登入失敗：' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '1rem' }}>
            <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem' }}>
                    <div style={{ padding: '12px', background: 'var(--accent-subtle)', borderRadius: '50%', color: 'var(--accent-primary)' }}>
                        <ShieldCheck size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        {mode === 'login' ? '登入 ERP 系統' : '註冊新帳號'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
                        為了保護您的資料安全，請登入您的帳號以繼續操作。
                    </p>
                </div>

                {errorMsg && (
                    <div style={{ padding: '0.8rem', background: 'var(--danger-subtle)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid var(--danger)' }}>
                        {errorMsg}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    style={{ 
                        width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', 
                        fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-primary)', 
                        cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        marginBottom: '1.5rem', transition: 'all 0.2s', opacity: loading ? 0.7 : 1
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    使用 Google 帳號登入
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>或使用電子信箱</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                </div>

                <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>電子信箱</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>密碼</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', border: 'none', borderRadius: '8px', padding: '0.8rem', fontWeight: 800, color: 'white', background: 'var(--accent-primary)', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        {loading ? '處理中...' : (mode === 'login' ? <><LogIn size={18}/> 登入</> : <><User size={18}/> 註冊帳號</>)}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>{mode === 'login' ? '還沒有帳號嗎？' : '已經有帳號了？'}</span>
                    <button 
                        type="button" 
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrorMsg(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer', marginLeft: '6px' }}
                    >
                        {mode === 'login' ? '立即註冊' : '返回登入'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
