const mysql = require("mysql2");

const db = mysql.createPool(process.env.MYSQL_PUBLIC_URL);

console.log("✅ MYSQL CONECTADO CON PUBLIC URL");

module.exports = db;