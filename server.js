const db = require("./mysql");
const http = require("http");
const net = require("net");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fetch = global.fetch;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "andesbyte2026@gmail.com",
    pass: "yelxfrchbfjkxuur"
  }
});

function servicioVencido(fecha) {
  if (!fecha) return false;

  const hoy = new Date();
  const vence = new Date(fecha);

  hoy.setHours(0, 0, 0, 0);
  vence.setHours(0, 0, 0, 0);

  return vence < hoy;
}
async function traccarAuth() {
  const user = process.env.TRACCAR_USER;
  const pass = process.env.TRACCAR_PASS;

  if (!user || !pass) {
    throw new Error("Faltan TRACCAR_USER o TRACCAR_PASS");
  }

  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function obtenerDeviceTraccarPorImei(imei) {
  const auth = await traccarAuth();

  const r = await fetch("http://194.238.25.152:8082/api/devices", {
    headers: { Authorization: auth }
  });

  const devices = await r.json();

  return devices.find(d => String(d.uniqueId) === String(imei));
}
function guardarEvento(usuario, tipo, descripcion) {
  db.query(
    `
    INSERT INTO eventos
    (usuario, tipo, descripcion, fecha, hora)
    VALUES (?, ?, ?, CURDATE(), CURTIME())
    `,
    [usuario, tipo, descripcion],
    (err) => {
      if (err) {
        console.log("Error guardando evento:", err);
      }
    }
  );
}
// ===============================
// OBTENER VEHÍCULOS
// ===============================
app.get("/vehiculos", (req, res) => {
  db.query("SELECT * FROM vehiculos", (err, results) => {
    if (err) {
      console.log("Error obteniendo vehículos:", err);
      return res.status(500).json([]);
    }

    res.json(results);
  });
});
app.get("/traccar/vehiculos", async (req, res) => {
  try {
    const user = process.env.TRACCAR_USER;
    const pass = process.env.TRACCAR_PASS;

    if (!user || !pass) {
      console.log("❌ Faltan TRACCAR_USER o TRACCAR_PASS");
      return res.json([]);
    }

    const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

    const devicesRes = await fetch("http://194.238.25.152:8082/api/devices", {
      headers: { Authorization: auth }
    });

    const positionsRes = await fetch("http://194.238.25.152:8082/api/positions", {
      headers: { Authorization: auth }
    });

    const listaDevices = await devicesRes.json();
    const listaPositions = await positionsRes.json();

    db.query("SELECT * FROM vehiculos", (err, vehiculosDB) => {
      if (err) {
        console.log("Error leyendo DB:", err);
        return res.json([]);
      }

const resultado = listaDevices
.filter(device => {
  const extra = vehiculosDB.find(v => String(v.imei) === String(device.uniqueId));

  if(!extra) return false;

  if(extra.estado_pago === "suspendido") return false;

  if(servicioVencido(extra.fecha_vencimiento)) return false;

  return true;
})
.map(device => {
          const pos = listaPositions.find(p => p.deviceId === device.id);
        const extra = vehiculosDB.find(v => String(v.imei) === String(device.uniqueId));

        return {
          id: extra ? extra.id : null,

          usuario: extra?.usuario || device.name,
          password: extra?.password || "",
          correo: extra?.correo || "",
          placa: extra?.placa || device.name,
          tipo: extra?.tipo || "auto",
          gps: extra?.gps || 1,
          imei: device.uniqueId,
          modelo_gps: extra?.modelo_gps || "No registrado",

          latitud: pos ? pos.latitude : 0,
          longitud: pos ? pos.longitude : 0,
          velocidad: pos ? Math.round(pos.speed * 1.852) : 0,
          estado: device.status === "online" ? "activo" : "apagado",
          km: pos ? ((pos.attributes.totalDistance || 0) / 1000).toFixed(2) : 0,

          motor: extra?.motor || "encendido",
          bloqueo: extra?.bloqueo || "desbloqueado",
          fecha_creacion: extra?.fecha_creacion || new Date().toISOString().split("T")[0],
          fecha_vencimiento: extra?.fecha_vencimiento || "2030-12-28",
          estado_pago: extra?.estado_pago || "activo"
        };
      });

      res.json(resultado);
    });

  } catch (error) {
    console.log("ERROR TRACCAR REAL:", error);
    res.status(500).json([]);
  }
});
app.get("/traccar/vehiculos/gps/:gps", async (req, res) => {
  try {
    const gps = req.params.gps;
    const auth = await traccarAuth();

    const devicesRes = await fetch("http://194.238.25.152:8082/api/devices", {
      headers: { Authorization: auth }
    });

    const positionsRes = await fetch("http://194.238.25.152:8082/api/positions", {
      headers: { Authorization: auth }
    });

    const listaDevices = await devicesRes.json();
    const listaPositions = await positionsRes.json();

    db.query(
      "SELECT * FROM vehiculos WHERE gps = ?",
      [gps],
      (err, vehiculosDB) => {
        if (err) {
          console.log("Error leyendo vehículos por GPS:", err);
          return res.json([]);
        }

        const resultado = vehiculosDB
          .filter(v =>
            v.estado_pago !== "suspendido" &&
            !servicioVencido(v.fecha_vencimiento)
          )
          .map(v => {
            const device = listaDevices.find(d =>
              String(d.uniqueId) === String(v.imei)
            );

            const pos = device
              ? listaPositions.find(p => p.deviceId === device.id)
              : null;

            return {
              id: v.id,
              usuario: v.usuario,
              password: v.password,
              correo: v.correo,
              placa: v.placa,
              tipo: v.tipo || "auto",
              gps: v.gps,
              imei: v.imei,
              modelo_gps: v.modelo_gps || "No registrado",

              latitud: pos ? pos.latitude : v.latitud,
              longitud: pos ? pos.longitude : v.longitud,
              velocidad: pos ? Math.round(pos.speed * 1.852) : Number(v.velocidad || 0),
              estado: device && device.status === "online" ? "activo" : v.estado,
              km: pos ? ((pos.attributes.totalDistance || 0) / 1000).toFixed(2) : Number(v.km || 0),

              motor: v.motor || "encendido",
              bloqueo: v.bloqueo || "desbloqueado",
              fecha_creacion: v.fecha_creacion,
              fecha_vencimiento: v.fecha_vencimiento,
              estado_pago: v.estado_pago
            };
          });

        res.json(resultado);
      }
    );

  } catch (error) {
    console.log("ERROR TRACCAR GPS:", error);
    res.status(500).json([]);
  }
});
// ===============================
// VEHÍCULOS POR GPS / CLIENTE
// ===============================
app.get("/vehiculos/gps/:gps", (req, res) => {
  const gps = req.params.gps;

  db.query(
    "SELECT * FROM vehiculos WHERE gps = ?",
    [gps],
    (err, results) => {
      if (err) {
        console.log("Error vehículos por GPS:", err);
        return res.status(500).json([]);
      }

     const activos = results.filter(v =>
  !servicioVencido(v.fecha_vencimiento) &&
  v.estado_pago !== "suspendido"
);

res.json(activos);
    }
  );
});
// ===============================
// CREAR VEHÍCULO
// ===============================
app.post("/vehiculos", (req, res) => {
  const {
    usuario,
    password,
    gps,
    imei,
modelo_gps,
    placa,
    tipo,
    correo,
    fecha_vencimiento,
    adminUsuario,
    adminPassword
  } = req.body;

  db.query(
    "SELECT * FROM vehiculos WHERE usuario = ? AND password = ? AND admin = 1",
    [adminUsuario, adminPassword],
    (errAdmin, adminResult) => {
      if (errAdmin) {
        console.log("Error validando admin:", errAdmin);
        return res.status(500).json({ ok: false });
      }

      if (adminResult.length === 0) {
        return res.status(403).json({
          ok: false,
          error: "No autorizado",
        });
      }

      if (!usuario || !password || !correo || !fecha_vencimiento || !gps || !placa) {
        return res.json({
          ok: false,
          error: "Faltan datos",
        });
      }

     db.query(
  "SELECT * FROM vehiculos WHERE imei = ?",
  [imei],
        (err, results) => {
          if (err) {
            console.log("Error buscando usuario:", err);
            return res.status(500).json({ ok: false });
          }

          if (results.length > 0) {
            return res.json({
              ok: false,
              error: "El IMEI ya existe",
            });
          }

          const nuevo = {
            usuario,
password,
            correo,
            fecha_creacion: new Date().toISOString().split("T")[0],
            fecha_vencimiento,
            estado_pago: "activo",
            gps,
            imei,
            modelo_gps,
placa,
            admin: 0,
            tipo: tipo || "auto",
            estado: "activo",
            bloqueo: "desbloqueado",
            motor: "encendido",
            pasoRuta: 0,
            velocidad: Math.floor(Math.random() * 100),
            km: Math.floor(Math.random() * 10000),
            latitud: -1.6635 + Math.random() * 0.02,
            longitud: -78.6546 + Math.random() * 0.02,
          };

          const sql = `
           INSERT INTO vehiculos
(
usuario,
password,
correo,
fecha_creacion,
fecha_vencimiento,
estado_pago,
gps,
imei,
modelo_gps,
placa,
admin,
tipo,
estado,
bloqueo,
motor,
pasoRuta,
velocidad,
km,
latitud,
longitud
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)          `;

          db.query(
            sql,
            [
              nuevo.usuario,
              nuevo.password,
              nuevo.correo,
              nuevo.fecha_creacion,
              nuevo.fecha_vencimiento,
              nuevo.estado_pago,
              nuevo.gps,
              nuevo.imei,
              nuevo.modelo_gps,
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
              nuevo.longitud,
            ],
            (err3) => {
              if (err3) {
                console.log("Error creando vehículo:", err3);
                return res.status(500).json({
                  ok: false,
                  error: "No se pudo crear vehículo",
                });
              }

              io.emit("vehiculo-creado", nuevo);

              res.json({
                ok: true,
                vehiculo: nuevo,
              });
            }
          );
        }
      );
    }
  );
});

// ===============================
// EDITAR / COMPLETAR VEHÍCULO POR IMEI
// ===============================
app.put("/vehiculos/imei/:imei", (req, res) => {
  const imeiActual = req.params.imei;

  const {
    usuario,
    password,
    correo,
    fecha_creacion,
    fecha_vencimiento,
    gps,
    modelo_gps,
    placa,
    tipo
  } = req.body;

  db.query(
    "SELECT * FROM vehiculos WHERE imei = ?",
    [imeiActual],
    (err, results) => {
      if (err) {
        console.log("Error buscando IMEI:", err);
        return res.json({ ok: false });
      }

      if (results.length > 0) {
        db.query(
          `
          UPDATE vehiculos
          SET usuario = ?, password = ?, correo = ?, fecha_creacion = ?,
              fecha_vencimiento = ?, gps = ?, modelo_gps = ?, placa = ?, tipo = ?
          WHERE imei = ?
          `,
          [
            usuario,
            password,
            correo,
            fecha_creacion,
            fecha_vencimiento,
            gps,
            modelo_gps,
            placa,
            tipo,
            imeiActual
          ],
          (err2) => {
            if (err2) {
              console.log("Error actualizando vehículo:", err2);
              return res.json({ ok: false });
            }

            res.json({ ok: true });
          }
        );
      } else {
        db.query(
          `
          INSERT INTO vehiculos
          (usuario, password, correo, fecha_creacion, fecha_vencimiento,
           estado_pago, gps, imei, modelo_gps, placa, admin, tipo,
           estado, bloqueo, motor, pasoRuta, velocidad, km, latitud, longitud)
          VALUES (?, ?, ?, ?, ?, 'activo', ?, ?, ?, ?, 0, ?, 'activo',
          'desbloqueado', 'encendido', 0, 0, 0, 0, 0)
          `,
          [
            usuario,
            password,
            correo,
            fecha_creacion,
            fecha_vencimiento,
            gps,
            imeiActual,
            modelo_gps,
            placa,
            tipo
          ],
          (err3) => {
            if (err3) {
              console.log("Error insertando vehículo:", err3);
              return res.json({ ok: false });
            }

            res.json({ ok: true });
          }
        );
      }
    }
  );
});

// ===============================
// ELIMINAR VEHÍCULO SOLO ADMIN
// ===============================
app.delete("/vehiculos/imei/:imei", async (req, res) => {

  const imei = req.params.imei;
  const { adminUsuario, adminPassword } = req.body;

  db.query(
    "SELECT * FROM vehiculos WHERE usuario = ? AND password = ? AND admin = 1",
    [adminUsuario, adminPassword],
    async (errAdmin, adminResult) => {

      if (errAdmin) {
        console.log("Error validando admin:", errAdmin);
        return res.status(500).json({ ok:false });
      }

      if (adminResult.length === 0) {
        return res.status(403).json({
          ok:false,
          error:"No autorizado"
        });
      }

      try {

        const auth = await traccarAuth();

        const device = await obtenerDeviceTraccarPorImei(imei);

        if(device && device.id){

          await fetch(
            `http://194.238.25.152:8082/api/devices/${device.id}`,
            {
              method:"DELETE",
              headers:{
                Authorization: auth
              }
            }
          );

          console.log("✅ Eliminado de Traccar:", imei);

        }

        db.query(
          "DELETE FROM vehiculos WHERE imei = ?",
          [imei],
          (errDelete) => {

            if(errDelete){
              console.log(errDelete);
              return res.status(500).json({
                ok:false,
                error:"Error eliminando de AndesTrack"
              });
            }

            res.json({
              ok:true
            });

          }
        );

      } catch(error){

        console.log("Error eliminando en Traccar:", error);

        res.status(500).json({
          ok:false,
          error:"Error eliminando en Traccar"
        });

      }

    }
  );

});
app.delete("/vehiculos/:id", (req, res) => {

  const { adminUsuario } = req.body;

  db.query(
    "SELECT * FROM vehiculos WHERE usuario = ? AND admin = 1",
    [adminUsuario],
    (errAdmin, adminResult) => {

      if (errAdmin) {
        console.log("Error validando admin:", errAdmin);
        return res.status(500).json({ ok: false });
      }

      if (adminResult.length === 0) {
        return res.status(403).json({
          ok: false,
          error: "No autorizado"
        });
      }

      db.query(
        "DELETE FROM vehiculos WHERE id = ?",
        [req.params.id],
        (err) => {

          if (err) {
            console.log("Error eliminando vehículo:", err);
            return res.status(500).json({ ok: false });
          }

          res.json({ ok: true });

        }
      );
    }
  );
});
// ===============================
// CAMBIAR MOTOR
// ===============================
app.put("/vehiculos/:imei/motor", (req, res) => {
  const imei = req.params.imei;
  const nuevoMotor = req.body.motor;

  let estado = "activo";
  let velocidad = null;

  if (nuevoMotor === "apagado") {
    estado = "apagado";
    velocidad = 0;
  }

  db.query(
    `
    UPDATE vehiculos
    SET motor = ?, estado = ?, velocidad = ?
    WHERE imei = ?
    `,
    [nuevoMotor, estado, velocidad, imei],
    (err) => {
      if (err) {
        console.log("Error cambiando motor:", err);
        return res.status(500).json({ ok: false });
      }

      guardarEvento(
  imei,
  "motor",
  nuevoMotor === "encendido"
    ? "Motor encendido"
    : "Motor apagado"
);

io.emit("motor-actualizado", { imei, motor: nuevoMotor, estado });
res.json({ ok: true });
    }
  );
});

// ===============================
// BLOQUEAR / DESBLOQUEAR POR IMEI
// ===============================
app.put("/vehiculos/:imei/bloqueo", (req, res) => {
  const imei = req.params.imei;
  const { bloqueo } = req.body;

  let estado = "apagado";
  let motor = "apagado";
  let velocidad = 0;

  if (bloqueo === "bloqueado") {
    estado = "bloqueado";
  }

  if (bloqueo === "desbloqueado") {
    estado = "apagado";
  }

  db.query(
    `
    UPDATE vehiculos
    SET bloqueo = ?, estado = ?, motor = ?, velocidad = ?
    WHERE imei = ?
    `,
    [bloqueo, estado, motor, velocidad, imei],
    (err) => {
      if (err) {
        console.log("Error bloqueando/desbloqueando:", err);
        return res.status(500).json({ ok: false });
      }

      guardarEvento(
        imei,
        "bloqueo",
        bloqueo === "bloqueado"
          ? "Vehículo bloqueado"
          : "Vehículo desbloqueado"
      );

      io.emit("bloqueo-actualizado", {
        imei,
        bloqueo,
        estado,
        motor
      });

      res.json({ ok: true });
    }
  );
});
// ===============================
// RUTA GPS SIMULADA
// ===============================
const rutaGPS = [
  [-1.6635, -78.6546],
  [-1.66351, -78.65458],
  [-1.66352, -78.65456],
  [-1.66353, -78.65454],
  [-1.66354, -78.65452],
  [-1.66355, -78.6545],
  [-1.66356, -78.65448],
  [-1.66357, -78.65446],
  [-1.66358, -78.65444],
  [-1.66359, -78.65442],
];

// ===============================
// ACTUALIZAR GPS
// ===============================
app.put("/actualizar-gps", (req, res) => {
  db.query("SELECT * FROM vehiculos", (err, vehiculos) => {
    if (err) {
      console.log("Error leyendo vehículos:", err);
      return res.status(500).json({ ok: false });
    }

    vehiculos.forEach((v) => {
        if (
  servicioVencido(v.fecha_vencimiento) ||
  v.estado_pago === "suspendido"
) {
  return;
}
      if (v.motor === "encendido" && v.bloqueo !== "bloqueado") {
        const pasoActual = Number(v.pasoRuta) || 0;
        const punto = rutaGPS[pasoActual] || rutaGPS[0];

        const nuevaLatitud =
          Number(v.latitud) + (punto[0] - Number(v.latitud)) * 0.25;

        const nuevaLongitud =
          Number(v.longitud) + (punto[1] - Number(v.longitud)) * 0.25;

        let nuevoPaso = pasoActual + 1;
        if (nuevoPaso >= rutaGPS.length) nuevoPaso = 0;

        const velocidad = Math.floor(Math.random() * 121);
        const km = Number(v.km || 0) + velocidad / 3600;
        const estado = velocidad <= 5 ? "detenido" : "activo";

        db.query(
          `
          UPDATE vehiculos
          SET latitud = ?, longitud = ?, velocidad = ?, km = ?, estado = ?, pasoRuta = ?
          WHERE id = ?
          `,
          [nuevaLatitud, nuevaLongitud, velocidad, km, estado, nuevoPaso, v.id]
        );

        const ahora = new Date();

const fecha = ahora.toISOString().split("T")[0];
const hora = ahora.toTimeString().split(" ")[0];

db.query(
  `
  INSERT INTO historial
  (usuario, placa, fecha, hora, latitud, longitud, velocidad, estado, km)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    v.usuario,
    v.placa,
    fecha,
    hora,
    nuevaLatitud,
    nuevaLongitud,
    velocidad,
    estado,
    km,
  ],
  (errHistorial) => {
    if (errHistorial) {
      console.log("❌ Error guardando historial:", errHistorial);
    } else {
      console.log("✅ Historial guardado:", v.usuario, velocidad);
    }
  }
);

        if (velocidad >= 100) {
          db.query(
            `
            INSERT INTO alertas
            (usuario, placa, tipo, velocidad, latitud, longitud, fecha, hora)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          [
  v.usuario,
  v.placa,
  "exceso_velocidad",
  "Exceso de velocidad",
  velocidad,
  nuevaLatitud,
  nuevaLongitud,
  new Date().toLocaleDateString(),
  new Date().toLocaleTimeString()
],
            (errAlerta) => {
              if (errAlerta) {
                console.log("Error guardando alerta:", errAlerta);
              } else {
                console.log("🚨 Alerta guardada:", v.usuario, velocidad);
              }
            }
          );

          io.emit("nueva-alerta", {
            usuario: v.usuario,
            placa: v.placa,
            tipo: "exceso_velocidad",
            mensaje: "Exceso de velocidad",
            velocidad,
            latitud: nuevaLatitud,
            longitud: nuevaLongitud,
          });
        }

        io.emit("recibir-ubicacion", {
  id: v.id,
  imei: v.imei,
  usuario: v.usuario,
  admin: v.admin || false,
  placa: v.placa,
  tipo: v.tipo,
  gps: v.gps,
  fecha_creacion: v.fecha_creacion,
  fecha_vencimiento: v.fecha_vencimiento,
  estado_pago: v.estado_pago,
  km,
  latitud: nuevaLatitud,
  longitud: nuevaLongitud,
  velocidad,
  estado,
  bloqueo: v.bloqueo,
  motor: v.motor,
});
      }
    });

    res.json({ ok: true, mensaje: "GPS actualizado" });
  });
});

// ===============================
// HISTORIAL SIMPLE
// ===============================
app.get("/historial/:usuario", (req, res) => {
  db.query(
    `
    SELECT *
    FROM historial
    WHERE usuario = ?
    ORDER BY id DESC
    LIMIT 50
    `,
    [req.params.usuario],
    (err, resultados) => {
      if (err) {
        console.log("Error historial:", err);
        return res.json([]);
      }

      res.json(resultados);
    }
  );
});

// ===============================
// RECORRIDO
// ===============================
app.get("/recorrido/:usuario", (req, res) => {
  db.query(
    `
    SELECT *
    FROM historial
    WHERE usuario = ?
    ORDER BY id ASC
    LIMIT 1000
    `,
    [req.params.usuario],
    (err, registros) => {
      if (err) {
        console.log("Error recorrido:", err);
        return res.status(500).json({ ok: false, puntos: [] });
      }

      res.json({
        ok: true,
        usuario: req.params.usuario,
        puntos: registros,
      });
    }
  );
});

// ===============================
// TODAS LAS ALERTAS
// ===============================
app.get("/alertas", (req, res) => {
  db.query(
    `
    SELECT *
    FROM alertas
    ORDER BY id DESC
    LIMIT 50
    `,
    (err, resultados) => {
      if (err) {
        console.log("Error obteniendo alertas:", err);
        return res.status(500).json([]);
      }

      res.json(resultados);
    }
  );
});

// ===============================
// ALERTAS POR VEHÍCULO
// ===============================
app.get("/alertas/:usuario", (req, res) => {
  db.query(
    `
    SELECT *
    FROM alertas
    WHERE usuario = ?
    ORDER BY id DESC
    LIMIT 5
    `,
    [req.params.usuario],
    (err, resultados) => {
      if (err) {
        console.log("Error obteniendo alertas:", err);
        return res.json([]);
      }

      res.json(resultados);
    }
  );
});
app.post("/validar-cliente", (req, res) => {
  const { usuario } = req.body;

  db.query(
    "SELECT usuario, fecha_vencimiento, estado_pago FROM vehiculos WHERE usuario = ? LIMIT 1",
    [usuario],
    (err, results) => {
      if (err || results.length === 0) {
        return res.json({ ok: false });
      }

      const user = results[0];

      if (
        user.estado_pago === "suspendido" ||
        servicioVencido(user.fecha_vencimiento)
      ) {
        return res.json({
          ok: false,
          error: "⛔ Servicio vencido. Comunícate con el administrador 👨‍💼"
        });
      }

      res.json({ ok: true });
    }
  );
});
// ===============================
// LOGIN
// ===============================

app.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  db.query(
    "SELECT * FROM usuarios WHERE usuario = ? AND password = ? AND admin = 1 LIMIT 1",
    [usuario, password],
    (err, adminResults) => {
      if (err) {
        console.log("Error login admin:", err);
        return res.status(500).json({ success: false });
      }

      if (adminResults.length > 0) {
        return res.json({
          success: true,
          usuario: adminResults[0].usuario,
          gps: "1",
          admin: true,
          tipo: "admin"
        });
      }

      db.query(
        "SELECT * FROM vehiculos WHERE usuario = ? AND password = ? LIMIT 1",
        [usuario, password],
        (err2, results) => {
          if (err2) {
            console.log("Error login cliente:", err2);
            return res.status(500).json({ success: false });
          }

          if (results.length === 0) {
            return res.json({
              success: false,
              error: "Usuario o contraseña incorrectos"
            });
          }

         const user = results[0];

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

const vence = new Date(user.fecha_vencimiento);
vence.setHours(0, 0, 0, 0);

if (
    user.estado_pago === "suspendido" ||
    vence < hoy
) {
    return res.json({
        success: false,
        bloqueado: true,
        error: "⛔ Servicio vencido. Comunícate con el administrador 👨‍💼"
    });
}

return res.json({
    success: true,
    usuario: user.usuario,
    gps: user.gps,
    admin: false,
    tipo: "cliente"
});
        }
      );
    }
  );
});
// ===============================
// RECUPERAR CONTRASEÑA
// ===============================
app.post("/recuperar-password", (req, res) => {
  const { dato } = req.body;

  if (!dato) {
    return res.json({ ok: false, error: "Ingrese correo o usuario" });
  }

  db.query(
    "SELECT usuario, password, correo FROM usuarios WHERE usuario = ? OR correo = ? AND admin = 1 LIMIT 1",
    [dato, dato],
    (errAdmin, adminResults) => {
      if (errAdmin) {
        console.log("Error buscando admin:", errAdmin);
        return res.status(500).json({ ok: false });
      }

      if (adminResults.length > 0) {
        return enviarCorreoRecuperacion(adminResults[0], res);
      }

      db.query(
        "SELECT usuario, password, correo FROM vehiculos WHERE usuario = ? OR correo = ? LIMIT 1",
        [dato, dato],
        (errVehiculo, vehiculoResults) => {
          if (errVehiculo) {
            console.log("Error buscando vehículo:", errVehiculo);
            return res.status(500).json({ ok: false });
          }

          if (vehiculoResults.length === 0) {
            return res.json({
              ok: false,
              error: "Usuario o correo no encontrado",
            });
          }

          enviarCorreoRecuperacion(vehiculoResults[0], res);
        }
      );
    }
  );
});

function enviarCorreoRecuperacion(user, res) {
  if (!user.correo) {
    return res.json({
      ok: false,
      error: "Este usuario no tiene correo registrado",
    });
  }

  transporter.sendMail(
    {
      from: "AndesTrack <andesbyte2026@gmail.com>",
      to: user.correo,
      subject: "Recuperación de contraseña AndesTrack",
      text: `Hola ${user.usuario}, tu contraseña es: ${user.password}`,
    },
    (error) => {
      if (error) {
        console.log("Error enviando correo:", error);
        return res.json({
          ok: false,
          error: "No se pudo enviar el correo",
        });
      }

      res.json({ ok: true });
    }
  );
}
// ===============================
// CAMBIAR CLAVE
// ===============================
app.put("/cambiar-clave", (req, res) => {
  const { usuario, nuevaClave } = req.body;

  if (!usuario || !nuevaClave) {
    return res.json({ success: false, error: "Faltan datos" });
  }

  db.query(
    "UPDATE usuarios SET password = ? WHERE usuario = ?",
    [nuevaClave, usuario],
    (err, resultAdmin) => {
      if (err) return res.status(500).json({ success: false });

      if (resultAdmin.affectedRows > 0) {
        return res.json({ success: true });
      }

      db.query(
        "UPDATE vehiculos SET password = ? WHERE usuario = ?",
        [nuevaClave, usuario],
        (err2, resultVehiculo) => {
          if (err2) return res.status(500).json({ success: false });

          if (resultVehiculo.affectedRows > 0) {
            return res.json({ success: true });
          }

          res.json({ success: false, error: "Usuario no encontrado" });
        }
      );
    }
  );
});
// ===============================
// RENOVAR SERVICIO
// ===============================
app.put("/renovar-servicio", (req, res) => {
  const { usuario, meses } = req.body;

  if (!usuario || !meses) {
    return res.json({
      ok: false,
      error: "Faltan datos",
    });
  }

  const hoy = new Date();
  hoy.setMonth(hoy.getMonth() + Number(meses));

  const nuevaFecha = hoy.toISOString().split("T")[0];

  db.query(
    `
    UPDATE vehiculos
    SET fecha_vencimiento = ?, estado_pago = 'activo'
    WHERE usuario = ?
    `,
    [nuevaFecha, usuario],
    (err, result) => {
      if (err) {
        console.log("Error renovando servicio:", err);
        return res.status(500).json({
          ok: false,
          error: "Error renovando servicio",
        });
      }

      if (result.affectedRows === 0) {
        return res.json({
          ok: false,
          error: "Usuario no encontrado",
        });
      }

      res.json({
        ok: true,
        fecha_vencimiento: nuevaFecha,
      });
    }
  );
});
// ===============================
// SUSPENDER SERVICIO
// ===============================
app.put("/suspender-servicio", (req, res) => {
  const { usuario } = req.body;

  if (!usuario) {
    return res.json({
      ok: false,
      error: "Falta usuario"
    });
  }

  db.query(
    `
    UPDATE vehiculos
    SET estado_pago = 'suspendido',
        motor = 'apagado',
        estado = 'apagado',
        velocidad = 0
    WHERE usuario = ?
    `,
    [usuario],
    (err, result) => {
      if (err) {
        console.log("Error suspendiendo servicio:", err);
        return res.status(500).json({
          ok: false,
          error: "Error suspendiendo servicio"
        });
      }

      if (result.affectedRows === 0) {
        return res.json({
          ok: false,
          error: "Usuario no encontrado"
        });
      }

      res.json({ ok: true });
    }
  );
});


// ===============================
// ACTIVAR SERVICIO
// ===============================
app.put("/activar-servicio", (req, res) => {
  const { usuario } = req.body;

  if (!usuario) {
    return res.json({
      ok: false,
      error: "Falta usuario"
    });
  }

  db.query(
    `
    UPDATE vehiculos
    SET estado_pago = 'activo',
        estado = 'activo'
    WHERE usuario = ?
    `,
    [usuario],
    (err, result) => {
      if (err) {
        console.log("Error activando servicio:", err);
        return res.status(500).json({
          ok: false,
          error: "Error activando servicio"
        });
      }

      if (result.affectedRows === 0) {
        return res.json({
          ok: false,
          error: "Usuario no encontrado"
        });
      }

      res.json({ ok: true });
    }
  );
});
// ===============================
// PDF HISTORIAL DETALLADO
// ===============================
app.get("/pdf/historial/:usuario", (req, res) => {
  const usuario = req.params.usuario;
  const { desde, hasta } = req.query;

  const desdeSQL = desde.replace("T", " ") + ":00";
  const hastaSQL = hasta.replace("T", " ") + ":00";

  const sqlHistorial = `
    SELECT *
    FROM historial
    WHERE usuario = ?
    AND STR_TO_DATE(CONCAT(fecha, ' ', hora), '%d/%m/%Y %H:%i:%s')
    BETWEEN ? AND ?
    ORDER BY id ASC
  `;

  const sqlEventos = `
  SELECT *
  FROM eventos
  WHERE usuario = ?
  AND TIMESTAMP(fecha, hora) BETWEEN ? AND ?
  ORDER BY id ASC
`;

  db.query(sqlHistorial, [usuario, desdeSQL, hastaSQL], (err, historial) => {
    if (err) {
      console.log("Error historial PDF:", err);
      return res.status(500).send("Error generando PDF");
    }

db.query(sqlEventos, [usuario, desdeSQL, hastaSQL], (err2, eventos) => {
  if (err2) {
    console.log("Error eventos PDF:", err2);
    return res.status(500).send("Error generando PDF");
  }

      const doc = new PDFDocument({ margin: 45 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=reporte-${usuario}.pdf`);

      doc.pipe(res);

      let totalKm = 0;

      if (historial.length >= 2) {
        const primero = Number(historial[0].km) || 0;
        const ultimo = Number(historial[historial.length - 1].km) || 0;
        totalKm = ultimo - primero;
      }

      const detenciones = historial.filter(h =>
        Number(h.velocidad) <= 5 || h.estado === "detenido"
      );

      const excesos = historial.filter(h =>
        Number(h.velocidad) >= 100
      );

      doc.fontSize(22).text("ANDES TRACK", { align: "center" });
      doc.moveDown();

      doc.fontSize(14).text(`Reporte detallado de: ${usuario}`);
      doc.text(`Desde: ${desdeSQL}`);
      doc.text(`Hasta: ${hastaSQL}`);
      doc.moveDown();

      doc.fontSize(16).text(`TOTAL RECORRIDO: ${totalKm.toFixed(2)} km`);
      doc.moveDown();

      doc.fontSize(15).text("EVENTOS DEL VEHÍCULO");
      if (eventos.length === 0) {
        doc.fontSize(11).text("No hubo eventos.");
      } else {
        eventos.forEach(ev => {
          doc.fontSize(11).text(`- ${ev.fecha} ${ev.hora} | ${ev.descripcion}`);
        });
      }

      doc.moveDown();

      doc.fontSize(15).text("DETENCIONES");
      if (detenciones.length === 0) {
        doc.fontSize(11).text("No hubo detenciones.");
      } else {
        detenciones.forEach(d => {
          doc.fontSize(11).text(
            `- ${d.fecha} ${d.hora} | Vel: ${d.velocidad} km/h | Lat: ${d.latitud} | Lng: ${d.longitud}`
          );
        });
      }

      doc.moveDown();

      doc.fontSize(15).text("EXCESOS DE VELOCIDAD");
      if (excesos.length === 0) {
        doc.fontSize(11).text("No hubo excesos de velocidad.");
      } else {
        excesos.forEach(e => {
          doc.fontSize(11).text(
            `- ${e.fecha} ${e.hora} | Velocidad: ${e.velocidad} km/h | Lat: ${e.latitud} | Lng: ${e.longitud}`
          );
        });
      }

      doc.moveDown();

      doc.fontSize(15).text("DETALLE GPS");
      historial.forEach((h, i) => {
        doc.fontSize(10).text(
          `${i + 1}. ${h.fecha} ${h.hora} | Vel: ${h.velocidad} km/h | Estado: ${h.estado} | KM: ${h.km} | Lat: ${h.latitud} | Lng: ${h.longitud}`
        );
      });

      doc.end();
    });
  });
});
// ===============================
// CREAR GEOCERCA
// ===============================
app.post("/geocerca", (req, res) => {

  const {
    usuario,
    nombre,
    latitud,
    longitud,
    radio
  } = req.body;

  db.query(
    `
    INSERT INTO geocercas
    (usuario,nombre,latitud,longitud,radio)
    VALUES (?,?,?,?,?)
    `,
    [
      usuario,
      nombre,
      latitud,
      longitud,
      radio
    ],
    (err) => {

      if(err){
        console.log(err);
        return res.json({ ok:false });
      }

      res.json({ ok:true });

    }
  );

});
// ===============================
// OBTENER GEOCERCAS
// ===============================
app.get("/geocercas/:usuario", (req, res) => {
  const usuario = req.params.usuario;

  db.query(
    `
    SELECT *
    FROM geocercas
    WHERE usuario = ?
    `,
    [usuario],
    (err, results) => {
      if (err) {
        console.log("Error obteniendo geocercas:", err);
        return res.json([]);
      }

      res.json(results);
    }
  );
});
// ===============================
// ELIMINAR GEOCERCA
// ===============================
app.delete("/geocerca/:id", (req, res) => {

    db.query(
        "DELETE FROM geocercas WHERE id = ?",
        [req.params.id],
        (err) => {

            if(err){
                console.log(err);
                return res.json({ ok:false });
            }

            res.json({ ok:true });

        }
    );

});
// ===============================
// EDITAR GEOCERCA
// ===============================
app.put("/geocerca/:id", (req, res) => {

    const {
        nombre,
        radio
    } = req.body;

    db.query(
        `
        UPDATE geocercas
        SET nombre = ?, radio = ?
        WHERE id = ?
        `,
        [
            nombre,
            radio,
            req.params.id
        ],
        (err) => {

            if(err){
                console.log(err);
                return res.json({ ok:false });
            }

            res.json({ ok:true });

        }
    );

});
// ===============================
// SOCKET
// ===============================
io.on("connection", () => {
  console.log("Cliente conectado");
});

// ===============================
// ACTUALIZAR GPS AUTOMÁTICO
// ===============================
// ===============================
// RECEPTOR TCP GPS EC33
// ===============================
const TCP_PORT = process.env.TCP_PORT || 5001;

const tcpServer = net.createServer((socket) => {
  console.log("📡 GPS conectado:", socket.remoteAddress);

  socket.on("data", (data) => {
    const mensaje = data.toString("utf8").trim();
    console.log("📍 Datos GPS recibidos:", mensaje);

    // Aquí luego convertimos el mensaje real del EC33 a latitud/longitud
  });

  socket.on("end", () => {
    console.log("🔌 GPS desconectado");
  });

  socket.on("error", (err) => {
    console.log("❌ Error TCP GPS:", err.message);
  });
});

tcpServer.listen(TCP_PORT, "0.0.0.0", () => {
  console.log("✅ Receptor TCP GPS escuchando en puerto " + TCP_PORT);
});
// ===============================
// INICIAR SERVIDOR
// ===============================
server.listen(PORT, () => {
  console.log("Servidor funcionando en puerto " + PORT);
});
