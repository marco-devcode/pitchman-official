/**
 * Il registro delle collection di stagione deve stare al passo col codice.
 *
 * Il difetto che questo file blocca non si vede nel momento in cui lo si
 * introduce: si vede quando un utente scarica i propri dati e una raccolta
 * non c'e' nel file. L'export (`account/export`) legge UNA collection alla
 * volta dal registro e non ha modo di sapere cosa non sta guardando: una
 * collection nuova usata dal codice e non registrata semplicemente non
 *appears nell'export, senza un errore e senza un sintomo.
 *
 * Il test confronta i due elenchi in due direzioni, perche' i due errori hanno
 * sintomi opposti:
 *
 *   1. Nel CODICE c'e' una collection che nel REGISTRO non c'e' ("usata non
 *      registrata"): l'export la omette.
 *   2. Nel REGISTRO c'e' una collection che nel CODICE non c'e' ("registrata
 *      non usata"): l'export promette di esportare una cartella che non
 *      esiste, e finche' la voce resta li' nessuno si sente autorizzato a
 *      toglierla, perche' non si sa se qualche account ha documenti dentro.
 *
 * Il secondo caso e' il motivo per cui la direzione inversa non e' "solo
 * igiene": e' il controllo che rende sicuro fare pulizia.
 *
 * NOTA SULLA CANCELLAZIONE. Questo registro NON e' cio' che rende completa la
 * cancellazione dell'account: `account/delete` usa `recursiveDelete` sul
 * documento stagione, che porta via ogni sottocollection registrata o no.
 * Se qualcuno legge questo test come la garanzia del pulsante "Elimina
 * account", sta leggendo il file sbagliato.
 *
 * Il pattern di scansione e' volutamente grezzo e mostra anche i falsi
 * positivi: sono esclusi a mano, e ognuno ha una riga sotto con il motivo. Un
 * pattern piu' intelligente che perda un path silenziosamente varrebbe peggio
 * di uno che ne segnala uno in piu'.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  SEASON_COLLECTION_PATHS,
  SEASON_COLLECTIONS,
  isSeasonCollection,
} from './season-collections';

const ROOT = join(__dirname, '..');

/**
 * Sottocartelle scansionate. `app` e' inclusa perche' le route admin leggono
 * squadre; `store` perche' i path sono scritti anche li'.
 */
const CARTELLE = ['lib', 'store', 'app', 'components', 'hooks', 'services'];

/** File in cui il pattern non vale, con il motivo per cui si esclude. */
const ESCLUSI: Record<string, string> = {
  'season-collections.ts':
    "e' il registro stesso: qui i path sono nomi di collection, non un percorso teams/{seasonId}/X",
  'season-collections.test.ts':
    "contiene i path come stringhe di aspettativa, non come scritture reali",
};

function* fileSorgente(sub: string): Generator<{ path: string; testo: string }> {
  const radice = join(ROOT, sub);
  for (const name of readdirSync(radice)) {
    const path = join(radice, name);
    if (statSync(path).isDirectory()) {
      yield* fileSorgente(join(sub, name));
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) {
      if (ESCLUSI[name] !== undefined) continue;
      yield { path, testo: readFileSync(path, 'utf8') };
    }
  }
}

/**
 * Path di stagione scritti come argomenti di `collection(...)`.
 *
 * `collection(db, 'teams', seasonId, 'players')` e la forma usata dai
 * repository. Il nome della collection e' il quarto argomento.
 *
 * Nota sul flag `g`: qui si usa `exec` in loop e non `String.match`, perche'
 * `match` con `/g` restituisce i match COMPLETI e non i gruppi catturati —
 * un test che scriveva le chiavi sbagliate sembrava pero' funzionare.
 */
const PATH_LITERAL =
  /collection\(\s*(?:db|getFirestore\(\))\s*,\s*['"`]teams['"`]\s*,\s*[A-Za-z_$][\w$]*\s*,\s*['"`]([A-Za-z][A-Za-z0-9]*)['"`]/g;

/**
 * Path costruiti a mano dalle route admin:
 * `adminDb.collection('teams').doc(seasonId).collection('scouts')`.
 *
 * Non sono un argomento in posizione fissa, quindi il pattern sopra non li
 * vede. Sono le due rotte che contano di piu' (export e health), e lasciare
 * fuori proprio queste sarebbe il difetto piu' possibile.
 */
const PATH_A_CATENA =
  /\.collection\(\s*['"`]teams['"`]\s*\)\s*\.doc\([^)]*\)\s*\.collection\(\s*['"`]([A-Za-z][A-Za-z0-9]*)['"`]/g;

/**
 * Path aperti da `doc(...)` invece che da `collection(...)`.
 *
 * `aggregates` e' scritta cosi': `doc(db, 'teams', seasonId, 'aggregates',
 * 'leaderboards', 'current', 'data')` punta a un documento dentro la
 * collection, quindi la collection e' il quarto argomento ma non c'e' un
 * `collection()` che la nomini. Senza questo pattern la voce `aggregates`
 * sembrerebbe non usata da nessuno, che e' il falso positivo che ha fatto
 * fallire questo test alla prima stesura.
 */
const PATH_TRAMITE_DOC =
  /\bdoc\(\s*(?:db|getFirestore\(\)|adminDb)\s*,\s*['"`]teams['"`]\s*,\s*[A-Za-z_$][\w$]*\s*,\s*['"`]([A-Za-z][A-Za-z0-9]*)['"`]/g;

function collectionUsateNelCodice(): Map<string, string[]> {
  const trovate = new Map<string, string[]>();

  const segna = (nome: string, file: string, riga: number) => {
    const fuori = trovate.get(nome) ?? [];
    fuori.push(`${file}:${riga}`);
    trovate.set(nome, fuori);
  };

  for (const sub of CARTELLE) {
    for (const { path, testo } of fileSorgente(sub)) {
      const relative = path.replace(ROOT, 'src');
      testo.split('\n').forEach((riga, i) => {
        for (const pattern of [PATH_LITERAL, PATH_A_CATENA, PATH_TRAMITE_DOC]) {
          pattern.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = pattern.exec(riga)) !== null) {
            segna(m[1], relative, i + 1);
          }
        }
      });
    }
  }
  return trovate;
}

describe('registro delle collection di stagione', () => {
  const usate = collectionUsateNelCodice();

  it('la scansione trova le collection note (il pattern non e\' rotto)', () => {
    // Se il pattern smette di reggere, il resto dei test passa perche' non
    // trova niente: un guard che verifica se il guard funziona. Il riferimento
    // e' la raccolta piu' referenziata del repo.
    expect([...usate.keys()]).toContain('players');
    expect([...usate.keys()]).toContain('matches');
    // E una che esiste solo nella forma a catena delle route admin.
    expect([...usate.keys()]).toContain('scouts');
  });

  it('non ha path duplicati', () => {
    const visti = new Set<string>();
    const doppi: string[] = [];
    for (const c of SEASON_COLLECTIONS) {
      if (visti.has(c.path)) doppi.push(c.path);
      visti.add(c.path);
    }
    expect(doppi).toEqual([]);
  });

  it('ogni voce ha una nota che spiega cosa si perde senza di lei', () => {
    // Una voce senza nota e' una voce che nessuno sa perche' esiste: il primo
    // che la tocca la cancella insieme a una riga dell'export che sparisce.
    for (const c of SEASON_COLLECTIONS) {
      expect((c.note ?? '').length).toBeGreaterThan(10);
    }
  });

  it('isSeasonCollection risponde per tutte le voci', () => {
    for (const c of SEASON_COLLECTIONS) {
      expect(isSeasonCollection(c.path)).toBe(true);
    }
    expect(isSeasonCollection('collezioneCheNonEsiste')).toBe(false);
  });

  it('ogni collection usata nel codice e\' registrata', () => {
    const mancanti: string[] = [];
    for (const [nome, posti] of usate) {
      if (!SEASON_COLLECTION_PATHS.includes(nome)) {
        mancanti.push(`${nome} — usata in ${posti.slice(0, 3).join(', ')}`);
      }
    }
    // Il messaggio porta i file: "manca una collection" da solo fa perdere il
    // pomeriggio a chi non sa dove guardare.
    expect(mancanti).toEqual([]);
  });

  it('ogni voce registrata e\' usata dal codice, o dichiarata legacy', () => {
    const legacy = new Set(
      SEASON_COLLECTIONS.filter((c) => c.legacyDaVerificare).map((c) => c.path),
    );
    // Non si puo' affermare che una collection legacy sia vuota senza accesso
    // ai dati, quindi la direzione inversa accetta due uscite: usata dal
    // codice, oppure dichiarata legacy con la condizione di rimozione scritta.
    // Quello che non passa e' una voce che non serve a nessuno e non lo sa.
    const ingiustificate = SEASON_COLLECTION_PATHS.filter(
      (n) => !usate.has(n) && !legacy.has(n),
    );
    expect(ingiustificate).toEqual([]);
  });

  it('ogni voce legacy dichiara la condizione per rimuoverla', () => {
    for (const c of SEASON_COLLECTIONS.filter((x) => x.legacyDaVerificare)) {
      // La nota deve dire come si verifica, non solo che il codice non la
      // tocca: altrimenti la voce resta l'i' con la spiegazione del perche'
      // esiste e nessuno sa se toglierla.
      expect(c.note).toMatch(/Admin SDK|verificat/i);
      expect(c.note.length).toBeGreaterThan(60);
    }
  });
});
