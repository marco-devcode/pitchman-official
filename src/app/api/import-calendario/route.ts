import { NextResponse } from 'next/server';
import { scrapeCalendario } from '@/lib/tuttocampo-scraper';
import { requireAuth } from '@/lib/api-auth';

export async function POST(request: Request) {
  // Nessun controllo prima: chiunque poteva far scrivere un calendario.
  // Coach e developer possono.
  // `return denied`: senza la risposta esplicita Next non ritorna nulla.
  const denied = await requireAuth(request, ['coach', 'director', 'developer']);
  if (denied) return denied;

  try {
    const { calendarUrl } = await request.json();

    if (!calendarUrl) {
      return NextResponse.json(
        { error: 'URL del calendario mancante' },
        { status: 400 }
      );
    }

    if (!calendarUrl.includes('tuttocampo.it')) {
      return NextResponse.json(
        { error: 'URL non valido. Assicurati che sia un URL di tuttocampo.it' },
        { status: 400 }
      );
    }

    console.log(`[api/import-calendario] Avvio scraping per url=${calendarUrl}`);
    const matches = await scrapeCalendario(calendarUrl);

    return NextResponse.json({
      success: true,
      matches: matches.map(m => ({
        opponent: m.opponent,
        date: m.date,
        isHome: m.isHome,
        type: m.type,
        status: m.status === 'completata' ? 'completed' : 'scheduled',
      })),
    });
  } catch (error: any) {
    console.error('[api/import-calendario] Errore:', error.message);
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}
