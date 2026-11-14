import { FORMATION_SLOT_ROLES, FORMATION_COORDINATES as COORD_LM, MATCH_FORMATIONS } from '@/lib/lineup-mapping';
import { FORMATION_ROLES, FORMATION_SLOT_COORDS as COORD_TYPES } from '@/lib/types';

describe('Formation Roles and Coordinates Alignment', () => {
    it('matches roles identically between FORMATION_SLOT_ROLES and FORMATION_ROLES', () => {
        for (const formation of MATCH_FORMATIONS) {
            const slotRoles = FORMATION_SLOT_ROLES[formation];
            const typesRoles = FORMATION_ROLES[formation];

            expect(slotRoles).toBeDefined();
            expect(typesRoles).toBeDefined();
            expect(slotRoles).toEqual(typesRoles);
        }
    });

    it('matches coordinates between lineup-mapping and types within precision limits', () => {
        const parsePct = (s: string) => parseFloat(s.replace('%', '').trim());

        for (const formation of MATCH_FORMATIONS) {
            const coordsLM = COORD_LM[formation];
            const coordsTypes = COORD_TYPES[formation];

            expect(coordsLM).toBeDefined();
            expect(coordsTypes).toBeDefined();
            expect(coordsLM.length).toBe(coordsTypes.length);

            for (let i = 0; i < coordsLM.length; i++) {
                const diffTop = Math.abs(coordsLM[i].top - parsePct(coordsTypes[i].top));
                const diffLeft = Math.abs(coordsLM[i].left - parsePct(coordsTypes[i].left));

                expect(diffTop).toBeLessThan(0.01);
                expect(diffLeft).toBeLessThan(0.01);
            }
        }
    });
});

