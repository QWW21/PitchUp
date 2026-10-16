/**
 * The pitch editor's data, read once per request: the layout and the tab
 * page both ask for it.
 */
import 'server-only'
import { cache } from 'react'
import { getManagerPitch } from './pitches'

export const loadPitchForEditor = cache(getManagerPitch)
