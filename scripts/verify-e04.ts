/**
 * Re-runs the E04 backend acceptance checks (E04-01, -02, -03, and the
 * reviews endpoint from E04-07) against a running server.
 *
 * Usage: cd apps/web && ./node_modules/.bin/tsx ../../scripts/verify-e04.ts
 * Needs: `pnpm db:seed` (Discover + pitch detail fixtures) and a server on
 * :3000, or BASE_URL. A few checks change a row and put it back.
 */
import { PrismaClient } from '@prisma/client'
import {
  addDays,
  dayOfWeek,
  venueClock,
  type CompanyDetail,
  type PitchAvailability,
  type PitchDetail,
  type ReviewPage,
} from '@pitchup/shared'

const BASE = `${process.env.BASE_URL ?? 'http://localhost:3000'}/api/v1`
const prisma = new PrismaClient()

let pass = 0
let fail = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) pass++
  else fail++
  console.log(
    `  ${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  ${JSON.stringify(detail)}`}`
  )
}
const step = (title: string) => console.log(`\n── ${title}`)

async function get<T>(path: string) {
  const started = Date.now()
  const res = await fetch(`${BASE}${path}`)
  const body = (await res.json()) as {
    data: T | null
    error: { code: string; message: string } | null
  }
  return {
    status: res.status,
    data: body.data,
    error: body.error,
    headers: res.headers,
    ms: Date.now() - started,
  }
}

async function venue(slug: string) {
  const c = await prisma.company.findFirst({
    where: { owner: { email: `venue-${slug}@demo.ro` } },
    include: { pitches: { orderBy: { name: 'asc' } } },
  })
  if (!c) throw new Error(`Seed missing: ${slug}. Run pnpm db:seed.`)
  return c
}

async function main() {
  const gheorgheni = await venue('gheorgheni')
  const arena = await venue('cluj-arena-park')
  const zorilor = await venue('zorilor')
  const iris = await venue('iris')
  const futsal = await venue('futsal-center')
  const pending = await venue('pending')
  const inactive = await venue('inactive')
  const teren1 = gheorgheni.pitches[0]!

  step('GET /companies/:id')
  {
    const r = await get<CompanyDetail>(`/companies/${gheorgheni.id}`)
    const c = r.data!
    check(
      '200 with full data, no auth',
      r.status === 200 && c.name === 'Arena Gheorgheni' && !!c.addressLine1
    )
    check(
      'workingHours: seven days, Sunday = 0',
      c.workingHours.length === 7 && c.workingHours.every((d, i) => d.day === i)
    )
    check(
      'pitches: active only, by name',
      c.pitches.map(p => p.name).join() === 'Teren 1,Teren 2' && c.pitches.every(p => p.isActive)
    )
    check(
      'coverPhotoUrl is the order-0 photo',
      c.pitches.every(p => p.coverPhotoUrl?.includes('-0/') ?? false),
      c.pitches.map(p => p.coverPhotoUrl)
    )
    check('avgRating shown at 3+ reviews', typeof c.avgRating === 'number' && c.reviewCount >= 3)

    const z = (await get<CompanyDetail>(`/companies/${zorilor.id}`)).data!
    check(
      'avgRating null below 3 reviews (PRD §11.2)',
      z.avgRating === null && z.reviewCount === 2,
      z
    )
    check('closed Sunday reported', z.workingHours[0]!.isClosed)

    const demo = await prisma.company.findFirst({ where: { name: 'Demo Sports Club' } })
    const d = (await get<CompanyDetail>(`/companies/${demo!.id}`)).data!
    check('coverPhotoUrl null when a pitch has no photos', d.pitches[0]?.coverPhotoUrl === null)
    check('no reviews: avgRating null, reviewCount 0', d.avgRating === null && d.reviewCount === 0)

    check('pending company → 404', (await get(`/companies/${pending.id}`)).status === 404)
    check('unknown id → 404', (await get('/companies/nope')).status === 404)
    const empty = await get<CompanyDetail>(`/companies/${inactive.id}`)
    check(
      'company with no active pitches → pitches: []',
      empty.status === 200 && empty.data!.pitches.length === 0
    )

    // A review held for moderation must not count.
    const review = await prisma.review.findFirst({
      where: { pitch: { companyId: gheorgheni.id }, moderationStatus: 'APPROVED' },
    })
    await prisma.review.update({ where: { id: review!.id }, data: { moderationStatus: 'PENDING' } })
    const after = (await get<CompanyDetail>(`/companies/${gheorgheni.id}`)).data!
    await prisma.review.update({
      where: { id: review!.id },
      data: { moderationStatus: 'APPROVED' },
    })
    check('PENDING review excluded from the aggregate', after.reviewCount === c.reviewCount - 1, {
      before: c.reviewCount,
      after: after.reviewCount,
    })

    const warm = await get(`/companies/${gheorgheni.id}`)
    check(`response under 100ms (${warm.ms}ms)`, warm.ms < 100)
  }

  step('GET /pitches/:id')
  {
    const r = await get<PitchDetail>(`/pitches/${teren1.id}`)
    const p = r.data!
    check(
      '200, company summary attached',
      r.status === 200 && p.company.id === gheorgheni.id && p.company.isVerified
    )
    check(
      'photos ascending by order',
      p.photos.every((ph, i) => ph.order === i) && p.photos.length >= 3
    )
    const amenities = await prisma.pitchAmenity.count({ where: { pitchId: teren1.id } })
    check('every configured amenity returned', p.amenities.length === amenities && amenities > 0)
    check(
      'shirt inventory when hasShirts',
      p.hasShirts && p.shirtInventory.length === 3 && p.shirtRentalPrice === 10
    )
    const noShirts = (await get<PitchDetail>(`/pitches/${gheorgheni.pitches[1]!.id}`)).data!
    check(
      'hasShirts false → shirtInventory []',
      !noShirts.hasShirts && noShirts.shirtInventory.length === 0
    )
    check('peak hours parsed', p.peakHoursDefinition.length === 2)
    check(
      'recentReviews: max 3, newest first',
      p.recentReviews.length <= 3 &&
        p.recentReviews.every((rv, i, a) => i === 0 || a[i - 1]!.createdAt >= rv.createdAt)
    )
    check(
      'reviewer shown as "First L."',
      p.recentReviews.some(rv => /^\w+ \w\.$/.test(rv.playerName)),
      p.recentReviews.map(rv => rv.playerName)
    )
    check('isBookable for an active pitch', p.isBookable && p.isActive)

    const anon = await prisma.review.findFirst({ where: { isAnonymous: true } })
    const withAnon = (await get<PitchDetail>(`/pitches/${anon!.pitchId}`)).data!
    const a = withAnon.recentReviews.find(rv => rv.id === anon!.id)
    check(
      'anonymous review: "Anonymous player", no avatar',
      !a || (a.playerName === 'Anonymous player' && a.playerAvatarUrl === null),
      a
    )

    const bare = await prisma.review.findFirst({ where: { text: '' } })
    if (bare) {
      const page = (await get<ReviewPage>(`/reviews?pitchId=${bare.pitchId}&limit=50`)).data!
      check(
        'rating-only review → text: null',
        page.reviews.find(rv => rv.id === bare.id)?.text === null
      )
    }

    const z = (await get<PitchDetail>(`/pitches/${zorilor.pitches[0]!.id}`)).data!
    check('pitch avgRating null below 3 reviews', z.avgRating === null && z.reviewCount === 2)

    const off = await get<PitchDetail>(`/pitches/${inactive.pitches[0]!.id}`)
    check(
      'inactive pitch still returned, isBookable false, photos []',
      off.status === 200 && !off.data!.isBookable && off.data!.photos.length === 0
    )
    check(
      'pitch of a pending company → 404',
      (await get(`/pitches/${pending.pitches[0]!.id}`)).status === 404
    )

    // Swapping photo order must reorder the response.
    const [first, second] = await prisma.pitchPhoto.findMany({
      where: { pitchId: teren1.id },
      orderBy: { order: 'asc' },
      take: 2,
    })
    await prisma.pitchPhoto.update({ where: { id: first!.id }, data: { order: 1 } })
    await prisma.pitchPhoto.update({ where: { id: second!.id }, data: { order: 0 } })
    const swapped = (await get<PitchDetail>(`/pitches/${teren1.id}`)).data!
    await prisma.pitchPhoto.update({ where: { id: first!.id }, data: { order: 0 } })
    await prisma.pitchPhoto.update({ where: { id: second!.id }, data: { order: 1 } })
    check(
      'swapping photo order in the DB reorders the response',
      swapped.photos[0]!.id === second!.id
    )
  }

  step('GET /pitches/:id/availability')
  {
    const today = venueClock(new Date()).date
    const tomorrow = addDays(today, 1)
    const path = (id: string, date?: string) =>
      `/pitches/${id}/availability${date ? `?date=${date}` : ''}`

    check('date missing → 400', (await get(path(teren1.id))).status === 400)
    check('bad format → 400', (await get(path(teren1.id, '14-10-2026'))).status === 400)
    check('impossible date → 400', (await get(path(teren1.id, '2026-02-31'))).status === 400)
    const past = await get(path(teren1.id, addDays(today, -1)))
    check(
      'past date → 400 "Cannot check availability for past dates"',
      past.status === 400 && past.error?.message === 'Cannot check availability for past dates'
    )
    const far = await get(path(teren1.id, addDays(today, 61)))
    check(
      'beyond advanceBookingDays (60) → 400',
      far.status === 400 && far.error?.message === 'Date beyond advance booking limit'
    )
    check(
      'pending company → 404',
      (await get(path(pending.pitches[0]!.id, tomorrow))).status === 404
    )

    const r = await get<PitchAvailability>(path(teren1.id, tomorrow))
    const a = r.data!
    const status = (t: string) => a.slots.find(s => s.time === t)?.status
    check(
      '08:00–23:00 → 30 slots, closeTime excluded',
      a.slots.length === 30 && a.slots[0]!.time === '08:00' && a.slots.at(-1)!.time === '22:30',
      a.slots.length
    )
    check(
      '18:00–20:00 booking marks 18:00…19:30',
      ['18:00', '18:30', '19:00', '19:30'].every(t => status(t) === 'booked')
    )
    check(
      'booking ending 20:00 leaves 20:00 free',
      status('20:00') === 'available' && status('17:30') === 'available'
    )
    check('CANCELLED booking does not block (10:00)', status('10:00') === 'available')
    check(
      'Cache-Control: public, max-age=60',
      r.headers.get('cache-control') === 'public, max-age=60'
    )

    const full = (await get<PitchAvailability>(path(teren1.id, addDays(today, 2)))).data!
    check(
      'fully booked day → every slot booked',
      !full.isClosed && full.slots.length > 0 && full.slots.every(s => s.status === 'booked')
    )
    const exception = (await get<PitchAvailability>(path(teren1.id, addDays(today, 3)))).data!
    check('exception date → isClosed, no slots', exception.isClosed && exception.slots.length === 0)

    let sunday = tomorrow
    while (dayOfWeek(sunday) !== 0) sunday = addDays(sunday, 1)
    const closedDay = (await get<PitchAvailability>(path(zorilor.pitches[0]!.id, sunday))).data!
    check('closed weekday → isClosed', closedDay.isClosed && closedDay.slots.length === 0)

    const night = (await get<PitchAvailability>(path(iris.pitches[0]!.id, tomorrow))).data!
    check(
      '16:00–02:00 venue: 00:00–01:30 tail + 16:00–23:30, closes 24:00',
      night.slots[0]!.time === '00:00' &&
        night.slots.some(s => s.time === '01:30') &&
        !night.slots.some(s => s.time === '02:00') &&
        night.slots.at(-1)!.time === '23:30' &&
        night.closeTime === '24:00',
      { first: night.slots[0], last: night.slots.at(-1), closeTime: night.closeTime }
    )
    const allDay = (await get<PitchAvailability>(path(futsal.pitches[0]!.id, tomorrow))).data!
    check('round-the-clock venue → 48 slots', allDay.slots.length === 48)

    const now = (await get<PitchAvailability>(path(futsal.pitches[0]!.id, today))).data!
    const clock = venueClock(new Date())
    const started = now.slots.filter(
      s => Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) <= clock.minutes
    )
    check(
      'earlier slots today are "past" or "booked", never available',
      started.length > 0 && started.every(s => s.status !== 'available')
    )

    const inactiveAvail = (await get<PitchAvailability>(path(inactive.pitches[0]!.id, tomorrow)))
      .data!
    check('inactive pitch → isClosed', inactiveAvail.isClosed)
  }

  step('GET /reviews')
  {
    const p1 = (await get<ReviewPage>(`/reviews?companyId=${arena.id}&limit=10`)).data!
    const p2 = (await get<ReviewPage>(`/reviews?companyId=${arena.id}&limit=10&page=2`)).data!
    check(
      'company: 14 reviews over two pages',
      p1.total === 14 &&
        p1.reviews.length === 10 &&
        p1.hasMore &&
        p2.reviews.length === 4 &&
        !p2.hasMore,
      { total: p1.total }
    )
    check(
      'no review on both pages',
      new Set([...p1.reviews, ...p2.reviews].map(r => r.id)).size === 14
    )
    check(
      'newest first across pages',
      [...p1.reviews, ...p2.reviews].every(
        (r, i, all) => i === 0 || all[i - 1]!.createdAt >= r.createdAt
      )
    )
    check(
      'distribution adds up to total',
      Object.values(p1.distribution).reduce((s, n) => s + n, 0) === p1.total
    )
    check(
      'rating matches the company detail',
      p1.avgRating === (await get<CompanyDetail>(`/companies/${arena.id}`)).data!.avgRating
    )
    check(
      'manager reply carried',
      p1.reviews.some(r => r.managerReply) || p2.reviews.some(r => r.managerReply)
    )

    const byPitch = (await get<ReviewPage>(`/reviews?pitchId=${arena.pitches[0]!.id}`)).data!
    check(
      'pitchId filter',
      byPitch.reviews.every(r => r.pitchId === arena.pitches[0]!.id) && byPitch.total > 0
    )
    check('neither id → 400', (await get('/reviews')).status === 400)
    check('pending company → 404', (await get(`/reviews?companyId=${pending.id}`)).status === 404)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exitCode = fail ? 1 : 0
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
