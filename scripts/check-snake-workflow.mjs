#!/usr/bin/env node

import { readFileSync } from "node:fs"

const workflowPath = ".github/workflows/snake.yml"
const expectedSnakeColor = "#FF5E3A"
const expectedDotColors = ["#FFFFFF", "#BDE8F5", "#4988C4", "#153580", "#0F2854"]
const expectedMobileSnakeOutput = "dist/github-contribution-grid-snake-mobile.svg"
const expectedDesktopBackground =
  '<rect x="-16" y="-32" width="880" height="192" rx="8" ry="8" fill="#f6f8fa"/>'
const expectedMobileBackground =
  '<rect x="-16" y="-4" width="880" height="164" rx="8" ry="8" fill="#f6f8fa"/>'
const expectedDesktopViewBox = 'viewBox="-16 -32 880 192"'
const expectedMobileViewBox = 'viewBox="-16 -4 880 164"'
const expectedMobileHeight = 'height="164"'

function fail(message) {
  console.error(`snake workflow check failed: ${message}`)
  process.exit(1)
}

const workflow = readFileSync(workflowPath, "utf8")
const outputMatch = workflow.match(/github-contribution-grid-snake\.svg\?([^\s]+)/)

if (!outputMatch) {
  fail("could not find github-contribution-grid-snake.svg output query")
}

const params = new URLSearchParams(outputMatch[1])
const actualSnakeColor = params.get("color_snake")
const actualDotColors = params.get("color_dots")?.split(",")

if (actualSnakeColor !== expectedSnakeColor) {
  fail(`color_snake is ${actualSnakeColor || "missing"}, expected ${expectedSnakeColor}`)
}

if (!actualDotColors) {
  fail("color_dots is missing")
}

if (actualDotColors.length !== expectedDotColors.length) {
  fail(`color_dots has ${actualDotColors.length} colors, expected ${expectedDotColors.length}`)
}

for (const [index, expectedColor] of expectedDotColors.entries()) {
  if (actualDotColors[index] !== expectedColor) {
    fail(`color_dots[${index}] is ${actualDotColors[index] || "missing"}, expected ${expectedColor}`)
  }
}

if (!workflow.includes(expectedMobileSnakeOutput)) {
  fail(`mobile snake output is missing at ${expectedMobileSnakeOutput}`)
}

if (!workflow.includes(expectedDesktopViewBox)) {
  fail("snake background step must assert the expected desktop snake viewBox")
}

if (!workflow.includes(expectedDesktopBackground)) {
  fail("desktop snake background step is missing the approved full-size light gray background rect")
}

if (!workflow.includes(expectedMobileBackground)) {
  fail("mobile snake background step is missing the approved compact light gray background rect")
}

if (!workflow.includes(expectedMobileViewBox)) {
  fail(`mobile snake background step is missing compact ${expectedMobileViewBox}`)
}

if (!workflow.includes(expectedMobileHeight)) {
  fail(`mobile snake background step is missing compact ${expectedMobileHeight}`)
}

if (!workflow.includes("svg.replace(\"</desc>\", `</desc>${background}`)")) {
  fail("snake backgrounds must be inserted after the SVG description and before visible cells")
}

console.log("snake workflow check ok: snake color, contribution dot colors, desktop background, and compact mobile background output are valid")
