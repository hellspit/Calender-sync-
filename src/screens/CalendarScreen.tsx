import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  StatusBar,
} from "react-native";
import CalendarView from "../components/CalendarView";
import EventCard from "../components/EventCard";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { UnifiedEvent } from "../types/event";

export default function CalendarScreen() {
  const today = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
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
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => setSelectedEvent(item)} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <Text style={styles.emptyText}>No events for this day 🎉</Text>
      )}

      {/* Event Detail Modal */}
      <Modal
        visible={selectedEvent !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedEvent(null)}
      >
        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// ─── Inline Event Detail Modal ────────────────────────────────────────────────

function EventDetailModal({
  event,
  onClose,
}: {
  event: UnifiedEvent;
  onClose: () => void;
}) {
  const accentColor = event.source === "google" ? "#4285F4" : "#00A4EF";
  const sourceLabel =
    event.source === "google" ? "Google Calendar" : "Outlook Calendar";
  const sourceIcon = event.source === "google" ? "🔵" : "🔷";

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  const formattedDate = startDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedStart = event.isAllDay
    ? "All day"
    : startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formattedEnd = event.isAllDay
    ? ""
    : endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const durationText = event.isAllDay
    ? null
    : formatDuration(startDate, endDate);

  return (
    <View style={modal.container}>
      <StatusBar barStyle="light-content" />

      {/* Colored banner */}
      <View style={[modal.banner, { backgroundColor: accentColor }]}>
        <TouchableOpacity
          style={modal.closeBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={modal.closeText}>✕ Close</Text>
        </TouchableOpacity>
        <Text style={modal.bannerTitle} numberOfLines={3}>
          {event.title}
        </Text>
        <View style={modal.sourceBadge}>
          <Text style={modal.sourceBadgeText}>
            {sourceIcon} {sourceLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        style={modal.body}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date & Time */}
        <View style={modal.section}>
          <Text style={modal.sectionIcon}>📅</Text>
          <View style={modal.sectionContent}>
            <Text style={modal.sectionLabel}>Date</Text>
            <Text style={modal.sectionValue}>{formattedDate}</Text>
            {!event.isAllDay && (
              <>
                <Text style={modal.sectionLabel}>Time</Text>
                <Text style={modal.sectionValue}>
                  {formattedStart} — {formattedEnd}
                </Text>
              </>
            )}
            {event.isAllDay && (
              <Text style={modal.sectionValue}>All day</Text>
            )}
            {durationText && (
              <Text style={modal.duration}>⏱ {durationText}</Text>
            )}
          </View>
        </View>

        <View style={modal.divider} />

        {/* Location */}
        {event.location ? (
          <>
            <View style={modal.section}>
              <Text style={modal.sectionIcon}>📍</Text>
              <View style={modal.sectionContent}>
                <Text style={modal.sectionLabel}>Location</Text>
                <Text style={modal.sectionValue}>{event.location}</Text>
              </View>
            </View>
            <View style={modal.divider} />
          </>
        ) : null}

        {/* Description */}
        {event.description ? (
          <>
            <View style={modal.section}>
              <Text style={modal.sectionIcon}>📝</Text>
              <View style={modal.sectionContent}>
                <Text style={modal.sectionLabel}>Description</Text>
                <Text style={modal.descriptionText}>{event.description}</Text>
              </View>
            </View>
            <View style={modal.divider} />
          </>
        ) : null}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 ? (
          <>
            <View style={modal.section}>
              <Text style={modal.sectionIcon}>👥</Text>
              <View style={modal.sectionContent}>
                <Text style={modal.sectionLabel}>
                  Attendees ({event.attendees.length})
                </Text>
                {event.attendees.map((attendee, index) => (
                  <View key={index} style={modal.attendeeRow}>
                    <View
                      style={[
                        modal.avatarDot,
                        { backgroundColor: accentColor },
                      ]}
                    />
                    <Text style={modal.attendeeName}>{attendee}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={modal.divider} />
          </>
        ) : null}

        {!event.location &&
          !event.description &&
          (!event.attendees || event.attendees.length === 0) && (
            <Text style={modal.noDetails}>
              No additional details available.
            </Text>
          )}
      </ScrollView>
    </View>
  );
}

function formatDuration(start: Date, end: Date): string {
  const totalMinutes = Math.round(
    (end.getTime() - start.getTime()) / 60000
  );
  if (totalMinutes <= 0) return "";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function formatHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  dateHeader: { color: "#fff", fontSize: 18, fontWeight: "700" },
  refreshBtn: { padding: 8 },
  refreshIcon: { fontSize: 20 },
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

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  banner: {
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  closeBtn: { marginBottom: 12, alignSelf: "flex-start", padding: 4 },
  closeText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  bannerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
    marginBottom: 12,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sourceBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  body: { flex: 1, paddingTop: 8 },
  section: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "flex-start",
  },
  sectionIcon: { fontSize: 22, marginRight: 14, marginTop: 2 },
  sectionContent: { flex: 1 },
  sectionLabel: {
    color: "#6C6C8A",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 8,
  },
  sectionValue: { color: "#ECECEC", fontSize: 15, fontWeight: "500" },
  duration: { color: "#9E9EC8", fontSize: 13, marginTop: 6 },
  descriptionText: { color: "#C0C0D8", fontSize: 14, lineHeight: 22 },
  attendeeRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  avatarDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  attendeeName: { color: "#ECECEC", fontSize: 14 },
  divider: { height: 1, backgroundColor: "#2A2A3E", marginHorizontal: 20 },
  noDetails: {
    color: "#555570",
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
  },
});
