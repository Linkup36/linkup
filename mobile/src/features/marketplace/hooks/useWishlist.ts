import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../components/ui/GooeyToast';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const { data: likes = [], isLoading } = useQuery({
    queryKey: ['my-likes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('likes')
        .select('product_id')
        .eq('user_id', user.id);
      return data?.map((l: any) => l.product_id) ?? [];
    },
    enabled: !!user,
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) {
        toast.info('Please sign in to save items to your wishlist');
        navigation.navigate('Login');
        return;
      }

      const isCurrentlyLiked = likes.includes(productId);

      if (isCurrentlyLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      }
    },
    onMutate: async (productId) => {
      if (!user) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const previousLikes = queryClient.getQueryData<string[]>(['my-likes', user.id]) || [];
      const isCurrentlyLiked = previousLikes.includes(productId);

      if (isCurrentlyLiked) {
        toast.info('Removed from wishlist');
      } else {
        toast.success('Added to wishlist');
      }

      queryClient.setQueryData(
        ['my-likes', user.id],
        isCurrentlyLiked
          ? previousLikes.filter((id) => id !== productId)
          : [...previousLikes, productId]
      );

      queryClient.setQueryData(['is-liked', productId, user.id], !isCurrentlyLiked);
      queryClient.setQueryData(['like-count', productId], (old: number = 0) =>
        Math.max(0, old + (isCurrentlyLiked ? -1 : 1))
      );

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['my-likes', user.id] }),
        queryClient.cancelQueries({ queryKey: ['products'] }),
        queryClient.cancelQueries({ queryKey: ['is-liked', productId, user.id] }),
        queryClient.cancelQueries({ queryKey: ['like-count', productId] }),
      ]);

      return { previousLikes };
    },
    onError: (err, productId, context) => {
      if (context?.previousLikes && user) {
        queryClient.setQueryData(['my-likes', user.id], context.previousLikes);
      }
      toast.error('Could not update wishlist. Please try again.');
    },
    onSettled: (data, error, productId) => {
      queryClient.invalidateQueries({ queryKey: ['my-likes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-liked', productId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['like-count', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return {
    likes,
    isLoading,
    toggleLike: toggleLikeMutation.mutate,
    isToggling: toggleLikeMutation.isPending,
  };
}
