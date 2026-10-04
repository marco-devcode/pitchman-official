import * as AIService from './ai.service';

/**
 * Questi test guardano il CONTRATTO verso `/api/ai/import`, non i flussi.
 *
 * Prima mockavano `chatbotFlow` e gli altri flussi Genkit e verificavano che il
 * service li chiamasse: era un test di una server action che non aveva nessun
 * controllo. Ora il service fa una `fetch` e la sequenza di guard sta nella
 * rotta, quindi il test utile e' un altro: qui si verifica che il client
 * mandi a `/api/ai/import` l'operazione giusta, con la stagione giusta, e che
 * trasformi un errore della rotta in un messaggio leggibile.
 *
 * Le regole (auth, membership, rate limit, cache, log costi) si testano sulla
 * rotta e sull'emulatore Firestore: vedi `firestore.rules.test.ts` e i test
 * nelle cartelle `route.test.ts` sotto `src/app/api`.
 */

const rispostaJson = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => body,
  }) as unknown as Response;

// `authHeaders` lo si' mocka perche' nel test non c'e' un Firebase Auth con un
// utente collegato: tornerebbe `{}` e la verifica sull'header non significherebbe
// niente. Cosi' si verifica CHE il service chiami `authHeaders` (e che l'header
// finisca davvero nella richiesta), che e' il punto: senza token la route
// risponde 401 e il chiamante legge "Errore durante l'analisi della rosa".
jest.mock('@/lib/api-client', () => ({
  authHeaders: jest.fn(async () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer token-di-test',
  })),
}));

let fetchMock: jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

beforeEach(() => {
  // NON `jest.resetAllMocks()`: azzererebbe anche l'implementazione di
  // `authHeaders`, che sta nel mock di modulo, e ogni chiamata andrebbe con
  // headers `undefined` — un test che passerebbe solo se la richiesta fosse
  // mal costruita. Qui si pulisce solo `fetch`.
  fetchMock = jest.fn().mockResolvedValue(rispostaJson({ players: [] }));
  global.fetch = fetchMock as unknown as typeof fetch;

  // La stagione attiva si legge dallo store: senza, ogni chiamata AI
  // risponderebbe "Nessuna stagione selezionata" e i test passerebbero o
  // fallirebbero per il motivo sbagliato.
  jest.mock('@/store/useSeasonsStore', () => ({
    useSeasonsStore: { getState: () => ({ activeSeason: { id: 'S-ABCDEF' } }) },
  }));
});

/** Il corpo JSON dell'ultima fetch. */
function ultimoBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return JSON.parse((init as RequestInit).body as string);
}

describe('ai.service verso /api/ai/import', () => {
  it('importPlayers manda operation=players con la stagione attiva', async () => {
    await AIService.importPlayers({ rawText: 'POR: Rossi' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/import');
    expect((init as RequestInit).method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-di-test' });
    expect(ultimoBody()).toEqual({
      operation: 'players',
      seasonId: 'S-ABCDEF',
      rawText: 'POR: Rossi',
    });
  });

  it('suggestLineup manda operation=lineup con la formazione', async () => {
    fetchMock.mockResolvedValue(rispostaJson({ starters: [], substitutes: [] }));

    await AIService.suggestLineup({
      rawList: '1. Rossi',
      availablePlayers: [{ id: 'p1', name: 'Rossi' }],
      formation: '4-4-2',
    });

    expect(ultimoBody()).toMatchObject({
      operation: 'lineup',
      seasonId: 'S-ABCDEF',
      formation: '4-4-2',
    });
  });

  it('importMatches manda operation=matches', async () => {
    fetchMock.mockResolvedValue(rispostaJson({ matches: [], teamName: 'OSL' }));

    await AIService.importMatches({ rawContent: '20/09 OSL vs X' });

    expect(ultimoBody()).toMatchObject({
      operation: 'matches',
      seasonId: 'S-ABCDEF',
      rawContent: '20/09 OSL vs X',
    });
  });

  // Il formato della risposta e' `{ error: { code, message } }`. Senza questo
  // caso l'utente vedrebbe "[object Object]" al posto del messaggio: la route
  // risponde correttamente e il client la perde.
  it('estrae il messaggio strutturato dalla risposta di errore', async () => {
    fetchMock.mockResolvedValue(
      rispostaJson(
        { error: { code: 'MEMBERS_FULL', message: 'Hai raggiunto il limite di 5 membri.' } },
        false,
        403,
      ),
    );

    await expect(AIService.importMatches({ rawContent: 'x' })).resolves.toEqual({
      ok: false,
      error: 'Hai raggiunto il limite di 5 membri.',
    });
  });

  it('accetta anche il formato piatto della stringa di errore', async () => {
    fetchMock.mockResolvedValue(rispostaJson({ error: 'Unauthorized' }, false, 401));

    await expect(AIService.importMatches({ rawContent: 'x' })).resolves.toEqual({
      ok: false,
      error: 'Unauthorized',
    });
  });

  it('senza stagione non chiama la rotta e lo dice', async () => {
    jest.resetModules();
    jest.doMock('@/store/useSeasonsStore', () => ({
      useSeasonsStore: { getState: () => ({ activeSeason: undefined }) },
    }));
    jest.doMock('@/lib/api-client', () => ({ authHeaders: async () => ({}) }));
    const mod = await import('./ai.service');

    await expect(mod.importMatches({ rawContent: 'x' })).resolves.toEqual({
      ok: false,
      error: 'Nessuna stagione selezionata.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});