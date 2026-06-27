#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"

const readmePath = "README.md"
const terminalIconPath = "./assets/lucide-terminal-animated.svg"
const terminalIconMobilePath = "./assets/lucide-terminal-animated-mobile.svg"
const profileIntroPath = "./assets/tiny5-profile-intro.svg"
const profileIntroMobilePath = "./assets/tiny5-profile-intro-mobile.svg"
const profileTaglinePath = "./assets/tiny5-profile-tagline.svg"
const profileTaglineMobilePath = "./assets/tiny5-profile-tagline-mobile.svg"
const profileTaglineText = "Here to learn from the GitHub community and contribute where I can."
const profileTaglineMobileFirstLine = "Here to learn from the GitHub community"
const profileTaglineMobileSecondLine = "and contribute where I can."
const mobileProfileIndent = "23"
const typingSvgUrl =
  "https://readme-typing-svg.demolab.com?font=Tiny5&weight=400&size=24&height=42&vCenter=true&duration=2600&pause=900&color=2C365D&background=FFFFFF&width=360&lines=a+Software+Engineering+Student.;a+Full-Stack+Developer+Intern.;an+AI+Explorer+%26+Creator.;an+Open+Source+Contributor.;an+Occasional+Overthinker."
const mobileTypingSvgUrl =
  "https://readme-typing-svg.demolab.com?font=Tiny5&weight=400&size=16&height=28&vCenter=true&duration=2600&pause=900&color=2C365D&background=FFFFFF&width=360&lines=%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0a+Software+Engineering+Student.;%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0a+Full-Stack+Developer+Intern.;%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0an+AI+Explorer+%26+Creator.;%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0an+Open+Source+Contributor.;%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0an+Occasional+Overthinker."
const contributionSnakeUrl = "https://raw.githubusercontent.com/m1ng-wym/m1ng-wym/output/github-contribution-grid-snake.svg"
const contributionSnakeMobileUrl = "https://raw.githubusercontent.com/m1ng-wym/m1ng-wym/output/github-contribution-grid-snake-mobile.svg"
const expectedImages = [
  {
    alt: "Language activity from authored commits",
    src: "./metrics.languages.svg",
    width: "920",
    height: "333",
  },
  {
    alt: "Contribution snake",
    src: contributionSnakeUrl,
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
const terminalIconMobile = readRequiredFile(terminalIconMobilePath, "mobile animated terminal icon")
const profileIntro = readRequiredFile(profileIntroPath, "static profile intro")
const profileIntroMobile = readRequiredFile(profileIntroMobilePath, "mobile static profile intro")
const profileTagline = readRequiredFile(profileTaglinePath, "static profile tagline")
const profileTaglineMobile = readRequiredFile(profileTaglineMobilePath, "mobile static profile tagline")

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
const sourceTags = Array.from(readme.matchAll(/<source\b[^>]*>/g), match => match[0])

function getAttributes(tag) {
  const attributes = new Map()
  for (const match of tag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g)) {
    attributes.set(match[1], match[2])
  }
  return attributes
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function findResponsivePicture({ fallbackSrc, fallbackAlt, mobileSrc }) {
  const pictureTags = Array.from(readme.matchAll(/<picture>[\s\S]*?<\/picture>/g), match => match[0])
  const picture = pictureTags.find(candidate => {
    const sourceTag = candidate.match(/<source\b[^>]*>/)?.[0]
    const fallbackImgTag = candidate.match(/<img\b[^>]*>/)?.[0]
    if (!sourceTag || !fallbackImgTag) {
      return false
    }

    const sourceAttributes = getAttributes(sourceTag)
    const fallbackAttributes = getAttributes(fallbackImgTag)
    return (
      sourceAttributes.get("srcset") === mobileSrc &&
      fallbackAttributes.get("src") === fallbackSrc &&
      fallbackAttributes.get("alt") === fallbackAlt
    )
  })

  if (!picture) {
    fail(`${fallbackAlt} must be wrapped in a responsive picture with mobile source ${mobileSrc}`)
  }

  return picture
}

function requireResponsiveProfilePicture({ fallbackSrc, fallbackAlt, mobileSrc }) {
  const picture = findResponsivePicture({ fallbackSrc, fallbackAlt, mobileSrc })
  const sourceTag = picture.match(/<source\b[^>]*>/)?.[0]
  const fallbackImgTag = picture.match(/<img\b[^>]*>/)?.[0]
  if (!sourceTag || !fallbackImgTag) {
    fail(`${fallbackAlt} responsive picture is malformed`)
  }

  const sourceAttributes = getAttributes(sourceTag)
  if (sourceAttributes.get("media") !== "(max-width: 700px)") {
    fail(`${fallbackAlt} mobile source media is ${sourceAttributes.get("media") || "missing"}, expected (max-width: 700px)`)
  }

  const fallbackAttributes = getAttributes(fallbackImgTag)
  if (fallbackAttributes.get("width") || fallbackAttributes.get("height")) {
    fail(`${fallbackAlt} responsive fallback img must rely on selected SVG intrinsic size`)
  }

  return { picture, fallbackImgTag }
}

function requireResponsiveSizedPicture({ fallbackSrc, fallbackAlt, mobileSrc, width, height }) {
  const picture = findResponsivePicture({ fallbackSrc, fallbackAlt, mobileSrc })
  const sourceTag = picture.match(/<source\b[^>]*>/)?.[0]
  const fallbackImgTag = picture.match(/<img\b[^>]*>/)?.[0]
  if (!sourceTag || !fallbackImgTag) {
    fail(`${fallbackAlt} responsive picture is malformed`)
  }

  const sourceAttributes = getAttributes(sourceTag)
  if (sourceAttributes.get("media") !== "(max-width: 700px)") {
    fail(`${fallbackAlt} mobile source media is ${sourceAttributes.get("media") || "missing"}, expected (max-width: 700px)`)
  }

  const fallbackAttributes = getAttributes(fallbackImgTag)
  if (fallbackAttributes.get("width") !== width || fallbackAttributes.get("height") !== height) {
    fail(`${fallbackAlt} fallback img dimensions must stay ${width}x${height} for the desktop rendering`)
  }

  return { picture, fallbackImgTag }
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

const contributionSnakePicture = requireResponsiveSizedPicture({
  fallbackSrc: contributionSnakeUrl,
  fallbackAlt: "Contribution snake",
  mobileSrc: contributionSnakeMobileUrl,
  width: "880",
  height: "192",
})

const snakeIndex = readme.indexOf(contributionSnakePicture.picture)
const terminalIndex = readme.indexOf(terminalTag)
const profileIntroIndex = readme.indexOf(profileIntroTag)
const typingIndex = readme.indexOf(typingTag)
const profileTaglineIndex = readme.indexOf(profileTaglineTag)
const metricsIndex = readme.indexOf(metricsTag)

if (!(terminalIndex < profileIntroIndex && profileIntroIndex < typingIndex && typingIndex < profileTaglineIndex)) {
  fail("profile sentence images must render as terminal icon, static intro, Typing SVG, then second-line tagline")
}

const contentBetweenTerminalAndIntro = readme.slice(terminalIndex + terminalTag.length, profileIntroIndex).trimStart()
if (contentBetweenTerminalAndIntro !== "</picture>&nbsp;<picture><source media=\"(max-width: 700px)\" srcset=\"./assets/tiny5-profile-intro-mobile.svg\">") {
  fail("Animated terminal icon and static intro must use the approved inline spacing")
}

const contentBetweenIntroAndTyping = readme.slice(profileIntroIndex + profileIntroTag.length, typingIndex).trimStart()
if (contentBetweenIntroAndTyping !== "</picture>&#8203;<picture><source media=\"(max-width: 700px)\" srcset=\"" + mobileTypingSvgUrl + "\">") {
  fail("static intro and Typing SVG must be joined by exactly one invisible mobile break opportunity")
}

const contentBetweenTypingAndTagline = readme.slice(typingIndex + typingTag.length, profileTaglineIndex).trimStart()
if (contentBetweenTypingAndTagline !== "</picture><br><picture><source media=\"(max-width: 700px)\" srcset=\"./assets/tiny5-profile-tagline-mobile.svg\">") {
  fail("Typing SVG and responsive tagline picture must be separated by exactly one HTML line break")
}

requireResponsiveProfilePicture({
  fallbackSrc: terminalIconPath,
  fallbackAlt: "Animated terminal icon",
  mobileSrc: terminalIconMobilePath,
})

requireResponsiveProfilePicture({
  fallbackSrc: profileIntroPath,
  fallbackAlt: "Hi, I'm @m1ng-wym,",
  mobileSrc: profileIntroMobilePath,
})

requireResponsiveProfilePicture({
  fallbackSrc: typingSvgUrl,
  fallbackAlt: "Typing SVG",
  mobileSrc: mobileTypingSvgUrl,
})

const profileTaglinePicture = readme.match(/<picture>[\s\S]*?<source\b[^>]*>[\s\S]*?<img\b[^>]*alt="Here to learn from the GitHub community and contribute where I can\."[^>]*>[\s\S]*?<\/picture>/)
if (!profileTaglinePicture) {
  fail("README must wrap the profile tagline in a responsive picture element")
}

const mobileTaglineSource = sourceTags.find(candidate => {
  const attributes = getAttributes(candidate)
  return attributes.get("srcset") === profileTaglineMobilePath
})

if (!mobileTaglineSource) {
  fail("responsive profile tagline picture is missing the mobile tagline source")
}

const mobileTaglineSourceAttributes = getAttributes(mobileTaglineSource)
if (mobileTaglineSourceAttributes.get("media") !== "(max-width: 700px)") {
  fail(`mobile profile tagline media query is ${mobileTaglineSourceAttributes.get("media") || "missing"}, expected (max-width: 700px)`)
}

const profileTaglineAttributes = getAttributes(profileTaglineTag)
if (profileTaglineAttributes.get("width") || profileTaglineAttributes.get("height")) {
  fail("responsive profile tagline fallback img must rely on SVG intrinsic size so the mobile source is not height-squashed")
}

if (snakeIndex > metricsIndex) {
  fail("Contribution snake must be placed directly above the language metrics image")
}

const contentBetweenSnakeAndMetrics = readme.slice(snakeIndex + contributionSnakePicture.picture.length, metricsIndex)
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

if (terminalIcon.includes('transform="translate(2 8.8) scale(1.15)"')) {
  fail("animated terminal icon is still using the old low-floating vertical placement")
}

if (terminalIcon.includes('transform="translate(2 2.4) scale(1.15)"')) {
  fail("animated terminal icon is still using the oversized high-floating placement")
}

if (terminalIcon.includes('transform="translate(3 6) scale(1)"')) {
  fail("animated terminal icon is still using the slightly high placement")
}

if (!terminalIcon.includes('transform="translate(3 7.4) scale(1)"')) {
  fail("animated terminal icon is not sized and vertically balanced against the Tiny5 intro glyphs")
}

if (!terminalIcon.includes('<line x1="12" y1="19" x2="20" y2="19">')) {
  fail("animated terminal icon is missing the cursor line")
}

if (!terminalIcon.includes('<animate attributeName="opacity" values="1;0;1" dur="2.6s" repeatCount="indefinite"/>')) {
  fail("animated terminal icon cursor is not configured to loop with the 2600ms typing cadence")
}

if (!terminalIconMobile.includes('width="20" height="28" viewBox="0 0 30 42"')) {
  fail("mobile animated terminal icon is not using the approved scaled profile-line viewport")
}

if (!terminalIconMobile.includes('<animate attributeName="opacity" values="1;0;1" dur="2.6s" repeatCount="indefinite"/>')) {
  fail("mobile animated terminal icon cursor is not configured to loop with the 2600ms typing cadence")
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

if (!profileIntroMobile.includes('width="144" height="28" viewBox="0 0 144 28"')) {
  fail("mobile static profile intro does not use the approved compact dimensions")
}

if (!profileIntroMobile.includes("id=\"tiny5-profile-intro-mobile\" aria-label=\"Hi, I'm @m1ng-wym,\" data-font=\"Tiny5\"")) {
  fail("mobile static profile intro is not using the Tiny5 artwork")
}

if (!profileIntroMobile.includes('x="0"') || !profileIntroMobile.includes('y="14"') || !profileIntroMobile.includes('font-size="16"')) {
  fail("mobile static profile intro must use the approved 16px Tiny5 baseline")
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

if (!profileTaglineMobile.includes('width="360" height="56" viewBox="0 0 360 56"')) {
  fail("mobile static profile tagline does not use the approved two-line dimensions")
}

if (!profileTaglineMobile.includes(`>${profileTaglineMobileFirstLine}<`)) {
  fail("mobile static profile tagline first line does not match the approved two-line split")
}

if (!profileTaglineMobile.includes(`>${profileTaglineMobileSecondLine}<`)) {
  fail("mobile static profile tagline second line does not match the approved two-line split")
}

if (!profileTaglineMobile.includes('font-size="16"') || !profileTaglineMobile.includes('dominant-baseline="middle"')) {
  fail("mobile static profile tagline must keep the same Tiny5 size and centered baseline")
}

if (!profileTaglineMobile.includes(`x="${mobileProfileIndent}" y="14"`) || !profileTaglineMobile.includes(`x="${mobileProfileIndent}" y="42"`)) {
  fail("mobile static profile tagline must align both lines under the first-line H")
}

if (!mobileTypingSvgUrl.includes("%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0%C2%A0a+Software+Engineering+Student.") || !mobileTypingSvgUrl.includes("size=16&height=28")) {
  fail("mobile Typing SVG service URL must keep 16px text and the approved H-aligned NBSP prefix")
}

console.log("profile README asset check ok: responsive Tiny5 sentence, terminal icon baseline and loop, dynamic Typing SVG service, mobile H-aligned intro stack, tagline picture sources, mobile snake source, and snake placement are valid")
