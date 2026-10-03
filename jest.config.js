const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
const createConfig = createJestConfig(customJestConfig)

// lucide-react e' ESM-only (`dist/esm`, import statement). Di default Jest NON
// trasforma node_modules, quindi la prima suite che renderizzava un componente
// con un'icona moriva con "SyntaxError: Cannot use import statement outside a
// module" su lucide-react.js.
//
// Due dettagli, entrambi verificati con `--showConfig`:
//
// 1. `next/jest` restituisce una FUNZIONE (la config e' async), non un oggetto.
//    Scrivere `createJestConfig(...).transformIgnorePatterns = [...]` non ha
//    nessun effetto: la proprieta' verrebbe messa sulla funzione. Va riscritto
//    il valore restituito.
// 2. I pattern di default di next/jest vengono PRIMA e Jest usa il primo che
//    matcha, quindi aggiungere il proprio non basta: i default (che escludono
//    tutto node_modules) vincerebbero. Per questo si sostituisce l'array
//    intero, conservando i default ("geist").
module.exports = async () => {
  const resolved = await createConfig()
  resolved.transformIgnorePatterns = ['/node_modules/(?!(geist|lucide-react)/)']
  return resolved
}
