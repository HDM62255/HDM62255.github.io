import { appData, latestDateInDB } from './data.js';
import { TARGETS, PALETTE } from './config.js';
import { getColorStatus, setLoader, formatKPIValue } from './utils.js';
import { renderDonut, renderGlobalChartItem } from './charts.js';
import { CalendarWidget } from './calendar.js';

let filteredData = [];
let choicesInstance = null;
let isGlobalListView = false;
let globalUserListCache = [];
let currentSort = { field: 'eff', dir: 'desc' }; // Estado del ordenamiento
let currentCatFilter = 'ALL'; // Estado del filtro de categoría
let currentShiftFilter = 'ALL'; // Estado filtro Turno
let currentContractFilter = 'ALL'; // Estado filtro Tipo
let calendarInstance = null; // Instancia del calendario
let customDates = []; // Fechas seleccionadas en calendario

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
    // Cambiamos el listener de change para filterAux, porque el calendario NO dispara change nativo en el select
    // Sino que llamaremos runGlobalAnalysis manualmente.
    document.getElementById('filterAux').addEventListener('change', runGlobalAnalysis);
    document.getElementById('filterActivities').addEventListener('change', runGlobalAnalysis);

    document.getElementById('btnToggleGlobalView').onclick = toggleGlobalView;
    document.getElementById('btnSelectAllActs').onclick = selectAllActivities;
    document.getElementById('btnResetGlobal').onclick = resetGlobalFilters;
    document.getElementById('btnExportXLSX').onclick = exportGlobalListToXLSX;

    // Listeners para headers de tabla (ordenamiento)
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (currentSort.field === field) {
                currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
            } else {
                currentSort.field = field;
                currentSort.dir = 'desc'; // Default desc para numeros
                if (field === 'name' || field === 'id') currentSort.dir = 'asc'; // Default asc para texto/id
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

function setupDynamicFilterListeners(dropdownId, updateStateCallback) {
    document.querySelectorAll(`#${dropdownId} .dropdown-item`).forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const val = item.dataset.val;
            updateStateCallback(val);
            // Update UI
            document.querySelectorAll(`#${dropdownId} .dropdown-item`).forEach(i => i.classList.remove('active'));
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

    // Limpiar calendario si existe
    if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; }

    switch (mode) {
        case 'history': auxSelect.disabled = true; auxSelect.add(new Option("Todo el Histórico", "ALL")); lbl.innerText = "Selección Temporal"; break;
        case 'last7': auxSelect.disabled = true; auxSelect.add(new Option("Últimos 7 Días Registrados", "ALL")); lbl.innerText = "Selección Temporal"; break;
        case 'calendar':
            lbl.innerText = "Seleccionar Fechas";
            // Crear opción dummy
            auxSelect.innerHTML = '';
            auxSelect.add(new Option("Seleccionar...", "CUSTOM"));
            // Iniciar Calendario Overlay
            calendarInstance = new CalendarWidget({
                isStatic: false,
                overlayTarget: auxSelect,
                initialDates: customDates,
                onSelect: (dates) => {
                    customDates = dates;
                    // Mostrar resumen en el select (visual hack)
                    auxSelect.options[0].text = dates.length > 0 ? (dates.length === 1 ? dates[0] : `${dates.length} días seleccionados`) : "Seleccionar...";
                    runGlobalAnalysis();
                }
            });
            calendarInstance.mount(auxSelect.parentNode); // Mount on parent Col
            break;
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
        if (mode === 'calendar') return customDates.includes(d.dateStr);
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

    // Para eficiencia y donut, SÍ filtramos por categorias validas
    const validData = filteredData.filter(d => ["TOP", "NORMAL", "BOTTOM"].includes(d.category.toUpperCase().trim()));

    let sumEff = 0; let countEff = 0;
    const cats = { TOP: 0, NORMAL: 0, BOTTOM: 0 };
    validData.forEach(d => {
        const t = TARGETS[d.activity] || 0;
        let eff = t > 0 ? (d.productivity / t) * 100 : 0;
        if (t > 0) { sumEff += eff; countEff++; }
        const st = getColorStatus(eff, d.category);
        if (st.label === "TOP") cats.TOP++; else if (st.label === "BOTTOM") cats.BOTTOM++; else cats.NORMAL++;
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
    const groupDaily = ['month', 'week', 'day', 'last7', 'calendar'].includes(mode);
    const isDarkMode = document.body.classList.contains('dark-mode');

    activities.forEach(act => {
        if (!TARGETS[act]) return;
        // FIX: Filtrar solo categorias validas para las gráficas
        const actData = filteredData.filter(d =>
            d.activity === act &&
            ["TOP", "NORMAL", "BOTTOM"].includes(d.category.toUpperCase().trim())
        );
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
        // FIX: Filtrar solo categorias validas para la lista
        if (!["TOP", "NORMAL", "BOTTOM"].includes(d.category.toUpperCase().trim())) return;

        if (!userMap.has(d.id)) { userMap.set(d.id, { id: d.id, name: d.name, sumProd: 0, countProd: 0, sumTarget: 0, countTarget: 0, cats: { TOP: 0, NORMAL: 0, BOTTOM: 0 }, shiftCounts: {}, contractCounts: {} }); }
        const u = userMap.get(d.id);
        u.sumProd += d.productivity; u.countProd++;

        // NEW: Calcular target dinámico para la lista
        u.sumTarget += (d.targetObj || 0); u.countTarget++;

        // Calcular eficiencia FILA para contadores de categoria (SOLO PARA LA LISTA)
        const t = d.targetObj || 0;
        const effRow = t > 0 ? (d.productivity / t) * 100 : 0;
        const st = getColorStatus(effRow, d.category);

        if (st.label === "TOP") u.cats.TOP++; else if (st.label === "BOTTOM") u.cats.BOTTOM++; else u.cats.NORMAL++;

        // Accumulate Shift and Turno(Contract)
        // CSV: Tipo_Turno -> data.js: shift
        // CSV: Turno      -> data.js: contractType
        const sVal = d.shift || "N/A";
        u.shiftCounts[sVal] = (u.shiftCounts[sVal] || 0) + 1;

        const cVal = d.contractType || "N/A";
        u.contractCounts[cVal] = (u.contractCounts[cVal] || 0) + 1;
    });

    let list = Array.from(userMap.values()).map(u => {
        // Calculate Mode Shift
        let maxS = 0; let modeS = "-";
        for (const [k, v] of Object.entries(u.shiftCounts)) {
            if (v > maxS) { maxS = v; modeS = k; }
        }
        u.boseShift = modeS;

        // Calculate Mode Contract
        let maxC = 0; let modeC = "-";
        for (const [k, v] of Object.entries(u.contractCounts)) {
            if (v > maxC) { maxC = v; modeC = k; }
        }
        u.boseContract = modeC;

        return u;
    });

    // Update Filter Dropdowns (Turno & Tipo) based on current list data
    updateFilterOptions(list);

    // Filter by Turno (Shift)
    if (currentShiftFilter !== 'ALL') {
        list = list.filter(u => u.boseShift === currentShiftFilter);
    }
    // Filter by Tipo (Contract)
    if (currentContractFilter !== 'ALL') {
        list = list.filter(u => u.boseContract === currentContractFilter);
    }

    // Aplicar Filtro de Categoría si existe
    if (currentCatFilter !== 'ALL') {
        list = list.filter(u => {
            const sTop = u.cats.TOP * 0.3; const sNorm = u.cats.NORMAL * 0.3; const sBottom = u.cats.BOTTOM * 0.4;
            let label = "NORMAL"; if (sBottom >= sTop && sBottom >= sNorm) label = "BOTTOM"; else if (sTop >= sNorm && sTop > sBottom) label = "TOP";
            return label === currentCatFilter;
        });
    }

    // FIX: Filtrar usuarios con Prod. Real (SumProd) = 0
    list = list.filter(u => u.sumProd > 0);

    // Aplicar Ordenamiento
    list.sort((a, b) => {
        let valA, valB;
        if (currentSort.field === 'name') { valA = a.name; valB = b.name; }
        else if (currentSort.field === 'id') { valA = a.id; valB = b.id; }
        // Logic Update for Sorting by Efficiency
        else if (currentSort.field === 'prod') { valA = a.countProd > 0 ? (a.sumProd / a.countProd) : 0; valB = b.countProd > 0 ? (b.sumProd / b.countProd) : 0; }
        else if (currentSort.field === 'eff') {
            // Calculate Eff on fly: (AvgProd / AvgTarget)
            const getEff = (u) => {
                const avgP = u.countProd > 0 ? u.sumProd / u.countProd : 0;
                const avgT = u.countTarget > 0 ? u.sumTarget / u.countTarget : 0;
                return avgT > 0 ? (avgP / avgT) : 0;
            };
            valA = getEff(a); valB = getEff(b);
        }

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

            // NUEVO CÁLCULO EFICIENCIA (Solo para la lista)
            const avgTarget = u.countTarget > 0 ? (u.sumTarget / u.countTarget) : 0;
            const avgProdVal = u.countProd > 0 ? (u.sumProd / u.countProd) : 0;
            let avgEffVal = 0;
            let avgEffTxt = "-";

            if (avgTarget > 0) {
                avgEffVal = (avgProdVal / avgTarget) * 100;
                avgEffTxt = avgEffVal.toFixed(0) + "%";
            }

            const sTop = u.cats.TOP * 0.3; const sNorm = u.cats.NORMAL * 0.3; const sBottom = u.cats.BOTTOM * 0.4;
            let label = "NORMAL"; if (sBottom >= sTop && sBottom >= sNorm) label = "BOTTOM"; else if (sTop >= sNorm && sTop > sBottom) label = "TOP";
            const style = getColorStatus(0, label); const effStyle = getColorStatus(avgEffVal, "");

            const tr = document.createElement('tr'); tr.style.cursor = 'pointer';
            tr.dataset.cat = label; // Semantic Hover logic
            tr.onclick = function () {
                document.querySelector('#tab-btn-user').click();
                document.getElementById('userSearchInput').value = u.id;
                document.dispatchEvent(new CustomEvent('SearchUserRequest', { detail: u.id }));
            };

            tr.innerHTML = `<td><div class="fw-bold text-start user-cell-truncate" title="${u.name}">${u.name}</div></td><td><div class="small text-muted">${u.id}</div></td><td><span class="badge bg-light text-dark border">${u.boseShift}</span></td><td><span class="badge bg-light text-dark border">${u.boseContract}</span></td><td>${dateTerm}</td><td>${avgProd}</td><td><span class="eff-val ${effStyle.textClass}">${avgEffTxt}</span></td><td><span class="badge-gxo ${style.badgeClass}">${label}</span></td>`;
            fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
        currentIndex += chunkSize;
        if (currentIndex < globalUserListCache.length) { requestAnimationFrame(renderChunk); } else { setLoader(false); }
    }
    renderChunk();
}

/**
 * Updates dynamic filter options for Turno and Tipo.
 */
function updateFilterOptions(userList) {
    const updateDropdown = (id, currentVal, values, callback) => {
        const ul = document.getElementById(id);
        // Keep "Todos" (first child)
        const allOpt = ul.firstElementChild.cloneNode(true);
        if (currentVal === 'ALL') allOpt.firstElementChild.classList.add('active');
        else allOpt.firstElementChild.classList.remove('active');

        ul.innerHTML = '';
        ul.appendChild(allOpt);

        values.forEach(v => {
            if (v === '-' || v === 'N/A') return; // Skip invalid
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.className = `dropdown-item ${v === currentVal ? 'active' : ''}`;
            a.href = '#';
            a.dataset.val = v;
            a.innerText = v;
            li.appendChild(a);
            ul.appendChild(li);
        });

        // Re-attach listeners
        setupDynamicFilterListeners(id, callback);
    };

    const uniqueShifts = [...new Set(userList.map(u => u.boseShift).filter(Boolean))].sort();
    updateDropdown('turnoFilterDropdown', currentShiftFilter, uniqueShifts, (val) => { currentShiftFilter = val; });

    const uniqueContracts = [...new Set(userList.map(u => u.boseContract).filter(Boolean))].sort();
    updateDropdown('tipoFilterDropdown', currentContractFilter, uniqueContracts, (val) => { currentContractFilter = val; });
}

/**
 * Exporta la lista visible a Excel.
 */
function exportGlobalListToXLSX() {
    if (!window.XLSX) {
        alert("Librería de exportación no cargada.");
        return;
    }
    if (globalUserListCache.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    const data = globalUserListCache.map(u => {
        const avgProd = u.countProd > 0 ? (u.sumProd / u.countProd).toFixed(1) : 0;

        const avgTarget = u.countTarget > 0 ? (u.sumTarget / u.countTarget) : 0;
        const avgProdVal = u.countProd > 0 ? (u.sumProd / u.countProd) : 0;
        let avgEff = 0;
        if (avgTarget > 0) avgEff = (avgProdVal / avgTarget) * 100;

        // Recalculate Category Logic (same as render)
        const sTop = u.cats.TOP * 0.3;
        const sNorm = u.cats.NORMAL * 0.3;
        const sBottom = u.cats.BOTTOM * 0.4;
        let label = "NORMAL";
        if (sBottom >= sTop && sBottom >= sNorm) label = "BOTTOM";
        else if (sTop >= sNorm && sTop > sBottom) label = "TOP";

        return {
            "ID": u.id,
            "Usuario": u.name,
            "Turno": u.boseShift,
            "Tipo": u.boseContract,
            "Prod. Real": parseFloat(avgProd),
            "Eficiencia %": parseFloat(avgEff.toFixed(1)),
            "Categoría": label
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, "Listado_Usuarios_GXO.xlsx");
}
