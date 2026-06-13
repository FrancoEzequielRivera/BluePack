document.addEventListener("DOMContentLoaded", () => {

    // Guard: si no hay sesión o el rol no corresponde, vuelve al login
    if (!getToken() || getRole() !== "rol_usuario") {
        window.location.href = "index.html"
        return
    }

    // Nombre del usuario
    document.getElementById("nombre-usuario").textContent = "¡Hola " + getNombre() + "!"

    cargarPedidos()

    // Botón logout
    document.getElementById("btn-logout").addEventListener("click", logout)

    // Botón nuevo pedido en el header, hace scroll a la sección
    document.getElementById("btn-nuevo-pedido-header").addEventListener("click", () => {
        document.getElementById("seccion-nuevo-pedido")
            .scrollIntoView({ behavior: "smooth" })
    })

    // Formulario de nuevo pedido
    document.getElementById("form-nuevo-pedido").addEventListener("submit", handleCrearPedido)

    // Cerrar modal al hacer click fuera
    document.getElementById("modal-overlay").addEventListener("click", (e) => {
        if (e.target === document.getElementById("modal-overlay")) cerrarModal()
    })

    document.getElementById("modal-cerrar").addEventListener("click", cerrarModal)
})

//Cargar y renderizar pedidos

async function cargarPedidos() {
    try {
        const pedidos = await getPedidos()
        renderTabla(pedidos)
    } catch (err) {
        mostrarAlerta("error-tabla", err.message)
    }
}

function renderTabla(pedidos) {
    const tbody = document.getElementById("tabla-body")
    tbody.innerHTML = ""

    if (!pedidos || pedidos.length === 0) {
        const tr = document.createElement("tr")
        const td = document.createElement("td")
        td.colSpan = 5
        td.className = "empty-state"
        td.textContent = "Todavía no tenés pedidos."
        tr.appendChild(td)
        tbody.appendChild(tr)
        return
    }

    pedidos.forEach(p => {
        const tr = document.createElement("tr")

        agregarCelda(tr, p.id)
        agregarCelda(tr, p.destino)

        // Badge de estado
        const tdEstado = document.createElement("td")
        const badge = document.createElement("span")
        badge.className = `badge badge-${p.estado}`
        badge.textContent = formatearEstado(p.estado)
        tdEstado.appendChild(badge)
        tr.appendChild(tdEstado)

        agregarCelda(tr, new Date(p.creadoEn).toLocaleDateString("es-AR"))

        // Acciones
        const tdAcciones = document.createElement("td")
        tdAcciones.className = "acciones-celda"

        // Cancelar — solo si está pendiente
        if (p.estado === "pendiente") {
            const btnCancelar = document.createElement("button")
            btnCancelar.className = "btn-cancelar"
            btnCancelar.textContent = "Cancelar"
            btnCancelar.addEventListener("click", () => handleCancelar(p.id))
            tdAcciones.appendChild(btnCancelar)
        }

        // Ver datos / tracking
        const btnDatos = document.createElement("button")
        btnDatos.className = "btn-datos"
        btnDatos.textContent = "Datos"
        btnDatos.addEventListener("click", () => abrirModal(p.id))
        tdAcciones.appendChild(btnDatos)

        tr.appendChild(tdAcciones)
        tbody.appendChild(tr)
    })
}

function agregarCelda(tr, texto) {
    const td = document.createElement("td")
    td.textContent = texto ?? "—"
    tr.appendChild(td)
}

function formatearEstado(estado) {
    const mapa = {
        pendiente:   "Pendiente",
        aprobado:    "Aprobado",
        en_transito: "En tránsito",
        entregado:   "Entregado",
        rechazado:   "Rechazado"
    }
    return mapa[estado] || estado
}

//Modal de detalle / tracking

async function abrirModal(pedidoId) {
    const overlay = document.getElementById("modal-overlay")
    const cuerpo  = document.getElementById("modal-cuerpo")

    // Mostramos el modal con un estado de carga
    overlay.style.display = "flex"
    cuerpo.innerHTML = ""

    const cargando = document.createElement("p")
    cargando.textContent = "Cargando..."
    cargando.className = "modal-cargando"
    cuerpo.appendChild(cargando)

    try {
        const { pedido, historial } = await getPedido(pedidoId)
        renderModal(pedido, historial)
    } catch (err) {
        cuerpo.innerHTML = ""
        const p = document.createElement("p")
        p.className = "alert alert-error"
        p.style.display = "block"
        p.textContent = "No se pudo cargar el detalle del pedido."
        cuerpo.appendChild(p)
    }
}

function renderModal(pedido, historial) {
    const cuerpo = document.getElementById("modal-cuerpo")
    cuerpo.innerHTML = ""

    // ─ Grid de datos del pedido
    const campos = [
        { label: "Origen",       valor: pedido.origen },
        { label: "Destino",      valor: pedido.destino },
        { label: "Destinatario", valor: pedido.destinatario },
        { label: "Teléfono",     valor: pedido.telefono },
        { label: "Descripción",  valor: pedido.descripcion },
        { label: "Peso",         valor: pedido.pesoKg ? `${pedido.pesoKg} kg` : null },
        { label: "Estado",       valor: formatearEstado(pedido.estado) },
        { label: "Aprobado por", valor: pedido.aprobadoPor ? `Empleado #${pedido.aprobadoPor}` : null },
    ]

    // Motivo de rechazo — solo si está rechazado
    if (pedido.estado === "rechazado" && pedido.motivoRechazo) {
        campos.push({ label: "Motivo de rechazo", valor: pedido.motivoRechazo })
    }

    const grid = document.createElement("div")
    grid.className = "modal-grid"

    
    if (pedido.trackingNumber) {
        const item = document.createElement("div")
        item.className = "modal-item"

        const trackingLabel = document.createElement("span")
        trackingLabel.textContent = "N° de tracking: "

        const trackingVal = document.createElement("strong")
        trackingVal.textContent = pedido.trackingNumber   // textContent — dato del backend

        grid.appendChild(item)

        item.appendChild(trackingLabel)
        item.appendChild(trackingVal)

    }


    campos.forEach(({ label, valor }) => {
        if (!valor) return   // no mostramos campos vacíos

        const item = document.createElement("div")
        item.className = "modal-item"

        const lbl = document.createElement("span")
        lbl.className = "modal-item-label"
        lbl.textContent = label

        const val = document.createElement("p")
        val.className = "modal-item-valor"
        val.textContent = valor   // textContent — nunca innerHTML con datos del servidor

        item.appendChild(lbl)
        item.appendChild(val)
        grid.appendChild(item)
    })

    // Motivo de rechazo ocupa ancho completo
    if (pedido.estado === "rechazado" && pedido.motivoRechazo) {
        grid.lastChild.classList.add("full-width")
    }

    cuerpo.appendChild(grid)

    // ─ Historial de tracking
    if (historial && historial.length > 0) {
        const cajaTracking = document.createElement("div")
        cajaTracking.className = "cajaTracking"
        cuerpo.appendChild(cajaTracking)
        const histTitulo = document.createElement("h4")
        histTitulo.className = "modal-seccion-titulo"
        histTitulo.textContent = "Historial de tracking"
        cajaTracking.appendChild(histTitulo)

        const lista = document.createElement("ul")
        lista.className = "historial-lista"

        historial.forEach(h => {
            const li = document.createElement("li")
            li.className = "historial-item"

            const badge = document.createElement("span")
            //badge.className = `badge badge-${h.estado}`
            badge.textContent = formatearEstado(h.estado)

            const info = document.createElement("div")
            info.className = "historial-info"

            const fecha = document.createElement("span")
            fecha.className = "historial-fecha"
            fecha.textContent = new Date(h.fecha).toLocaleString("es-AR")

            info.appendChild(fecha)

            // Notas — solo si existen
            if (h.notas) {
                const notas = document.createElement("p")
                notas.className = "historial-notas"
                notas.textContent = h.notas   // textContent
                info.appendChild(notas)
            }

            li.appendChild(badge)
            li.appendChild(info)
            lista.appendChild(li)
        })

        cajaTracking.appendChild(lista)
    }
}

function cerrarModal() {
    document.getElementById("modal-overlay").style.display = "none"
}

// ─── Cancelar pedido ────────────────────────────────────────────────────────

async function handleCancelar(pedidoId) {
    if (!confirm("¿Cancelar este pedido?")) return

    try {
        await cancelarPedido(pedidoId)
        mostrarAlerta("alerta-global", "Pedido cancelado correctamente.", "success")
        cargarPedidos()
    } catch (err) {
        mostrarAlerta("alerta-global", err.message, "error")
    }
}

//Crear nuevo pedido

async function handleCrearPedido(e) {
    e.preventDefault()
    ocultarAlerta("error-form")

    const origen       = document.getElementById("origen").value.trim()
    const destino      = document.getElementById("destino").value.trim()
    const destinatario = document.getElementById("destinatario").value.trim()
    const telefono     = document.getElementById("telefono").value.trim()
    const descripcion  = document.getElementById("descripcion").value.trim()
    const pesoKg       = parseFloat(document.getElementById("pesoKg").value)

    // Validación frontend
    if (!origen || !destino || !destinatario || !telefono || !descripcion) {
        mostrarAlerta("error-form", "Completá todos los campos.")
        return
    }
    if (isNaN(pesoKg) || pesoKg <= 0) {
        mostrarAlerta("error-form", "El peso debe ser un número mayor a 0.")
        return
    }

    const btnCrear = document.getElementById("btn-crear-pedido")
    btnCrear.disabled = true
    btnCrear.textContent = "Creando..."

    try {
        await crearPedido({ origen, destino, destinatario, telefono, descripcion, pesoKg })
        cargarPedidos()
        document.getElementById("seccion-pedidos")
            .scrollIntoView({ behavior: "smooth" })
    } catch (err) {
        console.log(err.message)
    } finally {
        btnCrear.disabled = false
        btnCrear.textContent = "Crear pedido"
    }
}

//Helpers de alertas

function mostrarAlerta(id, msg, tipo = "error") {
    const el = document.getElementById(id)
    if (!el) return

    el.textContent = msg   // textContent — nunca innerHTML
    el.className = `alert alert-${tipo}`
    el.style.display = "block"
}

function ocultarAlerta(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.style.display = "none"
    el.textContent = ""
}
