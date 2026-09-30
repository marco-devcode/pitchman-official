/**
 * Estrazione del testo da un file caricato, lato server.
 *
 * PERCHE' ESISTE. Il file arrivava come data URL base64 dentro il prompt, e il
 * plugin genkit lo metteva in `file_uri`. Gemini su `file_uri` accetta SOLO
 * File API, YouTube o HTTPS: un data URL viene rifiutato con
 * "Unsupported file URI type". Verificato con una chiamata diretta: lo stesso
 * PDF passato come `inline_data` viene letto correttamente.
 *
 * La divisione:
 *  - IMMAGINI (jpg, png, webp, gif): l'AI le legge, quindi si passano inline
 *    com'erano. Niente da estrarre.
 *  - PDF e DOCX: si estrae il testo e si passa all'AI come testo normale.
 *    Il DOCX e' uno ZIP con l'XML in chiaro dentro; il PDF e' compresso e va
 *    decodificato.
 *
 * Nota sul DOCX: si legge il testo, ma NON la formattazione (tabelle, colonne,
 * celle unite). Un calendario in tabella puo' quindi uscire con le colonne
 * accostate. Il DOCX resta un formato fragile: se serve fedele, va convertito
 * in PDF o in testo.
 */

const LIMITE_TESTO = 40000;

/** Data URL -> { mime, base64 }. Torna null se non e' un data URL. */
export function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  // Classe esplicita invece del flag /s: il target del progetto e' pre-ES2018
  // e non compila il flag, quindi la regex diventava un errore di compilazione.
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const mime = (m[1] || 'application/octet-stream').toLowerCase();
  if (!m[2]) {
    // Non base64: si codifica il testo UTF-8 cosi' si può trattare comunque.
    return { mime, base64: Buffer.from(decodeURIComponent(m[3]), 'utf8').toString('base64') };
  }
  return { mime, base64: m[3] };
}

/**
 * Estrae il testo da un PDF.
 *
 * Percorso: si cercano i flussi di contenuto, si cercano quello che contiene
 * operatori di testo (Tj, TJ, ', ") e ne si ricava il testo, scompattando gli
 * array TJ. I font subset spesso usano codifiche personalizzate: in quel caso
 * il testo esce illeggibile, e si segnala con un flag invece di passare spazzatura
 * all'AI, che produrrebbe partite inventate.
 */
function estraiDaPdf(buf: Buffer): { testo: string; leggibile: boolean } {
  const grezzo = buf.toString('latin1');

  // 1. Testo in chiaro nei flussi non compressi (molti PDF generati da software).
  const nonCompresso = estraiOperatoriTesto(grezzo);

  // 2. Flussi compressi FlateDecode: si gonfia e si prova di nuovo.
  const inflati: string[] = [];
  const re = /stream\r?\n?([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(grezzo)) !== null) {
    const t = tryInflate(Buffer.from(m[1], 'latin1'));
    if (t) inflati.push(t);
  }
  let testo = nonCompresso;
  for (const s of inflati) testo += ' ' + estraiOperatoriTesto(s);

  testo = testo
    .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\[rn]/g, ' ')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Un PDF con font subset e cifratura custom produce sequenze senza spazi e
  // senza parole riconoscibili: meglio dirlo che passare rumore all'AI.
  const leggibile = /[A-Za-z]{3}/.test(testo);
  return { testo, leggibile };
}

/** Ricava il testo dagli operatori di testo PDF presenti in un chunk. */
function estraiOperatoriTesto(s: string): string {
  let fuori = '';
  // (testo) Tj   e   [(a) -20 (b)] TJ
  const ri = /\((?:\\.|[^\\()])*\)\s*Tj|\[((?:\((?:\\.|[^\\()])*\)|[^\]])*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = ri.exec(s)) !== null) {
    const pezzo = m[1] !== undefined ? m[1] : m[0];
    fuori += (pezzo.match(/\((?:\\.|[^\\()])*\)/g) || [])
      .map((t) => t.slice(1, -1))
      .join('') + ' ';
  }
  return fuori;
}

/** Tenta zlib/gzip; torna null se il chunk non era compresso. */
function tryInflate(b: Buffer): string | null {
  const zlib = require('zlib');
  for (const fn of ['inflateSync', 'gunzipSync'] as const) {
    try {
      return zlib[fn](b).toString('latin1');
    } catch {
      /* non era di questo tipo */
    }
  }
  return null;
}

/**
 * Estrae il testo da un DOCX: e' uno ZIP, e il documento sta in
 * word/document.xml come XML in chiaro. I paragrafi sono separati da w:p.
 */
function estraiDaDocx(buf: Buffer): { testo: string; leggibile: boolean } {
  const testo = testoDaXmlDocumentoXml(buf.toString('latin1')) ||
                testoDaZipSenzaLib(buf);
  return { testo: testo || '', leggibile: /[A-Za-z]{3}/.test(testo || '') };
}

function testoDaXmlDocumentoXml(x: string): string {
  const m = /<w:document\b[\s\S]*<\/w:document>/.exec(x);
  const corpo = m ? m[0] : x;
  return corpo
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Ultimo tentativo per il DOCX: ricerca l'XML dentro l'archivio ZIP compresso
 * e lo gonfia. Serve quando l'XML non e' in chiaro (DOCX compressi).
 */
function testoDaZipSenzaLib(buf: Buffer): string {
  const zlib = require('zlib');
  let testo = '';
  // Cerca la firma PK\x03\x04 e prova a estrarre i membri compressi.
  const re = /PK\x03\x04[\s\S]{22}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buf.toString('latin1'))) !== null) {
    const off = m.index;
    try {
      const metodo = buf.readUInt16LE(off + 8);
      const nomeLen = buf.readUInt16LE(off + 26);
      const extraLen = buf.readUInt16LE(off + 28);
      const nome = buf.subarray(off + 30, off + 30 + nomeLen).toString('utf8');
      if (!nome.endsWith('word/document.xml')) continue;
      const inizio = off + 30 + nomeLen + extraLen;
      const grezzo = buf.subarray(inizio, inizio + 400000);
      const s = metodo === 0 ? grezzo.toString('utf8') : zlib.inflateRawSync(grezzo).toString('utf8');
      testo += testoDaXmlDocumentoXml(s);
    } catch {
      /* membro non leggibile: si prosegue con gli altri */
    }
  }
  return testo;
}

export interface FileRisolto {
  /** Testo da passare all'AI (vuoto se il file e' un'immagine). */
  testo: string;
  /** Data URL inline, solo per le immagini. */
  inlineDataUrl?: string;
  /** Perche' non c'e' testo (per messaggi comprensibili all'utente). */
  nota?: string;
}

/**
 * Punto d'ingresso: da data URL a materiale utilizzabile dall'AI.
 */
export function risolviFilePerAI(dataUrl: string): FileRisolto {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { testo: '', nota: 'File non riconosciuto.' };

  const { mime, base64 } = parsed;
  const buf = Buffer.from(base64, 'base64');

  if (mime.startsWith('image/')) {
    // L'AI legge le immagini: si passa il file com'e', ma in linea.
    // Il data URL e' lo stesso identico formato; cambia solo il campo della
    // richiesta (inline_data invece di file_uri).
    return { testo: '', inlineDataUrl: dataUrl };
  }

  if (mime === 'application/pdf' || mime.endsWith('/pdf')) {
    const { testo, leggibile } = estraiDaPdf(buf);
    if (!testo) return { testo: '', nota: 'Il PDF non contiene testo estraibile: e\' probabilmente una scansione (immagine). Esportalo come immagine PNG e ricaricalo.' };
    if (!leggibile) return { testo: '', nota: 'Il PDF usa un carattere non estraibile. Esportalo come immagine PNG e ricaricalo.' };
    return { testo: testo.slice(0, LIMITE_TESTO) };
  }

  if (mime.includes('wordprocessingml') || mime.includes('officedocument')) {
    const { testo } = estraiDaDocx(buf);
    if (!testo) return { testo: '', nota: 'Il DOCX non contiene testo leggibile.' };
    return { testo: testo.slice(0, LIMITE_TESTO) };
  }

  if (mime === 'text/plain' || mime.startsWith('text/')) {
    return { testo: buf.toString('utf8').slice(0, LIMITE_TESTO) };
  }

  return {
    testo: '',
    nota: `Formato non supportato (${mime}). Carica un PDF, un DOCX o un'immagine.`,
  };
}
