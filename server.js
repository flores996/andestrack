const db = require('./mysql');
const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ======================================
// OBTENER VEHICULOS
// ======================================

app.get('/vehiculos', (req, res) => {

    db.query(
        'SELECT * FROM vehiculos',
        (err, results) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    ok: false
                });

            }

            res.json(results);

        }
    );

});

// ======================================
// CAMBIAR MOTOR
// ======================================

app.put('/vehiculos/:usuario/motor', (req, res) => {

    const usuario = req.params.usuario;
    const nuevoMotor = req.body.motor;

    let estado = 'activo';
    let velocidad = null;

    if (nuevoMotor === 'apagado') {

        estado = 'apagado';
        velocidad = 0;

    }

    const sql = `
        UPDATE vehiculos
        SET motor = ?, estado = ?, velocidad = ?
        WHERE usuario = ?
    `;

    db.query(
        sql,
        [nuevoMotor, estado, velocidad, usuario],
        (err) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    ok: false
                });

            }

            io.emit('motor-actualizado', {

                usuario,
                motor: nuevoMotor

            });

            res.json({
                ok: true
            });

        }
    );

});

// ======================================
// BLOQUEAR / DESBLOQUEAR
// ======================================

app.put('/vehiculos/:usuario/bloqueo', (req, res) => {

    const usuario = req.params.usuario;
    const { bloqueo } = req.body;

    let estado = 'apagado';
    let motor = 'apagado';
    let velocidad = 0;

    if (bloqueo === 'desbloqueado') {

        estado = 'apagado';

    } else {

        estado = 'bloqueado';

    }

    const sql = `
        UPDATE vehiculos
        SET bloqueo = ?, estado = ?, motor = ?, velocidad = ?
        WHERE usuario = ?
    `;

    db.query(
        sql,
        [
            bloqueo,
            motor,
            velocidad,
            usuario
        ],
        (err) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    ok: false
                });

            }

            io.emit('bloqueo-actualizado', {

                usuario,
                bloqueo

            });

            res.json({
                ok: true
            });

        }
    );

});

// ======================================
// CREAR VEHICULO
// ======================================

app.post('/vehiculos', (req, res) => {

    if (
        !req.body.usuario ||
        !req.body.password ||
        !req.body.gps ||
        !req.body.placa
    ) {

        return res.json({
            ok: false,
            error: 'Faltan datos'
        });

    }

    db.query(
        'SELECT * FROM vehiculos WHERE usuario = ?',
        [req.body.usuario],
        (err, results) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    ok: false
                });

            }

            if (results.length > 0) {

                return res.json({
                    ok: false,
                    error: 'Usuario ya existe'
                });

            }

            db.query(
                'SELECT COUNT(*) as total FROM vehiculos',
                (err2, totalResult) => {

                    if (err2) {

                        console.log(err2);

                        return res.status(500).json({
                            ok: false
                        });

                    }

                    const esPrimerUsuario =
                        totalResult[0].total === 0;

                    const nuevo = {

                        usuario: req.body.usuario,

                        password: req.body.password,

                        gps: req.body.gps,

                        placa: req.body.placa,

                        admin: esPrimerUsuario,

                        tipo: req.body.tipo || 'auto',

                        estado: 'activo',

                        bloqueo: 'desbloqueado',

                        motor: 'encendido',

                        pasoRuta: 0,

                        velocidad: Math.floor(
                            Math.random() * 120
                        ),

                        km: Math.floor(
                            Math.random() * 10000
                        ),

                        latitud:
                            -1.6635 + (Math.random() * 0.02),

                        longitud:
                            -78.6546 + (Math.random() * 0.02)

                    };

                    const sql = `
                        INSERT INTO vehiculos
                        (
                            usuario,
                            password,
                            gps,
                            placa,
                            admin,
                            tipo,
    
                            bloqueo,
                            motor,
                            pasoRuta,
                            velocidad,
                            km,
                            latitud,
                            longitud
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        sql,
                        [
                            nuevo.usuario,
                            nuevo.password,
                            nuevo.gps,
                            nuevo.placa,
                            nuevo.admin,
                            nuevo.tipo,
                            nuevo.estado,
                            nuevo.bloqueo,
                            nuevo.motor,
                            nuevo.pasoRuta,
                            nuevo.velocidad,
                            nuevo.km,
                            nuevo.latitud,
                            nuevo.longitud
                        ],
                        (err3) => {

                            if (err3) {

                                console.log(err3);

                                return res.status(500).json({
                                    ok: false
                                });

                            }

                            io.emit(
                                'vehiculo-creado',
                                nuevo
                            );

                            res.json({
                                ok: true,
                                vehiculo: nuevo
                            });

                        }
                    );

                }
            );

        }
    );

});

// ======================================
// ELIMINAR VEHICULO
// ======================================

app.delete('/vehiculos/:id', (req, res) => {

    db.query(
        'DELETE FROM vehiculos WHERE id = ?',
        [req.params.id],
        (err) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    ok: false
                });

            }

            res.json({
                ok: true
            });

        }
    );

});

// ======================================
// RUTA GPS
// ======================================

const rutaGPS = [

    [-1.66350, -78.65460],
    [-1.66351, -78.65458],
    [-1.66352, -78.65456],
    [-1.66353, -78.65454],
    [-1.66354, -78.65452],
    [-1.66355, -78.65450],
    [-1.66356, -78.65448],
    [-1.66357, -78.65446],
    [-1.66358, -78.65444],
    [-1.66359, -78.65442]

];

// ======================================
// ACTUALIZAR GPS
// ======================================

app.put('/actualizar-gps', (req, res) => {

    db.query(
        'SELECT * FROM vehiculos',
        (err, vehiculos) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    ok: false
                });

            }

            vehiculos.forEach((v) => {

                if (
                    v.motor === 'encendido' &&
                    v.bloqueo !== 'bloqueado'
                ) {

                    const punto =
                        rutaGPS[v.pasoRuta];

                    let nuevaLatitud =
                        v.latitud +
                        (
                            punto[0] - v.latitud
                        ) * 0.25;

                    let nuevaLongitud =
                        v.longitud +
                        (
                            punto[1] - v.longitud
                        ) * 0.25;

                    let nuevoPaso =
                        v.pasoRuta + 1;

                    if (
                        nuevoPaso >=
                        rutaGPS.length
                    ) {

                        nuevoPaso = 0;

                    }

                    let velocidad =
                        Math.floor(
                            Math.random() * 35
                        );

                    let km =
                        Number(v.km) +
                        velocidad / 3600;

                    let estado =
                        velocidad === 0
                        ? 'detenido'
                        : 'activo';

                    db.query(
                        `
                        UPDATE vehiculos
                        SET
                        latitud = ?,
                        longitud = ?,
                        velocidad = ?,
                        km = ?,
                        estado = ?,
                        pasoRuta = ?
                        WHERE id = ?
                        `,
                        [
                            nuevaLatitud,
                            nuevaLongitud,
                            velocidad,
                            km,
                            estado,
                            nuevoPaso,
                            v.id
                        ]
                    );

                   db.query(
`
INSERT INTO historial
(
usuario,
placa,
fecha,
hora,
latitud,
longitud,
velocidad
)
VALUES (?, ?, ?, ?, ?, ?, ?)
`,
[
    v.usuario,
    v.placa,
    new Date().toLocaleDateString(),
    new Date().toLocaleTimeString(),
    nuevaLatitud,
    nuevaLongitud,
    velocidad
]
);
db.query(
`
INSERT INTO historial
(
usuario,
placa,
fecha,
hora,
latitud,
longitud,
velocidad,
estado,
km
)
VALUES (?,?,?,?,?,?,?,?,?)
`,
[
v.usuario,
v.placa,

new Date().toLocaleDateString(),

new Date().toLocaleTimeString(),

nuevaLatitud,
nuevaLongitud,

velocidad,

estado,

km
],
(err) => {

if(err){

console.log(
"Error guardando historial",
err
);

}

}
);
                  
                    io.emit('recibir-ubicacion', {

                        usuario: v.usuario,

                        admin: v.admin || false,

                        placa: v.placa,

                        tipo: v.tipo,

                        gps: v.gps,

                        km,

                        latitud: nuevaLatitud,

                        longitud: nuevaLongitud,

                        velocidad,

                        estado,

                        bloqueo: v.bloqueo,

                        motor: v.motor

                    });

}

             });


            res.json({

                ok: true,

                mensaje: 'GPS actualizado'

            });

        }
     );

});

// ======================================
// RECORRIDO
// ======================================

app.get('/recorrido/:usuario', (req, res) => {

    const usuario = req.params.usuario;

    db.query(
        `
        SELECT *
        FROM historial
        WHERE usuario = ?
        `,
        [usuario],
        (err, registros) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    ok: false
                });

            }

            res.json({

                usuario,

                puntos: registros

            });

        }
    );

});
app.get('/historial/:usuario', (req, res) => {

    const usuario = req.params.usuario;

    db.query(
        `SELECT * FROM historial
        WHERE usuario = ?
        ORDER BY id DESC
        LIMIT 50`,
        [usuario],
        (err, resultados) => {

            if(err){

                console.log(err);

                return res.json([]);

            }

            res.json(resultados);

        }
    );

});

// ======================================
// LOGIN
// ======================================

app.post('/login', (req, res) => {

    const sql = `
        SELECT *
        FROM vehiculos
        WHERE usuario = ?
        AND password = ?
    `;

    db.query(
        sql,
        [
            req.body.usuario,
            req.body.password
        ],
        (err, results) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    success: false
                });

            }

            if (results.length > 0) {

                const usuario = results[0];

                res.json({

                    success: true,

                    usuario: usuario.usuario,

                    gps: usuario.gps,

                    admin: usuario.admin || false

                });

            } else {

                res.json({
                    success: false
                });

            }

        }
    );

});

// ======================================
// CAMBIAR CLAVE
// ======================================

app.put('/cambiar-clave', (req, res) => {

    const sql = `
        UPDATE vehiculos
        SET password = ?
        WHERE usuario = ?
    `;

    db.query(
        sql,
        [
            req.body.nuevaClave,
            req.body.usuario
        ],
        (err) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }
    );

});

// ======================================
// SOCKET
// ======================================

io.on('connection', (socket) => {

    console.log('Cliente conectado');

});

// ======================================
// ACTUALIZAR GPS AUTOMATICO
// ======================================

setInterval(async () => {

    try {

        await fetch(
            'http://localhost:3000/actualizar-gps',
            {
                method: 'PUT'
            }
        );

        console.log('GPS actualizado');

    } catch (error) {

        console.log(error);

    }

}, 8000);

// ======================================
// INICIAR SERVIDOR
// ======================================

server.listen(PORT, () => {

    console.log(
        'Servidor funcionando en puerto ' + PORT
    );

})