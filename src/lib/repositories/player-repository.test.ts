import { getDocs, getDoc, setDoc } from 'firebase/firestore';

import { playerRepository } from './player-repository';

// Mock di TUTTO il modulo, per la stessa ragione di season-repository.test:
// la lista scritta a mano si rompeva a ogni funzione nuova. Vedi il commento
// li' per il caso concreto (`or` mancante).
jest.mock('firebase/firestore', () => {
    const fn = () => jest.fn();
    return {
        __esModule: true,
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
        where: jest.fn(),
        or: jest.fn(),
        and: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        startAfter: jest.fn(),
        endAt: jest.fn(),
        endBefore: jest.fn(),
        documentId: jest.fn(),
        DocumentSnapshot: class {},
        QuerySnapshot: class {},
        Timestamp: { now: () => ({ toDate: () => new Date() }), fromDate: (d: Date) => ({ toDate: () => d }) },
        FieldValue: { serverTimestamp: () => null, increment: (n: number) => n, arrayUnion: (...v: unknown[]) => v },
        deleteField: () => null,
    };
});

describe('playerRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(playerRepository).toBeDefined();
    });

    it('getAll should call getDocs', async () => {
        (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
        const result = await playerRepository.getAll('test-user', 'test-season');
        expect(getDocs).toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it('getById should call getDoc', async () => {
        (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Test' }), id: '1' });
        const result = await playerRepository.getById('1', 'test-season');
        expect(getDoc).toHaveBeenCalled();
        expect(result).toHaveProperty('name', 'Test');
    });

    it('add should call setDoc', async () => {
        // Il test passava solo { name, role, seasonId, userId } e moriva con
        // "Cannot read properties of undefined (reading 'toUpperCase')":
        // `add()` mette in maiuscolo firstName/lastName, che sono obbligatori
        // in PlayerCreateData (`types.ts:344`). Non era un bug del repository,
        // era un test scritto quando quei campi non esistevano.
        const createData: any = {
            name: 'Player',
            firstName: 'Pla',
            lastName: 'Yer',
            role: 'Attaccante',
            seasonId: 'season-1',
            userId: 'user-1',
        };
        const created = await playerRepository.add(createData);
        expect(setDoc).toHaveBeenCalled();
        // Il repository mette tutto in maiuscolo: verifico il risultato, non
        // solo che la chiamata sia partita.
        expect(created.name).toBe('PLAYER');
        expect(created.firstName).toBe('PLA');
        expect(created.lastName).toBe('YER');
    });
});
