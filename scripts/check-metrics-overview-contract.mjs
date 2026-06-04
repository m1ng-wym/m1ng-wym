#!/usr/bin/env node

import { readFileSync } from "node:fs"

const svgPath = process.argv[2] || "/metrics_renders/metrics.overview.preview.svg"

function fail(message) {
  console.error(`metrics overview contract failed: ${message}`)
  process.exit(1)
}

let svg
try {
  svg = readFileSync(svgPath, "utf8")
} catch (error) {
  fail(`could not read ${svgPath}: ${error.message}`)
}

if (!svg.trim()) {
  fail(`${svgPath} is empty`)
}

const markerPattern = /id="overview-activity-commits-source"[^>]*>\s*([0-9][0-9,]*) Commits\s*</
const markerMatch = svg.match(markerPattern)
if (!markerMatch) {
  fail('missing parseable id="overview-activity-commits-source" marker')
}

const commits = Number.parseInt(markerMatch[1].replaceAll(",", ""), 10)
if (!Number.isFinite(commits)) {
  fail(`marker commit count is not finite: ${markerMatch[1]}`)
}

const forbiddenPatterns = [
  { label: "Activity heading", pattern: />\s*Activity\s*</ },
  { label: "Community stats section", pattern: /Community stats/ },
  { label: "Repositories section", pattern: /Repositories \(including/ },
  { label: "Lines of code pushed section", pattern: /Lines of code pushed/ },
]

for (const { label, pattern } of forbiddenPatterns) {
  if (pattern.test(svg)) {
    fail(`unexpected ${label} was rendered`)
  }
}

console.log(`metrics overview contract ok: ${commits} commits marker found in ${svgPath}`)
