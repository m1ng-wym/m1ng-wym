#!/usr/bin/env node

import { readFileSync } from "node:fs"

const svgPath = process.argv[2] || "metrics.languages.svg"
const svg = readFileSync(svgPath, "utf8")
const expectedLanguageBarColor = "#4988C4"
const expectedLanguageEmptyColor = "#eaeef2"
const previousLanguageBarColor = "#8FABD4"
const expectedSquareSize = 12
const expectedSquareRadius = 2
const expectedSquareStep = 14
const expectedLanguageRowStep = expectedSquareSize + 2

function fail(message) {
  console.error(`language metrics contract failed: ${message}`)
  process.exit(1)
}

for (const removedText of ["repositories scanned", "own commits", "external commits"]) {
  if (svg.includes(removedText)) {
    fail(`removed summary text is still present: ${removedText}`)
  }
}

if (svg.includes(`fill="${previousLanguageBarColor}"`)) {
  fail(`language activity bars still use previous fill color ${previousLanguageBarColor}`)
}

if (!svg.includes(`fill="${expectedLanguageBarColor}"`)) {
  fail(`language activity bars do not use expected fill color ${expectedLanguageBarColor}`)
}

if (!svg.includes('class="useanimations-github-icon"')) {
  fail("useAnimations GitHub icon is missing from the title")
}

if (!svg.includes('data-source="https://useanimations.com/animations/github.json"')) {
  fail("useAnimations GitHub icon source attribution is missing")
}

if (!/<animate attributeName="d"[^>]*dur="1s"[^>]*repeatCount="indefinite"[^>]*\/>/.test(svg)) {
  fail("useAnimations GitHub icon does not keep the original hover animation looping")
}

if (svg.includes('transform="translate(318 17) scale(0.82)"') || svg.includes('transform="translate(24 17) scale(1)"')) {
  fail("useAnimations GitHub icon is still using the old right-side placement")
}

if (!svg.includes('class="useanimations-github-icon" data-source="https://useanimations.com/animations/github.json" transform="translate(24 19) scale(1)"')) {
  fail("useAnimations GitHub icon is not positioned on the left with the requested downward adjustment")
}

const iconIndex = svg.indexOf('class="useanimations-github-icon"')
const titleArtworkIndex = svg.indexOf('class="metric-title-artwork"')
if (titleArtworkIndex === -1) {
  fail("title artwork is not wrapped for icon-left alignment")
}

if (!svg.includes('<g class="metric-title-artwork" transform="translate(33 0)">')) {
  fail("title artwork is not shifted right to keep the requested icon-title spacing")
}

if (iconIndex > titleArtworkIndex) {
  fail("useAnimations GitHub icon should render before the title artwork")
}

if (svg.includes('height="10" rx="5" fill="#eaeef2"') || svg.includes(`height="10" rx="5" fill="${expectedLanguageBarColor}"`)) {
  fail("legacy rounded language activity bars are still present")
}

const squareGroups = Array.from(svg.matchAll(/<g class="language-square-bar" data-language="([^"]+)">([\s\S]*?)<\/g>/g))

if (!squareGroups.length) {
  fail("language activity square bars are missing")
}

const squareCounts = []
const squareRowYs = []
for (const [, language, groupContent] of squareGroups) {
  const squares = Array.from(groupContent.matchAll(/<rect x="([0-9]+)" y="([0-9]+)" width="([0-9]+)" height="([0-9]+)" rx="([0-9]+)" ry="([0-9]+)" fill="(#[0-9A-Fa-f]{6})" stroke="#ffffff" stroke-width="1"\/>/g))
  if (!squares.length) {
    fail(`${language} square bar has no squares`)
  }

  let filledCount = 0
  let emptyCount = 0
  let previousX = null
  let rowY = null
  for (const [, x, y, width, height, rx, ry, fill] of squares) {
    if (Number(width) !== expectedSquareSize || Number(height) !== expectedSquareSize) {
      fail(`${language} square size is ${width}x${height}, expected ${expectedSquareSize}x${expectedSquareSize}`)
    }
    if (Number(rx) !== expectedSquareRadius || Number(ry) !== expectedSquareRadius) {
      fail(`${language} square radius is ${rx}/${ry}, expected ${expectedSquareRadius}/${expectedSquareRadius}`)
    }
    if (rowY === null) rowY = Number(y)
    else if (Number(y) !== rowY) fail(`${language} square bar is not aligned to one row`)
    if (previousX !== null && Number(x) - previousX !== expectedSquareStep) {
      fail(`${language} square step is ${Number(x) - previousX}, expected ${expectedSquareStep}`)
    }
    previousX = Number(x)
    if (fill === expectedLanguageBarColor) filledCount += 1
    else if (fill === expectedLanguageEmptyColor) emptyCount += 1
    else fail(`${language} square fill is ${fill}, expected ${expectedLanguageBarColor} or ${expectedLanguageEmptyColor}`)
  }

  squareRowYs.push(rowY)

  if (!filledCount) {
    fail(`${language} square bar has no filled squares`)
  }

  squareCounts.push(squares.length)
}

if (new Set(squareCounts).size !== 1) {
  fail(`language square bars have inconsistent square counts: ${squareCounts.join(", ")}`)
}

for (let index = 1; index < squareRowYs.length; index += 1) {
  const rowStep = squareRowYs[index] - squareRowYs[index - 1]
  if (rowStep !== expectedLanguageRowStep) {
    fail(`language square row step is ${rowStep}, expected ${expectedLanguageRowStep} for a 2px row gap`)
  }
}

const firstGroupSquares = Array.from(squareGroups[0][2].matchAll(/<rect\b[^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*\/>/g))
if (!firstGroupSquares.every(([, fill]) => fill === expectedLanguageBarColor)) {
  fail("the highest-additions language row is not fully filled")
}

const requiredPatterns = [
  {
    label: "commits and PRs summary card is left-aligned into the first card slot",
    pattern: /<rect x="24" y="70" width="274" height="58" rx="6" fill="#f6f8fa"\/>\s*<text x="40" y="96" class="metric">[0-9,]+ commits \/ [0-9,]+ PRs<\/text>\s*<text x="40" y="118" class="small">Authored by m1ng-wym<\/text>/,
  },
  {
    label: "lines and changed files summary card follows the first card slot",
    pattern: /<rect x="322" y="70" width="274" height="58" rx="6" fill="#f6f8fa"\/>\s*<text x="338" y="96" class="metric">\+[0-9,]+ \/ -[0-9,]+ lines<\/text>\s*<text x="338" y="118" class="small">[0-9,]+ changed files<\/text>/,
  },
]

for (const { label, pattern } of requiredPatterns) {
  if (!pattern.test(svg)) {
    fail(label)
  }
}

if (svg.includes('<rect x="620" y="70" width="274" height="58" rx="6" fill="#f6f8fa"/>')) {
  fail("summary card layout still leaves the first card slot empty")
}

console.log("language metrics contract ok: title icon alignment, summary card alignment, and language row spacing are valid")
