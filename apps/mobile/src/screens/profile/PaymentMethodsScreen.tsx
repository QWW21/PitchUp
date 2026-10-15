/**
 * Payment methods — E08-07 (UIUX_SPEC §10.3). Saved cards, Remove (after a
 * confirmation; the card goes at once and comes back if the server says
 * no), and Add new card with Stripe's card field, saved through a
 * SetupIntent. In test mode there are no cards to save and the screen says so.
 *
 * Deviations, agreed with the owner (no new native modules): a Remove button
 * instead of swipe-to-delete (react-native-gesture-handler), and the brand as
 * text and an icon instead of logo images.
 */
import React, { useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { CardField, StripeProvider, useStripe } from '@stripe/stripe-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SavedCard } from '@pitchup/shared'
import type { AppStackParamList } from '../../../App'
import { bookingApi } from '../../lib/bookingApi'
import { profileApi } from '../../lib/profileApi'
import { ApiError } from '../../lib/apiClient'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { useToast } from '../../components/common/Toast'
import { colors, spacing } from '../../theme/tokens'

type Props = NativeStackScreenProps<AppStackParamList, 'PaymentMethods'>

export const CARDS_KEY = ['paymentMethods'] as const

const brandName = (b: string) => b.charAt(0).toUpperCase() + b.slice(1)
const brandIcon = (b: string) =>
  b === 'visa' ? 'credit-card' : b === 'mastercard' ? 'credit-card-chip' : 'credit-card-outline'

export function PaymentMethodsScreen(props: Props) {
  const config = useQuery({ queryKey: ['payment-config'], queryFn: bookingApi.paymentConfig })
  const key = config.data?.provider === 'stripe' ? config.data.publishableKey : null
  // The Stripe SDK is only needed (and only set up) when Stripe is the provider.
  return key ? (
    <StripeProvider publishableKey={key}>
      <Cards {...props} canAdd />
    </StripeProvider>
  ) : (
    <Cards {...props} canAdd={false} />
  )
}

function Cards({ navigation, canAdd }: Props & { canAdd: boolean }) {
  const queryClient = useQueryClient()
  const cards = useQuery({ queryKey: CARDS_KEY, queryFn: profileApi.cards })
  const [adding, setAdding] = useState(false)
  const { show, toast } = useToast(32)

  const remove = useMutation({
    mutationFn: (id: string) => profileApi.removeCard(id),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: CARDS_KEY })
      const before = queryClient.getQueryData<SavedCard[]>(CARDS_KEY)
      queryClient.setQueryData<SavedCard[]>(CARDS_KEY, list => list?.filter(c => c.id !== id))
      return { before }
    },
    onError: (e, _id, context) => {
      queryClient.setQueryData(CARDS_KEY, context?.before)
      show(e instanceof ApiError ? e.message : 'Could not remove the card. Try again.')
    },
    onSuccess: () => show('Card removed'),
  })

  const confirmRemove = (card: SavedCard) =>
    Alert.alert('Remove this card?', `${brandName(card.brand)} ending ${card.last4}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(card.id) },
    ])

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevron-left" size={26} color={colors.neutral[900]} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Payment methods
        </Text>
      </View>
      {!canAdd ? (
        <Text style={styles.note}>
          Saving cards needs Stripe, which isn&apos;t set up yet. Bookings use test payments for
          now.
        </Text>
      ) : null}
      {cards.isError ? (
        <ErrorState onRetry={() => cards.refetch()} />
      ) : cards.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.primary[600]} />
      ) : (
        <FlatList
          data={cards.data}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              illustration={
                <Icon name="credit-card-off-outline" size={48} color={colors.neutral[300]} />
              }
              title="No saved cards"
              description="Add a card to book faster"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Icon name={brandIcon(item.brand)} size={26} color={colors.neutral[700]} />
              <View style={styles.flex}>
                <Text style={styles.card}>
                  {brandName(item.brand)} ···· {item.last4}
                </Text>
                <Text style={styles.muted}>
                  Expires {String(item.expMonth).padStart(2, '0')}/{String(item.expYear).slice(-2)}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmRemove(item)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${brandName(item.brand)} ending ${item.last4}`}
                style={styles.remove}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={
            canAdd ? (
              adding ? (
                <AddCard
                  onDone={() => {
                    setAdding(false)
                    show('Card saved')
                    void queryClient.invalidateQueries({ queryKey: CARDS_KEY })
                  }}
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <Pressable
                  onPress={() => setAdding(true)}
                  style={styles.add}
                  accessibilityRole="button"
                >
                  <Icon name="plus" size={20} color={colors.primary[600]} />
                  <Text style={styles.addText}>Add new card</Text>
                </Pressable>
              )
            ) : null
          }
        />
      )}
      {toast}
    </SafeAreaView>
  )
}

function AddCard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { confirmSetupIntent } = useStripe()
  const [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const { clientSecret } = await profileApi.setupIntent()
      const result = await confirmSetupIntent(clientSecret, { paymentMethodType: 'Card' })
      if (result.error) throw new Error(result.error.message)
      onDone()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The card could not be saved')
    }
    setBusy(false)
  }

  return (
    <View style={styles.addCard}>
      <CardField
        postalCodeEnabled={false}
        style={styles.cardField}
        onCardChange={c => setComplete(c.complete)}
        accessibilityLabel="Card details"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save card" onPress={() => void save()} disabled={!complete} loading={busy} />
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral[0] },
  loading: { marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: spacing.xs },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.neutral[900] },
  note: {
    marginHorizontal: spacing.md,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    fontSize: 14,
    color: colors.neutral[700],
  },
  list: { flexGrow: 1, paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  flex: { flex: 1 },
  card: { fontSize: 15, color: colors.neutral[900] },
  muted: { fontSize: 13, color: colors.neutral[500] },
  remove: { paddingVertical: 8, paddingHorizontal: 4 },
  removeText: { fontSize: 14, fontWeight: '500', color: colors.error[500] },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  addText: { fontSize: 15, fontWeight: '600', color: colors.primary[600] },
  addCard: { padding: spacing.md, gap: spacing.sm },
  cardField: { height: 50 },
  error: { fontSize: 13, color: colors.error[600] },
})
