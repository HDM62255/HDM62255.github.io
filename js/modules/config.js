// CONFIGURACIÓN PRINCIPAL

// Nombre del archivo CSV a cargar por defecto
export const DEFAULT_CSV_NAME = 'database.csv';

// Objetivos de productividad por actividad (Targets)
export const TARGETS = {
    "EMPAQUETADO": 62, "UBICACION AGVS": 250, "UBICACION": 220,
    "UBICACION BULTO COMPLETO": 500, "RBS PICKING": 90, "VENTILACION": 250,
    "PICKING TRANSFER": 100, "CD PICKING": 100, "PICKING AUTOMATIZADO": 125,
    "DEVOLUCIONES ONLINE": 56, "PICKING": 45
};

// Paleta de colores para gráficos y UI
export const PALETTE = {
    bar: '#ffab91', target_light: '#37474f', target_dark: '#ffffff',
    trend_fill: 'rgba(227, 6, 19, 0.1)', best: '#a5d6a7', normal: '#ffe082', worst: '#ef9a9a',
    success_line: '#2E7D32', success_fill: 'rgba(46, 125, 50, 0.2)',
    failure_line: '#E30613', failure_fill: 'rgba(227, 6, 19, 0.2)'
};

// Nombres abreviados de los meses en español para visualización
export const MONTH_NAMES_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
