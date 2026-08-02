import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EngramCard } from "@/components/engram-card";
import { EmptyState } from "@/components/ui";
import { useEngram } from "@/context/engram-context";
import { useColors } from "@/hooks/useColors";
import {
  MOBILE_LOCALE_LABELS,
  MOBILE_SUPPORTED_LOCALES,
  useMobileI18n,
} from "@/i18n";
import {
  getListEngramsQueryKey,
  useActivateEngram,
  useListEngrams,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { useServer } from "@/context/server-context";
import { useOfflineCache } from "@/hooks/useOfflineCache";

export default function EngramsScreen() {
  const { locale, setLocale, t } = useMobileI18n();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedEngramId, setSelectedEngramId } = useEngram();
  const { isConfigured, offlineMode } = useServer();
  const engramCache = useOfflineCache<any[]>("engrams");
  const { data: liveEngrams, isLoading, isError, refetch, isRefetching } =
    useListEngrams({ query: { enabled: isConfigured && !offlineMode } } as any);

  React.useEffect(() => {
    if (liveEngrams) engramCache.write(liveEngrams as any);
  }, [liveEngrams]);

  const [cachedEngrams, setCachedEngrams] = React.useState<any[] | null>(null);
  React.useEffect(() => {
    if (offlineMode || !isConfigured) {
      engramCache.read().then(r => r && setCachedEngrams(r.data));
    }
  }, [offlineMode, isConfigured]);

  const engrams = liveEngrams ?? cachedEngrams;
  if (!isConfigured && !offlineMode) return <ConnectPrompt />;
  const activate = useActivateEngram();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const onSelect = useCallback(
    async (id: number) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      setSelectedEngramId(id);
      try {
        await activate.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
      } catch {
        // selection is local even if activate fails
      }
      router.push(`/engram/${id}`);
    },
    [activate, queryClient, router, setSelectedEngramId],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.kicker, { color: colors.primary }]}>
          {t("index.kicker")}
        </Text>
        <Text style={[styles.h1, { color: colors.foreground }]}>{t("index.title")}</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {t("index.subtitle")}
        </Text>
        <View style={styles.localeRow}>
          {MOBILE_SUPPORTED_LOCALES.map((code) => (
            <Pressable
              key={code}
              onPress={() => setLocale(code)}
              style={[
                styles.localeChip,
                {
                  borderColor: code === locale ? colors.primary : colors.border,
                  backgroundColor: code === locale ? `${colors.primary}20` : colors.card,
                },
              ]}
            >
              <Text style={[styles.localeText, { color: colors.foreground }]}>
                {MOBILE_LOCALE_LABELS[code]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState
            icon={
              <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
            }
            title={t("index.connectionLost")}
            subtitle={t("index.connectionLostSub")}
          />
        </View>
      ) : (
        <FlatList
          data={engrams ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          scrollEnabled={!!engrams && engrams.length > 0}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <EngramCard
              engram={item}
              selected={item.id === selectedEngramId}
              onPress={() => onSelect(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={{ height: 400 }}>
              <EmptyState
                icon={
                  <Feather name="cpu" size={28} color={colors.mutedForeground} />
                }
                title={t("index.noEngrams")}
                subtitle={t("index.noEngramsSub")}
              />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
  },
  kicker: {
    fontFamily: "JetBrainsMono_500Medium",
    fontSize: 11,
    letterSpacing: 2,
  },
  h1: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 34,
    letterSpacing: 0.5,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  localeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  localeChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  localeText: {
    fontFamily: "JetBrainsMono_500Medium",
    fontSize: 10,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
