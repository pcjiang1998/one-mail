/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const packageMetadata = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'))
const productName = 'OneMail'
const executableName = 'OneMail.exe'
const appDir = join(projectDir, 'dist', 'win-unpacked')
const executablePath = join(appDir, executableName)
const iconPath = join(projectDir, 'build', 'icon.ico')
const electronBuilderCli = require.resolve('electron-builder/cli.js')

if (process.platform !== 'win32') {
  throw new Error('build:win must run on Windows.')
}

await run(process.execPath, [
  electronBuilderCli,
  '--win',
  '--dir',
  '--config.win.signAndEditExecutable=false'
])

if (!existsSync(executablePath)) {
  throw new Error(`Packaged executable was not found: ${executablePath}`)
}

const requireFromElectronBuilder = createRequire(require.resolve('electron-builder/package.json'))
const { getRceditBundle } = requireFromElectronBuilder('app-builder-lib/out/toolsets/windows')
const rcedit = await getRceditBundle('1.0.0')
const version = packageMetadata.version
const productVersion = toWindowsVersion(version)
const author = getAuthorName(packageMetadata.author)

await run(rcedit.x64, [
  executablePath,
  '--set-version-string',
  'FileDescription',
  productName,
  '--set-version-string',
  'ProductName',
  productName,
  '--set-version-string',
  'LegalCopyright',
  `Copyright (c) ${new Date().getFullYear()} ${author}`,
  '--set-version-string',
  'InternalName',
  productName,
  '--set-version-string',
  'OriginalFilename',
  executableName,
  '--set-file-version',
  version,
  '--set-product-version',
  productVersion,
  '--set-icon',
  iconPath
])

await run(process.execPath, [
  electronBuilderCli,
  '--win',
  'nsis',
  '--prepackaged',
  appDir,
  '--config.win.signAndEditExecutable=false'
])

function toWindowsVersion(version) {
  const parts = version
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter(Number.isInteger)
    .slice(0, 4)

  while (parts.length < 4) parts.push(0)
  return parts.join('.')
}

function getAuthorName(author) {
  if (typeof author === 'string' && author.trim()) return author.trim()
  if (author && typeof author.name === 'string' && author.name.trim()) return author.name.trim()
  return productName
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectDir,
      env: process.env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          signal
            ? `${command} was terminated by signal ${signal}.`
            : `${command} exited with code ${code ?? 'unknown'}.`
        )
      )
    })
  })
}
