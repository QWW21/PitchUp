/** The five booking steps and their URLs — shared by server and client code. */
export const STEPS = ['date', 'time', 'teams', 'summary', 'confirmation'] as const
export type Step = (typeof STEPS)[number]

export const stepPath = (pitchId: string, step: Step) => `/book/${pitchId}/${step}`
