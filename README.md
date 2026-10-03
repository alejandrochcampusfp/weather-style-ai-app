# Weather & Style AI

Aplicación web desarrollada con FastAPI y JavaScript que funciona como un recomendador de estilismos basado en las condiciones meteorológicas reales y en Inteligencia Artificial.

🔗 **Enlace en directo:** [https://weather-style-ai-app.onrender.com](https://weather-style-ai-app.onrender.com)

## ¿Qué hace la aplicación?
* **Consulta el clima:** Se conecta a Open-Meteo para obtener la temperatura, viento y previsión de la zona.
* **Recomendación con IA:** Utiliza la API de Groq para generar un estilismo adaptado al tiempo y a las preferencias introducidas.
* **Interfaz fluida:** Diseñada en Vanilla JavaScript y Tailwind CSS, con control de peticiones (*debouncing*) para optimizar el rendimiento.

## Tecnologías Utilizadas

* **Backend:** Python, FastAPI, Uvicorn, HTTPX (peticiones asíncronas).
* **Frontend:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS.
* **APIs:** Open-Meteo API y Groq API (LLM).

## Cómo ejecutarlo en local

Sigue estos pasos para probar el proyecto en tu máquina:

### 1. Clonar el repositorio
```
git clone https://github.com/alejandrochcampusfp/weather-style-ai-app.git
cd weather-style-ai-app
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


## Estructura del Proyecto
```
weather-style-ai-app/
│
├── main.py                # Backend: Rutas de FastAPI y lógica de servidor
├── .env                   # Variables de entorno (oculto en git)
├── requirements.txt       # Dependencias del proyecto
└── static/
    ├── index.html         # Frontend: Estructura de la interfaz
    └── script.js          # Frontend: Lógica de cliente, fetch y manipulación del DOM
```


## Autor
Alejandro Cuéllar
