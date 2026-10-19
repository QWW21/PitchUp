/**
 * E02 auth screens — onboarding, login, both registration steps, email
 * verification, forgot password and Google sign-in. Each screen is rendered on its own with
 * a fake navigator and a mocked authApi, so what is checked is the screen's
 * own behaviour: validation, the call it makes, the message a player reads
 * and where it navigates.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { FlatList } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import * as authApi from '../../lib/authApi'
import { ApiError } from '../../lib/apiClient'
import { useAuthStore } from '../../stores/authStore'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'
import { LoginScreen } from './LoginScreen'
import { ONBOARDING_SEEN_KEY, OnboardingScreen } from './OnboardingScreen'
import { RegisterStep1Screen } from './RegisterStep1Screen'
import { RegisterStep2Screen } from './RegisterStep2Screen'
import { SocialLoginScreen } from './SocialLoginScreen'
import { VerifyEmailScreen } from './VerifyEmailScreen'

jest.mock('../../lib/authApi')
const api = jest.mocked(authApi)

/** The navigation calls a screen can make, recorded. */
function makeNav() {
  return { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }
}
type Nav = ReturnType<typeof makeNav>
type FakeProps = { navigation: Nav; route: { key: string; name: string; params?: object } }

/** Renders a screen with the fake navigator and route params. */
function show(Screen: unknown, navigation: Nav, params?: object) {
  // Screens are typed against the real navigator; the fake only has what they call.
  const S = Screen as React.ComponentType<FakeProps>
  return render(<S navigation={navigation} route={{ key: 'test', name: 'test', params }} />)
}

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text)
const press = (label: string | RegExp) => fireEvent.press(screen.getByText(label))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Onboarding (E02-01)', () => {
  it('shows the three slides with Next and Skip', () => {
    show(OnboardingScreen, makeNav())
    expect(screen.getByText('Find pitches near you')).toBeOnTheScreen()
    expect(screen.getByText('Book in seconds')).toBeOnTheScreen()
    expect(screen.getByText('Play with your team')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeOnTheScreen()
  })

  it('Skip remembers that onboarding was seen and goes to login', async () => {
    const nav = makeNav()
    show(OnboardingScreen, nav)
    press('Skip')
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('Login'))
    expect(await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1')
  })

  // Regression: on Android the slide list crashed Fabric when it unmounted
  // ("Cannot remove child at index 8"). Both props are what stop it; a test
  // cannot reproduce the native crash, so it guards the props instead.
  it('keeps every slide mounted as its own native view', () => {
    show(OnboardingScreen, makeNav())
    const list = screen.UNSAFE_getByType(FlatList)
    expect(list.props.removeClippedSubviews).toBe(false)
    // Each title Text sits in the slide View, which must survive view flattening.
    for (const title of screen.getAllByText(/pitches near you|Book in seconds|with your team/)) {
      expect(title.parent?.parent?.props.collapsable).toBe(false)
    }
  })
})

describe('Login (E02-05)', () => {
  const user = { id: 'u1', email: 'ion@example.ro', name: 'Ion Popescu', role: 'PLAYER' }

  beforeEach(() => {
    useAuthStore.setState({ status: 'unauthenticated', user: null })
  })

  it('asks for both fields before calling the API', () => {
    show(LoginScreen, makeNav())
    press('Sign in')
    expect(screen.getByText('Email and password are required.')).toBeOnTheScreen()
    expect(api.login).not.toHaveBeenCalled()
  })

  it('signs in with a trimmed, lower-cased email and stores the user', async () => {
    api.login.mockResolvedValue(user as never)
    show(LoginScreen, makeNav())
    type('Email', '  Ion@Example.RO ')
    type('Password', 'Parola123')
    press('Sign in')
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))
    expect(api.login).toHaveBeenCalledWith({ email: 'ion@example.ro', password: 'Parola123' })
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it.each([
    ['a wrong password', new ApiError('UNAUTHORIZED', 'x'), 'Incorrect email or password.'],
    [
      'rate limiting',
      new ApiError('RATE_LIMITED', 'x'),
      'Too many attempts. Try again in a few minutes.',
    ],
    [
      'no connection',
      new Error('Network Error'),
      'Could not connect. Check your internet and try again.',
    ],
  ])('explains %s and stays signed out', async (_label, failure, message) => {
    api.login.mockRejectedValue(failure)
    show(LoginScreen, makeNav())
    type('Email', 'ion@example.ro')
    type('Password', 'Wrong1234')
    press('Sign in')
    expect(await screen.findByText(message)).toBeOnTheScreen()
    expect(useAuthStore.getState().status).toBe('unauthenticated')
    // The button is usable again: no endless spinner.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('Show reveals the password', () => {
    show(LoginScreen, makeNav())
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true)
    press('Show')
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false)
    expect(screen.getByText('Hide')).toBeOnTheScreen()
  })

  it('links to forgot password and registration', () => {
    const nav = makeNav()
    show(LoginScreen, nav)
    press('Forgot password?')
    press('Sign up')
    expect(nav.push.mock.calls).toEqual([['ForgotPassword'], ['Register1']])
  })
})

describe('Google sign-in (E02-07)', () => {
  const user = { id: 'u1', email: 'ana@example.ro', name: 'Ana Pop', role: 'PLAYER' }
  const signIn = jest.mocked(GoogleSignin.signIn)

  beforeEach(() => {
    useAuthStore.setState({ status: 'unauthenticated', user: null })
  })

  it('signs a known Google account straight in', async () => {
    api.googleSignIn.mockResolvedValue({ status: 'SIGNED_IN', user } as never)
    show(LoginScreen, makeNav())
    press('Continue with Google')
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))
    expect(api.googleSignIn).toHaveBeenCalledWith({ idToken: 'google-id-token-0001' })
  })

  it('sends a new address on to finish signing up', async () => {
    api.googleSignIn.mockResolvedValue({
      status: 'PROFILE_NEEDED',
      email: 'ana@example.ro',
      name: 'Ana Pop',
    })
    const nav = makeNav()
    show(LoginScreen, nav)
    press('Continue with Google')
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith('SocialLogin', {
        idToken: 'google-id-token-0001',
        name: 'Ana Pop',
        email: 'ana@example.ro',
      })
    )
    expect(useAuthStore.getState().status).toBe('unauthenticated')
  })

  it('does nothing when the Google sheet is closed', async () => {
    signIn.mockResolvedValueOnce({ type: 'cancelled', data: null } as never)
    show(LoginScreen, makeNav())
    press('Continue with Google')
    await waitFor(() => expect(signIn).toHaveBeenCalled())
    expect(api.googleSignIn).not.toHaveBeenCalled()
    expect(screen.queryByText(/Google sign-in did not work/)).toBeNull()
  })

  it('explains a refused account', async () => {
    api.googleSignIn.mockRejectedValue(new ApiError('FORBIDDEN', 'x'))
    show(LoginScreen, makeNav())
    press('Continue with Google')
    expect(await screen.findByText('This account is not available.')).toBeOnTheScreen()
  })
})

describe('Google sign-up, last step (E02-07)', () => {
  const params = { idToken: 'google-id-token-0001', name: 'Ana Pop', email: 'ana@example.ro' }

  beforeEach(() => {
    useAuthStore.setState({ status: 'unauthenticated', user: null })
  })

  it('greets the person and asks for what Google does not know', () => {
    show(SocialLoginScreen, makeNav(), params)
    expect(screen.getByText('Almost there, Ana')).toBeOnTheScreen()
    press('Create account')
    expect(screen.getByText('Select your city.')).toBeOnTheScreen()
    expect(screen.getByText('Phone must include country code, e.g. +40712345678')).toBeOnTheScreen()
    expect(api.googleSignIn).not.toHaveBeenCalled()
  })

  it('creates the account with the Google token and signs in', async () => {
    api.googleSignIn.mockResolvedValue({
      status: 'SIGNED_IN',
      user: { id: 'u2', email: 'ana@example.ro', name: 'Ana Pop', role: 'PLAYER' },
    })
    show(SocialLoginScreen, makeNav(), params)
    type('Phone', ' +40711111111 ')
    press('Cluj-Napoca')
    type('Date of birth', '1995-06-15')
    press('Create account')
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))
    expect(api.googleSignIn).toHaveBeenCalledWith({
      idToken: 'google-id-token-0001',
      profile: { phone: '+40711111111', city: 'Cluj-Napoca', dateOfBirth: '1995-06-15' },
    })
  })

  it('explains a phone number that is taken', async () => {
    api.googleSignIn.mockRejectedValue(new ApiError('CONFLICT', 'x'))
    show(SocialLoginScreen, makeNav(), params)
    type('Phone', '+40711111111')
    press('Cluj-Napoca')
    type('Date of birth', '1995-06-15')
    press('Create account')
    expect(
      await screen.findByText(
        'That phone number is already registered. Sign in with your email instead.'
      )
    ).toBeOnTheScreen()
  })
})

describe('Registration step 1 (E02-02)', () => {
  it('flags every missing field and stays on the step', () => {
    const nav = makeNav()
    show(RegisterStep1Screen, nav)
    press('Continue')
    expect(screen.getByText('Full name must be at least 2 characters.')).toBeOnTheScreen()
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen()
    expect(screen.getByText('Enter a phone in E.164 format, e.g. +40712345678.')).toBeOnTheScreen()
    expect(screen.getByText('Select your city.')).toBeOnTheScreen()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('refuses a phone without the country code', () => {
    show(RegisterStep1Screen, makeNav())
    type('Phone', '0712345678')
    press('Continue')
    expect(screen.getByText('Enter a phone in E.164 format, e.g. +40712345678.')).toBeOnTheScreen()
  })

  it('picks a city from the list and carries clean values to step 2', () => {
    const nav = makeNav()
    show(RegisterStep1Screen, nav)
    type('Full name', '  Ion Popescu ')
    type('Email', 'Ion@Example.RO')
    type('Phone', '+40712345678')
    press('Select your city')
    expect(screen.getByText('Select city')).toBeOnTheScreen()
    press('Iași')
    expect(screen.getByText('Iași')).toBeOnTheScreen()
    press('Continue')
    expect(nav.push).toHaveBeenCalledWith('Register2', {
      name: 'Ion Popescu',
      email: 'ion@example.ro',
      phone: '+40712345678',
      city: 'Iași',
    })
  })

  it('links back to login', () => {
    const nav = makeNav()
    show(RegisterStep1Screen, nav)
    press('Sign in')
    expect(nav.navigate).toHaveBeenCalledWith('Login')
  })
})

describe('Registration step 2 (E02-03)', () => {
  const step1 = {
    name: 'Ion Popescu',
    email: 'ion@example.ro',
    phone: '+40712345678',
    city: 'Cluj-Napoca',
  }
  const isoYearsAgo = (years: number, days = 0) => {
    const d = new Date()
    d.setUTCFullYear(d.getUTCFullYear() - years)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const fillValid = () => {
    type('Date of birth', '1995-06-15')
    type('Password', 'Parola123')
    type('Confirm password', 'Parola123')
  }

  it.each([
    ['a date in the wrong format', '15/06/1995', 'Use the format YYYY-MM-DD (e.g. 1995-06-15).'],
    ['someone under 16', isoYearsAgo(16, 1), 'You must be at least 16 years old to register.'],
  ])('rejects %s', (_label, dob, message) => {
    show(RegisterStep2Screen, makeNav(), step1)
    fillValid()
    type('Date of birth', dob)
    press('Create account')
    expect(screen.getByText(message)).toBeOnTheScreen()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('accepts someone who turns 16 today', async () => {
    api.register.mockResolvedValue({ message: 'ok' })
    show(RegisterStep2Screen, makeNav(), step1)
    fillValid()
    type('Date of birth', isoYearsAgo(16))
    press('Create account')
    await waitFor(() => expect(api.register).toHaveBeenCalled())
  })

  it('enforces the password policy and the confirmation', () => {
    show(RegisterStep2Screen, makeNav(), step1)
    type('Date of birth', '1995-06-15')
    type('Password', 'parola123')
    type('Confirm password', 'Parola123')
    press('Create account')
    expect(
      screen.getByText('At least 8 characters, one uppercase letter, one number.')
    ).toBeOnTheScreen()
    expect(screen.getByText('Passwords do not match.')).toBeOnTheScreen()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('creates the account with both steps and moves on to verification', async () => {
    api.register.mockResolvedValue({ message: 'ok' })
    const nav = makeNav()
    show(RegisterStep2Screen, nav, step1)
    fillValid()
    press('Create account')
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('VerifyEmail', { email: 'ion@example.ro' })
    )
    expect(api.register).toHaveBeenCalledWith({
      ...step1,
      password: 'Parola123',
      dateOfBirth: '1995-06-15',
    })
  })

  it.each([
    ['CONFLICT', 'That phone number is already registered. Try logging in instead.'],
    ['RATE_LIMITED', 'Too many attempts. Try again in an hour.'],
    ['INTERNAL_ERROR', 'Could not create your account. Please try again.'],
  ])('explains a %s answer', async (code, message) => {
    api.register.mockRejectedValue(new ApiError(code, 'x'))
    const nav = makeNav()
    show(RegisterStep2Screen, nav, step1)
    fillValid()
    press('Create account')
    expect(await screen.findByText(message)).toBeOnTheScreen()
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('Back returns to step 1', () => {
    const nav = makeNav()
    show(RegisterStep2Screen, nav, step1)
    press('Back')
    expect(nav.goBack).toHaveBeenCalled()
  })
})

describe('Email verification (E02-04)', () => {
  const email = 'ion@example.ro'

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows where the code went and needs all six digits', () => {
    show(VerifyEmailScreen, makeNav(), { email })
    expect(screen.getByText(email)).toBeOnTheScreen()
    type('Verification code', '123')
    press('Verify')
    expect(screen.getByText('Enter the 6-digit code from your email.')).toBeOnTheScreen()
    expect(api.verifyEmail).not.toHaveBeenCalled()
  })

  it('keeps only digits, at most six', () => {
    show(VerifyEmailScreen, makeNav(), { email })
    type('Verification code', '12a3-456789')
    expect(screen.getByLabelText('Verification code')).toHaveProp('value', '123456')
  })

  it('verifies the code and sends the player to login', async () => {
    api.verifyEmail.mockResolvedValue({ verified: true })
    const nav = makeNav()
    show(VerifyEmailScreen, nav, { email })
    type('Verification code', '123456')
    press('Verify')
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('Login'))
    expect(api.verifyEmail).toHaveBeenCalledWith(email, '123456')
  })

  it.each([
    ['VALIDATION_ERROR', 'That code is not correct or has expired.'],
    ['RATE_LIMITED', 'Too many attempts. Request a new code.'],
  ])('explains a %s answer', async (code, message) => {
    api.verifyEmail.mockRejectedValue(new ApiError(code, 'x'))
    show(VerifyEmailScreen, makeNav(), { email })
    type('Verification code', '000000')
    press('Verify')
    expect(await screen.findByText(message)).toBeOnTheScreen()
  })

  it('resends, then waits 60 seconds before offering it again', async () => {
    jest.useFakeTimers()
    api.resendCode.mockResolvedValue({ message: 'ok' })
    show(VerifyEmailScreen, makeNav(), { email })
    press('Resend')
    expect(await screen.findByText('Resend in 60s')).toBeOnTheScreen()
    expect(api.resendCode).toHaveBeenCalledWith(email, 'EMAIL')

    act(() => jest.advanceTimersByTime(59_000))
    expect(screen.getByText('Resend in 1s')).toBeOnTheScreen()
    act(() => jest.advanceTimersByTime(1_000))
    expect(screen.getByText('Resend')).toBeOnTheScreen()
  })

  it('says so when the resend fails', async () => {
    api.resendCode.mockRejectedValue(new Error('down'))
    show(VerifyEmailScreen, makeNav(), { email })
    press('Resend')
    expect(await screen.findByText('Could not resend. Try again shortly.')).toBeOnTheScreen()
    expect(screen.getByText('Resend')).toBeOnTheScreen()
  })
})

describe('Forgot password (E02-06)', () => {
  it('needs a valid email', () => {
    show(ForgotPasswordScreen, makeNav())
    type('Email', 'not-an-email')
    press('Send reset link')
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen()
    expect(api.forgotPassword).not.toHaveBeenCalled()
  })

  it('sends the request and shows the same confirmation for any address', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'ok' })
    const nav = makeNav()
    show(ForgotPasswordScreen, nav)
    type('Email', ' Ion@Example.RO ')
    press('Send reset link')
    expect(await screen.findByText('Check your inbox')).toBeOnTheScreen()
    expect(api.forgotPassword).toHaveBeenCalledWith('ion@example.ro')
    press('Back to login')
    expect(nav.navigate).toHaveBeenCalledWith('Login')
  })

  it('shows the confirmation even when the request fails, so nothing is revealed', async () => {
    api.forgotPassword.mockRejectedValue(new Error('Network Error'))
    show(ForgotPasswordScreen, makeNav())
    type('Email', 'ion@example.ro')
    press('Send reset link')
    expect(await screen.findByText('Check your inbox')).toBeOnTheScreen()
  })

  it('but explains rate limiting, which is the same for everyone', async () => {
    api.forgotPassword.mockRejectedValue(new ApiError('RATE_LIMITED', 'x'))
    show(ForgotPasswordScreen, makeNav())
    type('Email', 'ion@example.ro')
    press('Send reset link')
    expect(
      await screen.findByText('Too many requests. Try again in a few minutes.')
    ).toBeOnTheScreen()
  })
})
