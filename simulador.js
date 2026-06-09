const axios = require("axios");
const fs = require("fs");

const archivo = "./data/vehiculos.json";

// =========================
// LEER VEHICULOS
// =========================

function leerVehiculos() {

    const data = fs.readFileSync(archivo);

    return JSON.parse(data);

}

// =========================
// GUARDAR VEHICULOS
// =========================

function guardarVehiculos(data) {

    fs.writeFileSync(
        archivo,
        JSON.stringify(data, null, 2)
    );

}

// =========================
// MOVIMIENTO GPS
// =========================
const rutaRiobamba = [

[-1.67010, -78.65420],
[-1.67000, -78.65410],
[-1.66990, -78.65400],
[-1.66980, -78.65390],
[-1.66970, -78.65380],
[-1.66960, -78.65370],
[-1.66950, -78.65360],
[-1.66940, -78.65350],
[-1.66930, -78.65340],
[-1.66920, -78.65330],
[-1.66910, -78.65320],
[-1.66900, -78.65310],
[-1.66890, -78.65300],
[-1.66880, -78.65290],
[-1.66870, -78.65280],
[-1.66860, -78.65270],
[-1.66850, -78.65260],
[-1.66840, -78.65250],
[-1.66830, -78.65240],
[-1.66820, -78.65230]

];
let pasoRuta = 0;
setInterval(async () => {

    let vehiculos = leerVehiculos();

    vehiculos.forEach(async (v) => {

        // SOLO SI EL MOTOR ESTA ENCENDIDO

        if (v.motor === "encendido") {

            const punto = rutaRiobamba[pasoRuta];

v.latitud = punto[0];
v.longitud = punto[1];

pasoRuta++;

if (pasoRuta >= rutaRiobamba.length) {

    pasoRuta = 0;

}

            // VELOCIDAD
            v.velocidad = Math.floor(
                40 + Math.random() * 90
            );

            // SUMAR KM
            v.km += v.velocidad / 5000;

            // ESTADO
            v.estado = "activo";

        } else {

            // SI ESTA APAGADO
            v.velocidad = 0;

            v.estado = "apagado";

        }

        // ENVIAR AL SERVER

        try {

            await axios.put(
                "http://localhost:3000/actualizar-gps",
                {

                    usuario: v.usuario,
                    gps: v.gps,
                    latitud: v.latitud,
                    longitud: v.longitud,
                    velocidad: v.velocidad,
                    estado: v.estado,
                    km: v.km,
                    tipo: v.tipo,
                    placa: v.placa

                }
            );

        } catch (error) {

            console.log(
                "Error enviando GPS:",
                error.message
            );

        }

    });

    guardarVehiculos(vehiculos);

    console.log("GPS actualizado");

}, 8000);