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
const expectedLanguageTextYOffset = 10
const expectedLanguageLabelX = 230
const expectedLanguageValueX = 690
const expectedLanguagePercentX = 845
const expectedLanguageBarX = 265

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

if (svg.includes('transform="translate(24 19) scale(1)"')) {
  fail("useAnimations GitHub icon is still too small and visually offset from the 24px Tiny5 title")
}

if (svg.includes('transform="translate(24 18) scale(1.08)"')) {
  fail("useAnimations GitHub icon is still visually too tall against the Where title glyphs")
}

if (!svg.includes('class="useanimations-github-icon" data-source="https://useanimations.com/animations/github.json" transform="translate(24 18) scale(0.95)"')) {
  fail("useAnimations GitHub icon is not visually aligned with the Where title glyphs")
}

const iconIndex = svg.indexOf('class="useanimations-github-icon"')
const titleArtworkIndex = svg.indexOf('class="metric-title-artwork"')
if (titleArtworkIndex === -1) {
  fail("title artwork is not wrapped for icon-left alignment")
}

if (!svg.includes('id="tiny5-title-artwork" aria-label="Where my code goes" data-font="Tiny5"')) {
  fail("title artwork is not using the Tiny5 font")
}

const titleArtworkMatch = svg.match(/<g id="tiny5-title-artwork"[\s\S]*?<\/g>/)
if (!titleArtworkMatch) {
  fail("Tiny5 title artwork group is missing")
}

const titleArtwork = titleArtworkMatch[0]
if (!titleArtwork.includes('data-font-size="24"')) {
  fail("Tiny5 title artwork is not marked as matching the 24px profile intro/typing size")
}

if (!titleArtwork.includes('class="tiny5-title-glyphs" transform="translate(4.8 4.4) scale(0.8)"')) {
  fail("Tiny5 title glyphs are not scaled down to the 24px profile intro/typing size")
}

if (!titleArtwork.includes("<path")) {
  fail("Tiny5 title artwork must remain path-rendered so it cannot fall back to a system font")
}

if (titleArtwork.includes('id="tiny5-title-text"')) {
  fail("Tiny5 title artwork is using SVG text, which can fall back to a system font in the embedded metrics SVG")
}

if (svg.includes('id="mplus-title-artwork"')) {
  fail("title artwork is still using the M PLUS font")
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

if (svg.includes('class="label"')) {
  fail("legacy crowded language labels are still present")
}

if (/<text x="615" y="[0-9.]+" class="small">\+[0-9,]+ \/ -[0-9,]+ lines \([0-9]+%\)<\/text>/.test(svg)) {
  fail("language values still use the old combined crowded text layout")
}

if (!svg.includes('class="activity-panel language-panel"')) {
  fail("language activity is missing the refreshed panel surface")
}

if (!svg.includes('class="activity-panel repo-panel"')) {
  fail("repo activity is missing the refreshed panel surface")
}

if (svg.includes("section-pixels")) {
  fail("section heading pixel accents should be removed while keeping the section titles")
}

if (/<rect x="24" y="[0-9.]+" width="(?:102|82|48|42)" height="3" rx="1\.5"/.test(svg)) {
  fail("section heading underline bars should be removed while keeping the section titles")
}

if (!svg.includes('class="repo-column-label"')) {
  fail("repo activity is missing compact column labels")
}

if (!/<g class="language-row" data-language="[^"]+">/.test(svg)) {
  fail("language activity rows are not grouped for the refreshed layout")
}

if (!/<g class="repo-row" data-repo="[^"]+">/.test(svg)) {
  fail("repo activity rows are not grouped for the refreshed layout")
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

const firstLanguageSquares = Array.from(squareGroups[0][2].matchAll(/<rect x="([0-9]+)" y="[0-9]+" width="[0-9]+" height="[0-9]+" rx="[0-9]+" ry="[0-9]+" fill="(#[0-9A-Fa-f]{6})" stroke="#ffffff" stroke-width="1"\/>/g))
if (Number(firstLanguageSquares[0]?.[1]) !== expectedLanguageBarX) {
  fail(`language square bar starts at x=${firstLanguageSquares[0]?.[1]}, expected ${expectedLanguageBarX} for centered placement`)
}

const languageLabelMatches = Array.from(svg.matchAll(new RegExp(`<text x="${expectedLanguageLabelX}" y="([0-9.]+)" class="language-label" text-anchor="end">([^<]+)<\\/text>`, "g")))
const languageValueMatches = Array.from(svg.matchAll(new RegExp(`<text x="${expectedLanguageValueX}" y="([0-9.]+)" class="language-value">\\+[0-9,]+ \\/ -[0-9,]+ lines<\\/text>`, "g")))
const languagePercentMatches = Array.from(svg.matchAll(new RegExp(`<text x="${expectedLanguagePercentX}" y="([0-9.]+)" class="language-percent">\\([0-9]+%\\)<\\/text>`, "g")))

if (languageLabelMatches.length !== squareGroups.length) {
  fail(`language label count is ${languageLabelMatches.length}, expected ${squareGroups.length}`)
}

if (languageValueMatches.length !== squareGroups.length) {
  fail(`language value count is ${languageValueMatches.length}, expected ${squareGroups.length}`)
}

if (languagePercentMatches.length !== squareGroups.length) {
  fail(`language percent count is ${languagePercentMatches.length}, expected ${squareGroups.length}`)
}

for (let index = 1; index < squareRowYs.length; index += 1) {
  const rowStep = squareRowYs[index] - squareRowYs[index - 1]
  if (rowStep !== expectedLanguageRowStep) {
    fail(`language square row step is ${rowStep}, expected ${expectedLanguageRowStep} for a 2px row gap`)
  }
}

for (let index = 0; index < squareGroups.length; index += 1) {
  const expectedLanguage = squareGroups[index][1]
  const expectedTextY = squareRowYs[index] + expectedLanguageTextYOffset
  const [, labelY, labelText] = languageLabelMatches[index]
  const [, valueY] = languageValueMatches[index]
  const [, percentY] = languagePercentMatches[index]

  if (labelText !== expectedLanguage) {
    fail(`language label ${labelText} is not aligned with square row ${expectedLanguage}`)
  }

  for (const [kind, actualY] of [["label", labelY], ["value", valueY], ["percent", percentY]]) {
    if (Number(actualY) !== expectedTextY) {
      fail(`${expectedLanguage} ${kind} baseline is ${actualY}, expected ${expectedTextY} to align with the square row`)
    }
  }
}

const firstGroupSquares = Array.from(squareGroups[0][2].matchAll(/<rect\b[^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*\/>/g))
if (!firstGroupSquares.every(([, fill]) => fill === expectedLanguageBarColor)) {
  fail("the highest-additions language row is not fully filled")
}

if (svg.includes('<rect x="24" y="70" width="274" height="58" rx="6" fill="#f6f8fa"/>')) {
  fail("summary cards are still using the flat legacy block style")
}

const requiredPatterns = [
  {
    label: "summary cards use the shared subtle gradient fill",
    pattern: /<linearGradient id="stat-card-fill" x1="0" y1="0" x2="1" y2="1">[\s\S]*?<stop offset="0%" stop-color="#ffffff"\/>[\s\S]*?<stop offset="100%" stop-color="#f6f8fa"\/>[\s\S]*?<\/linearGradient>/,
  },
  {
    label: "commits and PRs summary card keeps its original numeric text in an enhanced card",
    pattern: /<g class="stat-card stat-card-commits" transform="translate\(24 70\)">[\s\S]*?<rect width="274" height="66" rx="7" fill="url\(#stat-card-fill\)" stroke="#d0d7de"\/>[\s\S]*?<text x="16" y="25" class="stat-label">Commits \+ PRs<\/text>[\s\S]*?<text x="16" y="48" class="metric">[0-9,]+ commits \/ [0-9,]+ PRs<\/text>[\s\S]*?<\/g>/,
  },
  {
    label: "lines summary card keeps its original numeric text in an enhanced card",
    pattern: /<g class="stat-card stat-card-lines" transform="translate\(322 70\)">[\s\S]*?<rect width="274" height="66" rx="7" fill="url\(#stat-card-fill\)" stroke="#d0d7de"\/>[\s\S]*?<text x="16" y="25" class="stat-label">Line Delta<\/text>[\s\S]*?<text x="16" y="48" class="metric">\+[0-9,]+ \/ -[0-9,]+ lines<\/text>[\s\S]*?<\/g>/,
  },
  {
    label: "summary cards include restrained pixel accents matching the profile palette",
    pattern: /<g class="stat-pixels"[\s\S]*?fill="#2C365D"[\s\S]*?fill="#4988C4"[\s\S]*?fill="#BDE8F5"[\s\S]*?<\/g>/,
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

if (svg.includes("changed files")) {
  fail("changed files subtitle is still present")
}

console.log("language metrics contract ok: title icon alignment, summary card alignment, language text layout, and language row spacing are valid")
