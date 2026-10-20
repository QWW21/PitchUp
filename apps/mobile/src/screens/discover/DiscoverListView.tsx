/**
 * Discover list — E03-04, E03-05.
 */
import React from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import type { CompanyListItem } from '@pitchup/shared'
import { CompanyCard } from '../../components/discover/CompanyCard'
import { CompanyCardSkeleton } from '../../components/discover/CompanyCardSkeleton'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { colors } from '../../theme/tokens'
import { useT } from '../../i18n'

interface DiscoverListViewProps {
  companies: CompanyListItem[]
  city: string
  isLoading: boolean
  isError: boolean
  isRefreshing: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onRefresh: () => void
  onEndReached: () => void
  onClearFilters: () => void
  onOpenCompany: (company: CompanyListItem) => void
}

export function DiscoverListView({
  companies,
  city,
  isLoading,
  isError,
  isRefreshing,
  isFetchingNextPage,
  hasNextPage,
  onRefresh,
  onEndReached,
  onClearFilters,
  onOpenCompany,
}: DiscoverListViewProps) {
  const t = useT()
  if (isLoading) {
    return (
      <View style={styles.content}>
        {[0, 1, 2, 3].map(i => (
          <CompanyCardSkeleton key={i} />
        ))}
      </View>
    )
  }

  return (
    <FlatList
      data={companies}
      keyExtractor={item => item.id}
      contentContainerStyle={[styles.content, companies.length === 0 && styles.grow]}
      renderItem={({ item }) => <CompanyCard company={item} onPress={() => onOpenCompany(item)} />}
      onEndReached={() => hasNextPage && !isFetchingNextPage && onEndReached()}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary[600]}
          colors={[colors.primary[600]]}
        />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} color={colors.primary[600]} />
        ) : null
      }
      ListEmptyComponent={
        isError ? (
          <ErrorState onRetry={onRefresh} />
        ) : (
          <EmptyState
            illustration={<Icon name="magnify-close" size={64} color={colors.neutral[300]} />}
            title={t('discover.home.noneIn', { city })}
            description={t('discover.home.tryChanging')}
            ctaLabel={t('discover.home.clearFilters')}
            onCta={onClearFilters}
          />
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  grow: { flexGrow: 1 },
  footer: { paddingVertical: 16 },
})
