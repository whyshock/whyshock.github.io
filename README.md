# ⚡ WhyShock — Cyberpunk Portfolio

A cyberpunk-themed personal portfolio and blog platform built with vanilla HTML, CSS, and JavaScript. No frameworks, no build tools — just clean, fast, hand-crafted code.

**Live:** [whyshock.github.io](https://whyshock.github.io)

![Portfolio Preview](img/me.jpg)

---

## What's Inside

**Portfolio** — Full professional showcase with collapsible experience timeline, project cards with rich descriptions, certifications & recognition split view, and an interactive skills arsenal.

**Blog Engine** — Markdown-powered blog with cyberpunk reading UI, category filters, reading progress bar, and image zoom. Blog index auto-generated via GitHub Actions.

**Apps** — Standalone web apps (Astrocheck, Friday AI) accessible from the navbar dropdown, auto-discovered by GitHub Actions.

---

## Features

- 🎨 Cyberpunk + professional dual-theme (dark/light toggle)
- 🌧️ Canvas-based matrix rain animation
- 🧠 Neural network canvas background
- 📱 Fully responsive across all devices
- 🔤 Floating font-size controls (A+/A−)
- 📝 Markdown blog with auto-generated index
- 🗂️ Dynamic app discovery via GitHub Actions
- ⬇️ One-click resume download
- ⚡ Zero dependencies, zero build step

## Tech Stack

| Layer | Tech |
|-------|------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, grid, flexbox, animations) |
| Logic | Vanilla JavaScript |
| Fonts | Orbitron, Rajdhani (Google Fonts) |
| Icons | Font Awesome 6 |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

## Project Structure

```
├── index.html              # Main portfolio page
├── blog.html               # Blog listing page
├── blog.js                 # Blog engine (fetch, filter, render)
├── blogs/                  # Blog posts (markdown/txt) + index.json
├── apps/                   # Standalone web apps
│   ├── astrocheck/         # Astrology calculator
│   └── friday/             # AI chat interface
├── styles.css              # Portfolio styles
├── blogs.css               # Blog styles
├── script.js               # Portfolio interactions & animations
├── css/main.css            # Legacy styles
├── img/                    # Images, icons, favicon
├── .github/workflows/      # CI automation
│   ├── generate-blog-index.yml
│   ├── update-apps-nav.yml
│   └── update-projects.yml
└── Profile.pdf             # Resume
```

## Automation (GitHub Actions)

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `generate-blog-index.yml` | Push to `blogs/` | Scans blog posts, generates `blogs/index.json` |
| `update-apps-nav.yml` | Push to `apps/` | Discovers app folders, updates navbar dropdown |
| `update-projects.yml` | Push | Updates project showcase data |

## Adding a Blog Post

1. Drop a `.txt` or markdown file in `blogs/`
2. Push to main
3. GitHub Actions auto-updates `blogs/index.json`
4. Post appears on the blog page

## Adding an App

1. Create a folder under `apps/` with an `index.html`
2. Push to main
3. GitHub Actions auto-adds it to the APPS navbar dropdown

## Local Development

Just open `index.html` in a browser. No build step, no server required.

For blog posts to load locally, `blog.js` includes a hardcoded fallback — no server needed.

---

Built by [Vaishakh I Kuppast](https://www.linkedin.com/in/vaishakh-i-kuppast/) · [GitHub](https://github.com/whyshock)
