import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import CalendarView from "../components/CalendarView";
import EventCard from "../components/EventCard";
import { useCalendarEvents } from "../hooks/useCalendarEvents";

export default function CalendarScreen() {
  const today = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const { data, isLoading, error, refetch, isFetching } = useCalendarEvents(selectedDate);

  return (
    <View style={styles.container}>
      {/* Monthly calendar */}
      <CalendarView
        selectedDate={selectedDate}
        events={data?.events ?? []}
        onSelectDate={setSelectedDate}
      />

      {/* Date header + refresh button */}
      <View style={styles.headerRow}>
        <Text style={styles.dateHeader}>{formatHeader(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color="#6C63FF" />
          ) : (
            <Text style={styles.refreshIcon}>🔄</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Event list */}
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#6C63FF"
          style={{ marginTop: 20 }}
        />
      ) : error ? (
        <Text style={styles.errorText}>Failed to load events</Text>
      ) : data && data.events.length > 0 ? (
        <FlatList
          data={data.events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventCard event={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <Text style={styles.emptyText}>No events for this day 🎉</Text>
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
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  dateHeader: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: 8,
  },
  refreshIcon: {
    fontSize: 20,
  },
  emptyText: {
    color: "#888",
    textAlign: "center",
    marginTop: 32,
    fontSize: 15,
  },
  errorText: {
    color: "#EF5350",
    textAlign: "center",
    marginTop: 32,
    fontSize: 15,
  },
});
