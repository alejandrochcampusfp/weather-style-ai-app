/**
 * Proyecto: Weather & Style AI (Frontend)
 * Autor: Alejandro Cuéllar 
 * Descripción: Lógica de la interfaz en Vanilla JS. Gestiona las peticiones asíncronas
 *              al backend, el autocompletado y el guardado en base de datos.
 */

// Identificador único para guardar los outfits del usuario sin necesidad de login
function obtenerTokenUsuario() {
    let token = localStorage.getItem('usuario_token_clima');
    if (!token) {
        token = crypto.randomUUID ? crypto.randomUUID() : 'user-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('usuario_token_clima', token);
    }
    return token;
}
const tokenUsuario = obtenerTokenUsuario();

// Variables de estado global
let ultimaCiudadSeleccionada = null;
let timeoutAutocompletar = null;
let estaConsultando = false;
let ultimoOutfitGenerado = null; 

// Referencias al DOM (Formulario y filtros)
const inputCiudad = document.getElementById('input-ciudad');
const btnBuscar = document.getElementById('btn-buscar');
const selectDia = document.getElementById('select-dia');
const inputPlan = document.getElementById('input-plan');
const selectGenero = document.getElementById('select-genero');
const selectEdad = document.getElementById('select-edad');
const inputMarcas = document.getElementById('input-marcas');
const selectEstiloBase = document.getElementById('select-estilo-base');
const inputTendencia = document.getElementById('input-tendencia');

// Referencias al DOM (UI y resultados)
const listaSugerencias = document.getElementById('lista-sugerencias');
const loader = document.getElementById('loader');
const resultadoContainer = document.getElementById('resultado-container');
const contenedorEstilista = document.getElementById('resultado-estilista');
const contenedorHoras = document.getElementById('contenedor-horas');

const seccionFormulario = document.getElementById('seccion-formulario');
const panelFavoritos = document.getElementById('panel-favoritos');
const btnVerFavoritos = document.getElementById('btn-ver-favoritos');
const btnCerrarFavoritos = document.getElementById('btn-cerrar-favoritos');
const contenedorListaFavoritos = document.getElementById('contenedor-lista-favoritos');

// Función auxiliar para mapear el código WMO de Open-Meteo a un emoji legible
function obtenerIconoClima(code) {
    if (code === 0) return { icono: '☀️', texto: 'Despejado' };
    if ([1, 2, 3].includes(code)) return { icono: '⛅', texto: 'Parcialmente nublado' };
    if ([45, 48].includes(code)) return { icono: '🌫', texto: 'Niebla' };
    if ([51, 53, 55, 61, 63, 65].includes(code)) return { icono: '🌧️', texto: 'Lluvia' };
    if ([80, 81, 82].includes(code)) return { icono: '🌦️', texto: 'Chubascos' };
    if ([95, 96, 99].includes(code)) return { icono: '⛈️', texto: 'Tormenta' };
    if ([71, 73, 75, 85, 86].includes(code)) return { icono: '❄️', texto: 'Nieve' };
    return { icono: '☁️', texto: 'Nublado' };
}

// Autocompletado de ciudades con "debounce" para no saturar la API
inputCiudad.addEventListener('input', () => {
    clearTimeout(timeoutAutocompletar);
    const query = inputCiudad.value.trim();
    if (query.length < 2) {
        listaSugerencias.classList.add('hidden');
        return;
    }
    timeoutAutocompletar = setTimeout(() => buscarCiudades(query), 300);
});

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
            item.className = 'px-4 py-3 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-0 transition';
            const pais = ciudad.country ? `, ${ciudad.country}` : '';
            item.textContent = `${ciudad.name}${pais}`;
            
            item.addEventListener('click', () => {
                inputCiudad.value = `${ciudad.name}${pais}`;
                listaSugerencias.classList.add('hidden');
                ultimaCiudadSeleccionada = { lat: ciudad.latitude, lon: ciudad.longitude, nombre: ciudad.name };
                ejecutarConsulta();
            });
            listaSugerencias.appendChild(item);
        });
        listaSugerencias.classList.remove('hidden');
    } catch (error) {
        console.error("Error buscando ciudad:", error);
    }
}

// Recargar los resultados automáticamente si se cambia algún filtro (y ya hay una ciudad seleccionada)
[selectDia, inputPlan, selectGenero, selectEdad, selectEstiloBase, inputTendencia, inputMarcas].forEach(elem => {
    elem.addEventListener('change', () => {
        if (ultimaCiudadSeleccionada && !panelFavoritos.classList.contains('hidden') === false) {
            ejecutarConsulta();
        }
    });
});

btnBuscar.addEventListener('click', () => {
    if (ultimaCiudadSeleccionada) ejecutarConsulta();
    else if (inputCiudad.value.trim().length > 0) buscarCiudades(inputCiudad.value.trim());
});

// Lógica principal: Solicita los datos al backend (Clima + IA)
async function ejecutarConsulta() {
    if (!ultimaCiudadSeleccionada || estaConsultando) return;
    estaConsultando = true;

    // Actualizamos la UI para mostrar la carga
    loader.classList.remove('hidden');
    resultadoContainer.classList.add('hidden');
    panelFavoritos.classList.add('hidden');
    seccionFormulario.classList.remove('hidden');

    const { lat, lon, nombre } = ultimaCiudadSeleccionada;
    const dias_offset = selectDia.value;
    const plan = inputPlan.value.trim() || 'Paseo';
    const genero = selectGenero.value;
    const edad = selectEdad.value;
    const estiloBase = selectEstiloBase.value;
    const tendencia = inputTendencia.value.trim() || '';
    const marcas = inputMarcas.value.trim() || '';

    try {
        const url = `/api/recomendar-ropa?lat=${lat}&lon=${lon}&nombre_ciudad=${encodeURIComponent(nombre)}&dias_offset=${dias_offset}&plan=${encodeURIComponent(plan)}&genero=${encodeURIComponent(genero)}&edad=${encodeURIComponent(edad)}&estilo_base=${encodeURIComponent(estiloBase)}&tendencia=${encodeURIComponent(tendencia)}&marcas=${encodeURIComponent(marcas)}`;
        
        const res = await fetch(url);
        const data = await res.json();

        // Renderizar los datos básicos del clima
        const infoClima = obtenerIconoClima(data.clima.weather_code);
        document.getElementById('icono-clima-actual').textContent = infoClima.icono;
        document.getElementById('nombre-ciudad-res').textContent = data.ciudad;
        document.getElementById('descripcion-clima').textContent = infoClima.texto;
        document.getElementById('fecha-res').textContent = data.dia_seleccionado;
        
        document.getElementById('val-temp').textContent = `${data.clima.temperature_2m}°C`;
        document.getElementById('val-sensacion').textContent = `${data.clima.apparent_temperature}°C`;
        document.getElementById('val-viento').textContent = `${data.clima.wind_speed_10m} ${dias_offset == 0 ? 'km/h' : ''}`;
        document.getElementById('val-humedad').textContent = `${data.clima.relative_humidity_2m}${dias_offset == 0 ? '%' : ''}`;

        // Renderizar el bloque de pronóstico por horas
        contenedorHoras.innerHTML = '';
        if (data.pronostico_horas && data.pronostico_horas.length > 0) {
            data.pronostico_horas.forEach(horaInfo => {
                const iconoH = obtenerIconoClima(horaInfo.code).icono;
                const card = document.createElement('div');
                card.className = 'flex-none bg-white border border-slate-200 p-3 rounded-xl text-center min-w-[80px] shadow-sm';
                card.innerHTML = `
                    <span class="text-xs text-slate-500 font-medium block mb-1">${horaInfo.hora}</span>
                    <span class="text-2xl block my-1">${iconoH}</span>
                    <span class="text-sm font-bold text-slate-800 block">${horaInfo.temp}°C</span>
                    <span class="text-[10px] text-blue-600 font-semibold block mt-1">☔ ${horaInfo.prob_lluvia}%</span>
                `;
                contenedorHoras.appendChild(card);
            });
        }

        // Preparamos el objeto para guardarlo si el usuario lo desea
        const rec = data.recomendacion;
        ultimoOutfitGenerado = {
            ciudad: data.ciudad,
            plan: plan,
            fecha_plan: data.dia_seleccionado,
            superior: rec.superior,
            pantalon: rec.pantalon,
            abrigos: rec.abrigos,
            calzado: rec.calzado,
            accesorios: rec.accesorios,
            consejo: rec.consejo_extra
        };

        // Renderizar la respuesta de la IA
        contenedorEstilista.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                <div>
                    <h3 class="text-lg font-bold text-slate-900">Propuesta del Estilista</h3>
                </div>
                <button onclick="guardarOutfitEnBD()" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm flex items-center justify-center gap-2">
                    Guardar
                </button>
            </div>
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-5 text-sm text-slate-600 italic">
                "${rec.consejo_extra}"
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                    <span class="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wide">Parte Superior</span>
                    <p class="text-sm text-slate-800 font-medium">${rec.superior}</p>
                </div>
                <div class="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                    <span class="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wide">Parte Inferior</span>
                    <p class="text-sm text-slate-800 font-medium">${rec.pantalon}</p>
                </div>
                <div class="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                    <span class="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wide">Prenda de Abrigo</span>
                    <p class="text-sm text-slate-800 font-medium">${rec.abrigos}</p>
                </div>
                <div class="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                    <span class="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wide">Calzado</span>
                    <p class="text-sm text-slate-800 font-medium">${rec.calzado}</p>
                </div>
                <div class="md:col-span-2 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                    <span class="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wide">Accesorios / Equipo</span>
                    <p class="text-sm text-slate-800 font-medium">${rec.accesorios || 'Sin accesorios'}</p>
                </div>
            </div>
        `;

        loader.classList.add('hidden');
        resultadoContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Error al consultar la API:", error);
        loader.classList.add('hidden');
        alert("Hubo un problema. Inténtalo de nuevo.");
    } finally {
        estaConsultando = false;
    }
}

// Funciones de interacción con la Base de Datos (SQLite en el backend)
async function guardarOutfitEnBD() {
    if (!ultimoOutfitGenerado) return;
    
    // Inyectamos el token del usuario en el payload
    const payload = { ...ultimoOutfitGenerado, usuario_token: tokenUsuario };

    try {
        const response = await fetch('/api/guardar-outfit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("¡Guardado correctamente en tu historial!");
        } else {
            alert("Error al guardar.");
        }
    } catch (error) {
        console.error("Error POST:", error);
    }
}

// Lógica de la vista del historial
btnVerFavoritos.addEventListener('click', async () => {
    seccionFormulario.classList.add('hidden');
    resultadoContainer.classList.add('hidden');
    panelFavoritos.classList.remove('hidden');
    
    contenedorListaFavoritos.innerHTML = '<p class="text-center text-slate-500 mt-5">Cargando...</p>';

    try {
        const res = await fetch(`/api/mis-outfits?token=${tokenUsuario}`);
        const outfits = await res.json();

        if (outfits.length === 0) {
            contenedorListaFavoritos.innerHTML = '<p class="text-center text-slate-500 mt-5">Aún no tienes ningún outfit guardado.</p>';
            return;
        }

        contenedorListaFavoritos.innerHTML = '';
        outfits.forEach(outfit => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-slate-200 p-5 rounded-xl shadow-sm relative';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div>
                        <h4 class="font-bold text-slate-900 text-lg">${outfit.plan} en ${outfit.ciudad}</h4>
                        <span class="text-xs text-slate-500 font-medium">${outfit.fecha_plan}</span>
                    </div>
                    <button onclick="eliminarOutfitDeBD(${outfit.id})" class="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold border border-red-100 px-3 py-1.5 rounded-lg transition">
                        Eliminar
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600 mt-2">
                    <p><strong class="text-slate-800">Sup:</strong> ${outfit.superior}</p>
                    <p><strong class="text-slate-800">Inf:</strong> ${outfit.pantalon}</p>
                    <p><strong class="text-slate-800">Abrigo:</strong> ${outfit.abrigos}</p>
                    <p><strong class="text-slate-800">Pies:</strong> ${outfit.calzado}</p>
                    <div class="md:col-span-2 mt-2 pt-2 border-t border-slate-50">
                        <p><strong class="text-slate-800">Accesorios:</strong> ${outfit.accesorios || 'Ninguno'}</p>
                    </div>
                </div>
            `;
            contenedorListaFavoritos.appendChild(card);
        });
        
    } catch (error) {
        console.error("Error GET:", error);
        contenedorListaFavoritos.innerHTML = '<p class="text-red-500">Error al cargar datos.</p>';
    }
});

btnCerrarFavoritos.addEventListener('click', () => {
    panelFavoritos.classList.add('hidden');
    seccionFormulario.classList.remove('hidden');
    // Volvemos a mostrar el resultado si ya se había buscado algo
    if (ultimaCiudadSeleccionada) resultadoContainer.classList.remove('hidden');
});

async function eliminarOutfitDeBD(id) {
    if (!confirm("¿Eliminar este outfit?")) return;

    try {
        const response = await fetch(`/api/eliminar-outfit/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Recargar la lista simulando un clic en el botón de favoritos
            btnVerFavoritos.click();
        } else {
            alert("No se pudo eliminar.");
        }
    } catch (error) {
        console.error("Error DELETE:", error);
    }
}