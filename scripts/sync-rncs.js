import { createClient } from '@supabase/supabase-js';
import unzipper from 'unzipper';
import iconv from 'iconv-lite';
import fetch from 'node-fetch';
import fs from 'fs';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback

const supabaseUrl = 'https://hkzgxdmnvyoviwketxva.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

const URL = 'https://dgii.gov.do/app/WebApps/Consultas/RNC/DGII_RNC.zip';

async function syncRNCs() {
  console.log("Iniciando descarga del archivo oficial de la DGII...");
  const res = await fetch(URL);
  
  if (!res.ok) {
    throw new Error(`Error descargando el archivo: ${res.statusText}`);
  }

  console.log("Descarga completada. Descomprimiendo y procesando...");
  
  return new Promise((resolve, reject) => {
    let count = 0;
    let batch = [];
    const BATCH_SIZE = 10000;
    
    // El zip contiene un archivo de texto, leemos el stream
    res.body.pipe(unzipper.Parse())
      .on('entry', function (entry) {
        const fileName = entry.path;
        if (fileName.endsWith('.TXT')) {
          console.log(`Procesando archivo: ${fileName}`);
          
          const rl = readline.createInterface({
            input: entry.pipe(iconv.decodeStream('iso-8859-1')),
            crlfDelay: Infinity
          });

          rl.on('line', async (line) => {
            const parts = line.split('|');
            if (parts.length >= 2) {
              const rnc = parts[0].replace(/[^0-9]/g, '');
              const name = parts[1].trim();
              
              if (rnc && name) {
                batch.push({ rnc, name });
              }

              if (batch.length >= BATCH_SIZE) {
                const currentBatch = [...batch];
                batch = []; // reset batch
                
                // Pausamos la lectura mientras subimos
                rl.pause();
                try {
                  const { error } = await supabase.from('dgii_rncs').upsert(currentBatch, { onConflict: 'rnc', ignoreDuplicates: false });
                  if (error) throw error;
                  count += currentBatch.length;
                  console.log(`Subidos ${count} registros a Supabase...`);
                } catch (e) {
                  console.error("Error subiendo bloque:", e);
                } finally {
                  rl.resume();
                }
              }
            }
          });

          rl.on('close', async () => {
            if (batch.length > 0) {
              try {
                await supabase.from('dgii_rncs').upsert(batch, { onConflict: 'rnc', ignoreDuplicates: false });
                count += batch.length;
                console.log(`Subidos ${count} registros finales.`);
              } catch (e) {
                console.error("Error subiendo bloque final:", e);
              }
            }
            console.log(`¡Proceso completado! Total sincronizados: ${count}`);
            resolve();
          });
        } else {
          entry.autodrain();
        }
      })
      .on('error', reject);
  });
}

syncRNCs().catch(console.error);
