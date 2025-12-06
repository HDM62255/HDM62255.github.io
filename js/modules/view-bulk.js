import { appData } from './data.js';
import { TARGETS } from './config.js';
import { getColorStatus } from './utils.js';

export function initBulkView() {
    document.getElementById('btnProcessBulk').onclick = processBulk;
}

export function processBulk() {
    const raw = document.getElementById('bulkInput').value; const tokens = raw.split(/[\n,]+/).map(t => t.trim()).filter(t => t !== "");
    const tbody = document.getElementById('bulkTableBody'); tbody.innerHTML = '';
    const results = [];
    tokens.forEach(token => {
        const uRows = appData.filter(d => d.id === token || d.name === token);
        if (uRows.length === 0) return;
        let sumEff = 0; let cntEff = 0; const counts = {};
        uRows.forEach(d => { counts[d.activity] = (counts[d.activity] || 0) + 1; const t = TARGETS[d.activity] || 0; if (t > 0) { sumEff += (d.productivity / t) * 100; cntEff++; } });
        results.push({ id: uRows[0].id, name: uRows[0].name, main: Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b), eff: cntEff > 0 ? (sumEff / cntEff) : 0 });
    });

    // Custom Event dispatch to nav to user
    const handleRowClick = (id) => {
        document.querySelector('#tab-btn-user').click();
        document.getElementById('userSearchInput').value = id;
        document.dispatchEvent(new CustomEvent('SearchUserRequest', { detail: id }));
    };

    results.forEach(r => {
        const style = getColorStatus(r.eff, "");
        const tr = document.createElement('tr');
        tr.dataset.cat = style.label;
        tr.onclick = () => handleRowClick(r.id);
        tr.innerHTML = `<td><div class="fw-bold">${r.name}</div><div class="small text-muted">${r.id}</div></td><td class="fw-bold">${r.main}</td><td class="text-center"><span class="eff-val ${style.textClass}">${r.eff.toFixed(1)}%</span></td><td class="text-center"><span class="badge-gxo ${style.badgeClass}">${style.label}</span></td>`;
        tbody.appendChild(tr);
    });
}
