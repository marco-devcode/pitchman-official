import * as AIService from './ai.service';

jest.mock('@/ai/flows/chatbot-flow', () => ({
  chatbotFlow: jest.fn(),
}));
jest.mock('@/ai/flows/import-players-flow', () => ({
  importPlayersFromText: jest.fn(),
}));
jest.mock('@/ai/flows/import-matches-flow', () => ({
  importMatchesFromText: jest.fn(),
}));
jest.mock('@/ai/flows/suggest-lineup-flow', () => ({
  suggestLineup: jest.fn(),
}));

import { chatbotFlow } from '@/ai/flows/chatbot-flow';
import { importPlayersFromText } from '@/ai/flows/import-players-flow';
import { importMatchesFromText } from '@/ai/flows/import-matches-flow';
import { suggestLineup } from '@/ai/flows/suggest-lineup-flow';

const asMock = (fn: unknown) => fn as jest.Mock;

describe('ai.service (integration)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('chatbot delegates to chatbotFlow and returns text', async () => {
    asMock(chatbotFlow).mockResolvedValue({ text: 'Ciao coach' });
    const res = await AIService.chatbot({ message: 'hi', teamContext: undefined });
    expect(chatbotFlow).toHaveBeenCalledWith({ message: 'hi', teamContext: undefined });
    expect(res.text).toBe('Ciao coach');
  });

  it('importPlayers delegates to importPlayersFromText', async () => {
    asMock(importPlayersFromText).mockResolvedValue({ players: [] });
    await AIService.importPlayers({ rawText: 'POR: Rossi' });
    expect(importPlayersFromText).toHaveBeenCalledWith({ rawText: 'POR: Rossi' });
  });

  it('importMatches delegates to importMatchesFromText', async () => {
    asMock(importMatchesFromText).mockResolvedValue({ matches: [], teamName: 'OSL' });
    await AIService.importMatches({ rawContent: '20/09 OSL vs X' });
    expect(importMatchesFromText).toHaveBeenCalled();
  });

  it('importMatches wraps the result in a success disk', async () => {
    asMock(importMatchesFromText).mockResolvedValue({ matches: [], teamName: 'OSL' });
    await expect(AIService.importMatches({ rawContent: '20/09 OSL vs X' })).resolves.toEqual({
      ok: true,
      data: { matches: [], teamName: 'OSL' },
    });
  });

  // Non rilancia: in produzione Next.js sostituisce l'errore di una server
  // action con "An error occurred in the Server Components render", e l'utente
  // non vede piu' la causa. Restituendolo come dato il messaggio arriva a UI.
  it('importMatches returns the error instead of throwing it', async () => {
    asMock(importMatchesFromText).mockRejectedValue(new Error('gemini-3.8-flash: 503 high demand'));
    await expect(AIService.importMatches({ rawContent: '20/09 OSL vs X' })).resolves.toEqual({
      ok: false,
      error: 'gemini-3.8-flash: 503 high demand',
    });
  });

  it('suggestLineup delegates to suggestLineup', async () => {
    asMock(suggestLineup).mockResolvedValue({ starters: [], substitutes: [] });
    await AIService.suggestLineup({ rawList: '1. Rossi', availablePlayers: [], formation: '4-4-2' });
    expect(suggestLineup).toHaveBeenCalled();
  });

  it('rethrows errors so useAsyncAction can capture them', async () => {
    asMock(chatbotFlow).mockRejectedValue(new Error('AI down'));
    await expect(AIService.chatbot({ message: 'hi' })).rejects.toThrow('AI down');
  });
});
