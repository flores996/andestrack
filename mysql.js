const mysql = require("mysql2");

const db = mysql.createPool({
  host: "acela.proxy.rlwy.net",
  user: "root",
  password: "UP0UvTjPnSprIJkAYrkPhUPvrfSMLfuH",
  database: "railway",
  port: 29094,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log("✅ MYSQL POOL RAILWAY LISTO");

module.exports = db;