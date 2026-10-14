Found at the start of E03; fixed in d276ee4.

**Symptom:** `pnpm install` on a fresh clone fails off the corporate network with `ENOTFOUND artifactory.bcr.wan` for `yaml`, `sharp`, `@next/swc-win32-x64-msvc`, `@esbuild/win32-x64`, `@turbo/windows-64` and others.

**Cause:** 70 entries in `pnpm-lock.yaml` carried an explicit `tarball:` URL on the corporate Artifactory mirror. pnpm only records a tarball URL when it differs from the default registry, and a pinned URL is used regardless of the configured registry, so the lockfile could only be installed from inside that network.

**Fix:** removed those `tarball:` fields. pnpm now derives the URL from whatever registry is configured — npmjs by default, the mirror for anyone whose `.npmrc` points at it. The `integrity` hashes are unchanged, so the exact same package contents are installed.

**To avoid a repeat:** anyone installing new packages through the mirror should check the lockfile diff for `artifactory` before committing.
