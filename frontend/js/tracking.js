const formatearEstado = (estado) => {
    const mapa = {
        pendiente:   "Pendiente",
        aprobado:    "Aprobado",
        en_transito: "En tránsito",
        entregado:   "Entregado",
        rechazado:   "Rechazado"
    }
    return mapa[estado] || estado
}

//INICIO

document.addEventListener("DOMContentLoaded", () => {

    // Guard: requiere login
    if (!getToken()) {
        window.location.href = "index.html"
        return
    }

    // Mostrar nombre del usuario logueado
    document.getElementById("nombre-usuario").textContent = "¡Hola " + getNombre() + "!"

    document.getElementById("btn-logout").addEventListener("click", logout)

    document.getElementById("btn-buscar").addEventListener("click", handleBuscar)

    // Buscar también con Enter
    document.getElementById("input-tracking").addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleBuscar()
    })

    // Limpiar error al escribir
    document.getElementById("input-tracking").addEventListener("input", () => {
        ocultarAlerta("error-busqueda")
    })
})

//BUSCAR

async function handleBuscar() {
    ocultarAlerta("error-busqueda")

    const numero = document.getElementById("input-tracking").value.trim()

    if (!numero) {
        mostrarAlerta("error-busqueda", "Ingresá un número de tracking.")
        return
    }

    const btn = document.getElementById("btn-buscar")
    btn.disabled    = true
    btn.textContent = "Buscando..."

    try {
        const data = await getTracking(numero)
        renderResultado(data)
    } catch (err) {
        // Ocultamos el resultado anterior si había uno
        document.getElementById("seccion-resultado").style.display = "none"
        mostrarAlerta("error-busqueda", "Número de tracking no encontrado.")
    } finally {
        btn.disabled    = false
        btn.textContent = "Buscar"
    }
}

//RENDERIZAR RESULTADO

function renderResultado(data) {
    const seccion = document.getElementById("seccion-resultado")
    seccion.style.display = "block"
    seccion.scrollIntoView({ behavior: "smooth" })

    renderEstadoHeader(data)
    renderInfoGrid(data)
    renderHistorial(data.historial)
}

function renderEstadoHeader(data) {
    const contenedor = document.getElementById("tracking-estado-header")
    contenedor.innerHTML = ""

    // Texto e info
    const textos = document.createElement("div")

    const numero = document.createElement("p")
    numero.className = "tracking-numero"
    numero.textContent = data.trackingNumber   // textContent

    const estadoTexto = document.createElement("p")
    estadoTexto.className = "tracking-estado-texto"
    estadoTexto.textContent = formatearEstado(data.estado)

    textos.appendChild(numero)
    textos.appendChild(estadoTexto)

    // Badge de estado a la derecha
    const badge = document.createElement("span")
    badge.className = `badge badge-${data.estado} tracking-badge`
    badge.textContent = formatearEstado(data.estado)   // textContent

    contenedor.appendChild(textos)
    contenedor.appendChild(badge)
}

function renderInfoGrid(data) {
    const grid = document.getElementById("tracking-info-grid")
    grid.innerHTML = ""

    // Info limitada — sin teléfono ni dirección exacta del destinatario
    const campos = [
        { label: "Origen",       valor: data.origen },
        { label: "Destino",      valor: data.destino },
        { label: "Destinatario", valor: data.destinatario },
        { label: "Fecha de creación", valor: new Date(data.creadoEn).toLocaleDateString("es-AR") },
    ]

    campos.forEach(({ label, valor }) => {
        if (!valor) return

        const item = document.createElement("div")
        item.className = "tracking-info-item"

        const lbl = document.createElement("label")
        lbl.textContent = label   // textContent

        const p = document.createElement("p")
        p.textContent = valor   // textContent — nunca innerHTML con datos del servidor

        item.appendChild(lbl)
        item.appendChild(p)
        grid.appendChild(item)
    })
}

function renderHistorial(historial) {
    const contenedor = document.getElementById("tracking-historial")
    contenedor.innerHTML = ""

    if (!historial || historial.length === 0) return

    const titulo = document.createElement("p")
    titulo.className = "tracking-historial-titulo"
    titulo.textContent = "Historial del envío"
    contenedor.appendChild(titulo)

    const lista = document.createElement("ul")
    lista.className = "tracking-linea-tiempo"

    // Mostrar del más reciente al más antiguo
    const ordenado = [...historial].reverse()

    ordenado.forEach(h => {
        const li = document.createElement("li")
        li.className = "tracking-evento"

        const fecha = document.createElement("p")
        fecha.className = "tracking-evento-fecha"
        fecha.textContent = new Date(h.fecha).toLocaleString("es-AR")   // textContent

        const estado = document.createElement("p")
        estado.className = "tracking-evento-estado"
        estado.textContent = formatearEstado(h.estado)   // textContent

        li.appendChild(fecha)
        li.appendChild(estado)

        // Notas — solo si existen
        if (h.notas) {
            const notas = document.createElement("p")
            notas.className = "tracking-evento-notas"
            notas.textContent = h.notas   // textContent
            li.appendChild(notas)
        }

        lista.appendChild(li)
    })

    contenedor.appendChild(lista)
}

//HELPERS DE ALERTAS

function mostrarAlerta(id, msg, tipo = "error") {
    const el = document.getElementById(id)
    if (!el) return
    el.textContent   = msg
    el.className     = `alert alert-${tipo}`
    el.style.display = "block"
}

function ocultarAlerta(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.style.display = "none"
    el.textContent   = ""
}
