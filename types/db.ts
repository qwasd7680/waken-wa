/**
 * Row shapes aligned with Drizzle `admin_users` / `api_tokens` (sqlite + pg).
 * Prefer matching `drizzle/schema.*.ts` when these models change.
 */
export type AdminUser = {
  id: number
  username: string
  passwordHash: string
  createdAt: Date
}

export type ApiToken = {
  id: number
  name: string
  token: string
  isActive: boolean
  createdAt: Date
  lastUsedAt: Date | null
}
