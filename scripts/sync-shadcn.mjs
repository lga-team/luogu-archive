import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cache = path.join(root, 'vendor', 'shadcn')
const headers = { 'User-Agent': 'luogu-archive-shadcn-cache', Accept: 'application/vnd.github+json' }
const json = value => `${JSON.stringify(value, null, 2)}\n`
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

function inside(base, relative) {
  if (/[\x00-\x1f\x7f]/.test(relative) || relative.includes('\\') || relative.split('/').includes('..') || path.isAbsolute(relative)) throw new Error(`Unsafe path: ${relative}`)
  const target = path.resolve(base, relative)
  if (!target.startsWith(`${path.resolve(base)}${path.sep}`)) throw new Error(`Path escapes cache: ${relative}`)
  return target
}
async function download(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(120000) })
      if (!response.ok) throw new Error(`${response.status} ${url}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > 256 * 1024 * 1024) throw new Error('Download exceeds 256 MiB')
      return bytes
    } catch (error) {
      if (attempt === 2) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
}
async function check() {
  const manifest = JSON.parse(await fs.readFile(path.join(cache, 'manifest.json'), 'utf8'))
  for (const file of manifest.files) {
    const bytes = await fs.readFile(inside(cache, file.path))
    if (sha256(bytes) !== file.sha256) throw new Error(`Changed cached source: ${file.path}`)
  }
  console.log(`Verified ${manifest.files.length} files at ${manifest.commit}`)
  return manifest
}

if (process.argv.includes('--check')) {
  await check()
} else {
  const ref = process.argv.find(arg => arg.startsWith('--ref='))?.slice(6) || 'main'
  const revision = JSON.parse((await download(`https://api.github.com/repos/shadcn-ui/ui/commits/${encodeURIComponent(ref)}`)).toString('utf8'))
  const commit = revision.sha
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid upstream commit')
  const tree = JSON.parse((await download(`https://api.github.com/repos/shadcn-ui/ui/git/trees/${commit}?recursive=1`)).toString('utf8'))
  if (tree.truncated || !/^[a-f0-9]{40}$/.test(tree.sha)) throw new Error('Incomplete GitHub tree')
  const selected = tree.tree.filter(file => file.type === 'blob' && ['100644', '100755'].includes(file.mode) && (
    file.path.startsWith('apps/v4/registry/') || file.path.startsWith('apps/v4/lib/') ||
    file.path.startsWith('apps/v4/hooks/') || file.path.startsWith('apps/v4/styles/') ||
    ['LICENSE.md', 'LICENSE', 'README.md', 'apps/v4/package.json'].includes(file.path)
  )).sort((a, b) => a.path.localeCompare(b.path, 'en'))
  if (!selected.some(file => /^LICENSE(?:\.md)?$/.test(file.path))) throw new Error('Upstream license missing')
  const snapshot = `snapshots/${commit}`
  const destination = inside(cache, snapshot)
  const manifestPath = path.join(cache, 'manifest.json')
  let previous
  try { previous = JSON.parse(await fs.readFile(manifestPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (previous) await check()
  if (previous?.commit === commit) {
    console.log('Official source is already cached.')
  } else {
    try { await fs.access(destination); throw new Error(`Snapshot already exists; will not overwrite ${destination}`) } catch (error) { if (error.code !== 'ENOENT') throw error }
    await fs.mkdir(cache, { recursive: true })
    const staging = await fs.mkdtemp(path.join(cache, '.download-'))
    try {
      const archive = path.join(staging, 'source.tar.gz')
      console.log(`Downloading official shadcn/ui snapshot ${commit} (${selected.length} selected files)...`)
      await fs.writeFile(archive, await download(`https://codeload.github.com/shadcn-ui/ui/tar.gz/${commit}`))
      const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
      const members = execFileSync(tar, ['-tzf', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean)
      const prefix = members[0].split('/')[0]
      if (!/^ui-[a-f0-9]{40}$/.test(prefix)) throw new Error('Unexpected archive root')
      const wanted = selected.map(file => {
        inside(staging, file.path)
        const member = `${prefix}/${file.path}`
        if (!members.includes(member)) throw new Error(`Missing archive source: ${file.path}`)
        return member
      })
      const list = path.join(staging, 'files.txt')
      await fs.writeFile(list, `${wanted.join('\n')}\n`)
      const extracted = path.join(staging, 'extracted')
      await fs.mkdir(extracted)
      execFileSync(tar, ['-xzf', archive, '-C', extracted, '--strip-components=1', '-T', list], { stdio: 'inherit' })
      const files = []
      for (const file of selected) {
        const bytes = await fs.readFile(inside(extracted, file.path))
        const blob = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
        if (blob !== file.sha) throw new Error(`Git blob verification failed: ${file.path}`)
        files.push({ path: `${snapshot}/${file.path}`, bytes: bytes.length, sha256: sha256(bytes) })
      }
      const components = selected.filter(file => /\/ui\/[^/]+\.tsx$/.test(file.path)).map(file => ({
        name: path.basename(file.path, '.tsx'),
        variant: file.path.match(/registry\/(?:bases\/)?([^/]+)\//)[1],
        path: `${snapshot}/${file.path}`,
      }))
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.rename(extracted, destination)
      const manifest = { repository: 'https://github.com/shadcn-ui/ui', commit, ref, capturedAt: new Date().toISOString(), files }
      await fs.writeFile(manifestPath, json(manifest))
      await fs.writeFile(path.join(cache, 'catalog.json'), json({ commit, components }))
      await fs.copyFile(inside(destination, selected.find(file => /^LICENSE(?:\.md)?$/.test(file.path)).path), path.join(cache, 'LICENSE.md'))
      const variants = [...new Set(components.map(component => component.variant))]
      console.log(`Cached ${files.length} files, ${components.length} component implementations, ${variants.join(', ')}.`)
      await check()
    } finally {
      // Only this run's validated staging directory is disposable.
      if (!staging.startsWith(`${cache}${path.sep}.download-`)) throw new Error('Invalid staging cleanup path')
      await fs.rm(staging, { recursive: true, force: true })
    }
  }
}
