/**
 * Settings screen — configure the Engram server URL.
 *
 * Supports:
 * - localhost (offline, desktop on same device or ADB port-forward)
 * - Local network IP (e.g. 192.168.1.x) for same-WiFi access
 * - Any remote/cloud server URL
 */
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useMobileI18n } from "@/i18n";
import { DEFAULT_SERVER_URL, useServer } from "@/context/server-context";

const PRESETS = [
  { label: "Localhost (same device)", url: "http://localhost:5000" },
  { label: "Local network (edit IP)", url: "http://192.168.1.100:5000" },
  { label: "Custom / Cloud", url: "" },
];

type StatusColor = { bg: string; text: string; icon: "wifi" | "wifi-off" | "loader" | "help-circle" };

function statusStyle(status: string, colors: ReturnType<typeof useColors>): StatusColor {
  switch (status) {
    case "connected":   return { bg: `${colors.success}22`, text: colors.success,        icon: "wifi" };
    case "unreachable": return { bg: `${colors.destructive}22`, text: colors.destructive, icon: "wifi-off" };
    case "checking":    return { bg: `${colors.primary}22`, text: colors.primary,         icon: "loader" };
    default:            return { bg: `${colors.muted}`, text: colors.mutedForeground,     icon: "help-circle" };
  }
}

export default function SettingsScreen() {
  const { t } = useMobileI18n();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { serverUrl, connectionStatus, updateServerUrl, checkConnection } = useServer();
  const [inputUrl, setInputUrl] = useState(serverUrl);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const st = statusStyle(connectionStatus, colors);

  useEffect(() => { setInputUrl(serverUrl); }, [serverUrl]);

  const onSave = async () => {
    await updateServerUrl(inputUrl);
    await checkConnection();
  };

  const onPreset = async (url: string) => {
    if (!url) return;
    setInputUrl(url);
    await updateServerUrl(url);
    await checkConnection();
  };

  const statusLabel: Record<string, string> = {
    unknown: "Not checked",
    checking: "Checking...",
    connected: "Connected",
    unreachable: "Unreachable",
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topPad + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={[styles.kicker, { color: colors.primary }]}>CONFIGURATION</Text>
        <Text style={[styles.h1, { color: colors.foreground }]}>Server</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Point the app at a running Engram server. Use localhost for offline / desktop mode.
        </Text>

        {/* Status pill */}
        <View style={[styles.statusPill, { backgroundColor: st.bg, borderColor: st.text }]}>
          {connectionStatus === "checking" ? (
            <ActivityIndicator color={st.text} size="small" />
          ) : (
            <Feather name={st.icon} size={14} color={st.text} />
          )}
          <Text style={[styles.statusText, { color: st.text }]}>
            {statusLabel[connectionStatus]}  ·  {serverUrl}
          </Text>
        </View>

        {/* URL Input */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Server URL</Text>
        <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="http://localhost:5000"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
        </View>

        {/* Save + Test buttons */}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={onSave}
          >
            <Feather name="save" size={15} color={colors.primaryForeground} />
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Save & Test</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={checkConnection}
          >
            <Feather name="refresh-cw" size={15} color={colors.foreground} />
            <Text style={[styles.btnText, { color: colors.foreground }]}>Retest</Text>
          </Pressable>
        </View>

        {/* Presets */}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 28 }]}>Quick Presets</Text>
        {PRESETS.map((p) => (
          <Pressable
            key={p.label}
            style={[styles.preset, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => p.url ? onPreset(p.url) : null}
          >
            <Text style={[styles.presetLabel, { color: colors.foreground }]}>{p.label}</Text>
            {p.url ? (
              <Text style={[styles.presetUrl, { color: colors.mutedForeground }]}>{p.url}</Text>
            ) : (
              <Text style={[styles.presetUrl, { color: colors.primary }]}>Enter URL above</Text>
            )}
          </Pressable>
        ))}

        {/* Offline note */}
        <View style={[styles.note, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.primary} style={{ marginTop: 2 }} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            <Text style={{ color: colors.foreground, fontFamily: "JetBrainsMono_500Medium" }}>
              Offline / local mode:{" "}
            </Text>
            Run the ENGRAM desktop app on the same machine, enable ADB USB debugging or set up port forwarding, and use{" "}
            <Text style={{ color: colors.primary, fontFamily: "JetBrainsMono_500Medium" }}>
              http://localhost:5000
            </Text>
            . On the same WiFi network, use your machine's local IP (e.g.{" "}
            <Text style={{ color: colors.primary, fontFamily: "JetBrainsMono_500Medium" }}>
              http://192.168.x.x:5000
            </Text>
            ).
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 120, gap: 6 },
  kicker: { fontFamily: "JetBrainsMono_500Medium", fontSize: 11, letterSpacing: 2, marginBottom: 2 },
  h1: { fontFamily: "Rajdhani_700Bold", fontSize: 34, letterSpacing: 0.5, marginBottom: 4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginBottom: 16 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 20,
  },
  statusText: { fontFamily: "JetBrainsMono_400Regular", fontSize: 11, flex: 1 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  inputRow: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 2 },
  input: { fontFamily: "JetBrainsMono_400Regular", fontSize: 13, paddingVertical: 10 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, flex: 1, justifyContent: "center" },
  btnPrimary: {},
  btnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  preset: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
  presetLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  presetUrl: { fontFamily: "JetBrainsMono_400Regular", fontSize: 11, marginTop: 2 },
  note: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 8, padding: 14, marginTop: 24 },
  noteText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, flex: 1 },
});
