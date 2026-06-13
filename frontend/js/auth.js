//const BASE_URL = "https://localhost:3443"
//const BASE_URL = "http://localhost:3001"

function getToken() {
    return sessionStorage.getItem("token")
}

function getRole() {
    return sessionStorage.getItem("role")
}

function getNombre() {
    return sessionStorage.getItem("nombre")
}

function logout() {
    sessionStorage.clear()
    window.location.href = "index.html"
}

async function login(email, password) {
    let res
    let data

    try {
        console.log("Haciendo fetch a:", `${BASE_URL}/login`)

        res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        })

        console.log("Status:", res.status)

        data = await res.json()

        console.log("Data:", data)

    } catch {
        throw new Error("No se pudo conectar con el servidor.")
    }

    if (!res.ok) {
        throw new Error(data.message || "Credenciales incorrectas.")
    }

    // Decodificamos el JWT
    const payload = JSON.parse(
        atob(data.accessToken.split(".")[1])
    )

    sessionStorage.setItem("token", data.accessToken)
    sessionStorage.setItem("role", payload.role)
    sessionStorage.setItem("nombre", payload.nombre)

    return payload
}