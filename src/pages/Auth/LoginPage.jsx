import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAppStore } from '../../store/useAppStore';

const LoginPage = () => {
    const navigate = useNavigate();
    const { employees = [] } = useEmployeeStore();
    const { loginAsEmployee } = useAppStore();
    const [empId, setEmpId] = useState(employees[0]?.emp_id || '');

    const selected = useMemo(
        () => employees.find((e) => e.emp_id === empId),
        [employees, empId]
    );

    return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-primary)', padding: '1rem' }}>
            <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
                    <ShieldCheck size={22} />
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>登入系統</h1>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginBottom: '1rem' }}>
                    已啟用登入與權限控制。請選擇員工帳號登入。
                </p>

                <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>員工帳號</label>
                    <select
                        value={empId}
                        onChange={(e) => setEmpId(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    >
                        {employees.map((e) => (
                            <option key={e.emp_id} value={e.emp_id}>{e.emp_id} | {e.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    角色：{selected?.permission_role || '一般'}
                </div>

                <button
                    type="button"
                    onClick={() => {
                        if (!empId) return;
                        loginAsEmployee(empId);
                        navigate('/', { replace: true });
                    }}
                    style={{ width: '100%', border: 'none', borderRadius: '8px', padding: '0.62rem', fontWeight: 800, color: 'white', background: 'var(--accent-primary)', cursor: 'pointer' }}
                >
                    登入
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
