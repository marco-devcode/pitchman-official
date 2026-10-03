import '@testing-library/jest-dom';

// Mock matchMedia.
//
// La guardia `typeof window` serve perche' i test delle route API dichiarano
// `@jest-environment node` (le Web API del fetch in jsdom tirano una catena di
// ReferenceError), e li' `window` non esiste. Questo file gira per entrambi gli
// ambienti: fallire qui ucciderebbe anche le suite di API.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}
