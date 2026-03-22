import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FreeSlot } from "../types/event";

interface Props {
  slot: FreeSlot;
  onBook?: () => void;
}

export default function FreeSlotCard({ slot, onBook }: Props) {
  const startTime = formatTime(slot.start);
  const endTime = formatTime(slot.end);

  const hours = Math.floor(slot.durationMinutes / 60);
  const mins = slot.durationMinutes % 60;
  const durationLabel =
    hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

  const isLong = slot.durationMinutes >= 90;

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <View style={styles.body}>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={14} color="#00D9A5" style={{ marginRight: 6 }} />
          <Text style={styles.timeText}>{startTime}</Text>
          <Text style={styles.separator}> — </Text>
          <Text style={styles.timeText}>{endTime}</Text>
        </View>
        <Text style={styles.label}>Free window</Text>
      </View>
      <View style={[styles.durationBadge, isLong && styles.durationBadgeLong]}>
        <Text style={[styles.durationText, isLong && styles.durationTextLong]}>
          {durationLabel}
        </Text>
      </View>
      {onBook && (
        <TouchableOpacity style={styles.bookBtn} onPress={onBook} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color="#00D9A5" />
        </TouchableOpacity>
      )}
    </View>
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
    backgroundColor: "#0E1E18",
    borderRadius: 14,
    marginVertical: 5,
    marginHorizontal: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#152A22",
    shadowColor: "#00D9A5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: "#00D9A5",
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 13,
    gap: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    color: "#00D9A5",
    fontSize: 15,
    fontWeight: "600",
  },
  separator: {
    color: "#2A7A62",
    fontSize: 15,
    fontWeight: "400",
  },
  label: {
    color: "#336A56",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  durationBadge: {
    marginRight: 8,
    backgroundColor: "rgba(0,217,165,0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(0,217,165,0.2)",
  },
  durationBadgeLong: {
    backgroundColor: "rgba(0,217,165,0.18)",
    borderColor: "rgba(0,217,165,0.35)",
  },
  durationText: {
    color: "#00D9A5",
    fontSize: 13,
    fontWeight: "700",
  },
  durationTextLong: {
    color: "#00EDB5",
  },
  bookBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(0,217,165,0.15)",
    borderWidth: 1,
    borderColor: "rgba(0,217,165,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
});
