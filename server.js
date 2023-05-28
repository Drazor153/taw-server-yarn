const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const cors = require("cors");
const os = require("os");
const db = require("./db");
const app = express();
const PORT = 3600;

const mostrar = (str) => console.log("Peticion recibida >> " + str);

const algorithm = "aes-256-cbc";

const key = crypto.randomBytes(32);

const iv = crypto.randomBytes(16);

function encrypt(text) {
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString("hex"), encryptedData: encrypted.toString("hex") };
}

function decrypt(text) {
  let iv = Buffer.from(text.iv, "hex");
  let encryptedText = Buffer.from(text.encryptedData, "hex");

  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}
const connectedSessions = [];

var cronJob = require("cron").CronJob;
var job = new cronJob(
  "5 * * * * *",
  () => {
    console.log(connectedSessions);
  },
  null,
  true
);

job.start();

app.use(
  cors({
    // origin: [
    //   "http://192.168.1.147:5173",
    //   "http://localhost:3000",
    //   "http://10.242.186.236:5173",
    // ],
    // credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// const oneDay = 1000 * 60 * 60 * 24;
// app.use(
//   sessions({
//     secret: "SecretksdpAlsmdxpjksdZKeySKNXkznskjd",
//     resave: false,
//     saveUninitialized: true,
//     cookie: {
//       maxAge: oneDay,
//       sameSite: "none",
//       secure: true,
//       domain: "localhost:3600",
//     },
//   })
// );
// app.use(cookieParser());

// METODOS GET
// Ruta de prueba
app.get("/prueba", (req, res) => {
  res.send("<h1>Hello World!! </h1>");
});
// Obtener las carreras administradas ya sea por un Jefe de Carrera (jc) o un Director de Area (da)
app.get("/carrera", (req, res) => {
  const params = req.query;
  // console.log(params)
  if (connectedSessions.indexOf(params.key) === -1) {
    res.send({ logout: 1 });
    return;
  }
  const col = params.cargo_adm === "jc" ? "jc_rut" : "da_rut";
  const sql = `select codigo, nombre from carrera where ${col} = ${params.rut}`;
  db.query(sql, async (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
      const planes = [];
      const listaCarreras = results.map(async (obj) => {
        const query = `select año anio from plan_estudio where idCarrera = ${obj.codigo}`;
        const results = await new Promise((resolve, reject) => {
          db.query(query, (error, results) => {
            if (error) reject(error);
            resolve(results);
          });
        });
        if (results.length > 0) {
          let planes_temp = results.map((row) => {
            return JSON.parse(JSON.stringify(row));
          });
          // console.log(planes_temp)
          planes.push({
            codigo: obj.codigo,
            planes: planes_temp,
          });
        } else {
          planes.push({
            codigo: obj.codigo,
            planes: [],
          });
        }
        return JSON.parse(JSON.stringify(obj));
      });
      const resolved = await Promise.all(listaCarreras);
      const response = {
        logout: 0,
        listaCarreras: resolved,
        planes,
      };
      res.json(response);
    }
  });
});

app.get("/malla", (req, res) => {
  const params = req.query;
  if (!params.carrera || !params.plan) {
    res.json({ error: "Hubo un error al obtener los datos" });
    return 0;
  }
  const sql = `select m.codigo, nombre, num_semestre numSemestre, max_bloques maxBloques, posicion pos 
  from malla m join ramo r 
  on (m.codigo = r.codigo and idCarrera = ${params.carrera} and año = ${params.plan})`;
  db.query(sql, (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
      const data = JSON.stringify(results);
      res.send(data);
    }
  });
});

app.get("/ubicaciones", (req, res) => {
  const query1 = "select * from departamento";
  const query2 = "select * from sala";
  const resultado = {};

  db.query(query1, (error, results1) => {
    if (error) throw error;
    resultado.depas = results1;
    db.query(query2, (error, results2) => {
      if (error) throw error;
      resultado.salas = results2;

      res.json(resultado);
    });
  });
});
// Ingresar bloques de horario, no usar
// app.get("/bloque", (req, res) => {
//   let sql = "INSERT INTO bloque(dia, n_bloque) VALUES ?";
//   let dia = ["lu", "ma", "mi", "ju", "vi"];
//   let bloques = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

//   let datos = [];
//   dia.forEach((d) => {
//     bloques.forEach((b) => {
//       datos.push([d, b]);
//     });
//   });

//   db.query(sql, [datos], (error, results, fields) => {
//     if (error) throw error;
//   });
//   console.log(datos);
// });

// METODOS POST
app.post("/login", (req, res) => {
  // mostrar("usuario necesitando acceso: " + req.body.rut);
  // const ip = req.headers.origin;
  // mostrar(ip ? ip: 'ip desconocida');
  let rut = parseInt(req.body.rut);
  let pass = crypto
    .createHash("sha256")
    .update(req.body.password)
    .digest("hex");
  db.query(
    `select rut, nombre, correo, cargo_adm from docente 
    where rut = ${rut} and password = '${pass}'`,
    (error, results) => {
      if (error) throw error;
      if (results.length > 0) {
        const data = JSON.stringify(results[0]);
        const key = encrypt(data).encryptedData;
        res.send({
          logeo: 1,
          data,
          key,
        });
        connectedSessions.push(key);
        // ip ? connectedDevices.push(ip) : "";
      } else {
        res.send({ logeo: 0 });
      }
    }
  );
});

// app.listen(PORT, (error) => {
//   const address = os.networkInterfaces()["Wi-Fi"][1].address;
//   if (error) {
//     console.log(error);
//   }
//   console.log("Servidor iniciado en http://localhost:" + PORT);
//   console.log(`Direcccion para comunicación en LAN: http://${address}:${PORT}`);
// });
const address_zero =
  os.networkInterfaces()["ZeroTier One [8286ac0e47e743dd]"][1].address;
app.listen(PORT, address_zero, () => {
  console.log(
    `Direcccion para comunicación en ZERO: http://${address_zero}:${PORT}`
  );
});
