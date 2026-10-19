/**
 * Google sign-in on the phone — E02-07. Google's sheet picks the account
 * and hands back an ID token for our Web client; the server checks it and
 * answers with our own session (authApi.googleSignIn).
 */
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config'

let configured = false

/**
 * An ID token for the account the person picks, or null if they closed the
 * sheet. Throws when Google can't be reached or Play services are missing.
 */
export async function googleIdToken(): Promise<string | null> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID })
    configured = true
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return null
    // Only the token is needed; forgetting Google's own session lets the
    // next tap offer the account picker again.
    await GoogleSignin.signOut().catch(() => undefined)
    return response.data.idToken
  } catch (caught) {
    if (isErrorWithCode(caught) && caught.code === statusCodes.IN_PROGRESS) return null
    throw caught
  }
}
