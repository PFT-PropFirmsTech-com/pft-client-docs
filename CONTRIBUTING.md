# Contributing to the client docs

This repository is **public**. The site (VitePress, in `docs/`) is read by firm admins and their traders. Write for their task: how to configure something, what the trader sees, what the limits are. Keep the voice brand-neutral (the reader's dashboard carries their own firm's brand).

Never commit secrets, server addresses, internal hostnames, customer data, client firm names or ticket ids.

## Add or update a page

1. Branch from `origin/main`: `git fetch origin && git switch -c docs/<topic> origin/main`.
2. Edit or add a `.md` file under `docs/client/` (traders) or `docs/admin/` (firm staff). Add new pages to the sidebar in `docs/.vitepress/config.ts` and to the section index page.
3. Check every claim against the code on `origin/production` of the app repos, not against memory. State which values the firm configures.
4. Do not paste `<tag>`-style placeholders (use words), and link pages with absolute paths such as `/client/withdrawal-process`.

## Preview and check

```bash
cd docs
npm ci
npm run dev
```

```bash
npm run build
```

The build fails on dead links. Fix them before pushing.

## Publish

Open a pull request against `main`. The workflow builds the site on the pull request without deploying. Merging to `main` deploys to GitHub Pages when `docs/` changed. Push and merge only with the owner's go-ahead.
