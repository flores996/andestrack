const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "acela.proxy.rlwy.net",
  user: "root",
  password: "TU_PASSWORD_REAL",
  database: "railway",
  port: 29094
});

db.connect((error) => {
  if (error) {
    console.log("❌ ERROR MYSQL");
    console.log(error);
  } else {
    console.log("✅ MYSQL CONECTADO RAILWAY");
  }
});

module.exports = db;