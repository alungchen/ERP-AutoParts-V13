/**
 * 台灣銀行牌告匯率（即期賣出）
 * CSV：https://rate.bot.com.tw/xrt/flcsv/0/day
 * 進口估價用「本行賣出／即期」＝買匯成本（1 外幣兌 TWD）。
 */

const BOT_CSV = 'https://rate.bot.com.tw/xrt/flcsv/0/day';
const WANTED = ['USD', 'EUR', 'JPY', 'CNY'];

function parseBotCsv(text) {
  const rates = {};
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const code = String(cols[0] || '').trim().toUpperCase();
    if (!WANTED.includes(code)) continue;
    const sellIdx = cols.findIndex((c) => String(c).includes('本行賣出'));
    if (sellIdx < 0) continue;
    const cashSell = Number(cols[sellIdx + 1]);
    const spotSell = Number(cols[sellIdx + 2]);
    const value = Number.isFinite(spotSell) && spotSell > 0 ? spotSell : cashSell;
    if (Number.isFinite(value) && value > 0) rates[code] = value;
  }
  return rates;
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

export async function onRequestGet() {
  try {
    const res = await fetch(BOT_CSV, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ERP-AutoParts/13; +https://rate.bot.com.tw)',
        Accept: 'text/csv,text/plain,*/*',
      },
    });
    if (!res.ok) {
      return json({ ok: false, error: `BOT HTTP ${res.status}` }, 502);
    }
    const csv = await res.text();
    const rates = parseBotCsv(csv);
    if (Object.keys(rates).length === 0) {
      return json({ ok: false, error: 'BOT CSV parse empty' }, 502);
    }
    return json(
      {
        ok: true,
        source: 'bot',
        quote: 'spot_sell',
        asOf: new Date().toISOString(),
        rates,
      },
      200,
      { 'Cache-Control': 'public, max-age=300' },
    );
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) }, 500);
  }
}
