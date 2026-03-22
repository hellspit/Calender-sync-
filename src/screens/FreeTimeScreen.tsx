import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FreeSlotCard from "../components/FreeSlotCard";
import AddEventModal, { AddTarget } from "../components/AddEventModal";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { FreeSlot } from "../types/event";

export default function FreeTimeScreen() {
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const { data, isLoading, error, refetch, isFetching } = useCalendarEvents(selectedDate);

  // "Book this slot" state
  const [bookSlot, setBookSlot] = useState<FreeSlot | null>(null);

  const totalFreeMinutes = data?.freeSlots.reduce((sum, s) => sum + s.durationMinutes, 0) ?? 0;
  const totalHours = Math.floor(totalFreeMinutes / 60);
  const totalMins = totalFreeMinutes % 60;
  const totalLabel =
    totalFreeMinutes === 0
      ? "—"
      : totalHours > 0
      ? totalMins > 0
        ? `${totalHours}h ${totalMins}m`
        : `${totalHours}h`
      : `${totalMins}m`;

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  const goToToday = () => setSelectedDate(today);
  const isToday = selectedDate === today;

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const handleBookSlot = (slot: FreeSlot) => {
    setBookSlot(slot);
  };

  // Extract start time as HH:MM from the slot's ISO string
  const slotStartTime = bookSlot
    ? (() => { const d = new Date(bookSlot.start); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })()
    : "10:00";
  const slotEndTime = bookSlot
    ? (() => { const d = new Date(bookSlot.end); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })()
    : "11:00";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Free Time</Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn} activeOpacity={0.7}>
          {isFetching ? (
            <ActivityIndicator size="small" color="#00D9A5" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#7878A8" />
          )}
        </TouchableOpacity>
      </View>

      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.navArrow} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#7C6EFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} activeOpacity={0.8}>
          <Text style={styles.dateLabel}>{formatHeader(selectedDate)}</Text>
          {!isToday && <Text style={styles.todayHint}>Tap for today</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextDay} style={styles.navArrow} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={22} color="#7C6EFF" />
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      {!isLoading && !error && data && data.freeSlots.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{data.freeSlots.length}</Text>
            <Text style={styles.summaryLabel}>
              {data.freeSlots.length === 1 ? "slot" : "slots"}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalLabel}</Text>
            <Text style={styles.summaryLabel}>total free</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{data.events.length}</Text>
            <Text style={styles.summaryLabel}>events</Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00D9A5" />
          <Text style={styles.loadingText}>Calculating free time…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={36} color="#FF5C6A" />
          <Text style={styles.errorText}>Failed to load events</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : data && data.freeSlots.length > 0 ? (
        <FlatList
          data={data.freeSlots}
          keyExtractor={(_, i) => `slot-${i}`}
          renderItem={({ item }) => (
            <FreeSlotCard slot={item} onBook={() => handleBookSlot(item)} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={onRefresh}
              tintColor="#00D9A5"
              colors={["#00D9A5"]}
              progressBackgroundColor="#141424"
            />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              Available windows {isToday ? "today" : formatShort(selectedDate)}
            </Text>
          }
        />
      ) : (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={32} color="#3C3C5E" />
          </View>
          <Text style={styles.emptyTitle}>Fully packed</Text>
          <Text style={styles.emptyText}>
            No free windows found for {isToday ? "today" : formatShort(selectedDate)}
          </Text>
        </View>
      )}

      {/* Book slot modal */}
      {bookSlot && (
        <AddEventModal
          visible={bookSlot !== null}
          target={"both" as AddTarget}
          initialDate={selectedDate}
          initialStartTime={slotStartTime}
          initialEndTime={slotEndTime}
          onClose={() => setBookSlot(null)}
          onSuccess={() => refetch()}
        />
      )}
    </View>
  );
}

function formatHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C0C16",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: "#F0EEFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#141424",
    borderWidth: 1,
    borderColor: "#1E1E34",
    alignItems: "center",
    justifyContent: "center",
  },
  // Date navigation
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: "#111120",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1A1A2E",
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    color: "#D8D8F0",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  todayHint: {
    color: "#7C6EFF",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  // Summary card
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E1E18",
    borderRadius: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#152A22",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    color: "#00D9A5",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  summaryLabel: {
    color: "#336A56",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#1E3A2E",
  },
  listHeader: {
    color: "#4A4A6E",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 18,
    marginBottom: 6,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
    gap: 10,
  },
  loadingText: {
    color: "#5A5A7A",
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: "#FF5C6A",
    fontSize: 15,
    marginTop: 8,
    fontWeight: "500",
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: "rgba(255,92,106,0.1)",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,92,106,0.2)",
  },
  retryText: { color: "#FF5C6A", fontSize: 13, fontWeight: "600" },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#141424",
    borderWidth: 1,
    borderColor: "#1E1E34",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#EEEEFF",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: "#4A4A6E",
    fontSize: 13,
  },
});
