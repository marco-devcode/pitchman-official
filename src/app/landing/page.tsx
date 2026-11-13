"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Timer,
  Shield,
  WifiOff,
  Share2,
  Activity,
  ClipboardList,
  Layers,
  Play,
  ChevronRight,
  Check,
  X,
  Flame,
  Crown,
  Building2,
  Bot,
  Camera,
  Clock,
  TrendingUp,
  Eye,
  Menu,
} from 'lucide-react';
import { GiWhistle, GiSoccerBall } from 'react-icons/gi';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useAuthStore } from '@/store/useAuthStore';

// ── Tipi rigorosi per i dati della landing ────────────────────────────────────

type TargetId = 'coach' | 'director' | 'trainer';
type HeroPreviewId = 'match' | 'ai' | 'depth';

interface TargetProfile {
  id: TargetId;
  badge: string;
  label: string;
  headline: string;
  description: string;
  metrics: { value: string; label: string }[];
  highlights: string[];
  icon: React.ElementType;
}

interface BentoFeature {
  id: string;
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  icon: React.ElementType;
  accent: 'green' | 'cyan' | 'yellow' | 'pink';
  span?: string;
}

interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  subtitle: string;
  mvpBadge?: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
}

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

// ── Dati strutturati ──────────────────────────────────────────────────────────

const TARGET_PROFILES: TargetProfile[] = [
  {
    id: 'coach',
    badge: 'Settore Giovanile & Dilettanti',
    label: 'Mister & Allenatore',
    icon: GiWhistle,
    headline: 'Formazione in 30 secondi, zero burocrazia nello spogliatoio.',
    description:
      'Smetti di rincorrere presenze su WhatsApp e calcolare i minuti giocati a mano la domenica sera. Gestisci rosa, convocazioni, cronaca live a bordo campo e analisi post-partita direttamente dal telefono — anche quando al campo non c’è segnale.',
    metrics: [
      { value: '2h+', label: 'Risparmiate ogni settimana' },
      { value: '13', label: 'Ruoli tattici mappati' },
      { value: '1 Tap', label: 'Distinta PNG per WhatsApp' },
    ],
    highlights: [
      'Controllo immediato della copertura dei 13 ruoli su 7 moduli tattici (4-3-3, 3-5-2, 4-2-3-1 e altri)',
      'Cronometro match flottante con registrazione istantanea di gol, assist, cartellini e cambi (incluso recupero)',
      'AI Best 11 che suggerisce i titolari incrociando presenze in allenamento, stato di forma e ruolo',
      'Importazione automatica di calendario federale e rosa da foto o testo incollato',
    ],
  },
  {
    id: 'director',
    badge: 'Società Sportive FIGC / LND',
    label: 'Direttore Sportivo',
    icon: Building2,
    headline: 'Tutte le squadre del club e lo scouting in un’unica cabina di regia.',
    description:
      'Supervisiona Prima Squadra, Juniores e Settore Giovanile senza chiedere screenshot o file Excel ai singoli mister. Analizza i risultati aggregati del club, gestisci gli osservati e coordina lo staff tecnico con accessi per ruolo.',
    metrics: [
      { value: 'Multi', label: 'Squadre e stagioni in cloud' },
      { value: 'S-CODE', label: 'Invito staff istantaneo' },
      { value: '100%', label: 'Archivio Scouting centralizzato' },
    ],
    highlights: [
      'Dashboard Director dedicata per monitorare andamento, gol e minutaggi di ogni categoria',
      'Modulo Scouting & Osservati (/scout) con schede talento, categorie personalizzate e promozione diretta in rosa',
      'Condivisione della stagione con assistenti e preparatori tramite codice invito sicuro S-XXXXX',
      'Esportazione immediata dei dati aggregati in CSV per report societari e riunioni tecniche',
    ],
  },
  {
    id: 'trainer',
    badge: 'Staff Tecnico & Performance',
    label: 'Preparatore Atletico',
    icon: Activity,
    headline: 'Lavagna 2D animata, AI Drill Generator e progressione dei test atletici.',
    description:
      'Progetta esercitazioni chiare per tutto lo staff, genera varianti tattiche con l’Intelligenza Artificiale e misura l’evoluzione fisica della squadra nel corso della stagione con grafici automatici dei delta.',
    metrics: [
      { value: '3x', label: 'Varianti AI per esercizio' },
      { value: '2D Live', label: 'Player tattico multi-step' },
      { value: 'Delta', label: 'Calcolo automatico progressi' },
    ],
    highlights: [
      'Lavagna 2D interattiva (Konva) per visualizzare movimenti di giocatori, palla, porte e coni step-by-step',
      'AI Drill Generator che crea 3 varianti complete (Facile, Media, Avanzata) con traiettorie validate',
      'Test fisici (Sprint, Yo-Yo, Cooper, CMJ) con rilevamento automatico dei miglioramenti in secondi o metri',
      'Distribuzione percentuale dei focus di allenamento e registro presenze integrato',
    ],
  },
];

const BENTO_FEATURES: BentoFeature[] = [
  {
    id: 'match-center',
    badge: 'Live Pitch Control',
    title: 'Match Center & Cronometro Live',
    description:
      'Timer flottante sempre visibile per registrare gol (azione, rigore, punizione, autogol + assist), cartellini e sostituzioni in tempo reale.',
    bullets: [
      'Calcolo esatto dei minuti giocati recuperi inclusi',
      'Condivisione formazione e distinta in PNG ad alta definizione su WhatsApp',
    ],
    icon: Timer,
    accent: 'green',
    span: 'lg:col-span-2',
  },
  {
    id: 'gemini-ai',
    badge: 'Powered by Gemini 2.5',
    title: 'Intelligenza Artificiale Tattica',
    description:
      'Tre motori AI integrati per eliminare il data-entry manuale e supportare le tue scelte tecniche.',
    bullets: [
      'Smart Import OCR: carica la foto di una distinta o incolla il calendario',
      'AI Best 11: undici titolare basato su allenamenti e forma',
      'Coach AI Assistant: chatbot tattico sui dati della tua stagione',
    ],
    icon: Bot,
    accent: 'cyan',
    span: 'lg:col-span-1',
  },
  {
    id: 'lavagna-2d',
    badge: 'Konva 2D Engine',
    title: 'Lavagna Esercizi Animata & AI Drill Generator',
    description:
      'Mostra le esercitazioni alla squadra con un player interattivo multi-step e genera automaticamente varianti di difficoltà.',
    bullets: [
      '3 varianti AI (Facile, Media, Avanzata) con riparazione deterministica delle traiettorie',
      'Libreria personale e condivisibile con tutto lo staff',
    ],
    icon: Play,
    accent: 'yellow',
    span: 'lg:col-span-1',
  },
  {
    id: 'depth-chart',
    badge: '13 Ruoli Calcistici',
    title: 'Rosa, Copertura Ruoli (Depth Chart) & Confronto',
    description:
      'Mappa ogni atleta su ruolo primario e secondario (POR, DC, TD, TS, ADA, ASA, CDC, CD, CS, TRQ, AD, AS, ATT) e scopri subito i buchi di organico.',
    bullets: [
      'Verifica istantanea su 7 moduli tattici (4-3-3, 4-4-2, 3-5-2, 4-2-3-1, ecc.)',
      'Confronto testa-a-testa tra due giocatori su presenze, gol, assist e rendimento',
    ],
    icon: Layers,
    accent: 'green',
    span: 'lg:col-span-2',
  },
  {
    id: 'training',
    badge: 'Gestione Sedute',
    title: 'Allenamenti & Presenze Smart',
    description:
      'Pianifica le sedute settimanali con focus percentuali, prendi l’appello con un tocco e collega gli esercizi dalla libreria.',
    bullets: [
      'Storico presenze collegato alle scelte di formazione',
      'Monitoraggio immediato di infortunati e assenti',
    ],
    icon: ClipboardList,
    accent: 'cyan',
  },
  {
    id: 'physical-tests',
    badge: 'Performance Lab',
    title: 'Test Atletici & Progressione',
    description:
      'Archivia misurazioni di Sprint, Yo-Yo, Cooper o salto CMJ e visualizza l’andamento di ogni atleta nel tempo.',
    bullets: [
      'Calcolo automatico dei delta in secondi o metri',
      'Grafici comparativi individuali e di squadra',
    ],
    icon: TrendingUp,
    accent: 'pink',
  },
  {
    id: 'scouting',
    badge: 'Talent Hub',
    title: 'Scouting & Osservati',
    description:
      'Costruisci il tuo database di giocatori seguiti esternamente con categorie personalizzate e promuovili in rosa con un click.',
    bullets: [
      'Filtri per ruolo, categoria e valutazione tecnica',
      'Riepilogo osservati integrato nella vista copertura squadra',
    ],
    icon: Eye,
    accent: 'yellow',
  },
  {
    id: 'offline-stats',
    badge: 'PWA Offline-First',
    title: 'Statistiche Avanzate & Sync Senza Rete',
    description:
      'Analisi Casa vs Trasferta, distribuzione gol ogni 15 minuti e funzionamento garantito anche negli spogliatoi senza segnale.',
    bullets: [
      'Database locale IndexedDB (Dexie) con Sync Queue automatica al ritorno online',
      'Installabile su iOS, Android e Desktop come app nativa',
    ],
    icon: WifiOff,
    accent: 'green',
    span: 'lg:col-span-3',
  },
];

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: '/sempre',
    subtitle: 'Perfetto per iniziare subito a sostituire carta, penna e fogli Excel.',
    features: [
      'Gestione completa Rosa (fino a 20 giocatori)',
      'Calendario partite e presenze allenamento',
      'Cronometro match live e tabellino eventi',
      'Copertura tattica su 7 moduli e condivisione PNG',
      'PWA installabile e supporto tema Dark / Light',
    ],
    ctaLabel: 'Inizia Gratis',
  },
  {
    id: 'pro',
    name: 'Pro Coach',
    price: '€4.99',
    period: '/mese',
    subtitle: 'Per allenatori esigenti che vogliono tutto il potenziale dell’AI tattica.',
    mvpBadge: 'GRATIS IN FASE MVP',
    highlighted: true,
    features: [
      'Giocatori e stagioni illimitati',
      'Smart Import AI da foto e testo (Rosa & Calendario)',
      'AI Best 11 & Coach AI Assistant illimitato',
      'AI Drill Generator (3 varianti per esercizio)',
      'Statistiche avanzate (Casa/Trasferta, fasce 15’) & Export CSV',
    ],
    ctaLabel: 'Attiva Accesso MVP',
  },
  {
    id: 'society',
    name: 'Society & Staff',
    price: '€19.99',
    period: '/mese',
    subtitle: 'Pensato per Direttori Sportivi e società con più categorie e staff condiviso.',
    mvpBadge: 'GRATIS IN FASE MVP',
    features: [
      'Tutto ciò che è incluso in Pro Coach',
      'Dashboard Director multi-squadra (fino a 5 team)',
      'Database Scouting centralizzato per la società',
      'Condivisione stagioni e inviti staff con codice S-XXXXX',
      'Controllo granulare dei ruoli (Coach, Director, Player)',
    ],
    ctaLabel: 'Richiedi Accesso Club',
  },
];

const FAQ_ITEMS: FaqEntry[] = [
  {
    id: 'faq-1',
    question: 'PitchMan è davvero gratuito in questa fase?',
    answer:
      'Sì. PitchMan è attualmente in fase di MVP pubblico: tutte le funzionalità principali — inclusi i flussi AI, la lavagna 2D e la gestione partite — sono accessibili gratuitamente registrando un account.',
  },
  {
    id: 'faq-2',
    question: 'Funziona nello spogliatoio o in campi senza connessione internet?',
    answer:
      'Sì. PitchMan è costruito come Progressive Web App (PWA) con architettura Offline-First basata su IndexedDB: puoi consultare i dati e registrare eventi in coda locale; al ritorno del segnale la sincronizzazione cloud avviene automaticamente.',
  },
  {
    id: 'faq-3',
    question: 'Come funziona l’importazione AI di rosa e calendario?',
    answer:
      'Puoi caricare una foto della distinta, uno screenshot o incollare il testo del calendario federale (anche con date andata/ritorno). Il motore AI basato su Gemini estrae nomi, ruoli, giornate e orari strutturandoli automaticamente nella tua stagione.',
  },
  {
    id: 'faq-4',
    question: 'Posso condividere la gestione della squadra con il mio vice o preparatore?',
    answer:
      'Certamente. Dalla sezione Gestione Squadra puoi generare un codice invito univoco (es. S-XXXXX) da passare ai membri del tuo staff per collaborare sulla stessa stagione in tempo reale.',
  },
  {
    id: 'faq-5',
    question: 'Serve scaricare un’app dagli store Apple o Google?',
    answer:
      'No, non servono download pesanti. Puoi usare PitchMan direttamente dal browser oppure installarlo sulla schermata Home del tuo smartphone iOS, Android o PC con un click direttamente dall’header dell’app.',
  },
  {
    id: 'faq-6',
    question: 'I dati della mia squadra e dei miei giocatori sono al sicuro?',
    answer:
      'Tutti i dati sono protetti da crittografia HTTPS/TLS, autenticazione Firebase e rigide regole di sicurezza lato database che separano ogni squadra ed impediscono l’accesso a utenti non autorizzati.',
  },
];

const TACTICAL_SLOTS_433 = [
  { role: 'POR', name: '1. Rossi', x: '50%', y: '86%', color: 'border-[#ffff66] text-[#ffff66]' },
  { role: 'TD', name: '2. Conti', x: '82%', y: '68%', color: 'border-[#00d9ff] text-[#00d9ff]' },
  { role: 'DC', name: '5. Neri', x: '62%', y: '72%', color: 'border-[#00d9ff] text-[#00d9ff]' },
  { role: 'DC', name: '6. Villa', x: '38%', y: '72%', color: 'border-[#00d9ff] text-[#00d9ff]' },
  { role: 'TS', name: '3. Mori', x: '18%', y: '68%', color: 'border-[#00d9ff] text-[#00d9ff]' },
  { role: 'CDC', name: '4. Gallo', x: '50%', y: '52%', color: 'border-[#b1e605] text-[#b1e605]' },
  { role: 'CD', name: '8. Ricci', x: '72%', y: '42%', color: 'border-[#b1e605] text-[#b1e605]' },
  { role: 'CS', name: '10. Bruno', x: '28%', y: '42%', color: 'border-[#b1e605] text-[#b1e605]' },
  { role: 'AD', name: '7. Leone', x: '78%', y: '20%', color: 'border-[#df3b77] text-[#df3b77]' },
  { role: 'ATT', name: '9. Greco', x: '50%', y: '14%', color: 'border-[#df3b77] text-[#df3b77]' },
  { role: 'AS', name: '11. Sala', x: '22%', y: '20%', color: 'border-[#df3b77] text-[#df3b77]' },
];

// ── Helper per stili accento ──────────────────────────────────────────────────

function getAccentClasses(accent: BentoFeature['accent']): {
  badge: string;
  iconBox: string;
  borderHover: string;
} {
  switch (accent) {
    case 'cyan':
      return {
        badge: 'bg-[#00d9ff]/10 text-[#00d9ff] border-[#00d9ff]/30',
        iconBox: 'bg-[#00d9ff]/10 text-[#00d9ff] border-[#00d9ff]/30',
        borderHover: 'hover:border-[#00d9ff]/50',
      };
    case 'yellow':
      return {
        badge: 'bg-[#ffff66]/10 text-[#ffff66] border-[#ffff66]/30',
        iconBox: 'bg-[#ffff66]/10 text-[#ffff66] border-[#ffff66]/30',
        borderHover: 'hover:border-[#ffff66]/50',
      };
    case 'pink':
      return {
        badge: 'bg-[#df3b77]/10 text-[#df3b77] border-[#df3b77]/30',
        iconBox: 'bg-[#df3b77]/10 text-[#df3b77] border-[#df3b77]/30',
        borderHover: 'hover:border-[#df3b77]/50',
      };
    case 'green':
    default:
      return {
        badge: 'bg-[#b1e605]/10 text-[#b1e605] border-[#b1e605]/30',
        iconBox: 'bg-[#b1e605]/10 text-[#b1e605] border-[#b1e605]/30',
        borderHover: 'hover:border-[#b1e605]/50',
      };
  }
}

// ── Componente Principale Landing Page ────────────────────────────────────────

export default function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [activeTarget, setActiveTarget] = useState<TargetId>('coach');
  const [heroPreview, setHeroPreview] = useState<HeroPreviewId>('match');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedTarget =
    TARGET_PROFILES.find((t) => t.id === activeTarget) ?? TARGET_PROFILES[0];

  const primaryHref = isAuthenticated ? '/' : '/login';
  const primaryLabel = isAuthenticated ? 'Vai alla Dashboard' : 'Inizia Gratis Ora';

  return (
    <div className="dark -m-3 -mb-24 md:-m-10 lg:-m-16 min-h-screen bg-[#080808] text-white font-body selection:bg-[#b1e605] selection:text-black overflow-x-hidden">
      {/* Sfondo radiale neon atmosferico */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[420px] rounded-full bg-[#b1e605]/10 blur-[140px]" />
        <div className="absolute top-[35%] -right-40 w-[460px] h-[460px] rounded-full bg-[#00d9ff]/10 blur-[150px]" />
        <div className="absolute bottom-0 -left-40 w-[460px] h-[460px] rounded-full bg-[#4eeb00]/5 blur-[150px]" />
      </div>

      {/* ── 1. NAVBAR STICKY ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080808]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/landing" className="flex items-center gap-3 group">
            <div className="p-1.5 rounded-xl bg-[#101010] border border-[#b1e605]/40 shadow-theme transition-transform group-hover:scale-105">
              <img
                src="/favicon-16x16.png"
                alt="PitchMan Logo"
                className="h-6 w-6 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter leading-none text-white">
                PitchMan
              </span>
              <span className="text-[8px] uppercase font-bold tracking-[0.28em] text-[#b1e605] mt-0.5">
                Tactical Manager
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-white/60">
            <a href="#problema" className="hover:text-[#b1e605] transition-colors">
              Perché PitchMan
            </a>
            <a href="#target" className="hover:text-[#b1e605] transition-colors">
              Per Chi È
            </a>
            <a href="#funzionalita" className="hover:text-[#b1e605] transition-colors">
              Funzionalità
            </a>
            <a href="#piani" className="hover:text-[#b1e605] transition-colors">
              Piani
            </a>
            <a href="#faq" className="hover:text-[#b1e605] transition-colors">
              FAQ
            </a>
          </nav>

          <div className="hidden sm:flex items-center gap-3">
            {!isAuthenticated && (
              <Link
                href="/login"
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors"
              >
                Accedi
              </Link>
            )}
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#b1e605] text-black font-black text-xs uppercase tracking-wider shadow-theme hover:brightness-110 transition-all active:scale-95"
            >
              <span>{primaryLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            aria-label="Apri menu di navigazione"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="sm:hidden p-2 rounded-xl border border-white/15 bg-[#101010] text-white/80 hover:text-[#b1e605]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden border-t border-white/10 bg-[#0b0b0b] px-4 py-4 space-y-3"
            >
              <div className="flex flex-col space-y-2 text-xs font-bold uppercase tracking-wider text-white/80">
                <a
                  href="#problema"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 border-b border-white/5"
                >
                  Perché PitchMan
                </a>
                <a
                  href="#target"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 border-b border-white/5"
                >
                  Per Chi È
                </a>
                <a
                  href="#funzionalita"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 border-b border-white/5"
                >
                  Funzionalità
                </a>
                <a
                  href="#piani"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 border-b border-white/5"
                >
                  Piani
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                >
                  FAQ
                </a>
              </div>
              <Link
                href={primaryHref}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#b1e605] text-black font-black text-xs uppercase tracking-wider shadow-theme"
              >
                <span>{primaryLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="relative z-10">
        {/* ── 2. HERO SECTION + MOCKUP TATTICO INTERATTIVO ────────────────── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Testo Hero */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-6 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#b1e605]/10 border border-[#b1e605]/30 text-[#b1e605] text-[11px] font-black uppercase tracking-widest">
                <Zap className="h-3.5 w-3.5" />
                <span>Il Primo Assistente Tattico & AI per il Calcio</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.06] text-white">
                Gestisci la tua squadra come un{' '}
                <span className="text-neon-gradient">professionista</span>.
              </h1>

              <p className="text-base sm:text-lg text-white/70 leading-relaxed max-w-xl">
                Dimentica fogli Excel, gruppi WhatsApp dispersivi e appunti su carta.{' '}
                <strong className="text-white">PitchMan</strong> unisce formazioni,
                cronometro partita live, lavagna esercizi 2D, test atletici, scouting e
                Intelligenza Artificiale in un’unica Web App veloce, disponibile anche
                offline.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link
                  href={primaryHref}
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-[#b1e605] text-black font-black text-sm uppercase tracking-wider shadow-theme-strong hover:brightness-110 transition-all active:scale-95"
                >
                  <span>{primaryLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#funzionalita"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#101010] border border-white/15 hover:border-[#00d9ff]/60 text-white font-bold text-sm transition-all"
                >
                  <Sparkles className="h-4 w-4 text-[#00d9ff]" />
                  <span>Esplora tutte le funzioni</span>
                </a>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 max-w-lg">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-[#b1e605]">
                    Gratis
                  </div>
                  <div className="text-[11px] text-white/50 font-medium">
                    Accesso completo MVP
                  </div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-[#00d9ff]">
                    Offline PWA
                  </div>
                  <div className="text-[11px] text-white/50 font-medium">
                    Funziona negli spogliatoi
                  </div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-[#ffff66]">
                    Gemini AI
                  </div>
                  <div className="text-[11px] text-white/50 font-medium">
                    OCR & Best 11 smart
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Mockup Live Interattivo della WebApp */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-6"
            >
              <div className="rounded-3xl border-theme bg-[#101010] p-4 sm:p-6 shadow-theme-strong">
                {/* Barra superiore mockup */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#b1e605] animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/80">
                      Anteprima Live App
                    </span>
                  </div>

                  {/* Switch tab interattivo nel mockup */}
                  <div className="flex items-center gap-1 bg-black/70 p-1 rounded-xl border border-white/10 text-[10px] font-black uppercase">
                    <button
                      type="button"
                      onClick={() => setHeroPreview('match')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        heroPreview === 'match'
                          ? 'bg-[#b1e605] text-black'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Match Live
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroPreview('ai')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        heroPreview === 'ai'
                          ? 'bg-[#00d9ff] text-black'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      AI Best 11
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroPreview('depth')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        heroPreview === 'depth'
                          ? 'bg-[#ffff66] text-black'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      13 Ruoli
                    </button>
                  </div>
                </div>

                {/* Contenuto dinamico del mockup */}
                <div className="pt-5">
                  {heroPreview === 'match' && (
                    <div className="space-y-4">
                      {/* Scoreboard Live */}
                      <div className="rounded-2xl bg-black/80 border border-[#b1e605]/30 p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#b1e605]">
                            Campionato • 2° Tempo
                          </span>
                          <div className="text-sm sm:text-base font-black text-white mt-0.5">
                            PitchMan FC vs Atletico Nord
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 rounded-xl bg-[#b1e605]/15 border border-[#b1e605]/40 text-[#b1e605] font-black text-lg tabular-nums">
                            2 - 1
                          </div>
                          <div className="px-2.5 py-1 rounded-lg bg-[#df3b77]/20 border border-[#df3b77]/40 text-[#df3b77] font-black text-xs tabular-nums">
                            68&apos;
                          </div>
                        </div>
                      </div>

                      {/* Mini Campo Tattico 4-3-3 */}
                      <div className="relative h-64 rounded-2xl bg-gradient-to-b from-[#0b1908] via-[#0d1f0a] to-[#081306] border border-[#b1e605]/25 overflow-hidden">
                        {/* Linee campo */}
                        <div className="absolute inset-3 border border-white/15 rounded-xl pointer-events-none" />
                        <div className="absolute top-1/2 left-3 right-3 h-px bg-white/15 pointer-events-none" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/15 pointer-events-none" />
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-10 border-b border-x border-white/15 pointer-events-none" />
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-28 h-10 border-t border-x border-white/15 pointer-events-none" />

                        {TACTICAL_SLOTS_433.map((slot) => (
                          <div
                            key={slot.name}
                            style={{ left: slot.x, top: slot.y }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                          >
                            <span
                              className={`px-2 py-0.5 rounded-md bg-black/90 border text-[9px] font-black tracking-tight shadow-md ${slot.color}`}
                            >
                              {slot.role}
                            </span>
                            <span className="text-[9px] font-bold text-white/85 mt-0.5 whitespace-nowrap drop-shadow">
                              {slot.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Eventi rapidi */}
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center gap-2">
                          <GiSoccerBall className="h-4 w-4 text-[#b1e605] shrink-0" />
                          <span className="truncate font-bold">64&apos; Greco (Ass. Bruno)</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[#00d9ff] shrink-0" />
                          <span className="truncate font-bold">Minutaggio Reale</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center gap-2">
                          <Share2 className="h-4 w-4 text-[#ffff66] shrink-0" />
                          <span className="truncate font-bold">Export PNG Ready</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {heroPreview === 'ai' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-[#00d9ff]/10 border border-[#00d9ff]/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-[#00d9ff]">
                            <Bot className="h-4 w-4" /> Suggerimento Formazione Gemini 2.5
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-[#b1e605]">
                            Modulo 4-3-3
                          </span>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed">
                          &ldquo;Analisi completata su 18 convocati, ultime 4 sedute di
                          allenamento e minutaggio cumulato: <strong>Greco (ATT)</strong>{' '}
                          e <strong>Bruno (CS)</strong> hanno il 100% di presenze
                          settimanali. <strong>Gallo (CDC)</strong> garantisce copertura
                          ottimale davanti alla difesa.&rdquo;
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-black/70 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between text-xs font-black uppercase text-white/70">
                          <span className="flex items-center gap-2">
                            <Camera className="h-4 w-4 text-[#b1e605]" /> Smart Import
                            OCR
                          </span>
                          <span className="text-[#b1e605]">100% Estratto</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div className="p-3 rounded-xl bg-[#101010] border border-white/10">
                            <div className="text-[10px] text-white/50 uppercase font-bold">
                              Da Foto Distinta
                            </div>
                            <div className="font-black text-white mt-0.5">
                              22 Giocatori + Ruoli
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-[#101010] border border-white/10">
                            <div className="text-[10px] text-white/50 uppercase font-bold">
                              Da Testo Calendario
                            </div>
                            <div className="font-black text-white mt-0.5">
                              26 Gare (A/R)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {heroPreview === 'depth' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-black/70 border border-[#ffff66]/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-[#ffff66]">
                            Copertura Organico • 13 Ruoli
                          </span>
                          <span className="text-[10px] font-bold text-white/60">
                            Stagione 2026/27
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#101010] border border-[#b1e605]/30">
                            <span className="font-bold">
                              <span className="text-[#b1e605] font-black mr-2">DC</span>
                              Difensore Centrale
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#b1e605]/15 text-[#b1e605] font-black text-[10px]">
                              4 Giocatori • Coperto
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#101010] border border-[#00d9ff]/30">
                            <span className="font-bold">
                              <span className="text-[#00d9ff] font-black mr-2">CDC</span>
                              Mediano
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#00d9ff]/15 text-[#00d9ff] font-black text-[10px]">
                              2 Giocatori • Ok
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#101010] border border-[#df3b77]/40">
                            <span className="font-bold">
                              <span className="text-[#df3b77] font-black mr-2">TS</span>
                              Terzino Sinistro
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#df3b77]/15 text-[#df3b77] font-black text-[10px]">
                              1 Solo • +2 Osservati Scout
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── 3. IL PROBLEMA VS LA SOLUZIONE ───────────────────────────────── */}
        <section
          id="problema"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10"
        >
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#00d9ff]">
              Basta caos pre-partita
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Prima di PitchMan vs Con PitchMan
            </h2>
            <p className="text-sm sm:text-base text-white/65">
              Ogni settimana gli staff dilettantistici perdono oltre 2 ore in operazioni
              ripetitive. Ecco come cambia il tuo workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Prima */}
            <div className="rounded-3xl bg-[#101010] border border-[#df3b77]/30 p-6 sm:p-8 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#df3b77]/15 text-[#df3b77] text-xs font-black uppercase">
                <X className="h-4 w-4" />
                <span>Gestione Tradizionale</span>
              </div>
              <ul className="space-y-4 text-sm text-white/75">
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-[#df3b77] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Fogli Excel e note sparse:</strong>{' '}
                    tabellini scritti su foglietti bagnati a bordo campo e persi a fine
                    gara.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-[#df3b77] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Gruppi WhatsApp infiniti:</strong>{' '}
                    allenamenti, assenze e formazioni sepolti tra centinaia di messaggi.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-[#df3b77] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Calcoli manuali infiniti:</strong>{' '}
                    minutaggi sbagliati per via dei cambi nel recupero e zero visione su
                    chi gioca meno.
                  </span>
                </li>
              </ul>
            </div>

            {/* Dopo */}
            <div className="rounded-3xl bg-[#101010] border border-[#b1e605]/40 p-6 sm:p-8 space-y-5 shadow-theme">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#b1e605]/15 text-[#b1e605] text-xs font-black uppercase">
                <Check className="h-4 w-4" />
                <span>Con PitchMan</span>
              </div>
              <ul className="space-y-4 text-sm text-white/85">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#b1e605] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Import AI in 10 secondi:</strong>{' '}
                    fotografa la distinta o incolla il calendario e hai tutta la stagione
                    pronta.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#b1e605] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Cronaca live & minutaggi esatti:</strong>{' '}
                    un tap per gol, cartellini e cambi con tempi di recupero calcolati in
                    automatico.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#b1e605] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Staff sincronizzato & offline:</strong>{' '}
                    tutti condividono rosa, esercizi 2D, scouting e test atletici su
                    qualsiasi dispositivo.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── 4. SEZIONE TARGET (TABS PER PROFILO) ─────────────────────────── */}
        <section
          id="target"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10"
        >
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#b1e605]">
              Costruita per chi vive il campo
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Uno strumento su misura per ogni ruolo tecnico
            </h2>
          </div>

          {/* Selettore Profili */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {TARGET_PROFILES.map((profile) => {
              const Icon = profile.icon;
              const isSelected = profile.id === activeTarget;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setActiveTarget(profile.id)}
                  className={`flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all border ${
                    isSelected
                      ? 'bg-[#b1e605] text-black border-[#b1e605] shadow-theme'
                      : 'bg-[#101010] text-white/70 border-white/15 hover:border-[#b1e605]/40 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{profile.label}</span>
                </button>
              );
            })}
          </div>

          {/* Card Dettaglio Profilo */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTarget.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="rounded-3xl bg-[#101010] border border-[#b1e605]/30 p-6 sm:p-10 shadow-theme"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-5">
                  <span className="inline-block px-3 py-1 rounded-full bg-[#b1e605]/10 border border-[#b1e605]/30 text-[#b1e605] text-[11px] font-black uppercase tracking-widest">
                    {selectedTarget.badge}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                    {selectedTarget.headline}
                  </h3>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                    {selectedTarget.description}
                  </p>
                  <ul className="space-y-3 pt-2">
                    {selectedTarget.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm text-white/85"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[#b1e605] shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                  {selectedTarget.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="p-5 rounded-2xl bg-black/70 border border-white/10 flex items-center justify-between"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                        {metric.label}
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-[#b1e605]">
                        {metric.value}
                      </span>
                    </div>
                  ))}
                  <Link
                    href={primaryHref}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#b1e605] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 transition-all"
                  >
                    <span>Provalo per il tuo team</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* ── 5. BENTO GRID APPROFONDITA DELLE 8 FUNZIONALITÀ ────────────── */}
        <section
          id="funzionalita"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10"
        >
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#ffff66]">
              Suite Completa
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Tutte le funzionalità di PitchMan nei dettagli
            </h2>
            <p className="text-sm sm:text-base text-white/65">
              Ogni modulo è stato progettato direttamente sulle esigenze reali del campo,
              dalla pianificazione settimanale all’analisi statistica di fine stagione.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENTO_FEATURES.map((feat) => {
              const Icon = feat.icon;
              const styles = getAccentClasses(feat.accent);
              return (
                <div
                  key={feat.id}
                  className={`rounded-3xl bg-[#101010] border border-white/10 ${styles.borderHover} p-6 sm:p-7 flex flex-col justify-between transition-all ${feat.span ?? ''}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`h-11 w-11 rounded-2xl border flex items-center justify-center ${styles.iconBox}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${styles.badge}`}
                      >
                        {feat.badge}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-white tracking-tight">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-white/65 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>

                  <ul className="space-y-2 pt-5 mt-5 border-t border-white/10 text-xs text-white/80">
                    {feat.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-[#b1e605] shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 6. PIANI & ACCESSO (FREEMIUM / MVP GRATUITO) ─────────────────── */}
        <section
          id="piani"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10"
        >
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#b1e605]/15 border border-[#b1e605]/30 text-[#b1e605] text-[11px] font-black uppercase tracking-widest">
              <Crown className="h-3.5 w-3.5" />
              <span>Accesso Completo Gratuito in Fase MVP</span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Piani trasparenti per ogni livello di squadra
            </h2>
            <p className="text-sm sm:text-base text-white/65">
              Registrati oggi senza carta di credito e sfrutta da subito le funzioni
              avanzate durante il rilascio MVP pubblico.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between ${
                  tier.highlighted
                    ? 'bg-[#101010] border-neon-gradient shadow-theme-strong'
                    : 'bg-[#101010] border border-white/15'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-black uppercase tracking-tight text-white">
                      {tier.name}
                    </h3>
                    {tier.mvpBadge && (
                      <span className="px-2.5 py-1 rounded-full bg-[#b1e605]/15 border border-[#b1e605]/40 text-[#b1e605] text-[10px] font-black uppercase">
                        {tier.mvpBadge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-white">{tier.price}</span>
                    <span className="text-xs font-bold text-white/50">{tier.period}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-white/65 leading-relaxed">
                    {tier.subtitle}
                  </p>

                  <ul className="space-y-3 pt-4 border-t border-white/10 text-sm text-white/85">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-[#b1e605] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={primaryHref}
                  className={`mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${
                    tier.highlighted
                      ? 'bg-[#b1e605] text-black shadow-theme hover:brightness-110'
                      : 'bg-black/70 text-white border border-white/20 hover:border-[#b1e605]/60'
                  }`}
                >
                  <span>{isAuthenticated ? 'Apri App' : tier.ctaLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. FAQ INTERATTIVA ────────────────────────────────────────────── */}
        <section
          id="faq"
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10"
        >
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#00d9ff]">
              Domande Frequenti
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Tutto quello che devi sapere
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="rounded-2xl bg-[#101010] border border-white/10 px-5 data-[state=open]:border-[#b1e605]/40 transition-colors"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-bold text-white hover:no-underline hover:text-[#b1e605] py-5">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-white/70 leading-relaxed pb-5">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* ── 8. CTA FINALE & FOOTER ────────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-6">
          <div className="rounded-3xl border-neon-gradient bg-[#101010] p-8 sm:p-14 text-center space-y-6 shadow-theme-bright">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#b1e605]/15 text-[#b1e605] text-xs font-black uppercase tracking-wider">
              <Flame className="h-4 w-4" />
              <span>Pronto per la prossima partita?</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
              Porta la gestione della tua squadra al livello successivo.
            </h2>
            <p className="text-sm sm:text-base text-white/70 max-w-xl mx-auto">
              Crea il tuo account in 30 secondi, importa la rosa con l’AI e gestisci
              allenamenti, formazioni e statistiche da qualsiasi dispositivo.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href={primaryHref}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-[#b1e605] text-black font-black text-sm uppercase tracking-wider shadow-theme-strong hover:brightness-110 transition-all"
              >
                <span>
                  {isAuthenticated
                    ? 'Torna alla Dashboard'
                    : 'Crea il tuo Account Gratuito'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/privacy"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-black/70 border border-white/15 hover:border-white/40 text-white/80 font-bold text-xs uppercase tracking-wider transition-all"
              >
                <Shield className="h-4 w-4 text-[#00d9ff]" />
                <span>Sicurezza & GDPR</span>
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-[#050505]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
            <div className="flex items-center gap-2.5">
              <img
                src="/favicon-16x16.png"
                alt="PitchMan"
                className="h-5 w-5 object-contain"
              />
              <span className="font-bold text-white/80">PitchMan Tactical Manager</span>
              <span>&bull; © {new Date().getFullYear()}</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 font-bold">
              <Link href={primaryHref} className="hover:text-[#b1e605] transition-colors">
                {isAuthenticated ? 'Dashboard' : 'Accedi / Registrati'}
              </Link>
              <Link href="/privacy" className="hover:text-[#b1e605] transition-colors">
                Privacy Policy
              </Link>
              <Link href="/termini" className="hover:text-[#b1e605] transition-colors">
                Termini di Servizio
              </Link>
              <a
                href="mailto:losviluppatore@hotmail.com"
                className="hover:text-[#b1e605] transition-colors"
              >
                Contatti
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
