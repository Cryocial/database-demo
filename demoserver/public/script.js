document.addEventListener('DOMContentLoaded', async () => {
    // Auth check — redirect to login if not logged in
    const meRes = await fetch('/api/me');
    if (!meRes.ok) {
        location.href = '/login.html';
        return;
    }
    const me = await meRes.json();

    // User bar
    document.getElementById('user-name').textContent = me.name;
    document.getElementById('user-role').textContent = me.role;
    if (me.role === 'Admin') {
        document.getElementById('admin-link').removeAttribute('hidden');
    }
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        location.href = '/login.html';
    });

    const vehiclesBody = document.getElementById('vehicles-body');
    const inventoryBody = document.getElementById('inventory-body');
    const monthlySalesBody = document.getElementById('monthly-sales-body');
    const highPerformingBody = document.getElementById('high-performing-body');
    const transactionsBody = document.getElementById('transactions-body');
    const zipFilter = document.getElementById('zip-filter');

    const reportViews = [
        { key: 'sales', tab: document.getElementById('tab-sales'), panel: document.getElementById('panel-sales') },
        { key: 'performance', tab: document.getElementById('tab-performance'), panel: document.getElementById('panel-performance') },
        { key: 'transactions', tab: document.getElementById('tab-transactions'), panel: document.getElementById('panel-transactions') }
    ];

    function activateReportView(activeKey) {
        for (const { key, tab, panel } of reportViews) {
            const on = key === activeKey;
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
            tab.tabIndex = on ? 0 : -1;
            if (on) panel.removeAttribute('hidden');
            else panel.setAttribute('hidden', '');
        }
    }

    for (const { key, tab } of reportViews) {
        tab.addEventListener('click', () => activateReportView(key));
    }
    activateReportView('sales');

    function esc(s) {
        if (s == null || s === '') return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatMoney(n) {
        if (n == null || n === '') return '—';
        const num = Number(n);
        if (Number.isNaN(num)) return esc(n);
        return num.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    }

    function formatDate(d) {
        if (d == null || d === '') return '—';
        const t = Date.parse(d);
        if (Number.isNaN(t)) return esc(d);
        return new Date(t).toLocaleDateString();
    }

    function monthLabel(year, month) {
        if (year == null || month == null) return '—';
        const d = new Date(Number(year), Number(month) - 1, 1);
        if (Number.isNaN(d.getTime())) return `${esc(year)}-${esc(month)}`;
        return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    }

    function powertrain(row) {
        const parts = [row.FuelType, row.Transmission, row.Drivetrain].filter(Boolean);
        let line = parts.map(esc).join(' · ');
        if (row.MPG != null && row.MPG !== '') line += (line ? '<br>' : '') + esc(`MPG ${row.MPG}`);
        if (row.RangeMiles != null && row.RangeMiles !== '') line += (line ? '<br>' : '') + esc(`Range ${row.RangeMiles} mi`);
        return line || '—';
    }

    async function fetchJson(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    function setError(tbody, colspan, message) {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="error">${esc(message)}</td></tr>`;
    }

    // Vehicle filtering
    let allVehicles = [];

    function applyFilters() {
        const brand = document.getElementById('filter-brand').value.trim().toLowerCase();
        const body = document.getElementById('filter-body').value;
        const minPrice = Number(document.getElementById('filter-min-price').value) || 0;
        const maxPrice = Number(document.getElementById('filter-max-price').value) || Infinity;
        const yearFrom = Number(document.getElementById('filter-year-from').value) || 0;
        const yearTo = Number(document.getElementById('filter-year-to').value) || Infinity;

        const filtered = allVehicles.filter(v => {
            if (brand) {
                const haystack = `${v.Brand || ''} ${v.Model || ''}`.toLowerCase();
                if (!haystack.includes(brand)) return false;
            }
            if (body && v.BodyStyle !== body) return false;
            const price = Number(v.Price);
            if (price < minPrice || price > maxPrice) return false;
            const year = Number(v.Year);
            if (year < yearFrom || year > yearTo) return false;
            return true;
        });

        vehiclesBody.innerHTML = '';
        if (!filtered.length) {
            vehiclesBody.innerHTML = '<tr><td colspan="6" class="muted">No vehicles match your filters.</td></tr>';
            return;
        }
        for (const row of filtered) {
            const tr = document.createElement('tr');
            const vehicleTitle = `${row.Brand || ''} ${row.Model || ''}`.trim() || `ID ${row.VehicleID}`;
            const cond = [row.VehicleCondition, row.BodyStyle].filter(Boolean).map(esc).join(' · ');
            tr.innerHTML = `
                <td><strong>${esc(vehicleTitle)}</strong><br><span class="muted">${esc(row.Mileage)} mi · ext ${esc(row.ExteriorColor || '—')}</span></td>
                <td>${esc(row.Year)}</td>
                <td class="num">${formatMoney(row.Price)}</td>
                <td>${cond || '—'}</td>
                <td>${powertrain(row)}</td>
                <td><strong>${esc(row.StoreName)}</strong><br><span class="muted">${esc(row.StoreAddress || '')}</span></td>
            `;
            vehiclesBody.appendChild(tr);
        }
    }

    // Bind all filter controls
    ['filter-brand', 'filter-body', 'filter-min-price', 'filter-max-price', 'filter-year-from', 'filter-year-to'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', applyFilters);
        el.addEventListener('change', applyFilters);
    });

    document.getElementById('reset-filters').addEventListener('click', () => {
        document.getElementById('filter-brand').value = '';
        document.getElementById('filter-body').value = '';
        document.getElementById('filter-min-price').value = '';
        document.getElementById('filter-max-price').value = '';
        document.getElementById('filter-year-from').value = '';
        document.getElementById('filter-year-to').value = '';
        applyFilters();
    });

    async function loadStoreZips() {
        try {
            const rows = await fetchJson('/api/store-zips');
            for (const r of rows) {
                const opt = document.createElement('option');
                const zip = String(r.ZipCode);
                opt.value = zip;
                opt.textContent = `${zip} — ${r.City}, ${r.State}`;
                zipFilter.appendChild(opt);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function loadVehicles() {
        const zip = zipFilter.value;
        const url = zip ? `/api/vehicles?zip=${encodeURIComponent(zip)}` : '/api/vehicles';
        vehiclesBody.innerHTML = '<tr><td colspan="6" class="muted">Loading…</td></tr>';
        try {
            allVehicles = await fetchJson(url);
            applyFilters();
        } catch (e) {
            console.error(e);
            setError(vehiclesBody, 6, 'Failed to load vehicles. Is the API running?');
        }
    }

    async function loadInventory() {
        try {
            const data = await fetchJson('/api/inventory');
            inventoryBody.innerHTML = '';
            if (!data.length) {
                inventoryBody.innerHTML = '<tr><td colspan="5" class="muted">No rows returned.</td></tr>';
                return;
            }
            for (const row of data) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${esc(row.StoreName)}</td>
                    <td class="muted">${esc(row.StoreAddress)}</td>
                    <td>${esc(row.ManagerName)}</td>
                    <td>${esc(row.BodyStyle)}</td>
                    <td class="num"><strong>${esc(String(row.AvailableVehicles))}</strong></td>
                `;
                inventoryBody.appendChild(tr);
            }
        } catch (e) {
            console.error(e);
            setError(inventoryBody, 5, 'Failed to load inventory view.');
        }
    }

    async function loadMonthlySales() {
        try {
            const data = await fetchJson('/api/monthly-sales');
            monthlySalesBody.innerHTML = '';
            if (!data.length) {
                monthlySalesBody.innerHTML = '<tr><td colspan="5" class="muted">No sales recorded for the current month.</td></tr>';
                return;
            }
            for (const row of data) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${esc(row.StoreName)}</td>
                    <td class="muted">${esc(row.StoreAddress)}</td>
                    <td>${esc(row.ManagerName)}</td>
                    <td>${esc(row.BodyStyle)}</td>
                    <td class="num"><strong>${esc(String(row.CarsSoldThisMonth))}</strong></td>
                `;
                monthlySalesBody.appendChild(tr);
            }
        } catch (e) {
            console.error(e);
            setError(monthlySalesBody, 5, 'Failed to load monthly sales view.');
        }
    }

    async function loadHighPerforming() {
        try {
            const data = await fetchJson('/api/high-performing-stores');
            highPerformingBody.innerHTML = '';
            if (!data.length) {
                highPerformingBody.innerHTML = '<tr><td colspan="5" class="muted">No store met the &gt;30 cars / month threshold.</td></tr>';
                return;
            }
            for (const row of data) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${esc(row.StoreName)}</td>
                    <td class="muted">${esc(row.StoreAddress)}</td>
                    <td>${esc(row.ManagerName)}</td>
                    <td>${monthLabel(row.SaleYear, row.SaleMonth)}</td>
                    <td class="num"><strong>${esc(String(row.TotalCarsSold))}</strong></td>
                `;
                highPerformingBody.appendChild(tr);
            }
        } catch (e) {
            console.error(e);
            setError(highPerformingBody, 5, 'Failed to load high-performing stores view.');
        }
    }

    async function loadTransactions() {
        try {
            const data = await fetchJson('/api/transactions');
            transactionsBody.innerHTML = '';
            if (!data.length) {
                transactionsBody.innerHTML = '<tr><td colspan="5" class="muted">No transactions yet.</td></tr>';
                return;
            }
            for (const row of data) {
                const tr = document.createElement('tr');
                const buyer = row.BuyerName
                    ? `${esc(row.BuyerName)}<br><span class="muted">${esc(row.BuyerEmail || '')}</span>`
                    : '—';
                const veh = [row.Brand, row.Model, row.Year].filter(Boolean).map(esc).join(' ');
                tr.innerHTML = `
                    <td>${formatDate(row.PurchaseDate)}</td>
                    <td>${buyer}</td>
                    <td>${veh || '—'}<br><span class="muted">${esc(row.BodyStyle || '')}</span></td>
                    <td>${esc(row.StoreName)}</td>
                    <td class="num">${formatMoney(row.SalePrice)}</td>
                `;
                transactionsBody.appendChild(tr);
            }
        } catch (e) {
            console.error(e);
            setError(transactionsBody, 5, 'Failed to load transactions.');
        }
    }

    zipFilter.addEventListener('change', loadVehicles);

    Promise.all([
        loadStoreZips(),
        loadVehicles(),
        loadInventory(),
        loadMonthlySales(),
        loadHighPerforming(),
        loadTransactions()
    ]).catch((e) => console.error(e));
});
