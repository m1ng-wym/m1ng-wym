#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises"

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.METRICS_TOKEN
const user = process.env.METRICS_USER || "m1ng-wym"
const userLower = user.toLowerCase()
const highlightRepos = new Set((process.env.METRICS_HIGHLIGHT_REPOS || "kkk-an/AgentMe").split(",").map(value => value.trim()).filter(Boolean))
const maxRepos = Number.parseInt(process.env.METRICS_REPOSITORY_LIMIT || "300", 10)
const maxCommitsPerRepo = Number.parseInt(process.env.METRICS_COMMIT_LIMIT_PER_REPO || "2000", 10)
const requestTimeout = Number.parseInt(process.env.METRICS_REQUEST_TIMEOUT || "30000", 10)
const requestConcurrency = Number.parseInt(process.env.METRICS_REQUEST_CONCURRENCY || "6", 10)

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
  for (let attempt = 1; attempt <= 5; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), requestTimeout)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeout)
      if (response.status === 403 && response.headers.get("retry-after")) {
        await sleep(Number.parseInt(response.headers.get("retry-after"), 10) * 1000)
        continue
      }
      if (response.status === 404 || response.status === 409) {
        return null
      }
      if (!response.ok) {
        const body = await response.text()
        if (attempt < 5 && response.status >= 500) {
          await sleep(1000 * attempt)
          continue
        }
        throw new Error(`${response.status} ${response.statusText} for ${url}: ${body.slice(0, 300)}`)
      }
      return response.json()
    }
    catch (error) {
      clearTimeout(timeout)
      if (attempt < 5) {
        await sleep(1000 * attempt)
        continue
      }
      throw error
    }
  }
  return null
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const current = index++
      results[current] = await fn(items[current], current)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
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
    fetchRepoConnection("repositories", "affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], orderBy: {field: UPDATED_AT, direction: DESC}"),
    fetchRepoConnection("repositoriesContributedTo", "contributionTypes: [COMMIT], includeUserRepositories: true, orderBy: {field: UPDATED_AT, direction: DESC}"),
    fetchRepoConnection("repositoriesContributedTo", "contributionTypes: [PULL_REQUEST], includeUserRepositories: true, orderBy: {field: UPDATED_AT, direction: DESC}"),
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

async function fetchAuthoredPullRequests(repo) {
  const pullRequests = []
  let total = 0
  let cursor = null
  do {
    const data = await graphql(
      `query($query: String!, $cursor: String) {
        search(query: $query, type: ISSUE, first: 100, after: $cursor) {
          issueCount
          nodes {
            ... on PullRequest {
              number
              additions
              deletions
              changedFiles
              commits(first: 100) {
                totalCount
                nodes {
                  commit { oid }
                }
              }
              mergeCommit { oid }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { query: `repo:${repo.nameWithOwner} type:pr author:${user}`, cursor },
    )
    const search = data.search
    total = search.issueCount || 0
    pullRequests.push(...search.nodes.filter(Boolean).map(pr => ({
      number: pr.number,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changedFiles || 0,
      commitsTotal: pr.commits?.totalCount || 0,
      commitShas: (pr.commits?.nodes || []).map(node => node?.commit?.oid).filter(Boolean),
      mergeCommitSha: pr.mergeCommit?.oid || null,
    })))
    cursor = search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null
  } while (cursor)
  return { total, pullRequests }
}

async function fetchPullRequestCommits(repo, number) {
  const commits = []
  for (let page = 1; ; page++) {
    const url = new URL(`https://api.github.com/repos/${repo.nameWithOwner}/pulls/${number}/commits`)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", String(page))
    const pageCommits = await requestJson(url, { headers: apiHeaders })
    if (!Array.isArray(pageCommits) || pageCommits.length === 0) break
    commits.push(...pageCommits)
    if (pageCommits.length < 100) break
  }
  return commits
}

async function fetchPullRequestFiles(repo, number) {
  const files = []
  for (let page = 1; ; page++) {
    const url = new URL(`https://api.github.com/repos/${repo.nameWithOwner}/pulls/${number}/files`)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", String(page))
    const pageFiles = await requestJson(url, { headers: apiHeaders })
    if (!Array.isArray(pageFiles) || pageFiles.length === 0) break
    files.push(...pageFiles)
    if (pageFiles.length < 100) break
  }
  return files
}

function pullRequestAlreadyRepresented(pr, commitShas, extraCommitShas = []) {
  if (pr.mergeCommitSha && commitShas.has(pr.mergeCommitSha)) return true
  return [...pr.commitShas, ...extraCommitShas].some(sha => commitShas.has(sha))
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

function addLanguage(stats, language, additions, deletions, files = 1) {
  if (!language) return
  const current = stats.languages.get(language) || { additions: 0, deletions: 0, files: 0 }
  current.additions += additions
  current.deletions += deletions
  current.files += files
  stats.languages.set(language, current)
}

async function analyzeRepo(repo) {
  const stats = { ...emptyStats(), nameWithOwner: repo.nameWithOwner, isPrivate: repo.isPrivate, isOwn: repo.nameWithOwner.toLowerCase().startsWith(`${userLower}/`) }
  const [commits, prData] = await Promise.all([fetchAuthoredCommits(repo), fetchAuthoredPullRequests(repo)])
  const commitShas = new Set(commits.map(commit => commit.sha))
  stats.commits = commits.length
  stats.prs = prData.total

  const commitDetails = await mapLimit(commits, requestConcurrency, commit => fetchCommitDetail(repo, commit.sha))
  for (const detail of commitDetails) {
    if (!detail) continue
    stats.additions += detail.stats?.additions || 0
    stats.deletions += detail.stats?.deletions || 0
    for (const file of detail.files || []) {
      stats.files += 1
      addLanguage(stats, languageFor(file.filename), file.additions || 0, file.deletions || 0)
    }
  }

  for (const pr of prData.pullRequests) {
    let prCommits = null
    let represented = pullRequestAlreadyRepresented(pr, commitShas)
    if (!represented && pr.commitsTotal > pr.commitShas.length) {
      prCommits = await fetchPullRequestCommits(repo, pr.number)
      represented = pullRequestAlreadyRepresented(pr, commitShas, prCommits.map(commit => commit.sha).filter(Boolean))
    }
    if (represented) continue
    const [fallbackCommits, prFiles] = await Promise.all([
      prCommits ? Promise.resolve(prCommits) : fetchPullRequestCommits(repo, pr.number),
      fetchPullRequestFiles(repo, pr.number),
    ])
    stats.commits += Math.max(fallbackCommits.length, pr.commitsTotal)
    if (prFiles.length === 0) {
      stats.additions += pr.additions
      stats.deletions += pr.deletions
      stats.files += pr.changedFiles
      continue
    }
    for (const file of prFiles) {
      const additions = file.additions || 0
      const deletions = file.deletions || 0
      stats.additions += additions
      stats.deletions += deletions
      stats.files += 1
      addLanguage(stats, languageFor(file.filename), additions, deletions)
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
    addLanguage(target, language, stats.additions, stats.deletions, stats.files)
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

function formatPathNumber(value) {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? "0" : String(rounded)
}

function shiftedPoint(point, offset) {
  return [point[0] + offset[0], point[1] + offset[1]]
}

function pointString(point) {
  return `${formatPathNumber(point[0])} ${formatPathNumber(point[1])}`
}

function lottieShapeToPath(shape, offset) {
  const vertices = shape.v
  const inTangents = shape.i
  const outTangents = shape.o
  let path = `M${pointString(shiftedPoint(vertices[0], offset))}`

  for (let index = 1; index < vertices.length; index += 1) {
    const previous = index - 1
    path += `C${pointString(shiftedPoint([vertices[previous][0] + outTangents[previous][0], vertices[previous][1] + outTangents[previous][1]], offset))}`
    path += ` ${pointString(shiftedPoint([vertices[index][0] + inTangents[index][0], vertices[index][1] + inTangents[index][1]], offset))}`
    path += ` ${pointString(shiftedPoint(vertices[index], offset))}`
  }

  if (shape.c) {
    const last = vertices.length - 1
    path += `C${pointString(shiftedPoint([vertices[last][0] + outTangents[last][0], vertices[last][1] + outTangents[last][1]], offset))}`
    path += ` ${pointString(shiftedPoint([vertices[0][0] + inTangents[0][0], vertices[0][1] + inTangents[0][1]], offset))}`
    path += ` ${pointString(shiftedPoint(vertices[0], offset))}Z`
  }

  return path
}

function lottieGroupTransform(group) {
  const transform = group.it.find(item => item.ty === "tr")
  return transform?.p?.k || [0, 0]
}

function lottieShape(group) {
  return group.it.find(item => item.ty === "sh")?.ks
}

function renderUseAnimationsGithubIcon(animation) {
  const layer = animation.layers.find(item => item.nm === "github")
  const bodyGroup = layer.shapes.find(item => item.nm === "body")
  const tailGroup = layer.shapes.find(item => item.nm === "tail")
  const bodyPath = lottieShapeToPath(lottieShape(bodyGroup).k, lottieGroupTransform(bodyGroup))
  const tailKeyframes = lottieShape(tailGroup).k
  const tailOffset = lottieGroupTransform(tailGroup)
  const tailPaths = tailKeyframes.map(keyframe => lottieShapeToPath(keyframe.s[0], tailOffset))
  const keyTimes = tailKeyframes
    .map(keyframe => formatPathNumber((keyframe.t - animation.ip) / (animation.op - animation.ip)))
    .join(";")
  const keySplines = tailKeyframes
    .slice(0, -1)
    .map((keyframe, index) => {
      const nextKeyframe = tailKeyframes[index + 1]
      return `${keyframe.o?.x ?? 0.167} ${keyframe.o?.y ?? 0.167} ${nextKeyframe.i?.x ?? 0.833} ${nextKeyframe.i?.y ?? 0.833}`
    })
    .join(";")
  const duration = `${formatPathNumber((animation.op - animation.ip) / animation.fr)}s`
  const scale = 0.95

  return `<g class="useanimations-github-icon" data-source="https://useanimations.com/animations/github.json" transform="translate(24 18) scale(${scale})" fill="none" stroke="#24292f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="${bodyPath}"/>
    <path d="${tailPaths[0]}">
      <animate attributeName="d" dur="${duration}" repeatCount="indefinite" calcMode="spline" keyTimes="${keyTimes}" keySplines="${keySplines}" values="${tailPaths.join(";")}"/>
    </path>
  </g>`
}

function renderTitleHeader({ titleArtwork, githubIconArtwork }) {
  const title = titleArtwork
    ? `<g class="metric-title-artwork" transform="translate(33 0)">
    ${titleArtwork}
  </g>`
    : `<text x="63" y="36" class="title">Where my code goes</text>`

  return `${githubIconArtwork}
  ${title}`
}

async function readOverviewActivityCommits() {
  try {
    const overviewSvg = await readFile("metrics.overview.svg", "utf8")
    const match = overviewSvg.match(/id="overview-activity-commits-source"[^>]*>\s*([0-9][0-9,]*) Commits\s*</)
      || overviewSvg.match(/>\s*([0-9][0-9,]*) Commits\s*</)
    return match ? Number.parseInt(match[1].replaceAll(",", ""), 10) : null
  } catch {
    return null
  }
}

async function readTitleArtwork() {
  try {
    return await readFile(new URL("../assets/tiny5-title-where-my-code-goes.svg", import.meta.url), "utf8")
  } catch {
    return ""
  }
}

async function readUseAnimationsGithubIcon() {
  const raw = await readFile(new URL("../assets/useanimations-github.json", import.meta.url), "utf8")
  return renderUseAnimationsGithubIcon(JSON.parse(raw))
}

function renderSvg({ repos, totals, displayCommits, titleArtwork, githubIconArtwork }) {
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
  const width = 920
  const paddingX = 24
  const cardGap = 24
  const cardWidth = Math.floor((width - paddingX * 2 - cardGap * 2) / 3)
  const cardY = 70
  const languageStartY = 173
  const barWidthMax = 400
  const languageSquareSize = 12
  const languageSquareGap = 2
  const languageRowGap = 2
  const languageSquareStep = languageSquareSize + languageSquareGap
  const languageRowStep = languageSquareSize + languageRowGap
  const languageSquareRadius = 2
  const languageSquareCount = Math.max(1, Math.floor((barWidthMax - languageSquareSize) / languageSquareStep) + 1)
  const languageGridWidth = languageSquareSize + (languageSquareCount - 1) * languageSquareStep
  const barX = Math.round((width - languageGridWidth) / 2)
  const languageLabelX = barX - 35
  const languageTextYOffset = 10
  const languageValueX = barX + languageGridWidth + 35
  const languagePercentX = languageValueX + 155
  const repoCommitsX = 500
  const repoPrsX = 635
  const repoLinesX = 720
  const languagePanelY = languageStartY + 12
  const languagePanelHeight = topLanguages.length * languageRowStep + 18
  const repoStartY = languagePanelY + languagePanelHeight + 35
  const repoPanelY = repoStartY + 12
  const repoHeaderY = repoStartY + 32
  const repoRowStartY = repoStartY + 52
  const repoRowStep = 22
  const repoPanelHeight = 48 + topRepos.length * repoRowStep
  const height = repoPanelY + repoPanelHeight + 18
  const maxLanguage = Math.max(1, ...topLanguages.map(item => item.additions))
  const totalLanguageLines = Math.max(1, topLanguages.reduce((sum, item) => sum + item.additions, 0))
  const shownCommits = displayCommits ?? totals.commits
  const sectionColor = "#2C365D"
  const languageBarColor = "#4988C4"
  const languageBarEmptyColor = "#eaeef2"
  const rowStripeColor = "#f6f8fa"

  function renderStatCard({ className, x, label, value, accentColor }) {
    return `<g class="stat-card ${className}" transform="translate(${x} ${cardY})">
    <rect width="${cardWidth}" height="66" rx="7" fill="url(#stat-card-fill)" stroke="#d0d7de"/>
    <rect x="0" y="0" width="4" height="66" rx="2" fill="#BDE8F5"/>
    <rect x="0" y="0" width="4" height="34" rx="2" fill="${accentColor}"/>
    <g class="stat-pixels" transform="translate(${cardWidth - 44} 13)">
      <rect x="0" y="0" width="8" height="8" rx="1" fill="#2C365D"/>
      <rect x="10" y="0" width="8" height="8" rx="1" fill="#4988C4"/>
      <rect x="20" y="0" width="8" height="8" rx="1" fill="#BDE8F5"/>
      <rect x="30" y="10" width="8" height="8" rx="1" fill="#BDE8F5"/>
    </g>
    <text x="16" y="25" class="stat-label">${label}</text>
    <text x="16" y="48" class="metric">${value}</text>
    <rect x="16" y="56" width="86" height="4" rx="2" fill="#BDE8F5" fill-opacity="0.7"/>
    <rect x="16" y="56" width="52" height="4" rx="2" fill="${accentColor}"/>
  </g>`
  }

  const languageRows = topLanguages.map((item, index) => {
    const y = languageStartY + 34 + index * languageRowStep
    const filledSquares = item.additions || item.deletions
      ? Math.max(1, Math.round((item.additions / maxLanguage) * languageSquareCount))
      : 0
    const percent = Math.round((item.additions / totalLanguageLines) * 100)
    const squareY = y - 13
    const textY = squareY + languageTextYOffset
    const squares = Array.from({ length: languageSquareCount }, (_, squareIndex) => {
      const squareX = barX + squareIndex * languageSquareStep
      const fill = squareIndex < filledSquares ? languageBarColor : languageBarEmptyColor
      return `<rect x="${squareX}" y="${squareY}" width="${languageSquareSize}" height="${languageSquareSize}" rx="${languageSquareRadius}" ry="${languageSquareRadius}" fill="${fill}" stroke="#ffffff" stroke-width="1"/>`
    }).join("")
    const rowFill = index % 2 === 0 ? rowStripeColor : "#ffffff"
    return `
      <g class="language-row" data-language="${escapeXml(item.name)}">
      <rect x="40" y="${squareY - 3}" width="840" height="18" rx="4" fill="${rowFill}" opacity="0.72"/>
      <rect x="${barX - 17}" y="${squareY + 3}" width="6" height="6" rx="1.5" fill="${index < 3 ? languageBarColor : "#BDE8F5"}"/>
      <text x="${languageLabelX}" y="${textY}" class="language-label" text-anchor="end">${escapeXml(item.name)}</text>
      <g class="language-square-bar" data-language="${escapeXml(item.name)}">${squares}</g>
      <text x="${languageValueX}" y="${textY}" class="language-value">+${formatNumber(item.additions)} / -${formatNumber(item.deletions)} lines</text>
      <text x="${languagePercentX}" y="${textY}" class="language-percent">(${percent}%)</text>
      </g>`
  }).join("")

  const repoRows = topRepos.map((repo, index) => {
    const y = repoRowStartY + index * repoRowStep
    const name = publicRepoName(repo, index)
    const rowFill = index % 2 === 0 ? rowStripeColor : "#ffffff"
    const markerFill = index === 0 ? sectionColor : index === 1 ? languageBarColor : "#BDE8F5"
    return `
      <g class="repo-row" data-repo="${escapeXml(name)}">
      <rect x="40" y="${y - 15}" width="840" height="20" rx="4" fill="${rowFill}" opacity="0.72"/>
      <rect x="52" y="${y - 10}" width="7" height="7" rx="1.5" fill="${markerFill}"/>
      <text x="66" y="${y}" class="repo">${escapeXml(name)}</text>
      <text x="${repoCommitsX}" y="${y}" class="small">${formatNumber(repo.commits)} commits</text>
      <text x="${repoPrsX}" y="${y}" class="small">${formatNumber(repo.prs)} PRs</text>
      <text x="${repoLinesX}" y="${y}" class="small">+${formatNumber(repo.additions)} / -${formatNumber(repo.deletions)}</text>
      </g>`
  }).join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Authored GitHub contribution metrics">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; fill: #24292f; }
    .title { font-size: 22px; font-weight: 700; }
    .section { font-size: 15px; font-weight: 700; fill: ${sectionColor}; }
    .metric { font-size: 15px; font-weight: 700; }
    .stat-label { font-size: 10px; font-weight: 700; fill: ${sectionColor}; }
    .language-label { font-size: 11px; font-weight: 700; }
    .language-value { font-size: 10.5px; font-weight: 500; fill: #57606a; font-variant-numeric: tabular-nums; }
    .language-percent { font-size: 10.5px; font-weight: 600; fill: #6e7781; font-variant-numeric: tabular-nums; }
    .repo { font-size: 12px; font-weight: 600; }
    .small { font-size: 12px; fill: #57606a; }
    .repo-column-label { font-size: 9px; font-weight: 700; fill: #6e7781; letter-spacing: 0; }
  </style>
  <defs>
    <linearGradient id="stat-card-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f6f8fa"/>
    </linearGradient>
    <linearGradient id="activity-panel-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f6f8fa"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#ffffff" stroke="#d0d7de"/>
  ${renderTitleHeader({ titleArtwork, githubIconArtwork })}

  ${renderStatCard({
    className: "stat-card-commits",
    x: paddingX,
    label: "Commits + PRs",
    value: `${formatNumber(shownCommits)} commits / ${formatNumber(totals.prs)} PRs`,
    accentColor: sectionColor,
  })}

  ${renderStatCard({
    className: "stat-card-lines",
    x: paddingX + cardWidth + cardGap,
    label: "Line Delta",
    value: `+${formatNumber(totals.additions)} / -${formatNumber(totals.deletions)} lines`,
    accentColor: languageBarColor,
  })}

  <g class="section-heading section-heading-language">
    <g class="section-pixels section-pixels-language" transform="translate(24 ${languageStartY - 26})">
      <rect x="0" y="0" width="8" height="8" rx="1.5" fill="${sectionColor}"/>
      <rect x="10" y="0" width="8" height="8" rx="1.5" fill="${languageBarColor}"/>
      <rect x="20" y="10" width="8" height="8" rx="1.5" fill="#BDE8F5"/>
    </g>
    <text x="24" y="${languageStartY}" class="section">Language activity</text>
    <rect x="24" y="${languageStartY + 8}" width="102" height="3" rx="1.5" fill="#BDE8F5" fill-opacity="0.75"/>
    <rect x="24" y="${languageStartY + 8}" width="48" height="3" rx="1.5" fill="${languageBarColor}"/>
  </g>
  <rect class="activity-panel language-panel" x="24" y="${languagePanelY}" width="${width - paddingX * 2}" height="${languagePanelHeight}" rx="7" fill="url(#activity-panel-fill)" stroke="#d0d7de"/>
  ${languageRows || `<text x="28" y="${languageStartY + 34}" class="small">No language data found</text>`}

  <g class="section-heading section-heading-repo">
    <g class="section-pixels section-pixels-repo" transform="translate(24 ${repoStartY - 26})">
      <rect x="0" y="0" width="8" height="8" rx="1.5" fill="${sectionColor}"/>
      <rect x="10" y="10" width="8" height="8" rx="1.5" fill="${languageBarColor}"/>
      <rect x="20" y="0" width="8" height="8" rx="1.5" fill="#BDE8F5"/>
    </g>
    <text x="24" y="${repoStartY}" class="section">Repo activity</text>
    <rect x="24" y="${repoStartY + 8}" width="82" height="3" rx="1.5" fill="#BDE8F5" fill-opacity="0.75"/>
    <rect x="24" y="${repoStartY + 8}" width="42" height="3" rx="1.5" fill="${sectionColor}"/>
  </g>
  <rect class="activity-panel repo-panel" x="24" y="${repoPanelY}" width="${width - paddingX * 2}" height="${repoPanelHeight}" rx="7" fill="url(#activity-panel-fill)" stroke="#d0d7de"/>
  <g class="repo-column-labels">
    <text x="${repoCommitsX}" y="${repoHeaderY}" class="repo-column-label">COMMITS</text>
    <text x="${repoPrsX}" y="${repoHeaderY}" class="repo-column-label">PRS</text>
    <text x="${repoLinesX}" y="${repoHeaderY}" class="repo-column-label">LINES</text>
  </g>
  ${repoRows || `<text x="28" y="${repoStartY + 30}" class="small">No repository data found</text>`}
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
  const overviewActivityCommits = await readOverviewActivityCommits()
  const titleArtwork = await readTitleArtwork()
  const githubIconArtwork = await readUseAnimationsGithubIcon()
  const svg = renderSvg({ repos: analyzed, totals, displayCommits: overviewActivityCommits, titleArtwork, githubIconArtwork })
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
  console.log(`Generated metrics.languages.svg for ${analyzed.length} repositories, ${overviewActivityCommits ?? totals.commits} displayed commits, ${totals.commits} audited commits, ${totals.prs} PRs`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
