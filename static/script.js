/**
 * Proyecto: Weather & Style AI (Frontend)
 * Autor: Alejandro Cuéllar 
 * Descripción: Lógica del cliente en JavaScript puro (Vanilla JS). 
 *              Maneja el DOM, las peticiones asíncronas (fetch) al backend y 
 *              técnicas de optimización y bloqueo de peticiones simultáneas.
 */

// Estado global de la aplicación
let ultimaCiudadSeleccionada = null;
let timeoutAutocompletar = null;
let estaConsultando = false; // Cerrejo de seguridad para evitar cuelgues

// Referencias al DOM
const inputCiudad = document.getElementById('input-ciudad');
const btnBuscar = document.getElementById('btn-buscar');
const inputPlan = document.getElementById('input-plan');
const selectGenero = document.getElementById('select-genero');
const selectEdad = document.getElementById('select-edad');
const inputMarcas = document.getElementById('input-marcas');
const selectEstiloBase = document.getElementById('select-estilo-base');
const inputTendencia = document.getElementById('input-tendencia');

const listaSugerencias = document.getElementById('lista-sugerencias');
const loader = document.getElementById('loader');
const resultadoContainer = document.getElementById('resultado-container');
const contenedorEstilista = document.getElementById('resultado-estilista');
const contenedorHoras = document.getElementById('contenedor-horas');

/**
 * Traduce el código de clima de la API (WMO) a un emoji y texto legible.
 */
function obtenerIconoClima(code) {
    if (code === 0) return { icono: '☀️', texto: 'Despejado' };
    if ([1, 2, 3].includes(code)) return { icono: '⛅', texto: 'Parcialmente nublado' };
    if ([45, 48].includes(code)) return { icono: '🌫️', texto: 'Niebla' };
    if ([51, 53, 55, 61, 63, 65].includes(code)) return { icono: '🌧️', texto: 'Lluvia' };
    if ([80, 81, 82].includes(code)) return { icono: '🌦️', texto: 'Chubascos' };
    if ([95, 96, 99].includes(code)) return { icono: '⛈️', texto: 'Tormenta' };
    if ([71, 73, 75, 85, 86].includes(code)) return { icono: '❄️', texto: 'Nieve' };
    return { icono: '☁️', texto: 'Nublado' };
}

/**
 * Evento de entrada en el buscador de ciudades (Debouncing).
 */
inputCiudad.addEventListener('input', () => {
    clearTimeout(timeoutAutocompletar);
    const query = inputCiudad.value.trim();
    
    if (query.length < 2) {
        listaSugerencias.classList.add('hidden');
        return;
    }
    timeoutAutocompletar = setTimeout(() => buscarCiudades(query), 300);
});

/**
 * Llama al backend para obtener la lista de ciudades autocompletadas.
 */
async function buscarCiudades(query) {
    try {
        const res = await fetch(`/api/buscar-ciudad?nombre=${encodeURIComponent(query)}`);
        const ciudades = await res.json();

        if (!ciudades || ciudades.length === 0) {
            listaSugerencias.classList.add('hidden');
            return;
        }

        listaSugerencias.innerHTML = '';
        
        ciudades.forEach(ciudad => {
            const item = document.createElement('div');
            item.className = 'px-4 py-2 hover:bg-slate-700 cursor-pointer text-sm text-slate-200 border-b border-slate-700/50 last:border-0';
            
            const pais = ciudad.country ? `, ${ciudad.country}` : '';
            const admin = ciudad.admin1 ? ` (${ciudad.admin1})` : '';
            item.textContent = `${ciudad.name}${admin}${pais}`;
            
            item.addEventListener('click', () => {
                inputCiudad.value = `${ciudad.name}${pais}`;
                listaSugerencias.classList.add('hidden');
                
                ultimaCiudadSeleccionada = {
                    lat: ciudad.latitude,
                    lon: ciudad.longitude,
                    nombre: ciudad.name
                };

                ejecutarConsulta();
            });
            listaSugerencias.appendChild(item);
        });
        
        listaSugerencias.classList.remove('hidden');
    } catch (error) {
        console.error("Error buscando ciudad:", error);
    }
}

/**
 * Reactividad en los filtros.
 */
[inputPlan, selectGenero, selectEdad, selectEstiloBase, inputTendencia, inputMarcas].forEach(elem => {
    elem.addEventListener('change', () => {
        if (ultimaCiudadSeleccionada) ejecutarConsulta();
    });
});

// Evento del botón principal de búsqueda
btnBuscar.addEventListener('click', () => {
    if (ultimaCiudadSeleccionada) {
        ejecutarConsulta();
    } else if (inputCiudad.value.trim().length > 0) {
        buscarCiudades(inputCiudad.value.trim());
    }
});

/**
 * Función principal: Envía la información al backend gestionando el bloqueo.
 */
async function ejecutarConsulta() {
    // Si no hay ciudad o ya estamos esperando una respuesta, cancelamos la acción
    if (!ultimaCiudadSeleccionada || estaConsultando) return;

    estaConsultando = true; // Bloqueamos nuevas peticiones

    loader.classList.remove('hidden');
    resultadoContainer.classList.add('hidden');

    const { lat, lon, nombre } = ultimaCiudadSeleccionada;
    const plan = inputPlan.value.trim() || 'Paseo';
    const genero = selectGenero.value;
    const edad = selectEdad.value;
    const estiloBase = selectEstiloBase.value;
    const tendencia = inputTendencia.value.trim() || '';
    const marcas = inputMarcas.value.trim() || '';

    try {
        const url = `/api/recomendar-ropa?lat=${lat}&lon=${lon}&nombre_ciudad=${encodeURIComponent(nombre)}&plan=${encodeURIComponent(plan)}&genero=${encodeURIComponent(genero)}&edad=${encodeURIComponent(edad)}&estilo_base=${encodeURIComponent(estiloBase)}&tendencia=${encodeURIComponent(tendencia)}&marcas=${encodeURIComponent(marcas)}`;
        
        const res = await fetch(url);
        const data = await res.json();

        // 1. Pintar Clima Actual
        const infoClima = obtenerIconoClima(data.clima.weather_code);
        document.getElementById('icono-clima-actual').textContent = infoClima.icono;
        document.getElementById('nombre-ciudad-res').textContent = data.ciudad;
        document.getElementById('descripcion-clima').textContent = infoClima.texto;
        
        document.getElementById('val-temp').textContent = `${data.clima.temperature_2m}°C`;
        document.getElementById('val-sensacion').textContent = `${data.clima.apparent_temperature}°C`;
        document.getElementById('val-viento').textContent = `${data.clima.wind_speed_10m} km/h`;
        document.getElementById('val-humedad').textContent = `${data.clima.relative_humidity_2m}%`;

        // 2. Pintar Pronóstico por Horas
        contenedorHoras.innerHTML = '';
        if (data.pronostico_horas && data.pronostico_horas.length > 0) {
            data.pronostico_horas.forEach(horaInfo => {
                const iconoH = obtenerIconoClima(horaInfo.code).icono;
                const card = document.createElement('div');
                card.className = 'flex-none bg-slate-800/80 border border-slate-700/60 p-3 rounded-xl text-center min-w-[80px]';
                
                card.innerHTML = `
                    <span class="text-xs text-slate-400 font-medium block mb-1">${horaInfo.hora}</span>
                    <span class="text-2xl block my-1">${iconoH}</span>
                    <span class="text-sm font-bold text-white block">${horaInfo.temp}°C</span>
                    <span class="text-[10px] text-sky-400 font-semibold block mt-1">☔ ${horaInfo.prob_lluvia}%</span>
                `;
                contenedorHoras.appendChild(card);
            });
        }

        // 3. Pintar Recomendaciones del Estilista (IA)
        const rec = data.recomendacion;
        contenedorEstilista.innerHTML = `
            <div class="flex items-center gap-2 mb-3">
                <span class="text-xl">✨</span>
                <h3 class="text-lg font-bold text-white">Outfit Recomendado (${genero} | ${estiloBase} ${tendencia ? '- ' + tendencia : ''})</h3>
            </div>
            <p class="text-slate-300 text-sm italic mb-5 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                "${rec.consejo_extra}"
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
                    <span class="text-xs text-sky-400 font-bold block mb-1 tracking-wide">👕 PARTE SUPERIOR</span>
                    <p class="text-sm text-slate-200">${rec.superior}</p>
                </div>
                <div class="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
                    <span class="text-xs text-sky-400 font-bold block mb-1 tracking-wide">👖 PARTE INFERIOR</span>
                    <p class="text-sm text-slate-200">${rec.pantalon}</p>
                </div>
                <div class="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
                    <span class="text-xs text-sky-400 font-bold block mb-1 tracking-wide">🧥 ABRIGO / CAZADORA</span>
                    <p class="text-sm text-slate-200">${rec.abrigos}</p>
                </div>
                <div class="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
                    <span class="text-xs text-sky-400 font-bold block mb-1 tracking-wide">👟 CALZADO</span>
                    <p class="text-sm text-slate-200">${rec.calzado}</p>
                </div>
                <div class="md:col-span-2 bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
                    <span class="text-xs text-amber-400 font-bold block mb-1 tracking-wide">🎒 ACCESORIOS Y DETALLES</span>
                    <p class="text-sm text-slate-200">${rec.accesorios || 'Sin accesorios'}</p>
                </div>
            </div>
        `;

        loader.classList.add('hidden');
        resultadoContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Error al consultar la API:", error);
        loader.classList.add('hidden');
        alert("Hubo un problema al procesar la recomendación. Inténtalo de nuevo.");
    } finally {
        // Pase lo que pase (éxito o error), liberamos el cerrojo
        estaConsultando = false;
    }
}