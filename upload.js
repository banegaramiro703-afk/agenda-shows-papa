const fs = require('fs');

const SUPABASE_URL = 'https://gcvjzmhlbiptqjtuydfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tglkpS_UxdhC8cLpNw9vTg_DSDzJC5k';

async function upload() {
    try {
        let rawData = fs.readFileSync('backup_shows.json', 'utf8');
        if (rawData.charCodeAt(0) === 0xFEFF) {
            rawData = rawData.slice(1);
        }
        const data = JSON.parse(rawData);

        const seenEventos = new Set();
        const cleanData = [];

        for (const item of data) {
            let eventoName = item.EVENTO.trim();
            // Handle duplicates
            let count = 1;
            let finalName = eventoName;
            while (seenEventos.has(finalName)) {
                finalName = `${eventoName} ${item.FECHA}`;
                if (seenEventos.has(finalName)) {
                     finalName = `${eventoName} ${item.FECHA} (${count})`;
                }
                count++;
            }
            seenEventos.add(finalName);

            cleanData.push({
                EVENTO: finalName,
                FECHA: item.FECHA,
                HORA: item.HORA,
                LUGAR: item.LUGAR || '',
                CONTACTO: item.CONTACTO || '',
                TELEFONO: item.TELEFONO || '',
                TOTAL: item.TOTAL ? item.TOTAL.toString() : '',
                PAGADO: item.PAGADO ? item.PAGADO.toString() : ''
            });
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/shows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(cleanData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error uploading data:', response.status, errorText);
        } else {
            console.log('Successfully uploaded', cleanData.length, 'records to Supabase.');
        }
    } catch (error) {
        console.error('Error in script:', error);
    }
}

upload();
