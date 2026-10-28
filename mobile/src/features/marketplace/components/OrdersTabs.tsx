import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ShoppingBag, MessageSquare } from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import { Button } from '../../../components/ui/Button';
import { OrderCard } from './OrderCard';
import { ReportCard } from './ReportCard';
import * as Haptics from 'expo-haptics';

interface OrdersTabsProps {
  orders: any[];
  filteredOrders: any[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  counts: {
    toShip: number;
    toReceive: number;
    completed: number;
    cancelled: number;
    reports: number;
  };
  userIssues: any[];
  onBrowseMarketplace?: () => void;
}

export function OrdersTabs({
  orders,
  filteredOrders,
  activeTab,
  setActiveTab,
  counts,
  userIssues,
  onBrowseMarketplace,
}: OrdersTabsProps) {
  const tabs = [
    { value: 'all', label: 'All', count: orders.length },
    { value: 'to-ship', label: 'To Ship', count: counts.toShip },
    { value: 'to-receive', label: 'To Receive', count: counts.toReceive },
    { value: 'completed', label: 'Completed', count: counts.completed },
    { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { value: 'my-reports', label: 'My Reports', count: counts.reports },
  ];

  return (
    <View style={styles.container}>
      {/* Sticky Tab Bar */}
      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab.value);
                }}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 ? (
                  <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                    <Text
                      style={[
                        styles.countText,
                        isActive && styles.countTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders or Reports List */}
      <View style={styles.contentList}>
        {filteredOrders.length === 0 && activeTab !== 'my-reports' ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <ShoppingBag size={32} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySubtitle}>
              You have no orders under this filter. Browse our marketplace to find great products.
            </Text>
            {onBrowseMarketplace && (
              <Button
                title="Browse Marketplace"
                onPress={onBrowseMarketplace}
                style={{ marginTop: 14 }}
              />
            )}
          </View>
        ) : activeTab === 'my-reports' ? (
          userIssues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MessageSquare size={32} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Clear Judicial Record</Text>
              <Text style={styles.emptySubtitle}>
                You have no active reports or financial disputes in the registry.
              </Text>
            </View>
          ) : (
            userIssues.map((issue) => (
              <ReportCard key={issue.id} issue={issue} />
            ))
          )
        ) : (
          filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarWrap: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 4,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  countBadgeActive: {
    backgroundColor: colors.primaryLight,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  countTextActive: {
    color: colors.primary,
  },
  contentList: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
});
