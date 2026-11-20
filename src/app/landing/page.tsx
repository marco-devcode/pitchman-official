'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Bot,
  Camera,
  Check,
  Clock,
  Layers,
  Menu,
  Pause,
  Play,
  Share2,
  Shield,
  TrendingUp,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

// ── Tipi rigorosi per i moduli della cabina settimanale e i ruoli ────────────

type CabinRowId =
  | 'ocr'
  | 'rondo'
  | 'setpieces'
  | 'tests'
  | 'depth'
  | 'best11'
  | 'live'
  | 'png'
  | 'csv';

type RoleTabId = 'coach' | 'director' | 'trainer';

interface CabinRow {
  id: CabinRowId;
  area: string;
  title: string;
  detail: string;
  status: string;
  tag: string;
}

interface RoleTour {
  id: RoleTabId;
  label: string;
  headline: string;
  summary: string;
  hrefLabel: string;
  metrics: { label: string; value: string }[];
  rows: { title: string; meta: string; status: string }[];
}

interface PlanSpec {
  id: string;
  name: string;
  price: string;
  period: string;
  audience: string;
  badge?: string;
  featured?: boolean;
  cta: string;
  features: string[];
}

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

// ── Dati reali della piattaforma PitchMan ────────────────────────────────────

const PITCH_433_SLOTS = [
  { role: 'POR', name: '1. Rossi', x: '50%', y: '86%', tone: '#fde047' },
  { role: 'TD', name: '2. Conti', x: '82%', y: '68%', tone: '#38bdf8' },
  { role: 'DC', name: '5. Neri', x: '62%', y: '72%', tone: '#38bdf8' },
  { role: 'DC', name: '6. Villa', x: '38%', y: '72%', tone: '#38bdf8' },
  { role: 'TS', name: '3. Mori', x: '18%', y: '68%', tone: '#38bdf8' },
  { role: 'CDC', name: '4. Gallo', x: '50%', y: '52%', tone: '#b1e605' },
  { role: 'CD', name: '8. Ricci', x: '72%', y: '42%', tone: '#b1e605' },
  { role: 'CS', name: '10. Bruno', x: '28%', y: '42%', tone: '#b1e605' },
  { role: 'AD', name: '7. Leone', x: '78%', y: '21%', tone: '#fb7185' },
  { role: 'ATT', name: '9. Greco', x: '50%', y: '14%', tone: '#fb7185' },
  { role: 'AS', name: '11. Sala', x: '22%', y: '21%', tone: '#fb7185' },
];

const CABIN_ROWS: CabinRow[] = [
  {
    id: 'ocr',
    area: 'Rosa',
    title: 'Distinta FIGC Giornata 14',
    detail: '22 atleti estratti da foto',
    status: 'Pronta',
    tag: 'OCR Gemini',
  },
  {
    id: 'rondo',
    area: 'Martedì',
    title: 'Possesso 4v2 in zona',
    detail: '3 varianti AI · 2D continuo',
    status: 'Attivo',
    tag: 'Lavagna 2D',
  },
  {
    id: 'setpieces',
    area: 'Giovedì',
    title: 'Palle inattive e tiro',
    detail: 'Appello 19 presenti / 22',
    status: 'In archivio',
    tag: 'Seduta',
  },
  {
    id: 'tests',
    area: 'Test',
    title: 'Sprint 30m e Yo-Yo IR1',
    detail: 'Delta medio -0.14 s su aprile',
    status: 'Aggiornato',
    tag: 'Performance',
  },
  {
    id: 'depth',
    area: 'Moduli',
    title: 'Copertura 13 ruoli · 4-3-3',
    detail: 'TS: 1 ruolo + 2 osservati',
    status: 'Verifica',
    tag: 'Depth Chart',
  },
  {
    id: 'best11',
    area: 'AI',
    title: 'Convocazioni e Best 11',
    detail: 'Incrocio presenze e forma',
    status: 'Suggerita',
    tag: 'Gemini AI',
  },
  {
    id: 'live',
    area: 'Domenica',
    title: "Cronaca live · recuperi +3' / +5'",
    detail: 'Minuti reali per titolari e cambi',
    status: 'In diretta',
    tag: 'Timer',
  },
  {
    id: 'png',
    area: 'Export',
    title: 'Distinta PNG per WhatsApp',
    detail: 'Campo grafico ad alta densità',
    status: 'Condivisa',
    tag: '1 Tap',
  },
  {
    id: 'csv',
    area: 'Report',
    title: 'Report minutaggi CSV',
    detail: 'Esportazione stagione 2026/27',
    status: 'Sincronizzato',
    tag: 'IndexedDB',
  },
];

const ROLE_TOURS: RoleTour[] = [
  {
    id: 'coach',
    label: 'Guida la prima squadra',
    headline: 'Dalle convocazioni del venerdì al tabellino della domenica sera.',
    summary:
      'Incrocia le presenze settimanali in allenamento con la copertura dei 13 ruoli tattici su 7 moduli. Durante la partita il cronometro flottante calcola i minuti effettivi inclusi i recuperi e genera la distinta grafica per WhatsApp.',
    hrefLabel: 'Apri il profilo allenatore',
    metrics: [
      { label: 'Ruoli mappati per atleta', value: '13 ruoli' },
      { label: 'Moduli pronti su lavagna', value: '7 moduli' },
      { label: 'Generazione distinta grafica', value: 'PNG 1 tap' },
    ],
    rows: [
      { title: 'AI Best 11 · Modulo 4-3-3', meta: 'Basata su ultime 4 sedute e minutaggio', status: '98% idoneità' },
      { title: 'Cronometro Match · 2° Tempo', meta: 'Gol Greco 64’ · Cambio Mori → Rossi 71’', status: '+5’ recupero' },
      { title: 'Smart Import Calendario & Rosa', meta: 'Foto distinta o testo federale andata/ritorno', status: '26 gare' },
    ],
  },
  {
    id: 'director',
    label: 'Coordina il settore',
    headline: 'Tutte le squadre del club e gli osservati in un registro condiviso.',
    summary:
      'Controlla Prima Squadra, Juniores e categorie giovanili senza chiedere file Excel o screenshot settimanali. Condividi ogni stagione con il codice invito S-XXXXX e promuovi in rosa i giocatori seguiti in scouting.',
    hrefLabel: 'Esplora la vista società',
    metrics: [
      { label: 'Dashboard aggregata club', value: 'Fino a 5 team' },
      { label: 'Codice invito staff tecnico', value: 'S-XXXXX' },
      { label: 'Promozione diretta da Scout', value: '1 click' },
    ],
    rows: [
      { title: 'Prima Squadra · Eccellenza', meta: '22 atleti · 14 gare giocate · 28 gol fatti', status: 'Sincronizzata' },
      { title: 'Juniores U19 · Regionale', meta: '20 atleti · 12 gare · 91% presenze medie', status: 'Sincronizzata' },
      { title: 'Hub Scouting (/scout)', meta: 'Terzino Sinistro U21 · Valutazione A · Promuovi', status: '7 osservati' },
    ],
  },
  {
    id: 'trainer',
    label: 'Pianifica i carichi',
    headline: 'Lavagna 2D animata per ogni seduta e delta dei test fisici nel tempo.',
    summary:
      'Prepara gli esercizi con la lavagna Konva a movimento continuo tra gli step, ottieni 3 varianti progressive tramite Gemini AI oppure digitalizza una lavagna fotografata e misura Sprint, Yo-Yo, Cooper e salto CMJ.',
    hrefLabel: 'Vedi la sezione allenamento',
    metrics: [
      { label: 'Progressioni AI per esercizio', value: '3 varianti' },
      { label: 'Input immagine lavagna fisica', value: 'Vision 2D' },
      { label: 'Storico miglioramenti atletici', value: 'Delta auto' },
    ],
    rows: [
      { title: 'Rondo 4v2 con zona centrale', meta: 'Base, Progressione 1, Progressione 2 · step continui', status: 'Animata 2D' },
      { title: 'Test Sprint 30 metri · Gruppo', meta: 'Media rosa 4.18 s (−0.11 s rispetto a ottobre)', status: 'Delta −2.6%' },
      { title: 'Focus settimanali & appello', meta: '40% tattica, 35% possesso, 25% metabolico', status: '19/22 presenti' },
    ],
  },
];

const PLANS: PlanSpec[] = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: 'per sempre',
    audience: 'Per iniziare a sostituire fogli Excel, note sparse e messaggi sul campo.',
    cta: 'Inizia gratis',
    features: [
      'Rosa completa fino a 20 atleti per stagione',
      'Calendario gare, convocazioni e appello sedute',
      'Cronometro match live con recuperi automatici',
      'Copertura 7 moduli e distinta PNG per WhatsApp',
      'Modalità offline-first su smartphone e desktop',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Coach',
    price: '€4,99',
    period: 'al mese',
    audience: 'Per allenatori che usano AI tattica, OCR distinte e statistiche avanzate.',
    badge: 'Gratis in fase MVP',
    featured: true,
    cta: 'Inizia gratis',
    features: [
      'Atleti e stagioni illimitati nel cloud',
      'Smart Import AI da foto distinta o testo gare',
      'Lavagna 2D + 3 varianti AI e conversione da foto',
      'AI Best 11 e Coach AI sui dati della stagione',
      'Analisi Casa/Trasferta, fasce 15’ e export CSV',
    ],
  },
  {
    id: 'society',
    name: 'Society & Staff',
    price: '€19,99',
    period: 'al mese',
    audience: 'Per Direttori Sportivi e club con più categorie tecniche e staff esteso.',
    badge: 'Gratis in fase MVP',
    cta: 'Inizia gratis',
    features: [
      'Tutte le funzioni di Pro Coach incluse',
      'Dashboard Director multi-squadra fino a 5 team',
      'Archivio Scouting centralizzato con promozione diretta',
      'Accessi staff condivisi tramite codice invito S-XXXXX',
      'Separazione ruoli Coach, Director e Player',
    ],
  },
];

const FAQ_LIST: FaqItem[] = [
  {
    id: 'f1',
    q: 'PitchMan è davvero gratuito in questa fase?',
    a: 'Sì. Durante il rilascio pubblico MVP tutte le funzioni — inclusi i motori Gemini AI, la lavagna 2D e il cronometro match live — sono attive gratuitamente senza carta di credito.',
  },
  {
    id: 'f2',
    q: 'Funziona nello spogliatoio o in campi senza segnale?',
    a: 'Sì. L’app salva l’archivio in locale con IndexedDB e coda di sincronizzazione automatica. Puoi consultare la rosa e registrare gol, cambi o presenze offline e sincronizzare appena torna la rete.',
  },
  {
    id: 'f3',
    q: 'Come funziona l’importazione da foto o testo?',
    a: 'Carichi una foto della distinta o incolli il testo del calendario federale anche con date di andata e ritorno. Il parser estrae nomi, ruoli e giornate strutturandoli subito nella stagione.',
  },
  {
    id: 'f4',
    q: 'Posso condividere la stagione con il mio vice o preparatore?',
    a: 'Sì. Generi un codice invito univoco nel formato S-XXXXX dalle impostazioni della stagione e ogni membro dello staff accede agli stessi dati secondo il proprio ruolo.',
  },
  {
    id: 'f5',
    q: 'Per quale tipo di squadra è progettato PitchMan?',
    a: 'PitchMan è costruito specificamente per squadre di calcio a 11 e settori giovanili (dilettanti, regionali e club FIGC/LND). Non è pensato per basket, volley o gestione tornei multi-sport.',
  },
  {
    id: 'f6',
    q: 'I dati della società e dei giocatori restano privati?',
    a: 'Sì. Ogni stagione è isolata da regole di sicurezza lato database, connessioni cifrate e controllo degli accessi per squadra. Puoi esportare i dati in CSV o eliminare l’account in qualunque momento.',
  },
];

const WORKFLOW_STATEMENT =
  'Quando il mister registra un cambio nel recupero, il minutaggio aggiorna la scheda dell’atleta, il suggerimento AI della settimana dopo e il report del direttore sportivo. Un solo dato, scritto una volta sola.';

// Componente freccia animata da motion.css
function AnimatedArrow() {
  return (
    <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path className="m-arrow__stem" d="M1 6h8" />
      <path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}

// Marchio geometrico campo + modulo PitchMan (nitido a ogni risoluzione)
function PitchManMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="2"
        stroke="var(--accent)"
        strokeWidth="1.5"
      />
      <line x1="12" y1="4.5" x2="12" y2="19.5" stroke="var(--accent)" strokeWidth="1.2" opacity="0.65" />
      <circle cx="9" cy="12" r="2" fill="var(--accent)" />
      <circle cx="15.5" cy="8.5" r="1.75" fill="var(--bg)" />
      <circle cx="15.5" cy="15.5" r="1.75" fill="var(--bg)" />
    </svg>
  );
}

export default function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Stato interattivo UI
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCabinId, setActiveCabinId] = useState<CabinRowId>('live');
  const [cabinPaused, setCabinPaused] = useState(false);
  const [ocrLoopIndex, setOcrLoopIndex] = useState(0);
  const [ocrPaused, setOcrPaused] = useState(false);
  const [drillPaused, setDrillPaused] = useState(false);
  const [laneIndex, setLaneIndex] = useState(0);
  const [lanesPaused, setLanesPaused] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleTabId>('coach');
  const [highlightCount, setHighlightCount] = useState(14);
  const [showActionBar, setShowActionBar] = useState(false);

  const heroCtaRef = useRef<HTMLAnchorElement | null>(null);
  const closeCtaRef = useRef<HTMLAnchorElement | null>(null);
  const momentRef = useRef<HTMLParagraphElement | null>(null);

  const primaryHref = isAuthenticated ? '/' : '/login';
  const primaryLabel = isAuthenticated ? 'Apri la dashboard' : 'Inizia gratis';

  const statementWords = WORKFLOW_STATEMENT.split(' ');
  const activeCabin = CABIN_ROWS.find((r) => r.id === activeCabinId) ?? CABIN_ROWS[0];
  const currentRoleTour = ROLE_TOURS.find((r) => r.id === activeRole) ?? ROLE_TOURS[0];

  // Ciclo automatico discreto per il workspace app-frame (3.2s, con tasto pausa)
  useEffect(() => {
    if (cabinPaused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const order: CabinRowId[] = ['live', 'ocr', 'rondo', 'best11', 'depth'];
    const id = window.setInterval(() => {
      setActiveCabinId((prev) => {
        const idx = order.indexOf(prev);
        return order[(idx + 1) % order.length];
      });
    }, 3200);
    return () => window.clearInterval(id);
  }, [cabinPaused]);

  // Ciclo automatico per il pannello OCR (3.2s, con tasto pausa)
  useEffect(() => {
    if (ocrPaused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = window.setInterval(() => {
      setOcrLoopIndex((i) => (i + 1) % 3);
    }, 3200);
    return () => window.clearInterval(id);
  }, [ocrPaused]);

  // Ciclo automatico per il diagramma a 3 corsie (3.2s, con tasto pausa)
  useEffect(() => {
    if (lanesPaused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = window.setInterval(() => {
      setLaneIndex((i) => (i + 1) % 3);
    }, 3200);
    return () => window.clearInterval(id);
  }, [lanesPaused]);

  // Dealt moment: word-highlight legato allo scroll passivo nella propria sezione
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setHighlightCount(statementWords.length);
      return;
    }

    const updateHighlight = () => {
      const el = momentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.85;
      const end = vh * 0.42;
      const progress = Math.max(0, Math.min(1, (start - rect.top) / Math.max(1, start - end + rect.height)));
      const nextCount = Math.max(4, Math.round(progress * statementWords.length));
      setHighlightCount(nextCount);
    };

    updateHighlight();
    window.addEventListener('scroll', updateHighlight, { passive: true });
    window.addEventListener('resize', updateHighlight, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateHighlight);
      window.removeEventListener('resize', updateHighlight);
    };
  }, [statementWords.length]);

  // Nasconde la barra azione mobile finché uno dei due CTA principali è visibile
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    let heroVisible = true;
    let closeVisible = false;

    const sync = () => setShowActionBar(!heroVisible && !closeVisible);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === heroCtaRef.current) heroVisible = entry.isIntersecting;
          if (entry.target === closeCtaRef.current) closeVisible = entry.isIntersecting;
        }
        sync();
      },
      { threshold: 0.1 },
    );

    if (heroCtaRef.current) observer.observe(heroCtaRef.current);
    if (closeCtaRef.current) observer.observe(closeCtaRef.current);
    return () => observer.disconnect();
  }, []);

  // Blocca scroll pagina sotto al menu mobile aperto
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const h1Lines = ['Software tattico per', 'squadre di calcio'];

  return (
    <>
      {/* ── 1. HEADER FISSO OPACO ───────────────────────────────────────────── */}
      <header className={`nav ground-base${mobileMenuOpen ? ' is-open' : ''}`}>
        <div className="wrap nav__bar">
          <a className="skip-link" href="#top">
            Salta al contenuto
          </a>

          <a className="nav__logo" href="#top">
            <PitchManMark size={24} />
            <span>PitchMan</span>
          </a>

          <nav className="nav__links" aria-label="Navigazione principale">
            <div className="nav__item">
              <a className="nav__link" href="#cabina" onClick={() => setMobileMenuOpen(false)}>
                Cabina
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#moduli" onClick={() => setMobileMenuOpen(false)}>
                Moduli
                <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M3 4.5l3 3 3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <div className="nav__menu">
                <div className="wrap grid">
                  <a href="#moduli" className="menu-card span-4">
                    <span className="t-label muted">Gemini OCR & AI</span>
                    <span className="t-card">Importa rosa e gare da foto</span>
                    <span className="t-small">Estrazione automatica da distinta o testo</span>
                  </a>
                  <a href="#moduli" className="menu-card span-4">
                    <span className="t-label muted">Motore Konva 2D</span>
                    <span className="t-card">Lavagna esercizi multi-step</span>
                    <span className="t-small">Animazione continua e 3 varianti AI</span>
                  </a>
                  <a href="#moduli" className="menu-card span-4">
                    <span className="t-label muted">Match & Ruoli</span>
                    <span className="t-card">Cronometro live e 13 ruoli</span>
                    <span className="t-small">Recuperi esatti, scouting e test fisici</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#metodo" onClick={() => setMobileMenuOpen(false)}>
                Metodo
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#ruoli" onClick={() => setMobileMenuOpen(false)}>
                Ruoli
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#piani" onClick={() => setMobileMenuOpen(false)}>
                Piani
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#domande" onClick={() => setMobileMenuOpen(false)}>
                Domande
              </a>
            </div>
          </nav>

          <div className="nav__actions">
            {!isAuthenticated && (
              <Link href="/login" className="nav__link" onClick={() => setMobileMenuOpen(false)}>
                Accedi
              </Link>
            )}
            <Link
              href={primaryHref}
              className="btn btn--primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{primaryLabel}</span>
              <AnimatedArrow />
            </Link>
          </div>

          <button
            type="button"
            className="nav__toggle"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <main id="top" className="pm-main">
        {/* ── 2. SCHERMO 1 · HERO SPLIT ─────────────────────────────────────── */}
        <section className="hero hero--split ground-base" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text grid hero-split">
              <div className="hero-copy span-5">
                <p className="hero-notice pm-enter-1">
                  <span className="hero-notice__dot" aria-hidden="true" />
                  <span>Stagione 2026/27 · Accesso completo gratuito in fase MVP</span>
                </p>

                <h1 id="hero-h">
                  {h1Lines.map((line, lineIdx) => (
                    <span key={line} className="block">
                      {line.split(' ').map((word, wIdx) => (
                        <React.Fragment key={`${lineIdx}-${wIdx}`}>
                          <span className="pm-w">
                            <span
                              className="pm-w__in"
                              style={{ animationDelay: `${lineIdx * 80 + wIdx * 24}ms` }}
                            >
                              {word}
                            </span>
                          </span>{' '}
                        </React.Fragment>
                      ))}
                    </span>
                  ))}
                </h1>

                <p className="hero__lead pm-enter-2">
                  Un unico archivio per rosa su 13 ruoli, lavagna 2D animata con Gemini AI,
                  cronometro partita con recupero e test atletici. Funziona anche offline negli
                  spogliatoi.
                </p>

                <div className="btn-row pm-enter-3">
                  <Link ref={heroCtaRef} href={primaryHref} className="btn btn--primary">
                    <span>{primaryLabel}</span>
                    <AnimatedArrow />
                  </Link>
                  <a href="#cabina" className="btn btn--secondary">
                    Vedi la cabina
                  </a>
                </div>

                <dl className="hero-facts pm-enter-3">
                  <div>
                    <dt>Copertura rosa</dt>
                    <dd>13 ruoli · 7 moduli</dd>
                  </div>
                  <div>
                    <dt>Lavagna 2D AI</dt>
                    <dd>3 varianti per esercizio</dd>
                  </div>
                  <div>
                    <dt>Archivio locale</dt>
                    <dd>Offline PWA IndexedDB</dd>
                  </div>
                </dl>
              </div>

              {/* Destra Hero: Campo live dentro pannello luminoso sage + unica float card piatta */}
              <div
                className="hero-visual panel--sage span-6 start-7 pm-enter-media"
                role="img"
                aria-label="Campo tattico PitchMan 4-3-3 con cronometro partita in diretta"
              >
                <div className="stage stage--fade-b" style={{ padding: '24px 24px 0' }}>
                  <div className="ui-frag h-full flex flex-col">
                    <div className="ui-head justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="ui-dots" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </div>
                        <span className="text-[13px] font-medium text-[#f3f5f1]">
                          Distinta e campo · 4-3-3
                        </span>
                      </div>
                      <span className="ui-chip ui-chip--accent">Match Center</span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
                      {/* Barra gara live */}
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#1b201c] border border-white/10">
                        <div>
                          <div className="text-[12px] text-[#98a29a]">
                            Campionato · Giornata 14
                          </div>
                          <div className="text-[14px] font-medium text-[#f3f5f1]">
                            PitchMan FC vs Atletico Nord
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-[#b1e605]/15 border border-[#b1e605]/35 text-[#b1e605] font-mono text-[14px] font-medium">
                            2 - 1
                          </span>
                          <span className="px-2 py-1 rounded bg-white/10 text-[#f3f5f1] font-mono text-[13px]">
                            68:14
                          </span>
                        </div>
                      </div>

                      {/* Campo tattico reale 11 giocatori */}
                      <div className="relative flex-1 min-h-[260px] rounded-xl bg-[#0e1911] border border-white/10 overflow-hidden">
                        <div className="absolute inset-3 border border-white/15 rounded-lg pointer-events-none" />
                        <div className="absolute top-1/2 left-3 right-3 h-px bg-white/15 pointer-events-none" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/15 pointer-events-none" />
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-10 border-b border-x border-white/15 pointer-events-none" />
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-28 h-10 border-t border-x border-white/15 pointer-events-none" />

                        {PITCH_433_SLOTS.map((slot) => (
                          <div
                            key={slot.name}
                            style={{ left: slot.x, top: slot.y }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                          >
                            <span
                              style={{ borderColor: slot.tone, color: slot.tone }}
                              className="px-1.5 py-0.5 rounded bg-[#0a0d0b]/95 border font-mono text-[11px] font-medium leading-none"
                            >
                              {slot.role}
                            </span>
                            <span className="text-[11px] font-medium text-[#f3f5f1] mt-0.5 whitespace-nowrap">
                              {slot.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unica float card piatta in basso a sinistra */}
                <div className="ly-float">
                  <div className="ly-float__row">
                    <span className="ly-live">In diretta · 68&apos;</span>
                    <span>+5&apos; recupero stimato</span>
                  </div>
                  <div className="ly-float__title">
                    64&apos; Gol Greco (Ass. Bruno) · Minutaggio aggiornato
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. SCHERMO 2 · APP-FRAME (CABINA UNICA SETTIMANALE) ──────────── */}
        <section id="cabina" className="ground-surface" aria-labelledby="cabina-h">
          <div className="wrap">
            <div className="grid grid--top mb-8">
              <div className="span-5">
                <h2 id="cabina-h">Tutta la settimana tecnica in una finestra.</h2>
              </div>
              <div className="span-6 start-7 space-y-4">
                <p className="t-lead">
                  Dalla distinta fotografata il lunedì ai minutaggi reali della domenica: ogni
                  membro dello staff lavora sullo stesso archivio, senza file doppi.
                </p>
                <Link href={primaryHref} className="link">
                  Prova con la tua rosa
                </Link>
              </div>
            </div>

            {/* App Frame 5fr list + 7fr open inspector (cards.md / app-frame) */}
            <div
              className="ui-app fill"
              role="region"
              aria-label="Anteprima cabina gestionale settimanale PitchMan"
            >
              {/* Pane sinistro: lista moduli settimana */}
              <div className="ui-app__pane">
                <div className="ui-head justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="ui-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="text-[13px] font-medium">Settimana 14 · Stagione 2026/27</span>
                  </div>
                  <span className="text-[12px] text-[#98a29a] font-mono">22 atleti</span>
                </div>

                <div className="flex-1 overflow-hidden">
                  {CABIN_ROWS.map((row) => {
                    const isSelected = row.id === activeCabin.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setCabinPaused(true);
                          setActiveCabinId(row.id);
                        }}
                        className={`ui-row-btn${isSelected ? ' is-active' : ''}`}
                      >
                        <span className="text-[11px] font-mono text-[#98a29a] truncate">
                          {row.area}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-[#f3f5f1] truncate">
                            {row.title}
                          </div>
                          <div className="text-[12px] text-[#98a29a] truncate">{row.detail}</div>
                        </div>
                        <span
                          className={`ui-chip ${isSelected ? 'ui-chip--accent' : ''}`}
                        >
                          {row.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pane destro: dettaglio operativo vivo della voce attiva */}
              <div className="ui-app__pane p-5 justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                    <div>
                      <span className="text-[12px] font-mono text-[#b1e605]">{activeCabin.tag}</span>
                      <h3 className="text-[20px] font-medium text-[#f3f5f1] mt-0.5">
                        {activeCabin.title}
                      </h3>
                    </div>
                    <span className="ui-chip ui-chip--accent">{activeCabin.status}</span>
                  </div>

                  <p className="text-[14px] text-[#98a29a] leading-relaxed">
                    {activeCabin.detail} · Collegamento automatico tra calendario, registro
                    presenze allenamento, copertura ruoli e statistiche stagionali.
                  </p>

                  {/* Scheda dinamica specifica del modulo selezionato */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 rounded-lg bg-[#1b201c] border border-white/10 space-y-2">
                      <div className="text-[12px] text-[#98a29a]">Stato sincronizzazione</div>
                      <div className="text-[15px] font-medium text-[#f3f5f1]">
                        IndexedDB locale + Cloud Firestore
                      </div>
                      <div className="text-[12px] text-[#b1e605] font-mono">
                        0 conflitti · codice S-48219
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#1b201c] border border-white/10 space-y-2">
                      <div className="text-[12px] text-[#98a29a]">Impatto su distinta e Best 11</div>
                      <div className="text-[15px] font-medium text-[#f3f5f1]">
                        Copertura 13 ruoli verificata
                      </div>
                      <div className="text-[12px] text-[#98a29a]">
                        11 titolari + 7 in panchina pronti
                      </div>
                    </div>
                  </div>

                  {/* Tabella sintetica collegata */}
                  <div className="rounded-lg bg-[#1b201c] border border-white/10 overflow-hidden">
                    <div className="grid grid-cols-4 px-3.5 py-2 border-b border-white/10 text-[12px] text-[#98a29a]">
                      <span>Atleta</span>
                      <span>Ruolo</span>
                      <span>Presenze</span>
                      <span className="text-right">Minuti</span>
                    </div>
                    {[
                      { name: '1. Rossi M.', role: 'POR', att: '14/14', min: "1.260'" },
                      { name: '4. Gallo L.', role: 'CDC · DC', att: '13/14', min: "1.148'" },
                      { name: '8. Ricci F.', role: 'CD · TRQ', att: '14/14', min: "1.192'" },
                      { name: '9. Greco A.', role: 'ATT · AD', att: '12/14', min: "1.034'" },
                    ].map((pl) => (
                      <div
                        key={pl.name}
                        className="grid grid-cols-4 px-3.5 py-2.5 border-b last:border-b-0 border-white/5 text-[13px] items-center"
                      >
                        <span className="font-medium text-[#f3f5f1] truncate">{pl.name}</span>
                        <span className="font-mono text-[12px] text-[#b1e605]">{pl.role}</span>
                        <span className="text-[#98a29a]">{pl.att}</span>
                        <span className="text-right font-mono text-[#f3f5f1]">{pl.min}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pulsante pausa 32px obbligatorio per il ciclo automatico */}
                <button
                  type="button"
                  className="loop-pause"
                  aria-label={cabinPaused ? 'Riprendi ciclo anteprima' : 'Metti in pausa ciclo anteprima'}
                  onClick={() => setCabinPaused((p) => !p)}
                >
                  {cabinPaused ? <Play size={13} /> : <Pause size={13} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. SCHERMI 3 E 4 · FEATURES 2X2 (.g2, 2 SCHERMI, 2 BOX DI PROFONDITÀ) ─── */}
        <section id="moduli" className="g2 ground-base" aria-labelledby="moduli-h">
          <div className="wrap">
            {/* Schermo 3: Titolo sezione + Prime 2 card */}
            <div className="group">
              <div className="section-head">
                <h2 id="moduli-h">
                  Quattro strumenti per il campo.{' '}
                  <span className="muted">Zero fogli sparsi tra spogliatoio e tribuna.</span>
                </h2>
              </div>

              <div className="grid">
                {/* Card 1: Smart Import OCR (unico loop nella griglia 2x2) */}
                <article
                  className="card card--row card--open m-nolift span-6"
                  onMouseEnter={() => {
                    if (!ocrPaused) setOcrLoopIndex((i) => (i + 1) % 3);
                  }}
                >
                  <h3>Importa rosa e calendario da una foto</h3>
                  <p>
                    Carica una distinta federale o incolla il testo del girone: Gemini estrae nomi,
                    ruoli primari e orari andata/ritorno in dieci secondi.
                  </p>
                  <div className="panel panel--sage">
                    <div className="stage stage--fade-br">
                      <div className="at-corner">
                        <div className="ui-frag">
                          <div className="ui-head justify-between">
                            <span className="inline-flex items-center gap-2 font-medium">
                              <Camera size={14} className="text-[#b1e605]" />
                              Smart Import OCR
                            </span>
                            <span className="ui-chip ui-chip--accent">
                              {ocrLoopIndex === 0
                                ? 'Scansione foto'
                                : ocrLoopIndex === 1
                                ? '22 atleti mappati'
                                : '26 gare salvate'}
                            </span>
                          </div>
                          <div className="p-3.5 space-y-2">
                            {[
                              { k: '5. Neri Marco', r: 'DC / CDC', ok: true },
                              { k: '8. Ricci Federico', r: 'CD / TRQ', ok: ocrLoopIndex >= 1 },
                              { k: 'Giornata 14 · Dom 15:00', r: 'Casa vs Atletico Nord', ok: ocrLoopIndex >= 2 },
                              { k: 'Giornata 15 · Dom 15:00', r: 'Trasf. @ Real Borgo', ok: ocrLoopIndex >= 2 },
                            ].map((item) => (
                              <div
                                key={item.k}
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-[#1b201c] border border-white/10 text-[13px]"
                              >
                                <span className="font-medium truncate">{item.k}</span>
                                <span
                                  className={`font-mono text-[12px] whitespace-nowrap ${
                                    item.ok ? 'text-[#b1e605]' : 'text-[#98a29a]'
                                  }`}
                                >
                                  {item.r}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="loop-pause"
                      aria-label={ocrPaused ? 'Riprendi scansione demo' : 'Pausa scansione demo'}
                      onClick={() => setOcrPaused((p) => !p)}
                    >
                      {ocrPaused ? <Play size={13} /> : <Pause size={13} />}
                    </button>
                  </div>
                </article>

                {/* Card 2: Lavagna 2D Konva + 3 Varianti AI (stato fermo + pausa animazione locale) */}
                <article className="card card--row card--open m-nolift span-6">
                  <h3>Disegna e anima esercizi su lavagna 2D</h3>
                  <p>
                    Ogni step prosegue dalle posizioni finali senza scatti. Genera tre progressioni
                    AI da testo oppure digitalizza una lavagna fotografata.
                  </p>
                  <div className={`panel panel--sky${drillPaused ? ' pm-is-paused' : ''}`}>
                    <div className="stage stage--fade-b">
                      <div className="at-rise">
                        <div className="ui-frag">
                          <div className="ui-head justify-between">
                            <span className="font-medium">Lavagna 2D · Rondo 4v2 + Scarico</span>
                            <span className="ui-chip">Base · Prog. 1 · Prog. 2</span>
                          </div>
                          <div className="p-3.5">
                            <div className="relative h-44 rounded-lg bg-[#0d1a11] border border-white/10 overflow-hidden">
                              <svg
                                className="w-full h-full"
                                viewBox="0 0 300 176"
                                preserveAspectRatio="xMidYMid meet"
                                aria-hidden="true"
                              >
                                {/* Zona tattica centrata (contratto Drill centro -> Konva) */}
                                <rect
                                  x="66"
                                  y="32"
                                  width="168"
                                  height="112"
                                  rx="6"
                                  fill="rgba(177, 230, 5, 0.1)"
                                  stroke="rgba(177, 230, 5, 0.65)"
                                  strokeWidth="1.2"
                                  strokeDasharray="4 4"
                                />
                                {/* Traiettorie passaggio + smarcamento */}
                                <line
                                  x1="62"
                                  y1="112"
                                  x2="150"
                                  y2="74"
                                  stroke="rgba(255,255,255,0.45)"
                                  strokeWidth="1.5"
                                />
                                <line
                                  x1="150"
                                  y1="74"
                                  x2="226"
                                  y2="112"
                                  stroke="#b1e605"
                                  strokeWidth="1.5"
                                  strokeDasharray="4 4"
                                />
                                {/* Pedina 4 */}
                                <g>
                                  <circle cx="62" cy="112" r="12" fill="#38bdf8" />
                                  <text
                                    x="62"
                                    y="116"
                                    textAnchor="middle"
                                    fill="#0a0d0b"
                                    fontSize="11"
                                    fontFamily="var(--font-mono)"
                                    fontWeight="600"
                                  >
                                    4
                                  </text>
                                </g>
                                {/* Pedina 8 in smarcamento */}
                                <g className="pm-drill-runner">
                                  <circle cx="150" cy="74" r="12" fill="#b1e605" />
                                  <text
                                    x="150"
                                    y="78"
                                    textAnchor="middle"
                                    fill="#0a0d0b"
                                    fontSize="11"
                                    fontFamily="var(--font-mono)"
                                    fontWeight="600"
                                  >
                                    8
                                  </text>
                                </g>
                                {/* Pedina 9 */}
                                <g>
                                  <circle cx="226" cy="112" r="12" fill="#fb7185" />
                                  <text
                                    x="226"
                                    y="116"
                                    textAnchor="middle"
                                    fill="#ffffff"
                                    fontSize="11"
                                    fontFamily="var(--font-mono)"
                                    fontWeight="600"
                                  >
                                    9
                                  </text>
                                </g>
                                {/* Pallone animato in continuita' */}
                                <circle
                                  cx="72"
                                  cy="112"
                                  r="5"
                                  fill="#ffffff"
                                  stroke="#0a0d0b"
                                  strokeWidth="1.5"
                                  className="pm-drill-ball"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="loop-pause"
                      aria-label={drillPaused ? 'Riprendi lavagna 2D' : 'Pausa lavagna 2D'}
                      onClick={() => setDrillPaused((p) => !p)}
                    >
                      {drillPaused ? <Play size={13} /> : <Pause size={13} />}
                    </button>
                  </div>
                </article>
              </div>
            </div>

            {/* Schermo 4: Seconda coppia di card (Match Live + Depth Chart & Test) */}
            <div className="group">
              <div className="grid">
                {/* Card 3: Match Timer & Eventi Live */}
                <article className="card card--row card--open m-nolift span-6">
                  <h3>Registra gol, cambi e recupero dal vivo</h3>
                  <p>
                    Il cronometro flottante calcola i minuti giocati reali inclusi i minuti di
                    recupero ed esporta la distinta in PNG ad alta risoluzione.
                  </p>
                  <div className="panel panel--sand">
                    <div className="stage stage--fade-br">
                      <div className="at-corner">
                        <div className="ui-frag">
                          <div className="ui-head justify-between">
                            <span className="inline-flex items-center gap-2 font-medium">
                              <Clock size={14} className="text-[#b1e605]" />
                              Cronometro & Eventi
                            </span>
                            <span className="font-mono text-[13px] text-[#b1e605]">68:14</span>
                          </div>
                          <div className="p-3.5 space-y-2">
                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#1b201c] border border-white/10">
                              <span className="font-medium">64&apos; Gol · Greco A.</span>
                              <span className="text-[12px] text-[#98a29a]">Assist Bruno L.</span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#1b201c] border border-white/10">
                              <span className="font-medium">71&apos; Sostituzione</span>
                              <span className="text-[12px] text-[#b1e605]">Out Mori · In Sala</span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#1b201c] border border-white/10">
                              <span className="inline-flex items-center gap-1.5 text-[#98a29a]">
                                <Share2 size={13} /> Distinta finale pronta
                              </span>
                              <span className="text-[12px] font-mono text-[#f3f5f1]">
                                Recupero +3&apos; / +5&apos;
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                {/* Card 4: Copertura 13 ruoli + Confronto & Test Atletici */}
                <article className="card card--row card--open m-nolift span-6">
                  <h3>Controlla i 13 ruoli e i delta atletici</h3>
                  <p>
                    Individua i reparti scoperti con l’archivio Scouting integrato e misura i delta
                    di Sprint, Yo-Yo, Cooper e CMJ per singolo atleta.
                  </p>
                  <div className="panel panel--sage">
                    <div className="stage stage--fade-b">
                      <div className="at-rise">
                        <div className="ui-frag">
                          <div className="ui-head justify-between">
                            <span className="inline-flex items-center gap-2 font-medium">
                              <Layers size={14} className="text-[#b1e605]" />
                              Depth Chart · Test Fisici
                            </span>
                            <span className="text-[12px] font-mono text-[#98a29a]">13 ruoli</span>
                          </div>
                          <div className="p-3.5 space-y-2">
                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#1b201c] border border-white/10">
                              <span>
                                <strong className="font-mono text-[#b1e605] mr-2">DC</strong>
                                Difensore Centrale
                              </span>
                              <span className="text-[12px] font-mono">4 in rosa</span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#1b201c] border border-white/10">
                              <span>
                                <strong className="font-mono text-[#fb7185] mr-2">TS</strong>
                                Terzino Sinistro
                              </span>
                              <span className="text-[12px] font-mono text-[#b1e605]">
                                1 + 2 scout
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#1b201c] border border-white/10">
                              <span className="inline-flex items-center gap-1.5">
                                <TrendingUp size={13} className="text-[#b1e605]" />
                                Sprint 30m · Greco
                              </span>
                              <span className="text-[12px] font-mono text-[#b1e605]">
                                4.04 s (−0.12 s)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. SCHERMO 5 · DEALT MOMENT (WORD-HIGHLIGHT) + ARCHITETTURA 3 CORSIE ─── */}
        <section
          id="metodo"
          className="ground-surface"
          data-moment="word-highlight"
          aria-labelledby="metodo-h"
        >
          <div className="wrap justify-between gap-8">
            <div className="space-y-4">
              <h2 id="metodo-h" className="t-label muted">
                Architettura a dato unico
              </h2>
              <p ref={momentRef} className="mo-wh__text">
                {statementWords.map((word, idx) => {
                  const clean = word.replace(/[.,]/g, '').toLowerCase();
                  const isAccentWord =
                    clean === 'minutaggio' || clean === 'ai' || clean === 'direttore';
                  const isOn = idx < highlightCount;
                  return (
                    <React.Fragment key={`${idx}-${word}`}>
                      <span
                        className={`mo-wh__w${isAccentWord ? ' is-accent' : ''}${
                          isOn ? ' is-on' : ''
                        }`}
                      >
                        {word}
                      </span>{' '}
                    </React.Fragment>
                  );
                })}
              </p>
            </div>

            {/* Diagramma a 3 corsie parallele: 1 input -> Core Offline+Cloud -> 3 ruoli */}
            <div className="dg-card" aria-label="Flusso dati tra campo, archivio locale e staff">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <span className="t-card">Un inserimento aggiorna tutto lo staff</span>
                <span className="inline-flex items-center gap-2 t-small muted">
                  <WifiOff size={15} />
                  Coda offline IndexedDB con sync automatico
                </span>
              </div>

              <div className="dg-grid">
                <div className={`dg-node${laneIndex === 0 ? ' is-lit' : ''}`}>
                  <div className="t-label muted mb-1">1. Acquisizione</div>
                  <div className="font-medium text-[16px]">Campo & Foto OCR</div>
                  <div className="t-small muted mt-1">Timer live · Lavagna 2D · Distinte</div>
                </div>

                <svg
                  className="dg-connector w-8 h-6 text-[var(--accent)] mx-auto"
                  viewBox="0 0 32 24"
                  aria-hidden="true"
                >
                  <path
                    d="M2 12h24m-5-5 5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <div className="dg-node is-core">
                  <div className="text-[13px] opacity-75 mb-1">2. Motore centrale</div>
                  <div className="font-medium text-[17px]">PitchMan Sync Core</div>
                  <div className="text-[13px] opacity-80 mt-1">
                    Minutaggi, 13 ruoli e stagioni in coda sicura
                  </div>
                </div>

                <svg
                  className="dg-connector w-8 h-6 text-[var(--accent)] mx-auto"
                  viewBox="0 0 32 24"
                  aria-hidden="true"
                >
                  <path
                    d="M2 12h24m-5-5 5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <div className="grid gap-2.5">
                  {[
                    { title: 'Mister · Best 11 & Formazioni', sub: 'Copertura 7 moduli aggiornata' },
                    { title: 'Direttore · Vista Club & Scout', sub: 'Report aggregati fino a 5 team' },
                    { title: 'Preparatore · Test & Sedute 2D', sub: 'Delta Sprint, Yo-Yo e appello' },
                  ].map((lane, idx) => (
                    <div
                      key={lane.title}
                      className={`dg-node py-2.5 px-3.5${laneIndex === idx ? ' is-lit' : ''}`}
                    >
                      <div className="font-medium text-[15px]">{lane.title}</div>
                      <div className="text-[13px] muted">{lane.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="loop-pause"
                aria-label={lanesPaused ? 'Riprendi diagramma flusso' : 'Pausa diagramma flusso'}
                onClick={() => setLanesPaused((p) => !p)}
              >
                {lanesPaused ? <Play size={13} /> : <Pause size={13} />}
              </button>
            </div>
          </div>
        </section>

        {/* ── 6. SCHERMO 6 · DARK BAND: TABS-TOUR PER RUOLO STAFF ──────────── */}
        <section id="ruoli" className="ground-inverse" aria-labelledby="ruoli-h">
          <div className="wrap">
            <div className="grid grid--top fill items-stretch gap-y-8">
              <div className="span-5 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <h2 id="ruoli-h">
                    Un accesso per ogni ruolo.{' '}
                    <span className="muted">Condividi la stagione con codice S-XXXXX.</span>
                  </h2>

                  <div className="tabs" role="tablist" aria-label="Viste per ruolo tecnico">
                    {ROLE_TOURS.map((role) => {
                      const selected = role.id === currentRoleTour.id;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          aria-controls={`panel-${role.id}`}
                          onClick={() => setActiveRole(role.id)}
                          className="tab"
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  id={`panel-${currentRoleTour.id}`}
                  role="tabpanel"
                  className="space-y-4 pt-2"
                >
                  <h3 className="text-[22px] font-medium text-[#f3f5f1]">
                    {currentRoleTour.headline}
                  </h3>
                  <p className="text-[16px] text-[#98a29a] leading-relaxed">
                    {currentRoleTour.summary}
                  </p>
                  <div className="pt-2">
                    <Link href={primaryHref} className="link">
                      {currentRoleTour.hrefLabel}
                    </Link>
                  </div>
                </div>
              </div>

              {/* Schermata fissa a destra che cambia solo su click */}
              <div className="span-6 start-7 frame--split flex flex-col justify-between gap-5">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[#f3f5f1]">
                    {currentRoleTour.id === 'coach' && <Bot size={16} className="text-[#b1e605]" />}
                    {currentRoleTour.id === 'director' && (
                      <Shield size={16} className="text-[#b1e605]" />
                    )}
                    {currentRoleTour.id === 'trainer' && (
                      <Activity size={16} className="text-[#b1e605]" />
                    )}
                    {currentRoleTour.label}
                  </span>
                  <span className="text-[12px] font-mono text-[#b1e605]">Stagione attiva</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {currentRoleTour.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="p-3.5 rounded-xl bg-[#0a0d0b] border border-white/10 space-y-1"
                    >
                      <div className="text-[20px] font-medium font-mono text-[#b1e605]">
                        {m.value}
                      </div>
                      <div className="text-[13px] text-[#98a29a]">{m.label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 flex-1">
                  {currentRoleTour.rows.map((item) => (
                    <div
                      key={item.title}
                      className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-[#0a0d0b] border border-white/10"
                    >
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium text-[#f3f5f1]">{item.title}</div>
                        <div className="text-[13px] text-[#98a29a]">{item.meta}</div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#b1e605]/15 text-[#b1e605] text-[12px] font-mono">
                        <Check size={12} />
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. SCHERMO 7 · PIANI TRASPARENTI (PRICING-THREE) ──────────────── */}
        <section id="piani" className="ground-base" aria-labelledby="piani-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="piani-h">
                Piani per allenatori e società.{' '}
                <span className="muted">Accesso completo gratuito durante la fase MVP.</span>
              </h2>
            </div>

            <div className="grid grid--top fill items-stretch">
              {PLANS.map((plan) => (
                <article
                  key={plan.id}
                  className={`card--plan span-4${plan.featured ? ' is-featured' : ''}`}
                >
                  <div className="plan__head">
                    <h3 className="text-[18px] font-medium">{plan.name}</h3>
                    {plan.badge && <span className="badge">{plan.badge}</span>}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="t-stat">{plan.price}</span>
                    <span className="t-small muted">{plan.period}</span>
                  </div>

                  <p className="t-body min-h-[3lh]">{plan.audience}</p>

                  <Link
                    href={primaryHref}
                    className={`btn w-full ${
                      plan.featured
                        ? 'btn--primary'
                        : 'border border-[var(--line-strong)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--ink)]'
                    }`}
                  >
                    <span>{isAuthenticated ? 'Apri la dashboard' : plan.cta}</span>
                    {plan.featured && <AnimatedArrow />}
                  </Link>

                  <ul className="checks">
                    {plan.features.map((feat) => (
                      <li key={feat}>{feat}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. SCHERMO 8 · DOMANDE FREQUENTI (TUTTE APERTE, ZERO ACCORDION) ── */}
        <section id="domande" className="ground-surface" aria-labelledby="domande-h">
          <div className="wrap">
            <div className="grid grid--top gap-y-8">
              <div className="span-5 space-y-5">
                <h2 id="domande-h">Domande frequenti</h2>
                <p className="t-lead muted">
                  Dettagli tecnici su accesso MVP, funzionamento offline, importazione AI e limiti
                  attuali della piattaforma.
                </p>
                <div className="pt-2">
                  <a href="mailto:losviluppatore@hotmail.com" className="link">
                    Scrivi al supporto tecnico
                  </a>
                </div>
              </div>

              <div className="span-6 start-7 faq">
                {FAQ_LIST.map((item) => (
                  <div key={item.id} className="faq__item">
                    <h3>{item.q}</h3>
                    <p>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── 9. SCHERMO 9 · CHIUSURA UNIFICATA E FOOTER SCURO ────────────────── */}
      <footer id="contact" className="footer closing footer--dark ground-inverse">
        <div className="wrap">
          <div className="closing__cta close--type">
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2>Prepara la prossima giornata in dieci minuti</h2>
              <p className="t-lead muted">
                Attiva il tuo account gratuito in fase MVP. Nessuna carta richiesta.
              </p>
            </div>

            <Link
              ref={closeCtaRef}
              href={primaryHref}
              className="btn btn--primary btn--xl btn--wide"
            >
              <span>{primaryLabel}</span>
              <AnimatedArrow />
            </Link>
          </div>

          <div className="closing__links">
            <div className="grid">
              <div className="span-4 space-y-3">
                <a className="nav__logo" href="#top">
                  <PitchManMark size={24} />
                  <span>PitchMan</span>
                </a>
                <p className="t-lead muted max-w-[28ch]">
                  Software tattico e gestionale per allenatori, preparatori e direttori sportivi.
                </p>
              </div>

              <div className="span-2 footer__col">
                <h3>Cabina</h3>
                <ul>
                  <li>
                    <a href="#cabina">Settimana</a>
                  </li>
                  <li>
                    <a href="#moduli">Importazione OCR</a>
                  </li>
                  <li>
                    <a href="#moduli">Lavagna 2D</a>
                  </li>
                </ul>
              </div>

              <div className="span-2 footer__col">
                <h3>Campo</h3>
                <ul>
                  <li>
                    <a href="#moduli">Cronometro live</a>
                  </li>
                  <li>
                    <a href="#moduli">13 ruoli</a>
                  </li>
                  <li>
                    <a href="#metodo">Architettura</a>
                  </li>
                </ul>
              </div>

              <div className="span-2 footer__col">
                <h3>Staff</h3>
                <ul>
                  <li>
                    <a href="#ruoli">Mister</a>
                  </li>
                  <li>
                    <a href="#ruoli">Direttore</a>
                  </li>
                  <li>
                    <a href="#ruoli">Preparatore</a>
                  </li>
                </ul>
              </div>

              <div className="span-2 footer__col">
                <h3>Accesso</h3>
                <ul>
                  <li>
                    <a href="#piani">Piani MVP</a>
                  </li>
                  <li>
                    <a href="#domande">Domande</a>
                  </li>
                  <li>
                    <Link href={primaryHref}>
                      {isAuthenticated ? 'Dashboard' : 'Accedi'}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="footer__legal">
              <span>
                © {new Date().getFullYear()} PitchMan ·{' '}
                <Link href="/privacy" className="underline underline-offset-4">
                  Privacy
                </Link>{' '}
                ·{' '}
                <Link href="/termini" className="underline underline-offset-4">
                  Termini
                </Link>
              </span>
              <span>
                Supporto:{' '}
                <a
                  href="mailto:losviluppatore@hotmail.com"
                  className="underline underline-offset-4"
                >
                  losviluppatore@hotmail.com
                </a>
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── BARRA AZIONE MOBILE FUORI DAL PRIMO SCHERMO ───────────────────────── */}
      <nav
        className={`actionbar${showActionBar ? '' : ' is-hidden'}`}
        aria-label="Azione rapida mobile"
      >
        <Link href={primaryHref} className="btn btn--primary">
          <span>{primaryLabel}</span>
          <AnimatedArrow />
        </Link>
      </nav>
    </>
  );
}
