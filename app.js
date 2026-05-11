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
        // Remove inline style so CSS class takes over
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
    // Hide all pages
    document.getElementById('page-dashboard').style.display = 'none';
    document.getElementById('page-contracts').style.display = 'none';

    // Remove active from all nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Show selected
    document.getElementById('page-' + page).style.display = 'block';
    document.getElementById('nav-' + page).classList.add('active');

    // Update breadcrumb
    const labels = { dashboard: 'Dashboard', contracts: 'Contracts' };
    document.getElementById('breadcrumb-current').textContent = labels[page] || page;

    // Trigger dashboard render if switching to it
    if (page === 'dashboard') {
        renderDashboard();
    }

    // Close mobile sidebar after nav
    closeSidebar();
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        closeSidebar(); // ปิด Overlay บนมือถือ
    } else {
        // พับเก็บ Sidebar บน Desktop
        sidebarCollapsed = true;
        document.body.classList.add('sidebar-collapsed');
    }
}

// ── Dashboard Render ───────────────────────
function renderDashboard() {
    // นับแบบเดียวกับ updateStats() — Marketing group นับ 1
    const seenGroups = new Set();
    let marketingCount = 0, yearlyCount = 0;
    let activeCount = 0, inactiveCount = 0;

    contracts.forEach(c => {
        if (c.contract_type === 'Marketing') {
            const key = c.contract_group_id || getGroupKey(c);
            if (seenGroups.has(key)) return; // นับ group เดียว
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
        { label: 'Yearly',    value: yearlyCount,    color: '#0891b2' },
    ]);

    renderDonutChart('dash-status-chart', [
        { label: 'Active',   value: activeCount,   color: '#16a34a' },
        { label: 'Inactive', value: inactiveCount, color: '#94a3b8' },
    ]);

    renderRecentContracts();
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
        const endRad   = ((currentAngle + angle) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        const largeArc = angle > 180 ? 1 : 0;
        paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${seg.color}" opacity="0.9"/>`;
        currentAngle += angle;
    });

    // Center hole
    paths += `<circle cx="${cx}" cy="${cy}" r="${r - strokeW / 2 - 2}" fill="white"/>`;
    // Center text
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

function renderRecentContracts() {
    const container = document.getElementById('dash-recent-list');
    if (!container) return;

    const recent = [...contracts]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);

    if (recent.length === 0) {
        container.innerHTML = '<div class="dash-empty">No contracts yet</div>';
        return;
    }

    container.innerHTML = recent.map(c => {
        const customer = c.customer || {};
        const outlet = customer.outlet_name || c.customer_id || '—';
        const type = c.contract_type || 'Yearly';
        const typeBadge = type === 'Marketing'
            ? `<span class="type-badge type-marketing">Marketing</span>`
            : `<span class="type-badge type-yearly">Yearly</span>`;
        const statusBadge = `<span class="badge ${getStatusBadge(c.period)}">${c.period || 'Active'}</span>`;
        const date = c.created_at ? formatMonthYear(c.created_at) : '—';

        return `<div class="recent-item">
            <div>
                <div class="recent-outlet">${escHtml(outlet)}</div>
                <div class="recent-meta">${escHtml(customer.province || '—')} · ${date}</div>
            </div>
            <div class="recent-right">
                ${typeBadge}
                ${statusBadge}
            </div>
        </div>`;
    }).join('');
}

// ── Init ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Set tooltips for collapsed sidebar
    document.getElementById('nav-dashboard').setAttribute('data-tooltip', 'Dashboard');
    document.getElementById('nav-contracts').setAttribute('data-tooltip', 'Contracts');

    // Auto-collapse sidebar on desktop by default
    if (window.innerWidth > 768) {
        sidebarCollapsed = true;
        document.body.classList.add('sidebar-collapsed');
    }

    // Default active page (call after collapse so showPage doesn't undo it)
    document.getElementById('page-dashboard').style.display = 'block';
    document.getElementById('nav-dashboard').classList.add('active');
    document.getElementById('breadcrumb-current').textContent = 'Dashboard';

    await Promise.all([loadCustomers(), loadUsers(), initCreatableFields()]);
    await backfillMarketingGroupIds();
    await loadContracts();
    renderDashboard();
    setupEventListeners();
});

// ── Load Customers ─────────────────────────
async function loadCustomers() {
    const { data, error } = await supabaseClient
        .from('customers')
        .select('customer_id, outlet_name, bde, province, region')
        .order('outlet_name');

    if (error) {
        console.error('Load customers error:', error);
        showToast('Load customers error: ' + error.message, 'error');
        return;
    }

    customers = data || [];
    populateCustomerDropdown();
}

function populateCustomerDropdown() {
    const sel = document.getElementById('field-customer');
    if (tsInstances['field-customer']) {
        tsInstances['field-customer'].destroy();
        delete tsInstances['field-customer'];
    }
    sel.innerHTML = '';

    const initialOptions = customers.map(c => ({
        value: String(c.customer_id),
        text: `${c.customer_id} — ${c.outlet_name || 'ไม่ระบุ'}`,
        bde: c.bde || ''
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
                if (opt && opt.bde) {
                    const matchedUser = users.find(u => u.user_id === opt.bde || u.name === opt.bde);
                    const bdeId = matchedUser ? matchedUser.user_id : opt.bde;
                    setTsValue('field-bde', bdeId);
                } else {
                    clearTsField('field-bde');
                }
            }
        });
    }
}

// ── Load Users (BDE) ───────────────────────
async function loadUsers() {
    const { data, error } = await supabaseClient
        .from('user_information')
        .select('user_id, name')
        .order('name');
    if (error) { console.error('Load users error:', error); return; }
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
        tsInstances['field-bde'] = new TomSelect('#field-bde', {
            searchField: ['text'],
            maxOptions: 200,
            placeholder: 'Search BDE...',
        });
        tsInstances['field-bde'].disable();
    }
}

// ── Tom Select Creatable ───────────────────
async function initCreatableFields() {
    const { data } = await supabaseClient
        .from('contract')
        .select('principle, brands, promotion, trade_deal');

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
            items: [],
            create: true,
            createOnBlur: true,
            persist: true,
            maxItems: 1,
            placeholder,
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
            r[field].split(',').forEach(v => {
                const t = v.trim();
                if (t) set.add(t);
            });
        }
    });
    return [...set].sort().map(v => ({ value: v, text: v }));
}

// ── Backfill missing contract_group_id ────
async function backfillMarketingGroupIds() {
    const { data, error } = await supabaseClient
        .from('contract')
        .select('id, customer_id, bde_id, start_date, end_date, contract_group_id')
        .eq('contract_type', 'Marketing')
        .is('contract_group_id', null);

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
        await supabaseClient
            .from('contract')
            .upsert(updates.slice(i, i + 50), { onConflict: 'id' });
    }
}

// ── Load Contracts ─────────────────────────
async function loadContracts() {
    showTableLoading(true);

    let query = supabaseClient
        .from('contract')
        .select(`
      *,
      customer:customers!contract_customer_id_fkey (
        customer_id,
        outlet_name,
        province,
        region,
        company_name
      ),
      bde_user:user_information!contract_bde_id_fkey (
        user_id,
        name
      )
    `);

    if (searchQuery) {
        query = query.or(`contract_id.ilike.%${searchQuery}%,promotion.ilike.%${searchQuery}%,principle.ilike.%${searchQuery}%`);
    }
    if (filterStatus) {
        query = query.eq('period', filterStatus);
    }
    if (filterType) {
        query = query.eq('contract_type', filterType);
    }

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;
    showTableLoading(false);

    if (error) { showToast('Failed to load data: ' + error.message, 'error'); return; }

    contracts = data || [];
    renderTable();
    updateStats();

    // Re-render dashboard if it's currently visible
    if (document.getElementById('page-dashboard').style.display !== 'none') {
        renderDashboard();
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
        totalCount = 0;
        renderPagination();
        return;
    }

    const rows = [];
    const groupMap = {};

    contracts.forEach(c => {
        if (c.contract_type === 'Marketing') {
            const groupKey = c.contract_group_id || getGroupKey(c);
            if (groupMap[groupKey] !== undefined) {
                rows[groupMap[groupKey]].lines.push(c);
            } else {
                groupMap[groupKey] = rows.length;
                rows.push({ type: 'marketing-group', groupId: groupKey, header: c, lines: [c] });
            }
        } else {
            rows.push({ type: 'yearly', contract: c });
        }
    });

    let mCount = 1;
    let yCount = 1;
    rows.forEach(row => {
        if (row.type === 'marketing-group') row.no = mCount++;
        else row.no = yCount++;
    });

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
    const area = customer.region || '—';
    const province = customer.province || '—';
    const startFmt = c.start_date ? formatDate(c.start_date) : '—';
    const endFmt = c.end_date ? formatDate(c.end_date) : '—';
    const received = c.created_at ? formatMonthYear(c.created_at) : '—';

    return `
    <tr class="table-row" data-id="${c.id}">
      <td class="col-no">
        <div class="no-wrapper">
          <div class="no-icon-slot"></div> <span style="font-weight: 500; color: var(--text);">${no}</span>
        </div>
      </td>
      <td class="col-code">${escHtml(customer.customer_id || c.customer_id || '—')}</td>
      <td class="col-company">${escHtml(customer.company_name || customer.company || '—')}</td>
      <td class="col-outlet">${escHtml(customer.outlet_name || '—')}</td>
      <td class="col-area">${escHtml(area)}</td>
      <td class="col-province">${escHtml(province)}</td>
      <td class="col-type"><span class="type-badge type-yearly">Yearly</span></td>
      <td class="col-promo">${escHtml(c.promotion || '—')}</td>
      <td class="col-trade">${escHtml(c.trade_deal || '—')}</td>
      <td class="col-bde">${escHtml(bdeUser.name || c.bde_id || '—')}</td>
      <td class="col-start">${startFmt}</td>
      <td class="col-end">${endFmt}</td>
      <td class="col-remark">${escHtml(c.support || '—')}</td>
      <td class="col-received">${received}</td>
      <td class="col-status">
        <span class="badge ${getStatusBadge(c.period)}">${escHtml(c.period || 'Active')}</span>
      </td>
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
    const area = customer.region || '—';
    const province = customer.province || '—';
    const startFmt = c.start_date ? formatDate(c.start_date) : '—';
    const endFmt = c.end_date ? formatDate(c.end_date) : '—';
    const received = c.created_at ? formatMonthYear(c.created_at) : '—';
    const lineCount = row.lines.length;
    const gid = escHtml(row.groupId);

    const principles = c.principle || '—';
    const brands = c.brands || '—';
    const promos = c.promotion || '—';
    const trades = c.trade_deal || '—';

    const expandBtn = lineCount > 1
        ? `<button class="btn-expand" id="expand-btn-${gid}" onclick="toggleGroup('${gid}')" title="View Lines">${icons.chevronRight}</button>`
        : ``;

    let html = `
    <tr class="table-row marketing-group-header" data-group="${gid}">
      <td class="col-no">
        <div class="no-wrapper">
          <div class="no-icon-slot">${expandBtn}</div>
          <span style="font-weight: 500; color: var(--text);">${no}</span>
        </div>
      </td>
      <td class="col-code">${escHtml(customer.customer_id || c.customer_id || '—')}</td>
      <td class="col-company">${escHtml(customer.company_name || customer.company || '—')}</td>
      <td class="col-outlet">${escHtml(customer.outlet_name || '—')}</td>
      <td class="col-area">${escHtml(area)}</td>
      <td class="col-province">${escHtml(province)}</td>
      <td class="col-type"><span class="type-badge type-marketing">Marketing</span></td>
      <td class="col-promo" title="${escHtml(promos)}">${escHtml(truncate(promos, 20))}</td>
      <td class="col-trade" title="${escHtml(trades)}">${escHtml(truncate(trades, 20))}</td>
      <td class="col-bde">${escHtml(bdeUser.name || c.bde_id || '—')}</td>
      <td class="col-start">${startFmt}</td>
      <td class="col-end">${endFmt}</td>
      <td class="col-remark">${escHtml(c.support || '—')}</td>
      <td class="col-received">${received}</td>
      <td class="col-status">
        <span class="badge ${getStatusBadge(c.period)}">${escHtml(c.period || 'Active')}</span>
      </td>
      <td class="col-principle" title="${escHtml(principles)}">${escHtml(truncate(principles, 20))}</td>
      <td class="col-brand" title="${escHtml(brands)}">${escHtml(truncate(brands, 20))}</td>
      <td class="col-actions">
        <button class="btn-icon btn-edit" onclick="openEditMarketingGroup('${gid}')" title="Edit Primary Record">${icons.edit}</button>
        <button class="btn-icon btn-delete" onclick="confirmDeleteGroup('${gid}', '${escHtml(customer.outlet_name || '')}')" title="Delete Group">${icons.trash}</button>
      </td>
    </tr>`;

    row.lines.slice(1).forEach((line, idx) => {
        const lineBde = (line.bde_user && line.bde_user.name) || line.bde_id || '—';
        const lineStartFmt = line.start_date ? formatDate(line.start_date) : '—';
        const lineEndFmt = line.end_date ? formatDate(line.end_date) : '—';
        const lineReceived = line.created_at ? formatMonthYear(line.created_at) : '—';

        html += `
    <tr class="table-row marketing-line-row" id="line-row-${gid}-${idx}" style="display:none;" data-group="${gid}">
      <td class="col-no">
         <div class="no-wrapper line-indent" style="color: var(--text-3);">
            <div class="no-icon-slot" style="font-size: 13px;">└</div>
            <span></span>
         </div>
      </td>
      <td class="col-code" style="color: var(--text-3); font-weight: normal;">${escHtml(customer.customer_id || line.customer_id || '—')}</td>
      <td class="col-company" style="color: var(--text-3);">${escHtml(customer.company_name || customer.company || '—')}</td>
      <td class="col-outlet" style="color: var(--text-3);">${escHtml(customer.outlet_name || '—')}</td>
      <td class="col-area" style="color: var(--text-3);">${escHtml(area)}</td>
      <td class="col-province" style="color: var(--text-3);">${escHtml(province)}</td>
      <td class="col-type"><span class="type-badge type-marketing">Marketing</span></td>
      <td class="col-promo">${escHtml(line.promotion || '—')}</td>
      <td class="col-trade">${escHtml(line.trade_deal || '—')}</td>
      <td class="col-bde">${escHtml(lineBde)}</td>
      <td class="col-start">${lineStartFmt}</td>
      <td class="col-end">${lineEndFmt}</td>
      <td class="col-remark">${escHtml(line.support || '—')}</td>
      <td class="col-received">${lineReceived}</td>
      <td class="col-status">
        <span class="badge ${getStatusBadge(line.period)}">${escHtml(line.period || 'Active')}</span>
      </td>
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

function truncate(str, len) {
    if (!str || str.length <= len) return str;
    return str.slice(0, len) + '…';
}

function getStatusBadge(period) {
    if (!period || period === 'Active') return 'badge-active';
    if (period === 'Inactive') return 'badge-inactive';
    return 'badge-default';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatMonthYear(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Pagination ─────────────────────────────
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
        btn.textContent = p;
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.onclick = () => { currentPage = p; renderTable(); };
        el.appendChild(btn);
    }
    const next = document.createElement('button');
    next.textContent = '›'; next.className = 'page-btn'; next.disabled = currentPage === totalPages;
    next.onclick = () => { currentPage++; renderTable(); };
    el.appendChild(next);
}

// ── Stats ──────────────────────────────────
function updateStats() {
    let totalGroups = 0;
    let activeGroups = 0;
    let inactiveGroups = 0;
    let marketingGroups = 0;
    let yearlyGroups = 0;
    const groupMap = new Set();

    contracts.forEach(c => {
        if (c.contract_type === 'Marketing') {
            const key = c.contract_group_id || getGroupKey(c);
            if (!groupMap.has(key)) {
                groupMap.add(key);
                totalGroups++;
                marketingGroups++;
                if (c.period === 'Active' || !c.period) activeGroups++;
                else if (c.period === 'Inactive') inactiveGroups++;
            }
        } else {
            totalGroups++;
            yearlyGroups++;
            if (c.period === 'Active' || !c.period) activeGroups++;
            else if (c.period === 'Inactive') inactiveGroups++;
        }
    });

    document.getElementById('stat-total').textContent = totalGroups;
    document.getElementById('stat-active').textContent = activeGroups;
    document.getElementById('stat-inactive').textContent = inactiveGroups;
    document.getElementById('stat-marketing').textContent = marketingGroups;
    document.getElementById('stat-yearly').textContent = yearlyGroups;

    // Header mini stats
    const hActive = document.getElementById('h-active');
    const hInactive = document.getElementById('h-inactive');
    if (hActive) hActive.textContent = activeGroups;
    if (hInactive) hInactive.textContent = inactiveGroups;

    // Nav badge
    const navBadge = document.getElementById('nav-badge-contracts');
    if (navBadge) navBadge.textContent = totalGroups;
}

// ── Tom Select helpers ─────────────────────
function getTsValue(id) {
    const ts = tsInstances[id];
    if (ts) return ts.getValue() || '';
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function setTsValue(id, value) {
    const ts = tsInstances[id];
    if (!ts) { setField(id, value); return; }
    if (value) {
        if (!ts.options[value]) ts.addOption({ value, text: value });
        ts.setValue(value, true);
    } else {
        ts.clear(true);
    }
}

function clearTsField(id) {
    const ts = tsInstances[id];
    if (ts) ts.clear(true);
    else setField(id, '');
}

function setField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

// ── Modal open ─────────────────────────────
function openAddModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Add New Contract';
    document.getElementById('contract-form').reset();
    ['field-customer', 'field-bde', 'field-principle', 'field-brands', 'field-promotion', 'field-trade-deal'].forEach(clearTsField);
    document.getElementById('modal-overlay').classList.add('active');
}

async function openEditModal(id) {
    editingId = id;
    const contract = contracts.find(c => c.id === id);
    if (!contract) return;

    document.getElementById('modal-title').textContent = 'Edit Contract';
    setTsValue('field-customer', contract.customer_id);
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
    const contract = contracts.find(c =>
        c.contract_type === 'Marketing' &&
        (c.contract_group_id === groupId || getGroupKey(c) === groupId)
    );
    if (!contract) return;

    editingId = contract.id;
    editingGroupId = groupId;

    document.getElementById('modal-title').textContent = 'Edit Marketing Contract';
    setTsValue('field-customer', contract.customer_id);
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

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    editingId = null;
    editingGroupId = null;
}

// ── Save Contract ──────────────────────────
async function saveContract() {
    const customerId = getTsValue('field-customer');
    if (!customerId) { showToast('Please select an Outlet.', 'error'); return; }

    const btn = document.getElementById('btn-save');
    btn.disabled = true;

    try {
        const payload = {
            customer_id: customerId,
            contract_type: document.getElementById('field-contract-type').value || 'Yearly',
            promotion: getTsValue('field-promotion'),
            trade_deal: getTsValue('field-trade-deal'),
            bde_id: getTsValue('field-bde') || null,
            start_date: document.getElementById('field-start').value || null,
            end_date: document.getElementById('field-end').value || null,
            support: document.getElementById('field-remark').value,
            period: document.getElementById('field-status').value,
            principle: getTsValue('field-principle'),
            brands: getTsValue('field-brands'),
            updated_at: new Date().toISOString(),
        };

        let error;
        if (editingId) {
            ({ error } = await supabaseClient.from('contract').update(payload).eq('id', editingId));
        } else {
            payload.contract_id = 'CT-' + Date.now();
            payload.created_at = new Date().toISOString();
            ({ error } = await supabaseClient.from('contract').insert(payload));
        }

        if (error) { showToast('Failed to save: ' + error.message, 'error'); return; }
        showToast(editingId ? 'Contract updated successfully' : 'Contract added successfully', 'success');

        destroyCreatableFields();
        closeModal();
        await loadContracts();
        await initCreatableFields();
    } finally {
        btn.disabled = false;
    }
}

function destroyCreatableFields() {
    ['field-principle', 'field-brands', 'field-promotion', 'field-trade-deal'].forEach(id => {
        const ts = tsInstances[id];
        if (ts) { ts.destroy(); delete tsInstances[id]; }
    });
}

// ── Delete ─────────────────────────────────
let deleteTargetId = null;
let deleteTargetGroup = null;

function confirmDelete(id, name) {
    deleteTargetId = id;
    deleteTargetGroup = null;
    document.getElementById('delete-name').textContent = name;
    document.getElementById('delete-modal').classList.add('active');
}

function confirmDeleteGroup(groupId, name) {
    deleteTargetId = null;
    deleteTargetGroup = groupId;
    document.getElementById('delete-name').textContent = name + ' (Marketing Group)';
    document.getElementById('delete-modal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    deleteTargetId = null;
    deleteTargetGroup = null;
}

async function executeDelete() {
    if (deleteTargetGroup) {
        const ids = contracts
            .filter(c => c.contract_type === 'Marketing' && (c.contract_group_id === deleteTargetGroup || getGroupKey(c) === deleteTargetGroup))
            .map(c => c.id);

        const { error } = await supabaseClient.from('contract').delete().in('id', ids);
        if (error) { showToast('Deletion failed: ' + error.message, 'error'); return; }
        showToast('Marketing Group deleted', 'success');
    } else if (deleteTargetId) {
        const { error } = await supabaseClient.from('contract').delete().eq('id', deleteTargetId);
        if (error) { showToast('Deletion failed: ' + error.message, 'error'); return; }
        showToast('Contract deleted', 'success');
    }
    closeDeleteModal();
    await loadContracts();
}

// ── Search & Filter ────────────────────────
function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', debounce(e => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        loadContracts();
    }, 400));

    document.getElementById('filter-status').addEventListener('change', e => {
        filterStatus = e.target.value;
        currentPage = 1;
        loadContracts();
    });

    document.getElementById('filter-type').addEventListener('change', e => {
        filterType = e.target.value;
        currentPage = 1;
        loadContracts();
    });

    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-overlay')) closeModal();
    });
}

// ── UI Helpers ─────────────────────────────
function showTableLoading(show) {
    const el = document.getElementById('table-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
