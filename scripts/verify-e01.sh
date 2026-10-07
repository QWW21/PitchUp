#!/usr/bin/env bash
# Re-runs every acceptance check for E01-01 … E01-04.
# Usage: bash scripts/verify-e01.sh
#
# Needs: Postgres running, apps/web/.env present, pnpm install done.

set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

pass=0; fail=0
ok()   { echo "  PASS  $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1"; fail=$((fail+1)); }
step() { echo; echo "── $1"; }

step "Postgres reachable"
pg_isready -q && ok "postgres accepting connections" || bad "postgres not running (brew services start postgresql@16)"

step "Schema is in sync with the database"
if (cd apps/web && ./node_modules/.bin/prisma migrate diff \
     --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma \
     --exit-code >/dev/null 2>&1); then
  ok "database matches schema.prisma (no drift)"
else
  bad "database has drifted from schema.prisma — run pnpm db:push"
fi

step "Tables and enums exist"
tables=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchup_dev -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public'" 2>/dev/null)
enums=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchup_dev -tAc \
  "SELECT count(*) FROM pg_type WHERE typtype='e'" 2>/dev/null)
[ "$tables" = "12" ] && ok "12 tables (11 PRD models + City)" || bad "expected 12 tables, found ${tables:-0}"
[ "$enums" = "12" ]  && ok "12 enums"                        || bad "expected 12 enums, found ${enums:-0}"

step "Seed is idempotent"
before=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchup_dev -tAc \
  'SELECT count(*) FROM "City"' 2>/dev/null)
pnpm --filter @pitchup/web db:seed >/dev/null 2>&1
after=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchup_dev -tAc \
  'SELECT count(*) FROM "City"' 2>/dev/null)
[ "$before" = "$after" ] && [ "$after" = "10" ] \
  && ok "city count stable at 10 across runs" \
  || bad "city count changed: $before -> $after"

step "Admin password hashing (PRD §6.6: bcrypt cost 12)"
(cd apps/web && node -e '
const bcrypt=require("bcryptjs");const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
p.user.findUnique({where:{email:"admin@pitchup.ro"}}).then(async u=>{
  const rounds=bcrypt.getRounds(u.passwordHash);
  const good=await bcrypt.compare(process.env.ADMIN_PASSWORD||"Admin1234!",u.passwordHash);
  const badpw=await bcrypt.compare("wrong",u.passwordHash);
  console.log(rounds===12&&good&&!badpw&&u.role==="ADMIN"?"OK":"BAD");
  await p.$disconnect();
}).catch(async()=>{console.log("BAD");await p.$disconnect()})' 2>/dev/null) | grep -q OK \
  && ok "cost 12, correct password verifies, wrong one rejected, role ADMIN" \
  || bad "admin user hash check failed"

step "Prisma client is a singleton (no connection leak on hot-reload)"
cat > apps/web/.verify-singleton.ts <<'TS'
process.env.NODE_ENV = 'development'
;(async () => {
  const a = (await import('./src/lib/prisma')).prisma
  const b = (await import('./src/lib/prisma?v=2')).prisma
  console.log(a === b && (globalThis as any).prisma === a ? 'OK' : 'BAD')
  await a.$disconnect()
})()
TS
(cd apps/web && ./node_modules/.bin/tsx .verify-singleton.ts 2>/dev/null) | grep -q OK \
  && ok "same instance reused across module reloads" \
  || bad "singleton not reused"
rm -f apps/web/.verify-singleton.ts

step "Shared package rules (37 assertions)"
if [ -f scripts/verify-shared.ts ]; then
  (cd packages/shared && ../../apps/web/node_modules/.bin/tsx ../../scripts/verify-shared.ts 2>&1) \
    | tail -40 | sed 's/^/  /'
  echo "  (see PASS/FAIL lines above)"
else
  bad "scripts/verify-shared.ts missing"
fi

step "Environment validation (E01-05)"
cat > apps/web/.verify-env.mjs <<'MJS'
try { await import('./src/lib/env.ts'); console.log('ACCEPTED') }
catch { console.log('REJECTED') }
MJS
envcase() { # label, expected, env assignments...
  local label="$1" want="$2"; shift 2
  local got
  got=$(cd apps/web && env -i PATH="$PATH" HOME="$HOME" "$@" \
    ./node_modules/.bin/tsx --no-warnings .verify-env.mjs 2>/dev/null | tail -1)
  [ "$got" = "$want" ] && ok "$label" || bad "$label (got $got, want $want)"
}
DB='DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchup_dev?schema=public'
SEC="NEXTAUTH_SECRET=$(printf 'x%.0s' {1..32})"
URL='NEXT_PUBLIC_APP_URL=http://localhost:3000'
envcase "valid env accepted"            ACCEPTED "$DB" "$SEC" "$URL"
envcase "missing DATABASE_URL rejected" REJECTED        "$SEC" "$URL"
envcase "malformed DATABASE_URL rejected" REJECTED 'DATABASE_URL=nope' "$SEC" "$URL"
envcase "short NEXTAUTH_SECRET rejected" REJECTED "$DB" 'NEXTAUTH_SECRET=short' "$URL"
envcase "empty NEXTAUTH_SECRET rejected" REJECTED "$DB" 'NEXTAUTH_SECRET=' "$URL"
envcase "bad STRIPE prefix rejected"    REJECTED "$DB" "$SEC" "$URL" 'STRIPE_SECRET_KEY=pk_x'
envcase "bad TWILIO phone rejected"     REJECTED "$DB" "$SEC" "$URL" 'TWILIO_PHONE_NUMBER=07123'
rm -f apps/web/.verify-env.mjs

step "Server secrets stay out of the client bundle"
if [ -d apps/web/.next/static ]; then
  secret=$(grep '^NEXTAUTH_SECRET' apps/web/.env 2>/dev/null | cut -d= -f2- | tr -d '"')
  leaked=0
  [ -n "$secret" ] && grep -rqF "$secret" apps/web/.next/static 2>/dev/null && leaked=1
  grep -rqF 'pitchup_dev' apps/web/.next/static 2>/dev/null && leaked=1
  [ "$leaked" -eq 0 ] && ok "no server secret found in .next/static" || bad "a server secret reached the client bundle"
else
  echo "  SKIP  no build output (run: pnpm --filter @pitchup/web build)"
fi

step "Typecheck — all three packages"
pnpm typecheck >/dev/null 2>&1 && ok "web, mobile and shared compile" || bad "typecheck failed (run: pnpm typecheck)"

step "Secrets are not committed"
git log --all --name-only --pretty=format: | grep -qx 'apps/web/.env' \
  && bad "apps/web/.env appears in git history" \
  || ok "apps/web/.env never committed"

echo
echo "────────────────────────────────"
echo "  $pass passed, $fail failed"
echo "────────────────────────────────"
[ "$fail" -eq 0 ]
