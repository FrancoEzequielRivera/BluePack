//const BASE_URL = "https://localhost:3443"
//const BASE_URL = "http://localhost:3001"

// Función base que agrega el token a cada request
async function apiFetch(endpoint, options = {}) {
    const token = getToken()

    const headers = {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` })
    }

    let res
    try {
        res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers })
    } catch {
        throw new Error("No se pudo conectar con el servidor.")
    }

    // Si el token expiró o es inválido, cierra la sesión automáticamente
    if (res.status === 401 || res.status === 403) {
        logout()
        return
    }

    if(res.status === 429){
        alert("Demasiadas peticiones, intente luego nuevamente")
    }

    //DEBUG
    /*
    console.log(res)
    console.log(res.headers.get("content-type"))
    const data = await res.json()
    */

    if (!res.ok) {
        // Mensaje del backend
        const msg = data.message || data.error || "Error en la solicitud."
        throw new Error(msg)
    }

    return data
}

async function getPedidos() {
    return apiFetch("/pedidos")
}

async function getPedido(id) {
    return apiFetch(`/pedidos/${id}`)
}

async function getTracking(numero) {
    return apiFetch(`/tracking/${numero}`)
}

async function crearPedido(datos) {
    return apiFetch("/pedidos", {
        method: "POST",
        body: JSON.stringify(datos)
    })
}

async function cambiarEstado(id, datos) {
    return apiFetch(`/pedidos/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify(datos)
    })
}

async function cancelarPedido(id) {
    return apiFetch(`/pedidos/${id}`, { method: "DELETE" })
}
