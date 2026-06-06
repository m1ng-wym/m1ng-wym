#!/usr/bin/env node

import { readFileSync } from "node:fs"

const readmePath = "README.md"
const typingSvgPath = "assets/profile-typing.svg"
const expectedImages = [
  {
    alt: "Typing SVG",
    src: `./${typingSvgPath}`,
    width: "720",
    height: "50",
  },
  {
    alt: "Language activity from authored commits",
    src: "./metrics.languages.svg",
    width: "920",
    height: "583",
  },
  {
    alt: "Contribution snake",
    src: "https://raw.githubusercontent.com/m1ng-wym/m1ng-wym/output/github-contribution-grid-snake.svg",
    width: "880",
    height: "192",
  },
]

function fail(message) {
  console.error(`profile README asset check failed: ${message}`)
  process.exit(1)
}

const readme = readFileSync(readmePath, "utf8")

if (readme.includes("readme-typing-svg.demolab.com")) {
  fail("README still references the external Readme Typing SVG service")
}

if (readme.includes("git.io/typing-svg")) {
  fail("README still links to the external Typing SVG landing page")
}

const imageTags = Array.from(readme.matchAll(/<img\b[^>]*>/g), match => match[0])

function getAttributes(tag) {
  const attributes = new Map()
  for (const match of tag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g)) {
    attributes.set(match[1], match[2])
  }
  return attributes
}

for (const expected of expectedImages) {
  const tag = imageTags.find(candidate => {
    const attributes = getAttributes(candidate)
    return attributes.get("src") === expected.src && attributes.get("alt") === expected.alt
  })

  if (!tag) {
    fail(`README does not contain expected HTML img for ${expected.alt}`)
  }

  const attributes = getAttributes(tag)
  for (const key of ["width", "height"]) {
    if (attributes.get(key) !== expected[key]) {
      fail(`${expected.alt} img ${key} is ${attributes.get(key) || "missing"}, expected ${expected[key]}`)
    }
  }
}

if (/!\[[^\]]*\]\([^)]*\.svg[^)]*\)/.test(readme)) {
  fail("README still contains Markdown SVG image syntax instead of sized HTML img tags")
}

let typingSvg
try {
  typingSvg = readFileSync(typingSvgPath, "utf8")
} catch (error) {
  fail(`could not read ${typingSvgPath}: ${error.message}`)
}

const requiredPhrases = [
  "Full-Stack Developer",
  "Open Source Contributor",
  "AI Explorer &amp; Creator",
  "Software Engineering Student",
]

for (const phrase of requiredPhrases) {
  if (!typingSvg.includes(phrase)) {
    fail(`${typingSvgPath} is missing phrase: ${phrase}`)
  }
}

const remoteUrlPattern = /https?:\/\/(?!www\.w3\.org\/)/i
const forbiddenPatterns = [
  { label: "remote resource URL", pattern: remoteUrlPattern },
  { label: "@font-face", pattern: /@font-face/ },
  { label: "embedded font", pattern: /data:font/ },
  { label: "external image", pattern: /<image\b/i },
]

for (const { label, pattern } of forbiddenPatterns) {
  if (pattern.test(typingSvg)) {
    fail(`${typingSvgPath} contains ${label}`)
  }
}

if (!/<animate\b/.test(typingSvg)) {
  fail(`${typingSvgPath} does not contain SVG animation`)
}

if (Buffer.byteLength(typingSvg, "utf8") > 6_000) {
  fail(`${typingSvgPath} is larger than 6000 bytes`)
}

console.log(`profile README asset check ok: ${typingSvgPath} is self-hosted and README images have explicit dimensions`)
