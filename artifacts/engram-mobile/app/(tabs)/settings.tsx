import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useMobileI18n } from "@/i18n";
import { useServer } from "@/context/server-context";

type Status = "idle" | "testing" | "ok" | "error";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useMobileI18n();
  const { serverUrl, offlineMode, setServerUrl, setOfflineMode, testConnection } = useServer();
  const [inputUrl, setInputUrl] = useState(serverUrl ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const onTest = async () => {
    if (!inputUrl.trim()) { setStatus("error"); setStatusMsg("Please enter a server URL first."); return; }
    setStatus("testing"); setStatusMsg("");
    const result = await testConnection(inputUrl.trim());
    setStatus(result.ok ? "ok" : "error");
    setStatusMsg(result.ok ? "Connected successfully ✓" : (result.error ?? "Connection failed."));
  };

  const onSave = async () => { await setServerUrl(inputUrl.trim() || null); setStatus("ok"); setStatusMsg("Server URL saved."); };
  const onClear = async () => { setInputUrl(""); await setServerUrl(null); setStatus("idle"); setStatusMsg(""); };

  const statusColor = status === "ok" ? colors.success : status === "error" ? colors.destructive : colors.mutedForeground;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: topPad + 12 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.kicker, { color: colors.primary }]}>{"⚙ CONFIGURATION"}</Text>
        <Text style={[styles.h1, { color: colors.foreground }]}>Settings</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Point the app at your Engram server — a local desktop install, home server, or any reachable URL.
        </Text>
        <Text style={[styles.label, { color: colors.foreground }]}>Engram Server URL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: status === "error" ? colors.destructive : colors.border, color: colors.foreground }]}
          value={inputUrl} onChangeText={v => { setInputUrl(v); setStatus("idle"); setStatusMsg(""); }}
          placeholder="http://192.168.1.x:5000" placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done"
        />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          e.g. http://192.168.1.42:5000 · http://10.0.0.5:5000 · https://engram.yourserver.com
        </Text>
        {statusMsg !== "" && <Text style={[styles.statusMsg, { color: statusColor }]}>{statusMsg}</Text>}
        <View style={styles.buttonRow}>
          <Pressable style={[styles.btn, { backgroundColor: colors.secondary, flex: 1 }]} onPress={onTest} disabled={status === "testing"}>
            {status === "testing" ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="wifi" size={14} color={colors.primary} />}
            <Text style={[styles.btnText, { color: colors.primary }]}>Test</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }]} onPress={onSave}>
            <Feather name="save" size={14} color={colors.primaryForeground} />
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Save</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: colors.secondary, flex: 1 }]} onPress={onClear}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
            <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Clear</Text>
          </Pressable>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Offline Mode</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              Use cached data when the server is unreachable. The app stays readable without a live connection.
            </Text>
          </View>
          <Switch value={offlineMode} onValueChange={setOfflineMode}
            trackColor={{ false: colors.border, true: `${colors.primary}80` }}
            thumbColor={offlineMode ? colors.primary : colors.mutedForeground} />
        </View>
        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Current server</Text>
          <Text style={[styles.infoValue, { color: serverUrl ? colors.foreground : colors.mutedForeground }]}>{serverUrl ?? "Not configured"}</Text>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Mode</Text>
          <Text style={[styles.infoValue, { color: offlineMode ? colors.accent : colors.success }]}>{offlineMode ? "Offline (cached data)" : "Online (live server)"}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 120, gap: 8 },
  kicker: { fontFamily: "JetBrainsMono_500Medium", fontSize: 11, letterSpacing: 2 },
  h1: { fontFamily: "Rajdhani_700Bold", fontSize: 34, letterSpacing: 0.5 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginTop: 2, marginBottom: 8 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "JetBrainsMono_400Regular", fontSize: 13 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  statusMsg: { fontFamily: "Inter_500Medium", fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8 },
  btnText: { fontFamily: "Rajdhani_600SemiBold", fontSize: 15 },
  divider: { height: 1, marginVertical: 16 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  infoBox: { borderWidth: 1, borderRadius: 8, padding: 14, marginTop: 8, gap: 2 },
  infoLabel: { fontFamily: "JetBrainsMono_500Medium", fontSize: 10, letterSpacing: 1 },
  infoValue: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
