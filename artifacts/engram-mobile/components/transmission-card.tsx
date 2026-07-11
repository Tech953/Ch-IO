import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Chip, MonoLabel, ScoreBar } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useMobileI18n } from "@/i18n";
import type { EngramTransmission } from "@workspace/api-client-react";

function relativeTime(
  iso: string | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("time.justNow");
  if (m < 60) return t("time.mAgo", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hAgo", { count: h });
  return t("time.dAgo", { count: Math.floor(h / 24) });
}

export function TransmissionCard({
  transmission,
}: {
  transmission: EngramTransmission;
}) {
  const { t } = useMobileI18n();
  const colors = useColors();
  const score = transmission.overallScore ?? 0;
  const scoreColor =
    score >= 0.66 ? colors.primary : score >= 0.33 ? colors.accent : colors.violet;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: transmission.seen ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {transmission.drive ? (
            <Chip label={transmission.drive} tone="primary" />
          ) : null}
          {transmission.kind ? (
            <Chip label={transmission.kind} tone="muted" />
          ) : null}
        </View>
        <MonoLabel>{relativeTime(transmission.createdAt, t)}</MonoLabel>
      </View>

      <Text style={[styles.content, { color: colors.foreground }]}>
        {transmission.content}
      </Text>

      <View style={styles.footer}>
        <View style={styles.scoreRow}>
          <MonoLabel style={{ width: 64 }}>{t("transmission.signal")}</MonoLabel>
          <View style={{ flex: 1 }}>
            <ScoreBar value={score} color={scoreColor} />
          </View>
          <Text style={[styles.scoreNum, { color: colors.mutedForeground }]}>
            {Math.round(score * 100)}
          </Text>
        </View>
        {transmission.mood ? (
          <MonoLabel color={colors.secondaryForeground}>
            {t("transmission.mood", { mood: transmission.mood })}
          </MonoLabel>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 1,
  },
  content: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    marginTop: 14,
    gap: 8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scoreNum: {
    fontFamily: "JetBrainsMono_500Medium",
    fontSize: 12,
    width: 28,
    textAlign: "right",
  },
});
