
        // Guard: si ya hay sesión activa, redirigir al panel correspondiente
        (function () {
            const token = getToken()
            const role  = getRole()
            if (token && role === "rol_empleado") window.location.href = "empleado.html"
            if (token && role === "rol_usuario")  window.location.href = "usuario.html"
        })()

        const btnLogin  = document.getElementById("btn-login")
        const inputEmail = document.getElementById("email")
        const inputPass  = document.getElementById("password")
        const errorMsg   = document.getElementById("error-msg")

        function mostrarError(msg) {
            errorMsg.textContent = msg   // textContent — nunca innerHTML con datos externos
            errorMsg.style.display = "block"
        }

        function ocultarError() {
            errorMsg.textContent = ""
            errorMsg.style.display = "none"
        }

        function setLoading(loading) {
            btnLogin.disabled = loading
            btnLogin.textContent = loading ? "Ingresando..." : "Acceder"
        }

        // Validación del lado del cliente antes de enviar al servidor
        function validarCampos(email, password) {
            if (!email || !password) {
                mostrarError("Completá todos los campos.")
                return false
            }
            const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!regexEmail.test(email)) {
                mostrarError("El correo electrónico no tiene un formato válido.")
                return false
            }
            if (password.length < 6) {
                mostrarError("La contraseña debe tener al menos 6 caracteres.")
                return false
            }
            return true
        }

        async function handleLogin() {
            ocultarError()

            const email    = inputEmail.value.trim()
            const password = inputPass.value

            console.log("Email:", email)
            console.log("Password:", password)
            console.log("Validación:", validarCampos(email, password))

            if (!validarCampos(email, password)) return

            setLoading(true)

            try {
                console.log("Llamando a login...")
                const payload = await login(email, password)
                console.log("Payload recibido:", payload)

                if (payload.role === "rol_empleado") {
                    window.location.href = "empleado.html"
                } else {
                    window.location.href = "usuario.html"
                }

            } catch (err) {
                // Mensaje genérico — no exponemos detalles internos del servidor
                mostrarError("Credenciales incorrectas. Revisá tu correo y contraseña.")
                setLoading(false)
            }
        }

        // Click en botón
        btnLogin.addEventListener("click", handleLogin)

        // Enter en cualquier campo
        inputEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin() })
        inputPass.addEventListener("keydown",  (e) => { if (e.key === "Enter") handleLogin() })

        // Limpiar error cuando el usuario empieza a corregir
        inputEmail.addEventListener("input", ocultarError)
        inputPass.addEventListener("input", ocultarError)