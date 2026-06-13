const express = require("express")
const cors    = require("cors")
const jwt     = require("jsonwebtoken")

const http    = require("http")
const https   = require("https")
const fs      = require("fs")
const path    = require("path")
const morgan  = require("morgan")
const ratelimit = require("express-rate-limit")

const { body, validationResult } = require("express-validator")
const sanitizeHtml = require("sanitize-html")

const app = express()

// CORS con opciones especificas (igual que el profe en la version final)
const corsOptions = {
    origin: ["http://localhost:8080", "http://127.0.0.1:5500", "http://localhost:5500", "https://localhost:3443"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}

app.use(cors(corsOptions))
app.use(express.json())

// Morgan para guardar logs de cada petición
const infoLog = fs.createWriteStream(path.join(__dirname, "acceso.log"), { flags: "a" })
app.use(morgan("combined", { stream: infoLog }))

// Rate limit de login cada 15 min
const limiter = ratelimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, 
    message: "Demasiadas peticiones, intente mas tarde"
})

// Rate limit de pedidos
const limiterPedidos = ratelimit({
    windowMs: 10 * 60 * 1000, // 15 minutos
    max: 20, 
    message: "Demasiados pedidos, intente mas tarde"
})

app.use("/login", limiter)

// BASE DE DATOS EN MEMORIA

let usuarios = [
    { id: 1, nombre: "Juan Empleado", email: "empleado@correo.com", password: "Empleado123!", role: "rol_empleado" },
    { id: 2, nombre: "Maria Usuario", email: "usuario@correo.com",  password: "Usuario123!",  role: "rol_usuario"  }
]

let pedidos = [
    {
        id:            1,
        trackingNumber: null,
        usuarioId:     2,
        origen:        "Corrientes 1234, CABA",
        destino:       "San Martin 500, Rosario",
        destinatario:  "Carlos Lopez",
        telefono:      "+54 341 555-1234",
        descripcion:   "Caja con libros",
        pesoKg:        2.5,
        estado:        "pendiente",   // pendiente | aprobado | en_transito | entregado | rechazado
        aprobadoPor:   null,
        motivoRechazo: null,
        creadoEn:      new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
    }
]

let historialTracking = [
    {
        id:             1,
        pedidoId:       1,
        estado:         "pendiente",
        notas:          "Pedido creado",
        actualizadoPor: null,
        fecha:          new Date().toISOString()
    }
]

let nextPedidoId    = 2
let nextHistorialId = 2

// Creo un nombre único para el tracking de un pedido

function generarTracking() {
    const anio   = new Date().getFullYear()
    const random = Math.random().toString(36).substring(2, 10).toUpperCase()
    return `AR-${random}-${anio}`
}

// JWT

app.post("/login", (req, res) => {
    const { email, password } = req.body

    const usuario = usuarios.find(u => u.email === email && u.password === password)

    if (usuario) {
        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, email: usuario.email, role: usuario.role },
            "claveBienSecreta",
            { expiresIn: "1h" }
        )
        res.json({ accessToken: token })
    } else {
        res.status(401).json({ message: "Credenciales incorrectas" })
    }
})

// Middleware para verificar el token
const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"]

    if (!token) return res.status(403).json({ message: "Token requerido" })

    jwt.verify(token.split(" ")[1], "claveBienSecreta", (err, decoded) => {
        if (err) return res.status(401).json({ message: "Token invalido" })
        req.user = decoded
        next()
    })
}

// Middleware para verificar que el usuario tiene el rol permitido

const authorizationRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Acceso no autorizado" })
        }
        next()
    }
}

// RUTAS

// GET /pedidos
app.get("/pedidos", verifyToken, authorizationRole(["rol_empleado", "rol_usuario"]), (req, res) => {
    if (req.user.role === "rol_empleado") {
        res.json(pedidos)
    } else {
        res.json(pedidos.filter(p => p.usuarioId === req.user.id))
    }
})

// GET /pedidos/:id
app.get("/pedidos/:id", verifyToken, authorizationRole(["rol_empleado", "rol_usuario"]), (req, res) => {
    const id     = parseInt(req.params.id)
    const pedido = pedidos.find(p => p.id === id)

    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" })

    if (req.user.role === "rol_usuario" && pedido.usuarioId !== req.user.id) {
        return res.status(403).json({ error: "Acceso no autorizado" })
    }

    const historial = historialTracking.filter(h => h.pedidoId === id)

    res.json({ pedido, historial })
})

// GET /tracking/:numero
app.get("/tracking/:numero", verifyToken, authorizationRole(["rol_empleado", "rol_usuario"]), (req, res) => {
    const pedido = pedidos.find(p => p.trackingNumber === req.params.numero)

    if (!pedido) return res.status(404).json({ message: "Numero de tracking no encontrado" })

    if (req.user.role === "rol_usuario" && pedido.usuarioId !== req.user.id) {
        return res.status(403).json({ error: "Acceso no autorizado" })
    }

    const historial = historialTracking
        .filter(h => h.pedidoId === pedido.id)
        .map(h => ({ estado: h.estado, notas: h.notas, fecha: h.fecha }))

    res.json({
        trackingNumber: pedido.trackingNumber,
        estado:         pedido.estado,
        origen:         pedido.origen,
        destino:        pedido.destino,
        destinatario:   pedido.destinatario,
        creadoEn:       pedido.creadoEn,
        historial
    })
})

// POST /pedidos
app.post("/pedidos",
    verifyToken,
    authorizationRole(["rol_usuario"]), limiterPedidos,
    body("origen").isString().trim().notEmpty().withMessage("El origen es obligatorio"),
    body("destino").isString().trim().notEmpty().withMessage("El destino es obligatorio"),
    body("destinatario").isString().trim().notEmpty().withMessage("El destinatario es obligatorio"),
    body("telefono").isString().trim().notEmpty().withMessage("El telefono es obligatorio"),
    body("descripcion").isString().trim().notEmpty().withMessage("La descripcion es obligatoria"),
    body("pesoKg").isFloat({ min: 0.01 }).withMessage("El peso debe ser un numero mayor a 0"),
    (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        // Limpio los datos
        const origen       = sanitizeHtml(req.body.origen)
        const destino      = sanitizeHtml(req.body.destino)
        const destinatario = sanitizeHtml(req.body.destinatario)
        const telefono     = sanitizeHtml(req.body.telefono)
        const descripcion  = sanitizeHtml(req.body.descripcion)

        const nuevoPedido = {
            id:             nextPedidoId++,
            trackingNumber: null,
            usuarioId:      req.user.id,
            origen,
            destino,
            destinatario,
            telefono,
            descripcion,
            pesoKg:        req.body.pesoKg,
            estado:        "pendiente",
            aprobadoPor:   null,
            motivoRechazo: null,
            creadoEn:      new Date().toISOString(),
            actualizadoEn: new Date().toISOString()
        }

        pedidos.push(nuevoPedido)

        historialTracking.push({
            id:             nextHistorialId++,
            pedidoId:       nuevoPedido.id,
            estado:         "pendiente",
            notas:          "Pedido creado",
            actualizadoPor: req.user.id,
            fecha:          new Date().toISOString()
        })

        res.status(201).json(nuevoPedido)
    }
)

// PATCH /pedidos/:id/estado
app.patch("/pedidos/:id/estado",
    verifyToken,
    authorizationRole(["rol_empleado"]),
    body("estado").isString().notEmpty().withMessage("El estado es obligatorio"),
    body("notas").optional().isString().trim(),
    body("motivoRechazo").optional().isString().trim(),
    (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        const id     = parseInt(req.params.id)
        const pedido = pedidos.find(p => p.id === id)

        if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" })

        const estado        = req.body.estado
        const notas         = req.body.notas         ? sanitizeHtml(req.body.notas)         : null
        const motivoRechazo = req.body.motivoRechazo ? sanitizeHtml(req.body.motivoRechazo) : pedido.motivoRechazo

        const transicionesPermitidas = {
            pendiente:   ["aprobado", "rechazado"],
            aprobado:    ["en_transito", "rechazado"],
            en_transito: ["entregado"],
            entregado:   [],
            rechazado:   []
        }

        if (!transicionesPermitidas[pedido.estado].includes(estado)) {
            return res.status(422).json({
                message: `No se puede pasar de '${pedido.estado}' a '${estado}'`,
                permitidos: transicionesPermitidas[pedido.estado]
            })
        }

        if (estado === "aprobado" && !pedido.trackingNumber) {
            pedido.trackingNumber = generarTracking()
        }

        pedido.estado         = estado
        pedido.aprobadoPor    = req.user.id
        pedido.motivoRechazo  = motivoRechazo
        pedido.actualizadoEn  = new Date().toISOString()

        historialTracking.push({
            id:             nextHistorialId++,
            pedidoId:       id,
            estado,
            notas,
            actualizadoPor: req.user.id,
            fecha:          new Date().toISOString()
        })

        res.json(pedido)
    }
)

// DELETE /pedidos/:id
app.delete("/pedidos/:id", verifyToken, authorizationRole(["rol_usuario"]), (req, res) => {
    const id     = parseInt(req.params.id)
    const indice = pedidos.findIndex(p => p.id === id)

    if (indice === -1) return res.status(404).json({ message: "Pedido no encontrado" })

    if (pedidos[indice].usuarioId !== req.user.id) {
        return res.status(403).json({ error: "Acceso no autorizado" })
    }

    if (pedidos[indice].estado !== "pendiente") {
        return res.status(422).json({ message: "Solo se pueden cancelar pedidos en estado 'pendiente'" })
    }

    pedidos.splice(indice, 1)

    res.json({ message: "Pedido cancelado correctamente" })
})

// HTTPS
/*
const options = {
    key:  fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem")
}*/

/*http.createServer(app).listen(3001, () => {
    console.log("HTTP en 3001")
})*/

/*http.createServer(options, app).listen(3443, () => {
    //console.log("HTTPS en 3443")
    res.writeHead(301, {
        location: "http://127.0.0.1:5500/index.html"
    })
    res.end();
}).listen(3001)*/
/*
http.createServer((req, res) =>{
    res.writeHead(301, {
        location: "http://127.0.0.1:5500/index.html"
    })
    res.end();
}).listen(3001)*/

https.createServer({
    key:fs.readFileSync("server.key"),
    cert:fs.readFileSync("server.crt")
}, app).listen(3443);