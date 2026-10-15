/** The player's photo, or their initials on a tinted circle. */
export function Avatar({
  name,
  url,
  size = 80,
}: {
  name: string
  url: string | null
  size?: number
}) {
  if (url) {
    return (
      // A plain img: next/image would need every Cloudinary account allow-listed.
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  const parts = name.trim().split(/\s+/)
  const initials = `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts.at(-1)![0] : ''}`.toUpperCase()
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-semibold text-primary-700"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </span>
  )
}
