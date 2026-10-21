/**
 * Platform settings — E15-05, with C-15's subscription prices. One row,
 * created on first read. Read when venues subscribe or renew and, while
 * maintenance mode is on, on every request, so it is kept in memory for a
 * minute, and dropped when an admin saves.
 *
 * In memory rather than Next's data cache: that one is written to disk and
 * outlives the process, so after the database was reset (or edited by hand)
 * it kept serving the old settings. With several server instances, another
 * instance sees a change within the minute.
 */
import 'server-only'
import type { PlatformConfig } from '@prisma/client'
import type { PlatformConfigInput, PlatformConfigView } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'

const ID = 'singleton'
const TTL_MS = 60_000

let cached: { value: PlatformConfigView; at: number } | null = null

const view = (c: PlatformConfig): PlatformConfigView => ({
  subIntroMonthlyRon: c.subIntroMonthlyRon,
  subIntroYearlyRon: c.subIntroYearlyRon,
  subMonthlyRon: c.subMonthlyRon,
  subYearlyRon: c.subYearlyRon,
  subExtraPitchMonthlyRon: c.subExtraPitchMonthlyRon,
  subExtraPitchYearlyRon: c.subExtraPitchYearlyRon,
  subIncludedPitches: c.subIncludedPitches,
  subTrialDays: c.subTrialDays,
  maintenanceMode: c.maintenanceMode,
  maintenanceMessage: c.maintenanceMessage,
  updatedAt: c.updatedAt.toISOString(),
})

/** The settings, at most a minute old. */
export async function platformConfig(now: number = Date.now()): Promise<PlatformConfigView> {
  if (cached && now - cached.at < TTL_MS) return cached.value
  const row = await prisma.platformConfig.upsert({
    where: { id: ID },
    create: { id: ID },
    update: {},
  })
  cached = { value: view(row), at: now }
  return cached.value
}

export async function updatePlatformConfig(
  adminId: string,
  input: PlatformConfigInput
): Promise<PlatformConfigView> {
  // Only what was sent changes (the schema drops what wasn't).
  const data = {
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    updatedById: adminId,
  }
  const saved = await prisma.platformConfig.upsert({
    where: { id: ID },
    create: { id: ID, ...data },
    update: data,
  })
  cached = { value: view(saved), at: Date.now() }
  return cached.value
}
