# Linkup Marketplace Mobile (iOS & Android)

Cross-platform mobile application for **Linkup Marketplace**, built with React Native and Expo.

---

## 📱 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (LTS recommended)
- **Package Manager**: `npm` or `bun`
- **Expo Go** app on your iOS or Android physical device (or Xcode / Android Studio for emulators)

### 2. Installation
Navigate into the mobile folder and install dependencies:
```bash
cd mobile
npm install
```

### 3. Running the App Locally
Start the Expo Metro bundler:
```bash
npm run start
```
- Press `a` in your terminal to launch the **Android Emulator**.
- Press `i` in your terminal to launch the **iOS Simulator**.
- Scan the printed QR code using the **Expo Go** camera (Android) or default Camera app (iOS).

### 4. Native Development Builds (EAS)
For features utilizing custom native plugins (e.g., custom background geolocation or push credentials):
```bash
# Build Android preview APK:
npm run build:android

# Build iOS Simulator or Ad-Hoc build:
npm run build:ios
```

---

## 🗂 Architecture Overview

```
mobile/
├── App.tsx                    # Root application entry point
├── app.json                   # Expo configuration & permission declarations
├── package.json               # Mobile dependencies & build scripts
├── tsconfig.json              # TypeScript paths (@/* -> ./src/*)
└── src/
    ├── config/                # Environment variables (Supabase, Paystack)
    ├── navigation/            # Native Stack and Bottom Tabs navigation
    ├── services/              # Supabase client & Edge Function wrappers
    ├── storage/               # SecureStore & AsyncStorage adapters
    ├── context/               # AuthContext, CartContext, NetworkContext
    ├── components/ui/         # Mobile UI design system (SafeScreen, Button, ProductCard)
    └── features/              # Feature modules (marketplace, send, user, auth, seller)
```
