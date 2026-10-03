/**
 * @jest-environment node
 *
 * Documentazione: node, non jsdom.
 *
 * Questa e' una route di API: in produzione gira in Node, non nel browser.
 * Sotto jsdom, costruire una `Request` tirava una catena di
 * "ReferenceError is not defined" (Request, poi ReadableStream, poi
 * MessagePort via undici) perche' le Web API del fetch non ci sono. In
 * ambiente node sono gia' tutte presenti, quindi il test esercita il codice
 * com'e' gira davvero.
 *
 * Non serve `jest.setup.js` qui: niente DOM, quindi niente matchMedia e
 * niente Testing Library.
 */
import { requireAuth, requireAuthOr } from './api-auth';
import { adminAuth, adminDb } from './firebase-admin';

jest.mock('./firebase-admin', () => ({
    adminAuth: { verifyIdToken: jest.fn() },
    adminDb: { collection: jest.fn() },
}));

const mockAuth = adminAuth as unknown as { verifyIdToken: jest.Mock };
const mockDb = adminDb as unknown as { collection: jest.Mock };

/**
 * Il documento `users/{uid}` che `requireAuth` legge per il ruolo.
 *
 * Il ruolo NON viene dai custom claims del token: in questo progetto non
 * vengono mai scritti, perche' `FIREBASE_SERVICE_ACCOUNT` non e' definita in
 * nessun ambiente Vercel. La fonte tenuta allineata e' Firestore, ed e' da
 * li' che `useUserRole` prende il ruolo lato client.
 */
function utenteConRuolo(ruolo: string | undefined) {
    const get = jest.fn().mockResolvedValue({
        exists: ruolo !== undefined,
        data: () => (ruolo !== undefined ? { role: ruolo } : {}),
    });
    mockDb.collection.mockReturnValue({ doc: () => ({ get }) });
    return get;
}

/**
 * `requireAuth` risponde 401/403 e restituisce `null` quando la richiesta va
 * respinta. Per verificare entrambe le cose senza dipendere da `next/server`
 * (che in jsdom richiede le Web API di undici, e le richiede PRIMA che il
 * setup file possa iniettarle) si chiama la funzione e si guarda cosa
 * restituisce: `null` significa "risposta gia' inviata", ed e' il contratto
 * che le route usano con `if (!auth) return;`.
 */
describe('requireAuth', () => {
    const req = (token?: string) =>
        new Request('http://x', { headers: token ? { Authorization: `Bearer ${token}` } : {} });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.verifyIdToken.mockResolvedValue({ uid: 'u1' });
        utenteConRuolo('developer');
    });

    it('senza header Authorization RESTITUISCE LA RISPOSTA 401', async () => {
        // Non basta `toBeNull()`: il bug che ha rotto le tre route era
        // `if (!auth) return;`, che mandava `undefined` a Next. Qui si verifica
        // che il valore restituito sia una NextResponse con status 401.
        const denied = await requireAuth(req(), ['developer']);
        expect(denied).not.toBeNull();
        expect(denied).not.toBeUndefined();
        expect(denied!.status).toBe(401);
        expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();
    });

    it('header senza prefisso Bearer restituisce 401', async () => {
        const r = new Request('http://x', { headers: { Authorization: 'token' } });
        const denied = await requireAuth(r, ['developer']);
        expect(denied?.status).toBe(401);
    });

    it('token non verificabile restituisce 401', async () => {
        mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('token scaduto'));
        const denied = await requireAuth(req('cattivo'), ['developer']);
        expect(denied?.status).toBe(401);
    });

    it('ruolo non ammesso su Firestore restituisce 403', async () => {
        utenteConRuolo('coach');
        const denied = await requireAuth(req('buono'), ['developer']);
        expect(denied?.status).toBe(403);
    });

    it('ruolo ammesso: nessuna risposta di rifiuto', async () => {
        await expect(requireAuth(req('buono'), ['developer'])).resolves.toBeNull();
    });

    it("uno dei ruoli ammessi basta: coach passa dove c'e coach", async () => {
        utenteConRuolo('coach');
        await expect(
            requireAuth(req('buono'), ['coach', 'director', 'developer']),
        ).resolves.toBeNull();
    });

    it('senza lista di ruoli ammette chiunque sia autenticato', async () => {
        utenteConRuolo('player');
        await expect(requireAuth(req('buono'))).resolves.toBeNull();
    });

    it("documento utente senza ruolo non entra dove serve un ruolo", async () => {
        utenteConRuolo(undefined);
        const denied = await requireAuth(req('buono'), ['developer']);
        expect(denied?.status).toBe(403);
    });

    it('se la lettura del ruolo fallisce si nega, non si lascia passare', async () => {
        // Il caso peggiore sarebbe tirare avanti: la richiesta passerebbe con
        // un permesso che non si e' riusciti a determinare.
        mockDb.collection.mockReturnValue({
            doc: () => ({ get: jest.fn().mockRejectedValue(new Error('Firestore giù')) }),
        });
        const denied = await requireAuth(req('buono'), ['developer']);
        expect(denied?.status).toBe(403);
    });

    it('requireAuthOr: rifiutato porta la risposta pronta', async () => {
        // E' l'API che le route dovrebbero usare: `ok` e `response` sono due
        // campi distinti, quindi non si puo' finire col `return undefined`.
        utenteConRuolo('coach');
        const esito = await requireAuthOr(req('buono'), ['developer']);
        expect(esito.ok).toBe(false);
        if (!esito.ok) expect(esito.response.status).toBe(403);
    });

    it('requireAuthOr: accettato porta uid e ruolo', async () => {
        const esito = await requireAuthOr(req('buono'), ['developer']);
        expect(esito).toEqual({ ok: true, uid: 'u1', role: 'developer' });
    });

    it('il ruolo viene letto da Firestore, non dai custom claims', async () => {
        // Il token porta `role: 'player'` mentre il documento dice 'developer'.
        // Se il codice leggesse i custom claims, un developer autentico
        // verrebbe respinto: e i claim in questo progetto non vengono neanche
        // scritti quando manca FIREBASE_SERVICE_ACCOUNT.
        mockAuth.verifyIdToken.mockResolvedValue({ uid: 'u1', role: 'player' });
        utenteConRuolo('developer');
        await expect(requireAuth(req('buono'), ['developer'])).resolves.toBeNull();
    });
});
