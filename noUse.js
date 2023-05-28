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