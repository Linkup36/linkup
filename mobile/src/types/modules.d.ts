// Ambient type declarations for React Native and Expo ecosystem packages
// These declarations satisfy TypeScript LSP prior to running `npm install` inside the mobile directory.

declare module 'react-native' {
  export const View: any;
  export const Text: any;
  export const TouchableOpacity: any;
  export const FlatList: any;
  export const ScrollView: any;
  export const TextInput: any;
  export const Image: any;
  export const ActivityIndicator: any;
  export const Modal: any;
  export const StatusBar: any;
  export const SafeAreaView: any;
  export const Platform: { OS: 'ios' | 'android' | 'web'; select: (obj: any) => any };
  export const Dimensions: { get: (dim: 'window' | 'screen') => { width: number; height: number } };
  export const StyleSheet: { create: <T extends Record<string, any>>(styles: T) => T; absoluteFillObject: any; absoluteFill: any };
  export const Alert: { alert: (title: string, message?: string, buttons?: any[]) => void };
  export const Linking: {
    openURL: (url: string) => Promise<boolean>;
    canOpenURL?: (url: string) => Promise<boolean>;
    getInitialURL: () => Promise<string | null>;
    addEventListener: (type: 'url', handler: (event: { url: string }) => void) => { remove: () => void };
  };
  export const Share: { share: (content: { message: string; title?: string }) => Promise<any> };
  export const RefreshControl: any;
  export const Keyboard: any;
  export const KeyboardAvoidingView: any;
  export const TouchableWithoutFeedback: any;
  export const Switch: any;
  export const Animated: any;
  export const Easing: any;
  export const findNodeHandle: (node: any) => any;
  export const useWindowDimensions: () => { width: number; height: number; scale: number; fontScale: number };
  export const PanResponder: any;
  export type View = any;
  export type ScrollView = any;
  export type FlatList = any;
  export type TextInput = any;
  export type ViewStyle = any;
  export type TextStyle = any;
  export type ImageStyle = any;
  export type StyleProp<T> = any;
}

declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
  export const initialWindowMetrics: any;
  export const useSafeAreaInsets: () => { top: number; bottom: number; left: number; right: number };
}

declare module 'react-native-webview' {
  export type WebView = any;
  export const WebView: any;
  export interface WebViewNavigation {
    url: string;
    title?: string;
    loading?: boolean;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }
}

declare module 'lucide-react-native' {
  export const Home: any;
  export const Search: any;
  export const Package: any;
  export const ShoppingCart: any;
  export const User: any;
  export const Users: any;
  export const Bell: any;
  export const SlidersHorizontal: any;
  export const Sparkles: any;
  export const Star: any;
  export const Filter: any;
  export const X: any;
  export const MapPin: any;
  export const ArrowRight: any;
  export const ArrowLeft: any;
  export const ShieldCheck: any;
  export const Clock: any;
  export const Trash2: any;
  export const Plus: any;
  export const Minus: any;
  export const ShoppingBag: any;
  export const Wallet: any;
  export const MessageSquare: any;
  export const MessageCircle: any;
  export const HelpCircle: any;
  export const LogOut: any;
  export const ChevronRight: any;
  export const ChevronDown: any;
  export const ChevronUp: any;
  export const Phone: any;
  export const Navigation: any;
  export const CheckCircle2: any;
  export const CheckCircle: any;
  export const CheckCheck: any;
  export const Check: any;
  export const Share2: any;
  export const Heart: any;
  export const Truck: any;
  export const ArrowDownToLine: any;
  export const ArrowUpRight: any;
  export const Lock: any;
  export const CreditCard: any;
  export const Bike: any;
  export const Car: any;
  export const Building2: any;
  export const ImagePlus: any;
  export const Camera: any;
  export const Edit2: any;
  export const QrCode: any;
  export const XCircle: any;
  export const ArrowUpDown: any;
  export const Upload: any;
  export const FileText: any;
  export const Mail: any;
  export const MailCheck: any;
  export const ExternalLink: any;
  export const Store: any;
  export const Megaphone: any;
  export const TrendingUp: any;
  export const Tag: any;
  export const RotateCcw: any;
  export const RefreshCw: any;
  export const Copy: any;
  export const DollarSign: any;
  export const Send: any;
  export const Image: any;
  export const Grid: any;
  export const Headphones: any;
  export const Shirt: any;
  export const UtensilsCrossed: any;
  export const Laptop: any;
  export const PackagePlus: any;
  export const Download: any;
  export const LogIn: any;
  export const LayoutDashboard: any;
  export const AlertTriangle: any;
  export const AlertCircle: any;
  export const Info: any;
  export const Eye: any;
  export const EyeOff: any;
  export const ChevronLeft: any;
  export const Printer: any;
  export const Bus: any;
  export const Bike: any;
  export const Zap: any;
  export const Calendar: any;
  export const Gavel: any;
  export const Apple: any;
  export const MoreHorizontal: any;
  export const MoreVertical: any;
  export const Share2: any;
  export const LocateFixed: any;
  export const Scale: any;
  export const Smartphone: any;
  export const Dumbbell: any;
  export const UserCog: any;
  export const UserCheck: any;
  export const Volume2: any;
  export const VolumeX: any;
  export const BellRing: any;
  export const Loader2: any;
  export const BookOpen: any;
  export const Baby: any;
  export const Briefcase: any;
  export const Layers: any;
  export const Compass: any;
  export const Settings: any;
  export const Menu: any;
  export const AlignLeft: any;
  export const PanelLeft: any;
  export const PanelLeftClose: any;
  export const Banknote: any;
  export const Route: any;
  export const PackageX: any;
  export const ShieldAlert: any;
  export const Radio: any;
  export const Landmark: any;
  export const Shield: any;
  export const Activity: any;
  export const BarChart3: any;
  export const Receipt: any;
  export const FileText: any;
  export const HelpCircle: any;
  export const CheckCircle: any;
  export const Scroll: any;
}

declare module 'expo-image-picker' {
  export type MediaType = 'images' | 'videos' | 'livePhotos';
  export enum MediaTypeOptions { Images, Videos, All }
  export function requestMediaLibraryPermissionsAsync(): Promise<{ status: string }>;
  export function requestCameraPermissionsAsync(): Promise<{ status: string }>;
  export function launchImageLibraryAsync(options?: any): Promise<{ canceled: boolean; assets?: Array<{ uri: string }> }>;
  export function launchCameraAsync(options?: any): Promise<{ canceled: boolean; assets?: Array<{ uri: string }> }>;
}

declare module 'react-native-qrcode-svg' {
  const QRCode: any;
  export default QRCode;
}

declare module '@react-navigation/native' {
  export const NavigationContainer: any;
  export const useNavigation: <T = any>() => T;
  export const useRoute: <T = any>() => T;
  export type NavigatorScreenParams<T> = any;
  export type RouteProp<T, K extends keyof T> = { params: T[K] };
}

declare module '@react-navigation/native-stack' {
  export const createNativeStackNavigator: <T>() => any;
  export type NativeStackNavigationProp<T, K extends keyof T = any> = any;
}

declare module '@react-navigation/bottom-tabs' {
  export const createBottomTabNavigator: <T>() => any;
  export type BottomTabBarProps = any;
}

declare module 'expo-status-bar' {
  export const StatusBar: any;
}

declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<boolean>;
  export function hideAsync(): Promise<boolean>;
}

declare module 'expo' {
  export function isRunningInExpoGo(): boolean;
  export function registerRootComponent(component: any): void;
}

declare module 'expo-constants' {
  const Constants: {
    expoConfig?: { extra?: Record<string, any> };
    easConfig?: { projectId?: string };
    appOwnership?: string | null;
    executionEnvironment?: string | null;
  };
  export default Constants;
}

declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle { Light, Medium, Heavy }
  export enum NotificationFeedbackType { Success, Warning, Error }
  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
  export function selectionAsync(): Promise<void>;
}

declare module 'expo-location' {
  export enum Accuracy { Lowest = 1, Low = 2, Balanced = 3, High = 4, Highest = 5, BestForNavigation = 6 }
  export function requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function getForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function hasServicesEnabledAsync(): Promise<boolean>;
  export function getLastKnownPositionAsync(options?: any): Promise<{ coords: { latitude: number; longitude: number; altitude?: number | null } } | null>;
  export function getCurrentPositionAsync(options?: any): Promise<{ coords: { latitude: number; longitude: number; altitude?: number | null } }>;
  export function geocodeAsync(address: string): Promise<Array<{ latitude: number; longitude: number; altitude?: number | null }>>;
  export function reverseGeocodeAsync(location: { latitude: number; longitude: number }): Promise<Array<{
    city?: string | null;
    district?: string | null;
    street?: string | null;
    streetNumber?: string | null;
    region?: string | null;
    subregion?: string | null;
    country?: string | null;
    postalCode?: string | null;
    name?: string | null;
  }>>;
  export type LocationObject = { coords: { latitude: number; longitude: number; altitude?: number | null } };
  export type LocationSubscription = { remove: () => void };
  export function watchPositionAsync(options: any, callback: (location: any) => void): Promise<LocationSubscription>;
}

declare module 'expo-device' {
  export const isDevice: boolean;
}

declare module 'expo-notifications' {
  export const setNotificationHandler: (handler: any) => void;
  export const setNotificationChannelAsync: (channelId: string, channel: any) => Promise<any>;
  export const getPermissionsAsync: () => Promise<{ status: string }>;
  export const requestPermissionsAsync: () => Promise<{ status: string }>;
  export const getExpoPushTokenAsync: (options?: any) => Promise<{ data: string }>;
  export const scheduleNotificationAsync: (request: any) => Promise<string>;
  export enum AndroidImportance { MAX = 7, HIGH = 6, DEFAULT = 5, LOW = 4, MIN = 3, NONE = 2, UNSPECIFIED = 1, UNKNOWN = 0 }
  export enum AndroidNotificationPriority { MAX = 'max', HIGH = 'high', DEFAULT = 'default', LOW = 'low', MIN = 'min' }
  export enum SchedulableTriggerInputTypes {
    CALENDAR = 'calendar',
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
    YEARLY = 'yearly',
    DATE = 'date',
    TIME_INTERVAL = 'timeInterval',
  }
}

declare module 'expo-secure-store' {
  export const WHEN_UNLOCKED_THIS_DEVICE_ONLY: any;
  export function getItemAsync(key: string, options?: any): Promise<string | null>;
  export function setItemAsync(key: string, value: string, options?: any): Promise<void>;
  export function deleteItemAsync(key: string, options?: any): Promise<void>;
}

declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
  }
  export function addEventListener(listener: (state: NetInfoState) => void): () => void;
  export function fetch(): Promise<NetInfoState>;
}

declare module 'react-native-url-polyfill/auto' { }

declare module '*.png' {
  const content: any;
  export default content;
}

declare module '*.jpg' {
  const content: any;
  export default content;
}

declare module '*.jpeg' {
  const content: any;
  export default content;
}
