#!/usr/bin/env node

import { readFileSync } from "node:fs"

const readmePath = "README.md"
const typingSvgUrl =
  "https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=24&duration=2600&pause=900&color=2C365D&width=720&lines=Full-Stack+Developer;Open+Source+Contributor;AI+Explorer+%26+Creator;Software+Engineering+Student"
const expectedImages = [
  {
    alt: "Typing SVG",
    src: typingSvgUrl,
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

if (readme.includes("./assets/profile-typing.svg")) {
  fail("README still references the self-hosted profile typing SVG")
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

const snakeTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Contribution snake"
})
const metricsTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Language activity from authored commits"
})

const snakeIndex = readme.indexOf(snakeTag)
const metricsIndex = readme.indexOf(metricsTag)

if (snakeIndex > metricsIndex) {
  fail("Contribution snake must be placed directly above the language metrics image")
}

const contentBetweenSnakeAndMetrics = readme.slice(snakeIndex + snakeTag.length, metricsIndex)
if (contentBetweenSnakeAndMetrics !== "<br>\n") {
  fail("Contribution snake and language metrics image must be separated only by a single <br> line break")
}

if (/!\[[^\]]*\]\([^)]*\.svg[^)]*\)/.test(readme)) {
  fail("README still contains Markdown SVG image syntax instead of sized HTML img tags")
}

console.log("profile README asset check ok: dynamic Typing SVG, explicit dimensions, and snake placement are valid")
