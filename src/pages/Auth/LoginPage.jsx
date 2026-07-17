import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, LogIn } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from '../../firebase';
import { useAppStore } from '../../store/useAppStore';
import { fetchLatestEmployees, matchAuthorizedEmployee, recordLoginLog } from '../../utils/loginWhitelist';

const LoginPage = () => {
    const navigate = useNavigate();
    const { loginAsEmployee } = useAppStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    /** Firebase 驗證成功後的白名單把關；通過才真正進入系統 */
    const completeLogin = async (firebaseUser) => {
        const employees = await fetchLatestEmployees();
        const gate = matchAuthorizedEmployee(employees, firebaseUser.email);

        if (gate.mode === 'denied') {
            recordLoginLog({ email: firebaseUser.email, result: 'denied', reason: gate.reason });
            await signOut(auth).catch(() => {});
            setErrorMsg(gate.reason);
            return;
        }

        if (gate.mode === 'unconfigured') {
            // 防鎖死相容模式：尚無任何員工綁定 Email，先放行
            recordLoginLog({ email: firebaseUser.email, result: 'success', reason: '相容模式（尚未設定白名單）' });
            loginAsEmployee(firebaseUser.email, firebaseUser.photoURL || '', firebaseUser.email);
            alert('提醒：目前尚無任何員工綁定「系統登入帳號 (Email)」，暫不限制登入。\n請盡快至「供應商/客戶/員工 → 員工」為每位員工填寫 Email 並設定權限角色，之後系統將只允許名單內的帳號登入。');
            navigate('/', { replace: true });
            return;
        }

        recordLoginLog({ email: firebaseUser.email, result: 'success', empId: gate.employee.emp_id, empName: gate.employee.name });
        loginAsEmployee(gate.employee.emp_id, firebaseUser.photoURL || '', firebaseUser.email);
        navigate('/', { replace: true });
    };

    const handleGoogleLogin = async () => {
        try {
            setErrorMsg('');
            setLoading(true);
            const result = await signInWithPopup(auth, googleProvider);
            await completeLogin(result.user);
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
            const result = await signInWithEmailAndPassword(auth, email, password);
            await completeLogin(result.user);
        } catch (error) {
            console.error(error);
            // 處理 Firebase 常見錯誤訊息
            if (error.code === 'auth/invalid-credential') {
                recordLoginLog({ email, result: 'failed', reason: '帳號或密碼錯誤' });
                setErrorMsg('帳號或密碼錯誤');
            } else {
                setErrorMsg('登入失敗：' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setErrorMsg('請先輸入您的電子信箱，再點擊忘記密碼。');
            return;
        }
        try {
            setErrorMsg('');
            setLoading(true);
            await sendPasswordResetEmail(auth, email);
            alert('重設密碼信件已發送至您的信箱，請查看。');
        } catch (error) {
            console.error(error);
            setErrorMsg('發送失敗：' + error.message);
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
                        登入 ERP 系統
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
                        僅限公司授權的員工帳號登入，如需開通請聯絡管理員。
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>密碼</label>
                            <button 
                                type="button" 
                                onClick={handleForgotPassword}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                            >
                                忘記密碼？
                            </button>
                        </div>
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
                        {loading ? '處理中...' : <><LogIn size={18}/> 登入</>}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    帳號由管理員於「人事資料」中授權，恕不開放自行註冊。
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
