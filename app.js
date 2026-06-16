// 東京ラジオ プレゼント情報 - フロントエンドロジック

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? url : null;
  } catch { return null; }
}

function safeSnsHandle(raw) {
  return String(raw ?? '').replace('@', '').replace(/[^a-zA-Z0-9_.-]/g, '');
}

const STATIONS = {
  tbs:     { name: 'TBSラジオ',     freq: '954kHz',  color: '#c44030', type: 'am' },
  nippon:  { name: 'ニッポン放送',   freq: '1242kHz', color: '#0055a0', type: 'am' },
  bunka:   { name: '文化放送',       freq: '1134kHz', color: '#00873c', type: 'am' },
  tokyofm: { name: 'TOKYO FM',      freq: '80.0MHz', color: '#e8003d', type: 'fm' },
  jwave:   { name: 'J-WAVE',        freq: '81.3MHz', color: '#e05010', type: 'fm' },
  interfm: { name: 'InterFM897',    freq: '89.7MHz', color: '#7b2d8b', type: 'fm' },
  bayfm:   { name: 'bayfm',         freq: '78.0MHz', color: '#0088bb', type: 'fm' },
  nack5:   { name: 'NACK5',         freq: '79.5MHz', color: '#6aa800', type: 'fm' },
  nhkr1:   { name: 'NHKラジオ第1',  freq: '594kHz',  color: '#0077bb', type: 'nhk' },
  nhkr2:   { name: 'NHKラジオ第2',  freq: '693kHz',  color: '#005599', type: 'nhk' },
  nhkfm:   { name: 'NHK-FM',        freq: '82.5MHz', color: '#2a9a50', type: 'nhk' },
};

const grid = document.getElementById('grid');
const statsBar = document.getElementById('stats-bar');
const searchInput = document.getElementById('search');
const deadlineSelect = document.getElementById('deadline-filter');
const stationSelect = document.getElementById('station-filter');
const showExpiredCb = document.getElementById('show-expired');

let activeType = 'all';
let activeStation = 'all';
let showExpired = false;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// deadline が YYYY-MM-DD 形式でないものは「随時・毎週・毎月」などの継続企画とみなす
function isRecurring(deadline) {
  return !DATE_RE.test(String(deadline ?? ''));
}

function dayDiff(deadline) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  return Math.floor((d - today) / 86400000);
}

function deadlineStatus(deadline) {
  if (isRecurring(deadline)) {
    const known = ['随時', '毎週', '毎月', '毎日', '継続中'];
    const label = known.includes(deadline) ? deadline : '随時受付';
    return { label, cls: 'recurring', diff: null, recurring: true };
  }
  const diff = dayDiff(deadline);
  if (diff < 0)  return { label: '締切済み', cls: 'expired', diff };
  if (diff === 0) return { label: '本日締切！', cls: 'urgent', diff };
  if (diff === 1) return { label: '明日締切！', cls: 'urgent', diff };
  if (diff <= 7)  return { label: `あと${diff}日`, cls: 'soon', diff };
  return { label: `あと${diff}日`, cls: 'normal', diff };
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function snsIcon(type) {
  const icons = {
    twitter:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    instagram: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    web:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>',
  };
  return icons[type] || '';
}

function renderCard(entry) {
  const st = STATIONS[entry.stationId] || { name: entry.station, freq: '', color: '#555', type: entry.type || 'am' };
  const ds = deadlineStatus(entry.deadline);
  const isExpired = !ds.recurring && ds.diff < 0;
  const safeType = ['am', 'fm', 'nhk'].includes(st.type) ? st.type : 'am';

  const snsHtml = ['twitter', 'instagram', 'web']
    .filter(k => entry.sns && entry.sns[k])
    .map(k => {
      let url;
      if (k === 'twitter') {
        url = `https://x.com/${encodeURIComponent(safeSnsHandle(entry.sns[k]))}`;
      } else if (k === 'instagram') {
        url = `https://instagram.com/${encodeURIComponent(safeSnsHandle(entry.sns[k]))}`;
      } else {
        url = safeUrl(entry.sns[k]);
      }
      if (!url) return '';
      return `<a href="${esc(url)}" target="_blank" rel="noopener" class="sns-link ${k}" title="${k}">${snsIcon(k)}</a>`;
    }).join('');

  const applyUrl = safeUrl(entry.applyUrl);
  const programUrl = safeUrl(entry.programUrl);
  const applyBtn = isExpired
    ? `<span class="apply-btn disabled">締切済み</span>`
    : applyUrl
      ? `<a href="${esc(applyUrl)}" target="_blank" rel="noopener" class="apply-btn">応募する →</a>`
      : programUrl
        ? `<a href="${esc(programUrl)}" target="_blank" rel="noopener" class="apply-btn secondary">番組ページ →</a>`
        : `<span class="apply-btn disabled">番組内で応募</span>`;
  const programLabel = esc(entry.program);
  const programLink = programUrl
    ? `<a href="${esc(programUrl)}" target="_blank" rel="noopener">${programLabel}</a>`
    : programLabel;

  return `
<article class="card${isExpired ? ' expired' : ''}" data-type="${safeType}" data-station="${esc(entry.stationId)}">
  <div class="card-stripe" style="background:${esc(st.color)}"></div>
  <div class="card-head">
    <div class="card-head-right">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
        <span class="station-badge" style="background:${esc(st.color)}">${esc(st.name)}</span>
        <span class="type-pill ${safeType}">${safeType.toUpperCase()}</span>
        ${st.freq ? `<span class="freq">${esc(st.freq)}</span>` : ''}
      </div>
    </div>
  </div>
  <div class="card-body">
    <div class="program-name">${programLink}</div>
    <div class="prize-block">
      <div class="prize-label">プレゼント</div>
      <div class="prize-text">${esc(entry.prize || '詳細は公式サイトへ')}</div>
    </div>
    <div class="deadline-row">
      <span class="deadline-label">締切</span>
      <span class="deadline-badge ${ds.cls}">${esc(ds.label)}</span>
      <span class="deadline-date">${esc(ds.recurring ? '' : formatDate(entry.deadline))}</span>
    </div>
    ${entry.applyMethod ? `<div class="apply-method">📮 ${esc(entry.applyMethod)}</div>` : ''}
  </div>
  <div class="card-footer">
    <div class="sns-links">${snsHtml}</div>
    ${applyBtn}
  </div>
</article>`;
}

function applyFilters() {
  const keyword = (searchInput.value || '').trim().toLowerCase();
  const deadlineFilter = deadlineSelect.value;
  activeStation = stationSelect ? stationSelect.value : 'all';

  const filtered = (window.presentsData || []).filter(entry => {
    const st = STATIONS[entry.stationId] || {};
    const type = st.type || entry.type || 'am';
    if (activeType !== 'all' && type !== activeType) return false;
    if (activeStation !== 'all' && entry.stationId !== activeStation) return false;

    const ds = deadlineStatus(entry.deadline);
    const expired = !ds.recurring && ds.diff < 0;
    if (!showExpired && expired) return false;

    // 締切ウィンドウ指定時、随時・継続企画（特定締切なし）は対象外
    if (deadlineFilter !== 'all') {
      if (ds.recurring) return false;
      if (deadlineFilter === 'today' && (ds.diff < 0 || ds.diff > 1)) return false;
      if (deadlineFilter === 'week' && (ds.diff < 0 || ds.diff > 7)) return false;
      if (deadlineFilter === 'month' && (ds.diff < 0 || ds.diff > 31)) return false;
    }

    if (keyword) {
      const haystack = [
        entry.program, entry.prize, entry.station, st.name, entry.applyMethod
      ].join(' ').toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });

  // 並び順: 締切が近い日付あり → 随時・継続 → 締切済み
  const sorted = filtered.slice().sort((a, b) => {
    const sa = deadlineStatus(a.deadline);
    const sb = deadlineStatus(b.deadline);
    const ea = !sa.recurring && sa.diff < 0;
    const eb = !sb.recurring && sb.diff < 0;
    if (ea && !eb) return 1;
    if (eb && !ea) return -1;
    const ka = sa.recurring ? 1e7 : sa.diff;
    const kb = sb.recurring ? 1e7 : sb.diff;
    return ka - kb;
  });

  grid.innerHTML = sorted.length
    ? sorted.map(renderCard).join('')
    : `<div class="empty-state"><span class="icon">📭</span><h3>該当する情報がありません</h3><p>フィルターを変更するか、スケジュールタスクの更新をお待ちください</p></div>`;

  updateStats(filtered);
}

function updateStats(filtered) {
  const urgentCount = filtered.filter(e => { const ds = deadlineStatus(e.deadline); return !ds.recurring && ds.diff >= 0 && ds.diff <= 1; }).length;
  const soonCount   = filtered.filter(e => { const ds = deadlineStatus(e.deadline); return !ds.recurring && ds.diff >= 2 && ds.diff <= 7; }).length;
  const ongoingCount = filtered.filter(e => deadlineStatus(e.deadline).recurring).length;

  const config = window.siteConfig || {};
  const lastUpdText = config.lastUpdated ? `最終更新: ${esc(config.lastUpdated)}` : '';

  statsBar.innerHTML = `
    <span>${Number(filtered.length)}件表示</span>
    ${urgentCount ? `<span class="stat-chip urgent-chip">🔥 本日・明日締切 ${Number(urgentCount)}件</span>` : ''}
    ${soonCount   ? `<span class="stat-chip soon-chip">⏰ 今週締切 ${Number(soonCount)}件</span>` : ''}
    ${ongoingCount ? `<span class="stat-chip ongoing-chip">🔁 随時・継続 ${Number(ongoingCount)}件</span>` : ''}
    ${lastUpdText ? `<span style="margin-left:auto;color:var(--text-dim);font-size:11px">${lastUpdText}</span>` : ''}
  `;
}

function updateHeader() {
  const total = (window.presentsData || []).length;
  const active = (window.presentsData || []).filter(e => { const ds = deadlineStatus(e.deadline); return ds.recurring || ds.diff >= 0; }).length;
  document.getElementById('active-count').textContent = `${active}件募集中`;
  const config = window.siteConfig || {};
  if (config.lastUpdated) {
    document.getElementById('last-update').textContent = `更新: ${config.lastUpdated}`;
  }
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeType = btn.dataset.type;
    applyFilters();
  });
});

if (searchInput) searchInput.addEventListener('input', applyFilters);
if (deadlineSelect) deadlineSelect.addEventListener('change', applyFilters);
if (stationSelect) stationSelect.addEventListener('change', applyFilters);
if (showExpiredCb) {
  showExpiredCb.addEventListener('change', () => {
    showExpired = showExpiredCb.checked;
    applyFilters();
  });
}

updateHeader();
applyFilters();
