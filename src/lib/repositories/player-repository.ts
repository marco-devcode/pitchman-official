
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  writeBatch
} from 'firebase/firestore';
import type { Player, Role, PlayerRole } from '@/lib/types';
import { PlayerSchema } from '@/lib/schemas';
import { migrateRole } from '@/lib/types';

function ensureRoles(player: { roles?: PlayerRole[]; role?: Role; secondaryRoles?: Role[] }): PlayerRole[] {
  if (player.roles && player.roles.length > 0) return player.roles;
  if (player.role) {
    return [migrateRole(player.role), ...(player.secondaryRoles?.map(r => migrateRole(r)) || [])];
  }
  return ['CDC'];
}

export type PlayerCreateData = {
    name: string;
    firstName: string;
    lastName: string;
    role?: Role;
    secondaryRoles?: Role[];
    roles?: PlayerRole[];
    seasonId: string;
    userId: string;
}

export const playerRepository = {
  async getAll(userId: string, seasonId?: string) {
    if (!userId || !seasonId) return [];
    const db = getFirestore();
    const playersRef = collection(db, 'teams', seasonId, 'players');
    const q = query(playersRef);
    const snapshot = await getDocs(q);
    const players = snapshot.docs.map(doc => {
      const pData = doc.data();
      
      // Fallback per dati esistenti senza firstName/lastName
      if (!pData.firstName || !pData.lastName) {
        const parts = (pData.name || "").split(" ");
        pData.firstName = parts.shift() || "";
        pData.lastName = parts.join(" ") || pData.firstName;
      }

      const data = { ...pData, id: doc.id };
      const parsed = PlayerSchema.safeParse(data);
      if (!parsed.success) {
        console.error("Schema validation failed for Player:", parsed.error);
        return data as Player;
      }
      return parsed.data;
    });
    return players.sort((a, b) => a.lastName.localeCompare(b.lastName));
  },

  async getById(id: string, seasonId: string) {
    if (!id || !seasonId) return undefined;
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'players', id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Player : undefined;
  },

  async add(data: PlayerCreateData) {
    const db = getFirestore();
    // Genera un ID corto e leggibile (es: P-XYZ78)
    const shortRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
    const id = `P-${shortRandom}`;
    
    const newPlayer: Player = {
      id,
      userId: data.userId,
      teamOwnerId: data.userId,
      teamId: data.seasonId,
      seasonId: data.seasonId,
      name: data.name.toUpperCase(),
      firstName: data.firstName.toUpperCase(),
      lastName: data.lastName.toUpperCase(),
      roles: ensureRoles({ roles: data.roles, role: data.role, secondaryRoles: data.secondaryRoles }),
      stats: { appearances: 0, goals: 0, assists: 0, avgMinutes: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'teams', data.seasonId, 'players', id), newPlayer);
    return newPlayer;
  },

  async bulkAdd(playersData: PlayerCreateData[], userId: string, seasonId: string) {
    const db = getFirestore();
    const batch = writeBatch(db);

    const newPlayers: Player[] = playersData.map((p) => {
      const shortRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
      const id = `P-${shortRandom}`;

      // Sanitize: ensure no undefined values reach Firestore
      const roles = ensureRoles({ roles: p.roles, role: p.role, secondaryRoles: p.secondaryRoles as Role[] | undefined });

      const newPlayer: Player = {
        id,
        userId,
        teamOwnerId: userId,
        teamId: seasonId,
        seasonId,
        name: (p.name || ' ').toUpperCase().trim() || 'GIOCATORE',
        firstName: (p.firstName || p.name?.split(' ')[0] || ' ').toUpperCase().trim(),
        lastName: (p.lastName || p.name?.split(' ').slice(1).join(' ') || ' ').toUpperCase().trim(),
        roles,
        stats: { appearances: 0, goals: 0, assists: 0, avgMinutes: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Remove any undefined or null values recursively before writing
      const cleanObj = JSON.parse(JSON.stringify(newPlayer));

      const docRef = doc(db, 'teams', seasonId, 'players', id);
      batch.set(docRef, cleanObj);
      return newPlayer;
    });

    await batch.commit();
    return newPlayers;
  },

  async update(id: string, seasonId: string, updates: Partial<Omit<Player, 'id' | 'userId' | 'seasonId'>>) {
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'players', id);
    const updatesWithTimestamp = { 
      ...updates, 
      ...(updates.name && { name: updates.name.toUpperCase() }),
      updatedAt: new Date().toISOString() 
    };
    await updateDoc(docRef, updatesWithTimestamp);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Player : undefined;
  },

  async delete(id: string, seasonId: string) {
    const db = getFirestore();
    return await deleteDoc(doc(db, 'teams', seasonId, 'players', id));
  },

  async deleteAll(userId: string, seasonId: string) {
    if (!userId || !seasonId) return;
    const db = getFirestore();
    const playersRef = collection(db, 'teams', seasonId, 'players');
    const q = query(playersRef);
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
        batch.delete(d.ref);
    });
    await batch.commit();
  }
};
