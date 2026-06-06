#!/usr/bin/env node

import { readFileSync } from "node:fs"

const readmePath = "README.md"
const typingSvgPath = "assets/profile-typing.svg"

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

if (!readme.includes(`![Typing SVG](./${typingSvgPath})`)) {
  fail(`README does not reference ./${typingSvgPath}`)
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

console.log(`profile README asset check ok: ${typingSvgPath} is self-hosted`)
