#!/usr/bin/env node

import { readFileSync } from "node:fs"

const svgPath = process.argv[2] || "metrics.languages.svg"
const metricsJsonPath = "metrics.contributions.json"
const svg = readFileSync(svgPath, "utf8")
const metrics = JSON.parse(readFileSync(metricsJsonPath, "utf8"))
const expectedLanguageBarColor = "#4988C4"
const expectedLanguageEmptyColor = "#eaeef2"
const previousLanguageBarColor = "#8FABD4"
const expectedSquareSize = 12
const expectedSquareRadius = 2
const expectedSquareStep = 14
const expectedLanguageRowStep = expectedSquareSize + 2
const expectedLanguageTextYOffset = 10
const expectedLanguageLabelX = 220
const expectedLanguageValueX = 690
const expectedLanguagePercentX = 253
const expectedLanguageBarX = 265
const expectedCommitsCardX = 186
const expectedLinesCardX = 484
const expectedSvgHeight = 341
const expectedLanguageCount = 8
const expectedStatCardWidth = 250
const expectedStatCardHeight = 66
const expectedStatCardRadius = 7
const expectedStatCardAccentWidth = 4
const expectedStatCardAccentSplitY = 34
const expectedLanguagePanelX = 120
const expectedLanguagePanelY = 161
const expectedLanguagePanelWidth = 680
const expectedLanguagePanelHeight = 162
const expectedLanguagePanelTitleX = 136
const expectedLanguagePanelTitleY = 181
const expectedLanguageRowBackgroundX = 136
const expectedLanguageRowBackgroundWidth = 648
const expectedSvgCenterX = 460
const expectedLanguagePanelSideExtension = 66

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

if (/<text x="[0-9.]+" y="[0-9.]+" class="language-percent"[^>]*>\([0-9]+%\)<\/text>/.test(svg)) {
  fail("language percentages should move left of the square bars without parentheses")
}

if (/<g class="language-row" data-language="[^"]+">[\s\S]*?<rect x="[0-9.]+" y="[0-9.]+" width="6" height="6" rx="1\.5"/.test(svg)) {
  fail("standalone language marker squares should be removed from the language activity rows")
}

if (!svg.includes('class="activity-panel language-panel"')) {
  fail("language activity is missing the refreshed panel surface")
}

const languagePanelRect = svg.match(/<rect class="activity-panel language-panel" x="([0-9]+)" y="([0-9]+)" width="([0-9]+)" height="([0-9]+)" rx="7" fill="url\(#activity-panel-fill\)" stroke="#d0d7de"\/>/)
if (!languagePanelRect) {
  fail("language activity panel rect is missing")
}

const [, actualLanguagePanelX, , actualLanguagePanelWidth] = languagePanelRect
const actualLanguagePanelCenterX = Number(actualLanguagePanelX) + Number(actualLanguagePanelWidth) / 2
if (actualLanguagePanelCenterX !== expectedSvgCenterX) {
  fail(`language panel center is ${actualLanguagePanelCenterX}, expected ${expectedSvgCenterX}`)
}

const actualLanguagePanelLeftExtension = expectedCommitsCardX - Number(actualLanguagePanelX)
const actualLanguagePanelRightExtension = Number(actualLanguagePanelX) + Number(actualLanguagePanelWidth) - (expectedLinesCardX + expectedStatCardWidth)
if (
  actualLanguagePanelLeftExtension !== expectedLanguagePanelSideExtension
  || actualLanguagePanelRightExtension !== expectedLanguagePanelSideExtension
) {
  fail(`language panel side extensions are ${actualLanguagePanelLeftExtension}/${actualLanguagePanelRightExtension}, expected ${expectedLanguagePanelSideExtension}/${expectedLanguagePanelSideExtension}`)
}

if (/<text x="24" y="[0-9.]+" class="section">Language activity<\/text>/.test(svg)) {
  fail("language activity title is still outside the language panel")
}

const languagePanelPattern = new RegExp(`<rect class="activity-panel language-panel" x="${expectedLanguagePanelX}" y="${expectedLanguagePanelY}" width="${expectedLanguagePanelWidth}" height="${expectedLanguagePanelHeight}" rx="7" fill="url\\(#activity-panel-fill\\)" stroke="#d0d7de"\\/>`)
if (!languagePanelPattern.test(svg)) {
  fail(`language panel should hug the content at x=${expectedLanguagePanelX}, width=${expectedLanguagePanelWidth}`)
}

const languagePanelIndex = svg.indexOf(`class="activity-panel language-panel" x="${expectedLanguagePanelX}"`)
const languagePanelTitleIndex = svg.indexOf(`<text x="${expectedLanguagePanelTitleX}" y="${expectedLanguagePanelTitleY}" class="section">Language activity</text>`)
const firstLanguageRowIndex = svg.indexOf('<g class="language-row"')
if (languagePanelTitleIndex === -1) {
  fail("language activity title is not rendered inside the language panel header row")
}

if (!(languagePanelIndex < languagePanelTitleIndex && languagePanelTitleIndex < firstLanguageRowIndex)) {
  fail("language activity title should render after the panel surface and before the first language row")
}

if (svg.includes('<rect x="40" y="191" width="840" height="18" rx="4"')) {
  fail("language row background stripes still use the old full-width layout")
}

const languageRowBackgrounds = Array.from(svg.matchAll(/<g class="language-row" data-language="[^"]+">\s*<rect x="([0-9]+)" y="([0-9]+)" width="([0-9]+)" height="18" rx="4" fill="(?:#f6f8fa|#ffffff)" opacity="0\.72"\/>/g))
if (!languageRowBackgrounds.length) {
  fail("language row background stripes are missing")
}

for (const [, x, , width] of languageRowBackgrounds) {
  if (Number(x) !== expectedLanguageRowBackgroundX || Number(width) !== expectedLanguageRowBackgroundWidth) {
    fail(`language row background is x=${x}, width=${width}; expected x=${expectedLanguageRowBackgroundX}, width=${expectedLanguageRowBackgroundWidth}`)
  }
}

if (svg.includes(">Repo activity<")) {
  fail("repo activity heading should be hidden from the profile metrics SVG")
}

if (svg.includes('class="activity-panel repo-panel"')) {
  fail("repo activity panel should be hidden from the profile metrics SVG")
}

if (svg.includes("section-pixels")) {
  fail("section heading pixel accents should be removed while keeping the section titles")
}

if (svg.includes('class="stat-pixels"')) {
  fail("summary card decorative pixel accents should be removed")
}

if (svg.includes(">Line Delta<")) {
  fail("lines summary card still uses the ambiguous Line Delta label")
}

if (/<rect x="24" y="[0-9.]+" width="(?:102|82|48|42)" height="3" rx="1\.5"/.test(svg)) {
  fail("section heading underline bars should be removed while keeping the section titles")
}

if (svg.includes('class="repo-column-label"')) {
  fail("repo activity column labels should be hidden from the profile metrics SVG")
}

if (!/<g class="language-row" data-language="[^"]+">/.test(svg)) {
  fail("language activity rows are not grouped for the refreshed layout")
}

if (/<g class="repo-row" data-repo="[^"]+">/.test(svg)) {
  fail("repo activity rows should be hidden from the profile metrics SVG")
}

const squareGroups = Array.from(svg.matchAll(/<g class="language-square-bar" data-language="([^"]+)">([\s\S]*?)<\/g>/g))

if (!squareGroups.length) {
  fail("language activity square bars are missing")
}

const squareCounts = []
const squareRowYs = []
const squareFilledCountsByLanguage = new Map()
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
  squareFilledCountsByLanguage.set(language, filledCount)

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
const languageValueMatches = Array.from(svg.matchAll(new RegExp(`<text x="${expectedLanguageValueX}" y="([0-9.]+)" class="language-value">\\+[0-9,]+ \\/ -[0-9,]+<\\/text>`, "g")))
const languagePercentMatches = Array.from(svg.matchAll(new RegExp(`<text x="${expectedLanguagePercentX}" y="([0-9.]+)" class="language-percent" text-anchor="end">([0-9]+%)<\\/text>`, "g")))

if (new RegExp(`<text x="${expectedLanguageValueX}" y="[0-9.]+" class="language-value">\\+[0-9,]+ \\/ -[0-9,]+ lines<\\/text>`).test(svg)) {
  fail("language row values should omit the repeated lines unit")
}

if (expectedLanguagePercentX >= expectedLanguageBarX) {
  fail(`language percentages should stay left of the square bars: percent x=${expectedLanguagePercentX}, bar x=${expectedLanguageBarX}`)
}

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
  fail("the highest-activity language row is not fully filled")
}

const expectedLanguages = [...(metrics.summary?.languages || [])]
  .filter(item => item.additions > 0 || item.deletions > 0)
  .map(item => ({
    ...item,
    activity: item.additions + item.deletions,
  }))
  .sort((a, b) => {
    if (b.activity !== a.activity) return b.activity - a.activity
    return b.additions - a.additions
  })
  .slice(0, expectedLanguageCount)

if (expectedLanguages.length !== squareGroups.length) {
  fail(`rendered language count is ${squareGroups.length}, expected ${expectedLanguages.length} from ${metricsJsonPath}`)
}

const totalLanguageActivity = Math.max(1, expectedLanguages.reduce((sum, item) => sum + item.activity, 0))
const maxLanguageActivity = Math.max(1, ...expectedLanguages.map(item => item.activity))

for (const [index, expected] of expectedLanguages.entries()) {
  const renderedLanguage = squareGroups[index]?.[1]
  if (renderedLanguage !== expected.name) {
    fail(`language row ${index + 1} is ${renderedLanguage || "missing"}, expected ${expected.name} by additions+deletions activity`)
  }

  const [, , renderedPercent] = languagePercentMatches[index] || []
  const expectedPercent = `${Math.round((expected.activity / totalLanguageActivity) * 100)}%`
  if (renderedPercent !== expectedPercent) {
    fail(`${expected.name} percent is ${renderedPercent || "missing"}, expected ${expectedPercent} from additions+deletions activity`)
  }

  const expectedFilledSquares = expected.activity
    ? Math.max(1, Math.round((expected.activity / maxLanguageActivity) * squareCounts[0]))
    : 0
  const renderedFilledSquares = squareFilledCountsByLanguage.get(expected.name)
  if (renderedFilledSquares !== expectedFilledSquares) {
    fail(`${expected.name} filled squares are ${renderedFilledSquares}, expected ${expectedFilledSquares} from additions+deletions activity`)
  }
}

if (svg.includes("additions") || svg.includes("deletions")) {
  fail("visible language metric labels should remain compact + / - lines, not additions/deletions wording")
}

if (svg.includes('<rect x="24" y="70" width="274" height="58" rx="6" fill="#f6f8fa"/>')) {
  fail("summary cards are still using the flat legacy block style")
}

if (/<rect x="0" y="0" width="4" height="66" rx="2" fill="#BDE8F5"\/>/.test(svg) ||
    /<rect x="0" y="0" width="4" height="34" rx="2" fill="#(?:2C365D|4988C4)"\/>/.test(svg)) {
  fail("summary card accent is still built from overlapping rounded external-looking bars")
}

if (/<rect x="16" y="56" width="86" height="4" rx="2" fill="#BDE8F5"[^>]*\/>/.test(svg) ||
    /<rect x="16" y="56" width="52" height="4" rx="2" fill="#(?:2C365D|4988C4)"\/>/.test(svg)) {
  fail("summary cards still render the bottom mini progress bar")
}

const requiredPatterns = [
  {
    label: "summary cards use the shared subtle gradient fill",
    pattern: /<linearGradient id="stat-card-fill" x1="0" y1="0" x2="1" y2="1">[\s\S]*?<stop offset="0%" stop-color="#ffffff"\/>[\s\S]*?<stop offset="100%" stop-color="#f6f8fa"\/>[\s\S]*?<\/linearGradient>/,
  },
  {
    label: "commits and PRs summary card keeps its numeric text with an internal clipped accent",
    pattern: new RegExp(`<g class="stat-card stat-card-commits" transform="translate\\(${expectedCommitsCardX} 70\\)">[\\s\\S]*?<rect width="${expectedStatCardWidth}" height="${expectedStatCardHeight}" rx="${expectedStatCardRadius}" fill="url\\(#stat-card-fill\\)"\\/>[\\s\\S]*?<clipPath id="stat-card-commits-clip">[\\s\\S]*?<rect width="${expectedStatCardWidth}" height="${expectedStatCardHeight}" rx="${expectedStatCardRadius}"\\/>[\\s\\S]*?<\\/clipPath>[\\s\\S]*?<g class="stat-accent" clip-path="url\\(#stat-card-commits-clip\\)">[\\s\\S]*?<rect x="0" y="0" width="${expectedStatCardAccentWidth}" height="${expectedStatCardAccentSplitY}" fill="#2C365D"\\/>[\\s\\S]*?<rect x="0" y="${expectedStatCardAccentSplitY}" width="${expectedStatCardAccentWidth}" height="${expectedStatCardHeight - expectedStatCardAccentSplitY}" fill="#BDE8F5"\\/>[\\s\\S]*?<\\/g>[\\s\\S]*?<text x="16" y="25" class="stat-label">Commits \\+ PRs<\\/text>[\\s\\S]*?<text x="16" y="48" class="metric">[0-9,]+ commits \\/ [0-9,]+ PRs<\\/text>[\\s\\S]*?<rect width="${expectedStatCardWidth}" height="${expectedStatCardHeight}" rx="${expectedStatCardRadius}" fill="none" stroke="#d0d7de"\\/>[\\s\\S]*?<\\/g>`),
  },
  {
    label: "lines summary card uses the authored-lines label with an internal clipped accent",
    pattern: new RegExp(`<g class="stat-card stat-card-lines" transform="translate\\(${expectedLinesCardX} 70\\)">[\\s\\S]*?<rect width="${expectedStatCardWidth}" height="${expectedStatCardHeight}" rx="${expectedStatCardRadius}" fill="url\\(#stat-card-fill\\)"\\/>[\\s\\S]*?<clipPath id="stat-card-lines-clip">[\\s\\S]*?<rect width="${expectedStatCardWidth}" height="${expectedStatCardHeight}" rx="${expectedStatCardRadius}"\\/>[\\s\\S]*?<\\/clipPath>[\\s\\S]*?<g class="stat-accent" clip-path="url\\(#stat-card-lines-clip\\)">[\\s\\S]*?<rect x="0" y="0" width="${expectedStatCardAccentWidth}" height="${expectedStatCardAccentSplitY}" fill="#4988C4"\\/>[\\s\\S]*?<rect x="0" y="${expectedStatCardAccentSplitY}" width="${expectedStatCardAccentWidth}" height="${expectedStatCardHeight - expectedStatCardAccentSplitY}" fill="#BDE8F5"\\/>[\\s\\S]*?<\\/g>[\\s\\S]*?<text x="16" y="25" class="stat-label">Lines Authored<\\/text>[\\s\\S]*?<text x="16" y="48" class="metric">\\+[0-9,]+ \\/ -[0-9,]+ lines<\\/text>[\\s\\S]*?<rect width="${expectedStatCardWidth}" height="${expectedStatCardHeight}" rx="${expectedStatCardRadius}" fill="none" stroke="#d0d7de"\\/>[\\s\\S]*?<\\/g>`),
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

const svgDimensions = svg.match(/^<svg[^>]*width="([0-9]+)" height="([0-9]+)" viewBox="0 0 ([0-9]+) ([0-9]+)"/)
if (!svgDimensions) {
  fail("metrics SVG does not expose explicit width, height, and viewBox dimensions")
}

const [, svgWidth, svgHeight, viewBoxWidth, viewBoxHeight] = svgDimensions
if (svgWidth !== "920" || viewBoxWidth !== "920") {
  fail(`metrics SVG width/viewBox width is ${svgWidth}/${viewBoxWidth}, expected 920/920`)
}

if (Number(svgHeight) !== expectedSvgHeight || Number(viewBoxHeight) !== expectedSvgHeight) {
  fail(`metrics SVG height/viewBox height is ${svgHeight}/${viewBoxHeight}, expected ${expectedSvgHeight}`)
}

if (svg.includes("changed files")) {
  fail("changed files subtitle is still present")
}

console.log("language metrics contract ok: title icon alignment, summary card alignment, language text layout, hidden repo activity, and language row spacing are valid")
