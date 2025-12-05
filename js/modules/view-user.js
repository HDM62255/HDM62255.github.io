import { appData, latestDateInDB } from './data.js';
import { TARGETS, PALETTE } from './config.js';
import { getColorStatus } from './utils.js';
import { renderUserTrendChart } from './charts.js';

let currentUserData = [];

/**
 * Inicializa la vista de usuario.
 */
export function initUserView() {
    const userSearch = document.getElementById('userSearchInput');
    userSearch.addEventListener('change', () => searchUser(userSearch.value));
    userSearch.addEventListener('keyup', (e) => { if (e.key === 'Enter') searchUser(userSearch.value); });

    document.getElementById('userActFilter').addEventListener('change', filterUserTable);
    document.getElementById('userTimeFilter').addEventListener('change', updateUserSubFilters);
    document.getElementById('userSubFilter').addEventListener('change', filterUserTable);
    document.getElementById('btnResetUser').onclick = resetUserFull;

    // Escuchar eventos de busqueda externa (desde vista global)
    document.addEventListener('SearchUserRequest', (e) => {
        searchUser(e.detail);
    });
}

/**
 * Puebla el datalist de búsqueda de usuarios.
 */
export function populateUserSearch() {
    const uniqueUsers = new Map(); appData.forEach(d => { if (!uniqueUsers.has(d.id)) uniqueUsers.set(d.id, d.name); });
    const datalist = document.getElementById('userList'); datalist.innerHTML = '';
    uniqueUsers.forEach((name, id) => { const opt = document.createElement('option'); opt.value = id; opt.label = name; datalist.appendChild(opt); });
}

export function searchUser(input) {
    if (!input) return;
    const records = appData.filter(d => d.id === input || d.name === input);
    if (records.length === 0) return;
    currentUserData = records;
    document.getElementById('userStats').classList.remove('d-none'); document.getElementById('userTrendCard').classList.remove('d-none');
    document.getElementById('userNameDisplay').innerText = records[0].name;
    const uActs = [...new Set(records.map(d => d.activity))];
    const sel = document.getElementById('userActFilter'); sel.innerHTML = '<option value="ALL">Todas</option>';
    uActs.forEach(a => sel.add(new Option(a, a)));
    document.getElementById('userTimeFilter').value = 'ALL'; updateUserSubFilters(); filterUserTable();
}

function resetUserFull() {
    document.getElementById('userSearchInput').value = ''; document.getElementById('userStats').classList.add('d-none'); document.getElementById('userTrendCard').classList.add('d-none');
    document.getElementById('userTableBody').innerHTML = ''; document.getElementById('userRecordCount').innerText = '0'; currentUserData = [];
}

function updateUserSubFilters() {
    const timeVal = document.getElementById('userTimeFilter').value;
    const container = document.getElementById('userSubFilterContainer'); const label = document.getElementById('userSubFilterLabel'); const select = document.getElementById('userSubFilter');
    select.innerHTML = '';
    if (timeVal === 'month') {
        container.classList.remove('d-none'); label.innerText = "Seleccionar Mes:";
        const months = [...new Set(currentUserData.map(d => d.monthLabel))]; months.forEach(m => select.add(new Option(m, m)));
    } else if (timeVal === 'day') {
        container.classList.remove('d-none'); label.innerText = "Seleccionar Día:";
        const days = [...new Set(currentUserData.map(d => d.dateStr))].sort((a, b) => { const da = a.split('/'); const db = b.split('/'); return new Date(db[2], db[1] - 1, db[0]) - new Date(da[2], da[1] - 1, da[0]); });
        days.forEach(d => select.add(new Option(d, d)));
    } else { container.classList.add('d-none'); }
    filterUserTable();
}

/**
 * Calcula la categoría ponderada del usuario.
 */
function calculateUserWeightedCategory(data) {
    const counts = { BEST: 0, NORMAL: 0, WORST: 0 };
    data.forEach(d => { const t = TARGETS[d.activity] || 0; const eff = t > 0 ? (d.productivity / t) * 100 : 0; const st = getColorStatus(eff, d.category); if (st.label === "BEST") counts.BEST++; else if (st.label === "WORST") counts.WORST++; else counts.NORMAL++; });
    const sBest = counts.BEST * 0.3; const sNorm = counts.NORMAL * 0.3; const sWorst = counts.WORST * 0.4;
    let label = "NORMAL"; if (sWorst >= sBest && sWorst >= sNorm) label = "WORST"; else if (sBest >= sNorm && sBest > sWorst) label = "BEST";
    const style = getColorStatus(0, label); const badge = document.getElementById('userWeightedCatDisplay');
    badge.className = `badge-gxo ${style.badgeClass}`; badge.innerText = label;
}

export function filterUserTable() {
    const actFilter = document.getElementById('userActFilter').value; const timeFilter = document.getElementById('userTimeFilter').value; const subFilter = document.getElementById('userSubFilter').value;
    let data = currentUserData;
    if (actFilter !== 'ALL') data = data.filter(d => d.activity === actFilter);
    if (timeFilter === 'last7') { const limit = new Date(latestDateInDB); limit.setDate(limit.getDate() - 7); data = data.filter(d => d.ts >= limit.getTime()); }
    else if (timeFilter === 'month' && subFilter) { data = data.filter(d => d.monthLabel === subFilter); }
    else if (timeFilter === 'day' && subFilter) { data = data.filter(d => d.dateStr === subFilter); }
    let sumEff = 0; let countEff = 0; const actCounts = {};
    data.forEach(d => { const t = TARGETS[d.activity] || 0; if (t > 0) { sumEff += (d.productivity / t) * 100; countEff++; } actCounts[d.activity] = (actCounts[d.activity] || 0) + 1; });
    const avgEff = countEff > 0 ? (sumEff / countEff).toFixed(1) : 0;
    const mainAct = Object.keys(actCounts).length ? Object.keys(actCounts).reduce((a, b) => actCounts[a] > actCounts[b] ? a : b) : "-";
    document.getElementById('userEffDisplay').innerText = avgEff + "%"; document.getElementById('userMainActDisplay').innerText = mainAct;
    calculateUserWeightedCategory(data);
    const tbody = document.getElementById('userTableBody'); tbody.innerHTML = '';
    data.sort((a, b) => b.ts - a.ts);
    document.getElementById('userRecordCount').innerText = Math.min(data.length, 500);

    // Fragmento para performance
    const fragment = document.createDocumentFragment();
    data.slice(0, 500).forEach(d => {
        const t = TARGETS[d.activity] || 0; const eff = t > 0 ? ((d.productivity / t) * 100).toFixed(0) : 0; const style = getColorStatus(eff, d.category);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${d.dateStr}</td><td class="small fw-bold">${d.activity}</td><td>${d.productivity.toFixed(1)}</td><td>${t}</td><td><span class="eff-val ${style.textClass}">${eff}%</span></td><td><span class="badge-gxo ${style.badgeClass}">${style.label}</span></td>`;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);

    const isDarkMode = document.body.classList.contains('dark-mode');
    renderUserTrendChart(data,
        // Generamos los datos para la grafica aqui mismo o extraemos logica? 
        // Mantengamos logica original:
        ...prepareTrendData(data),
        isDarkMode
    );
}

function prepareTrendData(data) {
    const daily = {}; data.forEach(d => { const t = TARGETS[d.activity] || 0; if (t > 0) { if (!daily[d.dateStr]) daily[d.dateStr] = { sum: 0, cnt: 0, ts: d.ts }; daily[d.dateStr].sum += (d.productivity / t) * 100; daily[d.dateStr].cnt++; } });
    const sortedDates = Object.keys(daily).sort((a, b) => daily[a].ts - daily[b].ts);
    const values = sortedDates.map(k => (daily[k].sum / daily[k].cnt).toFixed(1));
    const targetData = new Array(values.length).fill(100);
    return [sortedDates, values, targetData];
}
