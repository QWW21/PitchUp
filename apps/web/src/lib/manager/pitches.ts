/**
 * A manager's pitches — E10 (with C-1, C-2, C-3).
 *
 * Every function takes the company it acts for, found from the signed-in
 * manager, and finds the pitch within it: another venue's pitch is a 404, the
 * same as one that does not exist. A deleted pitch (soft delete) is gone for
 * managers and players alike; its bookings and reviews stay.
 */
import 'server-only'
import { Prisma } from '@prisma/client'
import {
  PITCH_DEFAULT_DIMENSIONS,
  PITCH_LIMITS,
  addDays,
  normalizeWeek,
  pitchDayError,
  venueClock,
  venueTimeToUtc,
  type DayHours,
  type ManagerPitch,
  type ManagerPitchRow,
  type PitchSize,
} from '@pitchup/shared'
import type { z } from 'zod'
import type {
  PitchAmenitiesSchema,
  PitchBasicInfoSchema,
  PitchExceptionSchema,
  PitchHoursSchema,
  PitchPricingSchema,
  PitchShirtsSchema,
  UpdatePitchBasicInfoSchema,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { getLocale } from '@/i18n/server'
import { ApiException, conflict, notFound, validationError } from '@/lib/api/errors'
import { deleteImage, isCloudinaryConfigured } from '@/lib/cloudinary'
import { liveBookingWhere } from '@/lib/bookings/live'
import { managerCompany } from '@/lib/onboarding/company'
import { pitchStats, publicRating } from '@/lib/venues/ratings'

type Input<S extends z.ZodTypeAny> = z.infer<S>

/**
 * The company a manager manages pitches for. An approved venue, or one
 * waiting for approval, which may set its pitches up in advance (E10-01).
 */
export async function pitchCompany(ownerId: string) {
  const company = await managerCompany(ownerId)
  if (company?.status !== 'ACTIVE' && company?.status !== 'PENDING') {
    throw new ApiException('FORBIDDEN', 'api.venueNotSetUp', { reason: 'NOT_ACTIVE' })
  }
  return company
}

/** This company's pitch, not deleted; 404 otherwise. */
export async function ownedPitch(companyId: string, pitchId: string) {
  const pitch = await prisma.pitch.findFirst({
    where: { id: pitchId, companyId, deletedAt: null },
  })
  if (!pitch) throw notFound('api.pitchNotFound')
  return pitch
}

const dimensionsFor = (size: PitchSize) =>
  size === 'CUSTOM' ? null : PITCH_DEFAULT_DIMENSIONS[size]

/** Live bookings that have not ended yet: what deleting or blocking would strand. */
const upcomingWhere = (pitchId: string, now: Date): Prisma.BookingWhereInput => ({
  pitchId,
  endTime: { gt: now },
  ...liveBookingWhere(now),
})

// ── Basic info and lifecycle (E10-01, E10-05) ───────────────────────────────

export async function createPitch(companyId: string, input: Input<typeof PitchBasicInfoSchema>) {
  const dims = dimensionsFor(input.size)
  return prisma.pitch.create({
    data: {
      companyId,
      name: input.name,
      surfaceType: input.surfaceType,
      size: input.size,
      widthMeters: input.widthMeters ?? dims?.width ?? null,
      lengthMeters: input.lengthMeters ?? dims?.length ?? null,
      description: input.description ?? null,
      // Hidden until the manager has added a photo and a price and turns it on.
      isActive: false,
      hourlyRate: 0,
    },
    select: { id: true, name: true, isActive: true },
  })
}

export async function updateBasicInfo(
  companyId: string,
  pitchId: string,
  input: Input<typeof UpdatePitchBasicInfoSchema>
) {
  const pitch = await ownedPitch(companyId, pitchId)
  const size = input.size ?? pitch.size
  const sizeChanged = input.size !== undefined && input.size !== pitch.size
  const dims = dimensionsFor(size)
  // A new standard size brings its usual dimensions unless others were sent.
  const width =
    input.widthMeters ?? (sizeChanged && dims ? dims.width : (pitch.widthMeters ?? undefined))
  const length =
    input.lengthMeters ?? (sizeChanged && dims ? dims.length : (pitch.lengthMeters ?? undefined))
  if (size === 'CUSTOM' && (!width || !length)) {
    throw validationError('api.customSize', {
      reason: 'DIMENSIONS_REQUIRED',
    })
  }
  return prisma.pitch.update({
    where: { id: pitch.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.surfaceType !== undefined ? { surfaceType: input.surfaceType } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.minTrustScore !== undefined ? { minTrustScore: input.minTrustScore } : {}),
      size,
      widthMeters: width ?? null,
      lengthMeters: length ?? null,
    },
    select: {
      id: true,
      name: true,
      size: true,
      widthMeters: true,
      lengthMeters: true,
      minTrustScore: true,
    },
  })
}

/** Turning a pitch on needs a photo and a price; turning it off never blocks. */
export async function setPitchStatus(companyId: string, pitchId: string, isActive: boolean) {
  const pitch = await ownedPitch(companyId, pitchId)
  if (isActive) {
    const photos = await prisma.pitchPhoto.count({ where: { pitchId } })
    if (!photos) {
      throw validationError('api.needPhoto', { reason: 'NO_PHOTOS' })
    }
    if (Number(pitch.hourlyRate) <= 0) {
      throw validationError('api.needPrice', { reason: 'NO_PRICE' })
    }
  }
  return prisma.pitch.update({
    where: { id: pitch.id },
    data: { isActive },
    select: { id: true, isActive: true },
  })
}

/** Soft delete; refused while bookings are still to be played. */
export async function deletePitch(companyId: string, pitchId: string, now: Date = new Date()) {
  const pitch = await ownedPitch(companyId, pitchId)
  const upcoming = await prisma.booking.count({ where: upcomingWhere(pitch.id, now) })
  if (upcoming) {
    throw new ApiException(
      'CONFLICT',
      'api.pitchHasBookings',
      { reason: 'HAS_BOOKINGS', count: upcoming },
      { count: upcoming }
    )
  }
  await prisma.pitch.update({
    where: { id: pitch.id },
    data: { deletedAt: now, isActive: false },
  })
}

export async function listPitches(
  companyId: string,
  now: Date = new Date()
): Promise<ManagerPitchRow[]> {
  const today = venueClock(now).date
  const dayStart = venueTimeToUtc(today, 0)
  const dayEnd = venueTimeToUtc(addDays(today, 1), 0)
  const where = { companyId, deletedAt: null }
  const [pitches, ratings, todays, upcoming] = await Promise.all([
    prisma.pitch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        photos: { orderBy: { order: 'asc' }, take: 1, select: { url: true } },
        _count: { select: { photos: true } },
      },
    }),
    pitchStats(where),
    prisma.booking.groupBy({
      by: ['pitchId'],
      where: {
        pitch: where,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        startTime: { gte: dayStart, lt: dayEnd },
      },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ['pitchId'],
      where: { pitch: where, endTime: { gt: now }, ...liveBookingWhere(now) },
      _count: { _all: true },
    }),
  ])
  const count = (rows: { pitchId: string; _count: { _all: number } }[], id: string) =>
    rows.find(r => r.pitchId === id)?._count._all ?? 0

  return pitches.map(p => {
    const r = ratings.get(p.id)
    return {
      id: p.id,
      name: p.name,
      surfaceType: p.surfaceType,
      size: p.size,
      isActive: p.isActive,
      minTrustScore: p.minTrustScore,
      coverPhotoUrl: p.photos[0]?.url ?? null,
      avgRating: publicRating(r?.mean ?? null, r?.count ?? 0),
      reviewCount: r?.count ?? 0,
      bookingsToday: count(todays, p.id),
      upcomingBookings: count(upcoming, p.id),
      photoCount: p._count.photos,
      hourlyRate: Number(p.hourlyRate),
    }
  })
}

export async function getManagerPitch(companyId: string, pitchId: string): Promise<ManagerPitch> {
  const p = await prisma.pitch.findFirst({
    where: { id: pitchId, companyId, deletedAt: null },
    include: {
      photos: { orderBy: { order: 'asc' }, select: { id: true, url: true, order: true } },
      amenities: { select: { amenityType: true } },
      shirtInventory: { orderBy: { colour: 'asc' }, select: { colour: true, quantity: true } },
      exceptions: { orderBy: { date: 'asc' } },
      company: { select: { workingHours: true } },
    },
  })
  if (!p) throw notFound('api.pitchNotFound')
  return {
    id: p.id,
    name: p.name,
    surfaceType: p.surfaceType,
    size: p.size,
    widthMeters: p.widthMeters,
    lengthMeters: p.lengthMeters,
    description: p.description,
    isActive: p.isActive,
    minTrustScore: p.minTrustScore,
    hourlyRate: Number(p.hourlyRate),
    minBookingHours: p.minBookingHours,
    maxBookingHours: p.maxBookingHours,
    advanceBookingDays: p.advanceBookingDays,
    hasShirts: p.hasShirts,
    photos: p.photos,
    amenities: p.amenities.map(a => a.amenityType),
    shirtInventory: p.shirtInventory,
    workingHours: p.workingHours ? normalizeWeek(p.workingHours) : null,
    venueHours: normalizeWeek(p.company.workingHours),
    exceptions: p.exceptions.map(e => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      reason: e.reason,
    })),
  }
}

// ── Photos (E10-02) ──────────────────────────────────────────────────────────

const photoSelect = { id: true, url: true, order: true } as const

export async function addPhoto(
  companyId: string,
  pitchId: string,
  input: { url: string; cloudinaryPublicId: string }
) {
  const pitch = await ownedPitch(companyId, pitchId)
  return prisma.$transaction(async tx => {
    // One pitch's photos at a time, so two uploads finishing together both fit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'photos:' + pitch.id}))`
    const count = await tx.pitchPhoto.count({ where: { pitchId: pitch.id } })
    if (count >= PITCH_LIMITS.MAX_PHOTOS) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'api.maxPhotos',
        { reason: 'PHOTO_LIMIT' },
        { n: PITCH_LIMITS.MAX_PHOTOS }
      )
    }
    return tx.pitchPhoto.create({
      data: { pitchId: pitch.id, ...input, order: count },
      select: photoSelect,
    })
  })
}

export async function reorderPhotos(companyId: string, pitchId: string, photoIds: string[]) {
  const pitch = await ownedPitch(companyId, pitchId)
  const current = await prisma.pitchPhoto.findMany({
    where: { pitchId: pitch.id },
    select: { id: true },
  })
  const same =
    current.length === photoIds.length &&
    new Set(photoIds).size === photoIds.length &&
    current.every(p => photoIds.includes(p.id))
  if (!same) {
    throw conflict('api.photosStale', {
      reason: 'OUT_OF_SYNC',
    })
  }
  await prisma.$transaction(
    photoIds.map((id, order) => prisma.pitchPhoto.update({ where: { id }, data: { order } }))
  )
  return prisma.pitchPhoto.findMany({
    where: { pitchId: pitch.id },
    orderBy: { order: 'asc' },
    select: photoSelect,
  })
}

/** Removes the photo, then closes the gap. The first photo is the cover. */
export async function deletePhoto(companyId: string, pitchId: string, photoId: string) {
  const pitch = await ownedPitch(companyId, pitchId)
  const photo = await prisma.pitchPhoto.findFirst({ where: { id: photoId, pitchId: pitch.id } })
  if (!photo) throw notFound('api.photoNotFound')
  if (isCloudinaryConfigured()) {
    // Best effort: an image left on Cloudinary costs little; a photo that
    // cannot be removed from the pitch would be worse.
    await deleteImage(photo.cloudinaryPublicId).catch(caught =>
      console.error(
        `[pitches] Could not delete ${photo.cloudinaryPublicId} from Cloudinary:`,
        caught instanceof Error ? caught.message : 'unknown error'
      )
    )
  }
  return prisma.$transaction(async tx => {
    await tx.pitchPhoto.delete({ where: { id: photo.id } })
    const rest = await tx.pitchPhoto.findMany({
      where: { pitchId: pitch.id },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    for (const [order, p] of rest.entries()) {
      await tx.pitchPhoto.update({ where: { id: p.id }, data: { order } })
    }
    // A live pitch must keep a photo.
    if (!rest.length && pitch.isActive) {
      await tx.pitch.update({ where: { id: pitch.id }, data: { isActive: false } })
    }
    return tx.pitchPhoto.findMany({
      where: { pitchId: pitch.id },
      orderBy: { order: 'asc' },
      select: photoSelect,
    })
  })
}

// ── Amenities, pricing, shirts (E10-03, E10-04) ─────────────────────────────

export async function setAmenities(
  companyId: string,
  pitchId: string,
  input: Input<typeof PitchAmenitiesSchema>
) {
  const pitch = await ownedPitch(companyId, pitchId)
  await prisma.$transaction([
    prisma.pitchAmenity.deleteMany({ where: { pitchId: pitch.id } }),
    prisma.pitchAmenity.createMany({
      data: input.amenities.map(amenityType => ({ pitchId: pitch.id, amenityType })),
    }),
  ])
  return { amenities: input.amenities }
}

export async function setPricing(
  companyId: string,
  pitchId: string,
  input: Input<typeof PitchPricingSchema>
) {
  const pitch = await ownedPitch(companyId, pitchId)
  const saved = await prisma.pitch.update({
    where: { id: pitch.id },
    data: input,
    select: {
      hourlyRate: true,
      minBookingHours: true,
      maxBookingHours: true,
      advanceBookingDays: true,
    },
  })
  return { ...saved, hourlyRate: Number(saved.hourlyRate) }
}

/**
 * Lending shirts, and how many sets of each colour (C-1: free). Upcoming
 * bookings were promised sets; fewer than the most any of them needs is
 * refused unless `force` says the manager will sort it out.
 */
export async function setShirts(
  companyId: string,
  pitchId: string,
  input: Input<typeof PitchShirtsSchema>,
  now: Date = new Date()
) {
  const pitch = await ownedPitch(companyId, pitchId)
  const sets = input.hasShirts ? input.inventory.reduce((n, c) => n + c.quantity, 0) : 0
  if (!input.force) {
    const short = await prisma.booking.findMany({
      where: { ...upcomingWhere(pitch.id, now), shirtSets: { gt: sets } },
      select: { id: true },
    })
    if (short.length) {
      throw new ApiException(
        'CONFLICT',
        'api.shirtsPromised',
        { reason: 'SHIRTS_PROMISED', bookingIds: short.map(b => b.id) },
        { count: short.length }
      )
    }
  }
  await prisma.$transaction([
    prisma.shirtInventory.deleteMany({ where: { pitchId: pitch.id } }),
    ...(input.hasShirts
      ? [
          prisma.shirtInventory.createMany({
            data: input.inventory.map(c => ({ pitchId: pitch.id, ...c })),
          }),
        ]
      : []),
    prisma.pitch.update({ where: { id: pitch.id }, data: { hasShirts: input.hasShirts } }),
  ])
  return { hasShirts: input.hasShirts, inventory: input.hasShirts ? input.inventory : [] }
}

// ── Hours and blocked days (E10-04, E10-10) ─────────────────────────────────

export async function setHours(
  companyId: string,
  pitchId: string,
  input: Input<typeof PitchHoursSchema>
) {
  const pitch = await ownedPitch(companyId, pitchId)
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { workingHours: true },
  })
  const venue = normalizeWeek(company.workingHours)
  const week = [...input.workingHours].sort((a, b) => a.day - b.day) as DayHours[]
  const locale = await getLocale()
  const problems = week
    .map(d => ({ day: d.day, message: pitchDayError(d, venue[d.day]!, locale) }))
    .filter(p => p.message)
  if (problems.length) {
    throw validationError('api.pitchHoursOutside', {
      reason: 'OUTSIDE_VENUE_HOURS',
      days: problems,
    })
  }
  await prisma.pitch.update({
    where: { id: pitch.id },
    data: { workingHours: week as unknown as Prisma.InputJsonValue },
  })
  return { workingHours: week }
}

export async function addException(
  companyId: string,
  pitchId: string,
  input: Input<typeof PitchExceptionSchema>,
  now: Date = new Date()
) {
  const pitch = await ownedPitch(companyId, pitchId)
  if (input.date < venueClock(now).date) {
    throw validationError('api.datePassed', { field: 'date' })
  }
  const bookings = await prisma.booking.findMany({
    where: {
      pitchId: pitch.id,
      ...liveBookingWhere(now),
      startTime: { lt: venueTimeToUtc(addDays(input.date, 1), 0) },
      endTime: { gt: venueTimeToUtc(input.date, 0) },
    },
    select: { id: true },
  })
  if (bookings.length) {
    throw new ApiException(
      'CONFLICT',
      'api.dateHasBookings',
      { reason: 'HAS_BOOKINGS', bookingIds: bookings.map(b => b.id) },
      { count: bookings.length }
    )
  }
  try {
    const row = await prisma.pitchException.create({
      data: {
        pitchId: pitch.id,
        date: new Date(`${input.date}T00:00:00Z`),
        ...(input.reason ? { reason: input.reason } : {}),
      },
    })
    return { id: row.id, date: input.date, reason: row.reason }
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      throw conflict('api.dateBlocked', { reason: 'ALREADY_BLOCKED' })
    }
    throw caught
  }
}

/** Unblocks a date. Past blocks are history and stay. */
export async function deleteException(
  companyId: string,
  pitchId: string,
  exceptionId: string,
  now: Date = new Date()
) {
  const pitch = await ownedPitch(companyId, pitchId)
  const row = await prisma.pitchException.findFirst({
    where: { id: exceptionId, pitchId: pitch.id },
  })
  if (!row) throw notFound('api.blockedDateNotFound')
  if (row.date.toISOString().slice(0, 10) < venueClock(now).date) {
    throw conflict('api.pastUnblock', { reason: 'PAST' })
  }
  await prisma.pitchException.delete({ where: { id: row.id } })
}
