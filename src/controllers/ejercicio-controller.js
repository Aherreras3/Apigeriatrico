// controllers/ejercicio-controller.js
const pool = require('../db');
const { handlePgError } = require('../utils/handle-error');

// ===== OpenAI: SOLO TEXTO (palabras) =====
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


async function generarConOpenAI({ tema, cantidad, nivel, prohibidas = [] }) {
  const reglasNivel = {
    1: `muy fáciles de pronunciar: 1–2 sílabas, máximo 6 letras, sin grupos consonánticos (bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, tr), sin dígrafos (ll, rr, ch), sin tildes.`,
    2: `dificultad media: 2–3 sílabas, 5–9 letras, permite un grupo consonántico o un dígrafo (ll, rr, ch), pocas tildes.`,
    3: `más complejas: 3 o más sílabas, 8–12 letras, se permiten tildes, dígrafos (ll, rr, ch) y grupos; pueden incluir “x”, “z” o “ñ” cuando sea natural.`,
  };

  const listaEvitar = prohibidas.length
    ? `Evita estas palabras (y variantes con mayúsculas/acentos/plurales): ${prohibidas.join(', ')}.`
    : '';

  const prompt = `
Genera ${cantidad} palabras en español (una por línea) relacionadas con "${tema}".
Aplica estas reglas estrictamente para el NIVEL ${nivel}:
- ${reglasNivel[nivel] || reglasNivel[2]}
- Solo la palabra final por línea (sin numeración ni guiones).
- Sin repeticiones ni plurales triviales del mismo término.
- No incluyas frases ni signos.
${listaEvitar}
`.trim();

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    messages: [
      { role: 'system', content: 'Eres un generador de ítems léxicos concisos en español.' },
      { role: 'user', content: prompt },
    ],
  });

  const text = completion.choices?.[0]?.message?.content || '';
  return text
    .split(/\r?\n/)
    .map(s => s.replace(/^\d+[\).\s-]+/, '').trim())
    .map(s => s.replace(/^[-•]\s*/, ''))
    .filter(Boolean);
}

//IMAGEN: helpers y normalización
function anyToBuffer(val) {
  if (!val) return null;
  if (Buffer.isBuffer(val)) return val;
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.startsWith('\\x') || s.startsWith('0x')) return Buffer.from(s.slice(2), 'hex'); // hex PG
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.replace(/\s+/g, '').length % 4 === 0) {
      try { return Buffer.from(s, 'base64'); } catch {}
    }
  }
  return null;
}
function detectImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  const h = buf.subarray(0, 12);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return 'image/png';
  if (h[0] === 0xFF && h[1] === 0xD8) return 'image/jpeg';
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) return 'image/gif';
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 && h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50) return 'image/webp';
  const head = buf.subarray(0, 200).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<svg')) return 'image/svg+xml';
  return null;
}
function extFromMime(mime) {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/svg+xml': return 'svg';
    default: return 'bin';
  }
}

//Normalización y heurísticas de dificultad (ES)
function normalizeJs(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
function syllablesEs(str) {
  const s = String(str || '').toLowerCase().replace(/qu|gu(?=[ei])/g, 'q');
  const grupos = s.match(/[aeiouáéíóúü]+/g);
  return grupos ? grupos.length : 1;
}
function scoreDificultadPron(str) {
  const s = String(str || '').toLowerCase();
  const len = s.length;
  const syl = syllablesEs(s);
  const hasTilde = /[áéíóú]/.test(s);
  const clusters = /(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|tr)/.test(s);
  const digraphs = /(rr|ll|ch|qu|gu(?=[ei]))/.test(s);
  const enhes = /ñ/.test(s);
  const ZX = /(x|z)/.test(s);
  let score = 0;
  if (len >= 7) score += 1;
  if (syl >= 3) score += 1;
  if (clusters) score += 1;
  if (digraphs) score += 1;
  if (hasTilde) score += 1;
  if (enhes) score += 1;
  if (ZX) score += 1;
  return score;
}
function fitsLevel(word, nivel) {
  const s = String(word || '');
  const len = s.length;
  const syl = syllablesEs(s);
  const score = scoreDificultadPron(s);
  if (nivel === 1) return len <= 6 && syl <= 2 && score <= 1 && !/[áéíóú]/.test(s);
  if (nivel === 2) return len >= 5 && len <= 9 && syl >= 2 && syl <= 3 && score >= 1 && score <= 3;
  return len >= 8 && len <= 12 && syl >= 3 && score >= 3; // nivel 3
}
function pickForLevel(words, nivel, need) {
  const set = new Set();
  const out = [];
  const pushIf = (pred) => {
    for (const w of words) {
      const nw = normalizeJs(w);
      if (!nw || set.has(nw)) continue;
      if (pred(w)) {
        set.add(nw);
        out.push(w.trim());
        if (out.length >= need) break;
      }
    }
  };
  // Estricto primero
  pushIf(w => fitsLevel(w, nivel));
  if (out.length >= need) return out;
  // Tolerancia
  if (nivel === 1) pushIf(w => scoreDificultadPron(w) <= 2 && syllablesEs(w) <= 2 && String(w).length <= 7);
  else if (nivel === 2) pushIf(w => scoreDificultadPron(w) >= 1 && scoreDificultadPron(w) <= 4);
  else pushIf(w => scoreDificultadPron(w) >= 2);
  return out.slice(0, need);
}

//CRUD / Endpoints
const crearEjercicio = async (req, res) => {
  const { id_test, tipo, estado, contenido, contenido_binario, id_nivel, id_seccion } = req.body;
  const id_usuario    = req.user?.id;
  const id_geriatrico = req.geriatricoId;

  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!id_usuario)    return res.status(401).json({ error: 'Sesión inválida' });
  if (!tipo || typeof estado !== 'boolean' || !id_seccion || !id_nivel) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const bin = contenido_binario ? Buffer.from(contenido_binario, 'base64') : null;

    const { rows } = await pool.query(
      `SELECT public.crear_ejercicio(
         $1::int, $2::varchar, $3::boolean, $4::text, $5::bytea,
         $6::int, $7::int, $8::int, $9::int
       ) AS id_ejercicio`,
      [
        id_test ?? null,
        tipo,
        estado,
        contenido ?? null,
        bin,
        id_nivel,
        id_seccion,
        id_usuario,
        id_geriatrico
      ]
    );

    return res.status(201).json({
      mensaje: 'Ejercicio creado correctamente',
      id_ejercicio: rows?.[0]?.id_ejercicio
    });
  } catch (err) {
    return handlePgError(res, err, 'Error al crear ejercicio');
  }
};

const obtenerEjerciciosPorSeccionYNivel = async (req, res) => {
  const { idSeccion, idNivel } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.obtener_ejercicios_ctx($1::int, $2::int, $3::int)`,
      [req.geriatricoId, idSeccion, idNivel]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener ejercicios');
  }
};

const obtenerEjerciciosResumen = async (req, res) => {
  const { idSeccion, idNivel } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.obtener_ejercicios_ctx_resumen($1::int, $2::int, $3::int)`,
      [req.geriatricoId, idSeccion, idNivel]
    );
    res.json(rows);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener ejercicios (resumen)');
  }
};

const obtenerEjercicioDetalle = async (req, res) => {
  const id_ejercicio  = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.obtener_ejercicio_detalle($1::int,$2::int)`,
      [id_ejercicio, id_geriatrico]
    );
    if (!rows?.length) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener detalle');
  }
};

const actualizarEjercicio = async (req, res) => {
  const id_ejercicio  = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;

  const {
    id_test,
    tipo,
    estado,
    contenido,
    id_nivel,
    id_seccion,
    contenido_binario_base64,
    eliminar_imagen
  } = req.body || {};

  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!id_ejercicio)  return res.status(400).json({ error: 'ID de ejercicio inválido' });
  if (!tipo || typeof estado !== 'boolean' || !id_seccion || !id_nivel) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar' });
  }

  try {
    let bin = null;
    let touchImage = false;
    if (typeof eliminar_imagen === 'boolean' || contenido_binario_base64) {
      touchImage = true;
      bin = eliminar_imagen === true ? null :
            (contenido_binario_base64 ? Buffer.from(contenido_binario_base64, 'base64') : null);
    }

    const { rows } = await pool.query(
      `SELECT public.actualizar_ejercicio(
         $1::int,  -- p_id_ejercicio
         $2::int,  -- p_id_geriatrico
         $3::int,  -- p_id_test
         $4::varchar,  -- p_tipo
         $5::boolean,  -- p_estado
         $6::text,     -- p_contenido
         $7::bytea,    -- p_contenido_binario
         $8::boolean,  -- p_touch_image
         $9::int,      -- p_id_nivel
         $10::int      -- p_id_seccion
       ) AS ok`,
      [
        id_ejercicio,
        id_geriatrico,
        (id_test ?? null),
        tipo,
        estado,
        (contenido ?? null),
        bin,
        touchImage,
        id_nivel,
        id_seccion
      ]
    );

    if (!rows?.[0]?.ok) return res.status(404).json({ error: 'Ejercicio no encontrado o sin cambios' });
    return res.json({ mensaje: 'Ejercicio actualizado' });
  } catch (err) {
    return handlePgError(res, err, 'Error al actualizar ejercicio');
  }
};

// ===== Generar por nivel y sin repetir en la misma sección (ningún nivel) =====
const generarEjercicios = async (req, res) => {
  const { tema, cantidad, id_nivel, id_seccion, tipo } = req.body;
  const id_usuario    = req.user?.id;
  const id_geriatrico = req.geriatricoId;

  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!id_usuario)    return res.status(401).json({ error: 'Sesión inválida' });
  if (!tema || !id_nivel || !id_seccion || !tipo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const LIM = 10;
  const qtyReq = Math.max(1, Math.min(LIM, Number(cantidad) || 1));

  try {
    // 1) Tope por nivel
    const { rows: cnt } = await pool.query(
      `SELECT public.contar_ejercicios_ctx($1::int,$2::int,$3::int) AS c`,
      [id_geriatrico, id_seccion, id_nivel]
    );
    const existentes = cnt?.[0]?.c ?? 0;
    const restante   = Math.max(0, LIM - existentes);
    if (restante <= 0) {
      return res.status(409).json({ error: `Límite de ${LIM} ejercicios alcanzado para este nivel.` });
    }
    const aGenerar = Math.min(qtyReq, restante);

    // 2) Palabras ya usadas en la sección (cualquier nivel) => prohibidas
    const { rows: prev } = await pool.query(
      `SELECT contenido FROM ejercicio
        WHERE id_geriatrico=$1 AND id_seccion=$2`,
      [id_geriatrico, id_seccion]
    );
    const usados = new Set(prev.map(r => normalizeJs(r.contenido)));

    // 3) Intentos de generación y filtrado por dificultad
    const elegidas = [];
    let rondas = 0;

    while (elegidas.length < aGenerar && rondas < 3) {
      rondas++;
      const prohibidas = Array.from(usados).slice(-200);
      const candidatas = await generarConOpenAI({
        tema,
        cantidad: aGenerar - elegidas.length + 4,
        nivel: Number(id_nivel),
        prohibidas
      });

      // Dedup + fuera de “usados”
      const nuevas = [];
      const vistosLocal = new Set();
      for (const w of candidatas) {
        const nw = normalizeJs(w);
        if (!nw || usados.has(nw) || vistosLocal.has(nw)) continue;
        vistosLocal.add(nw);
        nuevas.push(w);
      }

      const pick = pickForLevel(nuevas, Number(id_nivel), aGenerar - elegidas.length);
      for (const w of pick) {
        elegidas.push(w);
        usados.add(normalizeJs(w));
        if (elegidas.length >= aGenerar) break;
      }
    }

    if (!elegidas.length) {
      return res.status(422).json({ error: 'No se pudieron generar palabras adecuadas sin repetir.' });
    }

    const items = elegidas.map(w => ({
      contenido: String(w).slice(0, 255),
      tipo: tipo || 'texto',
      estado: true,
    }));

    const { rows } = await pool.query(
      `SELECT public.crear_ejercicios_bulk(
         $1::jsonb, $2::int, $3::int, $4::int, $5::int
       ) AS result`,
      [JSON.stringify(items), id_nivel, id_seccion, id_usuario, id_geriatrico]
    );

    const result = rows?.[0]?.result || {};
    return res.status(201).json({
      mensaje: `Se generaron ${result.insertados || 0} ejercicio(s) adecuados (máx ${LIM} por nivel).`,
      detalle: result
    });
  } catch (err) {
    return handlePgError(res, err, 'Error al generar ejercicios');
  }
};

const actualizarImagenEjercicio = async (req, res) => {
  const id_ejercicio  = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;
  const { contenido_binario_base64 } = req.body || {};

  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });
  if (!id_ejercicio)  return res.status(400).json({ error: 'ID de ejercicio inválido' });
  if (!contenido_binario_base64) return res.status(400).json({ error: 'Falta contenido_binario_base64' });

  try {
    const bin = Buffer.from(contenido_binario_base64, 'base64');
    const { rows } = await pool.query(
      `SELECT public.actualizar_imagen_ejercicio($1::int, $2::int, $3::bytea) AS ok`,
      [id_ejercicio, id_geriatrico, bin]
    );
    if (!rows?.[0]?.ok) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    return res.json({ mensaje: 'Imagen actualizada' });
  } catch (err) {
    return handlePgError(res, err, 'Error al actualizar imagen');
  }
};

// RAW (por si quieres binario directo) – normalmente usaremos HTML
const obtenerImagenEjercicio = async (req, res) => {
  const id_ejercicio  = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;
  try {
    const { rows } = await pool.query(
      `SELECT public.obtener_imagen_ejercicio($1::int,$2::int) AS img`,
      [id_ejercicio, id_geriatrico]
    );

    let bin = anyToBuffer(rows?.[0]?.img);
    if (!bin) return res.status(404).send('Sin imagen');

    const mime = detectImageMime(bin) || 'image/png';
    const ext  = extFromMime(mime);

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="ejercicio-${id_ejercicio}.${ext}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');

    return res.send(bin);
  } catch (err) {
    return handlePgError(res, err, 'Error al obtener imagen');
  }
};

// HTML wrapper para abrir SIEMPRE en pestaña (sin descarga)
const obtenerImagenEjercicioHTML = async (req, res) => {
  const id_ejercicio  = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;
  try {
    const { rows } = await pool.query(
      `SELECT public.obtener_imagen_ejercicio($1::int,$2::int) AS img`,
      [id_ejercicio, id_geriatrico]
    );

    let bin = anyToBuffer(rows?.[0]?.img);
    if (!bin) return res.status(404).send('Sin imagen');

    const mime = detectImageMime(bin) || 'image/png';
    const base64 = Buffer.from(bin).toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    return res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Imagen ejercicio ${id_ejercicio}</title>
<style>
  html,body{height:100%;margin:0;background:#111;}
  .wrap{height:100%;display:grid;place-items:center;}
  img{max-width:100vw;max-height:100vh;object-fit:contain;background:#222}
  .bar{position:fixed;top:0;left:0;right:0;padding:8px 12px;background:#0008;color:#fff;font:14px system-ui}
  .bar a{color:#9cf;margin-left:8px;text-decoration:none}
</style>
</head>
<body>
  <div class="bar">Imagen del ejercicio #${id_ejercicio}<a href="./raw" target="_blank" rel="noopener">Abrir original</a></div>
  <div class="wrap"><img src="${dataUrl}" alt="ejercicio ${id_ejercicio}"></div>
</body>
</html>`);
  } catch (err) {
    return handlePgError(res, err, 'Error al ver imagen (html)');
  }
};

const eliminarEjercicio = async (req, res) => {
  const id_ejercicio  = Number(req.params.id);
  const id_geriatrico = req.geriatricoId;
  if (!id_geriatrico) return res.status(400).json({ error: 'No hay geriátrico activo en la sesión' });

  try {
    const { rows } = await pool.query(
      `SELECT public.eliminar_ejercicio($1::int,$2::int) AS ok`,
      [id_ejercicio, id_geriatrico]
    );
    if (!rows?.[0]?.ok) return res.status(404).json({ error: 'No se pudo eliminar (o no existe / contexto inválido)' });
    return res.json({ mensaje: 'Ejercicio eliminado' });
  } catch (err) {
    return handlePgError(res, err, 'Error al eliminar ejercicio');
  }
};

module.exports = {
  crearEjercicio,
  obtenerEjerciciosPorSeccionYNivel,
  obtenerEjerciciosResumen,
  obtenerEjercicioDetalle,
  actualizarEjercicio,
  generarEjercicios,
  actualizarImagenEjercicio,
  obtenerImagenEjercicio,       // /:id/imagen/raw
  obtenerImagenEjercicioHTML,   // /:id/imagen/html (usar en front)
  eliminarEjercicio,
};
