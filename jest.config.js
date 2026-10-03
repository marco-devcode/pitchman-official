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
// 3. `jsConfig`/`resolvedBaseUrl` passati al transformer di SWC fanno riscrivere
//    gli import `@/...` in percorsi RELATIVI durante la trasformazione, quindi
//    `moduleNameMapper` non li vede piu' e non puo' risolverli. Il percorso
//    relativo che SWC produce puntava fuori dal progetto (la root inferita da
//    Next finiva in `~`, per via di un package-lock.json also' li'), quindi
//    ogni suite che importava '@/...' moriva con "Cannot find module
//    '../../../../../src/...'". Levando `jsConfig` dal transformer, gli import
//    restano come scritti e li risolve `moduleNameMapper`, che e' gia' configurato
//    con `<rootDir>/src/$1` e usa il rootDir di Jest: quello vero.
module.exports = async () => {
  const resolved = await createConfig()
  resolved.transformIgnorePatterns = ['/node_modules/(?!(geist|lucide-react)/)']

  // Su Termux/Android il binario nativo di SWC (`@next/swc-android-arm64`)
  // non e' installato e non si puo' installare: si usa la build WASM, che
  // funziona nel processo principale ma NON si carica nei worker figli di
  // Jest. Senza questo, `jest` in parallelo fallisce con "Jest worker
  // encountered 4 child process exceptions" e "Failed to load SWC binary
  // for android/arm64", mentre le stesse suite passano una alla una. Il
  // fallback WASM e' gia' quello che next/jest usa, quindi in banda singola
  // non cambia nulla: cambia solo QUANDO viene caricato. Per questo anche
  // `npm test` passa `-i`. Su una macchina col binario nativo questo
  // innaturale e` innocuo, perche' in banda singola i test passano uguale.
  const isAndroid = process.platform === 'android' || process.env.ANDROID_ROOT !== undefined
  if (isAndroid) {
    resolved.maxWorkers = 1
  }

  const key = '^.+\\.(js|jsx|ts|tsx|mjs)$'
  const entry = resolved.transform[key]
  if (Array.isArray(entry)) {
    const [transformerPath, options = {}] = entry
    resolved.transform = {
      ...resolved.transform,
      [key]: [transformerPath, { ...options, jsConfig: undefined, resolvedBaseUrl: undefined }],
    }
  }

  return resolved
}
