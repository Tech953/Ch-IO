import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function ConnectPrompt() {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="wifi-off" size={32} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>No Server Connected</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          To use ENGRAM, point the app at a running Engram server.{"

"}
          This can be a local desktop install on the same network, a home server, or any reachable URL.
        </Text>
        <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/settings")}>
          <Feather name="settings" size={14} color={colors.primaryForeground} />
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Go to Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, borderWidth: 1, borderRadius: 12, padding: 24, alignItems: "center", gap: 12 },
  title: { fontFamily: "Rajdhani_700Bold", fontSize: 22, letterSpacing: 0.5, textAlign: "center" },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, textAlign: "center" },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 4 },
  btnText: { fontFamily: "Rajdhani_600SemiBold", fontSize: 15 },
});
