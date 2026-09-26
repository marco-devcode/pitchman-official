/**
 * Single source of truth for jersey numbers based on tactical positions.
 */

export const FORMATION_NUMBERS: Record<string, number[]> = {
  "4-4-2": [1, 3, 4, 5, 2, 11, 6, 8, 7, 9, 10], 
  "4-3-3": [1, 3, 4, 5, 2, 8, 6, 10, 11, 9, 7], 
  "3-5-2": [1, 4, 5, 6, 3, 11, 8, 7, 2, 9, 10], 
  "4-2-3-1": [1, 3, 4, 5, 2, 6, 8, 11, 10, 7, 9], 
  "3-4-2-1": [1, 4, 5, 6, 3, 8, 11, 2, 7, 10, 9], 
  "3-4-1-2": [1, 4, 5, 6, 3, 8, 11, 2, 7, 10, 9],
  "4-3-1-2": [1, 3, 4, 5, 2, 8, 6, 7, 10, 9, 11],
  // Mancava del tutto: senza questa riga getJerseyNumber ricadeva sui numeri
  // del 4-4-2, assegnando a un 3-4-3 magliette identiche a un'altra formazione.
  "3-4-3": [1, 4, 5, 6, 3, 8, 11, 2, 7, 9, 10]
};

export const FORMATION_POSITIONS: Record<string, string[]> = {
  "4-4-2": ["POR", "TS", "DC", "DC", "TD", "AS", "CS", "CD", "AD", "ATT", "ATT"],
  "4-3-3": ["POR", "TS", "DC", "DC", "TD", "CS", "CDC", "CD", "AS", "ATT", "AD"],
  // 3-5-2: cinque di centro. CS sta a SINISTRA, CD a DESTRA, CDC al centro.
  // Era "CD, CDC, CS": scambiati i due laterali, quindi il sinistro mostrava
  // CD e il destro mostrava CS. Stessa classe di errore del 4-3-1-2, ma
  // invertita: la coppia era al posto giusto solo per la posizione centrale.
  "3-5-2": ["POR", "DC", "DC", "DC", "ASA", "CS", "CDC", "CD", "ADA", "ATT", "ATT"],
  "4-2-3-1": ["POR", "TS", "DC", "DC", "TD", "CS", "CD", "AS", "TRQ", "AD", "ATT"],
  "3-4-2-1": ["POR", "DC", "DC", "DC", "ASA", "CS", "CD", "ADA", "TRQ", "TRQ", "ATT"],
  "3-4-3": ["POR", "DC", "DC", "DC", "ASA", "CS", "CD", "ADA", "AS", "ATT", "AD"],
  "3-4-1-2": ["POR", "DC", "DC", "DC", "ASA", "CS", "CD", "ADA", "TRQ", "ATT", "ATT"],
  // 4-3-1-2: tre centrali. Il mediano (CDC) sta davanti alla difesa, gli
  // altri due sono laterali: sinistro a sinistra (CS), destro a destra (CD).
  // Era "CS, CD, CS": due CS e un CD decentrato, che e' esattamente il
  // difetto segnalato (manca il CDC davanti alla difesa, e il ruolo di
  // destra finiva sul centrocampo destro invece che su quello destro).
  "4-3-1-2": ["POR", "TS", "DC", "DC", "TD", "CS", "CDC", "CD", "TRQ", "ATT", "ATT"]
};

export const FORMATION_COORDINATES: Record<string, { top: number, left: number }[]> = {
  "4-4-2": [
    { top: 90, left: 50 }, // POR
    { top: 72, left: 15 }, { top: 72, left: 38 }, { top: 72, left: 62 }, { top: 72, left: 85 }, // Difesa
    { top: 45, left: 15 }, { top: 45, left: 38 }, { top: 45, left: 62 }, { top: 45, left: 85 }, // Centrocampo
    { top: 18, left: 35 }, { top: 18, left: 65 } // Attacco
  ],
  "4-3-3": [
    { top: 90, left: 50 },
    { top: 72, left: 15 }, { top: 72, left: 38 }, { top: 72, left: 62 }, { top: 72, left: 85 },
    { top: 48, left: 25 }, { top: 55, left: 50 }, { top: 48, left: 75 },
    { top: 22, left: 20 }, { top: 15, left: 50 }, { top: 22, left: 80 }
  ],
  "3-5-2": [
    { top: 90, left: 50 },
    { top: 72, left: 25 }, { top: 75, left: 50 }, { top: 72, left: 75 },
    { top: 48, left: 12 }, { top: 48, left: 32 }, { top: 55, left: 50 }, { top: 48, left: 68 }, { top: 48, left: 88 },
    { top: 18, left: 38 }, { top: 18, left: 62 }
  ],
  "4-2-3-1": [
    { top: 90, left: 50 },
    { top: 72, left: 15 }, { top: 72, left: 38 }, { top: 72, left: 62 }, { top: 72, left: 85 },
    { top: 55, left: 38 }, { top: 55, left: 62 },
    { top: 35, left: 20 }, { top: 35, left: 50 }, { top: 35, left: 80 },
    { top: 12, left: 50 }
  ],
  "3-4-2-1": [
    { top: 90, left: 50 },
    { top: 72, left: 25 }, { top: 75, left: 50 }, { top: 72, left: 75 },
    { top: 50, left: 12 }, { top: 50, left: 38 }, { top: 50, left: 62 }, { top: 50, left: 88 },
    { top: 28, left: 35 }, { top: 28, left: 65 },
    { top: 12, left: 50 }
  ],
  "3-4-1-2": [
    { top: 90, left: 50 }, // POR
    { top: 72, left: 25 }, { top: 75, left: 50 }, { top: 72, left: 75 },
    { top: 50, left: 12 }, { top: 50, left: 38 }, { top: 50, left: 62 }, { top: 50, left: 88 },
    { top: 32, left: 50 },
    { top: 15, left: 35 }, { top: 15, left: 65 }
  ],
  // Mancava del tutto: senza questa riga getPositionCoordinates ricadeva sul
  // 4-4-2 e un 3-4-3 mostrava undici giocatori con la disposizione del
  // 4-4-2, con ASA/CD/CS/ADA al posto delle tre linee da quattro.
  "3-4-3": [
    { top: 90, left: 50 }, // POR
    { top: 72, left: 25 }, { top: 75, left: 50 }, { top: 72, left: 75 },
    { top: 50, left: 12 }, { top: 50, left: 38 }, { top: 50, left: 62 }, { top: 50, left: 88 },
    { top: 22, left: 20 }, { top: 15, left: 50 }, { top: 22, left: 80 }
  ],
  "4-3-1-2": [
    { top: 90, left: 50 }, // POR
    { top: 72, left: 15 }, { top: 72, left: 38 }, { top: 72, left: 62 }, { top: 72, left: 85 },
    { top: 55, left: 25 }, { top: 60, left: 50 }, { top: 55, left: 75 },
    { top: 35, left: 50 },
    { top: 15, left: 35 }, { top: 15, left: 65 }
  ]
};

export function getJerseyNumber(formation: string, index: number): number {
  const numbers = FORMATION_NUMBERS[formation] || FORMATION_NUMBERS["4-4-2"];
  return numbers[index] || (index + 1);
}

export function getSubstituteNumber(index: number): number {
  return index + 12;
}

export function getPositionAcronym(formation: string, index: number): string {
  const positions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS["4-4-2"];
  return positions[index] || "N/A";
}

export function getPositionCoordinates(formation: string, index: number): { top: number, left: number } {
  const coords = FORMATION_COORDINATES[formation] || FORMATION_COORDINATES["4-4-2"];
  return coords[index] || { top: 0, left: 0 };
}

/**
 * Lato atteso per i ruoli laterali. CS = centrocampista SINISTRO,
 * CD = centrocampista DESTRO. Va tenuto allineato a ROLE_LABELS in types.ts.
 */
const SIDE_ROLE: Record<string, 'SX' | 'DX'> = { CS: 'SX', CD: 'DX' };
const sideOf = (left: number) => (left < 40 ? 'SX' : left > 60 ? 'DX' : 'CTR');

/**
 * Invarianti delle tabelle formazione.
 *
 * Sono qui, e non in un test, perche' i fallimenti silenziosi di questo
 * file non si vedono: getJerseyNumber e getPositionCoordinates ricadono su
 * "4-4-2" quando la formazione manca, quindi una tabella incompleta non
 * crasha, disegna solo il campo sbagliato. E uno swap di CS/CD non genera
 * alcun errore di tipo, essendo entrambi PlayerRole validi.
 *
 * Rischia gia' avvenuto: 3-4-3 non aveva coordinate (ricadeva sul 4-4-2),
 * 4-3-1-2 aveva "CS, CD, CS" al posto di "CS, CDC, CD", e il 3-5-2 aveva
 * i due laterali invertiti.
 */
function assertFormationInvariants() {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return;

  for (const [formation, roles] of Object.entries(FORMATION_POSITIONS)) {
    const numbers = FORMATION_NUMBERS[formation];
    const coords = FORMATION_COORDINATES[formation];

    if (!numbers) {
      throw new Error(`[lineup-mapping] ${formation}: FORMATION_NUMBERS mancante, i numeri di maglia ricadono sul 4-4-2`);
    }
    if (!coords) {
      throw new Error(`[lineup-mapping] ${formation}: FORMATION_COORDINATES mancante, il campo viene disegnato con il 4-4-2`);
    }
    if (roles.length !== 11 || numbers.length !== 11 || coords.length !== 11) {
      throw new Error(`[lineup-mapping] ${formation}: attesi 11 slot, trovati roles=${roles.length} numbers=${numbers.length} coords=${coords.length}`);
    }

    roles.forEach((role, i) => {
      const expected = SIDE_ROLE[role];
      if (!expected) return;
      const actual = sideOf(coords[i].left);
      if (actual !== expected) {
        throw new Error(
          `[lineup-mapping] ${formation} slot ${i}: ruolo ${role} (${expected === 'SX' ? 'sinistro' : 'destro'}) ` +
          `ma la coordinata left=${coords[i].left} e' ${actual}`,
        );
      }
    });
  }
}

assertFormationInvariants();
