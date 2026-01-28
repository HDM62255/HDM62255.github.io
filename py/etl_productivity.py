"""
ETL Script para Dashboard de Productividad - Version Optimizada
Procesa archivos parquet y genera JSONs agregados optimizados para dashboard web.
Usa operaciones vectorizadas para maximo rendimiento.

Uso:
    python etl_productivity.py "ruta/a/carpeta/con/parquets"
"""
import sys
import os
import json
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import pyarrow.parquet as pq

# Configuracion
OUTPUT_DIR = Path(__file__).parent.parent / "data"

def load_all_parquets(folder_path: str) -> pd.DataFrame:
    """Carga todos los archivos parquet de una carpeta y los concatena."""
    folder = Path(folder_path)
    parquet_files = list(folder.glob("*.parquet"))
    
    if not parquet_files:
        raise FileNotFoundError(f"No se encontraron archivos .parquet en {folder}")
    
    print(f"Encontrados {len(parquet_files)} archivos parquet:")
    for f in parquet_files:
        print(f"  - {f.name} ({f.stat().st_size / 1024 / 1024:.1f} MB)")
    
    dfs = []
    for f in parquet_files:
        print(f"Cargando {f.name}...", end=" ", flush=True)
        df = pq.read_table(f).to_pandas()
        print(f"{len(df):,} filas")
        dfs.append(df)
    
    combined = pd.concat(dfs, ignore_index=True)
    print(f"\nTotal combinado: {len(combined):,} filas")
    return combined


def prepare_data(df: pd.DataFrame) -> pd.DataFrame:
    """Prepara y limpia los datos."""
    print("Preparando datos...")
    
    # Renombrar columnas para facilitar manejo
    df = df.rename(columns={
        'U. mov.': 'Unidades',
        'Tipo movimiento': 'Operativa',
        'Tipo_Turno': 'Turno'
    })
    
    # Convertir unidades a numerico
    df['Unidades'] = pd.to_numeric(df['Unidades'], errors='coerce').fillna(0).astype(int)
    
    # Asegurar que Fecha es datetime y extraer componentes
    df['Fecha'] = pd.to_datetime(df['Fecha'])
    df['FechaStr'] = df['Fecha'].dt.strftime('%Y-%m-%d')
    df['MesNombre'] = df['Fecha'].dt.strftime('%Y-%m')
    df['Semana'] = df['Fecha'].dt.strftime('%Y-W%W')
    
    # Limpiar Turno (encoding issues)
    df['Turno'] = df['Turno'].str.replace('MA�ANA', 'MAÑANA', regex=False)
    df['Turno'] = df['Turno'].str.replace('MAANA', 'MAÑANA', regex=False)
    
    # ============================================
    # LIMPIEZA DE DATOS - Restricciones por operativa/zona
    # ============================================
    registros_iniciales = len(df)
    
    # Limpiar zona (eliminar comillas y espacios)
    df['Zona'] = df['Zona'].astype(str).str.strip().str.replace('"', '', regex=False)
    
    # 1. Eliminar zona "200" (no existe)
    df = df[df['Zona'] != '200']
    
    # 2. PICKING AUTOMATIZADO: no puede tener zona 0
    df = df[~((df['Operativa'] == 'PICKING AUTOMATIZADO') & (df['Zona'] == '0'))]
    
    # 3. PICKING y RBS PICKING: solo zonas 0, 1, 2, 3, 5 (zonas SUELO)
    zonas_suelo = ['0', '1', '2', '3', '5']
    df = df[~((df['Operativa'].isin(['PICKING', 'RBS PICKING'])) & (~df['Zona'].isin(zonas_suelo)))]
    
    # 4. Eliminar registros sin horas (usuarios sin fichaje que generan productividades irreales)
    # Registros con Horas_Totales = 0 o NaN pero con Unidades > 0 son errores de datos
    df['Horas_Totales'] = pd.to_numeric(df['Horas_Totales'], errors='coerce').fillna(0)
    registros_sin_horas = len(df[(df['Horas_Totales'] <= 0) & (df['Unidades'] > 0)])
    df = df[~((df['Horas_Totales'] <= 0) & (df['Unidades'] > 0))]
    
    registros_eliminados = registros_iniciales - len(df)
    print(f"  Registros eliminados por restricciones de zona: {registros_eliminados - registros_sin_horas:,}")
    print(f"  Registros eliminados por falta de horas: {registros_sin_horas:,}")
    
    return df


def calculate_prorated_hours_vectorized(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula las horas prorrateadas por zona y prenda de forma VECTORIZADA.
    
    Horas_Totales esta a nivel Usuario+Operativa+Dia.
    Prorrateamos segun la proporcion de unidades en cada zona/prenda.
    
    Formula: Horas_Prorrateadas = Horas_Base * (Unidades / Unidades_Total_Grupo)
    """
    print("Calculando horas prorrateadas (vectorizado)...")
    
    # Clave de agrupacion para obtener Horas_Totales originales
    group_key = ['Usuario', 'Operativa', 'FechaStr']
    
    # Calcular unidades totales por grupo
    df['UnidadesTotalGrupo'] = df.groupby(group_key)['Unidades'].transform('sum')
    
    # Obtener Horas_Base (primer valor del grupo, son todos iguales)
    df['Horas_Base'] = df.groupby(group_key)['Horas_Totales'].transform('first')
    
    # Calcular proporcion y prorratear (vectorizado)
    # Evitar division por cero
    df['Horas_Prorrateadas'] = df['Horas_Base'] * (df['Unidades'] / df['UnidadesTotalGrupo'].replace(0, 1))
    
    # Limpiar columnas temporales
    df = df.drop(columns=['UnidadesTotalGrupo', 'Horas_Base'])
    
    print("  Horas prorrateadas calculadas.")
    return df


def aggregate_data(df: pd.DataFrame) -> dict:
    """Genera agregaciones a diferentes niveles."""
    
    # Dimensiones base para todas las agregaciones
    dims_base = ['Usuario', 'Operativa', 'Zona', 'Prenda', 'Turno']
    
    results = {}
    
    # 1. Agregacion diaria
    print("Agregando por dia...", end=" ", flush=True)
    agg_day = df.groupby(['FechaStr'] + dims_base, as_index=False).agg({
        'Unidades': 'sum',
        'Horas_Prorrateadas': 'sum'
    })
    agg_day = agg_day.rename(columns={'FechaStr': 'Fecha'})
    # Calcular productividad vectorizado
    agg_day['Productividad'] = (agg_day['Unidades'] / agg_day['Horas_Prorrateadas'].replace(0, 1)).round(2)
    agg_day.loc[agg_day['Horas_Prorrateadas'] == 0, 'Productividad'] = 0
    results['day'] = agg_day.to_dict('records')
    print(f"{len(agg_day):,} registros")
    
    # 2. Agregacion semanal
    print("Agregando por semana...", end=" ", flush=True)
    agg_week = df.groupby(['Semana'] + dims_base, as_index=False).agg({
        'Unidades': 'sum',
        'Horas_Prorrateadas': 'sum'
    })
    agg_week['Productividad'] = (agg_week['Unidades'] / agg_week['Horas_Prorrateadas'].replace(0, 1)).round(2)
    agg_week.loc[agg_week['Horas_Prorrateadas'] == 0, 'Productividad'] = 0
    results['week'] = agg_week.to_dict('records')
    print(f"{len(agg_week):,} registros")
    
    # 3. Agregacion mensual
    print("Agregando por mes...", end=" ", flush=True)
    agg_month = df.groupby(['MesNombre'] + dims_base, as_index=False).agg({
        'Unidades': 'sum',
        'Horas_Prorrateadas': 'sum'
    })
    agg_month = agg_month.rename(columns={'MesNombre': 'Mes'})
    agg_month['Productividad'] = (agg_month['Unidades'] / agg_month['Horas_Prorrateadas'].replace(0, 1)).round(2)
    agg_month.loc[agg_month['Horas_Prorrateadas'] == 0, 'Productividad'] = 0
    results['month'] = agg_month.to_dict('records')
    print(f"{len(agg_month):,} registros")
    
    # 4. Agregacion historica (todo el periodo)
    print("Agregando historico...", end=" ", flush=True)
    agg_hist = df.groupby(dims_base, as_index=False).agg({
        'Unidades': 'sum',
        'Horas_Prorrateadas': 'sum'
    })
    agg_hist['Productividad'] = (agg_hist['Unidades'] / agg_hist['Horas_Prorrateadas'].replace(0, 1)).round(2)
    agg_hist.loc[agg_hist['Horas_Prorrateadas'] == 0, 'Productividad'] = 0
    results['historic'] = agg_hist.to_dict('records')
    print(f"{len(agg_hist):,} registros")
    
    return results


def generate_metadata(df: pd.DataFrame) -> dict:
    """Genera metadata con listas de valores unicos para filtros."""
    
    # Obtener fechas ordenadas
    fechas = sorted(df['FechaStr'].dropna().unique())
    
    metadata = {
        'usuarios': sorted(df['Usuario'].dropna().unique().tolist()),
        'operativas': sorted(df['Operativa'].dropna().unique().tolist()),
        'zonas': sorted(df['Zona'].dropna().unique().tolist()),
        'prendas': sorted(df['Prenda'].dropna().unique().tolist()),
        'turnos': sorted(df['Turno'].dropna().unique().tolist()),
        'fechas': fechas,
        'semanas': sorted(df['Semana'].dropna().unique().tolist()),
        'meses': sorted(df['MesNombre'].dropna().unique().tolist()),
        'fecha_min': fechas[0] if fechas else None,
        'fecha_max': fechas[-1] if fechas else None,
        'total_registros_originales': len(df),
        'generado': datetime.now().isoformat()
    }
    
    print(f"\nMetadata:")
    print(f"  Usuarios: {len(metadata['usuarios'])}")
    print(f"  Operativas: {len(metadata['operativas'])}")
    print(f"  Zonas: {len(metadata['zonas'])}")
    print(f"  Prendas: {len(metadata['prendas'])}")
    print(f"  Turnos: {len(metadata['turnos'])}")
    print(f"  Rango fechas: {metadata['fecha_min']} a {metadata['fecha_max']}")
    
    return metadata


def save_json(data, filename: str):
    """Guarda datos en JSON comprimido."""
    filepath = OUTPUT_DIR / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    size = filepath.stat().st_size / 1024 / 1024
    print(f"  {filename}: {size:.2f} MB")


def main(source_folder: str):
    """Funcion principal del ETL."""
    start_time = datetime.now()
    
    print("=" * 60)
    print("ETL Dashboard de Productividad (Optimizado)")
    print("=" * 60)
    
    # Crear directorio de salida
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Cargar datos
    print("\n[1/5] Cargando archivos parquet...")
    df = load_all_parquets(source_folder)
    
    # 2. Preparar datos
    print("\n[2/5] Preparando datos...")
    df = prepare_data(df)
    
    # 3. Calcular horas prorrateadas
    print("\n[3/5] Calculando horas prorrateadas...")
    df = calculate_prorated_hours_vectorized(df)
    
    # 4. Generar agregaciones
    print("\n[4/5] Generando agregaciones...")
    aggregations = aggregate_data(df)
    
    # 5. Generar metadata
    print("\n[5/5] Generando metadata...")
    metadata = generate_metadata(df)
    
    # Guardar archivos
    print("\n" + "=" * 60)
    print("Guardando archivos JSON...")
    save_json(aggregations['day'], 'aggregated_day.json')
    save_json(aggregations['week'], 'aggregated_week.json')
    save_json(aggregations['month'], 'aggregated_month.json')
    save_json(aggregations['historic'], 'aggregated_historic.json')
    save_json(metadata, 'metadata.json')
    
    elapsed = (datetime.now() - start_time).total_seconds()
    print("\n" + "=" * 60)
    print(f"ETL completado en {elapsed:.1f} segundos")
    print("=" * 60)
    print(f"\nArchivos generados en: {OUTPUT_DIR.absolute()}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python etl_productivity.py <ruta_carpeta_parquets>")
        sys.exit(1)
    
    source = sys.argv[1]
    if not os.path.isdir(source):
        print(f"Error: La ruta '{source}' no existe o no es un directorio")
        sys.exit(1)
    
    main(source)
