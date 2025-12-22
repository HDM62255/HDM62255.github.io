import { appData, latestDateInDB } from './data.js';
import { TARGETS, PALETTE } from './config.js';
import { getColorStatus, getMode } from './utils.js';
import { renderUserTrendChart } from './charts.js';
import { CalendarWidget } from './calendar.js';

let currentUserData = [];
let currentFilteredUserRows = [];
let userCalendarInstance = null;
let userCustomDates = [];

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
    document.getElementById('userSubFilter').addEventListener('change', filterUserTable);
    document.getElementById('btnResetUser').onclick = resetUserFull;
    document.getElementById('btnExportUserXLSX').onclick = exportUserTableToXLSX;

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

    // --- NUEVA LÓGICA: CALCULO DE MODA ---
    const modeContract = getMode(records.map(r => r.contractType));
    const modeShift = getMode(records.map(r => r.shift));
    const modeStatus = getMode(records.map(r => r.currentStatus));

    // --- ACTUALIZACIÓN Y INYECCIÓN DE DOM ---

    // 1. Categoria (Ajuste de espaciado si es necesario, pero mantenemos intacto el contenido)
    const catEl = document.getElementById('userWeightedCatDisplay');

    // 2. Estado (NUEVO - Debajo de Categoría)
    if (catEl) {
        const catRow = catEl.closest('.d-flex'); // Fila de categoría
        // Si la fila de categoría tiene mb-3, quizás queramos cambiarlo a mb-2 para uniformidad, 
        // pero respetaremos "estrictamente" clases existentes salvo necesidad.

        let statusRow = document.getElementById('userStatusRow');
        if (!statusRow && catRow) {
            statusRow = document.createElement('div');
            statusRow.id = 'userStatusRow';
            // Robamos las clases de la fila anterior para consistencia, forzando mb-2
            statusRow.className = 'd-flex justify-content-between mb-2 small text-label-dark align-items-center';
            statusRow.innerHTML = `<span>Estado:</span><span id="userStatusDisplay" class="fw-bold text-white">${modeStatus}</span>`;
            catRow.after(statusRow);
        } else if (statusRow) {
            document.getElementById('userStatusDisplay').innerText = modeStatus;
        }
    }

    // 3. Tipo Contrato (Existente - Actualizamos valor con contractType)
    // NOTA: El ID existente es 'userTurnoDisplay', que correspondía a 'Tipo Contrato'.
    const contractEl = document.getElementById('userTurnoDisplay');
    if (contractEl) {
        contractEl.innerText = modeContract;
        contractEl.classList.add('text-white'); // Asegurar color blanco brillante
    }

    // 4. Turno (NUEVO - Debajo de Tipo Contrato)
    if (contractEl) {
        const contractRow = contractEl.closest('.d-flex');
        let shiftRow = document.getElementById('userShiftRow');
        if (!shiftRow && contractRow) {
            // Bajamos el margen del contrato si era mb-3 para que no quede tan separado del Turno
            if (contractRow.classList.contains('mb-3')) contractRow.classList.replace('mb-3', 'mb-2');

            shiftRow = document.createElement('div');
            shiftRow.id = 'userShiftRow';
            shiftRow.className = 'd-flex justify-content-between mb-3 small text-label-dark align-items-center'; // mb-3 porque es el último antes del HR
            shiftRow.innerHTML = `<span>Turno:</span><span id="userShiftDisplay" class="fw-bold text-white">${modeShift}</span>`;
            contractRow.after(shiftRow);
        } else if (shiftRow) {
            document.getElementById('userShiftDisplay').innerText = modeShift;
        }
    }

    // document.getElementById('userTurnoDisplay').innerText = records[0].turno || "-"; // ELIMINADO - Usamos lógica arriba
    const uActs = [...new Set(records.map(d => d.activity))];
    const sel = document.getElementById('userActFilter'); sel.innerHTML = '<option value="ALL">Todas</option>';
    uActs.forEach(a => sel.add(new Option(a, a)));
    document.getElementById('userTimeFilter').value = 'ALL'; updateUserSubFilters(); filterUserTable();
}

function resetUserFull() {
    document.getElementById('userSearchInput').value = ''; document.getElementById('userStats').classList.add('d-none'); document.getElementById('userTrendCard').classList.add('d-none');
    document.getElementById('userTableBody').innerHTML = ''; document.getElementById('userRecordCount').innerText = '0'; currentUserData = []; currentFilteredUserRows = [];
    userCustomDates = [];
    if (userCalendarInstance) { userCalendarInstance.destroy(); userCalendarInstance = null; }
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
    } else if (timeVal === 'calendar') {
        container.classList.remove('d-none'); label.innerText = "Seleccionar Fechas:";
        select.innerHTML = ''; // Limpiar select
        select.classList.add('d-none'); // Ocultar el select, usaremos el calendario

        // Inyectar calendario
        if (userCalendarInstance) userCalendarInstance.destroy();
        userCalendarInstance = new CalendarWidget({
            isStatic: true,
            initialDates: userCustomDates,
            onSelect: (dates) => {
                userCustomDates = dates;

                // Restaurar select con resumen para feedback visual (Simulando Global View)
                select.classList.remove('d-none');
                select.innerHTML = '';
                const summary = dates.length > 0 ? (dates.length === 1 ? dates[0] : `${dates.length} días seleccionados`) : "Seleccionar...";
                select.add(new Option(summary, "CUSTOM"));

                filterUserTable();
            }
        });
        userCalendarInstance.mount(container);
    } else {
        container.classList.add('d-none');
        if (userCalendarInstance) { userCalendarInstance.destroy(); userCalendarInstance = null; }
    }

    if (timeVal !== 'calendar') {
        document.getElementById('userSubFilter').classList.remove('d-none');
    }

    // Feature adicional: Click en el select de resumen re-abre el calendario
    if (timeVal === 'calendar') {
        select.onclick = () => {
            if (!document.querySelector('.calendar-widget')) {
                updateUserSubFilters();
            }
        };
    }

    filterUserTable();
}

/**
 * Calcula la categoría ponderada del usuario.
 */
function calculateUserWeightedCategory(data) {
    const counts = { TOP: 0, NORMAL: 0, BOTTOM: 0 };
    data.forEach(d => { const t = TARGETS[d.activity] || 0; const eff = t > 0 ? (d.productivity / t) * 100 : 0; const st = getColorStatus(eff, d.category); if (st.label === "TOP") counts.TOP++; else if (st.label === "BOTTOM") counts.BOTTOM++; else counts.NORMAL++; });
    const sTop = counts.TOP * 0.3; const sNorm = counts.NORMAL * 0.3; const sBottom = counts.BOTTOM * 0.4;
    let label = "NORMAL"; if (sBottom >= sTop && sBottom >= sNorm) label = "BOTTOM"; else if (sTop >= sNorm && sTop > sBottom) label = "TOP";
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
    else if (timeFilter === 'calendar') { data = data.filter(d => userCustomDates.includes(d.dateStr)); }

    // FIX: Filtrar registros con Prod. Real (Productivity) = 0
    data = data.filter(d => d.productivity > 0);

    // FIX: Filtrar solo categorias validas (Normal, Top, Bottom)
    data = data.filter(d => ["TOP", "NORMAL", "BOTTOM"].includes(d.category.toUpperCase().trim()));

    let sumProd = 0;
    let sumTarget = 0;
    const actCounts = {};

    data.forEach(d => {
        // Accumulate for dynamic Efficiency
        sumProd += d.productivity;
        sumTarget += (d.targetObj || 0);

        actCounts[d.activity] = (actCounts[d.activity] || 0) + 1;
    });

    const avgEff = sumTarget > 0 ? ((sumProd / sumTarget) * 100).toFixed(1) : 0;
    const mainAct = Object.keys(actCounts).length ? Object.keys(actCounts).reduce((a, b) => actCounts[a] > actCounts[b] ? a : b) : "-";
    document.getElementById('userEffDisplay').innerText = avgEff + "%"; document.getElementById('userMainActDisplay').innerText = mainAct;
    calculateUserWeightedCategory(data);
    const tbody = document.getElementById('userTableBody'); tbody.innerHTML = '';
    data.sort((a, b) => b.ts - a.ts);
    currentFilteredUserRows = data; // Cache for export
    document.getElementById('userRecordCount').innerText = Math.min(data.length, 500);

    // Fragmento para performance
    const fragment = document.createDocumentFragment();
    data.slice(0, 500).forEach(d => {
        const t = d.targetObj || 0; // NEW: Dynamic Target (Table Only)
        const eff = t > 0 ? ((d.productivity / t) * 100).toFixed(0) : 0; const style = getColorStatus(eff, d.category);
        const tr = document.createElement('tr');
        tr.dataset.cat = style.label;
        tr.innerHTML = `<td>${d.dateStr}</td><td class="small fw-bold">${d.activity}</td><td>${d.productivity.toFixed(1)}</td><td>${t.toFixed(2)}</td><td><span class="eff-val ${style.textClass}">${eff}%</span></td><td><span class="badge-gxo ${style.badgeClass}">${style.label}</span></td>`;
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

function exportUserTableToXLSX() {
    if (!window.XLSX) { alert("Librería no cargada."); return; }
    if (currentFilteredUserRows.length === 0) { alert("No hay datos para exportar."); return; }

    const data = currentFilteredUserRows.map(d => {
        const t = d.targetObj || 0; // Dynamic Target (Export Only)
        const eff = t > 0 ? ((d.productivity / t) * 100).toFixed(1) : 0;
        return {
            "ID": currentUserData[0]?.id || "-",
            "Nombre": currentUserData[0]?.name || "-",
            "Fecha": d.dateStr,
            "Actividad": d.activity,
            "Prod. Real": d.productivity,
            "Target": t,
            "Eficiencia %": parseFloat(eff),
            "Categoría": d.category
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas_Usuario");
    XLSX.writeFile(wb, `Registro_${currentUserData[0]?.name || 'Usuario'}.xlsx`);
}
