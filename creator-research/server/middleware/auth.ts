import { timingSafeEqual } from 'node:crypto'
import { getConfig } from '../lib/config'

// One shared password for the team (APP_PASSWORD). Each person signs in with
// their own name as the username, and that name is recorded against the lists
// they approve. With no password set the tool is open: only do that locally.

function same(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export default defineEventHandler((event) => {
  const { appPassword } = getConfig()
  if (!appPassword) {
    if (process.env.NODE_ENV === 'production') throw createError({ statusCode: 503, statusMessage: 'APP_PASSWORD must be set before this tool is run in production' })
    event.context.actor = 'local'
    return
  }
  const header = getHeader(event, 'authorization') ?? ''
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const at = decoded.indexOf(':')
    const user = at > 0 ? decoded.slice(0, at).trim() : ''
    if (user && same(decoded.slice(at + 1), appPassword)) {
      event.context.actor = user.slice(0, 80)
      return
    }
  }
  setHeader(event, 'www-authenticate', 'Basic realm="Creator research: your name and the team password", charset="UTF-8"')
  throw createError({ statusCode: 401, statusMessage: 'Sign in with your name and the team password' })
})
