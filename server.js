const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');
const os = require('os');
const db = require('./db');
const app = express();
const api = express.Router();
app.use('/api', api);
const PORT = 3600;

const exQuery = query => {
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
const ADDQuery = (query, datos) => {
  return new Promise((resolve, reject) => {
    db.query(query, datos, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

function encrypt(text) {
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decrypt(text) {
  let iv = Buffer.from(text.iv, 'hex');
  let encryptedText = Buffer.from(text.encryptedData, 'hex');

  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}
// const connectedSessions = [];

// var cronJob = require("cron").CronJob;
// var job = new cronJob(
//   "5 * * * * *",
//   () => {
//     console.log(connectedSessions);
//   },
//   null,
//   true
// );

// job.start();

api.use(cors());

api.use(bodyParser.json());
api.use(bodyParser.urlencoded({ extended: false }));

// METODOS GET
// Ruta de prueba
api.get('/prueba', (req, res) => {
  res.send('<h1>Hello World!! </h1>');
});
// Obtener las carreras administradas ya sea por un Jefe de Carrera (jc) o un Director de Area (da)
api.get('/carrera', (req, res) => {
  const params = req.query;
  // console.log(params)
  // if (connectedSessions.indexOf(params.key) === -1) {
  //   res.send({ logout: 1 });
  //   return;
  // }
  const col = params.cargo_adm === 'JC' ? 'jc_rut' : 'da_rut';
  const sql = `select codigo, nombre from carrera where ${col} = ${params.rut}`;
  db.query(sql, async (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
      const planes = [];
      const listaCarreras = results.map(async obj => {
        const query = `select año anio from plan_estudio where idCarrera = ${obj.codigo}`;
        const results = await new Promise((resolve, reject) => {
          db.query(query, (error, results) => {
            if (error) reject(error);
            resolve(results);
          });
        });
        if (results.length > 0) {
          let planes_temp = results.map(row => {
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

api.get('/asignaciones-ramo', async(req, res) => {
  const params = req.query; 

  const res1 = await exQuery(`SELECT na.conteo, r.max_bloques FROM num_asignaciones na JOIN ramo r ON (na.codigo = r.codigo and na.codigo = '${params.codRamo}')`);
  res.send(res1[0]);
})

api.get('/malla', (req, res) => {
  const params = req.query;
  if (!params.carrera || !params.plan) {
    res.json({ error: 'Hubo un error al obtener los datos' });
    return 0;
  }
  const sql = `select m.codigo, nombre, num_semestre numSemestre, max_bloques maxBloques, posicion pos, na.conteo 
  from malla m join ramo r 
  on (m.codigo = r.codigo and idCarrera = ${params.carrera} and año = ${params.plan})
  join num_asignaciones na on(m.codigo = na.codigo)`;
  db.query(sql, (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
      const data = JSON.stringify(results);
      res.send(data);
    }
  });
});

api.get('/ubicaciones', (req, res) => {
  const query1 = 'select * from departamento';
  const query2 = 'select * from sala';
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

api.get('/sala', async (req, res) => {
  try {
    const params = req.query;
    // Consulta para saber el numero de bloques por dia, suponiendo que todos los dias tienen la misma cantidad de bloques
    const query_max = 'SELECT MAX(n_bloque) num FROM bloque';
    const bpd = (await exQuery(query_max))[0].num;

    // Consulta para obtener horario de la Sala
    const queryAsign = `select a.ramo cod_ramo, a.grupo, bl.num_dia, bl.n_bloque, d.nombre docente, r.nombre ramo from asignacion a join bloque bl on (a.sala = ${params.sala} and a.bloque = bl.idBloque)
    join docente d on(d.rut = a.docente_rut) join ramo r on (a.ramo = r.codigo) order by bl.num_dia, bl.n_bloque`;
    const res1 = await exQuery(queryAsign);

    // Crear lista de asignaciones
    const asignaciones = Array.from(Array(bpd), _ => Array(5).fill(null));
    res1.forEach(e => {
      const obj = JSON.parse(JSON.stringify(e));
      asignaciones[obj.n_bloque - 1][obj.num_dia - 1] = {
        valido: true,
        ...obj,
      };
    });
    const results = { bpd, asignaciones };
    res.json(results);
  } catch (error) {
    console.error('Error al ejecutar las consultas', error);
    res.status(500).json({ error: 'Error al ejecutar ls consultas' });
  }
});
api.get('/getprofesores', async (req, res) => {
  try {
    const ramoEscogido = req.query.ramoEscogido;
    const query = `select d.rut, d.nombre from docente d join imparte i on (d.rut = i.rut and i.ramo = '${ramoEscogido}')`;
    const data = await exQuery(query);
    res.send(data);
  } catch (error) {
    console.error('Error al ejecutar las consultas', error);
    res.status(500).json({ error: 'Error al ejecutar ls consultas' });
  }
});

api.get('/all-profesores', async (req, res) => {
  try {
    const query = 'SELECT rut, nombre FROM docente';
    const response = await exQuery(query);
    res.json({ arrayDocentes: response });
  } catch (error) {
    console.log('Error in /all-profesores API URL', error);
    res.status(500).json({ error: 'Error al ejecutar ls consultas' });
  }
});
api.get('/horario-docente', async (req, res) => {
  try {
    const params = req.query;
    // Consulta para saber el numero de bloques por dia, suponiendo que todos los dias tienen la misma cantidad de bloques
    const query_max = 'SELECT MAX(n_bloque) num FROM bloque';
    const bpd = (await exQuery(query_max))[0].num;

    // Consulta para obtener horario de la Sala
    const queryAsign = `select a.ramo cod_ramo, bl.num_dia, bl.n_bloque, r.nombre ramo, a.grupo, s.nombre sala from asignacion a join sala s on (a.docente_rut = ${params.rutDocente} and a.sala = s.idSala) join bloque bl on(bl.idBloque = a.bloque) join ramo r on(a.ramo = r.codigo)`;
    const res1 = await exQuery(queryAsign);

    // Crear lista de asignaciones
    const asignaciones = Array.from(Array(bpd), _ => Array(5).fill(null));
    res1.forEach(e => {
      const obj = JSON.parse(JSON.stringify(e));
      asignaciones[obj.n_bloque - 1][obj.num_dia - 1] = {
        valido: true,
        ...obj,
      };
    });
    const results = { bpd, asignaciones };
    res.json(results);
  } catch (error) {
    console.error('Error /horario-docente API URL', error);
    res.status(500).json({ error: 'Error al ejecutar ls consultas' });
  }
});

const deleteNulls = object => {
  return Object.keys(object).reduce((acumulator, key) => {
    if (object[key] != null) {
      acumulator[key] = object[key];
    }
    return acumulator;
  }, {});
};

api.get('/disponibilidad-docente', async (req, res) => {
  try {
    const params = req.query;
    // Consulta para saber el numero de bloques por dia, suponiendo que todos los dias tienen la misma cantidad de bloques
    const query_max = 'SELECT MAX(n_bloque) num FROM bloque';
    const bpd = (await exQuery(query_max))[0].num;

    // Consulta para obtener horario de Disponibilidad del Profesor
    const queryAsign = `SELECT d.usado, bl.n_bloque, bl.num_dia, a.ramo cod_ramo, a.grupo, r.nombre ramo, s.nombre sala FROM disponible d JOIN bloque bl ON (d.docente_rut = ${params.rutDocente} and d.idBloque = bl.idBloque)
    LEFT JOIN asignacion a ON (d.idBloque = a.bloque and d.docente_rut = a.docente_rut) LEFT JOIN ramo r ON (a.ramo = r.codigo) LEFT JOIN sala s ON (s.idSala = a.sala)`;
    const res1 = await exQuery(queryAsign);

    // Crear lista de asignaciones
    const asignaciones = Array.from(Array(bpd), _ => Array(5).fill(null));
    res1.forEach(e => {
      let obj_dispo = JSON.parse(JSON.stringify(e));
      if (!obj_dispo.usado) {
        obj_dispo = deleteNulls(obj_dispo);
      }
      asignaciones[obj_dispo.n_bloque - 1][obj_dispo.num_dia - 1] = {
        ...obj_dispo,
      };
    });
    const results = { asignaciones };
    res.json(results);
  } catch (error) {
    console.error('Error /disponibilidad-docente API URL', error);
    res.status(500).json({ error: 'Error al ejecutar ls consultas' });
  }
});

// METODOS POST
api.post('/login', (req, res) => {
  let rut = parseInt(req.body.rut);
  let pass = crypto
    .createHash('sha256')
    .update(req.body.password)
    .digest('hex');
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
        // connectedSessions.push(key);
        // ip ? connectedDevices.push(ip) : "";
      } else {
        res.send({ logeo: 0 });
      }
    }
  );
});
api.post('/asignacion', async (req, res) => {
  const data = req.body;
  // Obtener ID del bloque dependiendo del dia y bloque
  const lista_bloques = data.bloques.map(
    bloque => `(${bloque.dia}, ${bloque.bloque})`
  );
  const sql1 = `select idBloque from bloque where (num_dia, n_bloque) in (${lista_bloques.join(
    ','
  )})`;
  const lista_idBloques = (await exQuery(sql1)).map(bloque => bloque.idBloque);

  // Construir lista de asignaciones
  const grupo = 'A'; //Grupo de Ejemplo
  const query_asignaciones = lista_idBloques.map(bloque => [
    data.codigoRamo,
    data.salaRef.sala,
    bloque,
    data.profesor,
    grupo,
  ]);
  const sql2 =
    'insert into asignacion(ramo, sala, bloque, docente_rut, grupo) values ?';
  db.query(sql2, [query_asignaciones], (err, result) => {
    if (err) throw err;
    console.log(
      `Number of records inserted for ${data.codigoRamo} subject: ${result.affectedRows}`
    );
    res.json({ res: 'ASIGNACIÓN REALIZADA CON EXITO' });
  });
});

api.post('/actualizar-disponibilidad', async (req, res) => {
  const { bloquesAgreg, bloquesElim, rutDocente } = req.body;

  // Agregar disponibilidad
  if (bloquesAgreg.length > 0) {
    // Obtener ID de bloques para INSERT
    const listBloquesAdd = bloquesAgreg.map(
      bloque => `(${bloque.dia}, ${bloque.bloque})`
    );
    const sql1 = `select idBloque from bloque where (num_dia, n_bloque) in (${listBloquesAdd.join(
      ','
    )})`;
    const listIdBloquesAdd = (await exQuery(sql1)).map(
      bloque => bloque.idBloque
    );
    // ------------------
    const datosAdd = listIdBloquesAdd.map(idBloque => [
      rutDocente,
      idBloque,
      0,
    ]);
    const addSql = `INSERT INTO disponible(docente_rut, idBloque, usado) VALUES ?`;
    const res1 = await ADDQuery(addSql, [datosAdd]);
    console.log('Filas insertadas:', res1.affectedRows);
  }
  // Eliminar disponibilidad
  if (bloquesElim.length > 0) {
    // ------ Obtener ID de bloques
    const listBloquesDelete = bloquesElim.map(
      bloque => `(${bloque.dia}, ${bloque.bloque})`
    );
    const sql2 = `select idBloque from bloque where (num_dia, n_bloque) in (${listBloquesDelete.join(
      ','
    )})`;
    const listIdBloquesDelete = (await exQuery(sql2)).map(
      bloque => bloque.idBloque
    );
    // ------------------
    const datosDelete = listIdBloquesDelete.map(
      idBloque => `(${rutDocente}, ${idBloque})`
    );
    const deleteSql = `DELETE FROM disponible WHERE (docente_rut, idBloque) IN (${datosDelete.join(',')})`;
    
    const res2 = await exQuery(deleteSql);
    console.log('Filas eliminadas:', res2.affectedRows);
  }

  res.status(200).send({ success: true });
});

// app.listen(PORT, error => {
//   const address = os.networkInterfaces()['Wi-Fi'][1].address;
//   if (error) {
//     console.log(error);
//   }
//   console.log('Servidor iniciado en http://localhost:' + PORT + '/api');
//   console.log(
//     `Direcccion para comunicación en LAN: http://${address}:${PORT}/api`
//   );
// });

const address_zero =
  os.networkInterfaces()['ZeroTier One [8286ac0e47e743dd]'][1].address;
app.listen(PORT, address_zero, () => {
  console.log(
    `Direcccion para comunicación en ZERO: http://${address_zero}:${PORT}/api`
  );
});
