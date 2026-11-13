# Pattern Architetturali di PitchMan

Guida di riferimento rapido per lo sviluppo nel codebase di PitchMan.

---

## 1. Mappa dei Ruoli e Permessi

- **Fonte di verità ruoli**: `useAuthStore` (legge `tokenResult.claims.role`).
- **Hook permessi client**: `useUserRole()`
  - Restituisce booleani come `isDeveloper`, `isDirectorOrAbove`, `isCoachOrAbove`.
  - Non inventare wrapper intermedi o hook duplicati.
- **Autorizzazione API/Route**:
  - `requireAuth(request, ['coach', 'director', 'developer'])` direttamente nella route handler Next.js.
  - Mai fidarsi dei dati inviati dal client per l'autorizzazione.

---

## 2. Gestione Stato & Store Firestore

| Store | Collection Firestore | Scopo |
|---|---|---|
| `usePlayersStore` | `teams/{seasonId}/players` | Gestione atleti/rosa |
| `useMatchesStore` | `teams/{seasonId}/matches` | Partite, formazioni, eventi, statistiche |
| `useMatchDetailStore` | - | Partita aperta corrente |
| `useTrainingStore` | `teams/{seasonId}/sessions` | Allenamenti e presenze |
| `useStatsStore` | `teams/{seasonId}/aggregates` | Statistiche aggregate di squadra |
| `useSettingsStore` | `settings/{uid}` | Preferenze e configurazioni per utente |
| `useTestsStore` | `teams/{seasonId}/physicalTests` | Test atletici |
| `useExerciseStore` | `exercises` | Archivio esercizi |
| `usePresenceStore` | `teams/{seasonId}/presence` | Registro presenze |

### Regola Fondamentale Collezioni
- Tutte le collezioni per stagione devono essere registrate in `src/lib/season-collections.ts`.
- L'eliminazione account o il reset di stagione dipendono da questo registro.

---

## 3. Gestione Asincrona e Feedback Utente

Non creare logiche di loading/errore ad-hoc in ogni componente o dialogo. Utilizza il pattern standard:

```typescript
import { useAsyncAction } from '@/hooks/use-async-action';
import { AsyncFeedback } from '@/components/ui/async-feedback';

export function MyFeatureDialog() {
  const { data, error, loading, run } = useAsyncAction(async () => {
    return await myServiceCall();
  });

  return (
    <div>
      <AsyncFeedback loading={loading} error={error} />
      <button onClick={() => run()} disabled={loading}>
        Esegui
      </button>
    </div>
  );
}
```

