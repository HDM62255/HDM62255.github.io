import { initDataHandling } from './modules/data.js';
import { initGlobalView, runGlobalAnalysis } from './modules/view-global.js';
import { initUserView, filterUserTable } from './modules/view-user.js';
import { initBulkView } from './modules/view-bulk.js';

let isDarkMode = true;
document.body.classList.add('dark-mode');
document.getElementById('darkModeToggle').classList.add('active');

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Componentes de Vistas
    initGlobalView();
    initUserView();
    initBulkView();

    // Inicializar Tooltips de Bootstrap
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    // Inicializar Manejador de Datos
    initDataHandling();

    // Evento Global de Dark Mode
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
});


/**
 * Alterna el modo oscuro de la aplicación.
 */
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    document.getElementById('darkModeToggle').classList.toggle('active');

    // Actualizar defaults de Chart.js
    if (window.Chart) {
        Chart.defaults.color = isDarkMode ? '#e0e0e0' : '#2c3e50';
        Chart.defaults.borderColor = isDarkMode ? '#333333' : '#eeeeee';
    }

    // Refrescar vistas para aplicar nuevos colores en gráficos
    runGlobalAnalysis();

    if (!document.getElementById('userStats').classList.contains('d-none')) {
        filterUserTable();
    }
}
