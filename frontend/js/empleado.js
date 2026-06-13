// Estado local del panel
let pedidoSeleccionado = null
let estadoElegido      = null

const transiciones = {
    pendiente:   ["aprobado", "rechazado"],
    aprobado:    ["en_transito", "rechazado"],
    en_transito: ["entregado"],
    entregado:   [],
    rechazado:   []
}

const labelEstado = {
    aprobado:    "Aprobado",
    en_transito: "En tránsito",
    entregado:   "Entregado",
    rechazado:   "Rechazado"
}

// INICIO

document.addEventListener("DOMContentLoaded", () => {

    // Guard: solo empleados
    if (!getToken() || getRole() !== "rol_empleado") {
        window.location.href = "index.html"
        return
    }

    document.getElementById("nombre-empleado").textContent = "¡Hola " + getNombre() + "!"

    document.getElementById("btn-logout").addEventListener("click", logout)

    document.getElementById("btn-actualizar").addEventListener("click", handleActualizar)

    cargarPedidos()
})

//CARGAR Y RENDERIZAR TABLA

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
        td.textContent = "No hay pedidos registrados."
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

        // Botón información
        const tdAcciones = document.createElement("td")
        const btnInfo = document.createElement("button")
        btnInfo.className = "btn-info"
        btnInfo.id = `btn-info-${p.id}`
        btnInfo.innerHTML = "Datos"   // solo íconos/texto estático, no datos del usuario
        btnInfo.addEventListener("click", () => seleccionarPedido(p, btnInfo))
        tdAcciones.appendChild(btnInfo)
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

//SELECCIONAR PEDIDO Y MOSTRAR DETALLE

async function seleccionarPedido(pedido, btnClickeado) {

    // Desmarcar botón anterior
    document.querySelectorAll(".btn-info").forEach(b => b.classList.remove("activo"))
    btnClickeado.classList.add("activo")

    pedidoSeleccionado = pedido
    estadoElegido      = null

    // Mostrar sección de detalle
    const seccion = document.getElementById("seccion-detalle")
    seccion.style.display = "block"
    seccion.scrollIntoView({ behavior: "smooth" })

    // Limpiar campos
    document.getElementById("input-nota").value   = ""
    document.getElementById("input-motivo").value = ""
    document.getElementById("grupo-motivo").style.display = "none"
    ocultarAlerta("error-acciones")

    // Cargar detalle completo del pedido (con historial)
    try {
        const { pedido: detalle, historial } = await getPedido(pedido.id)
        pedidoSeleccionado = detalle
        renderDatos(detalle, historial)
        renderBotonesEstado(detalle.estado)
    } catch (err) {
        mostrarAlerta("error-acciones", "No se pudo cargar el detalle del pedido.")
    }
}

function renderDatos(pedido, historial) {
    const contenedor = document.getElementById("detalle-datos")
    contenedor.innerHTML = ""

    const campos = [
        { label: "Origen",        valor: pedido.origen },
        { label: "Destino",       valor: pedido.destino },
        { label: "Destinatario",  valor: pedido.destinatario },
        { label: "Celular",       valor: pedido.telefono },
        { label: "Descripción",   valor: pedido.descripcion },
        { label: "Peso en Kg",    valor: pedido.pesoKg ? `${pedido.pesoKg} kg` : null },
        { label: "Creado en",     valor: new Date(pedido.creadoEn).toLocaleString("es-AR") },
    ]

    if (pedido.trackingNumber) {
        campos.unshift({ label: "N° Tracking", valor: pedido.trackingNumber })
    }

    if (pedido.estado === "rechazado" && pedido.motivoRechazo) {
        campos.push({ label: "Motivo de rechazo", valor: pedido.motivoRechazo })
    }

    campos.forEach(({ label, valor }) => {
        if (!valor) return

        const p = document.createElement("p")
        p.className = "detalle-dato"

        const lbl = document.createElement("span")
        lbl.textContent = `${label}: `   // textContent

        const val = document.createTextNode(valor)   // textContent — datos del backend

        p.appendChild(lbl)
        p.appendChild(val)
        contenedor.appendChild(p)
    })

    // Historial de tracking al final
    if (historial && historial.length > 0) {
        const titulo = document.createElement("p")
        titulo.className = "detalle-dato"
        titulo.style.marginTop = "16px"
        const tituloSpan = document.createElement("span")
        tituloSpan.textContent = "Historial:"
        titulo.appendChild(tituloSpan)
        contenedor.appendChild(titulo)

        historial.forEach(h => {
            const item = document.createElement("p")
            item.className = "detalle-dato"
            item.style.paddingLeft = "12px"
            item.style.borderLeft  = "3px solid #338DD4"
            item.style.marginTop   = "6px"

            const fecha = document.createElement("span")
            fecha.textContent = new Date(h.fecha).toLocaleString("es-AR") + " — "

            const estadoText = document.createTextNode(formatearEstado(h.estado))

            item.appendChild(fecha)
            item.appendChild(estadoText)

            if (h.notas) {
                const notas = document.createTextNode(` (${h.notas})`)
                item.appendChild(notas)
            }

            contenedor.appendChild(item)
        })
    }
}

function renderBotonesEstado(estadoActual) {
    const contenedor = document.getElementById("botones-estado")
    contenedor.innerHTML = ""
    estadoElegido = null

    const permitidos = transiciones[estadoActual] || []

    if (permitidos.length === 0) {
        const p = document.createElement("p")
        p.textContent = "Este pedido no admite más cambios de estado."
        p.style.color = "#6b7280"
        p.style.fontSize = "0.9rem"
        contenedor.appendChild(p)
        document.getElementById("btn-actualizar").style.display = "none"
        document.getElementById("grupo-nota").style.display = "none"
        return
    }

    document.getElementById("btn-actualizar").style.display = "block"
    document.getElementById("grupo-nota").style.display = "flex"

    permitidos.forEach(estado => {
        const btn = document.createElement("button")
        btn.className = `btn-estado btn-estado-${estado}`
        btn.textContent = labelEstado[estado] || estado
        btn.dataset.estado = estado

        btn.addEventListener("click", () => {
            // Marcar como seleccionado
            contenedor.querySelectorAll(".btn-estado")
                .forEach(b => b.classList.remove("seleccionado"))
            btn.classList.add("seleccionado")

            estadoElegido = estado

            // Mostrar campo motivo solo si es rechazo
            const grupoMotivo = document.getElementById("grupo-motivo")
            grupoMotivo.style.display = estado === "rechazado" ? "flex" : "none"

            ocultarAlerta("error-acciones")
        })

        contenedor.appendChild(btn)
    })
}

//ACTUALIZAR ESTADO

async function handleActualizar() {
    ocultarAlerta("error-acciones")

    if (!pedidoSeleccionado) {
        mostrarAlerta("error-acciones", "Seleccioná un pedido primero.")
        return
    }

    if (!estadoElegido) {
        mostrarAlerta("error-acciones", "Seleccioná un estado nuevo.")
        return
    }

    const nota   = document.getElementById("input-nota").value.trim()
    const motivo = document.getElementById("input-motivo").value.trim()

    // Validar motivo obligatorio si rechaza
    if (estadoElegido === "rechazado" && !motivo) {
        mostrarAlerta("error-acciones", "Ingresá un motivo de rechazo.")
        return
    }

    const datos = {
        estado: estadoElegido,
        ...(nota   && { notas: nota }),
        ...(motivo && { motivoRechazo: motivo })
    }

    const btn = document.getElementById("btn-actualizar")
    btn.disabled    = true
    btn.textContent = "Actualizando..."

    try {
        await cambiarEstado(pedidoSeleccionado.id, datos)
        mostrarAlerta("alerta-global", "Estado actualizado correctamente.", "success")

        // Recargar tabla y detalle
        await cargarPedidos()
        const { pedido: actualizado, historial } = await getPedido(pedidoSeleccionado.id)
        pedidoSeleccionado = actualizado
        renderDatos(actualizado, historial)
        renderBotonesEstado(actualizado.estado)

        // Limpiar campos
        document.getElementById("input-nota").value   = ""
        document.getElementById("input-motivo").value = ""
        document.getElementById("grupo-motivo").style.display = "none"
        estadoElegido = null

    } catch (err) {
        mostrarAlerta("error-acciones", err.message)
    } finally {
        btn.disabled    = false
        btn.textContent = "Actualizar pedido"
    }
}

// ─── HELPERS DE ALERTAS ────────────────────────────────────────────────────

function mostrarAlerta(id, msg, tipo = "error") {
    const el = document.getElementById(id)
    if (!el) return
    el.textContent = msg   // textContent — nunca innerHTML
    el.className   = `alert alert-${tipo}`
    el.style.display = "block"
}

function ocultarAlerta(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.style.display = "none"
    el.textContent   = ""
}
