import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { SavedAddress } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toast } from '../../../components/ui/GooeyToast';

const STORAGE_KEY = 'linkup_send_saved_addresses';

export function useSavedAddresses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading } = useQuery<SavedAddress[]>({
    queryKey: ['send_saved_addresses', user?.id],
    queryFn: async () => {
      let localList: SavedAddress[] = [];
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) localList = JSON.parse(stored);
      } catch {}

      if (!user) return localList;

      try {
        const { data, error } = await (supabase as any)
          .from('send_saved_addresses')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Could not fetch remote saved addresses, falling back to local:', error);
          return localList;
        }

        // Merge and update cache
        const remoteIds = new Set((data || []).map((d: any) => d.id));
        const combined = [...(data || []), ...localList.filter((l) => !remoteIds.has(l.id))];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
        return combined;
      } catch {
        return localList;
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const saveAddressMutation = useMutation({
    mutationFn: async (newAddress: Omit<SavedAddress, 'id' | 'user_id' | 'created_at'>) => {
      const addressObj: SavedAddress = {
        ...newAddress,
        id: `addr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        user_id: user?.id || 'guest',
        created_at: new Date().toISOString(),
      };

      if (user) {
        try {
          const { data, error } = await (supabase as any)
            .from('send_saved_addresses')
            .insert({
              user_id: user.id,
              label: addressObj.label,
              type: addressObj.type,
              contact_name: addressObj.contact_name,
              contact_phone: addressObj.contact_phone,
              address: addressObj.address,
              directions: addressObj.directions,
              latitude: addressObj.latitude,
              longitude: addressObj.longitude,
            })
            .select()
            .single();

          if (!error && data) {
            addressObj.id = data.id;
          }
        } catch (err) {
          console.warn('Failed to insert saved address remotely:', err);
        }
      }

      // Persist to AsyncStorage
      try {
        const currentRaw = await AsyncStorage.getItem(STORAGE_KEY);
        const current = currentRaw ? JSON.parse(currentRaw) : [];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([addressObj, ...current]));
      } catch {}

      return addressObj;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['send_saved_addresses', user?.id] });
      toast.success('Address saved for future deliveries');
    },
    onError: (err: any) => {
      toast.error('Failed to save address: ' + err.message);
    },
  });

  return {
    addresses,
    isLoading,
    saveAddress: saveAddressMutation.mutateAsync,
    isSaving: saveAddressMutation.isPending,
  };
}
