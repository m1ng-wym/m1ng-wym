#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"

const profileAssetsWorkflowPath = ".github/workflows/profile-assets-contract.yml"
const metricsWorkflowPath = ".github/workflows/metrics.yml"
const renderMetricsOverviewWorkflowPath = ".github/workflows/render-metrics-overview.yml"
const snakeWorkflowPath = ".github/workflows/snake.yml"
const dependabotPath = ".github/dependabot.yml"

const workflowPaths = [
  profileAssetsWorkflowPath,
  metricsWorkflowPath,
  renderMetricsOverviewWorkflowPath,
  snakeWorkflowPath,
]

const managedActions = new Set([
  "actions/checkout",
  "actions/setup-node",
  "actions/upload-artifact",
  "Platane/snk/svg-only",
  "crazy-max/ghaction-github-pages",
])

function fail(message) {
  console.error(`profile workflow contract failed: ${message}`)
  process.exit(1)
}

function readRequiredFile(filePath, label) {
  if (!existsSync(filePath)) {
    fail(`${label} is missing at ${filePath}`)
  }

  return readFileSync(filePath, "utf8")
}

const profileAssetsWorkflow = readRequiredFile(profileAssetsWorkflowPath, "profile assets contract workflow")
const metricsWorkflow = readRequiredFile(metricsWorkflowPath, "metrics workflow")
const renderMetricsOverviewWorkflow = readRequiredFile(renderMetricsOverviewWorkflowPath, "render metrics overview workflow")
const snakeWorkflow = readRequiredFile(snakeWorkflowPath, "snake workflow")
const dependabot = readRequiredFile(dependabotPath, "Dependabot config")

const workflowContents = new Map([
  [profileAssetsWorkflowPath, profileAssetsWorkflow],
  [metricsWorkflowPath, metricsWorkflow],
  [renderMetricsOverviewWorkflowPath, renderMetricsOverviewWorkflow],
  [snakeWorkflowPath, snakeWorkflow],
])

for (const required of [
  "name: Profile assets contract",
  "contents: read",
  "node scripts/check-profile-readme-assets.mjs",
  "node scripts/check-language-metrics-contract.mjs",
  "node scripts/check-profile-workflows-contract.mjs",
  "node scripts/check-snake-workflow.mjs",
  '".github/dependabot.yml"',
  '".github/workflows/metrics.yml"',
  '".github/workflows/render-metrics-overview.yml"',
  '"assets/lucide-terminal-animated.svg"',
  '"assets/tiny5-profile-intro.svg"',
  '"assets/tiny5-profile-tagline.svg"',
  '"assets/tiny5-profile-tagline-mobile.svg"',
  '"metrics.contributions.json"',
  '"metrics.languages.svg"',
  '"scripts/check-language-metrics-contract.mjs"',
  '"scripts/check-profile-readme-assets.mjs"',
  '"scripts/check-profile-workflows-contract.mjs"',
  '"scripts/check-snake-workflow.mjs"',
  '"scripts/generate-contribution-metrics.mjs"',
]) {
  if (!profileAssetsWorkflow.includes(required)) {
    fail(`profile assets contract workflow is missing ${required}`)
  }
}

if (profileAssetsWorkflow.includes("contents: write")) {
  fail("profile assets contract workflow must not request contents: write")
}

for (const required of [
  "for attempt in 1 2 3; do",
  "git pull --rebase origin main",
  "git push origin HEAD:main",
  "Failed to push contribution metrics after 3 attempts",
  "sleep $((attempt * 5))",
]) {
  if (!metricsWorkflow.includes(required)) {
    fail(`metrics workflow is missing contribution metrics push retry contract: ${required}`)
  }
}

if (metricsWorkflow.includes("git push origin main")) {
  fail("metrics workflow must not use bare git push origin main for generated contribution metrics")
}

const usesPattern = /^\s*uses:\s+([^@\s]+)@([a-f0-9]{40}|[^\s#]+)/gim
const fullShaPattern = /^[a-f0-9]{40}$/

for (const workflowPath of workflowPaths) {
  const workflow = workflowContents.get(workflowPath)
  for (const match of workflow.matchAll(usesPattern)) {
    const [, actionName, ref] = match
    if (!managedActions.has(actionName)) {
      continue
    }

    if (!fullShaPattern.test(ref)) {
      fail(`${workflowPath} must pin ${actionName} to a full 40-character commit SHA, not ${ref}`)
    }
  }
}

if (!dependabot.includes('package-ecosystem: "github-actions"') || !dependabot.includes('directory: "/"')) {
  fail("Dependabot must manage GitHub Actions in the repository root")
}

if (dependabot.includes("allow:") || dependabot.includes('dependency-name: "lowlighter/metrics"')) {
  fail("Dependabot GitHub Actions updates must not be restricted to only lowlighter/metrics")
}

console.log(
  "profile workflow contract ok: asset workflow, action pins, Dependabot coverage, and metrics push retry are valid",
)
