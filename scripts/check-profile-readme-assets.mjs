#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"

const readmePath = "README.md"
const terminalIconPath = "./assets/lucide-terminal-animated.svg"
const profileIntroPath = "./assets/tiny5-profile-intro.svg"
const profileTaglinePath = "./assets/tiny5-profile-tagline.svg"
const profileTaglineText = "Here to learn from the GitHub community and contribute where I can."
const typingSvgUrl =
  "https://readme-typing-svg.demolab.com?font=Tiny5&weight=400&size=24&height=42&vCenter=true&duration=2600&pause=900&color=2C365D&background=FFFFFF&width=360&lines=a+Software+Engineering+Student.;a+Full-Stack+Developer+Intern.;an+AI+Explorer+%26+Creator.;an+Open+Source+Contributor.;an+Occasional+Overthinker."
const expectedImages = [
  {
    alt: "Animated terminal icon",
    src: terminalIconPath,
    width: "30",
    height: "42",
  },
  {
    alt: "Hi, I'm @m1ng-wym,",
    src: profileIntroPath,
    width: "216",
    height: "42",
  },
  {
    alt: "Typing SVG",
    src: typingSvgUrl,
    width: "360",
    height: "42",
  },
  {
    alt: profileTaglineText,
    src: profileTaglinePath,
    width: "733",
    height: "42",
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

function readRequiredFile(filePath, label) {
  if (!existsSync(filePath)) {
    fail(`${label} file is missing at ${filePath}`)
  }

  return readFileSync(filePath, "utf8")
}

const readme = readRequiredFile(readmePath, "README")
const terminalIcon = readRequiredFile(terminalIconPath, "animated terminal icon")
const profileIntro = readRequiredFile(profileIntroPath, "static profile intro")
const profileTagline = readRequiredFile(profileTaglinePath, "static profile tagline")

if (readme.startsWith("# Hi, I'm @m1ng-wym")) {
  fail("README still uses the Markdown H1 profile intro")
}

if (readme.includes("## About me")) {
  fail("README still contains the About me heading")
}

if (readme.includes("Software Engineering Student · Full-Stack Intern · Occasional Overthinker")) {
  fail("README still contains the old About me role summary")
}

if (readme.includes(`\n${profileTaglineText}\n`)) {
  fail("README still contains the tagline as plain Markdown text")
}

if (readme.includes("./assets/profile-typing.svg")) {
  fail("README still references the self-hosted profile typing SVG")
}

if (readme.includes("git.io/typing-svg")) {
  fail("README still links to the external Typing SVG landing page")
}

if (readme.includes("font=Fira+Code")) {
  fail("README still uses Fira Code for the Typing SVG font")
}

if (readme.includes("font=Bytesized")) {
  fail("README still uses Bytesized for the Typing SVG font")
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
const profileIntroTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Hi, I'm @m1ng-wym,"
})
const typingTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Typing SVG"
})
const profileTaglineTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === profileTaglineText
})
const metricsTag = imageTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("alt") === "Language activity from authored commits"
})

const snakeIndex = readme.indexOf(snakeTag)
const terminalIndex = readme.indexOf(terminalTag)
const profileIntroIndex = readme.indexOf(profileIntroTag)
const typingIndex = readme.indexOf(typingTag)
const profileTaglineIndex = readme.indexOf(profileTaglineTag)
const metricsIndex = readme.indexOf(metricsTag)

if (!(terminalIndex < profileIntroIndex && profileIntroIndex < typingIndex && typingIndex < profileTaglineIndex)) {
  fail("profile sentence images must render as terminal icon, static intro, Typing SVG, then second-line tagline")
}

const contentBetweenTerminalAndIntro = readme.slice(terminalIndex + terminalTag.length, profileIntroIndex)
if (contentBetweenTerminalAndIntro !== "&nbsp;") {
  fail("Animated terminal icon and static intro must use the approved inline spacing")
}

const contentBetweenIntroAndTyping = readme.slice(profileIntroIndex + profileIntroTag.length, typingIndex)
if (contentBetweenIntroAndTyping !== "") {
  fail("static intro and Typing SVG must be directly joined into one sentence")
}

const contentBetweenTypingAndTagline = readme.slice(typingIndex + typingTag.length, profileTaglineIndex)
if (contentBetweenTypingAndTagline !== "<br>") {
  fail("Typing SVG and second-line tagline must be separated by exactly one HTML line break")
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

if (!terminalIcon.includes('width="30" height="42" viewBox="0 0 30 42"')) {
  fail("animated terminal icon is not using the approved profile-line viewport")
}

if (!terminalIcon.includes('transform="translate(2 7.2) scale(1.15)"')) {
  fail("animated terminal icon is not vertically aligned with the Typing SVG baseline")
}

if (!terminalIcon.includes('<line x1="12" y1="19" x2="20" y2="19">')) {
  fail("animated terminal icon is missing the cursor line")
}

if (!terminalIcon.includes('<animate attributeName="opacity" values="1;0;1" dur="1.333s" repeatCount="indefinite"/>')) {
  fail("animated terminal icon cursor is not configured to loop at 0.6x speed")
}

if (!profileIntro.includes("id=\"tiny5-profile-intro\" aria-label=\"Hi, I'm @m1ng-wym,\" data-font=\"Tiny5\"")) {
  fail("static profile intro is not using the Tiny5 artwork")
}

if (!profileIntro.includes('width="216" height="42"')) {
  fail("static profile intro does not use the approved compact dimensions")
}

if (!profileIntro.includes("data-renderer=\"svg-text\"")) {
  fail("static profile intro must use SVG text rendering instead of converted glyph paths")
}

if (profileIntro.includes("<path")) {
  fail("static profile intro must not use converted glyph paths")
}

if (!profileIntro.includes(">Hi, I'm @m1ng-wym,<")) {
  fail("static profile intro text is missing the lowercase i in Hi")
}

if (!profileIntro.includes('font-size="24"') || !profileIntro.includes('dominant-baseline="middle"')) {
  fail("static profile intro text must use the approved centered Tiny5 text baseline")
}

if (!profileTagline.includes('width="733" height="42"')) {
  fail("static profile tagline does not use the approved dimensions")
}

if (!profileTagline.includes(`>${profileTaglineText}<`)) {
  fail("static profile tagline text does not match the approved second line")
}

if (!profileTagline.includes('x="34"') || !profileTagline.includes('font-size="24"') || !profileTagline.includes('dominant-baseline="middle"')) {
  fail("static profile tagline must align under the first-line H with the same Tiny5 size")
}

console.log("profile README asset check ok: inline Tiny5 sentence, terminal icon baseline and loop, dynamic Typing SVG white background, explicit dimensions, and snake placement are valid")
