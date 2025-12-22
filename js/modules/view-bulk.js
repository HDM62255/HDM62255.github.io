import { appData } from './data.js';
import { TARGETS } from './config.js';
import { getColorStatus } from './utils.js';

let bulkResultsCache = [];
export function initBulkView() {
    document.getElementById('btnProcessBulk').onclick = processBulk;
    document.getElementById('btnExportBulkXLSX').onclick = exportBulkTableToXLSX;
}

export function processBulk() {
    const raw = document.getElementById('bulkInput').value; const tokens = raw.split(/[\n,]+/).map(t => t.trim()).filter(t => t !== "");
    const tbody = document.getElementById('bulkTableBody'); tbody.innerHTML = '';
    const results = [];
    tokens.forEach(token => {
        const uRows = appData.filter(d => d.id === token || d.name === token);
        if (uRows.length === 0) return;

        let sumProd = 0;
        let sumTarget = 0;
        const counts = {};
        const shiftCounts = {};
        const contractCounts = {};
        const statusCounts = {};

        uRows.forEach(d => {
            counts[d.activity] = (counts[d.activity] || 0) + 1;

            // Accumulate Production and Target
            sumProd += d.productivity;
            sumTarget += (d.targetObj || 0);

            // Accumulate Shift and Turno(Contract)
            const sVal = d.shift || "N/A";
            shiftCounts[sVal] = (shiftCounts[sVal] || 0) + 1;

            const cVal = d.contractType || "N/A";
            contractCounts[cVal] = (contractCounts[cVal] || 0) + 1;

            const stVal = d.currentStatus || "N/A";
            statusCounts[stVal] = (statusCounts[stVal] || 0) + 1;
        });

        const mainActivity = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

        // Calculate Mode Shift
        let maxS = 0; let modeS = "-";
        for (const [k, v] of Object.entries(shiftCounts)) {
            if (v > maxS) { maxS = v; modeS = k; }
        }

        // Calculate Mode Contract
        let maxC = 0; let modeC = "-";
        for (const [k, v] of Object.entries(contractCounts)) {
            if (v > maxC) { maxC = v; modeC = k; }
        }

        // Calculate Mode Status
        let maxSt = 0; let modeSt = "-";
        for (const [k, v] of Object.entries(statusCounts)) {
            if (v > maxSt) { maxSt = v; modeSt = k; }
        }

        // Calcular Productividad Promedio para la actividad principal
        let sumProdMain = 0; let cntProdMain = 0;
        uRows.forEach(d => {
            if (d.activity === mainActivity) {
                sumProdMain += d.productivity;
                cntProdMain++;
            }
        });
        const avgProdMain = cntProdMain > 0 ? (sumProdMain / cntProdMain) : 0;

        // Dynamic Efficiency Calculation
        const effGlobal = sumTarget > 0 ? (sumProd / sumTarget) * 100 : 0;

        results.push({ id: uRows[0].id, name: uRows[0].name, main: mainActivity, prodAvg: avgProdMain, eff: effGlobal, turno: modeS, tipo: modeC, estado: modeSt });
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
        const style = getColorStatus(r.eff, "");
        const tr = document.createElement('tr');
        tr.dataset.cat = style.label;
        tr.onclick = () => handleRowClick(r.id);
        tr.innerHTML = `<td><div class="fw-bold">${r.name}</div><div class="small text-muted">${r.id}</div></td><td>${r.turno}</td><td>${r.tipo}</td><td class="fw-bold">${r.main}</td><td class="text-center">${r.prodAvg.toFixed(1)}</td><td class="text-center"><span class="eff-val ${style.textClass}">${r.eff.toFixed(1)}%</span></td><td class="text-center"><span class="badge-gxo ${style.badgeClass}">${style.label}</span></td>`;
        tbody.appendChild(tr);
    });
}

function exportBulkTableToXLSX() {
    if (!window.XLSX) { alert("Librería no cargada."); return; }
    if (bulkResultsCache.length === 0) { alert("No hay datos para exportar."); return; }

    const data = bulkResultsCache.map(r => {
        const style = getColorStatus(r.eff, "");
        return {
            "ID": r.id,
            "Usuario": r.name,
            "Estado": r.estado,
            "Turno": r.turno,
            "Tipo": r.tipo,
            "Operativa Principal": r.main,
            "Productividad Promedio": parseFloat(r.prodAvg.toFixed(1)),
            "Eficiencia Global %": parseFloat(r.eff.toFixed(1)),
            "Clasificación": style.label
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparativa_Masiva");
    XLSX.writeFile(wb, "Resultados_Comparativos.xlsx");
}
