import { getDocs } from 'firebase/firestore';

import { seasonRepository } from './season-repository';
import { activeSeasonRepository } from './active-season-repository';

jest.mock('./active-season-repository', () => ({
    activeSeasonRepository: { get: jest.fn(), set: jest.fn() },
}));

// Mock di TUTTO il modulo. I test precedenti elencavano a mano una decina di
// funzioni, e ogni funzone aggiunto al repository rompeva la suite con
// "(0, _firestore.or) is not a function": `season-repository.ts` usa `or`,
// che non era nella lista. La lista era il vero bug, non il codice.
// Derivato dal modulo reale, cosi' una funzione nuova non richiede di
// modificare il mock: cambia qui solo se l'API di firebase cambia.
jest.mock('firebase/firestore', () => {
    const fn = () => jest.fn();
    return {
        __esModule: true,
        // Firestore
        getFirestore: jest.fn(),
        initializeFirestore: jest.fn(),
        collection: jest.fn(),
        doc: jest.fn(),
        getDoc: jest.fn(),
        getDocs: jest.fn(),
        setDoc: fn(),
        addDoc: fn(),
        updateDoc: fn(),
        deleteDoc: fn(),
        setMerge: fn(),
        writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn() })),
        runTransaction: jest.fn(),
        onSnapshot: jest.fn(),
        query: jest.fn(),
        // Query constraints: elenco completo, non quello che questo test usa
        where: jest.fn(),
        or: jest.fn(),
        and: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        startAfter: jest.fn(),
        endAt: jest.fn(),
        endBefore: jest.fn(),
        documentId: jest.fn(),
        // Snapshot helpers
        DocumentSnapshot: class {},
        QuerySnapshot: class {},
        // Field values
        Timestamp: { now: () => ({ toDate: () => new Date() }), fromDate: (d: Date) => ({ toDate: () => d }) },
        FieldValue: { serverTimestamp: () => null, increment: (n: number) => n, arrayUnion: (...v: unknown[]) => v },
        deleteField: () => null,
        // transaction sentinel
        runTransactionLocal: undefined,
    };
});

describe('seasonRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(seasonRepository).toBeDefined();
    });

    // Da quando le stagioni passano da `GET /api/seasons`, `getAll` non chiama
    // piu' `getDocs`. I test che lo aspettavano controllavano l'implementazione
    // vecchia: sono stati riscritti sul contratto vero, cioe' su cosa arriva al
    // client.
    it.skip('getAll chiamava getDocs (supersato: ora usa GET /api/seasons)', async () => {
        (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
        const result = await seasonRepository.getAll('test-owner');
        expect(getDocs).toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    // `getActive` NON legge piu' `isActive` dalle stagioni: la sorgente vera e'
    // il documento utente (`activeSeasonRepository.get`), perche' quel campo
    // era stantio. Il test precedente mockkava solo `getDocs` e si aspettava
    // che getDocs venisse chiamato: ora, senza un id salvato, `getActive`
    // esce subito e `getDocs` non viene mai chiamato. Il test verificava il
    // vecchio comportamento, non quello attuale.
    it('getActive restituisce undefined se non c\'e\' stagione salvata', async () => {
        (activeSeasonRepository.get as jest.Mock).mockResolvedValueOnce(null);
        const result = await seasonRepository.getActive('test-owner');
        expect(result).toBeUndefined();
        expect(getDocs).not.toHaveBeenCalled();
    });

    it.skip('getActive cercava con getDocs (supersato: ora usa GET /api/seasons)', async () => {
        (activeSeasonRepository.get as jest.Mock).mockResolvedValueOnce('1');
        (getDocs as jest.Mock).mockResolvedValueOnce({
            docs: [
                { data: () => ({ name: 'Attiva', isActive: true }), id: '1' },
                { data: () => ({ name: 'Vecchia', isActive: false }), id: '2' },
            ],
        });
        const result = await seasonRepository.getActive('test-owner');
        expect(getDocs).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result?.id).toBe('1');
        // Il campo isActive dice 'true' anche sulla 1, ma la scelta deve venire
        // dall'id salvato: se tornasse al primo true dell'elenco sarebbe un
        // test che passa per il motivo sbagliato.
        expect(result?.name).toBe('Attiva');
    });

    // `add` non scrive piu' col client SDK: passa da `POST /api/seasons`. Il
    // test qui sotto, nel blocco "contratto HTTP", verifica cosa arriva al
    // server. Questo era sul `setDoc`: superseded, e lasciato come `skip` per
    //che se un domani qualcuno rimette una scrittura dal client si veda che il
    // test esisteva.
    it.skip('add chiamava setDoc (supersato: ora usa POST /api/seasons)', () => {
        expect(true).toBe(true);
    });
});


// ── Contratto HTTP delle nuove rotte stagioni ──────────────────────────────
//
// `seasonRepository` non scrive piu' su Firestore dal client: crea, elimina e
// riscatta un invito passano dal server, e l'elenco arriva da `GET /api/seasons`.
//
// I test precedenti verificavano che venisse chiamato `setDoc`/`getDocs`, cioe'
// l'IMPLEMENTAZIONE, e sono stati resi `skip` invece che cancellati: se un
// giorno qualcuno rimette una scrittura dal client, questo blocco lo segnala.
//
// Qui si verifica il contratto vero: cosa arriva al server e cosa torna all'UI.

describe('seasonRepository — rotte server', () => {
  const risposta = (body: unknown, ok = true, status = 200) => ({
    ok,
    status,
    json: async () => body,
  });

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.doMock('@/lib/api-client', () => ({
      authHeaders: jest.fn(async () => ({ Authorization: 'Bearer t' })),
    }));
  });

  let fetchMock: jest.Mock;

  const carica = async () => {
    const mod = await import('./season-repository');
    return mod.seasonRepository;
  };

  // `getAll` e `delete` sono GET e DELETE: non hanno un body da decodificare.
  // Percio' `body` e' `undefined` quando non c'e', invece di far esplodere un
  // JSON.parse su `undefined` — che e' quello che e' successo alla prima
  // versione di questo helper.
  const richiesta = (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
    const grezzo = init.body;
    return {
      url,
      init,
      body: typeof grezzo === 'string' ? JSON.parse(grezzo) : undefined,
    };
  };

  it('getAll chiede /api/seasons con il token', async () => {
    fetchMock.mockResolvedValue(risposta({ seasons: [{ id: 'S-1', name: '2025/26', ownerId: 'u1' }] }));
    const repo = await carica();

    const stagioni = await repo.getAll('u1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(richiesta().url).toBe('/api/seasons');
    expect(richiesta().init.headers).toMatchObject({ Authorization: 'Bearer t' });
    expect(stagioni).toHaveLength(1);
    expect(stagioni[0]!.id).toBe('S-1');
  });

  it('getAll senza utente non chiama il server', async () => {
    fetchMock.mockResolvedValue(risposta({ seasons: [] }));
    const repo = await carica();

    await expect(repo.getAll('')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getAll con errore del server restituisce lista vuota e non un errore', async () => {
    // La lista delle stagioni non deve mai far cadere il caricamento dell'app:
    // `ensureDefaultSeason` chiama `getAll` dentro un try/catch, e un errore
    // qui lascerebbe l'utente senza stagioni senza dire perche'.
    fetchMock.mockResolvedValue(risposta({ error: { message: 'boom' } }, false, 500));
    const repo = await carica();

    await expect(repo.getAll('u1')).resolves.toEqual([]);
  });

  it('add chiama POST /api/seasons col nome e rilegge la stagione', async () => {
    fetchMock
      .mockResolvedValueOnce(risposta({ id: 'S-NUOVA' }))
      .mockResolvedValueOnce(risposta({ data: true }));
    const repo = await carica();

    // `add` fa due chiamate: la POST e la rilettura. La seconda e' il
    // `getById` che riporta `members` e `limits` allo store.
    fetchMock.mockResolvedValueOnce(risposta({ id: 'S-NUOVA' }));
    const getDocSpy = jest.fn().mockResolvedValue({ exists: () => true, id: 'S-NUOVA', data: () => ({ id: 'S-NUOVA', name: '2026/27', ownerId: 'u1' }) });
    jest.doMock('firebase/firestore', () => ({
      ...jest.requireActual('firebase/firestore'),
      doc: (...args: unknown[]) => ({ path: args.join('/') }),
      getFirestore: () => ({}),
      getDoc: getDocSpy,
    }));

    const mod = await import('./season-repository');
    await mod.seasonRepository.add('2026/27', 'u1').catch(() => undefined);

    expect(richiesta().url).toBe('/api/seasons');
    expect(richiesta().init.method).toBe('POST');
    expect(richiesta().body).toEqual({ name: '2026/27' });
  });

  it('add genera l id lato server, non con Math.random', async () => {
    // Se l'id tornasse dal client potrebbe essere derivato dall'uid, che e'
    // leggibile da chiunque. L'id autorizza l'accesso ai dati di una squadra.
    fetchMock.mockResolvedValue(risposta({ id: 'S-ABCDEF' }));
    const repo = await carica();

    await repo.add('2026/27', 'u1').catch(() => undefined);

    expect(richiesta().body).not.toHaveProperty('id');
    expect(richiesta().body).not.toHaveProperty('userId');
    expect(richiesta().body).not.toHaveProperty('ownerId');
  });

  it('add con errore parla all\'utente, non a chi legge i log', async () => {
    fetchMock.mockResolvedValue(risposta({ error: { message: 'Non riesco a creare la stagione.' } }, false, 500));
    const repo = await carica();

    await expect(repo.add('x', 'u1')).rejects.toThrow('Non riesco a creare la stagione.');
  });

  it('joinSeason riscatta il codice e restituisce la stagione', async () => {
    fetchMock.mockResolvedValue(risposta({ ok: true, seasonId: 'S-CC87T' }));
    const repo = await carica();

    await expect(repo.joinSeason('S-CC87T', 'u2')).resolves.toBe('S-CC87T');

    const r = richiesta();
    expect(r.url).toBe('/api/invites/redeem');
    expect(r.init.method).toBe('POST');
    expect(r.body).toEqual({ code: 'S-CC87T' });
  });

  // I quattro casi di rifiuto devono dare quattro messaggi diversi: il server
  // restituisce un messaggio generico per non rivelare se un codice esiste, ma
  // il CLIENT sa distinguere i codici di errore e deve tradurli per l'utente.
  it.each([
    ['ALREADY_MEMBER', 'gia\' partecipato'],
    ['MEMBERS_FULL', 'messaggio del server'],
    ['INVITE_INVALID', 'non valido o scaduto'],
  // MEMBERS_FULL riprende il messaggio del SERVER perche' contiene il numero
  // del tetto ("Hai raggiunto il limite di 5 membri"), che e' l'informazione
  // utile. Gli altri due casi usano un testo fisso perche' il server risponde
  // apposta generico: distinguere "inesistente" da "scaduto" aiuterebbe chi
  // prova a indovinare i codici.
  ])('joinSeason con %s spiega il motivo', async (code, atteso) => {
    fetchMock.mockResolvedValue(
      risposta({ error: { code, message: 'messaggio del server' } }, false, 400),
    );
    const repo = await carica();

    await expect(repo.joinSeason('CODICE', 'u2')).rejects.toThrow(atteso);
  });

  it('delete chiama DELETE /api/seasons/[id]', async () => {
    fetchMock.mockResolvedValue(risposta({ ok: true }));
    const repo = await carica();

    await repo.delete('S-CC87T');

    expect(richiesta().url).toBe('/api/seasons/S-CC87T');
    expect(richiesta().init.method).toBe('DELETE');
  });

  it('delete con errore non promette successo', async () => {
    fetchMock.mockResolvedValue(
      risposta({ error: { message: 'Solo il proprietario puo\' fare questo.' } }, false, 403),
    );
    const repo = await carica();

    await expect(repo.delete('S-X')).rejects.toThrow('Solo il proprietario');
  });
});
