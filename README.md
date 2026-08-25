# README to Landing Page

[![CI](https://img.shields.io/github/actions/workflow/status/bmoler68/README-to-landing-page/ci.yml?branch=main&label=CI)](https://github.com/bmoler68/README-to-landing-page/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/bmoler68/README-to-landing-page)](https://github.com/bmoler68/README-to-landing-page/releases/latest)
[![License](https://img.shields.io/github/license/bmoler68/README-to-landing-page)](https://github.com/bmoler68/README-to-landing-page/blob/main/LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/bmoler68/README-to-landing-page)](https://github.com/bmoler68/README-to-landing-page/commits/main)
[![Issues](https://img.shields.io/github/issues/bmoler68/README-to-landing-page)](https://github.com/bmoler68/README-to-landing-page/issues)
![Language](https://img.shields.io/github/languages/top/bmoler68/README-to-landing-page)

A GitHub Action that converts your repository's `README.md` into a static landing page and deploys it to GitHub Pages. Add a workflow in **your** repository; no local CLI or tooling is required.

End-to-end usage is in the [README-2-landing-page-test](https://github.com/bmoler68/README-2-landing-page-test) repository. The site that workflow publishes is at [bmoler68.github.io/README-2-landing-page-test](https://bmoler68.github.io/README-2-landing-page-test/).

## Table of contents

- [Add the workflow](#add-the-workflow)
- [Configure with `with:`](#configure-with-with)
- [Enable GitHub Pages](#enable-github-pages)
- [What gets published](#what-gets-published)
- [License](#license)

## Add the workflow

In the **target repository** (the project whose README should become a landing page), create `.github/workflows/landing-page.yml`:

```yaml
name: Build Landing Page

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: bmoler68/readme-to-landing-page@v1
```

Do **not** create a `gh-pages` branch yourself, and do **not** point GitHub Pages at `main`. The action publishes a complete static site to the **root** of `gh-pages`. Using `main` (either `/ (root)` or `/docs`) would serve the source repo instead of the landing page or get overwritten.

## Configure with `with:`

The step that uses this action can take optional `with:` keys. Those values are passed into the action at runtime. Omit `with:` entirely to use the defaults (root `README.md`, publish to `gh-pages`, include a table of contents).

```yaml
      - uses: bmoler68/readme-to-landing-page@v1
        with:
          readme-path: README.md
          output-dir: site
          branch: gh-pages
          include-toc: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

| Input | Description | Default |
|-------|-------------|---------|
| `readme-path` | Path to the README, relative to the repository root | `README.md` |
| `output-dir` | Working directory for generated files before they are pushed | `site` |
| `branch` | Branch that receives the published site | `gh-pages` |
| `include-toc` | Whether the generated page includes a table of contents (`true` / `false`) | `true` |
| `github-token` | Token used to push to the publish branch | `${{ github.token }}` |

YAML treats `true`/`false` as booleans. Quote them (`'true'`, `'false'`) so GitHub Actions receives the string the action expects.

You only need `github-token` if you are not using the default `GITHUB_TOKEN`. The workflow still needs `permissions: contents: write` so the token can push.

Example: README in a subdirectory, no table of contents:

```yaml
      - uses: bmoler68/readme-to-landing-page@v1
        with:
          readme-path: docs/README.md
          include-toc: 'false'
```

## Enable GitHub Pages

Until `gh-pages` exists, **Settings → Pages** will only list branches that already exist (usually `None` and `main`). That is expected.

1. Leave Pages set to **None** (or skip Pages until after the first successful run).
2. Add the workflow and run it once (push to `main`, or **Actions → Run workflow**).
3. The action creates `gh-pages` if it is missing and pushes `index.html`, `styles.css`, and `assets/` to that branch. Your `main` branch is not changed.
4. Return to **Settings → Pages**, choose **Deploy from a branch**, then **`gh-pages`** and **`/ (root)`**. Refresh the page if `gh-pages` is not in the list yet.

After that, each push to `main` updates `gh-pages`, and GitHub Pages serves the generated site.

## What gets published

```
README.md → landing page → gh-pages branch → GitHub Pages
```

```
gh-pages branch:
├── index.html
├── styles.css
└── assets/
```

## License

MIT
