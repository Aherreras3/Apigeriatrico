const pool = require('../db');
const { handlePgError } = require('../utils/handle-error');

const obtenerNivelesPorSeccion = async (req, res) => {
  const { idSeccion } = req.params;
  try {
    // Usamos tu función almacenada y filtramos por geriátrico activo
    // La función devuelve (id_nivel, nombre, ejercicios_count)
    // Filtramos por id_geriatrico para respetar el tenant actual.
    const sql = `
      SELECT t.id_nivel, t.nombre, t.ejercicios_count
      FROM public.obtener_niveles_conteo($1) AS t
      JOIN public.nivel n ON n.id_nivel = t.id_nivel
      WHERE n.id_geriatrico = $2
      ORDER BY t.id_nivel
    `;
    const { rows } = await pool.query(sql, [idSeccion, req.geriatricoId]);
    return res.status(200).json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener niveles por sección');
  }
};

const crearNivel = async (req, res) => {
  const { id_seccion } = req.body;
  const idG = req.geriatricoId;
  if (!idG) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM nivel WHERE id_seccion = $1 AND id_geriatrico = $2',
      [id_seccion, idG]
    );

    const cantidad = parseInt(result.rows[0].count, 10);
    if (cantidad >= 3) {
      return res.status(400).json({ error: 'Solo se pueden crear hasta 3 niveles por sección.' });
    }

    const siguienteNumero = cantidad + 1;
    const nombre = `Nivel ${siguienteNumero}`;

    const nuevoNivel = await pool.query(
      'INSERT INTO nivel (nombre, id_seccion, id_geriatrico) VALUES ($1, $2, $3) RETURNING *',
      [nombre, id_seccion, idG]
    );

    res.status(201).json(nuevoNivel.rows[0]);
  } catch (err) {
    return handlePgError(res, err, 'Error al crear nivel');
  }
};

const obtenerNiveles = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM nivel WHERE id_geriatrico = $1 ORDER BY id_nivel',
      [req.geriatricoId]
    );
    res.status(200).json(resultado.rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener niveles');
  }
};

const eliminarNivel = async (req, res) => {
  const { idNivel } = req.params;
  const idSeccion = req.body.idSeccion ?? req.query.seccion;

  if (!idNivel || !idSeccion) {
    return res.status(400).json({ error: 'Faltan parámetros: idNivel y idSeccion' });
  }

  try {
    // SP que elimina ejercicios + nivel (según tu implementación)
    await pool.query('CALL eliminar_nivel_con_ejercicios($1, $2)', [parseInt(idNivel, 10), parseInt(idSeccion, 10)]);
    // sanity por si el SP no filtra por geriátrico
    await pool.query('DELETE FROM nivel WHERE id_nivel = $1 AND id_geriatrico <> $2', [idNivel, req.geriatricoId]);

    res.status(200).json({ mensaje: 'Nivel eliminado correctamente' });
  } catch (err) {
    return handlePgError(res, err, 'Error al eliminar nivel');
  }
};

module.exports = { obtenerNiveles, obtenerNivelesPorSeccion, crearNivel, eliminarNivel };
