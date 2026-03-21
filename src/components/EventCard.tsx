import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UnifiedEvent } from "../types/event";

interface Props {
  event: UnifiedEvent;
  onPress?: () => void;
}

export default function EventCard({ event, onPress }: Props) {
  const isGoogle = event.source === "google";
  const accentColor = isGoogle ? "#4285F4" : "#2884E0";
  const startTime = formatTime(event.start);
  const endTime = formatTime(event.end);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.72 : 1}
      style={styles.card}
    >
      {/* Colored left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        {/* Top row: title + source badge */}
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <View style={[styles.sourceBadge, { backgroundColor: `${accentColor}20` }]}>
            <Text style={[styles.sourceText, { color: accentColor }]}>
              {isGoogle ? "Google" : "Outlook"}
            </Text>
          </View>
        </View>

        {/* Time row */}
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color="#5C5C80" style={{ marginRight: 5 }} />
          <Text style={styles.timeText}>
            {event.isAllDay ? "All day" : `${startTime} — ${endTime}`}
          </Text>
        </View>

        {/* Location row */}
        {event.location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color="#5C5C80" style={{ marginRight: 5 }} />
            <Text style={styles.locationText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Chevron */}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color="#3C3C5E" style={styles.chevron} />
      )}
    </TouchableOpacity>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141424",
    borderRadius: 14,
    marginVertical: 5,
    marginHorizontal: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E1E32",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
  },
  body: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 13,
    gap: 5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  title: {
    color: "#EEEEFF",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.1,
  },
  sourceBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    color: "#7878A8",
    fontSize: 12,
    fontWeight: "500",
  },
  locationText: {
    color: "#7878A8",
    fontSize: 12,
    flex: 1,
  },
  chevron: {
    marginRight: 12,
  },
});
