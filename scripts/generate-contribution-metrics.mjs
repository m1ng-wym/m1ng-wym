#!/usr/bin/env node

import { writeFile } from "node:fs/promises"

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.METRICS_TOKEN
const user = process.env.METRICS_USER || "m1ng-wym"
const highlightRepos = new Set((process.env.METRICS_HIGHLIGHT_REPOS || "kkk-an/AgentMe").split(",").map(value => value.trim()).filter(Boolean))
const maxRepos = Number.parseInt(process.env.METRICS_REPOSITORY_LIMIT || "80", 10)
const maxCommitsPerRepo = Number.parseInt(process.env.METRICS_COMMIT_LIMIT_PER_REPO || "500", 10)

if (!token) {
  throw new Error("Missing GH_TOKEN, GITHUB_TOKEN, or METRICS_TOKEN")
}

const apiHeaders = {
  accept: "application/vnd.github+json",
  authorization: `Bearer ${token}`,
  "user-agent": "m1ng-wym-profile-metrics",
  "x-github-api-version": "2022-11-28",
}

const graphqlHeaders = {
  ...apiHeaders,
  accept: "application/vnd.github+json",
  "content-type": "application/json",
}

const languageColors = new Map([
  ["TypeScript", "#3178c6"],
  ["JavaScript", "#f1e05a"],
  ["Python", "#3572A5"],
  ["Go", "#00ADD8"],
  ["Swift", "#F05138"],
  ["Java", "#b07219"],
  ["CSS", "#663399"],
  ["HTML", "#e34c26"],
  ["JSON", "#292929"],
  ["YAML", "#cb171e"],
  ["Markdown", "#083fa1"],
  ["Shell", "#89e051"],
  ["SQL", "#e38c00"],
  ["Dockerfile", "#384d54"],
  ["Other", "#8c959f"],
])

const extensionLanguages = new Map([
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".mts", "TypeScript"],
  [".cts", "TypeScript"],
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".py", "Python"],
  [".go", "Go"],
  [".swift", "Swift"],
  [".java", "Java"],
  [".kt", "Kotlin"],
  [".kts", "Kotlin"],
  [".rs", "Rust"],
  [".rb", "Ruby"],
  [".php", "PHP"],
  [".cs", "C#"],
  [".cpp", "C++"],
  [".cc", "C++"],
  [".cxx", "C++"],
  [".c", "C"],
  [".h", "C/C++ Header"],
  [".hpp", "C/C++ Header"],
  [".css", "CSS"],
  [".scss", "SCSS"],
  [".sass", "Sass"],
  [".html", "HTML"],
  [".htm", "HTML"],
  [".vue", "Vue"],
  [".svelte", "Svelte"],
  [".json", "JSON"],
  [".jsonc", "JSON"],
  [".yaml", "YAML"],
  [".yml", "YAML"],
  [".toml", "TOML"],
  [".xml", "XML"],
  [".sh", "Shell"],
  [".bash", "Shell"],
  [".zsh", "Shell"],
  [".sql", "SQL"],
])

const basenameLanguages = new Map([
  ["Dockerfile", "Dockerfile"],
  ["dockerfile", "Dockerfile"],
  ["Makefile", "Makefile"],
])

const skippedBasenames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
  "Pipfile.lock",
])

const skippedExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".mp4",
  ".mov",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".md",
  ".mdx",
])

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function requestJson(url, options = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, options)
    if (response.status === 403 && response.headers.get("retry-after")) {
      await sleep(Number.parseInt(response.headers.get("retry-after"), 10) * 1000)
      continue
    }
    if (response.status === 404 || response.status === 409) {
      return null
    }
    if (!response.ok) {
      const body = await response.text()
      if (attempt < 3 && response.status >= 500) {
        await sleep(1000 * attempt)
        continue
      }
      throw new Error(`${response.status} ${response.statusText} for ${url}: ${body.slice(0, 300)}`)
    }
    return response.json()
  }
  return null
}

async function graphql(query, variables) {
  const response = await requestJson("https://api.github.com/graphql", {
    method: "POST",
    headers: graphqlHeaders,
    body: JSON.stringify({ query, variables }),
  })
  if (response?.errors?.length) {
    throw new Error(response.errors.map(error => error.message).join("; "))
  }
  return response.data
}

async function fetchRepoConnection(field, args) {
  const repos = []
  let cursor = null
  do {
    const data = await graphql(
      `query($login: String!, $cursor: String) {
        user(login: $login) {
          ${field}(first: 100, after: $cursor, ${args}) {
            nodes {
              nameWithOwner
              isPrivate
              isArchived
              isFork
              updatedAt
              defaultBranchRef { name }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { login: user, cursor },
    )
    const connection = data.user[field]
    repos.push(...connection.nodes.filter(Boolean))
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
  } while (cursor)
  return repos
}

async function fetchRepo(handle) {
  const [owner, repo] = handle.split("/")
  const data = await requestJson(`https://api.github.com/repos/${owner}/${repo}`, { headers: apiHeaders })
  if (!data) return null
  return {
    nameWithOwner: data.full_name,
    isPrivate: data.private,
    isArchived: data.archived,
    isFork: data.fork,
    updatedAt: data.updated_at,
    defaultBranchRef: { name: data.default_branch },
  }
}

async function discoverRepos() {
  const [owned, commitRepos, prRepos] = await Promise.all([
    fetchRepoConnection("repositories", "affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], isFork: false, orderBy: {field: UPDATED_AT, direction: DESC}"),
    fetchRepoConnection("repositoriesContributedTo", "contributionTypes: [COMMIT], includeUserRepositories: false, orderBy: {field: UPDATED_AT, direction: DESC}"),
    fetchRepoConnection("repositoriesContributedTo", "contributionTypes: [PULL_REQUEST], includeUserRepositories: false, orderBy: {field: UPDATED_AT, direction: DESC}"),
  ])

  const map = new Map()
  for (const [source, repos] of [["owned", owned], ["commit", commitRepos], ["pull_request", prRepos]]) {
    for (const repo of repos) {
      if (!repo?.nameWithOwner || repo.isArchived) continue
      const current = map.get(repo.nameWithOwner) || { ...repo, sources: new Set() }
      current.sources.add(source)
      map.set(repo.nameWithOwner, current)
    }
  }

  for (const repo of highlightRepos) {
    if (!map.has(repo)) {
      const fetched = await fetchRepo(repo)
      if (fetched) map.set(repo, { ...fetched, sources: new Set(["highlight"]) })
    }
  }

  const repos = [...map.values()].sort((a, b) => {
    const aHighlight = highlightRepos.has(a.nameWithOwner) ? 1 : 0
    const bHighlight = highlightRepos.has(b.nameWithOwner) ? 1 : 0
    if (aHighlight !== bHighlight) return bHighlight - aHighlight
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  })

  const highlights = repos.filter(repo => highlightRepos.has(repo.nameWithOwner))
  const rest = repos.filter(repo => !highlightRepos.has(repo.nameWithOwner)).slice(0, Math.max(0, maxRepos - highlights.length))
  return [...highlights, ...rest]
}

async function fetchAuthoredCommits(repo) {
  const commits = []
  for (let page = 1; commits.length < maxCommitsPerRepo; page++) {
    const url = new URL(`https://api.github.com/repos/${repo.nameWithOwner}/commits`)
    url.searchParams.set("author", user)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", String(page))
    const pageCommits = await requestJson(url, { headers: apiHeaders })
    if (!Array.isArray(pageCommits) || pageCommits.length === 0) break
    commits.push(...pageCommits)
    if (pageCommits.length < 100) break
  }
  return commits.slice(0, maxCommitsPerRepo)
}

async function fetchCommitDetail(repo, sha) {
  return requestJson(`https://api.github.com/repos/${repo.nameWithOwner}/commits/${sha}`, { headers: apiHeaders })
}

async function fetchAuthoredPrCount(repo) {
  const data = await graphql(
    `query($query: String!) {
      search(query: $query, type: ISSUE, first: 1) {
        issueCount
      }
    }`,
    { query: `repo:${repo.nameWithOwner} type:pr author:${user}` },
  )
  return data.search.issueCount || 0
}

function languageFor(filename) {
  const parts = filename.split("/")
  const basename = parts.at(-1) || filename
  if (skippedBasenames.has(basename)) return null
  if (parts.some(part => part === "node_modules" || part === "dist" || part === "build" || part === "coverage")) return null
  if (basenameLanguages.has(basename)) return basenameLanguages.get(basename)
  const lower = basename.toLowerCase()
  const extension = lower.includes(".") ? `.${lower.split(".").at(-1)}` : ""
  if (skippedExtensions.has(extension)) return null
  return extensionLanguages.get(extension) || "Other"
}

function emptyStats() {
  return { commits: 0, prs: 0, additions: 0, deletions: 0, files: 0, languages: new Map() }
}

function addLanguage(stats, language, additions, deletions) {
  if (!language) return
  const current = stats.languages.get(language) || { additions: 0, deletions: 0, files: 0 }
  current.additions += additions
  current.deletions += deletions
  current.files += 1
  stats.languages.set(language, current)
}

async function analyzeRepo(repo) {
  const stats = { ...emptyStats(), nameWithOwner: repo.nameWithOwner, isPrivate: repo.isPrivate, isOwn: repo.nameWithOwner.toLowerCase().startsWith(`${user.toLowerCase()}/`) }
  const [commits, prs] = await Promise.all([fetchAuthoredCommits(repo), fetchAuthoredPrCount(repo)])
  stats.commits = commits.length
  stats.prs = prs

  for (const commit of commits) {
    if ((commit.parents || []).length > 1) continue
    const detail = await fetchCommitDetail(repo, commit.sha)
    if (!detail) continue
    stats.additions += detail.stats?.additions || 0
    stats.deletions += detail.stats?.deletions || 0
    for (const file of detail.files || []) {
      stats.files += 1
      addLanguage(stats, languageFor(file.filename), file.additions || 0, file.deletions || 0)
    }
  }
  return stats
}

function mergeStats(target, source) {
  target.commits += source.commits
  target.prs += source.prs
  target.additions += source.additions
  target.deletions += source.deletions
  target.files += source.files
  for (const [language, stats] of source.languages) {
    addLanguage(target, language, stats.additions, stats.deletions)
  }
}

function languageEntries(stats) {
  return [...stats.languages.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .filter(item => item.additions > 0 || item.deletions > 0)
    .sort((a, b) => b.additions - a.additions)
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value)
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function publicRepoName(repo, index) {
  if (repo.aggregate) return repo.nameWithOwner
  if (!repo.isPrivate || highlightRepos.has(repo.nameWithOwner)) return repo.nameWithOwner
  return `Private repo ${index + 1}`
}

function renderSvg({ repos, totals, own, external, generatedAt }) {
  const topLanguages = languageEntries(totals).slice(0, 8)
  const privateAggregate = { ...emptyStats(), nameWithOwner: "Other private repositories", isPrivate: true, isOwn: false, aggregate: true }
  for (const repo of repos) {
    if (repo.isPrivate && !highlightRepos.has(repo.nameWithOwner)) mergeStats(privateAggregate, repo)
  }
  const displayRepos = [
    ...repos.filter(repo => highlightRepos.has(repo.nameWithOwner) && (repo.commits || repo.prs)),
    ...repos.filter(repo => !repo.isPrivate && !highlightRepos.has(repo.nameWithOwner) && (repo.commits || repo.prs)),
    ...(privateAggregate.commits || privateAggregate.prs ? [privateAggregate] : []),
  ]
  const topRepos = displayRepos
    .sort((a, b) => {
      const aHighlight = highlightRepos.has(a.nameWithOwner) ? 1 : 0
      const bHighlight = highlightRepos.has(b.nameWithOwner) ? 1 : 0
      if (aHighlight !== bHighlight) return bHighlight - aHighlight
      return b.additions - a.additions
    })
    .slice(0, 8)
  const languageStartY = 185
  const repoStartY = languageStartY + 38 + topLanguages.length * 28
  const height = repoStartY + 64 + topRepos.length * 26
  const width = 760
  const maxLanguage = Math.max(1, ...topLanguages.map(item => item.additions))
  const totalLanguageLines = Math.max(1, topLanguages.reduce((sum, item) => sum + item.additions, 0))
  const now = generatedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")

  const languageRows = topLanguages.map((item, index) => {
    const y = languageStartY + 34 + index * 28
    const barWidth = Math.max(3, Math.round((item.additions / maxLanguage) * 300))
    const percent = Math.round((item.additions / totalLanguageLines) * 100)
    const color = languageColors.get(item.name) || languageColors.get("Other")
    return `
      <text x="28" y="${y}" class="label">${escapeXml(item.name)}</text>
      <rect x="160" y="${y - 12}" width="300" height="10" rx="5" fill="#eaeef2"/>
      <rect x="160" y="${y - 12}" width="${barWidth}" height="10" rx="5" fill="${color}"/>
      <text x="480" y="${y}" class="small">+${formatNumber(item.additions)} / -${formatNumber(item.deletions)} lines (${percent}%)</text>`
  }).join("")

  const repoRows = topRepos.map((repo, index) => {
    const y = repoStartY + 42 + index * 26
    const name = publicRepoName(repo, index)
    const type = repo.aggregate ? "private aggregate" : repo.isOwn ? "own" : highlightRepos.has(repo.nameWithOwner) ? "external highlight" : "external"
    return `
      <text x="28" y="${y}" class="repo">${escapeXml(name)}</text>
      <text x="310" y="${y}" class="small">${type}</text>
      <text x="460" y="${y}" class="small">${formatNumber(repo.commits)} commits</text>
      <text x="555" y="${y}" class="small">${formatNumber(repo.prs)} PRs</text>
      <text x="620" y="${y}" class="small">+${formatNumber(repo.additions)} / -${formatNumber(repo.deletions)}</text>`
  }).join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Authored GitHub contribution metrics">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; fill: #24292f; }
    .title { font-size: 22px; font-weight: 700; }
    .section { font-size: 15px; font-weight: 700; fill: #0969da; }
    .metric { font-size: 14px; font-weight: 600; }
    .label { font-size: 13px; font-weight: 600; }
    .repo { font-size: 12px; font-weight: 600; }
    .small { font-size: 12px; fill: #57606a; }
    .note { font-size: 11px; fill: #6e7781; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#ffffff" stroke="#d0d7de"/>
  <text x="24" y="36" class="title">Authored contribution metrics</text>
  <text x="24" y="60" class="small">Accessible own repositories and external repositories contributed to by @${escapeXml(user)}</text>

  <rect x="24" y="82" width="220" height="58" rx="6" fill="#f6f8fa"/>
  <text x="40" y="108" class="metric">${formatNumber(repos.length)} repositories scanned</text>
  <text x="40" y="130" class="small">${formatNumber(own.commits)} own commits / ${formatNumber(external.commits)} external commits</text>

  <rect x="270" y="82" width="220" height="58" rx="6" fill="#f6f8fa"/>
  <text x="286" y="108" class="metric">${formatNumber(totals.commits)} commits / ${formatNumber(totals.prs)} PRs</text>
  <text x="286" y="130" class="small">Authored by ${escapeXml(user)}</text>

  <rect x="516" y="82" width="220" height="58" rx="6" fill="#f6f8fa"/>
  <text x="532" y="108" class="metric">+${formatNumber(totals.additions)} / -${formatNumber(totals.deletions)} lines</text>
  <text x="532" y="130" class="small">${formatNumber(totals.files)} changed files</text>

  <text x="24" y="${languageStartY}" class="section">Code language split by added lines</text>
  ${languageRows || `<text x="28" y="${languageStartY + 34}" class="small">No language data found</text>`}

  <text x="24" y="${repoStartY}" class="section">Repository coverage</text>
  <text x="28" y="${repoStartY + 22}" class="note">Private repository names are redacted unless explicitly highlighted.</text>
  ${repoRows || `<text x="28" y="${repoStartY + 42}" class="small">No repository data found</text>`}

  <text x="24" y="${height - 24}" class="note">Language split uses commit file stats and extension mapping; docs, lock files, and binary assets are ignored. Generated ${escapeXml(now)}.</text>
</svg>
`
}

function serializableRepo(repo, index) {
  return {
    nameWithOwner: publicRepoName(repo, index),
    highlighted: highlightRepos.has(repo.nameWithOwner),
    private: repo.isPrivate,
    own: repo.isOwn,
    commits: repo.commits,
    prs: repo.prs,
    additions: repo.additions,
    deletions: repo.deletions,
    files: repo.files,
    languages: languageEntries(repo),
  }
}

function serializableRepositories(repos) {
  const privateAggregate = { ...emptyStats(), nameWithOwner: "Other private repositories", isPrivate: true, isOwn: false, aggregate: true }
  const visible = []
  for (const repo of repos) {
    if (repo.isPrivate && !highlightRepos.has(repo.nameWithOwner)) {
      mergeStats(privateAggregate, repo)
    }
    else {
      visible.push(repo)
    }
  }
  if (privateAggregate.commits || privateAggregate.prs) visible.push(privateAggregate)
  return visible.map(serializableRepo)
}

async function main() {
  const discovered = await discoverRepos()
  const analyzed = []
  for (const repo of discovered) {
    const stats = await analyzeRepo(repo)
    if (stats.commits || stats.prs || highlightRepos.has(repo.nameWithOwner)) analyzed.push(stats)
  }

  const totals = emptyStats()
  const own = emptyStats()
  const external = emptyStats()
  for (const repo of analyzed) {
    mergeStats(totals, repo)
    mergeStats(repo.isOwn ? own : external, repo)
  }

  const generatedAt = new Date().toISOString()
  const svg = renderSvg({ repos: analyzed, totals, own, external, generatedAt })
  await writeFile("metrics.languages.svg", svg)
  await writeFile("metrics.contributions.json", `${JSON.stringify({
    generatedAt,
    user,
    summary: {
      repositories: analyzed.length,
      commits: totals.commits,
      pullRequests: totals.prs,
      additions: totals.additions,
      deletions: totals.deletions,
      files: totals.files,
      ownCommits: own.commits,
      externalCommits: external.commits,
      languages: languageEntries(totals),
    },
    repositories: serializableRepositories(analyzed),
  }, null, 2)}\n`)
  console.log(`Generated metrics.languages.svg for ${analyzed.length} repositories, ${totals.commits} commits, ${totals.prs} PRs`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
