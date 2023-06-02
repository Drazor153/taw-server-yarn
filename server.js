const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const cors = require("cors");
const os = require("os");
const db = require("./db");
const { error } = require("console");
const app = express();
const PORT = 3600;

const exQuery = (query) => {
  return new Promise((resolve, reject) => {
    db.query(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

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

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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

app.get("/sala", async (req, res) => {
  try {
    const params = req.query;
    // Consulta para saber el numero de bloques por dia, suponiendo que todos los dias tienen la misma cantidad de bloques
    const query_max = "SELECT MAX(n_bloque) num FROM bloque";
    const bpd = (await exQuery(query_max))[0].num;

    // Consulta para obtener horario de la Sala
    const queryAsign = `select a.ramo cod_ramo, a.grupo, bl.num_dia, bl.n_bloque, d.nombre docente, r.nombre ramo from asignacion a join bloque bl on (a.sala = ${params.sala} and a.bloque = bl.idBloque)
    join docente d on(d.rut = a.docente_rut) join ramo r on (a.ramo = r.codigo) order by bl.num_dia, bl.n_bloque`;
    const res1 = await exQuery(queryAsign);

    // Crear lista de asignaciones
    const asignaciones = Array.from(Array(bpd), (_) =>
      Array(5).fill({ valido: false })
    );
    res1.forEach((e) => {
      const obj = JSON.parse(JSON.stringify(e));
      asignaciones[obj.n_bloque - 1][obj.num_dia - 1] = {
        valido: true,
        ...obj,
      };
    });
    const results = { bpd, asignaciones };
    res.json(results);
  } catch (error) {
    console.error("Error al ejecutar las consultas", error);
    res.status(500).json({ error: "Error al ejecutar ls consultas" });
  }
});

// METODOS POST
app.post("/login", (req, res) => {
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

app.listen(PORT, (error) => {
  const address = os.networkInterfaces()["Wi-Fi"][1].address;
  if (error) {
    console.log(error);
  }
  console.log("Servidor iniciado en http://localhost:" + PORT);
  console.log(`Direcccion para comunicación en LAN: http://${address}:${PORT}`);
});

// const address_zero =
//   os.networkInterfaces()["ZeroTier One [8286ac0e47e743dd]"][1].address;
// app.listen(PORT, address_zero, () => {
//   console.log(
//     `Direcccion para comunicación en ZERO: http://${address_zero}:${PORT}`
//   );
// });
