import { computeMostUsedLineup } from '@/lib/most-used-lineup';

describe('computeMostUsedLineup', () => {
    const match = (id: string, formation: string, starters: string[]) => ({ id, formation, starters });

    const casoDC = [
        match('m1', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCX', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
        match('m2', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCX', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
        match('m3', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCX', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
        match('m4', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCY', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
    ];

    const casoRuoli = [
        match('m1', '3-5-2', ['POR1', 'TSX', 'DC1', 'DC2', 'DC3', 'ASA1', 'CS1', 'CDC1', 'CD1', 'ADA1', 'ATT1', 'ATT2']),
        match('m2', '3-5-2', ['POR1', 'TSX', 'DC1', 'DCX', 'DC3', 'ASA1', 'CS1', 'CDC1', 'CD1', 'ADA1', 'ATT1', 'ATT2']),
    ];

    const nomi: Record<string, string> = Object.fromEntries(
        ['POR1', 'TS1', 'TSX', 'DCX', 'DCY', 'DC1', 'DC2', 'DC3', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2',
            'ASA1', 'CDC1', 'ADA1', 'ATT1', 'ATT2'].map((n) => [n, n]),
    );

    it('returns null when no matches or lineups exist', () => {
        expect(computeMostUsedLineup([] as any, () => undefined, () => undefined)).toBeNull();
    });

    it('ensures no player is duplicated across slots', () => {
        for (const matches of [casoDC, casoRuoli]) {
            const res = computeMostUsedLineup(
                matches as any,
                (m: any) => ({ matchId: m.id, formation: m.formation, starters: m.starters, substitutes: [] }),
                (pid: string) => nomi[pid]
            );
            expect(res).not.toBeNull();
            expect(res!.starters).toHaveLength(11);

            const ids = res!.starters.map((s) => s.playerId).filter(Boolean);
            const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
            expect(dup).toHaveLength(0);
        }
    });

    it('resolves competing slots in favor of the next best candidate', () => {
        const res = computeMostUsedLineup(
            casoDC as any,
            (m: any) => ({ matchId: m.id, formation: m.formation, starters: m.starters, substitutes: [] }),
            (pid: string) => nomi[pid]
        );
        expect(res).not.toBeNull();
        const count = (id: string) => res!.starters.filter((s) => s.playerId === id).length;
        expect(count('DCX')).toBe(1);
        expect(count('DCY')).toBe(1);
    });
});

