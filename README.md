# README to Landing Page

A zero-configuration GitHub Action that converts your repository's `README.md` into a polished static landing page and deploys it to GitHub Pages.

This action is delivered as a **Docker container** — GitHub builds the image from the `Dockerfile` on each run. No container registry (GHCR) is required.

## For adopters (30-second setup)

Add this workflow to your repository at `.github/workflows/landing-page.yml`:

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

Do **not** create a `gh-pages` branch yourself, and do **not** point GitHub Pages at `main`. The action publishes a complete static site to the **root** of `gh-pages`. Using `main` (either `/ (root)` or `/docs`) would either serve the source repo instead of the landing page or get overwritten.

### GitHub Pages setup (target repository)

Until `gh-pages` exists, **Settings → Pages** will only list branches that already exist (usually `None` and `main`). That is expected.

1. Leave Pages set to **None** (or skip Pages until after the first successful run).
2. Add the workflow above and run it once (push to `main`, or **Actions → Run workflow**).
3. The action creates `gh-pages` if it is missing and pushes `index.html`, `styles.css`, and `assets/` to that branch. Your `main` branch is not changed.
4. Return to **Settings → Pages**, choose **Deploy from a branch**, then **`gh-pages`** and **`/ (root)`**. Refresh the page if `gh-pages` is not in the list yet.

After that, each push to `main` updates `gh-pages`, and GitHub Pages serves the generated site. No CLI or local tooling is required.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `readme-path` | Path to the README file | `README.md` |
| `output-dir` | Directory for generated site files | `site` |
| `branch` | Branch to publish to | `gh-pages` |
| `include-toc` | Include table of contents | `true` |
| `github-token` | Token used to push the site | `${{ github.token }}` |

## How it works

```
README.md → Parser → AST → Generator → gh-pages branch → GitHub Pages
```

When a workflow invokes this action, GitHub:

1. Checks out this action repo at the referenced tag (e.g. `@v1`)
2. **Builds the Docker image** from the `Dockerfile` (cached when possible)
3. Runs the container against the target repository workspace
4. The container parses `README.md`, generates HTML, and pushes to `gh-pages`

Generated site structure:

```
gh-pages branch:
├── index.html
├── styles.css
└── assets/
```

## Maintaining this action (CI-only)

This repository requires **zero local tooling**. You do not need Node.js, npm, or Docker installed on your machine.

| You do | CI does |
|--------|---------|
| Edit source files on GitHub (web editor, Codespaces, or git push) | Run unit tests |
| Open pull requests | Verify the Docker image builds |
| Tag releases (`v1`, `v1.0.0`) | — |

There is no `dist/` folder, no bundled JavaScript, and no container registry to manage. The Dockerfile **is** the deliverable — GitHub builds it fresh on each execution.

### Release workflow

1. Make changes to `src/`, `templates/`, or `Dockerfile`
2. Push to `main` — CI validates tests and Docker build
3. Create a git tag (e.g. `v1.0.0`)
4. Consumers reference `@v1` or `@v1.0.0`

## Project structure

```
├── action.yml              # Points to Dockerfile
├── Dockerfile              # Built by GitHub on each action run
├── src/
│   ├── index.js            # Entry point
│   ├── parser.js           # Markdown → AST
│   ├── generator.js        # AST → HTML
│   ├── publisher.js        # gh-pages deployment
│   └── utils/sanitize.js   # HTML sanitization
├── templates/
│   ├── default.html
│   └── styles.css
├── test/
└── .github/workflows/ci.yml
```

## License

MIT
