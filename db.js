const mysql = require("mysql");

const user = "desktop_pc";
const password = "chinoxlink153";

const connection = mysql.createConnection({
  host: "10.242.102.244",
  port: 3306,
  user,
  password,
  database: "dbtaw",
});
// const connection = mysql.createConnection({
//     host: '186.64.118.40',
//     port: 3306,
//     user: 'tnsinfor_fjusto2',
//     password: 'y3GgLm@yU0^', //tnsinfor_fjusto: D2&kw%(Ji=l
//     database: 'tnsinfor_fjusto2'
// });

connection.connect((error) => {
  if (error) {
    console.error(error);
  } else {
    console.log("connection successful");
  }
});

module.exports = connection;