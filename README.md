# Cabinet

Source for [cabinet.chrisgroskopf.com](https://cabinet.chrisgroskopf.com), a personal collection of prints and drawings assembled since 2016. The site presents European and American works spanning the sixteenth through twentieth centuries, with an emphasis on etching.

## Architecture

The collection is managed as Obsidian notes and synced into this repo as a static Astro site deployed on Cloudflare Pages. The pipeline reads frontmatter from vault notes, processes images into responsive variants, and writes JSON content collection entries consumed by Astro at build time.

```
Obsidian vault  ──pnpm sync──►  src/content/works/*.json
                                public/images/
                                     │
                               pnpm build
                                     │
                                  dist/  ──► Cloudflare Pages
```

## Setup

```sh
pnpm install
cp .env.example .env   # set VAULT_PATH to your vault root
pnpm sync              # populate content and images from vault
pnpm dev               # local dev server at localhost:4321
```

## Commands

| Command | Action |
| :--- | :--- |
| `pnpm sync` | Sync content and images from Obsidian vault |
| `pnpm dev` | Start dev server at `localhost:4321` |
| `pnpm build` | Build site to `./dist/` |
| `pnpm deploy` | Build and deploy to Cloudflare Pages |

## Environment variables

| Variable | Description |
| :--- | :--- |
| `VAULT_PATH` | Absolute path to the Obsidian vault root |

## License

All content and images are licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Source code is MIT.
