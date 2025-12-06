import { appData, latestDateInDB } from './data.js';
import { TARGETS, PALETTE } from './config.js';
import { getColorStatus, setLoader, formatKPIValue } from './utils.js';
import { renderDonut, renderGlobalChartItem } from './charts.js';

let filteredData = [];
let choicesInstance = null;
let isGlobalListView = false;
let globalUserListCache = [];
let currentSort = { field: 'eff', dir: 'desc' }; // Estado del ordenamiento
let currentCatFilter = 'ALL'; // Estado del filtro de categoría

/**
 * Inicializa la vista global.
 */
export function initGlobalView() {
    choicesInstance = new Choices('#filterActivities', {
        removeItemButton: true, placeholderValue: 'Seleccionar Actividades', itemSelectText: ''
    });

    const actSelect = document.getElementById('filterActivities');
    const updatePlaceholder = () => {
        const input = document.querySelector('.choices__input.choices__input--cloned');
        if (input) {
            const hasItems = choicesInstance.getValue(true).length > 0;
            if (hasItems) {
                input.placeholder = '';
                input.style.minWidth = '1ch';
                // Remove forced width if any
                input.style.width = 'auto';
            } else {
                input.placeholder = 'Seleccionar Actividades';
                input.style.minWidth = '250px'; // Ensure space for text
            }
        }
    };
    actSelect.addEventListener('addItem', updatePlaceholder);
    actSelect.addEventListener('removeItem', updatePlaceholder);

    // FIX: Popular filtros cuando datos cargan
    document.addEventListener('DataLoaded', () => {
        updateAuxFilter();
    });

    document.getElementById('filterMode').addEventListener('change', updateAuxFilter);
    document.getElementById('filterAux').addEventListener('change', runGlobalAnalysis);
    document.getElementById('filterActivities').addEventListener('change', runGlobalAnalysis);

    document.getElementById('btnToggleGlobalView').onclick = toggleGlobalView;
    document.getElementById('btnSelectAllActs').onclick = selectAllActivities;
    document.getElementById('btnResetGlobal').onclick = resetGlobalFilters;

    // Listeners para headers de tabla (ordenamiento)
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (currentSort.field === field) {
                currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
            } else {
                currentSort.field = field;
                currentSort.dir = 'desc'; // Default desc para numeros
                if (field === 'name') currentSort.dir = 'asc'; // Default asc para texto
            }
            renderGlobalListAsync(document.getElementById('filterAux').value);
        });
    });

    // Listener para filtro de categoría
    document.querySelectorAll('#catFilterDropdown .dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            currentCatFilter = item.dataset.val;
            // Actualizar UI del dropdown
            document.querySelectorAll('#catFilterDropdown .dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderGlobalListAsync(document.getElementById('filterAux').value);
        });
    });
}

function selectAllActivities() {
    const acts = [...new Set(appData.map(d => d.activity))].sort();
    choicesInstance.setChoiceByValue(acts);
    runGlobalAnalysis();
}

function resetGlobalFilters() {
    choicesInstance.removeActiveItems();
    document.getElementById('filterMode').value = 'history';
    updateAuxFilter();
}

/**
 * Actualiza el filtro auxiliar según el modo de tiempo seleccionado.
 */
export function updateAuxFilter() {
    const mode = document.getElementById('filterMode').value;
    const auxSelect = document.getElementById('filterAux');
    const lbl = document.getElementById('lblFilterAux');
    const acts = [...new Set(appData.map(d => d.activity))].sort();

    // Lógica NO SELECCIONAR NADA POR DEFECTO
    if (choicesInstance.getValue(true).length === 0 && acts.length > 0 && document.querySelectorAll('#filterActivities option').length === 0) {
        const choices = acts.map(act => ({ value: act, label: act, selected: false }));
        choicesInstance.setChoices(choices, 'value', 'label', true);
    }

    auxSelect.innerHTML = ''; auxSelect.disabled = false;
    let options = [];

    switch (mode) {
        case 'history': auxSelect.disabled = true; auxSelect.add(new Option("Todo el Histórico", "ALL")); lbl.innerText = "Selección Temporal"; break;
        case 'last7': auxSelect.disabled = true; auxSelect.add(new Option("Últimos 7 Días Registrados", "ALL")); lbl.innerText = "Selección Temporal"; break;
        case 'year': lbl.innerText = "Seleccionar Año"; options = [...new Set(appData.map(d => d.year))].sort().reverse(); break;
        case 'month': lbl.innerText = "Seleccionar Mes";
            const uniqueMonths = [...new Map(appData.map(item => [item.monthLabel, item])).values()];
            uniqueMonths.sort((a, b) => b.monthSortId - a.monthSortId);
            options = uniqueMonths.map(d => d.monthLabel); break;
        case 'week': lbl.innerText = "Seleccionar Semana"; options = [...new Set(appData.map(d => d.weekLabel))].sort().reverse(); break;
        case 'day': lbl.innerText = "Seleccionar Día";
            options = [...new Set(appData.map(d => d.dateStr))].sort((a, b) => {
                const da = a.split('/'); const db = b.split('/');
                return new Date(db[2], db[1] - 1, db[0]) - new Date(da[2], da[1] - 1, da[0]);
            });
            options = options.slice(0, 100); break;
    }
    options.forEach(o => auxSelect.add(new Option(o, o)));
    runGlobalAnalysis();
}

/**
 * Alterna entre vista de gráficas y listado.
 */
function toggleGlobalView() {
    isGlobalListView = !isGlobalListView;
    const btn = document.getElementById('btnToggleGlobalView');
    if (isGlobalListView) {
        btn.innerHTML = '<i class="bi bi-graph-up"></i> GRÁFICA';
        setLoader(true, "Generando tabla masiva...");
        setTimeout(runGlobalAnalysis, 50);
    } else {
        btn.innerHTML = '<i class="bi bi-table"></i> LISTADO';
        runGlobalAnalysis();
    }
}

/**
 * Ejecuta el análisis global y actualiza la UI.
 */
export function runGlobalAnalysis() {
    if (appData.length === 0) return;

    // Asegurar que choices tiene opciones si es la primera vez (fallback)
    const allActs = [...new Set(appData.map(d => d.activity))].sort();

    const mode = document.getElementById('filterMode').value;
    const auxVal = document.getElementById('filterAux').value;
    const selectedActs = choicesInstance.getValue(true);
    const actFilterList = selectedActs.length > 0 ? selectedActs : allActs;
    const sevenDaysAgo = new Date(latestDateInDB);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    filteredData = appData.filter(d => {
        if (selectedActs.length > 0 && !selectedActs.includes(d.activity)) return false;
        if (mode === 'history') return true;
        if (mode === 'year') return d.year == auxVal;
        if (mode === 'month') return d.monthLabel === auxVal;
        if (mode === 'week') return d.weekLabel === auxVal;
        if (mode === 'day') return d.dateStr === auxVal;
        if (mode === 'last7') return d.ts >= sevenDaysAgo.getTime();
        return true;
    });

    updateGlobalKPIs();
    const chartsCont = document.getElementById('chartsContainer');
    const listCont = document.getElementById('globalListContainer');

    if (isGlobalListView) {
        chartsCont.classList.add('d-none'); listCont.classList.remove('d-none');
        renderGlobalListAsync(auxVal);
    } else {
        chartsCont.classList.remove('d-none'); listCont.classList.add('d-none');
        renderGlobalCharts(actFilterList);
        setLoader(false);
    }
}

function updateGlobalKPIs() {
    const totalVol = filteredData.reduce((acc, curr) => acc + curr.production, 0);
    const totalHours = filteredData.reduce((acc, curr) => acc + curr.hours, 0);
    let sumEff = 0; let countEff = 0;
    const cats = { BEST: 0, NORMAL: 0, WORST: 0 };
    filteredData.forEach(d => {
        const t = TARGETS[d.activity] || 0;
        let eff = t > 0 ? (d.productivity / t) * 100 : 0;
        if (t > 0) { sumEff += eff; countEff++; }
        const st = getColorStatus(eff, d.category);
        if (st.label === "BEST") cats.BEST++; else if (st.label === "WORST") cats.WORST++; else cats.NORMAL++;
    });

    // Uso del nuevo formateador
    document.getElementById('kpi-vol-total').innerText = formatKPIValue(totalVol);
    // FIX: Formateo estricto a 1 decimal para Horas Totales
    document.getElementById('kpi-hours-total').innerText = totalHours.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    document.getElementById('kpi-eff-avg').innerText = countEff > 0 ? (sumEff / countEff).toFixed(1) + "%" : "0%";

    const isDarkMode = document.body.classList.contains('dark-mode');
    renderDonut(cats, isDarkMode);
}

function renderGlobalCharts(activities) {
    const container = document.getElementById('chartsContainer'); container.innerHTML = '';
    const mode = document.getElementById('filterMode').value;
    const groupDaily = ['month', 'week', 'day', 'last7'].includes(mode);
    const isDarkMode = document.body.classList.contains('dark-mode');

    activities.forEach(act => {
        if (!TARGETS[act]) return;
        const actData = filteredData.filter(d => d.activity === act);
        if (actData.length === 0) return;
        const groups = {};
        actData.forEach(d => {
            const key = groupDaily ? d.dateStr : d.monthLabel;
            const sId = groupDaily ? d.ts : d.monthSortId;
            if (!groups[key]) groups[key] = { sumProd: 0, count: 0, sortId: sId };
            groups[key].sumProd += d.productivity; groups[key].count++;
        });
        const labels = Object.keys(groups).sort((a, b) => groups[a].sortId - groups[b].sortId);
        const dataReal = labels.map(k => (groups[k].sumProd / groups[k].count).toFixed(1));
        const dataTarget = new Array(labels.length).fill(TARGETS[act]);

        renderGlobalChartItem(container, act, labels, dataReal, dataTarget, isDarkMode);
    });
}

function renderGlobalListAsync(filterLabel) {
    const tbody = document.getElementById('globalListBody'); tbody.innerHTML = '';
    const userMap = new Map();
    filteredData.forEach(d => {
        if (!userMap.has(d.id)) { userMap.set(d.id, { id: d.id, name: d.name, sumProd: 0, countProd: 0, sumEff: 0, countEff: 0, cats: { BEST: 0, NORMAL: 0, WORST: 0 } }); }
        const u = userMap.get(d.id);
        u.sumProd += d.productivity; u.countProd++;
        const t = TARGETS[d.activity] || 0;
        if (t > 0) { u.sumEff += (d.productivity / t) * 100; u.countEff++; }
        const st = getColorStatus((t > 0 ? (d.productivity / t) * 100 : 0), d.category);
        if (st.label === "BEST") u.cats.BEST++; else if (st.label === "WORST") u.cats.WORST++; else u.cats.NORMAL++;
    });

    let list = Array.from(userMap.values());

    // Aplicar Filtro de Categoría si existe
    if (currentCatFilter !== 'ALL') {
        list = list.filter(u => {
            const sBest = u.cats.BEST * 0.3; const sNorm = u.cats.NORMAL * 0.3; const sWorst = u.cats.WORST * 0.4;
            let label = "NORMAL"; if (sWorst >= sBest && sWorst >= sNorm) label = "WORST"; else if (sBest >= sNorm && sBest > sWorst) label = "BEST";
            return label === currentCatFilter;
        });
    }

    // FIX: Filtrar usuarios con Prod. Real (SumProd) = 0
    list = list.filter(u => u.sumProd > 0);

    // Aplicar Ordenamiento
    list.sort((a, b) => {
        let valA, valB;
        if (currentSort.field === 'name') { valA = a.name; valB = b.name; }
        else if (currentSort.field === 'prod') { valA = a.countProd > 0 ? (a.sumProd / a.countProd) : 0; valB = b.countProd > 0 ? (b.sumProd / b.countProd) : 0; }
        else if (currentSort.field === 'eff') { valA = a.countEff > 0 ? (a.sumEff / a.countEff) : 0; valB = b.countEff > 0 ? (b.sumEff / b.countEff) : 0; }

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    globalUserListCache = list;
    document.getElementById('globalListCount').innerText = globalUserListCache.length;
    let dateTerm = filterLabel === "ALL" ? "Histórico" : filterLabel;
    const chunkSize = 50; let currentIndex = 0;

    function renderChunk() {
        const fragment = document.createDocumentFragment();
        const limit = Math.min(currentIndex + chunkSize, globalUserListCache.length);
        for (let i = currentIndex; i < limit; i++) {
            const u = globalUserListCache[i];
            const avgProd = u.countProd > 0 ? (u.sumProd / u.countProd).toFixed(1) : 0;
            const avgEff = u.countEff > 0 ? (u.sumEff / u.countEff).toFixed(0) : 0;
            const sBest = u.cats.BEST * 0.3; const sNorm = u.cats.NORMAL * 0.3; const sWorst = u.cats.WORST * 0.4;
            let label = "NORMAL"; if (sWorst >= sBest && sWorst >= sNorm) label = "WORST"; else if (sBest >= sNorm && sBest > sWorst) label = "BEST";
            const style = getColorStatus(0, label); const effStyle = getColorStatus(avgEff, "");

            const tr = document.createElement('tr'); tr.style.cursor = 'pointer';
            tr.dataset.cat = label; // Semantic Hover logic
            tr.onclick = function () {
                document.querySelector('#tab-btn-user').click();
                document.getElementById('userSearchInput').value = u.id;
                document.dispatchEvent(new CustomEvent('SearchUserRequest', { detail: u.id }));
            };

            tr.innerHTML = `<td><div class="fw-bold">${u.name}</div><div class="small text-muted">${u.id}</div></td><td>${dateTerm}</td><td>${avgProd}</td><td><span class="eff-val ${effStyle.textClass}">${avgEff}%</span></td><td><span class="badge-gxo ${style.badgeClass}">${label}</span></td>`;
            fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
        currentIndex += chunkSize;
        if (currentIndex < globalUserListCache.length) { requestAnimationFrame(renderChunk); } else { setLoader(false); }
    }
    renderChunk();
}
