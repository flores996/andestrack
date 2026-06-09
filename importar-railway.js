const fs = require("fs");
const mysql = require("mysql2");

const sql = fs.readFileSync("C:/Users/Angi/Downloads/andestrack (1).sql", "utf8");

const db = mysql.createConnection({
  host: "acela.proxy.rlwy.net",
  user: "root",
  password: "UPOUvTjPnSprIJkAYrkPhUPvrfSMLfuH",
  database: "railway",
  port: 29094,
  multipleStatements: true
});

db.query(sql, (err) => {
  if (err) {
    console.log("❌ Error importando:", err);
  } else {
    console.log("✅ BASE IMPORTADA CORRECTAMENTE");
  }
  db.end();
});