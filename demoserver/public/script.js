document.addEventListener('DOMContentLoaded', async () => {
    // Auth check
    const meRes = await fetch('/api/me');
    if (!meRes.ok) { location.href = '/login.html'; return; }
    const me = await meRes.json();

    // User bar
    document.getElementById('user-name').textContent = me.name;
    document.getElementById('user-role').textContent = me.role;
    if (me.role === 'Admin') document.getElementById('admin-link').removeAttribute('hidden');

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        location.href = '/login.html';
    });

    // ── Tab switcher ──────────────────────────────────────────────
    const reportViews = [
        { key: 'sales',        tab: document.getElementById('tab-sales'),        panel: document.getElementById('panel-sales') },
        { key: 'performance',  tab: document.getElementById('tab-performance'),  panel: document.getElementById('panel-performance') },
        { key: 'transactions', tab: document.getElementById('tab-transactions'), panel: document.getElementById('panel-transactions') }
    ];
    function activateReportView(activeKey) {
        for (const { key, tab, panel } of reportViews) {
            const on = key === activeKey;
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
            tab.tabIndex = on ? 0 : -1;
            if (on) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
        }
    }
    for (const { key, tab } of reportViews) tab.addEventListener('click', () => activateReportView(key));
    activateReportView('sales');

    // ── Helpers ───────────────────────────────────────────────────
    function esc(s) {
        if (s == null || s === '') return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function formatMoney(n) {
        if (n == null || n === '') return '—';
        const num = Number(n);
        return Number.isNaN(num) ? esc(n) : num.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    }
    function formatDate(d) {
        if (d == null || d === '') return '—';
        const t = Date.parse(d);
        return Number.isNaN(t) ? esc(d) : new Date(t).toLocaleDateString();
    }
    function monthLabel(year, month) {
        if (year == null || month == null) return '—';
        const d = new Date(Number(year), Number(month) - 1, 1);
        return Number.isNaN(d.getTime()) ? `${esc(year)}-${esc(month)}` : d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
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

    // ── Receipt modal ─────────────────────────────────────────────
    const receiptModal = document.getElementById('receipt-modal');
    const receiptContent = document.getElementById('receipt-content');

    function showReceipt(r) {
        receiptContent.innerHTML = `
            <div class="receipt-row"><span class="rl">Transaction #</span><span class="rv">${esc(String(r.transID))}</span></div>
            <div class="receipt-row"><span class="rl">Date</span><span class="rv">${formatDate(r.purchaseDate)}</span></div>
            <hr class="receipt-divider">
            <div class="receipt-row"><span class="rl">Buyer</span><span class="rv">${esc(r.buyerName)}</span></div>
            <hr class="receipt-divider">
            <div class="receipt-row"><span class="rl">Vehicle</span><span class="rv">${esc(r.brand)} ${esc(r.model)}</span></div>
            <div class="receipt-row"><span class="rl">Year</span><span class="rv">${esc(String(r.year))}</span></div>
            <div class="receipt-row"><span class="rl">Body Style</span><span class="rv">${esc(r.bodyStyle)}</span></div>
            <div class="receipt-row"><span class="rl">Store</span><span class="rv">${esc(r.storeName)}</span></div>
            <hr class="receipt-divider">
            <div class="receipt-total"><span>Total Paid</span><span>${formatMoney(r.salePrice)}</span></div>
        `;
        receiptModal.removeAttribute('hidden');
    }

    document.getElementById('close-receipt-btn').addEventListener('click', () => receiptModal.setAttribute('hidden', ''));
    document.getElementById('print-receipt-btn').addEventListener('click', () => window.print());

    // ── My Receipts modal ─────────────────────────────────────────
    const receiptsModal = document.getElementById('receipts-modal');
    const receiptsList = document.getElementById('receipts-list');

    document.getElementById('receipts-btn').addEventListener('click', async () => {
        receiptsList.innerHTML = '<p class="muted">Loading…</p>';
        receiptsModal.removeAttribute('hidden');
        try {
            const data = await fetchJson('/api/my-receipts');
            if (!data.length) {
                receiptsList.innerHTML = '<p class="muted">No purchases yet.</p>';
                return;
            }
            let rows = '';
            for (const r of data) {
                rows += `
                    <tr>
                        <td>#${esc(String(r.TransID))}</td>
                        <td>${formatDate(r.PurchaseDate)}</td>
                        <td>${esc(r.Brand)} ${esc(r.Model)} ${esc(String(r.Year))}</td>
                        <td>${esc(r.StoreName)}</td>
                        <td class="num">${formatMoney(r.SalePrice)}</td>
                        <td><button class="btn-buy" style="background:#2c3e50;" data-receipt='${JSON.stringify({
                            transID: r.TransID, purchaseDate: r.PurchaseDate, buyerName: me.name,
                            brand: r.Brand, model: r.Model, year: r.Year,
                            bodyStyle: r.BodyStyle, storeName: r.StoreName, salePrice: r.SalePrice
                        })}'>View</button></td>
                    </tr>`;
            }
            receiptsList.innerHTML = `
                <table class="receipt-list-table">
                    <thead><tr><th>#</th><th>Date</th><th>Vehicle</th><th>Store</th><th class="num">Price</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
            receiptsList.querySelectorAll('[data-receipt]').forEach(btn => {
                btn.addEventListener('click', () => {
                    receiptsModal.setAttribute('hidden', '');
                    showReceipt(JSON.parse(btn.dataset.receipt));
                });
            });
        } catch (e) {
            receiptsList.innerHTML = '<p class="error">Failed to load receipts.</p>';
        }
    });

    document.getElementById('close-receipts-btn').addEventListener('click', () => receiptsModal.setAttribute('hidden', ''));

    // Close modals on overlay click
    receiptModal.addEventListener('click', e => { if (e.target === receiptModal) receiptModal.setAttribute('hidden', ''); });
    receiptsModal.addEventListener('click', e => { if (e.target === receiptsModal) receiptsModal.setAttribute('hidden', ''); });

    // ── Vehicles + filters ────────────────────────────────────────
    const vehiclesBody = document.getElementById('vehicles-body');
    const zipFilter = document.getElementById('zip-filter');
    let allVehicles = [];

    function applyFilters() {
        const brand    = document.getElementById('filter-brand').value.trim().toLowerCase();
        const body     = document.getElementById('filter-body').value;
        const minPrice = Number(document.getElementById('filter-min-price').value) || 0;
        const maxPrice = Number(document.getElementById('filter-max-price').value) || Infinity;
        const yearFrom = Number(document.getElementById('filter-year-from').value) || 0;
        const yearTo   = Number(document.getElementById('filter-year-to').value) || Infinity;

        const filtered = allVehicles.filter(v => {
            if (brand && !`${v.Brand || ''} ${v.Model || ''}`.toLowerCase().includes(brand)) return false;
            if (body && v.BodyStyle !== body) return false;
            const price = Number(v.Price), year = Number(v.Year);
            if (price < minPrice || price > maxPrice) return false;
            if (year < yearFrom || year > yearTo) return false;
            return true;
        });

        vehiclesBody.innerHTML = '';
        if (!filtered.length) {
            vehiclesBody.innerHTML = '<tr><td colspan="7" class="muted">No vehicles match your filters.</td></tr>';
            return;
        }
        for (const row of filtered) {
            const tr = document.createElement('tr');
            const title = `${row.Brand || ''} ${row.Model || ''}`.trim() || `ID ${row.VehicleID}`;
            const cond  = [row.VehicleCondition, row.BodyStyle].filter(Boolean).map(esc).join(' · ');
            tr.innerHTML = `
                <td><strong>${esc(title)}</strong><br><span class="muted">${esc(row.Mileage)} mi · ext ${esc(row.ExteriorColor || '—')}</span></td>
                <td>${esc(row.Year)}</td>
                <td class="num">${formatMoney(row.Price)}</td>
                <td>${cond || '—'}</td>
                <td>${powertrain(row)}</td>
                <td><strong>${esc(row.StoreName)}</strong><br><span class="muted">${esc(row.StoreAddress || '')}</span></td>
                <td><button class="btn-buy" data-id="${esc(String(row.VehicleID))}" data-name="${esc(title)}" data-price="${esc(String(row.Price))}">Buy</button></td>
            `;
            vehiclesBody.appendChild(tr);
        }

        // Buy button handlers
        vehiclesBody.querySelectorAll('.btn-buy').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id    = btn.dataset.id;
                const name  = btn.dataset.name;
                const price = formatMoney(btn.dataset.price);
                if (!confirm(`Buy ${name} for ${price}?\n\nThis cannot be undone.`)) return;
                btn.disabled = true;
                btn.textContent = '…';
                try {
                    const res  = await fetch('/api/buy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ vehicleID: Number(id) })
                    });
                    const data = await res.json();
                    if (!res.ok) { alert(data.error || 'Purchase failed'); btn.disabled = false; btn.textContent = 'Buy'; return; }
                    await loadVehicles();
                    showReceipt(data);
                } catch {
                    alert('Network error — please try again.');
                    btn.disabled = false;
                    btn.textContent = 'Buy';
                }
            });
        });
    }

    ['filter-brand','filter-body','filter-min-price','filter-max-price','filter-year-from','filter-year-to'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', applyFilters);
        el.addEventListener('change', applyFilters);
    });
    document.getElementById('reset-filters').addEventListener('click', () => {
        ['filter-brand','filter-body','filter-min-price','filter-max-price','filter-year-from','filter-year-to']
            .forEach(id => { document.getElementById(id).value = ''; });
        applyFilters();
    });

    async function loadStoreZips() {
        try {
            const rows = await fetchJson('/api/store-zips');
            for (const r of rows) {
                const opt = document.createElement('option');
                opt.value = String(r.ZipCode);
                opt.textContent = `${r.ZipCode} — ${r.City}, ${r.State}`;
                zipFilter.appendChild(opt);
            }
        } catch (e) { console.error(e); }
    }

    async function loadVehicles() {
        const zip = zipFilter.value;
        const url = zip ? `/api/vehicles?zip=${encodeURIComponent(zip)}` : '/api/vehicles';
        vehiclesBody.innerHTML = '<tr><td colspan="7" class="muted">Loading…</td></tr>';
        try {
            allVehicles = await fetchJson(url);
            applyFilters();
        } catch (e) {
            console.error(e);
            setError(vehiclesBody, 7, 'Failed to load vehicles. Is the API running?');
        }
    }

    zipFilter.addEventListener('change', loadVehicles);

    // ── Other data loaders ────────────────────────────────────────
    const inventoryBody     = document.getElementById('inventory-body');
    const monthlySalesBody  = document.getElementById('monthly-sales-body');
    const highPerformingBody = document.getElementById('high-performing-body');
    const transactionsBody  = document.getElementById('transactions-body');

    async function loadInventory() {
        try {
            const data = await fetchJson('/api/inventory');
            inventoryBody.innerHTML = '';
            if (!data.length) { inventoryBody.innerHTML = '<tr><td colspan="5" class="muted">No rows returned.</td></tr>'; return; }
            for (const row of data) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${esc(row.StoreName)}</td><td class="muted">${esc(row.StoreAddress)}</td><td>${esc(row.ManagerName)}</td><td>${esc(row.BodyStyle)}</td><td class="num"><strong>${esc(String(row.AvailableVehicles))}</strong></td>`;
                inventoryBody.appendChild(tr);
            }
        } catch (e) { console.error(e); setError(inventoryBody, 5, 'Failed to load inventory view.'); }
    }

    async function loadMonthlySales() {
        try {
            const data = await fetchJson('/api/monthly-sales');
            monthlySalesBody.innerHTML = '';
            if (!data.length) { monthlySalesBody.innerHTML = '<tr><td colspan="5" class="muted">No sales recorded for the current month.</td></tr>'; return; }
            for (const row of data) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${esc(row.StoreName)}</td><td class="muted">${esc(row.StoreAddress)}</td><td>${esc(row.ManagerName)}</td><td>${esc(row.BodyStyle)}</td><td class="num"><strong>${esc(String(row.CarsSoldThisMonth))}</strong></td>`;
                monthlySalesBody.appendChild(tr);
            }
        } catch (e) { console.error(e); setError(monthlySalesBody, 5, 'Failed to load monthly sales view.'); }
    }

    async function loadHighPerforming() {
        try {
            const data = await fetchJson('/api/high-performing-stores');
            highPerformingBody.innerHTML = '';
            if (!data.length) { highPerformingBody.innerHTML = '<tr><td colspan="5" class="muted">No store met the &gt;30 cars / month threshold.</td></tr>'; return; }
            for (const row of data) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${esc(row.StoreName)}</td><td class="muted">${esc(row.StoreAddress)}</td><td>${esc(row.ManagerName)}</td><td>${monthLabel(row.SaleYear, row.SaleMonth)}</td><td class="num"><strong>${esc(String(row.TotalCarsSold))}</strong></td>`;
                highPerformingBody.appendChild(tr);
            }
        } catch (e) { console.error(e); setError(highPerformingBody, 5, 'Failed to load high-performing stores view.'); }
    }

    async function loadTransactions() {
        try {
            const data = await fetchJson('/api/transactions');
            transactionsBody.innerHTML = '';
            if (!data.length) { transactionsBody.innerHTML = '<tr><td colspan="5" class="muted">No transactions yet.</td></tr>'; return; }
            for (const row of data) {
                const tr = document.createElement('tr');
                const buyer = row.BuyerName ? `${esc(row.BuyerName)}<br><span class="muted">${esc(row.BuyerEmail || '')}</span>` : '—';
                const veh   = [row.Brand, row.Model, row.Year].filter(Boolean).map(esc).join(' ');
                tr.innerHTML = `<td>${formatDate(row.PurchaseDate)}</td><td>${buyer}</td><td>${veh || '—'}<br><span class="muted">${esc(row.BodyStyle || '')}</span></td><td>${esc(row.StoreName)}</td><td class="num">${formatMoney(row.SalePrice)}</td>`;
                transactionsBody.appendChild(tr);
            }
        } catch (e) { console.error(e); setError(transactionsBody, 5, 'Failed to load transactions.'); }
    }

    Promise.all([
        loadStoreZips(),
        loadVehicles(),
        loadInventory(),
        loadMonthlySales(),
        loadHighPerforming(),
        loadTransactions()
    ]).catch(e => console.error(e));
});
