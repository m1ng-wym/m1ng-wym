#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import * as esbuild from "esbuild"
import { chromium } from "playwright"

const width = 720
const height = 132
const deviceScaleFactor = 2
const fps = 24
const seconds = 8
const frameCount = fps * seconds
const outputPath = resolve("assets/morphing-text.apng.png")
const texts = ["Component", "Morphing", "Text", "GitHub"]

// MorphingText logic adapted from Magic UI:
// https://magicui.design/docs/components/morphing-text
const componentSource = String.raw`
import React, { useCallback, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

const morphTime = 1.5
const cooldownTime = 0.5

const useMorphingText = (texts) => {
  const textIndexRef = useRef(0)
  const morphRef = useRef(0)
  const cooldownRef = useRef(0)
  const timeRef = useRef(new Date())

  const text1Ref = useRef(null)
  const text2Ref = useRef(null)

  const setStyles = useCallback(
    (fraction) => {
      const [current1, current2] = [text1Ref.current, text2Ref.current]
      if (!current1 || !current2) return

      current2.style.filter = "blur(" + Math.min(8 / fraction - 8, 100) + "px)"
      current2.style.opacity = Math.pow(fraction, 0.4) * 100 + "%"

      const invertedFraction = 1 - fraction
      current1.style.filter = "blur(" + Math.min(8 / invertedFraction - 8, 100) + "px)"
      current1.style.opacity = Math.pow(invertedFraction, 0.4) * 100 + "%"

      current1.textContent = texts[textIndexRef.current % texts.length]
      current2.textContent = texts[(textIndexRef.current + 1) % texts.length]
    },
    [texts]
  )

  const doMorph = useCallback(() => {
    morphRef.current -= cooldownRef.current
    cooldownRef.current = 0

    let fraction = morphRef.current / morphTime

    if (fraction > 1) {
      cooldownRef.current = cooldownTime
      fraction = 1
    }

    setStyles(fraction)

    if (fraction === 1) {
      textIndexRef.current++
    }
  }, [setStyles])

  const doCooldown = useCallback(() => {
    morphRef.current = 0
    const [current1, current2] = [text1Ref.current, text2Ref.current]
    if (current1 && current2) {
      current2.style.filter = "none"
      current2.style.opacity = "100%"
      current1.style.filter = "none"
      current1.style.opacity = "0%"
    }
  }, [])

  useEffect(() => {
    let animationFrameId

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const newTime = new Date()
      const dt = (newTime.getTime() - timeRef.current.getTime()) / 1000
      timeRef.current = newTime

      cooldownRef.current -= dt

      if (cooldownRef.current <= 0) doMorph()
      else doCooldown()
    }

    animate()
    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [doMorph, doCooldown])

  return { text1Ref, text2Ref }
}

const Texts = ({ texts }) => {
  const { text1Ref, text2Ref } = useMorphingText(texts)
  return (
    <>
      <span ref={text1Ref} />
      <span ref={text2Ref} />
    </>
  )
}

const SvgFilters = () => (
  <svg id="filters" preserveAspectRatio="xMidYMid slice">
    <defs>
      <filter id="threshold">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 255 -140"
        />
      </filter>
    </defs>
  </svg>
)

const MorphingText = ({ texts }) => (
  <div className="morphing-text" aria-label="Morphing Text demo">
    <Texts texts={texts} />
    <SvgFilters />
  </div>
)

const root = createRoot(document.getElementById("root"))
root.render(<MorphingText texts={${JSON.stringify(texts)}} />)
`

const style = `
html,
body,
#root {
  width: ${width}px;
  height: ${height}px;
  margin: 0;
  overflow: hidden;
  background: #ffffff;
}

body {
  color: #24292f;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

.morphing-text {
  position: relative;
  width: ${width}px;
  height: ${height}px;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 68px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0;
  filter: url(#threshold) blur(0.6px);
}

.morphing-text span {
  position: absolute;
  inset-inline: 0;
  top: 30px;
  margin: auto;
  display: inline-block;
  width: 100%;
}

#filters {
  position: fixed;
  width: 0;
  height: 0;
}
`

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`)
  }
  return result
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true })
  } catch {
    return await chromium.launch({ headless: true })
  }
}

async function main() {
  run("ffmpeg", ["-hide_banner", "-encoders"])
  await mkdir("assets", { recursive: true })

  const workDir = await mkdtemp(join(tmpdir(), "morphing-text-"))
  const bundlePath = join(workDir, "bundle.js")
  const htmlPath = join(workDir, "index.html")
  const frameDir = join(workDir, "frames")
  await mkdir(frameDir)

  try {
    await esbuild.build({
      stdin: {
        contents: componentSource,
        loader: "jsx",
        resolveDir: process.cwd(),
        sourcefile: "morphing-text.jsx",
      },
      bundle: true,
      format: "iife",
      outfile: bundlePath,
      define: {
        "process.env.NODE_ENV": "\"production\"",
      },
      logLevel: "silent",
    })

    const bundle = await readFile(bundlePath, "utf8")
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>${style}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${bundle}</script>
  </body>
</html>`
    await writeFile(htmlPath, html)

    const browser = await launchBrowser()
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor,
    })

    await page.goto(`file://${htmlPath}`)
    await page.waitForSelector(".morphing-text span")
    await page.waitForTimeout(120)

    for (let frame = 0; frame < frameCount; frame++) {
      const framePath = join(frameDir, `frame-${String(frame).padStart(4, "0")}.png`)
      await page.screenshot({
        path: framePath,
        omitBackground: false,
      })
      await page.waitForTimeout(1000 / fps)
    }

    await browser.close()

    run("ffmpeg", [
      "-hide_banner",
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(frameDir, "frame-%04d.png"),
      "-plays",
      "0",
      "-f",
      "apng",
      outputPath,
    ])

    console.log(`Generated ${outputPath} from ${frameCount} frames at ${deviceScaleFactor}x scale`)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
