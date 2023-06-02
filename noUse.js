// Ingresar bloques de horario, no usar
app.get("/bloque", (req, res) => {
  let sql = "INSERT INTO bloque(num_dia, dia, n_bloque) VALUES ?";
  let dia = [
    [1, "lu"],
    [2, "ma"],
    [3, "mi"],
    [4, "ju"],
    [5, "vi"],
  ];
  let bloques = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  let datos = [];
  dia.forEach((d) => {
    bloques.forEach((b) => {
      datos.push([d[0], d[1], b]);
    });
  });

  db.query(sql, [datos], (error, results, fields) => {
    if (error) throw error;
  });
  console.log(datos);
});
