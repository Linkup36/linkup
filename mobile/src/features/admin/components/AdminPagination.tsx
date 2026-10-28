import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  label?: string;
}

export function AdminPagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  label = 'records',
}: AdminPaginationProps) {
  // If there are no items or pages, don't show pagination
  if (totalPages <= 0 || (totalItems !== undefined && totalItems === 0)) {
    return null;
  }

  const handlePrev = () => {
    if (currentPage > 1) {
      Haptics.selectionAsync();
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      Haptics.selectionAsync();
      onPageChange(currentPage + 1);
    }
  };

  return (
    <View style={styles.container}>
      {/* Prev Button */}
      <TouchableOpacity
        style={[styles.btn, currentPage <= 1 && styles.btnDisabled]}
        onPress={handlePrev}
        disabled={currentPage <= 1}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <ChevronLeft size={16} color={currentPage <= 1 ? '#CBD5E1' : '#334155'} strokeWidth={2.4} />
        <Text style={[styles.btnText, currentPage <= 1 && styles.btnTextDisabled]}>Prev</Text>
      </TouchableOpacity>

      {/* Page Info */}
      <View style={styles.infoBox}>
        <Text style={styles.pageText}>
          Page <Text style={styles.pageNumber}>{currentPage}</Text> of{' '}
          <Text style={styles.pageNumber}>{totalPages}</Text>
        </Text>
        {totalItems !== undefined && (
          <Text style={styles.totalText}>
            {totalItems} total {label}
          </Text>
        )}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.btn, currentPage >= totalPages && styles.btnDisabled]}
        onPress={handleNext}
        disabled={currentPage >= totalPages}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <Text style={[styles.btnText, currentPage >= totalPages && styles.btnTextDisabled]}>Next</Text>
        <ChevronRight size={16} color={currentPage >= totalPages ? '#CBD5E1' : '#334155'} strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  btnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
    opacity: 0.5,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  btnTextDisabled: {
    color: '#94A3B8',
  },
  infoBox: {
    alignItems: 'center',
  },
  pageText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  pageNumber: {
    fontWeight: '800',
    color: '#0F172A',
  },
  totalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  singlePageWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  singlePageText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
