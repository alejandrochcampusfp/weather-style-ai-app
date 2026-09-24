# 🌤️ Weather & Style AI

**Weather & Style AI** es una aplicación web de arquitectura Cliente-Servidor que actúa como un estilista personal inteligente. Combina datos meteorológicos en tiempo real con Inteligencia Artificial para recomendar el *outfit* perfecto basándose en la ubicación, el clima exacto y el plan específico del usuario.

## ✨ Características Principales

* **Geolocalización Dinámica:** Autocompletado de ciudades en tiempo real mediante la API de Open-Meteo.
* **Clima de Precisión:** Obtención de temperatura, sensación térmica, viento, humedad y pronóstico de precipitaciones hora a hora para las próximas 24 horas.
* **IA Generativa Asíncrona:** Integración con la API de Groq (modelo Qwen) para generar recomendaciones de estilo hiperpersonalizadas, considerando el género, la edad, el estilo base y las marcas favoritas del usuario.
* **Rendimiento Optimizado:** Backend 100% asíncrono con FastAPI y peticiones no bloqueantes (`httpx` y `AsyncGroq`).
* **Frontend Reactivo y Seguro:** Interfaz desarrollada en Vanilla JavaScript con técnicas de *Debouncing* y bloqueos de estado para evitar la saturación de peticiones a la API. Diseño completamente *Responsive* con Tailwind CSS.

## 🛠️ Stack Tecnológico

**Backend:**
* [Python 3](https://www.python.org/)
* [FastAPI](https://fastapi.tiangolo.com/) - Framework web rápido y moderno.
* [Uvicorn](https://www.uvicorn.org/) - Servidor ASGI.
* [HTTPX](https://www.python-httpx.org/) - Cliente HTTP asíncrono.
* [Groq SDK](https://console.groq.com/) - Para la integración con modelos LLM.

**Frontend:**
* HTML5 Semántico
* JavaScript (Vanilla ES6+)
* [Tailwind CSS](https://tailwindcss.com/) (vía CDN)

**APIs Externas:**
* [Open-Meteo API](https://open-meteo.com/) (Geocoding & Forecast)
* Groq API (Qwen 27b)

## 🚀 Instalación y Despliegue Local

Sigue estos pasos para ejecutar el proyecto en tu máquina local:

### 1. Clonar el repositorio
```
git clone [https://github.com/alejandrochcampusfp/weather-style-ai.git](https://github.com/alejandrochcampusfp/weather-style-ai.git)
cd weather-style-ai
```

### 2. Crear y activar un entorno virtual
```
# En Windows
python -m venv venv
venv\Scripts\activate

# En macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar dependencias
Asegúrate de tener un archivo requirements.txt en la raíz con las dependencias necesarias.
pip install -r requirements.txt

### 4. Configurar Variables de Entorno
Crea un archivo llamado .env en la raíz del proyecto y añade tu clave de API de Groq:
GROQ_API_KEY=tu_clave_api_aqui

### 5. Ejecutar el Servidor
uvicorn main:app --reload

La aplicación estará disponible en: http://localhost:8000


## 📁 Estructura del Proyecto
weather-style-ai/
│
├── main.py                # Backend: Rutas de FastAPI y lógica de servidor
├── .env                   # Variables de entorno (No incluir en los commits)
├── requirements.txt       # Dependencias de Python
└── static/
    ├── index.html         # Frontend: Estructura de la interfaz
    └── script.js          # Frontend: Lógica de cliente, fetch y manipulación del DOM


## 👨‍💻 Autor
Alejandro Cuéllar