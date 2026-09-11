# Sisu web

Linear-density product UI for the Sisu protocol.

Canonical product rules: `../sisu/docs/FRONTEND.md`. Remaining work: `../docs/specs/frontend.md`. Language: `../CONTEXT.md`.

## Stack

- Next.js App Router, TypeScript, Tailwind v4
- Design tokens from `sisu/design`
- Mock SDK until the onchain client is wired

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Screens

- `/` Dashboard
- `/strategy` Strategy parameters and ship
- `/swap` Quote + projected risk
- `/history` Swap log

Keyboard: `⌘K` command palette, `G` then `D` / `S` / `W` / `H` to jump pages.
