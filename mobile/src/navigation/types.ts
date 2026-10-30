import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email?: string } | undefined;
  Onboarding: undefined;
  TermsAndPrivacy: { initialTab?: 'terms' | 'privacy' } | undefined;
};

export type MainTabParamList = {
  HomeTab: { category?: string } | undefined;
  SearchTab: { initialQuery?: string; category?: string };
  SendTab: undefined;
  CartTab: undefined;
  OrdersTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  AuthModal: NavigatorScreenParams<AuthStackParamList>;
  ProductDetail: { id: string; title?: string; initialProduct?: any };
  Checkout: { directBuy?: boolean; productId?: string; quantity?: number };
  SendTracking: { orderId: string };
  SendHistory: undefined;
  Chat: { conversationId: string; recipientName: string; productId?: string };
  Messages: undefined;
  Wallet: undefined;
  Profile: undefined;
  Menu: undefined;
  ListProduct: { editId?: string };
  SellerDashboard: undefined;
  SellerVerification: undefined;
  Support: undefined;
  Notifications: undefined;
  Wishlist: undefined;
  Orders: undefined;
  LogisticsDashboard: undefined;
  PromoterDashboard: undefined;
  AdminDashboard: { initialTab?: string } | undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email?: string } | undefined;
  TermsAndPrivacy: { initialTab?: 'terms' | 'privacy' } | undefined;
};
