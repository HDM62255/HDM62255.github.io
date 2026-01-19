import { appData } from './data.js';
import { TARGETS } from './config.js';
import { getColorStatus } from './utils.js';

let bulkResultsCache = [];
export function initBulkView() {
    document.getElementById('btnProcessBulk').onclick = processBulk;
    document.getElementById('btnExportBulkXLSX').onclick = exportBulkTableToXLSX;

    document.addEventListener('DataLoaded', populateActivitySelector);
    if (appData && appData.length > 0) populateActivitySelector();
}

function populateActivitySelector() {
    const sel = document.getElementById('activitySelector');
    if (sel.options.length > 1) return;

    const actSet = new Set();
    if (appData && appData.length > 0) {
        appData.forEach(d => { if (d.activity) actSet.add(d.activity); });
        const sortedActs = Array.from(actSet).sort();
        sortedActs.forEach(act => {
            const opt = document.createElement('option');
            opt.value = act;
            opt.textContent = act;
            sel.appendChild(opt);
        });
    }
}

export function processBulk() {
    const raw = document.getElementById('bulkInput').value; const tokens = raw.split(/[\n,]+/).map(t => t.trim()).filter(t => t !== "");
    const tbody = document.getElementById('bulkTableBody'); tbody.innerHTML = '';
    const results = [];
    tokens.forEach(token => {
        // 1. Obtener TODOS los registros del usuario (para contar errores)
        const allUserRows = appData.filter(d => d.id === token || d.name === token);
        if (allUserRows.length === 0) return;

        // 2. Contar Errores
        let errorCount = 0;
        allUserRows.forEach(d => {
            const cat = d.category ? d.category.toUpperCase().trim() : "";
            if (cat.includes("ERROR") || cat.includes("REVISION")) {
                errorCount++;
            }
        });

        // 3. Filtrar para obtener solo datos válidos (TOP/NORMAL/BOTTOM) para los cálculos
        let uRows = allUserRows.filter(d => ["TOP", "NORMAL", "BOTTOM"].includes(d.category.toUpperCase().trim()));

        // --- FILTERING LOGIC ---
        const filterAct = document.getElementById('activitySelector').value;
        if (filterAct !== "MAIN") {
            uRows = uRows.filter(r => r.activity === filterAct);
            // If specific activity selected and no rows found, skip completely
            if (uRows.length === 0) return;
        }
        // -----------------------

        // Si no hay filas validas y tampoco errores, retornamos (usuario vacio o sin datos relevantes)
        // Si hay errores pero 0 validas, debemos mostrarlo tb.
        if (uRows.length === 0 && errorCount === 0) return;

        let sumProd = 0;
        let sumTarget = 0;
        const counts = {};
        const shiftCounts = {};
        const contractCounts = {};
        const statusCounts = {};

        // Procesar solo filas VÁLIDAS
        uRows.forEach(d => {
            counts[d.activity] = (counts[d.activity] || 0) + 1;
            sumProd += d.productivity;
            sumTarget += (d.targetObj || 0);

            const sVal = d.shift || "N/A";
            shiftCounts[sVal] = (shiftCounts[sVal] || 0) + 1;
            const cVal = d.contractType || "N/A";
            contractCounts[cVal] = (contractCounts[cVal] || 0) + 1;
            const stVal = d.currentStatus || "N/A";
            statusCounts[stVal] = (statusCounts[stVal] || 0) + 1;
        });

        const mainActivity = uRows.length > 0 ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) : "N/A";

        // Calculate Mode Shift
        let maxS = 0; let modeS = "-";
        for (const [k, v] of Object.entries(shiftCounts)) { if (v > maxS) { maxS = v; modeS = k; } }

        // Calculate Mode Contract
        let maxC = 0; let modeC = "-";
        for (const [k, v] of Object.entries(contractCounts)) { if (v > maxC) { maxC = v; modeC = k; } }

        // Calculate Mode Status
        let maxSt = 0; let modeSt = "-";
        for (const [k, v] of Object.entries(statusCounts)) { if (v > maxSt) { maxSt = v; modeSt = k; } }

        // Calcular Productividad Promedio para la actividad principal
        let sumProdMain = 0; let cntProdMain = 0;
        uRows.forEach(d => { if (d.activity === mainActivity) { sumProdMain += d.productivity; cntProdMain++; } });
        const avgProdMain = cntProdMain > 0 ? (sumProdMain / cntProdMain) : 0;

        // Dynamic Efficiency Calculation
        const effGlobal = sumTarget > 0 ? (sumProd / sumTarget) * 100 : 0;

        // --- LÓGICA DE CATEGORÍA ---
        let style = getColorStatus(effGlobal, "");
        let finalLabel = style.label;
        let isErrorLabel = false;

        const validCount = uRows.length;
        if (errorCount > validCount) {
            finalLabel = `ERROR FICHAJE (${errorCount})`;
            isErrorLabel = true;
        }

        // Use uRows[0] info for ID/Name if available, else fallback to allUserRows[0]
        const refUser = uRows.length > 0 ? uRows[0] : allUserRows[0];

        results.push({
            id: refUser.id,
            name: refUser.name,
            main: mainActivity,
            prodAvg: avgProdMain,
            eff: effGlobal,
            turno: modeS,
            tipo: modeC,
            estado: modeSt,
            label: finalLabel,
            isError: isErrorLabel
        });
    });

    // Custom Event dispatch to nav to user
    const handleRowClick = (id) => {
        document.querySelector('#tab-btn-user').click();
        document.getElementById('userSearchInput').value = id;
        document.dispatchEvent(new CustomEvent('SearchUserRequest', { detail: id }));
    };

    // Store for export
    bulkResultsCache = results;

    results.forEach(r => {
        let style = getColorStatus(r.eff, "");
        let badgeClass = style.badgeClass;
        let label = r.label;

        if (r.isError) {
            badgeClass = "bg-danger"; // Force red
        } else {
            // Re-calculate standard label just in case, though we have it in r.label usually?
            // Actually r.label is already correct from processBulk.
            // We just need to ensure badgeClass matches standard if not error.
            const s = getColorStatus(r.eff, r.label); // Pass label to force it
            badgeClass = s.badgeClass;
        }

        const tr = document.createElement('tr');
        tr.dataset.cat = label;
        tr.onclick = () => handleRowClick(r.id);
        tr.innerHTML = `<td><div class="fw-bold">${r.name}</div><div class="small text-muted">${r.id}</div></td><td>${r.turno}</td><td>${r.tipo}</td><td class="fw-bold">${r.main}</td><td class="text-center">${r.prodAvg.toFixed(1)}</td><td class="text-center"><span class="eff-val ${style.textClass}">${r.eff.toFixed(1)}%</span></td><td class="text-center"><span class="badge-gxo ${badgeClass}">${label}</span></td>`;
        tbody.appendChild(tr);
    });
}

function exportBulkTableToXLSX() {
    if (!window.XLSX) { alert("Librería no cargada."); return; }
    if (bulkResultsCache.length === 0) { alert("No hay datos para exportar."); return; }

    const data = bulkResultsCache.map(r => {
        return {
            "ID": r.id,
            "Usuario": r.name,
            "Estado": r.estado,
            "Turno": r.turno,
            "Tipo": r.tipo,
            "Operativa Principal": r.main,
            "Productividad Promedio": parseFloat(r.prodAvg.toFixed(1)),
            "Eficiencia Global %": parseFloat(r.eff.toFixed(1)),
            "Clasificación": r.label
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparativa_Masiva");
    XLSX.writeFile(wb, "Resultados_Comparativos.xlsx");
}
