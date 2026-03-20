import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { UnifiedEvent } from "../types/event";

interface Props {
  event: UnifiedEvent;
}

export default function EventCard({ event }: Props) {
  const borderColor = event.source === "google" ? "#4285F4" : "#00A4EF";
  const sourceLabel = event.source === "google" ? "Google" : "Outlook";
  const startTime = formatTime(event.start);
  const endTime = formatTime(event.end);

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: borderColor }]}>
          <Text style={styles.badgeText}>{sourceLabel}</Text>
        </View>
      </View>

      <Text style={styles.time}>
        {event.isAllDay ? "All day" : `${startTime} — ${endTime}`}
      </Text>

      {event.location ? (
        <Text style={styles.location} numberOfLines={1}>
          📍 {event.location}
        </Text>
      ) : null}
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E1E2E",
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: "#ECECEC",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  time: {
    color: "#A0A0B8",
    fontSize: 13,
    marginTop: 2,
  },
  location: {
    color: "#A0A0B8",
    fontSize: 12,
    marginTop: 4,
  },
});
