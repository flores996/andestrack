const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./gps.db', (err) => {

    if (err) {
        console.log("Error conectando DB");
    } else {
        console.log("Base de datos conectada");
    }

});


// ================================
// TABLA VEHICULOS
// ================================

db.run(`
CREATE TABLE IF NOT EXISTS vehiculos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario TEXT,
    password TEXT,

    gps TEXT,
    placa TEXT,

    estado TEXT,
    motor TEXT,

    latitud REAL,
    longitud REAL,

    velocidad INTEGER,
    km INTEGER

)
`);


// ================================
// TABLA COMANDOS
// ================================

db.run(`
CREATE TABLE IF NOT EXISTS comandos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario TEXT,
    accion TEXT,

    fecha TEXT,
    hora TEXT

)
`);


// ================================
// TABLA HISTORIAL
// ================================

db.run(`
CREATE TABLE IF NOT EXISTS historial (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario TEXT,
    placa TEXT,

    latitud REAL,
    longitud REAL,

    velocidad INTEGER,
    km INTEGER,

    estado TEXT,
    motor TEXT,

    fecha TEXT,
    hora TEXT

)
`);


module.exports = db;