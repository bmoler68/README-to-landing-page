'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseReadme, parseBadges } = require('../src/parser');
const { generateSite, renderToc, renderBadges } = require('../src/generator');
const { sanitize, escapeHtml, slugify } = require('../src/utils/sanitize');

describe('sanitize', () => {
  it('removes script tags', () => {
    const result = sanitize('<p>Hello</p><script>alert("xss")</script>');
    assert.equal(result, '<p>Hello</p>');
  });

  it('preserves safe markdown HTML', () => {
    const result = sanitize('<p>Hello <strong>world</strong></p>');
    assert.equal(result, '<p>Hello <strong>world</strong></p>');
  });

  it('preserves heading ids and in-page anchor hrefs', () => {
    const result = sanitize('<h2 id="quick-start">Quick Start</h2><p><a href="#quick-start">Jump</a></p>');
    assert.ok(result.includes('id="quick-start"'));
    assert.ok(result.includes('href="#quick-start"'));
    assert.ok(!result.includes('target="_blank"'));
  });
});

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    assert.equal(escapeHtml('<script>"\'&'), '&lt;script&gt;&quot;&#39;&amp;');
  });
});

describe('slugify', () => {
  it('creates URL-safe slugs', () => {
    assert.equal(slugify('Hello World!'), 'hello-world');
    assert.equal(slugify('  Getting Started  '), 'getting-started');
  });
});

describe('parseBadges', () => {
  it('parses linked badges', () => {
    const text = '[![Build](https://img.shields.io/badge/build-passing)](https://example.com) [![License](https://img.shields.io/badge/license-MIT)](https://opensource.org/licenses/MIT)';
    const badges = parseBadges(text);
    assert.equal(badges.length, 2);
    assert.equal(badges[0].alt, 'Build');
    assert.equal(badges[0].href, 'https://example.com');
  });
});

describe('parseReadme', () => {
  const sampleMarkdown = `# My Project

[![Build](https://img.shields.io/badge/build-passing)](https://example.com)

## Features

A simple project with **bold** text.

\`\`\`javascript
console.log('hello');
\`\`\`

| Name | Value |
|------|-------|
| Foo  | Bar   |

- Item one
- Item two
`;

  it('extracts title and badges', () => {
    const doc = parseReadme(sampleMarkdown, { fallbackTitle: 'Fallback' });
    assert.equal(doc.title, 'My Project');
    assert.equal(doc.badges.length, 1);
    assert.equal(doc.badges[0].alt, 'Build');
  });

  it('produces structured sections', () => {
    const doc = parseReadme(sampleMarkdown);
    const types = doc.sections.map((s) => s.type);
    assert.ok(types.includes('heading'));
    assert.ok(types.includes('paragraph'));
    assert.ok(types.includes('code'));
    assert.ok(types.includes('table'));
    assert.ok(types.includes('list'));
  });

  it('falls back to raw text on empty input', () => {
    const doc = parseReadme('', { fallbackTitle: 'Empty Project' });
    assert.equal(doc.title, 'Empty Project');
    assert.ok(doc.sections.length >= 1);
  });
});

describe('renderToc', () => {
  it('generates TOC from h2 and h3 headings', () => {
    const sections = [
      { type: 'heading', level: 2, text: 'Features', id: 'features' },
      { type: 'heading', level: 3, text: 'Details', id: 'details' },
      { type: 'heading', level: 4, text: 'Ignored', id: 'ignored' }
    ];
    const toc = renderToc(sections);
    assert.ok(toc.includes('Features'));
    assert.ok(toc.includes('Details'));
    assert.ok(!toc.includes('Ignored'));
  });
});

describe('renderBadges', () => {
  it('renders badge images with links', () => {
    const html = renderBadges([
      { alt: 'Build', src: 'https://img.shields.io/badge/build-passing', href: 'https://example.com' }
    ]);
    assert.ok(html.includes('<div class="badges">'));
    assert.ok(html.includes('img.shields.io'));
    assert.ok(html.includes('href="https://example.com"'));
  });
});

describe('generateSite', () => {
  it('writes index.html and styles.css', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-site-'));
    const doc = parseReadme('# Test Project\n\nHello world.');
    const templateDir = path.join(__dirname, '..', 'templates');

    const result = generateSite(doc, {
      outputDir,
      templateDir,
      repoUrl: 'https://github.com/test/repo',
      repoName: 'test/repo',
      includeToc: true
    });

    assert.ok(fs.existsSync(result.indexPath));
    assert.ok(fs.existsSync(result.stylesPath));

    const html = fs.readFileSync(result.indexPath, 'utf8');
    assert.ok(html.includes('Test Project'));
    assert.ok(html.includes('Hello world'));
    assert.ok(html.includes('styles.css'));

    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('keeps table of contents hrefs matching heading ids', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-site-'));
    const doc = parseReadme('# Test Project\n\n## Quick Start\n\nHello.\n\n### Installation\n\nWorld.');
    const templateDir = path.join(__dirname, '..', 'templates');

    const result = generateSite(doc, {
      outputDir,
      templateDir,
      repoUrl: 'https://github.com/test/repo',
      repoName: 'test/repo',
      includeToc: true
    });

    const html = fs.readFileSync(result.indexPath, 'utf8');
    assert.ok(html.includes('href="#quick-start"'));
    assert.ok(html.includes('id="quick-start"'));
    assert.ok(html.includes('href="#installation"'));
    assert.ok(html.includes('id="installation"'));

    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
