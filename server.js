const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Conexion a PostgreSQL (Railway inyecta DATABASE_URL automaticamente)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middlewares
app.use(cors());
app.use(express.json());

// Servir index.html como pagina estatica
app.use(express.static(path.join(__dirname)));

// =============================================
// INICIALIZACION: Crear tabla si no existe
// =============================================
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS shows (
                id SERIAL PRIMARY KEY,
                "EVENTO" TEXT UNIQUE NOT NULL,
                "FECHA" TEXT,
                "HORA" TEXT,
                "LUGAR" TEXT,
                "CONTACTO" TEXT,
                "TELEFONO" TEXT,
                "TOTAL" TEXT DEFAULT '0',
                "PAGADO" TEXT DEFAULT '0',
                "ESTADO" TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Tabla shows lista.');
    } finally {
        client.release();
    }
}

// =============================================
// ENDPOINTS API
// =============================================

// GET /api/shows - Listar todos
app.get('/api/shows', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM shows ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error GET:', err.message);
        res.status(500).json({ error: 'Error al obtener shows' });
    }
});

// POST /api/shows - Crear nuevo
app.post('/api/shows', async (req, res) => {
    try {
        const { EVENTO, FECHA, HORA, LUGAR, CONTACTO, TELEFONO, TOTAL, PAGADO, ESTADO } = req.body;
        const result = await pool.query(
            `INSERT INTO shows ("EVENTO","FECHA","HORA","LUGAR","CONTACTO","TELEFONO","TOTAL","PAGADO","ESTADO")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [EVENTO, FECHA, HORA, LUGAR, CONTACTO, TELEFONO, TOTAL||'0', PAGADO||'0', ESTADO||'']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error POST:', err.message);
        res.status(500).json({ error: 'Error al crear show' });
    }
});

// PATCH /api/shows/:evento - Actualizar por nombre
app.patch('/api/shows/:evento', async (req, res) => {
    try {
        const evento = decodeURIComponent(req.params.evento);
        const campos = req.body;
        const keys = Object.keys(campos);
        if (keys.length === 0) return res.status(400).json({ error: 'No hay campos' });
        const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
        const values = keys.map(k => campos[k]);
        values.push(evento);
        const result = await pool.query(
            `UPDATE shows SET ${setClause} WHERE "EVENTO" = $${values.length} RETURNING *`,
            values
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error PATCH:', err.message);
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// DELETE /api/shows/:evento - Eliminar por nombre
app.delete('/api/shows/:evento', async (req, res) => {
    try {
        const evento = decodeURIComponent(req.params.evento);
        const result = await pool.query('DELETE FROM shows WHERE "EVENTO" = $1 RETURNING *', [evento]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ message: 'Eliminado' });
    } catch (err) {
        console.error('Error DELETE:', err.message);
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// POST /api/migrate - Migrar datos masivamente (uso unico)
app.post('/api/migrate', async (req, res) => {
    try {
        const shows = req.body;
        if (!Array.isArray(shows)) return res.status(400).json({ error: 'Se espera un array' });
        let insertados = 0, errores = 0;
        for (const show of shows) {
            try {
                await pool.query(
                    `INSERT INTO shows ("EVENTO","FECHA","HORA","LUGAR","CONTACTO","TELEFONO","TOTAL","PAGADO","ESTADO")
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT ("EVENTO") DO NOTHING`,
                    [show.EVENTO||'', show.FECHA||'', show.HORA||'', show.LUGAR||'', show.CONTACTO||'',
                     show.TELEFONO||'', show.TOTAL||'0', show.PAGADO||'0', show.ESTADO||show['ESTADO DE PAGO']||'']
                );
                insertados++;
            } catch(e) { errores++; console.error('Error migrando:', e.message); }
        }
        res.json({ message: `Migracion completa: ${insertados} insertados, ${errores} errores.` });
    } catch (err) {
        res.status(500).json({ error: 'Error en migracion' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Agenda Shows API' });
});

// =============================================
// ARRANCAR SERVIDOR
// =============================================
initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`API corriendo en puerto ${PORT}`);
    });
}).catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});

