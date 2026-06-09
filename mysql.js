const mysql = require('mysql2');

const db = mysql.createConnection({

    host: 'localhost',

    user: 'root',

    password: '',

    database: 'andestrack'

});

db.connect((err) => {

    if (err) {

        console.log(err);

    } else {

        console.log('MySQL conectado');

    }

});

module.exports = db;