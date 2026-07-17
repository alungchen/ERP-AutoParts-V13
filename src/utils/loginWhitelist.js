import { apiUrl } from '../lib/apiUrl';
import { useEmployeeStore } from '../store/useEmployeeStore';

/**
 * 取得最新員工名單：優先抓 D1 的 erp-employee-store 快照
 * （登入頁可能早於 bootstrapFromD1 完成），失敗時退回本機 store。
 */
export async function fetchLatestEmployees() {
    try {
        const res = await fetch(apiUrl('/api/stores'));
        if (res.ok) {
            const data = await res.json();
            const incoming = data?.stores && typeof data.stores === 'object' ? data.stores : data;
            let snapshot = incoming?.['erp-employee-store'];
            if (typeof snapshot === 'string') {
                try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
            }
            const list = snapshot?.state?.employees;
            if (Array.isArray(list) && list.length > 0) return list;
        }
    } catch {
        /* 離線或 API 失敗時退回本機快取 */
    }
    return useEmployeeStore.getState().employees || [];
}

/** 寫入登入紀錄（fire-and-forget，失敗不影響登入流程） */
export function recordLoginLog({ email, result, reason = '', empId = '', empName = '' }) {
    try {
        fetch(apiUrl('/api/login-logs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, result, reason, emp_id: empId, emp_name: empName }),
        }).catch(() => {});
    } catch {
        /* 忽略記錄失敗 */
    }
}

/** 內建示範員工的假 Email（@arufa.com），不能算進白名單，否則會把真實使用者鎖在門外 */
const DEMO_EMAIL_RE = /@arufa\.com$/i;

/**
 * 白名單比對。回傳：
 *   { mode: 'ok', employee }      — 通過，employee 為對應員工
 *   { mode: 'denied', reason }    — 擋下（未授權 / 已停用 / 非在職）
 *   { mode: 'unconfigured' }      — 名單中沒有任何員工綁定 email（防鎖死相容模式）
 */
export function matchAuthorizedEmployee(employees, email) {
    const normalized = (email || '').trim().toLowerCase();
    const bound = (employees || []).filter((e) => {
        const em = (e.email || '').trim();
        return em && !DEMO_EMAIL_RE.test(em);
    });
    if (bound.length === 0) return { mode: 'unconfigured' };

    const employee = bound.find((e) => (e.email || '').trim().toLowerCase() === normalized);
    if (!employee) {
        return { mode: 'denied', reason: '此帳號尚未被授權使用本系統，請聯絡管理員將您的 Email 加入員工名單。' };
    }
    if (employee.status !== '在職') {
        return { mode: 'denied', reason: `此帳號的員工狀態為「${employee.status || '未設定'}」，已停止系統存取。` };
    }
    if (employee.can_login === false) {
        return { mode: 'denied', reason: '此帳號的登入權限已被管理員停用，請聯絡管理員。' };
    }
    return { mode: 'ok', employee };
}
