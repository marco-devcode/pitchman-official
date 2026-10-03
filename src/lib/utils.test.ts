import { displayPlayerRoles } from './utils';

describe('displayPlayerRoles', () => {
    it('usa roles quando presente: e\' il campo piu\' recente', () => {
        expect(displayPlayerRoles({ roles: ['DC', 'CDC', 'TRQ'], role: 'DC' })).toBe('DC, CDC, TRQ');
    });

    it('ripiega su role quando roles e\' vuoto', () => {
        // Documenti vecchi hanno solo `role`: senza il ripiego la riga
        // mostrerebbe una stringa vuota.
        expect(displayPlayerRoles({ roles: [], role: 'ATT' })).toBe('ATT');
    });

    it('se roles manca del tutto usa role', () => {
        expect(displayPlayerRoles({ role: 'POR' })).toBe('POR');
    });

    it('include i secondari quando non c\'e\' roles', () => {
        expect(displayPlayerRoles({ role: 'TS', secondaryRoles: ['CDC'] })).toBe('TS, CDC');
    });

    it('non duplica quando role e\' gia\' dentro roles', () => {
        // Il caso reale: `role` deprecato puo\' contenere il primo di `roles`.
        // Leggendo entrambi senza filtro si avrebbe "DC, CDC, DC".
        expect(displayPlayerRoles({ roles: ['DC', 'CDC'], role: 'DC' })).toBe('DC, CDC');
    });

    it('tollera undefined e null', () => {
        expect(displayPlayerRoles(undefined)).toBe('');
        expect(displayPlayerRoles(null)).toBe('');
    });

    it('stringa vuota se il giocatore non ha ruoli', () => {
        expect(displayPlayerRoles({})).toBe('');
    });
});
