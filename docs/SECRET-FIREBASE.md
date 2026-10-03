# Come aggiungere FIREBASE_SERVICE_ACCOUNT a PitchMan

Passi per ottenere la chiave e metterla su Vercel. Sono 4 passi, ~5 minuti.

## 1. Scarica la chiave del service account

1. Apri https://console.firebase.google.com/project/studio-2152291626-61ba0/settings/serviceaccounts
2. Clicca **"Genera nuova chiave privata"**
3. Si scarica un file JSON. **Non lo chiudere e non inviarlo a nessuno**: contiene la chiave privata.

Il file si chiama tipo `studio-2152291626-61ba0-xxxx.json` e contiene:

```json
{
  "type": "service_account",
  "project_id": "studio-2152291626-61ba0",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@studio-2152291626-61ba0.iam.gserviceaccount.com",
  ...
}
```

**Vercel accetta il JSON intero su una riga sola.** Non va formattato a mano: copi tutto il contenuto del file, e quando lo incolli in Vercel lui toglie i `\n` e mette le virgolette da solo.

## 2. Mettila su Vercel

1. Apri https://vercel.com → il progetto **pitchman**
2. Tab **Settings** → **Environment Variables**
3. **Name**: `FIREBASE_SERVICE_ACCOUNT`
4. **Value**: il contenuto del file JSON, tutto su una riga
5. **Environment**: spunta **Production**, **Preview** e **Development** (tutti e tre)
6. **Save**

Non serve fare il Redeploy a mano: Vercel fa il redeploy da solo quando salvi una variabile.

## 3. Verifica

```bash
cd ~/pitchman-official
npx vercel curl 'https://pitchman.app/api/auth/init-user' -X POST -H 'Authorization: Bearer finto'
```

Se risponde `{"error":"Unauthorized"}` invece di `{"error":"Firebase Admin not configured"}`,
il secret c'è e il 401 è la risposta giusta (il token finto non è valido).

Se risponde ancora `Firebase Admin not configured`, il secret non è arrivato:
controlla di averlo messo in **Production** e non solo in Preview.

## Come mai serve

Tre route API dipendono dall'Admin SDK (`src/lib/firebase-admin.ts`):

- `api/auth/init-user` — crea il documento utente e scrive il ruolo
- `api/admin/set-role` — assegna i ruoli
- `api/import-rosa`, `api/import-calendario`, `api/generate` — dopo il mio fix,
  verificano il ruolo con `lib/api-auth.ts`

Senza la chiave `adminAuth` è `null` e quelle route rispondono 500.
