'use strict';

const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const { parseReadme } = require('./parser');
const { generateSite } = require('./generator');
const { publishToGhPages } = require('./publisher');

function getRepoMeta() {
  const repository = process.env.GITHUB_REPOSITORY || '';
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const [, name] = repository.split('/');

  return {
    repoUrl: repository ? `${serverUrl}/${repository}` : serverUrl,
    repoName: repository || 'Repository',
    fallbackTitle: name || 'Project'
  };
}

function detectLicense() {
  const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md'];

  for (const file of candidates) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/MIT License|Apache License|GNU GENERAL PUBLIC LICENSE|BSD \d-Clause/i);
    return match ? match[0] : file;
  }

  return undefined;
}

async function run() {
  try {
    const readmePath = core.getInput('readme-path') || 'README.md';
    const outputDir = core.getInput('output-dir') || 'site';
    const branch = core.getInput('branch') || 'gh-pages';
    const includeToc = core.getInput('include-toc') !== 'false';

    const absoluteReadmePath = path.resolve(process.cwd(), readmePath);

    if (!fs.existsSync(absoluteReadmePath)) {
      core.setFailed('README.md not found.');
      process.exit(1);
    }

    const markdown = fs.readFileSync(absoluteReadmePath, 'utf8');
    const repoMeta = getRepoMeta();

    core.info(`Parsing ${readmePath}...`);
    const document = parseReadme(markdown, { fallbackTitle: repoMeta.fallbackTitle });

    if (document.fallback) {
      core.warning('Invalid markdown detected; rendered README as plain text.');
    }

    core.info('Generating landing page...');
    const templateDir = path.join(__dirname, '..', 'templates');

    generateSite(document, {
      outputDir: path.resolve(process.cwd(), outputDir),
      templateDir,
      repoUrl: repoMeta.repoUrl,
      repoName: repoMeta.repoName,
      includeToc,
      license: detectLicense()
    });

    core.info(`Publishing to ${branch} branch...`);
    await publishToGhPages({
      siteDir: path.resolve(process.cwd(), outputDir),
      branch
    });

    core.info('Landing page deployed successfully.');
  } catch (error) {
    core.setFailed(error.message);
    process.exit(1);
  }
}

run();
