# Evidence školení

Webová aplikace pro personální oddělení: kdo je jak proškolen, komu končí platnost školení, co je potřeba řešit a koho přihlásit na který termín.

- Aplikace: https://www.zimmi.cz/evidence-skoleni/
- Průvodní text: [docs/zprava.md](docs/zprava.md)
- Použití AI: [docs/ai.md](docs/ai.md)
- Zadání: [docs/zadani.md](docs/zadani.md)
- Slovník pojmů: [CONTEXT.md](CONTEXT.md), rozhodnutí: [docs/adr](docs/adr)

## Spuštění

```sh
npm ci
npm run dev        # http://localhost:5173/evidence-skoleni/
npm test           # unit testy (Vitest)
npm run test:e2e   # end-to-end testy (Playwright)
npm run build
```

Aplikace nemá backend. Ukázková data z `data/` se načtou při startu, vlastní exporty lze nahrát tlačítkem Import. Data i rozhodnutí se ukládají jen v prohlížeči (localStorage).
