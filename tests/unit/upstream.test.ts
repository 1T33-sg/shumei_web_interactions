import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import snapshot from '../../upstream-dashboard.json'

it('keeps every imported A file identical to the pinned upstream commit', () => {
  expect(snapshot.repository).toBe('https://github.com/MMBB-lee/web_dashboard')
  for (const [name, expected] of Object.entries(snapshot.files)) {
    const file = fileURLToPath(new URL(`../../web_dashboard/${name}`, import.meta.url))
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    expect(createHash('sha256').update(text).digest('hex'), name).toBe(expected)
  }
})
