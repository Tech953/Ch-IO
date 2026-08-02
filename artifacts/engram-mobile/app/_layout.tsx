import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold } from "@expo-google-fonts/rajdhani";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EngramProvider } from "@/context/engram-context";
import { ServerProvider } from "@/context/server-context";
import { MobileI18nProvider, useMobileI18n } from "@/i18n";

// setBaseUrl is now managed by ServerProvider (reads AsyncStorage on boot).
// EXPO_PUBLIC_DOMAIN is NOT used — it was Replit-only and unavailable in APKs.

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,   // 5 min — serve cached data quickly
      gcTime: 1000 * 60 * 60,     // 1 hr — keep in memory for offline
    },
  },
});

function RootLayoutNav() {
  const { t } = useMobileI18n();
  return (
    <Stack screenOptions={{ headerBackTitle: t("header.back") }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold,
    JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold,
  });

  useEffect(() => { if (fontsLoaded || fontError) SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ServerProvider>
          <QueryClientProvider client={queryClient}>
            <EngramProvider>
              <MobileI18nProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <StatusBar style="light" />
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </MobileI18nProvider>
            </EngramProvider>
          </QueryClientProvider>
        </ServerProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
