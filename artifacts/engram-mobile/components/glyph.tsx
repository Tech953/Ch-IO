import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function Glyph({
  symbol,
  size = 56,
  active,
}: {
  symbol: string;
  size?: number;
  active?: boolean;
}) {
  const colors = useColors();
  const accent = active ? colors.primary : colors.secondaryForeground;
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: colors.radius,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary + "1A" : colors.muted,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: "JetBrainsMono_700Bold",
          fontSize: size * 0.42,
          color: accent,
        }}
      >
        {symbol?.slice(0, 2) || "??"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
