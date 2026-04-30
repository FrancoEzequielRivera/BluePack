const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const app = express()

const http = require('http')
const https = require('https')
const fs = require('fs')
const morgan = require('morgan')
const path = require('path')
const ratelimit = require('express-rate-limit')


const {body, validationResult} = require('express-validator')
const sanitizeHtml = require('sanitize-html')


const corsOptions = {
    origin: ["localhost:8080"],
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"]
}

app.use(cors(corsOptions))
app.use(express.json())
//app.use(morgan('combined'))


const infoLog = fs.createWriteStream(
    path.join(__dirname, 'logg.log'),{flags:'a'}
)
app.use(morgan('combined',{stream: infoLog}))


const limiter = ratelimit({
    windowMs: 15*60*1000, //15 minutos
    max:10, //maximo de peticiones por IP
    message: "Demasiadas peticiones, intente mas tarde!!"
})

app.use('/limitado', limiter)


//BASE DE DATOS
let productos = [
    {id:1, descripcion:"fideos"},
    {id:2, descripcion:"arroz"}
]

//Simulacion de base de datos de usuarios
    const users = [
        {id:1, username:"admin", password:"1234", role:"rol_admin"},
        {id:2, username:"jefe", password:"1234", role:"rol_jefe"},
        {id:3, username:"empleado", password:"1234", role:"rol_empleado"}
    ]


//Post de logueo(generamos un token)
app.post("/login", (req,res)=>{
    const {username, password} = req.body;

    const user = users.find(u => u.username==username && u.password==password )

    if (user){
        //generar un token
        const token = jwt.sign({id:user.id, username:user.username, role:user.role},"123456",{expiresIn:"1h"});
        res.json({accessToken:token})
    }else{
        res.status(401).json({message:"Credenciales Incorrectas"})
    }
})

//Middleware(funcion) para verificar token
const verifyToken =(req,res,next) => {
    const token= req.headers["authorization"]

    if(!token) return res.status(403).json({message:"Token Requerido"})

    jwt.verify(token.split(" ")[1], "123456",(err,decoded) =>{
        if (err) return res.status(401).json({message:"Token Invalido"})
        req.user = decoded //guardamos la informacion del usuario en el request
        next()    
    })
}

//Middleware para verificar que el usuario tiene el rol permitido
const authorizationRole = (roles)=>{
    return (req, res, next)=>{
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({error:"Aceeso no autorizado"})
        }    
        next()
    }
}

//Middleware para redirigir HTTP a HTTPS
app.use((req, res, next)=>{
    if (!req.secure && req.headers.host == 'localhost:3001'){
        return res.redirect("https://localhost:3443"+ req.url)
    }
    next()
})


app.get("/empleados", (req, res)=>{
    res.json("Hola Ingrese por HTTPS")
})



app.get("/productos",verifyToken, authorizationRole(["rol_admin"]), (req,res)=>{
    res.json(productos)
})

app.post("/productos", (req, res)=>{
    const nuevo = {
        id: productos.length+1,
        descripcion: req.body.descripcion
    }

    productos.push(nuevo)

    res.json(nuevo)
})

// POST SANITIZADO
app.post('/sanitizado', body('comment').isString().trim(), (req, res) =>{
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({errors:errors.array()})

    const commentariolimpio = sanitizeHtml(req.body.comment)

    res.send({message:"comentario seguro y limpio", commentariolimpio})
})

// POST SIN_SANITIZAR
app.post('/sinsanitizar', body('comment'), (req, res) =>{
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({errors:errors.array()})

    const commentario = req.body.comment

    res.send({message:"comentario sin sanitizar", commentario})
})


app.post("/validarcaracteres", (req, res)=>{
    const message = req.body.message

    if(!/^[a-zA-A0-9\s]+$/.test(message)){
        return res.status(400).send("mensaje con caracteres invalidos")
    }
    res.send({message: "Mensaje Valido "+ message})
})

app.get("/limitado", (req,res)=>{
    res.json({message:"Soy un endpoint limitado"})
})

//app.listen(3001, ()=>{
//    console.log("Servidor almacen_backend_jwt_rbac en 3001")
//})

const options = {
    key:fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
}

//Creamos servidor HTTP en 3001
http.createServer(app).listen(3001,()=>{
    console.log("HTTP en 3001")
})

//Creamos servidor HTTPS en 3433
https.createServer(options, app).listen(3443,()=>{
    console.log("HTTPS en 3443")
})
