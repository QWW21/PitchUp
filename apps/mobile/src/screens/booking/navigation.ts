import type { NativeStackScreenProps } from '@react-navigation/native-stack'

/** The five booking steps — E05-01. */
export type BookingStackParamList = {
  BookingDate: undefined
  BookingTime: undefined
  BookingTeams: undefined
  BookingSummary: undefined
  BookingConfirmation: { bookingId: string }
}

export type BookingScreenProps<T extends keyof BookingStackParamList> = NativeStackScreenProps<
  BookingStackParamList,
  T
>
