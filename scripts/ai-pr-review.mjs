/*
AI PR Review Script

Reads the GitHub pull request context, collects changed file diffs, calls an LLM
to produce a code review, and posts/updates a single PR comment.

Environment variables:
  - GITHUB_REPOSITORY (owner/repo)
  - GITHUB_EVENT_PATH (path to event JSON)
  - GITHUB_TOKEN (GitHub token for API calls)
  - OPENAI_API_KEY (LLM API key) — required to run
  - OPENAI_MODEL (optional, default: gpt-4o-mini)
  - OPENAI_BASE_URL (optional, default: https://api.openai.com/v1)
*/

import fs from 'node:fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

if (!GITHUB_TOKEN) {
  console.log('GITHUB_TOKEN missing. Exiting without action.');
  process.exit(0);
}

if (!OPENAI_API_KEY) {
  console.log('OPENAI_API_KEY not set. Skipping AI review.');
  process.exit(0);
}

const repoSlug = process.env.GITHUB_REPOSITORY;
if (!repoSlug || !repoSlug.includes('/')) {
  console.error('Invalid GITHUB_REPOSITORY');
  process.exit(1);
}
const [owner, repo] = repoSlug.split('/');

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath || !fs.existsSync(eventPath)) {
  console.error('GITHUB_EVENT_PATH not found');
  process.exit(1);
}
const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const pr = event.pull_request;
if (!pr) {
  console.log('Not a pull_request event. Nothing to do.');
  process.exit(0);
}
if (pr.draft) {
  console.log('PR is draft. Skipping AI review.');
  process.exit(0);
}
const prNumber = pr.number;

async function ghRequest(method, path, params, body) {
  const url = new URL(`https://api.github.com${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-pr-review-bot'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${method} ${url.pathname} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

async function listPRFiles(owner, repo, number) {
  const files = [];
  let page = 1;
  while (true) {
    const batch = await ghRequest('GET', `/repos/${owner}/${repo}/pulls/${number}/files`, { per_page: 100, page });
    files.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 10) break; // Hard cap for safety
  }
  return files;
}

async function listIssueComments(owner, repo, number) {
  const comments = [];
  let page = 1;
  while (true) {
    const batch = await ghRequest('GET', `/repos/${owner}/${repo}/issues/${number}/comments`, { per_page: 100, page });
    comments.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 10) break;
  }
  return comments;
}

async function createComment(owner, repo, number, body) {
  return ghRequest('POST', `/repos/${owner}/${repo}/issues/${number}/comments`, null, { body });
}

async function updateComment(owner, repo, commentId, body) {
  return ghRequest('PATCH', `/repos/${owner}/${repo}/issues/comments/${commentId}`, null, { body });
}

function trimToBudget(str, maxChars) {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  const head = Math.floor(maxChars * 0.7);
  const tail = Math.floor(maxChars * 0.25);
  return str.slice(0, head) + `\n...\n[truncated ${str.length - head - tail} chars]\n...\n` + str.slice(-tail);
}

function buildPrompt({ prTitle, prBody, files, diffs, repo, owner }) {
  const changedList = files.map(f => `- ${f.filename} (${f.status}${f.changes ? `, +${f.additions}/-${f.deletions}` : ''})`).join('\n');
  const diffText = diffs.join('\n\n');
  return [
    {
      role: 'system',
      content: [
        'You are a senior engineer performing a precise code review.',
        'Be concise, actionable, and specific. Focus on correctness, security, performance, readability, and tests.',
        'When possible, reference concrete file paths and approximate line numbers from the diff context.'
      ].join(' ')
    },
    {
      role: 'user',
      content: trimToBudget(
        [
          `Repository: ${owner}/${repo}`,
          `PR Title: ${prTitle}`,
          `PR Description: ${prBody || '(no description)'}`,
          '',
          'Changed files:',
          changedList || '(no file list)',
          '',
          'Unified diffs (may be truncated):',
          diffText || '(no diffs available)'
        ].join('\n'),
        120000 // ~120k chars to fit within model limits safely
      )
    }
  ];
}

async function callOpenAI(messages) {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 1200
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API failed: ${res.status} ${res.statusText} ${text}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || '';
  return content.trim();
}

function formatReviewBody(aiText, meta) {
  const header = 'AI Review Bot\n\n';
  const markers = '<!-- ai-review-bot -->';
  const info = `PR #${meta.prNumber} | ${meta.owner}/${meta.repo}`;
  const footer = [
    '',
    'Notes:',
    '- This is an automated AI-assisted review. Verify suggestions before applying.',
    `- Model: ${OPENAI_MODEL}`,
    markers
  ].join('\n');
  return `### ${header}${info}\n\n${aiText}\n${footer}`;
}

function selectDiffs(files) {
  const diffs = [];
  const MAX_TOTAL = 140000; // chars across all diffs
  let used = 0;
  for (const f of files) {
    if (!f.patch) {
      diffs.push(`--- ${f.filename} (${f.status})\n(no patch available from GitHub API)`);
      continue;
    }
    const header = `--- ${f.filename} (${f.status})`;
    const budget = Math.max(2000, Math.floor((MAX_TOTAL - used) / Math.max(1, files.length)));
    const chunk = trimToBudget(f.patch, budget);
    const text = `${header}\n${chunk}`;
    used += text.length;
    diffs.push(text);
    if (used >= MAX_TOTAL) break;
  }
  return diffs;
}

async function main() {
  const files = await listPRFiles(owner, repo, prNumber);
  const diffs = selectDiffs(files);
  const messages = buildPrompt({
    prTitle: pr.title || '',
    prBody: pr.body || '',
    files,
    diffs,
    owner,
    repo
  });

  let reviewText = '';
  try {
    reviewText = await callOpenAI(messages);
  } catch (err) {
    console.log('AI call failed, posting diagnostic instead.');
    reviewText = `The AI reviewer encountered an error.\n\nError: ${(err && err.message) || String(err)}\n\nChanged files:\n${files.map(f => `- ${f.filename} (${f.status})`).join('\n')}`;
  }

  const body = formatReviewBody(reviewText, { owner, repo, prNumber });

  // Upsert comment (update previous AI comment if present)
  const comments = await listIssueComments(owner, repo, prNumber);
  const marker = '<!-- ai-review-bot -->';
  const previous = comments.find(c => c.user?.type === 'Bot' && c.user?.login?.includes('github-actions') && typeof c.body === 'string' && c.body.includes(marker));

  if (previous) {
    await updateComment(owner, repo, previous.id, body);
    console.log(`Updated AI review comment (${previous.id}).`);
  } else {
    const created = await createComment(owner, repo, prNumber, body);
    console.log(`Created AI review comment (${created.id}).`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

