import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { UnifiedEvent } from "../types/event";

export type RootStackParamList = {
  Tabs: undefined;
  EventDetail: { event: UnifiedEvent };
};

type EventDetailRouteProp = RouteProp<RootStackParamList, "EventDetail">;

export default function EventDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<EventDetailRouteProp>();
  const { event } = route.params;

  const accentColor = event.source === "google" ? "#4285F4" : "#00A4EF";
  const sourceLabel = event.source === "google" ? "Google Calendar" : "Outlook Calendar";
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

  const durationText = event.isAllDay ? null : formatDuration(startDate, endDate);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Colored header banner */}
      <View style={[styles.banner, { backgroundColor: accentColor }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.bannerTitle} numberOfLines={3}>
          {event.title}
        </Text>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>
            {sourceIcon} {sourceLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionIcon}>📅</Text>
          <View style={styles.sectionContent}>
            <Text style={styles.sectionLabel}>Date</Text>
            <Text style={styles.sectionValue}>{formattedDate}</Text>
            {!event.isAllDay && (
              <>
                <Text style={styles.sectionLabel}>Time</Text>
                <Text style={styles.sectionValue}>
                  {formattedStart} — {formattedEnd}
                </Text>
              </>
            )}
            {event.isAllDay && (
              <Text style={styles.sectionValue}>All day</Text>
            )}
            {durationText && (
              <Text style={styles.duration}>⏱ {durationText}</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Location */}
        {event.location ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionIcon}>📍</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionLabel}>Location</Text>
                <Text style={styles.sectionValue}>{event.location}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}

        {/* Description */}
        {event.description ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionIcon}>📝</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionLabel}>Description</Text>
                <Text style={styles.descriptionText}>{event.description}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionIcon}>👥</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionLabel}>
                  Attendees ({event.attendees.length})
                </Text>
                {event.attendees.map((attendee, index) => (
                  <View key={index} style={styles.attendeeRow}>
                    <View style={[styles.avatarDot, { backgroundColor: accentColor }]} />
                    <Text style={styles.attendeeName}>{attendee}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}

        {/* No extra details fallback */}
        {!event.location && !event.description && (!event.attendees || event.attendees.length === 0) && (
          <Text style={styles.noDetails}>No additional details available.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function formatDuration(start: Date, end: Date): string {
  const totalMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (totalMinutes <= 0) return "";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  banner: {
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: "flex-start",
    padding: 4,
  },
  backIcon: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "700",
  },
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
  sourceBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  body: {
    flex: 1,
    paddingTop: 8,
  },
  section: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "flex-start",
  },
  sectionIcon: {
    fontSize: 22,
    marginRight: 14,
    marginTop: 2,
  },
  sectionContent: {
    flex: 1,
  },
  sectionLabel: {
    color: "#6C6C8A",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 8,
  },
  sectionValue: {
    color: "#ECECEC",
    fontSize: 15,
    fontWeight: "500",
  },
  duration: {
    color: "#9E9EC8",
    fontSize: 13,
    marginTop: 6,
  },
  descriptionText: {
    color: "#C0C0D8",
    fontSize: 14,
    lineHeight: 22,
  },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  avatarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  attendeeName: {
    color: "#ECECEC",
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A3E",
    marginHorizontal: 20,
  },
  noDetails: {
    color: "#555570",
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
  },
});
