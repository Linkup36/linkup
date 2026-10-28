import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import {
  Users,
  Search,
  ShieldCheck,
  Store,
  Truck,
  TrendingUp,
  ShoppingBag,
  Trash2,
  CheckCircle2,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 6;

export function AdminUsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map((u) => u.id);
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        const rolesMap = new Map<string, string[]>();
        rolesData?.forEach((r: any) => {
          if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
          rolesMap.get(r.user_id)!.push(r.role);
        });

        data.forEach((u: any) => {
          u.roles = rolesMap.get(u.id) || [];
          if (!u.roles.includes('buyer')) {
            u.roles.push('buyer');
          }
        });
      }

      setUsers(data || []);
    } catch (err: any) {
      console.warn('[AdminUsersTab] Fetch error:', err);
      toast.error('Failed to load users', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleRole = async (targetRole: string) => {
    if (!selectedUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const hasRole = selectedUser.roles.includes(targetRole);
    setUpdatingRole(true);
    try {
      if (hasRole) {
        if (targetRole === 'buyer') {
          toast.warning('Default Role', { description: 'All users retain buyer status.' });
          setUpdatingRole(false);
          return;
        }

        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.id)
          .eq('role', targetRole);

        if (error) throw error;

        const nextRoles = selectedUser.roles.filter((r: string) => r !== targetRole);
        setSelectedUser({ ...selectedUser, roles: nextRoles });
        setUsers((prev) =>
          prev.map((u) => (u.id === selectedUser.id ? { ...u, roles: nextRoles } : u))
        );
        toast.success(`Removed ${targetRole} role`);
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: selectedUser.id, role: targetRole });

        if (error) throw error;

        const nextRoles = [...selectedUser.roles, targetRole];
        setSelectedUser({ ...selectedUser, roles: nextRoles });
        setUsers((prev) =>
          prev.map((u) => (u.id === selectedUser.id ? { ...u, roles: nextRoles } : u))
        );
        toast.success(`Granted ${targetRole} role`);
      }
    } catch (err: any) {
      toast.error('Role Update Failed', { description: err.message });
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Member',
      'Are you sure you want to delete this user account? This action cannot be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await (supabase as any).rpc('delete_user_admin', {
                target_user_id: userId,
              });
              if (error) throw error;

              toast.success('Member removed successfully');
              setSelectedUser(null);
              fetchUsers();
            } catch (err: any) {
              toast.error('Deletion Failed', { description: err.message });
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q);

    const matchesRole =
      roleFilter === 'all' ||
      (u.roles && u.roles.includes(roleFilter)) ||
      u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
      case 'seller':
        return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
      case 'logistics':
      case 'driver':
        return { text: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' };
      case 'promoter':
        return { text: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' };
      default:
        return { text: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
    }
  };

  const roles = [
    { key: 'all', label: 'All Users' },
    { key: 'admin', label: 'Admins' },
    { key: 'seller', label: 'Merchants' },
    { key: 'logistics', label: 'Couriers' },
    { key: 'promoter', label: 'Promoters' },
  ];

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchBar}>
        <Search size={16} color="#94A3B8" />
        <TextInput
          placeholder="Search by name, phone, or user ID..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Role Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {roles.map((r) => {
          const active = roleFilter === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleChip, active && styles.roleChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setRoleFilter(r.key);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* User Cards List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading platform accounts...</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyState}>
          <Users size={42} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No members found</Text>
          <Text style={styles.emptyDesc}>Try matching with a different name or role</Text>
        </View>
      ) : (
        <View style={styles.usersList}>
          {paginatedUsers.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.userCard}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedUser(u);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.userAvatar}>
                {u.avatar_url ? (
                  <Image source={{ uri: u.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>
                    {(u.display_name || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>

              <View style={styles.userInfo}>
                <View style={styles.userTopRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {u.display_name || 'Anonymous User'}
                  </Text>
                  <Text style={styles.userJoined}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </Text>
                </View>

                {u.phone && <Text style={styles.userPhone}>{u.phone}</Text>}

                {/* Role Badges */}
                <View style={styles.rolesRow}>
                  {(u.roles || []).map((role: string, idx: number) => {
                    const badge = getRoleBadge(role);
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.roleBadge,
                          { backgroundColor: badge.bg, borderColor: badge.border },
                        ]}
                      >
                        <Text style={[styles.roleBadgeText, { color: badge.text }]}>
                          {role.toUpperCase()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredUsers.length}
            label="members"
            onPageChange={setCurrentPage}
          />
        </View>
      )}

      {/* Role Assigner & Member Detail Modal */}
      <AppModal
        visible={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        title="Member Management"
      >
        {selectedUser && (
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* User Profile Card */}
            <View style={styles.profileHeaderCard}>
              <View style={styles.modalAvatar}>
                {selectedUser.avatar_url ? (
                  <Image source={{ uri: selectedUser.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.modalAvatarLetter}>
                    {(selectedUser.display_name || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalUserName}>
                  {selectedUser.display_name || 'Unnamed User'}
                </Text>
                <Text style={styles.modalUserId}>ID: {selectedUser.id}</Text>
                {selectedUser.phone && (
                  <Text style={styles.modalUserPhone}>{selectedUser.phone}</Text>
                )}
              </View>
            </View>

            {/* Role Management Matrix */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Toggle Assigned Roles</Text>
              <Text style={styles.detailSectionDesc}>
                Tap to grant or revoke system capabilities for this account.
              </Text>

              {[
                {
                  id: 'admin',
                  label: 'Administrator',
                  desc: 'Full platform access, finances & system settings',
                  icon: ShieldCheck,
                  color: '#DC2626',
                },
                {
                  id: 'seller',
                  label: 'Merchant / Seller',
                  desc: 'Can list products and process customer purchases',
                  icon: Store,
                  color: '#D97706',
                },
                {
                  id: 'logistics',
                  label: 'Logistics Rider',
                  desc: 'Can accept delivery missions and earn drop-off fees',
                  icon: Truck,
                  color: '#0284C7',
                },
                {
                  id: 'promoter',
                  label: 'Growth Promoter',
                  desc: 'Can generate referral links and earn commissions',
                  icon: TrendingUp,
                  color: '#7C3AED',
                },
                {
                  id: 'buyer',
                  label: 'Customer / Buyer',
                  desc: 'Standard marketplace shopping & courier dispatching',
                  icon: ShoppingBag,
                  color: '#475569',
                },
              ].map((item) => {
                const isAssigned = (selectedUser.roles || []).includes(item.id);
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.roleToggleRow,
                      isAssigned && styles.roleToggleRowActive,
                    ]}
                    onPress={() => handleToggleRole(item.id)}
                    disabled={updatingRole}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roleToggleIcon, { backgroundColor: '#F8FAFC' }]}>
                      <Icon size={18} color={item.color} strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleToggleTitle}>{item.label}</Text>
                      <Text style={styles.roleToggleDesc}>{item.desc}</Text>
                    </View>
                    <View
                      style={[
                        styles.toggleCheckCircle,
                        isAssigned && styles.toggleCheckCircleActive,
                      ]}
                    >
                      {isAssigned && <CheckCircle2 size={16} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Danger Zone: Delete User */}
            <View style={styles.dangerZone}>
              <Button
                title="Permanently Delete Member"
                variant="outline"
                icon={Trash2}
                onPress={() => handleDeleteUser(selectedUser.id)}
                style={{ borderColor: '#FECACA' }}
              />
            </View>
          </ScrollView>
        )}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  clearSearch: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  loaderWrap: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  usersList: {
    gap: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  userJoined: {
    fontSize: 10,
    color: '#94A3B8',
  },
  userPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  modalScroll: {
    maxHeight: 520,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginBottom: 14,
  },
  modalAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalAvatarLetter: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  modalUserName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalUserId: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  modalUserPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailSectionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  roleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
    marginBottom: 8,
  },
  roleToggleRowActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: '#FFF7ED',
  },
  roleToggleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleToggleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleToggleDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  toggleCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCheckCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dangerZone: {
    marginTop: 6,
    marginBottom: 20,
  },
});
