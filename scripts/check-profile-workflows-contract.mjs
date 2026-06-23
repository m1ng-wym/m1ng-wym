#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"

const profileAssetsWorkflowPath = ".github/workflows/profile-assets-contract.yml"
const metricsWorkflowPath = ".github/workflows/metrics.yml"
const snakeWorkflowPath = ".github/workflows/snake.yml"
const dependabotPath = ".github/dependabot.yml"

const pinnedActions = [
  {
    file: metricsWorkflowPath,
    mutable: "actions/checkout@v4",
    pinned: "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  },
  {
    file: metricsWorkflowPath,
    mutable: "actions/setup-node@v4",
    pinned: "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  },
  {
    file: snakeWorkflowPath,
    mutable: "Platane/snk/svg-only@v3",
    pinned: "Platane/snk/svg-only@d8f6715049803e982ee5ff501b6b9b7d5deeb09b",
  },
  {
    file: snakeWorkflowPath,
    mutable: "crazy-max/ghaction-github-pages@v4",
    pinned: "crazy-max/ghaction-github-pages@df5cc2bfa78282ded844b354faee141f06b41865",
  },
]

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
const snakeWorkflow = readRequiredFile(snakeWorkflowPath, "snake workflow")
const dependabot = readRequiredFile(dependabotPath, "Dependabot config")

for (const required of [
  "name: Profile assets contract",
  "contents: read",
  "node scripts/check-profile-readme-assets.mjs",
  "node scripts/check-language-metrics-contract.mjs",
  "node scripts/check-profile-workflows-contract.mjs",
  "node scripts/check-snake-workflow.mjs",
  '".github/dependabot.yml"',
  '".github/workflows/metrics.yml"',
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

for (const { file, mutable, pinned } of pinnedActions) {
  const workflow = file === metricsWorkflowPath ? metricsWorkflow : snakeWorkflow
  if (workflow.includes(mutable)) {
    fail(`${file} still uses mutable action tag ${mutable}`)
  }
  if (!workflow.includes(pinned)) {
    fail(`${file} does not pin ${pinned}`)
  }
}

if (!dependabot.includes('package-ecosystem: "github-actions"') || !dependabot.includes('directory: "/"')) {
  fail("Dependabot must manage GitHub Actions in the repository root")
}

if (dependabot.includes("allow:") || dependabot.includes('dependency-name: "lowlighter/metrics"')) {
  fail("Dependabot GitHub Actions updates must not be restricted to only lowlighter/metrics")
}

console.log("profile workflow contract ok: asset workflow, action pins, and Dependabot coverage are valid")
