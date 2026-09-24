"""
Proyecto: Weather & Style AI (Backend)
Autor: Alejandro Cuéllar 
Descripción: Servidor backend construido con FastAPI. Actúa como intermediario 
             conectándose a la API de Open-Meteo (para geolocalización y clima) 
             y a la API de Groq (para inteligencia artificial de forma asíncrona).
"""

import os
import json
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from groq import AsyncGroq

# 1. CARGA DE VARIABLES DE ENTORNO Y CONFIGURACIÓN
load_dotenv()
client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

# Instanciamos la aplicación FastAPI
app = FastAPI()

# 2. DEFINICIÓN DE RUTAS (ENDPOINTS)
# Ruta principal que sirve directamente la interfaz web estática
@app.get("/")
async def raiz():
    return FileResponse("static/index.html")

# Montamos la carpeta 'static' para que FastAPI pueda servir archivos HTML, JS y CSS
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
    plan: str = "Paseo por la ciudad", 
    genero: str = "Hombre", 
    edad: str = "18-24 años",
    estilo_base: str = "Casual",
    tendencia: str = "Ninguna", 
    marcas: str = "Variadas"
):
    """
    Endpoint principal. Recibe los datos del usuario, consulta el clima actual y el
    pronóstico, y envía toda la información a la IA para generar un outfit.
    """
    # 1. Petición a la API del clima (Open-Meteo)
    clima_url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
        f"&hourly=temperature_2m,precipitation_probability,precipitation,weather_code"
        f"&forecast_days=2&timezone=auto"
    )
    
    async with httpx.AsyncClient() as client_http:
        res_clima = await client_http.get(clima_url)
        clima_data = res_clima.json()
    
    # 2. Extracción y formateo de datos meteorológicos
    current = clima_data.get("current", {})
    hourly = clima_data.get("hourly", {})

    temperatura = current.get("temperature_2m", 20)
    sensacion = current.get("apparent_temperature", 20)
    viento = current.get("wind_speed_10m", 0)
    humedad = current.get("relative_humidity_2m", 50)
    lluvia_actual = current.get("precipitation", 0)
    codigo_clima = current.get("weather_code", 0)

    # Preparamos el pronóstico de las próximas 24 horas para el frontend
    horas_lista = []
    if hourly and "time" in hourly:
        times = hourly["time"][:24]
        temps = hourly["temperature_2m"][:24]
        probs = hourly["precipitation_probability"][:24]
        codes = hourly["weather_code"][:24]
        
        for i in range(len(times)):
            hora_str = times[i].split("T")[1][:5] # Extraemos solo la hora (HH:MM)
            horas_lista.append({
                "hora": hora_str,
                "temp": temps[i],
                "prob_lluvia": probs[i],
                "code": codes[i]
            })

    lluvia_max_24h = max(hourly.get("precipitation_probability", [0])[:24] or [0])

    # 3. Construcción del Prompt (Ingeniería de Prompts)
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

    TIEMPO EN {nombre_ciudad}:
    {temperatura}°C (Sensación: {sensacion}°C), Viento: {viento}km/h, Prob. Lluvia: {lluvia_max_24h}%.

    INSTRUCCIONES CRÍTICAS:
    1. MATERIAL DEPORTIVO/PLAN: Si el plan implica surf, pon "Tabla de surf y neopreno (grosor según clima)" en accesorios. Si es fútbol, pon "Balón, botas de tacos y espinilleras". Si es playa, "Toalla, crema, sombrilla".
    2. ESPECIFICIDAD EXTREMA: En vez de "Camiseta técnica", di "Camiseta técnica Nike Dri-FIT de manga corta azul marino". En vez de "Pantalón", di "Vaqueros Levi's 501 de corte recto azul lavado" o "Pantalón de pinzas beige".
    3. ADAPTACIÓN AL CLIMA Y AL PLAN: El outfit debe permitir realizar el plan solicitado cómodamente con el clima actual.
    4. TONO DEL CONSEJO: Directo, útil y con personalidad, explicando por qué has elegido esos materiales para su plan y el clima.

    Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
    {{
      "superior": "Prenda específica (marca, color, tejido, corte)",
      "pantalon": "Prenda inferior específica (marca, color, tejido, corte)",
      "abrigos": "Abrigo/chaqueta específica, o 'No es necesario hoy'",
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

    # 5. Respuesta final combinada (Clima + IA) hacia el Frontend
    return {
        "ciudad": nombre_ciudad,
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
