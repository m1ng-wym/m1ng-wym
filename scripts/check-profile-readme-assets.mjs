#!/usr/bin/env node

import { readFileSync } from "node:fs"

const readmePath = "README.md"
const terminalIconPath = "./assets/lucide-terminal-animated.svg"
const typingSvgUrl =
  "https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=24&duration=2600&pause=900&color=2C365D&background=FFFFFF&width=720&lines=Full-Stack+Developer;Open+Source+Contributor;AI+Explorer+%26+Creator;Software+Engineering+Student"
const expectedImages = [
  {
    alt: "Animated terminal icon",
    src: terminalIconPath,
    width: "40",
    height: "50",
  },
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
    src: "https://raw.githubusercontent.com/m1ng-wym/m1ng-wym/output/github-contribution-grid-snake.svg?v=4988c4",
    width: "880",
    height: "192",
  },
]

function fail(message) {
  console.error(`profile README asset check failed: ${message}`)
  process.exit(1)
}

const readme = readFileSync(readmePath, "utf8")
const terminalIcon = readFileSync(terminalIconPath, "utf8")

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
const terminalTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Animated terminal icon"
})
const typingTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Typing SVG"
})
const metricsTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Language activity from authored commits"
})

const snakeIndex = readme.indexOf(snakeTag)
const terminalIndex = readme.indexOf(terminalTag)
const typingIndex = readme.indexOf(typingTag)
const metricsIndex = readme.indexOf(metricsTag)

if (terminalIndex > typingIndex) {
  fail("Animated terminal icon must appear before the Typing SVG")
}

const contentBetweenTerminalAndTyping = readme.slice(terminalIndex + terminalTag.length, typingIndex)
if (contentBetweenTerminalAndTyping !== "&nbsp;&nbsp;") {
  fail("Animated terminal icon and Typing SVG must use the approved inline spacing")
}

if (snakeIndex > metricsIndex) {
  fail("Contribution snake must be placed directly above the language metrics image")
}

const contentBetweenSnakeAndMetrics = readme.slice(snakeIndex + snakeTag.length, metricsIndex)
if (contentBetweenSnakeAndMetrics !== "\n\n") {
  fail("Contribution snake and language metrics image must use standard Markdown block spacing")
}

if (/!\[[^\]]*\]\([^)]*\.svg[^)]*\)/.test(readme)) {
  fail("README still contains Markdown SVG image syntax instead of sized HTML img tags")
}

if (!terminalIcon.includes('<polyline points="4 17 10 11 4 5"/>')) {
  fail("animated terminal icon is missing the prompt polyline")
}

if (!terminalIcon.includes('<line x1="12" y1="19" x2="20" y2="19">')) {
  fail("animated terminal icon is missing the cursor line")
}

if (!terminalIcon.includes('<animate attributeName="opacity" values="1;0;1" dur="0.8s" repeatCount="indefinite"/>')) {
  fail("animated terminal icon cursor is not configured to loop")
}

console.log("profile README asset check ok: terminal icon loop, dynamic Typing SVG white background, explicit dimensions, and snake placement are valid")
