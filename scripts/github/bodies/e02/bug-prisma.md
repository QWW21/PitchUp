## What happened

A fresh clone failed `pnpm typecheck` and `pnpm build` with:

```
Module '@prisma/client' has no exported member 'PrismaClient'
```

The generated Prisma client is not committed, so until `prisma generate` was run by hand there were no types. It only worked on the original machine because generate had run during E01-01.

## Fix

Added a `postinstall` hook so `pnpm install` is enough on its own.

Found by cloning the repo to a temp directory and running the checks there. Fixed in 3951d49.
