/**
 * ============================================================================
 * URBANIZACIÓN PEÑANEVADA IV - LA BALCONADA
 * Lógica en la Nube (Supabase) - Foro, Tablón, Alquiler y Censo Vecinal
 * ============================================================================
 */

// Datos de conexión estables con tu base de datos de Supabase
const SUPABASE_URL = "https://ocecsyclemjrrwulhuvv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZWNzeWNsZW1qcnJ3dWxodXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MzQxNzQsImV4cCI6MjEwNTUxMDE3NH0.9POWNRbCI5VzHpe1s6cIiZ7kitp-rb3X_w56D-xGjMs";
let clienteSupabase = null;

// Estado Global de la aplicación
let modoAdminActivo = false;
let categoriaForoActual = 'all';
let busquedaForoActual = '';
let usuarioActivo = null;
let temaAbierto = null;

// Configuración inicial del calendario (Septiembre 2026)
let fechaHoy = new Date(2026, 8, 20);
let mesActualCalendario = fechaHoy.getMonth();
let anoActualCalendario = fechaHoy.getFullYear();
let espacioSeleccionadoCalendario = 'salon';
let fechaSeleccionadaCalendario = '2026-09-24';

const PESTANAS_VALIDAS = ['inicio', 'piscina', 'club-social', 'jardineria', 'alquiler', 'noticias', 'foro', 'directorio', 'contacto', 'administracion'];

// ARRANQUE BLINDADO: Garantiza la creación de Supabase antes de descargar nada
document.addEventListener("DOMContentLoaded", async () => {
    const libSupabase = window.supabase || window.Supabase;

    if (libSupabase && typeof libSupabase.createClient === "function") {
        // 1. Crear el cliente de Supabase de manera prioritaria e inmediata
        clienteSupabase = libSupabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        // alert("⚠️ Error crítico: El conector de Supabase no está cargado en memoria.");
        return;
    }

    // 2. Inicializar los oyentes de eventos e interfaz
    inicializarNavegacionPestanas();
    inicializarSistemaSeguridad();

    // 3. Descarga diferida y segura de datos desde la nube
    try {
        await refrescarTodo();
    } catch (e) {
        // console.log("Inicialización pasiva del entorno...");
    }

    const inputFecha = document.getElementById("alquiler-fecha");
    if (inputFecha) inputFecha.value = fechaSeleccionadaCalendario;
});

// GESTIÓN DE ACCESOS Y ALTAS (AUTH GATE)
function inicializarSistemaSeguridad() {
    const forms = document.querySelectorAll('.auth-gate-overlay form');
    
    forms.forEach((form, index) => {
        form.removeAttribute('action');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const campos = form.querySelectorAll('input');
            
            if (index === 0) {
                // FORMULARIO DE ACCESO (LOGIN)
                const correoInput = document.getElementById("login-email") || campos[0];
                const claveInput = document.getElementById("login-password") || campos[1];
                
                if (!correoInput || !claveInput) {
                    // alert("Error: Casillas de inicio no encontradas.");
                    return;
                }
                
                const correo = correoInput.value.trim();
                const clave = claveInput.value;
                
                // Validación estática de cortesía
                if ((correo === "vecino@penanevada.es" && clave === "vecino1234") || 
                    (correo === "admin@penanevada.es" && clave === "admin1234")) {
                    
                    const esAdmin = correo.includes("admin");
                    usuarioActivo = { nombre: esAdmin ? "Administrador" : "Vecino Demo", vivienda: esAdmin ? "Junta" : "Chalet Demo" };
                    modoAdminActivo = esAdmin;
                    
                    document.querySelector(".auth-gate-overlay").classList.add("hidden");
                    actualizarHeaderUsuario(usuarioActivo.nombre, usuarioActivo.vivienda);
                    actualizarVisibilidadAdmin();
                    await refrescarTodo();
                    return;
                }

                // Validación dinámica real contra Supabase
                try {
                    const { data, error } = await clienteSupabase.from('vecinos').select('*').eq('email', correo).single();
                    if (data) {
                        document.querySelector(".auth-gate-overlay").classList.add("hidden");
                        usuarioActivo = { nombre: data.nombre, vivienda: data.vivienda };
                        modoAdminActivo = data.es_admin;
                        actualizarHeaderUsuario(data.nombre, data.vivienda);
                        actualizarVisibilidadAdmin();
                        await refrescarTodo();
                    } else {
                        // alert("❌ Usuario no registrado en el censo o credenciales incorrectas.");
                    }
                } catch (err) {
                    // alert("⚠️ Error de conexión con la base de datos de vecinos.");
                }
            } else {
                // FORMULARIO DE ALTA (REGISTRO CORREGIDO CON ÍNDICES)
                if (campos.length < 4) return;
                
                const nombre = campos[0].value.trim();
                const vivienda = campos[1].value.trim();
                const email = campos[2].value.trim();
                const codigo = campos[3].value.trim();
                
                if (!nombre || !vivienda || !email || !codigo) {
                    // alert("⚠️ Por favor, rellena todos los campos obligatorios.");
                    return;
                }
                
                if (codigo !== "BALCONADA2026") {
                    // alert("❌ Código de Urbanización inválido.");
                    return;
                }
                
                try {
                    const { error } = await clienteSupabase.from('vecinos').insert([{ nombre, vivienda, email, es_admin: false }]);
                    if (error) {
                        // alert("❌ Este correo electrónico ya está registrado.");
                    } else {
                        document.querySelector(".auth-gate-overlay").classList.add("hidden");
                        usuarioActivo = { nombre, vivienda };
                        actualizarHeaderUsuario(nombre, vivienda);
                        await refrescarTodo();
                        // alert("✅ Registro completado con éxito en Supabase.");
                    }
                } catch (err) {
                    // alert("⚠️ Error de red al intentar registrar la cuenta.");
                }
            }
        });
    });

    // Control de pestañas del muro
    document.querySelectorAll(".auth-tab-btn").forEach((btn, index) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".auth-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".auth-form-pane").forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            if (document.querySelectorAll(".auth-form-pane")[index]) {
                document.querySelectorAll(".auth-form-pane")[index].classList.add("active");
            }
        });
    });

    // Botón de deslogueo
    document.querySelector(".btn-logout")?.addEventListener("click", (e) => {
        e.preventDefault();
        modoAdminActivo = false;
        usuarioActivo = null;
        actualizarVisibilidadAdmin();
        document.querySelector(".auth-gate-overlay").classList.remove("hidden");
    });
}

function actualizarHeaderUsuario(nombre, vivienda) {
    const txtNombre = document.querySelector(".user-name-text");
    const txtVivienda = document.querySelector(".user-home-text");
    const circuloAvatar = document.querySelector(".user-avatar-circle");
    if (txtNombre) txtNombre.textContent = nombre;
    if (txtVivienda) txtVivienda.textContent = vivienda;
    if (circuloAvatar && nombre) circuloAvatar.textContent = nombre.charAt(0).toUpperCase();
}

async function refrescarTodo() {
    if (!supabase) return; // Protección contra cargas prematuras
    await cargarAnunciosTablon();
    await renderizarCalendario();
    await renderizarTablaReservas();
    await cargarTemasForo();
    if (modoAdminActivo) await renderizarCensoVecinos();
}
// ============================================================================
// CALENDARIO Y GESTIÓN DE RESERVAS EN LA NUBE
// ============================================================================
async function renderizarCalendario() {
    const contenedorDias = document.getElementById("calendar-days-container");
    const labelMes = document.getElementById("calendar-month-label");
    if (!contenedorDias || !labelMes) return;

    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    labelMes.textContent = `${nombresMeses[mesActualCalendario]} ${anoActualCalendario}`;
    contenedorDias.innerHTML = "";

    const primerDia = new Date(anoActualCalendario, mesActualCalendario, 1);
    const ultimoDia = new Date(anoActualCalendario, mesActualCalendario + 1, 0);
    const totalDias = ultimoDia.getDate();
    let diaInicioSemana = (primerDia.getDay() + 6) % 7;

    for (let i = 0; i < diaInicioSemana; i++) {
        const celdaVacia = document.createElement("div");
        celdaVacia.className = "cal-day-cell empty";
        contenedorDias.appendChild(celdaVacia);
    }

    // Consulta limpia a la tabla de reservas en la nube
    const { data: reservas } = await clienteSupabase.from('reservas').select('*').eq('espacio', espacioSeleccionadoCalendario).neq('estado', 'Cancelada');

    for (let dia = 1; dia <= totalDias; dia++) {
        const celda = document.createElement("div");
        const diaStr = dia < 10 ? "0" + dia : dia;
        const mesStr = (mesActualCalendario + 1) < 10 ? "0" + (mesActualCalendario + 1) : (mesActualCalendario + 1);
        const fechaCelda = `${anoActualCalendario}-${mesStr}-${diaStr}`;
        celda.textContent = dia;

        const fechaObj = new Date(anoActualCalendario, mesActualCalendario, dia);
        const esPasado = fechaObj < new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());
        const reservaExistente = reservas?.find(r => r.fecha === fechaCelda);

        if (esPasado) {
            celda.className = "cal-day-cell past";
        } else if (reservaExistente) {
            celda.className = "cal-day-cell booked";
            celda.title = `Ocupado: ${reservaExistente.franja}`;
        } else {
            celda.className = "cal-day-cell available";
            celda.onclick = () => seleccionarDiaCalendario(fechaCelda);
        }

        if (fechaCelda === fechaSeleccionadaCalendario) {
            celda.classList.add("selected");
        }
        contenedorDias.appendChild(celda);
    }
}

function seleccionarDiaCalendario(fechaStr) {
    fechaSeleccionadaCalendario = fechaStr;
    const inputFecha = document.getElementById("alquiler-fecha");
    if (inputFecha) inputFecha.value = fechaStr;
    renderizarCalendario();
    mostrarToast(`Día seleccionado: ${fechaStr}`, "success");
}

function navegarMesCalendario(direccion) {
    mesActualCalendario += direccion;
    if (mesActualCalendario > 11) { mesActualCalendario = 0; anoActualCalendario++; }
    else if (mesActualCalendario < 0) { mesActualCalendario = 11; anoActualCalendario--; }
    renderizarCalendario();
}

function seleccionarEspacioAlquiler(espacio, elemento) {
    espacioSeleccionadoCalendario = espacio;
    document.querySelectorAll(".space-card-selectable").forEach(c => c.classList.remove("active"));
    if (elemento) elemento.classList.add("active");
    const selectForm = document.getElementById("alquiler-espacio-select");
    if (selectForm) selectForm.value = espacio;
    renderizarCalendario();
}

function sincronizarEspacioDesdeFormulario(espacio) {
    espacioSeleccionadoCalendario = espacio;
    document.querySelectorAll(".space-card-selectable").forEach(c => c.classList.remove("active"));
    const tarjeta = document.getElementById(`card-espacio-${espacio}`);
    if (tarjeta) tarjeta.classList.add("active");
    renderizarCalendario();
}

function seleccionarFechaManual(fechaStr) {
    fechaSeleccionadaCalendario = fechaStr;
    const partes = fechaStr.split("-");
    if (partes.length === 3) {
        anoActualCalendario = parseInt(partes[0], 10);
        mesActualCalendario = parseInt(partes[1], 10) - 1;
    }
    renderizarCalendario();
}

async function enviarSolicitudAlquiler(e) {
    e.preventDefault();
    if (!usuarioActivo) { mostrarToast("Debes iniciar sesión para realizar una reserva.", "warning"); return; }

    const espacio = document.getElementById("alquiler-espacio-select").value;
    const fecha = document.getElementById("alquiler-fecha").value;
    const franja = document.getElementById("alquiler-franja").value;
    const telefono = document.getElementById("alquiler-telefono").value;
    const email = document.getElementById("alquiler-email").value;
    const refId = "ALQ-2026-" + Math.floor(100 + Math.random() * 900);

    const { error } = await clienteSupabase.from('reservas').insert([{
        ref: refId, espacio, fecha, franja, telefono, email, nombre_vecino: usuarioActivo.nombre, vivienda: usuarioActivo.vivienda, estado: 'Pendiente'
    }]);

    if (!error) {
        document.getElementById("form-solicitar-alquiler").reset();
        await renderizarCalendario();
        await renderizarTablaReservas();
        mostrarToast(`Solicitud enviada con éxito. Referencia: ${refId}`, "success");
    } else {
        mostrarToast("Error de conexión al guardar la reserva.", "danger");
    }
}
async function renderizarTablaReservas() {
    const tbody = document.getElementById("tbody-reservas");
    if (!tbody) return;
    
    const thAdmin = document.getElementById("th-admin-actions");
    if (thAdmin) thAdmin.style.display = modoAdminActivo ? "table-cell" : "none";
    
    const { data: reservas } = await clienteSupabase.from('reservas').select('*').order('fecha', { ascending: true });

    tbody.innerHTML = "";
    if (!reservas || reservas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px;">No hay registros de reservas.</td></tr>`;
        return;
    }

    reservas.forEach(res => {
        const fila = document.createElement("tr");
        let tdAdmin = modoAdminActivo ? `<td><button onclick="cambiarEstadoReserva(${res.id}, 'Aprobada')" style="background:#16a34a; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:bold; margin-right:4px;">✔️ Aprobar</button> <button onclick="cambiarEstadoReserva(${res.id}, 'Cancelada')" style="background:#dc2626; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:bold;">❌ Cancelar</button></td>` : "";

        fila.innerHTML = `<td><b>${res.ref}</b></td><td>${res.espacio}</td><td>${res.fecha}</td><td>${res.franja}</td><td>${res.nombre_vecino} (${res.vivienda})</td><td>${res.telefono || ''}</td><td>${res.email || ''}</td><td><span class="status-badge ${res.estado.toLowerCase()}">${res.estado}</span></td>${tdAdmin}`;
        tbody.appendChild(fila);
    });
}

async function cambiarEstadoReserva(id, nuevoEstado) {
    await clienteSupabase.from('reservas').update({ estado: nuevoEstado }).eq('id', id);
    await renderizarTablaReservas();
    await renderizarCalendario();
    mostrarToast(`Reserva actualizada a: ${nuevoEstado}`, "success");
}

// ============================================================================
// SISTEMA AVANZADO DE GESTIÓN DEL CENSO VECINAL (CRUD REAL EN ÁREA ADMIN)
// ============================================================================
async function renderizarCensoVecinos() {
    const contenedorAdmin = document.getElementById("seccion-administracion");
    if (!contenedorAdmin) return;

    const { data: listaVecinos, error } = await clienteSupabase.from('vecinos').select('*').order('vivienda', { ascending: true });

    const totalVecinos = listaVecinos ? listaVecinos.length : 0;
    const totalAdmins = listaVecinos ? listaVecinos.filter(v => v.es_admin).length : 0;
    const totalResidentes = totalVecinos - totalAdmins;

    contenedorAdmin.innerHTML = `
        <!-- 📊 Resumen Estadístico de la Comunidad -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
            <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; border-left:4px solid var(--primary);">
                <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Total Vecinos</div>
                <div style="font-size:1.8rem; font-weight:800; color:var(--primary-dark); margin-top:4px;">${totalVecinos}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Registrados en el censo oficial</div>
            </div>
            <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; border-left:4px solid #f59e0b;">
                <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Junta / Administradores</div>
                <div style="font-size:1.8rem; font-weight:800; color:#d97706; margin-top:4px;">${totalAdmins}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Acceso con privilegios de gestión</div>
            </div>
            <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; border-left:4px solid #10b981;">
                <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Vecinos Estándar</div>
                <div style="font-size:1.8rem; font-weight:800; color:#059669; margin-top:4px;">${totalResidentes}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Cuentas residenciales activas</div>
            </div>
        </div>

        <!-- 👥 Formulario de Gestión de Vecinos (Alta / Edición) -->
        <div style="background:#ffffff; padding:20px; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h3 id="censo-form-title" style="font-size:1.05rem; font-weight:700; color:var(--primary-dark); margin:0;">👥 Gestión de Vecinos: Alta de Nuevo Propietario</h3>
                <button type="button" onclick="limpiarFormularioVecino()" style="background:none; border:none; color:var(--text-muted); font-size:0.8rem; cursor:pointer; text-decoration:underline;">Limpiar casillas</button>
            </div>
            <input type="hidden" id="crud-vecino-id" value="">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) 120px; gap:12px; align-items:end;">
                <div class="input-group-modern" style="margin-bottom:0;">
                    <label style="font-size:0.78rem; font-weight:600;">Nombre y Apellidos *</label>
                    <input type="text" id="crud-vecino-nombre" placeholder="Ej: Carlos Martínez" style="padding:9px;">
                </div>
                <div class="input-group-modern" style="margin-bottom:0;">
                    <label style="font-size:0.78rem; font-weight:600;">Vivienda / Parcela *</label>
                    <input type="text" id="crud-vecino-vivienda" placeholder="Ej: Chalet 88" style="padding:9px;">
                </div>
                <div class="input-group-modern" style="margin-bottom:0;">
                    <label style="font-size:0.78rem; font-weight:600;">Correo Electrónico *</label>
                    <input type="email" id="crud-vecino-email" placeholder="Ej: carlos@correo.com" style="padding:9px;">
                </div>
                <button onclick="guardarCambiosVecino()" class="btn-primary" style="padding:11px; font-size:0.88rem; border-radius:var(--radius-sm); justify-content:center;">Guardar</button>
            </div>
        </div>

        <!-- 📋 Censo de Propietarios y Residentes -->
        <div style="background:#ffffff; border-radius:var(--radius-sm); border:1px solid var(--border-color); overflow:hidden;">
            <div style="padding:14px 18px; border-bottom:1px solid var(--border-color); background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:0.98rem; font-weight:700; color:var(--primary-dark); margin:0;">📋 Censo Comunitario de Vecinos</h3>
                <span style="font-size:0.8rem; color:var(--text-muted);">${totalVecinos} registros</span>
            </div>
            <div style="overflow-x:auto;">
                <table class="census-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Vivienda</th>
                            <th>Propietario / Residente</th>
                            <th>Email de Acceso</th>
                            <th>Rango</th>
                            <th>Acciones de Gestión</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-censo-rows"></tbody>
                </table>
            </div>
        </div>

        <!-- ⚙️ Herramientas Administrativas de la Junta -->
        <div style="margin-top:24px; background:#ffffff; padding:18px 20px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
            <h4 style="font-size:0.95rem; font-weight:700; color:var(--primary-dark); margin:0 0 10px 0;">⚙️ Herramientas Administrativas y Acciones Rápidas</h4>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
                <button type="button" onclick="refrescarTodo(); mostrarToast('Sincronización completa con Supabase finalizada.', 'success');" class="btn-secondary" style="font-size:0.82rem; padding:8px 14px;">🔄 Sincronizar Datos Nube</button>
                <button type="button" onclick="cambiarPestana('#alquiler', true);" class="btn-secondary" style="font-size:0.82rem; padding:8px 14px;">📅 Supervisar Reservas</button>
                <button type="button" onclick="cambiarPestana('#noticias', true);" class="btn-secondary" style="font-size:0.82rem; padding:8px 14px;">📢 Ir a Comunicados del Tablón</button>
                <button type="button" onclick="toggleModoAdmin();" class="btn-secondary" style="font-size:0.82rem; padding:8px 14px; color:var(--danger); border-color:var(--danger-subtle);">🚪 Cerrar Sesión Junta</button>
            </div>
        </div>
    `;

    const tbodyCenso = document.getElementById("tbody-censo-rows");
    if (!tbodyCenso || !listaVecinos || listaVecinos.length === 0) {
        if (tbodyCenso) tbodyCenso.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--text-muted);">No hay vecinos registrados en la base de datos central.</td></tr>`;
        return;
    }

    listaVecinos.forEach(vecino => {
        const fila = document.createElement("tr");
        const rangoTexto = vecino.es_admin ? "⭐ Junta" : "Vecino";
        
        fila.innerHTML = `
            <td><b>${vecino.vivienda}</b></td>
            <td>${vecino.nombre}</td>
            <td><code>${vecino.email}</code></td>
            <td><span class="status-badge ${vecino.es_admin ? 'aprobada' : 'pendiente'}">${rangoTexto}</span></td>
            <td>
                <button onclick="cargarDatosVecinoEnFormulario(${vecino.id}, '${vecino.nombre}', '${vecino.vivienda}', '${vecino.email}')" style="background:#2563eb; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-right:6px;">✏️ Editar</button>
                <button onclick="eliminarVecinoDelCenso(${vecino.id}, '${vecino.nombre}')" style="background:#dc2626; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer;">🗑️ Dar de Baja</button>
            </td>
        `;
        tbodyCenso.appendChild(fila);
    });
}

function limpiarFormularioVecino() {
    const idElem = document.getElementById("crud-vecino-id");
    const nomElem = document.getElementById("crud-vecino-nombre");
    const vivElem = document.getElementById("crud-vecino-vivienda");
    const mailElem = document.getElementById("crud-vecino-email");
    const titElem = document.getElementById("censo-form-title");
    if (idElem) idElem.value = "";
    if (nomElem) nomElem.value = "";
    if (vivElem) vivElem.value = "";
    if (mailElem) mailElem.value = "";
    if (titElem) titElem.textContent = "👥 Gestión de Vecinos: Alta de Nuevo Propietario";
}

async function guardarCambiosVecino() {
    const id = document.getElementById("crud-vecino-id").value;
    const nombre = document.getElementById("crud-vecino-nombre").value.trim();
    const vivienda = document.getElementById("crud-vecino-vivienda").value.trim();
    const email = document.getElementById("crud-vecino-email").value.trim();

    if (!nombre || !vivienda || !email) {
        // alert("⚠️ Por favor, rellena todos los campos antes de guardar.");
        return;
    }

    if (id) {
        const { error } = await clienteSupabase.from('vecinos').update({ nombre, vivienda, email }).eq('id', id);
        if (!error) mostrarToast("Vecino actualizado con éxito en la nube.", "success");
    } else {
        const { error } = await clienteSupabase.from('vecinos').insert([{ nombre, vivienda, email, es_admin: false }]);
        if (!error) mostrarToast("Nuevo vecino inyectado en el censo con éxito.", "success");
        else { /* alert("❌ Error: Este correo electrónico ya está duplicado en el censo."); */ return; }
    }

    document.getElementById("crud-vecino-id").value = "";
    document.getElementById("crud-vecino-nombre").value = "";
    document.getElementById("crud-vecino-vivienda").value = "";
    document.getElementById("crud-vecino-email").value = "";
    document.getElementById("censo-form-title").textContent = "➕ Registrar Nuevo Vecino en el Censo";

    await renderizCensoVecinos();
}

function cargarDatosVecinoEnFormulario(id, nombre, vivienda, email) {
    document.getElementById("crud-vecino-id").value = id;
    document.getElementById("crud-vecino-nombre").value = nombre;
    document.getElementById("crud-vecino-vivienda").value = vivienda;
    document.getElementById("crud-vecino-email").value = email;
    document.getElementById("censo-form-title").textContent = `✏️ Modificando Ficha de: ${nombre}`;
    document.getElementById("crud-vecino-nombre").focus();
}

async function eliminarVecinoDelCenso(id, nombre) {
    if (confirm(`¿Estás seguro de que deseas dar de baja definitivamente a ${nombre} del censo de la urbanización? Perderá el acceso al portal.`)) {
        const { error } = await clienteSupabase.from('vecinos').delete().eq('id', id);
        if (!error) {
            mostrarToast("Registro eliminado de la base de datos.", "info");
            await renderizCensoVecinos();
        }
    }
}

function renderizCensoVecinos() { renderizarCensoVecinos(); }
// ============================================================================
// FORO VECINAL EN LA NUBE
// ============================================================================
async function cargarTemasForo() {
    const contenedor = document.getElementById("forum-topics-list");
    if (!contenedor) return;

    let query = clienteSupabase.from('foro_temas').select('*').order('fecha', { ascending: false });
    if (categoriaForoActual !== 'all') query = query.eq('categoria', categoriaForoActual);

    const { data: temas } = await query;
    contenedor.innerHTML = "";

    temas?.forEach(tema => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "forum-topic-card";
        tarjeta.onclick = (e) => { if (!e.target.closest(".btn-like-topic")) abrirDetalleTema(tema.id); };

        let fechaTexto = "";
        if (tema.fecha) {
            try {
                const f = new Date(tema.fecha);
                fechaTexto = !isNaN(f.getTime()) ? f.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : tema.fecha;
            } catch (e) {
                fechaTexto = tema.fecha;
            }
        }

        tarjeta.innerHTML = `
            <div class="topic-main-info">
                <div class="topic-meta-top">
                    <span class="badge-tag cat-${tema.categoria}">${tema.categoria}</span>
                    <span>👤 ${tema.autor} (${tema.vivienda})</span>
                    ${fechaTexto ? `<span style="margin-left:auto; font-size:0.8rem; color:var(--text-muted);">🕒 ${fechaTexto}</span>` : ''}
                </div>
                <h3 class="topic-title-text">${tema.titulo}</h3>
                <p class="topic-snippet">${tema.contenido}</p>
            </div>
            <div class="topic-stats"><button class="btn-like-topic" onclick="darLikeTema(${tema.id})">❤️ ${tema.likes}</button></div>`;
        contenedor.appendChild(tarjeta);
    });
}

function filtrarForoPorCategoria(categoria, btnElement) {
    categoriaForoActual = categoria;
    document.querySelectorAll(".cat-chip").forEach(chip => chip.classList.remove("active"));
    if (btnElement) btnElement.classList.add("active");
    cargarTemasForo();
}

async function guardarNuevoTemaForo(e) {
    e.preventDefault();
    if (!usuarioActivo) { mostrarToast("Debes iniciar sesión para publicar.", "warning"); return; }

    const titulo = document.getElementById("tema-titulo").value.trim();
    const contenido = document.getElementById("tema-contenido").value.trim();
    const categoria = document.getElementById("tema-categoria").value;

    const { error } = await clienteSupabase.from('foro_temas').insert([{
        titulo,
        contenido,
        categoria,
        autor: usuarioActivo.nombre,
        vivienda: usuarioActivo.vivienda,
        likes: 0,
        fecha: new Date().toISOString()
    }]);
    if (!error) {
        cerrarModal("modal-nuevo-tema");
        document.getElementById("form-nuevo-tema").reset();
        await cargarTemasForo();
        mostrarToast("Tema publicado en el foro.", "success");
    }
}

async function darLikeTema(id) {
    const { data } = await clienteSupabase.from('foro_temas').select('likes').eq('id', id).single();
    await clienteSupabase.from('foro_temas').update({ likes: (data?.likes || 0) + 1 }).eq('id', id);
    await cargarTemasForo();
}

function abrirModalNuevoTema() { abrirModal("modal-nuevo-tema"); }

async function abrirDetalleTema(idTema) {
    temaAbierto = idTema;

    const { data: tema, error } = await clienteSupabase
        .from('foro_temas')
        .select('*')
        .eq('id', idTema)
        .single();

    if (error || !tema) {
        mostrarToast("No se pudo cargar el detalle del tema.", "danger");
        return;
    }

    const elemTitulo = document.getElementById("detalle-tema-titulo");
    const elemAutor = document.getElementById("detalle-tema-autor");
    const elemContenido = document.getElementById("detalle-tema-contenido");
    const inputRespuesta = document.getElementById("nueva-respuesta");

    if (elemTitulo) elemTitulo.textContent = tema.titulo;
    if (elemAutor) elemAutor.textContent = `👤 ${tema.autor} (${tema.vivienda})`;
    if (elemContenido) elemContenido.textContent = tema.contenido;
    if (inputRespuesta) inputRespuesta.value = "";

    await cargarRespuestasTema(idTema);
    abrirModal("modal-detalle-tema");
}

async function cargarRespuestasTema(idTema) {
    const contenedor = document.getElementById("contenedor-respuestas");
    if (!contenedor) return;

    contenedor.innerHTML = "<p style='color:var(--text-muted); font-size:0.85rem; padding:8px 0;'>Cargando respuestas...</p>";

    const { data: respuestas, error } = await clienteSupabase
        .from('foro_respuestas')
        .select('*')
        .eq('tema_id', idTema)
        .order('fecha', { ascending: true });

    if (error) {
        contenedor.innerHTML = "<p style='color:var(--danger); font-size:0.85rem; padding:8px 0;'>Error al cargar las respuestas.</p>";
        return;
    }

    contenedor.innerHTML = "";
    if (!respuestas || respuestas.length === 0) {
        contenedor.innerHTML = "<p style='color:var(--text-muted); font-size:0.9rem; font-style:italic; padding:8px 0;'>No hay respuestas aún. ¡Sé el primero en responder!</p>";
        return;
    }

    respuestas.forEach(r => {
        const item = document.createElement("div");
        item.className = "reply-item";

        let fechaTexto = "";
        if (r.fecha) {
            try {
                const f = new Date(r.fecha);
                fechaTexto = !isNaN(f.getTime()) ? f.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : r.fecha;
            } catch (e) {
                fechaTexto = r.fecha;
            }
        }

        const meta = document.createElement("div");
        meta.className = "reply-meta";

        const autorSpan = document.createElement("span");
        autorSpan.textContent = `👤 ${r.autor} (${r.vivienda})`;

        const fechaSpan = document.createElement("span");
        fechaSpan.textContent = fechaTexto;

        meta.appendChild(autorSpan);
        meta.appendChild(fechaSpan);

        const textoDiv = document.createElement("div");
        textoDiv.className = "reply-text";
        textoDiv.textContent = r.texto;

        item.appendChild(meta);
        item.appendChild(textoDiv);
        contenedor.appendChild(item);
    });
}

async function publicarRespuestaTema() {
    if (!usuarioActivo) {
        mostrarToast("Debes iniciar sesión para publicar una respuesta.", "warning");
        return;
    }

    if (!temaAbierto) {
        mostrarToast("No hay ningún tema seleccionado.", "warning");
        return;
    }

    const inputRespuesta = document.getElementById("nueva-respuesta");
    const texto = inputRespuesta?.value.trim();

    if (!texto) {
        mostrarToast("El texto de la respuesta no puede estar vacío.", "warning");
        return;
    }

    const { error } = await clienteSupabase
        .from('foro_respuestas')
        .insert([{
            tema_id: temaAbierto,
            autor: usuarioActivo.nombre,
            vivienda: usuarioActivo.vivienda,
            texto: texto,
            fecha: new Date().toISOString()
        }]);

    if (!error) {
        if (inputRespuesta) inputRespuesta.value = "";
        await cargarRespuestasTema(temaAbierto);
        mostrarToast("Respuesta publicada en el debate.", "success");
    } else {
        mostrarToast("Error al publicar la respuesta.", "danger");
    }
}

// ============================================================================
// TABLÓN DE ANUNCIOS E INCIDENCIAS (GESTIÓN DE COMUNICADOS PARA LA JUNTA)
// ============================================================================
let listaAnunciosCache = [];

async function cargarAnunciosTablon() {
    const contenedor = document.getElementById("contenedor-anuncios");
    const countText = document.getElementById("board-count-text");
    if (!contenedor) return;

    const { data: anuncios } = await clienteSupabase.from('incidencias').select('*').order('fecha', { ascending: false });
    listaAnunciosCache = anuncios || [];
    if (countText) countText.textContent = `${listaAnunciosCache.length} Comunicados oficiales vigentes`;
    contenedor.innerHTML = "";

    if (listaAnunciosCache.length === 0) {
        contenedor.innerHTML = "<p style='color:var(--text-muted); padding:20px; text-align:center;'>No hay comunicados ni incidencias publicados en este momento.</p>";
        return;
    }

    listaAnunciosCache.forEach(anuncio => {
        const bloque = document.createElement("div");
        const categoriaClase = (anuncio.motivo || 'general').toLowerCase();
        bloque.className = `official-notice-item ${categoriaClase === 'urgente' ? 'urgent' : ''}`;

        let fechaTexto = "";
        if (anuncio.fecha) {
            try {
                const f = new Date(anuncio.fecha);
                fechaTexto = !isNaN(f.getTime()) ? f.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : anuncio.fecha;
            } catch (e) {
                fechaTexto = anuncio.fecha;
            }
        }

        const tituloVisible = (anuncio.vivienda && (anuncio.vivienda.toLowerCase().startsWith('chalet') || anuncio.vivienda.toLowerCase().startsWith('portal')))
            ? `Aviso / Incidencia de ${anuncio.vivienda}`
            : (anuncio.vivienda || 'Comunicado Oficial de la Junta');

        const badgeClass = ['convocatoria', 'mantenimiento', 'urgente', 'general'].includes(categoriaClase) ? categoriaClase : 'general';

        bloque.innerHTML = `
            <div class="notice-header">
                <span class="notice-badge ${badgeClass}">${anuncio.motivo || 'General'}</span>
                ${fechaTexto ? `<span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">🕒 ${fechaTexto}</span>` : ''}
            </div>
            <h3 class="notice-title">${tituloVisible}</h3>
            <p class="notice-body-text">${anuncio.mensaje || ''}</p>
            ${modoAdminActivo ? `
                <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" onclick="cargarComunicadoParaEditar(${anuncio.id})" style="background:#2563eb; color:white; border:none; padding:5px 12px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer;">✏️ Editar</button>
                    <button type="button" onclick="eliminarComunicadoTablon(${anuncio.id})" style="background:#dc2626; color:white; border:none; padding:5px 12px; border-radius:4px; font-size:0.75rem; font-weight:700; cursor:pointer;">🗑️ Eliminar</button>
                </div>
            ` : ''}
        `;
        contenedor.appendChild(bloque);
    });
}

function cargarComunicadoParaEditar(id) {
    const anuncio = listaAnunciosCache.find(a => a.id === id);
    if (!anuncio) return;
    document.getElementById("comunicado-id").value = anuncio.id;
    document.getElementById("comunicado-titulo").value = anuncio.vivienda || "";
    document.getElementById("comunicado-categoria").value = anuncio.motivo || "General";
    document.getElementById("comunicado-contenido").value = anuncio.mensaje || "";
    document.getElementById("comunicado-form-title").textContent = "✏️ Editar Comunicado Oficial";
    document.getElementById("btn-guardar-comunicado").textContent = "Guardar Cambios";
    document.getElementById("btn-cancelar-comunicado").style.display = "inline-block";
    document.getElementById("panel-admin-tablon")?.scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicionComunicado() {
    document.getElementById("form-gestion-comunicado")?.reset();
    document.getElementById("comunicado-id").value = "";
    document.getElementById("comunicado-form-title").textContent = "📢 Gestión del Tablón: Publicar Nuevo Comunicado";
    document.getElementById("btn-guardar-comunicado").textContent = "Publicar Comunicado";
    document.getElementById("btn-cancelar-comunicado").style.display = "none";
}

async function guardarComunicadoTablon(e) {
    e.preventDefault();
    if (!modoAdminActivo) {
        mostrarToast("Solo los administradores pueden gestionar comunicados.", "warning");
        return;
    }

    const id = document.getElementById("comunicado-id").value;
    const titulo = document.getElementById("comunicado-titulo").value.trim();
    const motivo = document.getElementById("comunicado-categoria").value;
    const mensaje = document.getElementById("comunicado-contenido").value.trim();

    if (!titulo || !mensaje) {
        mostrarToast("Por favor, completa el título y el contenido.", "warning");
        return;
    }

    if (id) {
        const { error } = await clienteSupabase
            .from('incidencias')
            .update({ motivo, mensaje, vivienda: titulo })
            .eq('id', id);

        if (!error) {
            cancelarEdicionComunicado();
            await cargarAnunciosTablon();
            mostrarToast("Comunicado actualizado con éxito.", "success");
        } else {
            mostrarToast("Error al actualizar el comunicado.", "danger");
        }
    } else {
        const ticketId = "COM-" + Math.floor(1000 + Math.random() * 9000);
        const { error } = await clienteSupabase
            .from('incidencias')
            .insert([{
                ticket: ticketId,
                motivo,
                mensaje,
                vivienda: titulo,
                fecha: new Date().toISOString()
            }]);

        if (!error) {
            cancelarEdicionComunicado();
            await cargarAnunciosTablon();
            mostrarToast("Comunicado publicado en el tablón.", "success");
        } else {
            mostrarToast("Error al publicar el comunicado.", "danger");
        }
    }
}

async function eliminarComunicadoTablon(id) {
    if (!modoAdminActivo) {
        mostrarToast("Acción restringida a administradores.", "warning");
        return;
    }
    if (confirm("¿Estás seguro de que deseas eliminar definitivamente este comunicado del tablón?")) {
        const { error } = await clienteSupabase.from('incidencias').delete().eq('id', id);
        if (!error) {
            await cargarAnunciosTablon();
            mostrarToast("Comunicado eliminado del tablón.", "info");
        } else {
            mostrarToast("Error al eliminar el comunicado.", "danger");
        }
    }
}

async function enviarFormularioIncidencia(e) {
    e.preventDefault();
    const motivo = document.getElementById("motivo-consulta").value;
    const mensaje = document.getElementById("mensaje-contacto").value.trim();
    const vivienda = document.getElementById("vivienda-contacto").value.trim();
    const ticketId = "INC-" + Math.floor(1000 + Math.random() * 9000);

    const { error } = await clienteSupabase.from('incidencias').insert([{
        ticket: ticketId,
        motivo,
        mensaje,
        vivienda,
        fecha: new Date().toISOString()
    }]);
    if (!error) {
        document.getElementById("community-contact-form").reset();
        await cargarAnunciosTablon();
        mostrarToast("Incidencia enviada correctamente a la Junta.", "success");
    }
}

function toggleModoAdmin() {
    if (modoAdminActivo) {
        modoAdminActivo = false;
        actualizarVisibilidadAdmin();
        mostrarToast("Cerrada sesión admin.", "info");
    } else {
        abrirModal("modal-admin-pin");
    }
}

function verificarPinAdmin() {
    const pin = document.getElementById("input-admin-pin")?.value.trim();
    if (pin === "1234") {
        modoAdminActivo = true;
        cerrarModal("modal-admin-pin");
        actualizarVisibilidadAdmin();
        mostrarToast("Modo administrador activado.", "success");
    } else {
        mostrarToast("PIN incorrecto.", "danger");
    }
}

async function actualizarVisibilidadAdmin() {
    const navItemAdmin = document.getElementById("nav-item-admin");
    const indicador = document.getElementById("admin-status-indicator");
    const textoBtn = document.getElementById("btn-admin-text");
    const panelAdminTablon = document.getElementById("panel-admin-tablon");

    if (navItemAdmin) navItemAdmin.style.display = modoAdminActivo ? "block" : "none";
    if (indicador) indicador.style.display = modoAdminActivo ? "inline-block" : "none";
    if (textoBtn) textoBtn.textContent = modoAdminActivo ? "Cerrar Sesión Admin" : "Acceso Junta / Admin";
    if (panelAdminTablon) panelAdminTablon.style.display = modoAdminActivo ? "block" : "none";
    
    renderizarTablaReservas();
    await cargarAnunciosTablon();

    if (modoAdminActivo) {
        await renderizarCensoVecinos();
    } else {
        const contenedorAdmin = document.getElementById("seccion-administracion");
        if (contenedorAdmin) contenedorAdmin.innerHTML = "";

        // Si el usuario estaba en la pestaña de administración al cerrar sesión, redirigir a inicio
        const tabActiva = document.querySelector(".tab-section.tab-activa");
        if (tabActiva && tabActiva.id === "administracion") {
            cambiarPestana("#inicio", true);
        }
    }
}

// ============================================================================
// LÓGICA DE NAVEGACIÓN Y SOPORTE DE INTERFAZ (TABS & MODALES)
// ============================================================================
function cambiarPestana(idTab, actualizarHistorial = true) {
    const tabLimpio = idTab.replace('#', '').trim();
    if (!PESTANAS_VALIDAS.includes(tabLimpio)) return;

    if (tabLimpio === 'administracion' && !modoAdminActivo) {
        mostrarToast("Acceso restringido a miembros de la Junta.", "warning");
        return;
    }

    PESTANAS_VALIDAS.forEach(id => document.getElementById(id)?.classList.remove("tab-activa"));
    document.getElementById(tabLimpio)?.classList.add("tab-activa");

    document.querySelectorAll("#nav-menu a").forEach(link => {
        if (link.getAttribute("href") === `#${tabLimpio}`) link.classList.add("active");
        else link.classList.remove("active");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
    if (actualizarHistorial) history.pushState(null, "", `#${tabLimpio}`);
}

function inicializarNavegacionPestanas() {
    document.addEventListener("click", (e) => {
        const target = e.target.closest("a[href^='#']");
        if (target) { e.preventDefault(); cambiarPestana(target.getAttribute("href"), true); }
    });
}

function abrirModal(id) { document.getElementById(id)?.classList.add("active"); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove("active"); }
function mostrarToast(msg, tipo) {
    // alert(`${tipo.toUpperCase()}: ${msg}`);
    const contenedor = document.getElementById("toast-container");
    if (contenedor) {
        const toast = document.createElement("div");
        toast.className = "toast-msg";
        toast.textContent = msg;
        contenedor.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
}
function configurarMenuMovil() { }
function configurarBuscadorForo() { }
function configurarTeclasAccesibilidad() { }
