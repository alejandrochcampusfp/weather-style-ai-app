"""
Proyecto: Weather & Style AI (Backend)
Autor: Alejandro Cuéllar 
Descripción: Servidor backend construido con FastAPI. Actúa como intermediario 
             conectándose a la API de Open-Meteo (para geolocalización y clima) 
             y a la API de Groq (para inteligencia artificial de forma asíncrona).
             Incluye base de datos SQLite para persistencia segura de outfits.
"""

import os
import json
import httpx
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import AsyncGroq

# 1. CARGA DE VARIABLES DE ENTORNO Y CONFIGURACIÓN
load_dotenv()
client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

app = FastAPI()

# 2. INICIALIZACIÓN DE BASE DE DATOS (SQLite)
# Se crea la tabla si no existe. Esto garantiza la persistencia local.
def init_db():
    conn = sqlite3.connect("outfits.db")
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS outfits_favoritos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_token TEXT NOT NULL,
            ciudad TEXT NOT NULL,
            plan TEXT NOT NULL,
            fecha_plan TEXT NOT NULL,
            superior TEXT NOT NULL,
            pantalon TEXT NOT NULL,
            abrigos TEXT NOT NULL,
            calzado TEXT NOT NULL,
            accesorios TEXT NOT NULL,
            consejo TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db() # Ejecutar al arrancar el servidor

# 3. MODELOS DE DATOS (Seguridad y validación con Pydantic para el POST)
class OutfitSaveInfo(BaseModel):
    usuario_token: str
    ciudad: str
    plan: str
    fecha_plan: str
    superior: str
    pantalon: str
    abrigos: str
    calzado: str
    accesorios: str
    consejo: str

# 4. DEFINICIÓN DE RUTAS (ENDPOINTS)
@app.get("/")
async def raiz():
    return FileResponse("static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/api/buscar-ciudad")
async def buscar_ciudad(nombre: str):
    """
    Endpoint para el autocompletado de ciudades.
    Utiliza httpx.AsyncClient para hacer una petición asíncrona a Open-Meteo.
    """
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={nombre}&count=5&language=es&format=json"
    
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(url)
        data = response.json()
        
    return data.get("results", [])

@app.get("/api/recomendar-ropa")
async def recomendar_ropa(
    lat: float, 
    lon: float, 
    nombre_ciudad: str, 
    dias_offset: int = 0, # 0 = Hoy, 1 = Mañana, 2 = Pasado...
    plan: str = "Paseo por la ciudad", 
    genero: str = "Hombre", 
    edad: str = "18-24 años",
    estilo_base: str = "Casual",
    tendencia: str = "Ninguna", 
    marcas: str = "Variadas"
):
    """
    Endpoint principal. Recibe los datos, consulta el clima actual y futuro (hasta 7 días),
    y envía la información a la IA.
    """
    # 1. Petición a la API del clima (extendida a 7 días)
    clima_url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
        f"&hourly=temperature_2m,precipitation_probability,precipitation,weather_code"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max"
        f"&forecast_days=7&timezone=auto"
    )
    
    async with httpx.AsyncClient() as client_http:
        res_clima = await client_http.get(clima_url)
        clima_data = res_clima.json()
    
# 2. Extracción dinámica basada en el día seleccionado (dias_offset)
    hourly = clima_data.get("hourly", {})
    daily = clima_data.get("daily", {})
    
    if dias_offset == 0:
        current = clima_data.get("current", {})
        temperatura = current.get("temperature_2m", 20)
        sensacion = current.get("apparent_temperature", 20)
        viento = current.get("wind_speed_10m", 0)
        humedad = current.get("relative_humidity_2m", 50)
        codigo_clima = current.get("weather_code", 0)
        fecha_texto = "Hoy"
    else:
        # Extracción segura para días futuros
        temps_max = daily.get("temperature_2m_max", [])
        temps_min = daily.get("temperature_2m_min", [])
        times_list = daily.get("time", [])
        
        temperatura = temps_max[dias_offset] if temps_max and 0 <= dias_offset < len(temps_max) else 20
        sensacion = temps_min[dias_offset] if temps_min and 0 <= dias_offset < len(temps_min) else 20
        viento = "Variable"
        humedad = "Variable"
        codigo_clima = 0
        fecha_texto = times_list[dias_offset] if times_list and 0 <= dias_offset < len(times_list) else "Próximos días"

    # Preparamos el pronóstico de las 24 horas correspondientes al día elegido
    horas_lista = []
    if hourly and "time" in hourly:
        inicio = dias_offset * 24
        fin = inicio + 24
        times = hourly["time"][inicio:fin]
        temps = hourly["temperature_2m"][inicio:fin]
        probs = hourly["precipitation_probability"][inicio:fin]
        codes = hourly["weather_code"][inicio:fin]
        
        for i in range(len(times)):
            hora_str = times[i].split("T")[1][:5]
            horas_lista.append({
                "hora": hora_str,
                "temp": temps[i],
                "prob_lluvia": probs[i],
                "code": codes[i]
            })

    precipitaciones_max = daily.get("precipitation_probability_max", [])
    if precipitaciones_max and 0 <= dias_offset < len(precipitaciones_max):
        lluvia_max_dia = precipitaciones_max[dias_offset]
    else:
        lluvia_max_dia = 0

    # 3. Construcción del Prompt
    prompt = f"""
    Eres un estilista personal de alto nivel y asesor de actividades. DEBES MOJARTE y ser extremadamente específico.
    Prohibido dar respuestas genéricas como "Pantalón cómodo" o "Chaqueta según temperatura". Nombra tejidos, cortes, modelos exactos o colores específicos.

    PERFIL DEL CLIENTE:
    - Género: {genero}
    - Edad: {edad}
    - Estilo Base: {estilo_base}
    - Tendencia Específica: {tendencia if tendencia else "Ninguna, cíñete al estilo base"}
    - Marcas de Referencia: {marcas if marcas else "Indiferente"}
    - PLAN EXACTO: "{plan}"
    - FECHA DEL PLAN: {fecha_texto}

    TIEMPO EN {nombre_ciudad} PARA ESE DÍA:
    Temperatura esperada: {temperatura}°C (Mínima/Sensación: {sensacion}°C), Viento: {viento}, Prob. Lluvia Máx: {lluvia_max_dia}%.

    INSTRUCCIONES CRÍTICAS:
    1. MATERIAL DEPORTIVO/PLAN: Si el plan implica surf, pon "Tabla de surf y neopreno (grosor según clima)" en accesorios. Si es fútbol, pon "Balón, botas de tacos y espinilleras". Si es playa, "Toalla, crema, sombrilla".
    2. ESPECIFICIDAD EXTREMA: En vez de "Camiseta técnica", di "Camiseta técnica Nike Dri-FIT de manga corta azul marino". En vez de "Pantalón", di "Vaqueros Levi's 501 de corte recto azul lavado" o "Pantalón de pinzas beige".
    3. ADAPTACIÓN AL CLIMA Y AL PLAN: El outfit debe permitir realizar el plan solicitado cómodamente con el clima previsto.
    4. TONO DEL CONSEJO: Directo, útil y con personalidad, explicando por qué has elegido esos materiales.

    Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
    {{
      "superior": "Prenda específica (marca, color, tejido, corte)",
      "pantalon": "Prenda inferior específica (marca, color, tejido, corte)",
      "abrigos": "Abrigo/chaqueta específica, o 'No es necesario'",
      "calzado": "Calzado específico (modelo, color, tipo de suela para el plan)",
      "accesorios": "Gafas, bolsos, Y OBLIGATORIAMENTE el equipo necesario para el plan (tablas, balones, palas, etc.)",
      "consejo_extra": "Tu consejo con mucha personalidad."
    }}
    """

    # 4. Petición asíncrona a la API de Groq
    try:
        completion = await client.chat.completions.create(
            model="qwen/qwen3.8-27b", 
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800
        )
        
        respuesta_texto = completion.choices[0].message.content
        respuesta_texto = respuesta_texto.replace("```json", "").replace("```", "").strip()
        recomendacion_json = json.loads(respuesta_texto)
        
    except Exception as e:
        print("--- ERROR DE GROQ ---", e)
        recomendacion_json = {
            "superior": "Error de conexión con la IA.",
            "pantalon": "Revisa la consola del backend.",
            "abrigos": f"Error: {str(e)}",
            "calzado": "Intenta realizar la búsqueda de nuevo.",
            "accesorios": "-",
            "consejo_extra": "Hubo un fallo en la generación del outfit."
        }

    # 5. Respuesta final combinada
    return {
        "ciudad": nombre_ciudad,
        "dia_seleccionado": fecha_texto,
        "clima": {
            "temperature_2m": temperatura,
            "apparent_temperature": sensacion,
            "wind_speed_10m": viento,
            "relative_humidity_2m": humedad,
            "weather_code": codigo_clima
        },
        "pronostico_horas": horas_lista,
        "recomendacion": recomendacion_json
    }

# 6. ENDPOINTS DE BASE DE DATOS (Métodos POST y GET Seguros)
@app.post("/api/guardar-outfit")
async def guardar_outfit(outfit: OutfitSaveInfo):
    """
    Endpoint POST para guardar el outfit en SQLite.
    Se utilizan consultas parametrizadas (?) para prevenir Inyección SQL (SQLi).
    """
    try:
        conn = sqlite3.connect("outfits.db")
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO outfits_favoritos 
            (usuario_token, ciudad, plan, fecha_plan, superior, pantalon, abrigos, calzado, accesorios, consejo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            outfit.usuario_token, outfit.ciudad, outfit.plan, outfit.fecha_plan, 
            outfit.superior, outfit.pantalon, outfit.abrigos, outfit.calzado, 
            outfit.accesorios, outfit.consejo
        ))
        conn.commit()
        conn.close()
        return {"status": "success", "mensaje": "Outfit guardado en la base de datos de forma segura."}
    except Exception as e:
        print("Error en BD:", e)
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos.")

@app.get("/api/mis-outfits")
async def obtener_outfits(token: str):
    """
    Endpoint GET para recuperar los outfits guardados por un usuario anónimo (token).
    Uso seguro de parámetros para evitar inyecciones en la lectura.
    """
    try:
        conn = sqlite3.connect("outfits.db")
        conn.row_factory = sqlite3.Row # Para devolver diccionarios en vez de tuplas
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ciudad, plan, fecha_plan, superior, pantalon, abrigos, calzado, accesorios, consejo 
            FROM outfits_favoritos 
            WHERE usuario_token = ? ORDER BY id DESC
        """, (token,))
        filas = cursor.fetchall()
        conn.close()
        
        return [dict(fila) for fila in filas]
    except Exception as e:
        print("Error en BD:", e)
        raise HTTPException(status_code=500, detail="Error al consultar la base de datos.")


# 7. ENDPOINT DE ELIMINACIÓN SEGURA
@app.delete("/api/eliminar-outfit/{outfit_id}")
async def eliminar_outfit(outfit_id: int):
    """
    Endpoint DELETE para eliminar un outfit favorito de la base de datos por su ID.
    Uso de consultas parametrizadas para prevenir Inyección SQL.
    """
    try:
        conn = sqlite3.connect("outfits.db")
        cursor = conn.cursor()
        cursor.execute("DELETE FROM outfits_favoritos WHERE id = ?", (outfit_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "mensaje": "Outfit eliminado correctamente."}
    except Exception as e:
        print("Error en BD al eliminar:", e)
        raise HTTPException(status_code=500, detail="Error interno al eliminar el registro.")