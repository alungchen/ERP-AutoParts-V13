/**
 * 將本地 D1 已有、但線上 API 缺少的單據補傳到遠端。
 *
 * 使用時機：先前用 --target=local 同步後，共用狀態已前進，導致 api 模式跳過重抓。
 *
 * 用法:
 *   node scripts/push_local_docs_to_api.cjs
 *   node scripts/push_local_docs_to_api.cjs --from=2026-09-01 --to=2026-09-01
 *   node scripts/push_local_docs_to_api.cjs --dry-run
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'erp-db';
const ROOT_DIR = path.join(__dirname, '..');
const args = process.argv.slice(2);
const getArg = (name, def) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const hasFlag = (name) => args.includes(`--${name}`);

const DATE_FROM = getArg('from', '2026-09-01');
const DATE_TO = getArg('to', DATE_FROM);
const API_BASE = getArg('api-base', 'https://erp-autoparts-v13.pages.dev').replace(/\/$/, '');
const DRY_RUN = hasFlag('dry-run');
const BRANCHES = ['songshan', 'xizhi'];
const PROCUREMENT_TYPES = new Set(['purchase', 'purchaseReturn', 'inquiry']);

function runLocalJson(sql) {
  const out = execSync(
    `npx wrangler d1 execute ${DB_NAME} --local --command=${JSON.stringify(sql)} --json`,
    { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(out)[0]?.results || [];
}

async function apiRequest(branchId, apiPath, options = {}) {
  const res = await fetch(`${API_BASE}${apiPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Active-Branch': branchId,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep text
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.error ? data.error : String(text).slice(0, 300);
    throw new Error(msg);
  }
  return data;
}

async function listRemoteDocIds(branchId, dateFrom, dateTo) {
  const ids = new Set();
  let offset = 0;
  for (;;) {
    const docs = await apiRequest(branchId, `/api/documents?limit=500&offset=${offset}`);
    const list = Array.isArray(docs) ? docs : [];
    if (list.length === 0) break;
    for (const row of list) {
      const d = String(row.date || '');
      if (d >= dateFrom && d <= dateTo && row.doc_id) {
        ids.add(String(row.doc_id).toUpperCase());
      }
    }
    if (list.length < 500) break;
    offset += 500;
  }
  return ids;
}

function buildApiPayload(doc, items) {
  const partyField = PROCUREMENT_TYPES.has(doc.type) ? 'supplier_name' : 'customer_name';
  const partyValue = PROCUREMENT_TYPES.has(doc.type) ? (doc.supplier_name || '') : (doc.customer_name || '');
  return {
    doc_id: doc.doc_id,
    type: doc.type,
    date: doc.date,
    status: doc.status || 'completed',
    branch_id: doc.branch_id,
    notes: doc.notes || '',
    [partyField]: partyValue,
    items: (items || []).map((it) => ({
      p_id: it.p_id || '',
      part_number: it.part_number || it.p_id || '',
      name: it.name || '',
      qty: Number(it.qty) || 0,
      unit_price: Number(it.unit_price) || 0,
      unit: it.unit || 'PCS',
      note: it.note || '',
      location_code: it.location_code || 'A1',
    })),
  };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('📤 本地 D1 → 線上 API 單據補傳');
  console.log(`   期間: ${DATE_FROM} ~ ${DATE_TO}`);
  console.log(`   API: ${API_BASE}${DRY_RUN ? '（dry-run）' : ''}`);
  console.log('═'.repeat(60));

  const localDocs = runLocalJson(
    `SELECT doc_id, type, date, status, notes, branch_id, customer_name, supplier_name ` +
    `FROM documents WHERE date >= '${DATE_FROM}' AND date <= '${DATE_TO}' ORDER BY doc_id`,
  );
  if (localDocs.length === 0) {
    console.log('本地此期間沒有單據，結束。');
    return;
  }

  const remoteIds = new Set();
  for (const branch of BRANCHES) {
    const ids = await listRemoteDocIds(branch, DATE_FROM, DATE_TO);
    ids.forEach((id) => remoteIds.add(id));
  }

  const missing = localDocs.filter((d) => !remoteIds.has(String(d.doc_id).toUpperCase()));
  console.log(`\n本地 ${localDocs.length} 張｜線上已有 ${remoteIds.size} 張｜待補傳 ${missing.length} 張`);

  if (missing.length === 0) {
    console.log('✅ 無需補傳。');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const doc of missing) {
    const items = runLocalJson(`SELECT * FROM document_items WHERE doc_id = '${String(doc.doc_id).replace(/'/g, "''")}'`);
    const payload = buildApiPayload(doc, items);
    if (DRY_RUN) {
      console.log(`  [dry-run] ${doc.doc_id}（${items.length} 筆明細）`);
      ok++;
      continue;
    }
    try {
      await apiRequest(doc.branch_id || 'songshan', '/api/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      ok++;
      console.log(`  ✅ ${doc.doc_id}`);
    } catch (e) {
      fail++;
      console.log(`  ❌ ${doc.doc_id}: ${e.message}`);
    }
  }

  console.log(`\n補傳完成: 成功 ${ok} / 失敗 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('執行失敗:', e.message);
  process.exit(1);
});
