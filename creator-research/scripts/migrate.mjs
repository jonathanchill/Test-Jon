// Applies db/migrations/*.sql in order, once each. Usage: npm run migrate
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '..', 'db', 'migrations')

export async function migrate(connectionString) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
    const done = new Set((await client.query('select name from schema_migrations')).rows.map(r => r.name))
    const applied = []
    for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue
      await client.query('begin')
      try {
        await client.query(readFileSync(join(dir, file), 'utf8'))
        await client.query('insert into schema_migrations (name) values ($1)', [file])
        await client.query('commit')
        applied.push(file)
      } catch (err) {
        await client.query('rollback')
        throw err
      }
    }
    return applied
  } finally {
    await client.end()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  const applied = await migrate(url)
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply')
}
