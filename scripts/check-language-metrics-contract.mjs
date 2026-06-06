#!/usr/bin/env node

import { readFileSync } from "node:fs"

const svgPath = process.argv[2] || "metrics.languages.svg"
const svg = readFileSync(svgPath, "utf8")

function fail(message) {
  console.error(`language metrics contract failed: ${message}`)
  process.exit(1)
}

for (const removedText of ["repositories scanned", "own commits", "external commits"]) {
  if (svg.includes(removedText)) {
    fail(`removed summary text is still present: ${removedText}`)
  }
}

if (svg.includes('<rect x="24" y="70" width="274" height="58" rx="6" fill="#f6f8fa"/>')) {
  fail("left summary card background is still present")
}

const requiredPatterns = [
  {
    label: "commits and PRs summary card remains in its original position",
    pattern: /<rect x="322" y="70" width="274" height="58" rx="6" fill="#f6f8fa"\/>\s*<text x="338" y="96" class="metric">[0-9,]+ commits \/ [0-9,]+ PRs<\/text>\s*<text x="338" y="118" class="small">Authored by m1ng-wym<\/text>/,
  },
  {
    label: "lines and changed files summary card remains in its original position",
    pattern: /<rect x="620" y="70" width="274" height="58" rx="6" fill="#f6f8fa"\/>\s*<text x="636" y="96" class="metric">\+[0-9,]+ \/ -[0-9,]+ lines<\/text>\s*<text x="636" y="118" class="small">[0-9,]+ changed files<\/text>/,
  },
]

for (const { label, pattern } of requiredPatterns) {
  if (!pattern.test(svg)) {
    fail(label)
  }
}

console.log("language metrics contract ok: left summary card removed and the two right summary cards are unchanged")
