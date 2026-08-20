'use strict';

const fs = require('fs');
const path = require('path');
const exec = require('@actions/exec');

async function run(command, args, options = {}) {
  let stdout = '';
  let stderr = '';

  const exitCode = await exec.exec(command, args, {
    ...options,
    listeners: {
      stdout: (data) => { stdout += data.toString(); },
      stderr: (data) => { stderr += data.toString(); }
    },
    ignoreReturnCode: true
  });

  return { exitCode, stdout, stderr };
}

async function configureGit() {
  await exec.exec('git', ['config', '--global', '--add', 'safe.directory', '*']);
  await exec.exec('git', ['config', '--global', 'user.name', 'github-actions[bot]']);
  await exec.exec('git', ['config', '--global', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
}

function getRemoteUrl() {
  const repository = process.env.GITHUB_REPOSITORY;
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const token = process.env.GITHUB_TOKEN;

  if (token && repository) {
    const host = serverUrl.replace(/^https?:\/\//, '');
    return `https://x-access-token:${token}@${host}/${repository}.git`;
  }

  return repository ? `${serverUrl}/${repository}.git` : serverUrl;
}

async function branchExists(branch, remoteUrl) {
  const { exitCode, stdout } = await run('git', ['ls-remote', '--heads', remoteUrl, branch]);
  return exitCode === 0 && stdout.trim().length > 0;
}

function copySiteFiles(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copySiteFiles(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

async function publishToGhPages(options) {
  const { siteDir, branch = 'gh-pages', retry = true } = options;

  await configureGit();

  const workDir = path.join(process.cwd(), '.gh-pages-work');
  const remoteUrl = getRemoteUrl();
  const exists = await branchExists(branch, remoteUrl);

  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  fs.mkdirSync(workDir, { recursive: true });

  if (exists) {
    await exec.exec('git', ['clone', '--depth', '1', '--branch', branch, remoteUrl, workDir]);
    cleanDirectory(workDir);
  } else {
    await exec.exec('git', ['init'], { cwd: workDir });
    await exec.exec('git', ['checkout', '-b', branch], { cwd: workDir });
    await exec.exec('git', ['remote', 'add', 'origin', remoteUrl], { cwd: workDir });
  }

  copySiteFiles(siteDir, workDir);

  await exec.exec('git', ['add', '-A'], { cwd: workDir });

  const { exitCode: statusExitCode, stdout: statusStdout } = await run(
    'git', ['status', '--porcelain'], { cwd: workDir }
  );

  if (statusExitCode !== 0 || !statusStdout.trim()) {
    console.log('No changes to publish.');
    fs.rmSync(workDir, { recursive: true, force: true });
    return;
  }

  await exec.exec('git', ['commit', '-m', 'Deploy landing page from README'], { cwd: workDir });

  const push = async () => {
    const args = exists ? ['push', 'origin', branch] : ['push', '-u', 'origin', branch];
    const { exitCode, stderr } = await run('git', args, { cwd: workDir });

    if (exitCode !== 0) {
      throw new Error(`Failed to push to ${branch}: ${stderr.trim() || 'unknown error'}`);
    }
  };

  try {
    await push();
  } catch (error) {
    if (!retry) {
      fs.rmSync(workDir, { recursive: true, force: true });
      throw new Error(
        `GitHub Pages publishing failed: ${error.message}. ` +
        'Ensure the workflow has contents: write permission and GitHub Pages is configured to deploy from the gh-pages branch.'
      );
    }

    console.warn('Push failed, retrying once...');
    await push();
  }

  fs.rmSync(workDir, { recursive: true, force: true });
  console.log(`Successfully published to ${branch} branch.`);
}

module.exports = {
  publishToGhPages,
  configureGit,
  branchExists,
  copySiteFiles
};
