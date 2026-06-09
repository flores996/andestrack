const mysql = require("mysql2");

const conexion = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT)
});

conexion.connect((error) => {
  if (error) {
    console.log("❌ ERROR MYSQL");
    console.log(error);
  } else {
    console.log("✅ MYSQL CONECTADO RAILWAY");
  }
});

module.exports = conexion;