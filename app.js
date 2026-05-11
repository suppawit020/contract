// ==========================================
//  Contract Management App
//  Connects to Supabase — uses config.js
// ==========================================

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Icons (SVGs - No Emojis) ──────────────────────────────
const icons = {
    edit: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    trash: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    chevronRight: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>`
};

// ── State ──────────────────────────────────
let contracts = [];
let customers = [];
let users = [];
let editingId = null;
let editingGroupId = null;
let currentPage = 1;
const PAGE_SIZE = 20;
let totalCount = 0;
let searchQuery = '';
let filterStatus = '';
let filterType = '';
const tsInstances = {};

let marketingLines = [];
let linesTsInstances = {};

// ── Chart Instances ────────────────────────
let comparisonChartInstance = null;
let bdeChartInstance = null;
let principleChartInstance = null;
let trendChartInstance = null;

// ── Sidebar & Navigation ───────────────────
let sidebarCollapsed = true;

function toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('mobile-open');
    } else {
        document.getElementById('sidebar').style.width = '';
        document.getElementById('layout-wrapper').style.marginLeft = '';
        sidebarCollapsed = !sidebarCollapsed;
        document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    }
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('mobile-open');
}

function showPage(page) {
    document.getElementById('page-dashboard').style.display = 'none';
    document.getElementById('page-contracts').style.display = 'none';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById('page-' + page).style.display = 'block';
    document.getElementById('nav-' + page).classList.add('active');

    const labels = { dashboard: 'Dashboard', contracts: 'Contracts' };
    document.getElementById('breadcrumb-current').textContent = labels[page] || page;

    if (page === 'dashboard') {
        const activeView = document.getElementById('dashboard-view-selector').value;
        if (activeView === 'overview') {
            renderDashboard();
        } else if (activeView === 'bde') {
            renderBdeChart();
        } else if (activeView === 'brands') {
            renderPrincipleChart();
        }
    }

    closeSidebar();
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
        sidebarCollapsed = true;
        document.body.classList.add('sidebar-collapsed');
    }
}

// ── Dashboard Render ───────────────────────
function renderDashboard() {
    const seenGroups = new Set();
    let marketingCount = 0, yearlyCount = 0;
    let activeCount = 0, inactiveCount = 0;

    contracts.forEach(c => {
        if (c.contract_type === 'Marketing') {
            const key = c.contract_group_id || getGroupKey(c);
            if (seenGroups.has(key)) return;
            seenGroups.add(key);
            marketingCount++;
            if (!c.period || c.period === 'Active') activeCount++;
            else if (c.period === 'Inactive') inactiveCount++;
        } else {
            yearlyCount++;
            if (!c.period || c.period === 'Active') activeCount++;
            else if (c.period === 'Inactive') inactiveCount++;
        }
    });

    renderDonutChart('dash-type-chart', [
        { label: 'Marketing', value: marketingCount, color: '#f59e0b' },
        { label: 'Yearly', value: yearlyCount, color: '#0891b2' },
    ]);

    renderDonutChart('dash-status-chart', [
        { label: 'Active', value: activeCount, color: '#16a34a' },
        { label: 'Inactive', value: inactiveCount, color: '#94a3b8' },
    ]);

    renderTrendChart();
    renderComparisonChart();
}

function renderDonutChart(containerId, segments) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const total = segments.reduce((s, x) => s + x.value, 0);
    if (total === 0) {
        container.innerHTML = '<div class="dash-empty">No data available</div>';
        return;
    }

    const size = 120;
    const cx = size / 2;
    const cy = size / 2;
    const r = 44;
    const strokeW = 22;

    let currentAngle = -90;
    let paths = '';

    segments.forEach(seg => {
        if (seg.value === 0) return;
        const pct = seg.value / total;
        const angle = pct * 360;
        const startRad = (currentAngle * Math.PI) / 180;
        const endRad = ((currentAngle + angle) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        const largeArc = angle > 180 ? 1 : 0;
        paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${seg.color}" opacity="0.9"/>`;
        currentAngle += angle;
    });

    paths += `<circle cx="${cx}" cy="${cy}" r="${r - strokeW / 2 - 2}" fill="white"/>`;
    paths += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="18" font-weight="700" fill="#1a202c">${total}</text>`;
    paths += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" fill="#718096">TOTAL</text>`;

    const legendHtml = segments.map(seg => {
        const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
        return `<div class="legend-item">
            <div class="legend-dot" style="background:${seg.color}"></div>
            <span class="legend-label">${seg.label}</span>
            <span class="legend-value">${seg.value}</span>
            <span class="legend-pct">${pct}%</span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="donut-wrap">
            <svg class="donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>
            <div class="donut-legend">${legendHtml}</div>
        </div>`;
}

// ── Trend Analysis Chart (Line Chart) ──────────────────────
function renderTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    const period = document.getElementById('trend-period-selector').value;
    const timeData = new Map(); // Using Map to preserve chronological insertion order
    const now = new Date();

    contracts.forEach(c => {
        if (!c.created_at) return;
        const d = new Date(c.created_at);
        let label = '';

        if (period === 'daily') {
            const diffTime = now - d;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 30 && diffDays >= 0) {
                label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            }
        } else if (period === 'monthly') {
            if (d.getFullYear() === now.getFullYear()) {
                label = d.toLocaleDateString('en-GB', { month: 'short' });
            }
        } else if (period === 'yearly') {
            label = d.getFullYear().toString();
        }

        if (label) {
            timeData.set(label, (timeData.get(label) || 0) + 1);
        }
    });

    const labels = Array.from(timeData.keys());
    const data = Array.from(timeData.values());

    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Contracts',
                data: data,
                borderColor: '#0891b2',
                backgroundColor: 'rgba(8, 145, 178, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#0891b2'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)'
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: "'DM Sans', 'Sarabun', sans-serif" } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: "'DM Sans', 'Sarabun', sans-serif" } } }
            }
        }
    });
}

// ── Statistical Comparison Chart (Bar Chart) ───────────────
function renderComparisonChart() {
    const ctx = document.getElementById('comparisonChart');
    if (!ctx) return;

    const areaData = {};
    const seenGroups = new Set();

    contracts.forEach(c => {
        const type = c.contract_type || 'Yearly';
        const area = (c.customer && c.customer.region) ? c.customer.region : 'Unknown Area';

        if (type === 'Marketing') {
            const key = c.contract_group_id || getGroupKey(c);
            if (seenGroups.has(key)) return;
            seenGroups.add(key);
        }

        if (!areaData[area]) {
            areaData[area] = { Marketing: 0, Yearly: 0 };
        }
        areaData[area][type]++;
    });

    const labels = Object.keys(areaData).sort();
    const marketingCounts = labels.map(label => areaData[label].Marketing);
    const yearlyCounts = labels.map(label => areaData[label].Yearly);

    if (comparisonChartInstance) {
        comparisonChartInstance.destroy();
    }

    comparisonChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Marketing',
                    data: marketingCounts,
                    backgroundColor: '#f59e0b',
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Yearly',
                    data: yearlyCounts,
                    backgroundColor: '#0891b2',
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 20, font: { family: "'DM Sans', 'Sarabun', sans-serif", size: 13 } } },
                tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleFont: { family: "'DM Sans', 'Sarabun', sans-serif" }, bodyFont: { family: "'DM Sans', 'Sarabun', sans-serif" }, padding: 10, cornerRadius: 8 }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: "'DM Sans', 'Sarabun', sans-serif" } } },
                y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, font: { family: "'DM Sans', 'Sarabun', sans-serif" } } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

// ── BDE Performance Chart ───────────────────────────────
function renderBdeChart() {
    const ctx = document.getElementById('bdeChart');
    if (!ctx) return;

    const bdeCounts = {};
    contracts.forEach(c => {
        const bdeName = (c.bde_user && c.bde_user.name) ? c.bde_user.name : (c.bde_id || 'Unknown BDE');
        bdeCounts[bdeName] = (bdeCounts[bdeName] || 0) + 1;
    });

    const labels = Object.keys(bdeCounts).sort((a, b) => bdeCounts[b] - bdeCounts[a]);
    const data = labels.map(l => bdeCounts[l]);

    if (bdeChartInstance) bdeChartInstance.destroy();

    bdeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Contracts',
                data: data,
                backgroundColor: '#3b82f6',
                borderRadius: 4,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)' }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: "'DM Sans', 'Sarabun', sans-serif" } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: "'DM Sans', 'Sarabun', sans-serif" } } }
            }
        }
    });
}

// ── Top Principles Chart ───────────────────────────────
function renderPrincipleChart() {
    const ctx = document.getElementById('principleChart');
    if (!ctx) return;

    const pCounts = {};
    contracts.forEach(c => {
        if (!c.principle) return;
        const principles = c.principle.split(',').map(p => p.trim()).filter(p => p);
        principles.forEach(p => {
            pCounts[p] = (pCounts[p] || 0) + 1;
        });
    });

    const labels = Object.keys(pCounts).sort((a, b) => pCounts[b] - pCounts[a]).slice(0, 10);
    const data = labels.map(l => pCounts[l]);

    if (principleChartInstance) principleChartInstance.destroy();

    principleChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Contracts',
                data: data,
                backgroundColor: '#8b5cf6',
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)' }
            },
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1, font: { family: "'DM Sans', 'Sarabun', sans-serif" } } },
                y: { grid: { display: false }, ticks: { font: { family: "'DM Sans', 'Sarabun', sans-serif" } } }
            }
        }
    });
}


// ── Init ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('nav-dashboard').setAttribute('data-tooltip', 'Dashboard');
    document.getElementById('nav-contracts').setAttribute('data-tooltip', 'Contracts');

    if (window.innerWidth > 768) {
        sidebarCollapsed = true;
        document.body.classList.add('sidebar-collapsed');
    }

    document.getElementById('page-dashboard').style.display = 'block';
    document.getElementById('nav-dashboard').classList.add('active');
    document.getElementById('breadcrumb-current').textContent = 'Dashboard';

    await Promise.all([loadCustomers(), loadUsers(), initCreatableFields()]);
    await backfillMarketingGroupIds();
    await loadContracts();
    renderDashboard();
    setupEventListeners();
});

// ── Load Data Functions ────────────────────
async function loadCustomers() {
    const { data, error } = await supabaseClient.from('customers').select('customer_id, outlet_name, bde, province, region').order('outlet_name');
    if (error) { showToast('Load customers error: ' + error.message, 'error'); return; }
    customers = data || [];
    populateCustomerDropdown();
}

function populateCustomerDropdown() {
    const sel = document.getElementById('field-customer');
    if (tsInstances['field-customer']) { tsInstances['field-customer'].destroy(); delete tsInstances['field-customer']; }
    sel.innerHTML = '';

    const initialOptions = customers.map(c => ({
        value: String(c.customer_id),
        text: `${c.customer_id} — ${c.outlet_name || 'ไม่ระบุ'}`,
        bde: c.bde || '',
        region: c.region || '',
        province: c.province || ''
    }));

    if (window.TomSelect) {
        tsInstances['field-customer'] = new TomSelect('#field-customer', {
            options: initialOptions,
            valueField: 'value',
            labelField: 'text',
            searchField: ['text'],
            placeholder: 'Search Outlet...',
            dropdownParent: 'body',
            onChange: function (value) {
                const opt = this.options[value];
                if (opt) {
                    if (opt.bde) {
                        const matchedUser = users.find(u => u.user_id === opt.bde || u.name === opt.bde);
                        const bdeId = matchedUser ? matchedUser.user_id : opt.bde;
                        setTsValue('field-bde', bdeId);
                    } else {
                        clearTsField('field-bde');
                    }
                    const areaField = document.getElementById('field-area');
                    const provField = document.getElementById('field-province');
                    if (areaField) areaField.value = opt.region || '';
                    if (provField) provField.value = opt.province || '';
                } else {
                    clearTsField('field-bde');
                    const areaField = document.getElementById('field-area');
                    const provField = document.getElementById('field-province');
                    if (areaField) areaField.value = '';
                    if (provField) provField.value = '';
                }
            }
        });
    }
}

async function loadUsers() {
    const { data, error } = await supabaseClient.from('user_information').select('user_id, name').order('name');
    if (error) { return; }
    users = data || [];

    const sel = document.getElementById('field-bde');
    sel.innerHTML = '<option value="">-- Select BDE --</option>';
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.user_id;
        opt.textContent = u.name || u.user_id;
        sel.appendChild(opt);
    });

    if (window.TomSelect) {
        if (tsInstances['field-bde']) tsInstances['field-bde'].destroy();
        tsInstances['field-bde'] = new TomSelect('#field-bde', { searchField: ['text'], maxOptions: 200, placeholder: 'Search BDE...' });
        tsInstances['field-bde'].disable();
    }
}

async function initCreatableFields() {
    const { data } = await supabaseClient.from('contract').select('principle, brands, promotion, trade_deal');
    window._creatableOptions = {
        principle: collectOptions(data, 'principle'),
        brands: collectOptions(data, 'brands'),
        promotion: collectOptions(data, 'promotion'),
        trade_deal: collectOptions(data, 'trade_deal'),
    };

    const creatableFields = [
        { id: 'field-principle', field: 'principle', placeholder: 'Type or select Principle...' },
        { id: 'field-brands', field: 'brands', placeholder: 'Type or select Brand...' },
        { id: 'field-promotion', field: 'promotion', placeholder: 'Type or select Promotion...' },
        { id: 'field-trade-deal', field: 'trade_deal', placeholder: 'Type or select Trade Deal...' },
    ];

    creatableFields.forEach(({ id, field, placeholder }) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tomselect) { el.tomselect.destroy(); }
        tsInstances[id] = new TomSelect(el, {
            options: window._creatableOptions[field],
            items: [], create: true, createOnBlur: true, persist: true, maxItems: 1, placeholder,
            render: {
                option_create: (data) => `<div class="create">Add "<strong>${data.input}</strong>"</div>`,
                no_results: () => `<div class="no-results">No results found — Press Enter to add</div>`,
            },
        });
    });
}

function collectOptions(data, field) {
    const set = new Set();
    (data || []).forEach(r => {
        if (r[field]) {
            r[field].split(',').forEach(v => { const t = v.trim(); if (t) set.add(t); });
        }
    });
    return [...set].sort().map(v => ({ value: v, text: v }));
}

async function backfillMarketingGroupIds() {
    const { data, error } = await supabaseClient.from('contract').select('id, customer_id, bde_id, start_date, end_date, contract_group_id').eq('contract_type', 'Marketing').is('contract_group_id', null);
    if (error || !data || data.length === 0) return;
    const groups = {};
    data.forEach(r => {
        const key = [r.customer_id, r.bde_id || '', r.start_date || '', r.end_date || ''].join('|');
        if (!groups[key]) groups[key] = [];
        groups[key].push(r.id);
    });
    const updates = [];
    Object.values(groups).forEach(ids => {
        const gid = crypto.randomUUID();
        ids.forEach(id => updates.push({ id, contract_group_id: gid }));
    });
    if (updates.length === 0) return;
    for (let i = 0; i < updates.length; i += 50) {
        await supabaseClient.from('contract').upsert(updates.slice(i, i + 50), { onConflict: 'id' });
    }
}

async function loadContracts() {
    showTableLoading(true);
    let query = supabaseClient.from('contract').select(`*, customer:customers!contract_customer_id_fkey (customer_id, outlet_name, province, region, company_name), bde_user:user_information!contract_bde_id_fkey (user_id, name)`);
    if (searchQuery) query = query.or(`contract_id.ilike.%${searchQuery}%,promotion.ilike.%${searchQuery}%,principle.ilike.%${searchQuery}%`);
    if (filterStatus) query = query.eq('period', filterStatus);
    if (filterType) query = query.eq('contract_type', filterType);

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;
    showTableLoading(false);
    if (error) { showToast('Failed to load data: ' + error.message, 'error'); return; }

    contracts = data || [];
    renderTable();
    updateStats();

    if (document.getElementById('page-dashboard').style.display !== 'none') {
        const activeView = document.getElementById('dashboard-view-selector').value;
        if (activeView === 'overview') renderDashboard();
        else if (activeView === 'bde') renderBdeChart();
        else if (activeView === 'brands') renderPrincipleChart();
    }
}

function getGroupKey(c) {
    const cid = c.customer_id || 'no_cid';
    const start = c.start_date || 'no_start';
    const end = c.end_date || 'no_end';
    return `grp_${cid}_${start}_${end}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ── Render Table ───────────────────────────
function renderTable() {
    const tbody = document.getElementById('contracts-tbody');
    if (contracts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="18" class="empty-state">No contracts found.</td></tr>`;
        totalCount = 0; renderPagination(); return;
    }
    const rows = [];
    const groupMap = {};
    contracts.forEach(c => {
        if (c.contract_type === 'Marketing') {
            const groupKey = c.contract_group_id || getGroupKey(c);
            if (groupMap[groupKey] !== undefined) rows[groupMap[groupKey]].lines.push(c);
            else { groupMap[groupKey] = rows.length; rows.push({ type: 'marketing-group', groupId: groupKey, header: c, lines: [c] }); }
        } else {
            rows.push({ type: 'yearly', contract: c });
        }
    });

    let mCount = 1, yCount = 1;
    rows.forEach(row => { if (row.type === 'marketing-group') row.no = mCount++; else row.no = yCount++; });

    totalCount = rows.length;
    renderPagination();
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

    let html = '';
    pageRows.forEach(row => {
        if (row.type === 'yearly') html += renderYearlyRow(row.contract, row.no);
        else html += renderMarketingGroup(row, row.no);
    });
    tbody.innerHTML = html;
}

function renderYearlyRow(c, no) {
    const customer = c.customer || {};
    const bdeUser = c.bde_user || {};
    return `
    <tr class="table-row" data-id="${c.id}">
      <td class="col-no"><div class="no-wrapper"><div class="no-icon-slot"></div> <span style="font-weight: 500; color: var(--text);">${no}</span></div></td>
      <td class="col-code">${escHtml(customer.customer_id || c.customer_id || '—')}</td>
      <td class="col-company">${escHtml(customer.company_name || customer.company || '—')}</td>
      <td class="col-outlet">${escHtml(customer.outlet_name || '—')}</td>
      <td class="col-area">${escHtml(customer.region || '—')}</td>
      <td class="col-province">${escHtml(customer.province || '—')}</td>
      <td class="col-type"><span class="type-badge type-yearly">Yearly</span></td>
      <td class="col-promo">${escHtml(c.promotion || '—')}</td>
      <td class="col-trade">${escHtml(c.trade_deal || '—')}</td>
      <td class="col-bde">${escHtml(bdeUser.name || c.bde_id || '—')}</td>
      <td class="col-start">${c.start_date ? formatDate(c.start_date) : '—'}</td>
      <td class="col-end">${getEndColumnHtml(c.end_date)}</td>
      <td class="col-remark">${escHtml(c.support || '—')}</td>
      <td class="col-received">${c.created_at ? formatMonthYear(c.created_at) : '—'}</td>
      <td class="col-status"><span class="badge ${getStatusBadge(c.period)}">${escHtml(c.period || 'Active')}</span></td>
      <td class="col-principle">${escHtml(c.principle || '—')}</td>
      <td class="col-brand">${escHtml(c.brands || '—')}</td>
      <td class="col-actions">
        <button class="btn-icon btn-edit" onclick="openEditModal('${c.id}')" title="Edit">${icons.edit}</button>
        <button class="btn-icon btn-delete" onclick="confirmDelete('${c.id}', '${escHtml(customer.outlet_name || c.contract_id)}')" title="Delete">${icons.trash}</button>
      </td>
    </tr>`;
}

function renderMarketingGroup(row, no) {
    const c = row.header;
    const customer = c.customer || {};
    const bdeUser = c.bde_user || {};
    const gid = escHtml(row.groupId);
    const expandBtn = row.lines.length > 1 ? `<button class="btn-expand" id="expand-btn-${gid}" onclick="toggleGroup('${gid}')" title="View Lines">${icons.chevronRight}</button>` : ``;

    let html = `
    <tr class="table-row marketing-group-header" data-group="${gid}">
      <td class="col-no"><div class="no-wrapper"><div class="no-icon-slot">${expandBtn}</div><span style="font-weight: 500; color: var(--text);">${no}</span></div></td>
      <td class="col-code">${escHtml(customer.customer_id || c.customer_id || '—')}</td>
      <td class="col-company">${escHtml(customer.company_name || customer.company || '—')}</td>
      <td class="col-outlet">${escHtml(customer.outlet_name || '—')}</td>
      <td class="col-area">${escHtml(customer.region || '—')}</td>
      <td class="col-province">${escHtml(customer.province || '—')}</td>
      <td class="col-type"><span class="type-badge type-marketing">Marketing</span></td>
      <td class="col-promo" title="${escHtml(c.promotion || '—')}">${escHtml(truncate(c.promotion || '—', 20))}</td>
      <td class="col-trade" title="${escHtml(c.trade_deal || '—')}">${escHtml(truncate(c.trade_deal || '—', 20))}</td>
      <td class="col-bde">${escHtml(bdeUser.name || c.bde_id || '—')}</td>
      <td class="col-start">${c.start_date ? formatDate(c.start_date) : '—'}</td>
      <td class="col-end">${getEndColumnHtml(c.end_date)}</td>
      <td class="col-remark">${escHtml(c.support || '—')}</td>
      <td class="col-received">${c.created_at ? formatMonthYear(c.created_at) : '—'}</td>
      <td class="col-status"><span class="badge ${getStatusBadge(c.period)}">${escHtml(c.period || 'Active')}</span></td>
      <td class="col-principle" title="${escHtml(c.principle || '—')}">${escHtml(truncate(c.principle || '—', 20))}</td>
      <td class="col-brand" title="${escHtml(c.brands || '—')}">${escHtml(truncate(c.brands || '—', 20))}</td>
      <td class="col-actions">
        <button class="btn-icon btn-edit" onclick="openEditMarketingGroup('${gid}')" title="Edit Primary Record">${icons.edit}</button>
        <button class="btn-icon btn-delete" onclick="confirmDeleteGroup('${gid}', '${escHtml(customer.outlet_name || '')}')" title="Delete Group">${icons.trash}</button>
      </td>
    </tr>`;

    row.lines.slice(1).forEach((line, idx) => {
        html += `
    <tr class="table-row marketing-line-row" id="line-row-${gid}-${idx}" style="display:none;" data-group="${gid}">
      <td class="col-no"><div class="no-wrapper line-indent" style="color: var(--text-3);"><div class="no-icon-slot" style="font-size: 13px;">└</div><span></span></div></td>
      <td class="col-code" style="color: var(--text-3); font-weight: normal;">${escHtml(customer.customer_id || line.customer_id || '—')}</td>
      <td class="col-company" style="color: var(--text-3);">${escHtml(customer.company_name || customer.company || '—')}</td>
      <td class="col-outlet" style="color: var(--text-3);">${escHtml(customer.outlet_name || '—')}</td>
      <td class="col-area" style="color: var(--text-3);">${escHtml(customer.region || '—')}</td>
      <td class="col-province" style="color: var(--text-3);">${escHtml(customer.province || '—')}</td>
      <td class="col-type"><span class="type-badge type-marketing">Marketing</span></td>
      <td class="col-promo">${escHtml(line.promotion || '—')}</td>
      <td class="col-trade">${escHtml(line.trade_deal || '—')}</td>
      <td class="col-bde">${escHtml((line.bde_user && line.bde_user.name) || line.bde_id || '—')}</td>
      <td class="col-start">${line.start_date ? formatDate(line.start_date) : '—'}</td>
      <td class="col-end">${getEndColumnHtml(line.end_date)}</td>
      <td class="col-remark">${escHtml(line.support || '—')}</td>
      <td class="col-received">${line.created_at ? formatMonthYear(line.created_at) : '—'}</td>
      <td class="col-status"><span class="badge ${getStatusBadge(line.period)}">${escHtml(line.period || 'Active')}</span></td>
      <td class="col-principle">${escHtml(line.principle || '—')}</td>
      <td class="col-brand">${escHtml(line.brands || '—')}</td>
      <td class="col-actions">
        <button class="btn-icon btn-edit" onclick="openEditModal('${line.id}')" title="Edit">${icons.edit}</button>
        <button class="btn-icon btn-delete" onclick="confirmDelete('${line.id}', 'Line')" title="Delete">${icons.trash}</button>
      </td>
    </tr>`;
    });
    return html;
}

function toggleGroup(groupId) {
    const btn = document.getElementById(`expand-btn-${groupId}`);
    const lineRows = document.querySelectorAll(`.marketing-line-row[data-group="${groupId}"]`);
    btn.classList.toggle('open');
    const isOpen = btn.classList.contains('open');
    lineRows.forEach(r => r.style.display = isOpen ? '' : 'none');
}

function truncate(str, len) { if (!str || str.length <= len) return str; return str.slice(0, len) + '…'; }
function getStatusBadge(period) { if (!period || period === 'Active') return 'badge-active'; if (period === 'Inactive') return 'badge-inactive'; return 'badge-default'; }
function formatDate(dateStr) { if (!dateStr) return '—'; const d = new Date(dateStr); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }); }
function formatMonthYear(dateStr) { if (!dateStr) return '—'; const d = new Date(dateStr); return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-'); }
function escHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function getEndColumnHtml(dateStr) {
    if (!dateStr) return '—';

    const formattedDate = formatDate(dateStr);

    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);
    const today = new Date();

    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let expireHtml = '';
    if (diffDays < 0) {
        expireHtml = `<div class="expire-text expire-danger">Expired</div>`;
    } else if (diffDays === 0) {
        expireHtml = `<div class="expire-text expire-danger">Expires Today</div>`;
    } else if (diffDays <= 30) {
        expireHtml = `<div class="expire-text expire-warning">${diffDays} days left</div>`;
    } else {
        expireHtml = `<div class="expire-text expire-safe">${diffDays} days left</div>`;
    }

    return `<div>${formattedDate}</div>${expireHtml}`;
}

function renderPagination() {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const el = document.getElementById('pagination');
    const info = document.getElementById('page-info');
    const from = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, totalCount);
    info.textContent = `Showing ${from}–${to} of ${totalCount} entries`;
    el.innerHTML = '';
    if (totalPages <= 1) return;
    const prev = document.createElement('button');
    prev.textContent = '‹'; prev.className = 'page-btn'; prev.disabled = currentPage === 1;
    prev.onclick = () => { currentPage--; renderTable(); };
    el.appendChild(prev);
    for (let p = Math.max(1, currentPage - 2); p <= Math.min(totalPages, currentPage + 2); p++) {
        const btn = document.createElement('button');
        btn.textContent = p; btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.onclick = () => { currentPage = p; renderTable(); };
        el.appendChild(btn);
    }
    const next = document.createElement('button');
    next.textContent = '›'; next.className = 'page-btn'; next.disabled = currentPage === totalPages;
    next.onclick = () => { currentPage++; renderTable(); };
    el.appendChild(next);
}

function updateStats() {
    let totalGroups = 0, activeGroups = 0, inactiveGroups = 0, marketingGroups = 0, yearlyGroups = 0;
    const groupMap = new Set();
    contracts.forEach(c => {
        if (c.contract_type === 'Marketing') {
            const key = c.contract_group_id || getGroupKey(c);
            if (!groupMap.has(key)) { groupMap.add(key); totalGroups++; marketingGroups++; if (c.period === 'Active' || !c.period) activeGroups++; else if (c.period === 'Inactive') inactiveGroups++; }
        } else { totalGroups++; yearlyGroups++; if (c.period === 'Active' || !c.period) activeGroups++; else if (c.period === 'Inactive') inactiveGroups++; }
    });
    document.getElementById('stat-total').textContent = totalGroups;
    document.getElementById('stat-active').textContent = activeGroups;
    document.getElementById('stat-inactive').textContent = inactiveGroups;
    document.getElementById('stat-marketing').textContent = marketingGroups;
    document.getElementById('stat-yearly').textContent = yearlyGroups;
    const hActive = document.getElementById('h-active'), hInactive = document.getElementById('h-inactive'), navBadge = document.getElementById('nav-badge-contracts');
    if (hActive) hActive.textContent = activeGroups;
    if (hInactive) hInactive.textContent = inactiveGroups;
    if (navBadge) navBadge.textContent = totalGroups;
}

function getTsValue(id) { const ts = tsInstances[id]; if (ts) return ts.getValue() || ''; const el = document.getElementById(id); return el ? el.value : ''; }
function setTsValue(id, value) { const ts = tsInstances[id]; if (!ts) { setField(id, value); return; } if (value) { if (!ts.options[value]) ts.addOption({ value, text: value }); ts.setValue(value, true); } else { ts.clear(true); } }
function clearTsField(id) { const ts = tsInstances[id]; if (ts) ts.clear(true); else setField(id, ''); }
function setField(id, value) { const el = document.getElementById(id); if (el) el.value = value; }

function openAddModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Add New Contract';
    document.getElementById('contract-form').reset();
    ['field-customer', 'field-bde', 'field-principle', 'field-brands', 'field-promotion', 'field-trade-deal'].forEach(clearTsField);
    const areaField = document.getElementById('field-area'), provField = document.getElementById('field-province');
    if (areaField) areaField.value = ''; if (provField) provField.value = '';
    document.getElementById('modal-overlay').classList.add('active');
}

async function openEditModal(id) {
    editingId = id;
    const contract = contracts.find(c => c.id === id);
    if (!contract) return;
    document.getElementById('modal-title').textContent = 'Edit Contract';
    setTsValue('field-customer', contract.customer_id);
    const cust = customers.find(c => String(c.customer_id) === String(contract.customer_id));
    const areaField = document.getElementById('field-area'), provField = document.getElementById('field-province');
    if (areaField) areaField.value = cust ? (cust.region || '') : '';
    if (provField) provField.value = cust ? (cust.province || '') : '';
    setField('field-contract-type', contract.contract_type || '');
    setTsValue('field-promotion', contract.promotion || '');
    setTsValue('field-trade-deal', contract.trade_deal || '');
    setTsValue('field-bde', contract.bde_id || '');
    setField('field-start', contract.start_date || '');
    setField('field-end', contract.end_date || '');
    setField('field-remark', contract.support || '');
    setField('field-status', contract.period || 'Active');
    setTsValue('field-principle', contract.principle || '');
    setTsValue('field-brands', contract.brands || '');
    document.getElementById('modal-overlay').classList.add('active');
}

async function openEditMarketingGroup(groupId) {
    const contract = contracts.find(c => c.contract_type === 'Marketing' && (c.contract_group_id === groupId || getGroupKey(c) === groupId));
    if (!contract) return;
    editingId = contract.id; editingGroupId = groupId;
    document.getElementById('modal-title').textContent = 'Edit Marketing Contract';
    setTsValue('field-customer', contract.customer_id);
    const cust = customers.find(c => String(c.customer_id) === String(contract.customer_id));
    const areaField = document.getElementById('field-area'), provField = document.getElementById('field-province');
    if (areaField) areaField.value = cust ? (cust.region || '') : '';
    if (provField) provField.value = cust ? (cust.province || '') : '';
    setField('field-contract-type', contract.contract_type || 'Marketing');
    setTsValue('field-promotion', contract.promotion || '');
    setTsValue('field-trade-deal', contract.trade_deal || '');
    setTsValue('field-bde', contract.bde_id || '');
    setField('field-start', contract.start_date || '');
    setField('field-end', contract.end_date || '');
    setField('field-remark', contract.support || '');
    setField('field-status', contract.period || 'Active');
    setTsValue('field-principle', contract.principle || '');
    setTsValue('field-brands', contract.brands || '');
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); editingId = null; editingGroupId = null; }

async function saveContract() {
    const customerId = getTsValue('field-customer');
    if (!customerId) { showToast('Please select an Outlet.', 'error'); return; }
    const btn = document.getElementById('btn-save'); btn.disabled = true;
    try {
        const payload = {
            customer_id: customerId, contract_type: document.getElementById('field-contract-type').value || 'Yearly',
            promotion: getTsValue('field-promotion'), trade_deal: getTsValue('field-trade-deal'),
            bde_id: getTsValue('field-bde') || null, start_date: document.getElementById('field-start').value || null, end_date: document.getElementById('field-end').value || null,
            support: document.getElementById('field-remark').value, period: document.getElementById('field-status').value,
            principle: getTsValue('field-principle'), brands: getTsValue('field-brands'), updated_at: new Date().toISOString(),
        };
        let error;
        if (editingId) { ({ error } = await supabaseClient.from('contract').update(payload).eq('id', editingId)); }
        else { payload.contract_id = 'CT-' + Date.now(); payload.created_at = new Date().toISOString(); ({ error } = await supabaseClient.from('contract').insert(payload)); }
        if (error) { showToast('Failed to save: ' + error.message, 'error'); return; }
        showToast(editingId ? 'Contract updated successfully' : 'Contract added successfully', 'success');
        destroyCreatableFields(); closeModal(); await loadContracts(); await initCreatableFields();
    } finally { btn.disabled = false; }
}

function destroyCreatableFields() { ['field-principle', 'field-brands', 'field-promotion', 'field-trade-deal'].forEach(id => { const ts = tsInstances[id]; if (ts) { ts.destroy(); delete tsInstances[id]; } }); }

let deleteTargetId = null; let deleteTargetGroup = null;
function confirmDelete(id, name) { deleteTargetId = id; deleteTargetGroup = null; document.getElementById('delete-name').textContent = name; document.getElementById('delete-modal').classList.add('active'); }
function confirmDeleteGroup(groupId, name) { deleteTargetId = null; deleteTargetGroup = groupId; document.getElementById('delete-name').textContent = name + ' (Marketing Group)'; document.getElementById('delete-modal').classList.add('active'); }
function closeDeleteModal() { document.getElementById('delete-modal').classList.remove('active'); deleteTargetId = null; deleteTargetGroup = null; }
async function executeDelete() {
    if (deleteTargetGroup) {
        const ids = contracts.filter(c => c.contract_type === 'Marketing' && (c.contract_group_id === deleteTargetGroup || getGroupKey(c) === deleteTargetGroup)).map(c => c.id);
        const { error } = await supabaseClient.from('contract').delete().in('id', ids);
        if (error) { showToast('Deletion failed: ' + error.message, 'error'); return; }
        showToast('Marketing Group deleted', 'success');
    } else if (deleteTargetId) {
        const { error } = await supabaseClient.from('contract').delete().eq('id', deleteTargetId);
        if (error) { showToast('Deletion failed: ' + error.message, 'error'); return; }
        showToast('Contract deleted', 'success');
    }
    closeDeleteModal(); await loadContracts();
}

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', debounce(e => { searchQuery = e.target.value.trim(); currentPage = 1; loadContracts(); }, 400));
    document.getElementById('filter-status').addEventListener('change', e => { filterStatus = e.target.value; currentPage = 1; loadContracts(); });
    document.getElementById('filter-type').addEventListener('change', e => { filterType = e.target.value; currentPage = 1; loadContracts(); });
    document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-overlay')) closeModal(); });

    // Event listener for Dashboard Views
    document.getElementById('dashboard-view-selector').addEventListener('change', e => {
        const view = e.target.value;
        document.querySelectorAll('.dashboard-view').forEach(el => el.style.display = 'none');
        document.getElementById('view-' + view).style.display = 'block';

        if (view === 'overview') renderDashboard();
        else if (view === 'bde') renderBdeChart();
        else if (view === 'brands') renderPrincipleChart();
    });

    // Event listener for Trend Chart Date Period
    document.getElementById('trend-period-selector').addEventListener('change', renderTrendChart);
}

function showTableLoading(show) { const el = document.getElementById('table-loading'); if (el) el.style.display = show ? 'flex' : 'none'; }
function showToast(msg, type = 'info') { const toast = document.getElementById('toast'); toast.textContent = msg; toast.className = `toast toast-${type} show`; setTimeout(() => toast.classList.remove('show'), 3000); }
function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; }
