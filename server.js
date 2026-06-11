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

    const auth = "Basic " + Buffer.from(
      process.env.TRACCAR_USER + ":" + process.env.TRACCAR_PASS
    ).toString("base64");

    const devicesRes = await fetch("http://194.238.25.152:8082/api/devices", {
      headers: {
        Authorization: auth
      }
    });

    const positionsRes = await fetch("http://194.238.25.152:8082/api/positions", {
      headers: {
        Authorization: auth
      }
    });

    const listaDevices = await devicesRes.json();
    const listaPositions = await positionsRes.json();

    const resultado = listaDevices.map(device => {

      const pos = listaPositions.find(p => p.deviceId === device.id);

      return {
        usuario: device.name,
        placa: device.name,
        tipo: "auto",
        gps: 1,
        imei: device.uniqueId,

        latitud: pos ? pos.latitude : 0,
        longitud: pos ? pos.longitude : 0,

        velocidad: pos ? Math.round(pos.speed * 1.852) : 0,

        estado: device.status === "online" ? "activo" : "apagado",

        km: pos ? ((pos.attributes.totalDistance || 0) / 1000).toFixed(2) : 0,

        motor: "encendido",
        fecha_creacion: "2026-06-10",
        fecha_vencimiento: "2030-12-28",
        estado_pago: "activo"
      };

    });

    res.json(resultado);

  } catch (error) {
    console.log("ERROR TRACCAR:", error);
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
    "SELECT * FROM usuarios WHERE usuario = ? AND password = ? AND admin = 1",
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
        "SELECT * FROM vehiculos WHERE usuario = ?",
        [usuario],
        (err, results) => {
          if (err) {
            console.log("Error buscando usuario:", err);
            return res.status(500).json({ ok: false });
          }

          if (results.length > 0) {
            return res.json({
              ok: false,
              error: "Usuario ya existe",
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
// ELIMINAR VEHÍCULO SOLO ADMIN
// ===============================
app.delete("/vehiculos/:id", (req, res) => {

  const { adminUsuario } = req.body;

  db.query(
    "SELECT * FROM usuarios WHERE usuario = ? AND admin = 1",
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
app.put("/vehiculos/:usuario/motor", (req, res) => {
  const usuario = req.params.usuario;
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
    WHERE usuario = ?
    `,
    [nuevoMotor, estado, velocidad, usuario],
    (err) => {
      if (err) {
        console.log("Error cambiando motor:", err);
        return res.status(500).json({ ok: false });
      }

      guardarEvento(
  usuario,
  "motor",
  nuevoMotor === "encendido"
    ? "Motor encendido"
    : "Motor apagado"
);

io.emit("motor-actualizado", { usuario, motor: nuevoMotor, estado });
res.json({ ok: true });
    }
  );
});

// ===============================
// BLOQUEAR / DESBLOQUEAR
// ===============================
app.put("/vehiculos/:usuario/bloqueo", (req, res) => {
  const usuario = req.params.usuario;
  const { bloqueo } = req.body;

  let estado = "apagado";
  let motor = "apagado";
  let velocidad = 0;

  if (bloqueo === "bloqueado") estado = "bloqueado";
  if (bloqueo === "desbloqueado") estado = "apagado";

  db.query(
    `
    UPDATE vehiculos
    SET bloqueo = ?, estado = ?, motor = ?, velocidad = ?
    WHERE usuario = ?
    `,
    [bloqueo, estado, motor, velocidad, usuario],
    (err) => {
      if (err) {
        console.log("Error bloqueando/desbloqueando:", err);
        return res.status(500).json({ ok: false });
      }

      guardarEvento(
  usuario,
  "bloqueo",
  bloqueo === "bloqueado"
    ? "Vehículo bloqueado"
    : "Vehículo desbloqueado"
);

      io.emit("bloqueo-actualizado", { usuario, bloqueo, estado, motor });
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

// ===============================
// LOGIN
// ===============================
app.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  db.query(
    `
    SELECT *
    FROM usuarios
    WHERE usuario = ?
    AND password = ?
    `,
    [usuario, password],
    (err, adminResults) => {

      if (err) {
        console.log("Error login admin:", err);
        return res.status(500).json({
          success: false
        });
      }

      // ADMIN
      if (adminResults.length > 0) {

        return res.json({
          success: true,
          usuario: adminResults[0].usuario,
          gps: "1",
          admin: true
        });

      }

      // CLIENTE
      db.query(
        `
        SELECT *
        FROM vehiculos
        WHERE usuario = ?
        AND password = ?
        `,
        [usuario, password],
        (err2, results) => {

          if (err2) {
            console.log("Error login vehículo:", err2);

            return res.status(500).json({
              success: false
            });
          }

          if (results.length === 0) {

            return res.json({
              success: false
            });

          }

          const user = results[0];
          if (user.estado_pago === "suspendido") {
  return res.json({
    success: false,
    error: "Servicio suspendido. Comuníquese con el administrador."
  });
}

          // VALIDAR SOLO ESTE USUARIO
          if (servicioVencido(user.fecha_vencimiento)) {

            return res.json({
              success: false,
              error:
                "Servicio vencido. Comuníquese con el administrador."
            });

          }

          return res.json({
            success: true,
            usuario: user.usuario,
            gps: user.gps,
            admin:
              user.admin == 1 ||
              user.admin === true
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
    "SELECT usuario, password, correo FROM usuarios WHERE usuario = ? OR correo = ? LIMIT 1",
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
