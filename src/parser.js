'use strict';

const { Lexer } = require('marked');
const { sanitize, slugify } = require('./utils/sanitize');

const BADGE_PATTERN = /!\[[^\]]*\]\([^)]+\)/;

function isBadgeParagraph(token) {
  const text = token.text || '';
  return BADGE_PATTERN.test(text) && !text.includes('\n\n');
}

function parseBadges(text) {
  const badges = [];
  const pattern = /(?:\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\))/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match[1] !== undefined) {
      badges.push({ alt: match[1], src: match[2], href: match[3] });
    } else {
      badges.push({ alt: match[4], src: match[5], href: null });
    }
  }

  return badges;
}

function tokensToAst(tokens) {
  const nodes = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        nodes.push({
          type: 'heading',
          level: token.depth,
          text: token.text,
          id: slugify(token.text)
        });
        break;

      case 'paragraph':
        nodes.push({ type: 'paragraph', text: token.text, raw: token.raw });
        break;

      case 'code':
        nodes.push({
          type: 'code',
          language: token.lang || '',
          content: token.text
        });
        break;

      case 'blockquote':
        nodes.push({
          type: 'blockquote',
          text: token.text,
          tokens: token.tokens || []
        });
        break;

      case 'list':
        nodes.push({
          type: 'list',
          ordered: token.ordered,
          items: (token.items || []).map((item) => ({
            text: item.text,
            task: item.task,
            checked: item.checked
          }))
        });
        break;

      case 'table':
        nodes.push({
          type: 'table',
          headers: (token.header || []).map((cell) => cell.text),
          rows: (token.rows || []).map((row) => row.map((cell) => cell.text))
        });
        break;

      case 'html':
        nodes.push({
          type: 'html',
          content: sanitize(token.raw || token.text || '')
        });
        break;

      case 'hr':
        nodes.push({ type: 'hr' });
        break;

      case 'space':
        break;

      default:
        if (token.raw) {
          nodes.push({ type: 'paragraph', text: token.raw.trim(), raw: token.raw });
        }
        break;
    }
  }

  return nodes;
}

function extractTitle(nodes, fallback) {
  const h1 = nodes.find((node) => node.type === 'heading' && node.level === 1);
  if (h1) return h1.text;

  const firstHeading = nodes.find((node) => node.type === 'heading');
  if (firstHeading) return firstHeading.text;

  return fallback;
}

function extractBadges(nodes) {
  const badges = [];
  let index = 0;

  while (index < nodes.length) {
    const node = nodes[index];

    if (node.type === 'paragraph' && isBadgeParagraph(node)) {
      badges.push(...parseBadges(node.text));
      index += 1;
      continue;
    }

    if (node.type === 'heading' && node.level === 1) {
      index += 1;
      continue;
    }

    break;
  }

  return { badges, contentNodes: nodes.slice(index) };
}

function parseReadme(markdown, options = {}) {
  const fallbackTitle = options.fallbackTitle || 'Project';

  try {
    const lexer = new Lexer();
    lexer.options.gfm = true;
    lexer.options.breaks = true;

    const tokens = lexer.lex(markdown);
    const allNodes = tokensToAst(tokens);
    const title = extractTitle(allNodes, fallbackTitle);
    const { badges, contentNodes } = extractBadges(allNodes);

    return {
      type: 'document',
      title,
      badges,
      sections: contentNodes
    };
  } catch (error) {
    console.warn(`Markdown parsing failed, falling back to raw text: ${error.message}`);
    return {
      type: 'document',
      title: fallbackTitle,
      badges: [],
      sections: [{ type: 'paragraph', text: markdown, raw: markdown }],
      fallback: true
    };
  }
}

module.exports = {
  parseReadme,
  parseBadges,
  tokensToAst
};
