import {
    computeMinutesPlayed, getAbsoluteMinute, halfTimeOf, matchEndAbsolute,
    periodEnd, periodStart, stoppagePeriodsActive,
} from '@/lib/player-minutes';

describe('Player Minutes Calculation', () => {
    const D = 80;
    const END = 110;
    const ev = (o: any) => ({ type: 'substitution', period: '2T', minute: 0, ...o });

    describe('Stoppage periods activation', () => {
        it('activates extra time only for tournaments with defined stoppage periods', () => {
            expect(stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 5 } })).toBe(true);
            expect(stoppagePeriodsActive({ type: 'Torneo', addedTime: { '2TS': 3 } })).toBe(true);
            expect(stoppagePeriodsActive({ type: 'Torneo', addedTime: undefined })).toBe(false);
            expect(stoppagePeriodsActive({ type: 'Torneo', addedTime: {} })).toBe(false);
            expect(stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 0 } })).toBe(false);
            expect(stoppagePeriodsActive({ type: 'Campionato', addedTime: { '1TS': 5 } })).toBe(false);
            expect(stoppagePeriodsActive({ type: 'Amichevole', addedTime: { '1TS': 5 } })).toBe(false);
            expect(stoppagePeriodsActive(null)).toBe(false);
            expect(stoppagePeriodsActive(undefined)).toBe(false);
        });

        it('keeps extra time periods fixed at 15 minutes each regardless of stoppage duration', () => {
            expect(matchEndAbsolute(D, stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 3 } }))).toBe(END);
            expect(matchEndAbsolute(D, stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 30 } }))).toBe(END);
        });
    });

    describe('Period boundaries & Timeline', () => {
        it('calculates regular vs extra time match endings', () => {
            expect(matchEndAbsolute(D, false)).toBe(D);
            expect(matchEndAbsolute(D, true)).toBe(END);
            expect(halfTimeOf(80)).toBe(40);
            expect(halfTimeOf(90)).toBe(45);
        });

        it('computes period starts and ends correctly with extra time', () => {
            expect(periodStart('1TS', D, true)).toBe(80);
            expect(periodStart('2TS', D, true)).toBe(95);
            expect(periodStart('2T', D, true)).toBe(40);
            expect(periodEnd('1TS', D, true)).toBe(95);
            expect(periodEnd('2TS', D, true)).toBe(END);
        });

        it('collapses extra time periods when extra time is not active', () => {
            expect(periodEnd('1TS', D, false)).toBe(80);
            expect(periodEnd('2TS', D, false)).toBe(80);
            expect(getAbsoluteMinute({ period: '1TS', minute: 10 }, D, false)).toBe(80);
        });

        it('computes absolute minutes accurately without overlaps', () => {
            expect(getAbsoluteMinute({ period: '1TS', minute: 3 }, D, true)).toBe(83);
            expect(getAbsoluteMinute({ period: '2T', minute: 3 }, D, true)).toBe(43);
        });
    });

    describe('Minutes played computation', () => {
        const base = { duration: D, stoppageActive: true };

        it('calculates full match duration for starter playing until end', () => {
            expect(computeMinutesPlayed({ ...base, isStarter: true, events: [], playerId: 'A' })).toBe(END);
        });

        it('calculates minutes when starter is substituted out', () => {
            expect(computeMinutesPlayed({
                ...base,
                isStarter: true,
                playerId: 'A',
                events: [ev({ period: '2T', minute: 20, subOutPlayerId: 'A' })]
            })).toBe(60);

            expect(computeMinutesPlayed({
                ...base,
                isStarter: true,
                playerId: 'A',
                events: [ev({ period: '2T', minute: 40, subOutPlayerId: 'A' })]
            })).toBe(80);
        });
    });
});

