# Zachrie Kurniawan — Portfolio

A Neovim-inspired developer portfolio built with **React** and **Vite**, featuring an animated code-wall intro (`/`), interactive terminal-style editor (`/site/`), 8 built-in color themes, and keyboard-first navigation (`j`/`k`, `:theme`, `:colorscheme`, `enter`).

## Tech Stack

- **React 19** (`react`, `react-dom`)
- **Vite** (multi-page build for `/` and `/site/`)
- **Canvas 2D** (animated code wall, wheel, and generative blueprint)

## Development

```bash
# Install dependencies
npm install

# Regenerate static JSON & themes from portfolio.config.json
npm run data

# Start React dev server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```

## Structure

- `portfolio.config.json` — single source of truth for profile, experience, education, achievements, security tools, and skills
- `src/` — React components, context, pages, styles, and canvas engines
- `scripts/build-data.mjs` — Node.js data generator syncing `portfolio.config.json` into `public/`
- `public/` — static fonts, themes, and generated JSON assets
