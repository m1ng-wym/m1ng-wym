#!/usr/bin/env node

import { readFileSync } from "node:fs"

const workflowPath = ".github/workflows/snake.yml"
const expectedSnakeColor = "#FF5E3A"
const expectedDotColors = ["#FFFFFF", "#BDE8F5", "#86CCDD", "#153580", "#0F2854"]

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

console.log("snake workflow check ok: snake color and contribution dot colors are valid")
