import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import FreeSlotCard from "../components/FreeSlotCard";
import { useCalendarEvents } from "../hooks/useCalendarEvents";

export default function FreeTimeScreen() {
  const today = new Date().toISOString().substring(0, 10);
  const [selectedDate] = useState(today);
  const { data, isLoading, error, refetch, isFetching } = useCalendarEvents(selectedDate);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Free Time</Text>
          <Text style={styles.subtitle}>{formatHeader(selectedDate)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Text style={styles.refreshIcon}>🔄</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#4CAF50"
          style={{ marginTop: 40 }}
        />
      ) : error ? (
        <Text style={styles.errorText}>Failed to load events</Text>
      ) : data && data.freeSlots.length > 0 ? (
        <FlatList
          data={data.freeSlots}
          keyExtractor={(_, i) => `slot-${i}`}
          renderItem={({ item }) => <FreeSlotCard slot={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
          ListHeaderComponent={
            <Text style={styles.slotsLabel}>
              {data.freeSlots.length} free slot
              {data.freeSlots.length > 1 ? "s" : ""} today
            </Text>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>😅</Text>
          <Text style={styles.emptyText}>No free time today</Text>
        </View>
      )}
    </View>
  );
}

function formatHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#A0A0B8",
    fontSize: 14,
    marginTop: 4,
  },
  refreshBtn: {
    padding: 8,
  },
  refreshIcon: {
    fontSize: 22,
  },
  slotsLabel: {
    color: "#81C784",
    fontSize: 13,
    fontWeight: "600",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
  },
  errorText: {
    color: "#EF5350",
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
});
