import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const {
    isGoogleConnected,
    isMicrosoftConnected,
    isLoading,
    loginGoogle,
    loginMicrosoft,
    logoutGoogle,
    logoutMicrosoft,
    authError,
    clearAuthError,
  } = useAuth();

  const connectedCount = (isGoogleConnected ? 1 : 0) + (isMicrosoftConnected ? 1 : 0);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C6EFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <View style={styles.logoBg}>
              <Ionicons name="calendar" size={36} color="#7C6EFF" />
            </View>
          </View>
          <Text style={styles.appName}>Unified Calendar</Text>
          <Text style={styles.tagline}>All your events, one beautiful view.</Text>
        </View>

        {/* Status pill */}
        {connectedCount > 0 && (
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {connectedCount} account{connectedCount > 1 ? "s" : ""} connected
            </Text>
          </View>
        )}

        {/* Error banner */}
        {authError ? (
          <Pressable style={styles.errorBanner} onPress={clearAuthError}>
            <Ionicons name="alert-circle" size={16} color="#FF5C6A" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{authError}</Text>
            <Ionicons name="close" size={16} color="#FF5C6A" style={{ marginLeft: 8 }} />
          </Pressable>
        ) : null}

        {/* Section label */}
        <Text style={styles.sectionLabel}>Connected Accounts</Text>

        {/* Google card */}
        {isGoogleConnected ? (
          <View style={[styles.providerCard, styles.connectedCard]}>
            <View style={styles.providerLeft}>
              <View style={[styles.providerIcon, { backgroundColor: "rgba(66,133,244,0.15)" }]}>
                <Text style={[styles.providerIconText, { color: "#4285F4" }]}>G</Text>
              </View>
              <View>
                <Text style={styles.providerName}>Google Calendar</Text>
                <View style={styles.connectedBadge}>
                  <View style={styles.greenDot} />
                  <Text style={styles.connectedBadgeText}>Connected</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.disconnectBtn} onPress={logoutGoogle}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.providerCard, styles.signInCard]}
            onPress={loginGoogle}
            activeOpacity={0.8}
          >
            <View style={styles.providerLeft}>
              <View style={[styles.providerIcon, { backgroundColor: "rgba(66,133,244,0.15)" }]}>
                <Text style={[styles.providerIconText, { color: "#4285F4" }]}>G</Text>
              </View>
              <View>
                <Text style={styles.providerName}>Google Calendar</Text>
                <Text style={styles.providerSub}>Tap to connect</Text>
              </View>
            </View>
            <View style={[styles.connectBtn, { backgroundColor: "rgba(66,133,244,0.15)" }]}>
              <Ionicons name="add" size={16} color="#4285F4" />
            </View>
          </TouchableOpacity>
        )}

        {/* Microsoft card */}
        {isMicrosoftConnected ? (
          <View style={[styles.providerCard, styles.connectedCard]}>
            <View style={styles.providerLeft}>
              <View style={[styles.providerIcon, { backgroundColor: "rgba(40,132,224,0.15)" }]}>
                <Text style={[styles.providerIconText, { color: "#2884E0" }]}>⊞</Text>
              </View>
              <View>
                <Text style={styles.providerName}>Outlook Calendar</Text>
                <View style={styles.connectedBadge}>
                  <View style={styles.greenDot} />
                  <Text style={styles.connectedBadgeText}>Connected</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.disconnectBtn} onPress={logoutMicrosoft}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.providerCard, styles.signInCard]}
            onPress={loginMicrosoft}
            activeOpacity={0.8}
          >
            <View style={styles.providerLeft}>
              <View style={[styles.providerIcon, { backgroundColor: "rgba(40,132,224,0.15)" }]}>
                <Text style={[styles.providerIconText, { color: "#2884E0" }]}>⊞</Text>
              </View>
              <View>
                <Text style={styles.providerName}>Outlook Calendar</Text>
                <Text style={styles.providerSub}>Tap to connect</Text>
              </View>
            </View>
            <View style={[styles.connectBtn, { backgroundColor: "rgba(40,132,224,0.15)" }]}>
              <Ionicons name="add" size={16} color="#2884E0" />
            </View>
          </TouchableOpacity>
        )}

        {/* CTA */}
        {connectedCount > 0 ? (
          <View style={styles.ctaBox}>
            <Ionicons name="checkmark-circle" size={18} color="#00D9A5" style={{ marginRight: 8 }} />
            <Text style={styles.ctaText}>
              Switch to the Calendar tab to view your events
            </Text>
          </View>
        ) : (
          <View style={styles.ctaBox}>
            <Ionicons name="information-circle-outline" size={18} color="#7878A8" style={{ marginRight: 8 }} />
            <Text style={[styles.ctaText, { color: "#7878A8" }]}>
              Connect at least one account to get started
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0C0C16",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#0C0C16",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 36,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(124,110,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    color: "#F0EEFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    color: "#7878A8",
    fontSize: 14,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(0,217,165,0.1)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0,217,165,0.2)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00D9A5",
    marginRight: 7,
  },
  statusText: {
    color: "#00D9A5",
    fontSize: 12,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,92,106,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,92,106,0.25)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: "#FF5C6A",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  sectionLabel: {
    color: "#4A4A6E",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  connectedCard: {
    backgroundColor: "#141424",
    borderColor: "#242440",
  },
  signInCard: {
    backgroundColor: "#141424",
    borderColor: "#242440",
  },
  providerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  providerIconText: {
    fontSize: 18,
    fontWeight: "800",
  },
  providerName: {
    color: "#F0EEFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  providerSub: {
    color: "#5A5A7A",
    fontSize: 12,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00D9A5",
  },
  connectedBadgeText: {
    color: "#00D9A5",
    fontSize: 12,
    fontWeight: "600",
  },
  connectBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  disconnectBtn: {
    backgroundColor: "rgba(255,92,106,0.1)",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,92,106,0.2)",
  },
  disconnectText: {
    color: "#FF5C6A",
    fontSize: 12,
    fontWeight: "600",
  },
  ctaBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,110,255,0.06)",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.12)",
  },
  ctaText: {
    color: "#00D9A5",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
    fontWeight: "500",
  },
});
