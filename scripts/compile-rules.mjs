/**
 * Compila un file di regole contro l'emulatore Firestore e riporta gli errori.
 *
 * Uso:
 *   npx firebase emulators:exec --config firebase.json.tmp --only firestore \
 *     --project demo-pitchman-rules "node scripts/compile-rules.mjs firestore.rules.v2"
 *
 * Il compilatore delle rules e' severo e gli errori sono poco leggibili: dal
 * numero di riga si risale a una funzione, non al motivo. Poter passare un
 * frammento di regole e vederlo compilare vale piu' del tentativo a caso sul
 * file intero.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const path = process.argv[2] ?? 'firestore.rules.v2';
const rules = readFileSync(path, 'utf8');

let env;
try {
  env = await initializeTestEnvironment({
    projectId: 'demo-pitchman-rules',
    firestore: { rules },
  });
  console.log(`OK: ${path} compila (${rules.split('\n').length} righe)`);
} catch (error) {
  console.error(`FAIL: ${path}`);
  console.error(error?.message ?? error);
  process.exitCode = 1;
} finally {
  await env?.cleanup();
}