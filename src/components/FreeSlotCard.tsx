import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FreeSlot } from "../types/event";

interface Props {
  slot: FreeSlot;
}

export default function FreeSlotCard({ slot }: Props) {
  const startTime = formatTime(slot.start);
  const endTime = formatTime(slot.end);

  const hours = Math.floor(slot.durationMinutes / 60);
  const mins = slot.durationMinutes % 60;
  const durationLabel =
    hours > 0
      ? mins > 0
        ? `${hours}h ${mins}m`
        : `${hours}h`
      : `${mins}m`;

  return (
    <View style={styles.card}>
      <View style={styles.timeBadge}>
        <Text style={styles.timeText}>{startTime}</Text>
        <Text style={styles.dash}>—</Text>
        <Text style={styles.timeText}>{endTime}</Text>
      </View>
      <Text style={styles.duration}>{durationLabel} free</Text>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1A2E1A",
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    marginHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    color: "#81C784",
    fontSize: 15,
    fontWeight: "600",
  },
  dash: {
    color: "#66BB6A",
    marginHorizontal: 6,
    fontSize: 15,
  },
  duration: {
    color: "#A5D6A7",
    fontSize: 13,
    fontWeight: "500",
  },
});
