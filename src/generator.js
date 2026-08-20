'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { sanitize, escapeHtml } = require('./utils/sanitize');

marked.setOptions({ gfm: true, breaks: true });

function renderBadges(badges) {
  if (!badges.length) return '';

  const items = badges.map((badge) => {
    const img = `<img src="${escapeHtml(badge.src)}" alt="${escapeHtml(badge.alt)}">`;
    if (badge.href) {
      return `<a href="${escapeHtml(badge.href)}" target="_blank" rel="noopener noreferrer">${img}</a>`;
    }
    return img;
  });

  return `<div class="badges">${items.join('')}</div>`;
}

function renderToc(sections) {
  const headings = sections.filter(
    (node) => node.type === 'heading' && node.level >= 2 && node.level <= 3
  );

  if (!headings.length) return '';

  const items = headings.map((heading) => {
    const indent = heading.level === 3 ? ' class="toc-h3"' : '';
    return `<li${indent}><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`;
  });

  return `
    <nav class="toc" aria-label="Table of contents">
      <h2>Contents</h2>
      <ul>${items.join('')}</ul>
    </nav>
  `.trim();
}

function renderNode(node) {
  switch (node.type) {
    case 'heading': {
      const tag = `h${node.level}`;
      return `<${tag} id="${escapeHtml(node.id)}">${escapeHtml(node.text)}</${tag}>`;
    }

    case 'paragraph':
      return sanitize(marked.parse(node.text || node.raw || ''));

    case 'code':
      return `<pre><code class="language-${escapeHtml(node.language)}">${escapeHtml(node.content)}</code></pre>`;

    case 'blockquote':
      return `<blockquote>${sanitize(marked.parse(node.text || ''))}</blockquote>`;

    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const items = node.items.map((item) => {
        const checkbox = item.task
          ? `<input type="checkbox" disabled${item.checked ? ' checked' : ''}> `
          : '';
        const content = sanitize(marked.parseInline(item.text));
        const className = item.task ? ' class="task-list-item"' : '';
        return `<li${className}>${checkbox}${content}</li>`;
      });
      return `<${tag}>${items.join('')}</${tag}>`;
    }

    case 'table': {
      const headers = node.headers
        .map((header) => `<th>${sanitize(marked.parseInline(header))}</th>`)
        .join('');
      const rows = node.rows
        .map((row) => {
          const cells = row
            .map((cell) => `<td>${sanitize(marked.parseInline(cell))}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    case 'html':
      return node.content || '';

    case 'hr':
      return '<hr>';

    default:
      if (node.text) return `<p>${escapeHtml(node.text)}</p>`;
      return '';
  }
}

function renderContent(sections) {
  return sections.map(renderNode).filter(Boolean).join('\n');
}

function renderFooter(meta) {
  const licenseText = meta.license
    ? `<p>License: ${escapeHtml(meta.license)}</p>`
    : '';

  return `
    <p>
      Generated from README.md &middot;
      <a href="${escapeHtml(meta.repoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(meta.repoName)}</a>
    </p>
    ${licenseText}
  `.trim();
}

function applyTemplate(templatePath, values) {
  let template = fs.readFileSync(templatePath, 'utf8');

  for (const [key, value] of Object.entries(values)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return template;
}

function generateSite(document, options) {
  const {
    outputDir,
    templateDir,
    repoUrl,
    repoName,
    includeToc = true,
    license
  } = options;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'assets'), { recursive: true });

  const badgesHtml = renderBadges(document.badges);
  const tocHtml = includeToc ? renderToc(document.sections) : '';
  const contentHtml = sanitize(renderContent(document.sections));
  const footerHtml = renderFooter({ repoUrl, repoName, license });

  const indexHtml = applyTemplate(path.join(templateDir, 'default.html'), {
    title: escapeHtml(document.title),
    description: escapeHtml(`${document.title} — generated landing page`),
    badges: badgesHtml,
    toc: tocHtml,
    content: contentHtml,
    footer: footerHtml,
    repoUrl: escapeHtml(repoUrl)
  });

  const indexPath = path.join(outputDir, 'index.html');
  const stylesPath = path.join(outputDir, 'styles.css');
  const assetsDir = path.join(outputDir, 'assets');

  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  fs.copyFileSync(path.join(templateDir, 'styles.css'), stylesPath);

  return { indexPath, stylesPath, assetsDir };
}

module.exports = {
  generateSite,
  renderBadges,
  renderToc,
  renderContent,
  renderFooter
};
