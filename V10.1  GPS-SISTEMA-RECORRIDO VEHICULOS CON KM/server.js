const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const fs = require("fs");
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ======================================
// ARCHIVOS
// ======================================

const archivoVehiculos = path.join(
    __dirname,
    'data',
    'vehiculos.json'
);

const archivoHistorial = path.join(
    __dirname,
    'data',
    'historial.json'
);

// ======================================
// LEER VEHICULOS
// ======================================

function leerVehiculos() {

    try {

        const data = fs.readFileSync(
            archivoVehiculos,
            'utf8'
        );

        return JSON.parse(data);

    } catch (error) {

        return [];

    }

}

// ======================================
// GUARDAR VEHICULOS
// ======================================

function guardarVehiculos(vehiculos) {

    fs.writeFileSync(

        archivoVehiculos,

        JSON.stringify(
            vehiculos,
            null,
            2
        )

    );

}

// ======================================
// LEER HISTORIAL
// ======================================

function leerHistorial() {

    try {

        const data = fs.readFileSync(
            archivoHistorial,
            'utf8'
        );

        return JSON.parse(data);

    } catch (error) {

        return [];

    }

}

// ======================================
// GUARDAR HISTORIAL
// ======================================

function guardarHistorial(historial) {

    fs.writeFileSync(

        archivoHistorial,

        JSON.stringify(
            historial,
            null,
            2
        )

    );

}

// ======================================
// OBTENER VEHICULOS
// ======================================

app.get('/vehiculos', (req, res) => {

    const vehiculos = leerVehiculos();

    res.json(vehiculos);

});

// ======================================
// CAMBIAR MOTOR POR USUARIO
// ======================================

app.put("/vehiculos/:usuario/motor", (req, res) => {

    const usuario = req.params.usuario;

    const nuevoMotor = req.body.motor;

    const vehiculos = leerVehiculos();

    const vehiculo = vehiculos.find(v =>
        v.usuario === usuario
    );

    if (!vehiculo) {

        return res.status(404).json({
            error: "Vehículo no encontrado"
        });

    }

    vehiculo.motor = nuevoMotor;

    if (nuevoMotor === "apagado") {

        vehiculo.estado = "apagado";

        vehiculo.velocidad = 0;

    }

    if (nuevoMotor === "encendido") {

        if (vehiculo.bloqueo === 'bloqueado') {

            return res.status(403).json({
                error: 'Vehículo bloqueado'
            });

        }

        vehiculo.estado = "activo";

    }

    guardarVehiculos(vehiculos);

    io.emit("motor-actualizado", {

        usuario,
        motor: nuevoMotor

    });

    res.json({
        ok: true
    });

});

// ======================================
// BLOQUEAR / DESBLOQUEAR
// ======================================

app.put('/vehiculos/:usuario/bloqueo', (req, res) => {

    const usuario = req.params.usuario;

    const { bloqueo } = req.body;

    let vehiculos = leerVehiculos();

    vehiculos = vehiculos.map(v => {

        if (v.usuario == usuario) {

            v.bloqueo = bloqueo;

            if (bloqueo === 'bloqueado') {

                v.motor = 'apagado';

                v.estado = 'bloqueado';

                v.velocidad = 0;

            }

            if (bloqueo === 'desbloqueado') {

                v.estado = 'apagado';

            }

        }

        return v;

    });

    guardarVehiculos(vehiculos);

    io.emit('bloqueo-actualizado', {

        usuario,
        bloqueo

    });

    res.json({

        ok: true

    });

});

// ======================================
// CREAR VEHICULO
// ======================================

app.post('/vehiculos', (req, res) => {

    const vehiculos = leerVehiculos();

    const nuevo = {

        id: Date.now(),

        usuario: req.body.usuario,
        password: req.body.password,
        gps: req.body.gps,
        placa: req.body.placa,

        tipo: req.body.tipo || 'auto',

        estado: 'activo',
        bloqueo: 'desbloqueado',
        motor: 'encendido',

        velocidad: Math.floor(Math.random() * 120),
        km: Math.floor(Math.random() * 10000),

        latitud: -2.17 + (Math.random() * 2),
        longitud: -79.9 + (Math.random() * 2)

    };

    vehiculos.push(nuevo);

    guardarVehiculos(vehiculos);

    res.json({
        ok: true
    });

});

// ======================================
// ELIMINAR VEHICULO
// ======================================

app.delete('/vehiculos/:id', (req, res) => {

    let vehiculos = leerVehiculos();

    vehiculos = vehiculos.filter(
        v => v.id != req.params.id
    );

    guardarVehiculos(vehiculos);

    res.json({
        ok: true
    });

});

// ======================================
// CAMBIAR MOTOR POR ID
// ======================================

app.put('/vehiculos/:id/motor', (req, res) => {

    const vehiculos = leerVehiculos();

    const vehiculo = vehiculos.find(
        v => v.id == req.params.id
    );

    if (vehiculo) {

        vehiculo.motor = req.body.motor;

        guardarVehiculos(vehiculos);

    }

    res.json({
        ok: true
    });

});

// ======================================
// CAMBIAR ESTADO GPS
// ======================================

app.put('/vehiculos/:id/estado', (req, res) => {

    const vehiculos = leerVehiculos();

    const vehiculo = vehiculos.find(
        v => v.id == req.params.id
    );

    if (vehiculo) {

        vehiculo.estado = req.body.estado;

        guardarVehiculos(vehiculos);

    }

    res.json({
        ok: true
    });

});

// ======================================
// ACTUALIZAR GPS
// ======================================
const rutaAngi = [

    [-1.6635, -78.6546],
    [-1.6640, -78.6530],
    [-1.6650, -78.6515],
    [-1.6665, -78.6500],
    [-1.6680, -78.6485],
    [-1.6695, -78.6470],
    [-1.6710, -78.6455]

];

let pasoRuta = 0;
app.put('/actualizar-gps', (req, res) => {

    const vehiculos = leerVehiculos();

    const historial = leerHistorial();

    vehiculos.forEach((v) => {

        // VEHÍCULO EN MOVIMIENTO
        if (
            v.motor === 'encendido' &&
            v.bloqueo !== 'bloqueado'
        ) {

            const punto = rutaAngi[pasoRuta];

v.latitud = punto[0];
v.longitud = punto[1];

pasoRuta++;

if (pasoRuta >= rutaAngi.length) {
    pasoRuta = 0;
}
            v.velocidad = Math.floor(
    40 + Math.random() * 80
);

v.km += v.velocidad / 3600;

v.estado = 'activo';
        }

        // VEHÍCULO APAGADO
        if (v.motor === 'apagado') {

            v.velocidad = 0;

            v.estado = 'apagado';

        }

        // VEHÍCULO BLOQUEADO
        if (v.bloqueo === 'bloqueado') {

            v.velocidad = 0;

            v.estado = 'bloqueado';

        }

        // GUARDAR HISTORIAL

        console.log("KM ACTUAL:", v.km);

       
            
if(historial.length > 5000){

    historial.shift();
    }
 historial.push({
            usuario: v.usuario,
            placa: v.placa,
            fechaCompleta: new Date().toISOString(),
            fecha: new Date().toLocaleDateString(),
            hora: new Date().toLocaleTimeString(),
            latitud: v.latitud,
            longitud: v.longitud,
            velocidad: v.velocidad,
            km: v.km,
            estado: v.estado

        });

        // ENVIAR AL FRONTEND

        io.emit("recibir-ubicacion", {

            usuario: v.usuario,
            placa: v.placa,
            tipo: v.tipo,
            gps: v.gps,

            km: v.km,

            latitud: v.latitud,
            longitud: v.longitud,

            velocidad: v.velocidad,

            estado: v.estado,

            bloqueo: v.bloqueo,

            motor: v.motor

        });

    });

    guardarVehiculos(vehiculos);

    guardarHistorial(historial);

    res.json({

        ok: true,
        mensaje: 'GPS actualizado'

    });

});

// ======================================
// VER HISTORIAL
// ======================================

app.get('/recorrido/:usuario', (req, res) => {

    const usuario = req.params.usuario;

    const desde = req.query.desde;
    const hasta = req.query.hasta;

    const historial = leerHistorial();

    let registros = historial.filter(
        h => h.usuario === usuario
    );

    // FILTRAR POR FECHAS

    if (desde && hasta) {

        registros = registros.filter(h => {

            const fechaRegistro =
                new Date(h.fechaCompleta);

            const fechaDesde =
                new Date(desde);

            const fechaHasta =
                new Date(hasta);

            return (
                fechaRegistro >= fechaDesde &&
                fechaRegistro <= fechaHasta
            );

        });

    }

    let recorrido = 0;

    for (let i = 1; i < registros.length; i++) {

        const diferencia =
            registros[i].km -
            registros[i - 1].km;

        if (diferencia > 0 && diferencia < 5) {
            recorrido += diferencia;
        }

    }

    res.json({

        usuario: usuario,
        desde: desde,
        hasta: hasta,
        recorrido: recorrido.toFixed(2),
        puntos: registros

    });

});
// ======================================
// LOGIN
// ======================================

app.post('/login', (req, res) => {

    const vehiculos = leerVehiculos();

    const usuario = vehiculos.find(v =>

        v.usuario === req.body.usuario &&
        v.password === req.body.password

    );

    if (usuario) {

        res.json({
            success: true,
            gps: usuario.gps
        });

    } else {

        res.json({
            success: false
        });

    }

});

// ======================================
// INICIAR SERVIDOR
// ======================================

server.listen(PORT, () => {

    console.log(
        'Servidor funcionando en puerto' + PORT
    );

});