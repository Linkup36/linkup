# Linkup Marketplace: Web-to-Mobile Migration Guide (iOS & Android)

This document provides the end-to-end architectural blueprint, component-by-component migration matrix, phased execution roadmap, and implementation details for porting the Linkup Marketplace web application (`Vite + React 18 + Supabase + Tailwind + Shadcn`) to a high-performance cross-platform mobile application powered by **React Native & Expo**.

---

## 1. Executive Architecture & Stack Selection

### Selected Mobile Framework: **React Native with Expo (SDK 51+)**
- **Rationale**: The existing web app is written in **React 18, TypeScript, Supabase, and TanStack React Query**. React Native allows direct reuse of business logic, type definitions (`Database['public']['Tables']`), Supabase queries, and React Query cache hooks with near-zero conceptual friction.
- **Alternative Consideration**:
  - *Capacitor*: Faster to wrap existing web DOM, but falls short on native gestures, 60/120fps map panning, background GPS for courier tracking, and native OS keyboard management.
  - *Flutter*: Requires rewriting all TypeScript business logic, models, and Supabase hooks in Dart.

| Domain | Web Stack | Mobile Stack (React Native) |
| :--- | :--- | :--- |
| **Language & Core** | React 18, TypeScript, Vite | React Native 0.74+, Expo SDK 51+, TypeScript |
| **Navigation** | `react-router-dom` v6 | `@react-navigation/native-stack` + `@react-navigation/bottom-tabs` |
| **Backend & DB** | `@supabase/supabase-js` (Web storage) | `@supabase/supabase-js` (`react-native-url-polyfill` + `AsyncStorage`) |
| **Local Storage** | `window.localStorage` | `expo-secure-store` (tokens/PII) + `@react-native-async-storage/async-storage` |
| **Cache & Offline** | `@tanstack/react-query` + sync-persister | `@tanstack/react-query` + `query-async-storage-persister` |
| **UI Components** | Radix UI Primitives + Tailwind CSS | React Native Primitives (`View`, `Text`, `Pressable`, `FlatList`) + StyleSheet / NativeWind |
| **Maps & Tracking** | `leaflet` / `react-leaflet` | `react-native-maps` (Google Maps / Apple Maps) |
| **Camera & Photos** | HTML `<input type="file">` | `expo-image-picker` & `expo-camera` |
| **Notifications** | Service Worker (`sw.ts`) + Web Push | `expo-notifications` (APNs + Firebase Cloud Messaging) |
| **Payments** | Paystack Popup JS | `react-native-paystack-webview` / Native Paystack SDK / Edge Function Checkout |

---

## 2. Mobile Folder Structure

```
linkup-marketplace/
├── mobile/                            # Dedicated cross-platform mobile codebase
│   ├── assets/                        # Icons, splash screens, notification audio
│   │   ├── adaptive-icon.png
│   │   ├── icon.png
│   │   └── splash.png
│   ├── app.json                       # Native permissions, bundle IDs, deep linking
│   ├── package.json                   # React Native & Expo dependencies
│   ├── tsconfig.json                  # Path aliases (@/* -> ./src/*)
│   ├── babel.config.js                # Babel & Reanimated configuration
│   ├── App.tsx                        # Root application entry point
│   ├── README.md                      # Quick start & local development guide
│   └── src/
│       ├── config/
│       │   └── env.ts                 # Supabase URLs, Paystack keys, PostHog config
│       ├── services/
│       │   ├── supabase.ts            # Supabase client with mobile URL & auth polyfills
│       │   ├── api.ts                 # Edge function wrappers & order requests
│       │   └── notifications.ts       # Push token registration (FCM/APNs)
│       ├── storage/
│       │   └── localStorage.ts        # SecureStore & AsyncStorage unified interface
│       ├── navigation/
│       │   ├── types.ts               # Strongly-typed route params
│       │   ├── RootNavigator.tsx      # Main NativeStackNavigator & auth modal routing
│       │   └── BottomTabNavigator.tsx # 5-tab bar (Home, Search, Send, Cart, Profile)
│       ├── context/
│       │   ├── AuthContext.tsx        # Session, JWT token getter, user profile & roles
│       │   ├── CartContext.tsx        # Offline-first shopping cart state
│       │   └── NetworkContext.tsx     # NetInfo real-time connectivity monitor
│       ├── components/
│       │   └── ui/
│       │       ├── SafeScreen.tsx     # Notch, Dynamic Island, and status bar wrapper
│       │       ├── Button.tsx         # Haptic-enabled primary & outline buttons
│       │       ├── ProductCard.tsx    # 2-column marketplace card
│       │       └── ModalSheet.tsx     # Native bottom sheets (replaces Vaul)
│       └── features/
│           ├── marketplace/
│           │   └── screens/
│           │       ├── HomeScreen.tsx
│           │       ├── ProductDetailScreen.tsx
│           │       ├── CartPlaceholder.tsx
│           │       ├── CheckoutScreen.tsx
│           │       └── SearchPlaceholder.tsx
│           ├── send/
│           │   └── screens/
│           │       ├── SendPlaceholder.tsx
│           │       └── SendTrackingScreen.tsx
│           ├── user/
│           │   └── screens/
│           │       ├── ProfilePlaceholder.tsx
│           │       ├── WalletScreen.tsx
│           │       ├── ChatScreen.tsx
│           │       └── MessagesScreen.tsx
│           └── seller/
│               └── screens/
│                   ├── SellerDashboardScreen.tsx
│                   ├── ListProductScreen.tsx
│                   └── SellerVerificationScreen.tsx
```

---

## 3. Collapsible Component-by-Component Migration Matrix

<details open>
<summary><b>Click to expand: Complete Web Component to Mobile Counterpart Matrix</b></summary>

| Web Component (Path) | Mobile Counterpart | Props & State Mapping | Library / Tech Adjustments | Potential Platform Limitations & Workarounds |
| :--- | :--- | :--- | :--- | :--- |
| `src/shared/components/layout/BottomNav.tsx` | `mobile/src/navigation/BottomTabNavigator.tsx` | Maps `location.pathname` to React Navigation active route state; cart badge count via `useCart().totalCount` | `@react-navigation/bottom-tabs` + `lucide-react-native` | Requires `useSafeAreaInsets()` to accommodate iOS Home Indicator bar and Android translucent navigation keys. |
| `src/shared/components/layout/Header.tsx` | Native Header inside `Screen.options` or custom `HeaderBar.tsx` | Search term state, notification badges, active role display | `react-native-safe-area-context` | Mobile screens prefer collapsible headers using `Animated.ScrollView` or `react-native-reanimated`. |
| `src/features/marketplace/components/ProductCard.tsx` | `mobile/src/components/ui/ProductCard.tsx` | `product: ProductItem`, `onPress: () => void`, `onAddToCart: () => void` | Replaces HTML `<img>` with `expo-image` (memory cached); replaces CSS hover with `TouchableOpacity` + `expo-haptics` | Web CSS grid `grid-cols-2` replaced with `FlatList` `numColumns={2}` and fixed gutter calculation `(width - 48) / 2`. |
| `src/features/marketplace/pages/ProductDetail.tsx` | `mobile/src/features/marketplace/screens/ProductDetailScreen.tsx` | Route params `{ id: string }`; loads product query, review stats, and seller profile | `expo-image` image gallery or `react-native-pager-view` | Ensure images support pinch-to-zoom if required; sticky footer needs `bottom: insets.bottom`. |
| `src/features/marketplace/components/LiveTrackingMap.tsx` & `RoutePreviewMap.tsx` | `mobile/src/features/send/screens/SendTrackingScreen.tsx` | Coordinates: `{ latitude, longitude }`, courier polyline points, destination marker | `react-native-maps` (`MapView`, `Marker`, `Polyline`) | Leaflet DOM does not run in React Native. Requires Google Maps API Key on Android and Apple Maps on iOS. |
| `src/features/marketplace/pages/Cart.tsx` | `mobile/src/features/marketplace/screens/CartPlaceholder.tsx` | `items: CartItem[]`, `subtotal: number`, `updateQuantity`, `removeFromCart` | Synced to `@react-native-async-storage/async-storage` via `CartContext` | Keyboard avoiding view required if promo code input is focused. |
| `src/features/marketplace/pages/Checkout.tsx` | `mobile/src/features/marketplace/screens/CheckoutScreen.tsx` | Delivery address selection, delivery speed, payment method (Wallet, Paystack, Cash) | `react-native-paystack-webview` or Supabase Edge Function initialization | Web redirects can fail in mobile; use deep-link callback `linkup://payment-verify?ref=XYZ`. |
| `src/features/send/pages/SendPage.tsx` | `mobile/src/features/send/screens/SendPlaceholder.tsx` | Pickup location, Dropoff location, package category, receiver phone, delivery estimate quote | Native Geolocation via `expo-location` + Google Places Autocomplete API | Web address autocomplete often uses Google Maps script tags; mobile must use Places REST API or native SDK. |
| `src/features/seller/pages/ListProduct.tsx` | `mobile/src/features/seller/screens/ListProductScreen.tsx` | Form state via `react-hook-form` + `zodResolver`; photos array | `expo-image-picker` with native JPEG compression (`quality: 0.7`) | Direct camera uploads require runtime permission requests (`NSCameraUsageDescription`, `CAMERA` permission). |
| `src/features/user/pages/Profile.tsx` | `mobile/src/features/user/screens/ProfilePlaceholder.tsx` | `user`, `profile`, `roles`, `activeRole`, `setActiveRole`, `signOut` | Native list items with `ChevronRight` and modal role selector | Biometric login (FaceID / Fingerprint) can be integrated via `expo-local-authentication`. |
| `src/features/user/pages/Chat.tsx` | `mobile/src/features/user/screens/ChatScreen.tsx` | `conversationId`, message list, realtime subscription via `supabase.channel()` | Native `FlatList` with `inverted={true}` + `KeyboardAvoidingView` | Android keyboard resize behavior requires `android:windowSoftInputMode="adjustResize"` in `AndroidManifest.xml`. |
| `src/features/user/pages/WalletPage.tsx` | `mobile/src/features/user/screens/WalletScreen.tsx` | Balance, transaction ledger list, top-up modal, bank withdrawal form | Native secure PIN entry using customized digit boxes | Protect balance visibility with biometric toggle or hidden eye icon. |
| `src/shared/components/ui/dialog.tsx` / `drawer.tsx` | `mobile/src/components/ui/ModalSheet.tsx` | `isOpen`, `onClose`, `children` | `@gorhom/bottom-sheet` or native React Native `<Modal>` | Web Radix UI depends on HTML portals and DOM focus traps. Native bottom sheet uses gesture responder system. |
| `src/shared/components/NetworkStatusBanner.tsx` | Mobile Network Toast inside `SafeScreen` | `isOnline: boolean`, `wasOffline: boolean` | `@react-native-community/netinfo` | Mobile network toggles between WiFi, Cellular 4G/5G, and Airplane Mode rapidly; debounce reconnect pings. |

</details>

---

## 4. Phased Implementation Plan

### Phase 1: Minimal Viable Product (MVP)
The objective of the MVP is to provide a complete, working buyer experience and peer-to-peer delivery request loop.
1. **Foundation & Auth**:
   - Expo project initialization with TypeScript and path aliases (`@/*`).
   - Mobile Supabase client with persistent session handling via `AsyncStorage`.
   - Native authentication flow (Sign Up, Sign In, Profile Retrieval, Role Assignment).
2. **Marketplace Discovery & Product Detail**:
   - Two-column product feed with pull-to-refresh and category filtering.
   - Product detail page with image carousel, specs, trust badges, and seller details.
   - Offline-capable Cart with local persistence (`CartContext`).
3. **Send Package Flow**:
   - Pickup & Dropoff address inputs with location geocoding.
   - Package type selection and instant price estimation.
   - Live tracking screen with courier marker and arrival ETA.
4. **Checkout & Order Creation**:
   - Order placement connecting to Supabase Edge Functions.
   - Payment via Paystack mobile webview or wallet debit.
5. **Testing & Android/iOS Simulator Builds**:
   - Verification on iOS Simulator and Android Emulator.

### Phase 2: Extended Enhancement Plan
1. **Seller & Merchant Suite**:
   - Seller dashboard with sales analytics, active listings management, and order fulfillment.
   - In-app product listing with multi-image camera capture and native compression.
   - KYC identity verification with camera document scanning.
2. **Real-time Chat & Push Notifications**:
   - Real-time buyer-seller chat with Supabase Realtime Channels.
   - Push notifications via Expo Notifications (APNs and FCM) for order status updates, delivery alerts, and new chat messages.
3. **Logistics & Driver Mode**:
   - Background location tracking for couriers delivering packages.
   - QR code scanner for package pickup and delivery confirmation handoffs (`expo-camera`).
4. **Native Biometrics & Offline Sync**:
   - FaceID / Fingerprint unlocking for wallet withdrawals.
   - TanStack React Query offline mutation queue with automatic retry upon reconnect.
5. **App Store & Play Store Release Pipeline**:
   - EAS Build & EAS Submit configuration for automated test tracks (TestFlight and Google Play Internal Testing).

---

## 5. Core Pattern Code References

### Pattern A: Navigation Setup & Deep Linking
```typescript
// mobile/src/navigation/RootNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const linking = {
  prefixes: ['linkup://', 'https://linkupng.com', 'https://linkup.ng'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: '',
          SendTab: 'send',
          CartTab: 'cart',
        },
      },
      ProductDetail: 'product/:id',
      SendTracking: 'send/track/:orderId',
    },
  },
};
```

### Pattern B: Supabase Client with Mobile Polyfills
```typescript
// mobile/src/services/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Pattern C: Resilient Local Storage & Query Cache
```typescript
// mobile/src/storage/localStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const SecureStorage = {
  async getItem(key: string) { return SecureStore.getItemAsync(key); },
  async setItem(key: string, value: string) { return SecureStore.setItemAsync(key, value); },
};

export const LocalStorage = {
  async getItem<T>(key: string): Promise<T | null> {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  },
  async setItem<T>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
};
```

---

## 6. Migration Checklist & Quality Gates

### Milestones & Risk Register
- [x] **Milestone 1**: Mobile codebase created (`mobile/` folder with Expo, TypeScript, navigation, and theme tokens).
- [ ] **Milestone 2**: Supabase Auth & Session persistence verified with token refresh on device reboot.
- [ ] **Milestone 3**: Marketplace feed, Product Detail, and persistent Cart functional.
- [ ] **Milestone 4**: Native maps and courier tracking functional on both iOS and Android.
- [ ] **Milestone 5**: Push notifications and APNs / FCM certificates linked with Supabase Edge Functions.
- [ ] **Milestone 6**: Production EAS build signed and distributed to TestFlight & Google Play Console.

### High-Priority Risk Notes
1. **Maps & API Keys**: Android native builds require a Google Maps API Key declared in `app.json` under `android.config.googleMaps.apiKey`. Without this, the map view displays a blank grid.
2. **Keyboard Handling on Android**: Complex forms (Checkout, Send Page) require `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>` and `Keyboard.dismiss()` listeners to prevent buttons from being obstructed.
3. **Paystack Mobile Redirects**: Native mobile apps cannot rely on web popup popups (`PaystackPop.setup()`). Use WebView checkout or deep-linked redirection with a Supabase Edge Function verifying webhook events.

---

## 7. In-App Paystack WebView Checkout Architecture

The web app uses popup modals for Paystack (`PaystackPop.setup()`), which cannot run directly in native mobile environments. To provide a smooth in-app experience without external browser redirects, Linkup Mobile uses an isolated modal containing [`react-native-webview`](file:///c:/Users/HomePC/Desktop/ALL%20PROJECTS/linkup-marketplace/mobile/src/components/ui/PaystackWebViewModal.tsx).

### Data Flow
1. User taps **"Pay ₦..."** on [`CheckoutScreen.tsx`](file:///c:/Users/HomePC/Desktop/ALL%20PROJECTS/linkup-marketplace/mobile/src/features/marketplace/screens/CheckoutScreen.tsx).
2. The app mounts [`PaystackWebViewModal`](file:///c:/Users/HomePC/Desktop/ALL%20PROJECTS/linkup-marketplace/mobile/src/components/ui/PaystackWebViewModal.tsx) with a unique reference (`LKP_<timestamp>_<rand>`).
3. Inside the WebView, Paystack's official inline script (`https://js.paystack.co/v1/inline.js`) initializes within an isolated container.
4. When the user completes card/bank/USSD verification:
   - Paystack invokes `callback(response)`, which sends `window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success', reference }))`.
   - The React Native layer catches `onMessage`, extracts the reference, closes the modal, and calls the Supabase Edge Function `verify-paystack-payment` to verify transaction legitimacy server-side before marking the order as paid.

---

## 8. Push Notifications Setup with Expo Application Services (EAS)

Linkup Marketplace uses push notifications for:
- Courier dispatch status updates (Picked up, Out for delivery, Delivered)
- Buyer/Seller direct chat notifications
- Wallet credit/debit alerts

### Architecture
- **iOS**: Apple Push Notification service (APNs) using a `.p8` Authentication Key.
- **Android**: Firebase Cloud Messaging (FCM v1) using a Google Service Account Private Key.
- **Delivery Service**: Expo Push Notification Gateway (`https://exp.host/--/api/v2/push/send`) or direct Edge Function invocation.

### A. Android Configuration (Firebase Cloud Messaging v1)
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create or select your project (e.g., `linkup-marketplace`).
2. Add an **Android App**:
   - **Android package name**: `com.linkup.marketplace` (matches `app.json`).
3. Download `google-services.json` and place it in `mobile/google-services.json`.
4. In `mobile/app.json`, reference it:
   ```json
   "android": {
     "package": "com.linkup.marketplace",
     "googleServicesFile": "./google-services.json"
   }
   ```
5. In the Firebase Console, go to **Project Settings > Service Accounts**.
6. Click **Generate new private key** (downloads a `.json` file containing FCM v1 credentials).
7. Run the EAS CLI command in your `mobile/` directory:
   ```bash
   eas credentials
   ```
   - Select **Android > production > Push Notifications > Server Key / FCM v1**.
   - Upload the service account JSON key. EAS securely stores it on your project.

### B. iOS Configuration (Apple Developer APNs Key)
1. Log in to the [Apple Developer Portal](https://developer.apple.com/account).
2. Go to **Certificates, Identifiers & Profiles > Keys**.
3. Click the `+` button to create a new key:
   - **Key Name**: `Linkup Push Key`
   - Check the **Apple Push Notifications service (APNs)** checkbox.
4. Click **Continue** and **Register**.
5. Download the `.p8` file (Note: You can only download this once). Save the **Key ID** and your **Team ID**.
6. Run the EAS CLI in your `mobile/` directory:
   ```bash
   eas credentials
   ```
   - Select **iOS > production > Push Notifications > Apple Push Key (.p8)**.
   - Enter your Key ID, Team ID, and upload the `.p8` file (or let EAS automatically generate and manage it using your Apple login).

### C. Sending Notifications from Supabase Edge Functions
Store the user's `push_token` in `profiles.push_token` via [`registerForPushNotificationsAsync()`](file:///c:/Users/HomePC/Desktop/ALL%20PROJECTS/linkup-marketplace/mobile/src/services/notifications.ts).
Send notifications with:
```typescript
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: profile.push_token,
    sound: 'default',
    title: 'Courier on the way!',
    body: 'Your package is 10 mins away with rider Emeka.',
    data: { orderId: 'ORDER_123' },
  }),
});
```

---

## 9. Google Maps API Key Setup Guide (Android & iOS)

To render real-time courier tracking polylines and markers in [`SendTrackingScreen.tsx`](file:///c:/Users/HomePC/Desktop/ALL%20PROJECTS/linkup-marketplace/mobile/src/features/send/screens/SendTrackingScreen.tsx), you must provision and restrict a Google Maps API Key.

### Step 1: Create or Select Project in Google Cloud Console
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select your existing Linkup project.
3. Enable billing on the project.

### Step 2: Enable Required APIs
In the **APIs & Services > Library** search bar, enable the following two APIs:
- **Maps SDK for Android**
- **Maps SDK for iOS** (optional if using Apple Maps on iOS, mandatory for Google Maps on iOS)

### Step 3: Create and Restrict API Key
1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials > API Key**.
3. Under **Set Application Restrictions**:
   - Choose **Android apps**.
   - Click **+ Add package name and fingerprint**.
   - **Package name**: `com.linkup.marketplace`
   - **SHA-1 certificate fingerprint**: (See Step 4 below).
4. Under **API restrictions**:
   - Choose **Restrict key**.
   - Select **Maps SDK for Android** (and iOS if applicable).
5. Click **Save**.

### Step 4: Obtaining Your SHA-1 Fingerprint

#### For Local Development Keystore (Windows PowerShell):
Run:
```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```
Look for the line that starts with `SHA1:` (e.g., `A1:B2:C3:D4:E5:67:89:...`).

#### For EAS Production / Preview Keystores:
If building with EAS Build, EAS generates a managed production keystore. Retrieve its SHA-1 by running:
```bash
eas credentials
```
Select **Android > production > Keystore** to print the Google Cloud SHA-1 fingerprint.

### Step 5: Add Key to `app.json`
Open `mobile/app.json` and paste your restricted key:
```json
"android": {
  "package": "com.linkup.marketplace",
  "config": {
    "googleMaps": {
      "apiKey": "AIzaSyYOUR_ACTUAL_GOOGLE_MAPS_KEY"
    }
  }
}
```
For iOS (if choosing Google Maps over Apple Maps):
```json
"ios": {
  "bundleIdentifier": "com.linkup.marketplace",
  "config": {
    "googleMapsApiKey": "AIzaSyYOUR_ACTUAL_GOOGLE_MAPS_KEY"
  }
}
```
