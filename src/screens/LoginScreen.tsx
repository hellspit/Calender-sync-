import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useAuth } from "../auth/AuthContext";

export default function LoginScreen() {
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.logo}>📅</Text>
      <Text style={styles.title}>Unified Calendar</Text>
      <Text style={styles.subtitle}>
        Connect your calendars to see all your events in one place.
      </Text>

      {/* Auth error banner */}
      {authError ? (
        <Pressable style={styles.errorBanner} onPress={clearAuthError}>
          <Text style={styles.errorText}>{authError}</Text>
          <Text style={styles.errorDismiss}>✕</Text>
        </Pressable>
      ) : null}

      {/* Google */}
      {isGoogleConnected ? (
        <View style={styles.connectedRow}>
          <View style={styles.connectedInfo}>
            <Text style={styles.btnIcon}>G</Text>
            <Text style={styles.connectedText}>Google Connected ✓</Text>
          </View>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={logoutGoogle}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.googleBtn]}
          onPress={loginGoogle}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>G</Text>
          <Text style={styles.btnText}>Sign in with Google</Text>
        </TouchableOpacity>
      )}

      {/* Microsoft */}
      {isMicrosoftConnected ? (
        <View style={styles.connectedRow}>
          <View style={styles.connectedInfo}>
            <Text style={styles.btnIcon}>⊞</Text>
            <Text style={styles.connectedText}>Microsoft Connected ✓</Text>
          </View>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={logoutMicrosoft}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.microsoftBtn]}
          onPress={loginMicrosoft}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>⊞</Text>
          <Text style={styles.btnText}>Sign in with Microsoft</Text>
        </TouchableOpacity>
      )}

      {/* Status */}
      {(isGoogleConnected || isMicrosoftConnected) && (
        <Text style={styles.hint}>
          Switch to the Calendar tab to view your events →
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: "#A0A0B8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 16,
  },
  googleBtn: {
    backgroundColor: "#4285F4",
  },
  microsoftBtn: {
    backgroundColor: "#00A4EF",
  },
  connected: {
    backgroundColor: "#2E7D32",
  },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "#1E3A1E",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  connectedInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectedText: {
    color: "#66BB6A",
    fontSize: 15,
    fontWeight: "600",
  },
  signOutBtn: {
    backgroundColor: "#4E1A1A",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  signOutText: {
    color: "#FF8A80",
    fontSize: 13,
    fontWeight: "600",
  },
  btnIcon: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginRight: 12,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    color: "#6C63FF",
    fontSize: 13,
    marginTop: 24,
    textAlign: "center",
  },
  errorBanner: {
    width: "100%",
    backgroundColor: "#4E1A1A",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "#FF8A80",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  errorDismiss: {
    color: "#FF8A80",
    fontSize: 16,
    marginLeft: 8,
  },
});
