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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CalendarView from "../components/CalendarView";
import EventCard from "../components/EventCard";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { UnifiedEvent } from "../types/event";
import AddEventModal, { AddTarget } from "../components/AddEventModal";
import { useAuth } from "../auth/AuthContext";
import { updateGoogleEvent, deleteGoogleEvent } from "../services/googleCalendar";
import { updateOutlookEvent, deleteOutlookEvent } from "../services/outlookCalendar";
import { DatePickerField, TimePickerField } from "../components/PickerField";

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const { data, isLoading, error, refetch, isFetching } = useCalendarEvents(selectedDate);
  const { getValidGoogleToken, getValidMicrosoftToken } = useAuth();

  const handleEventUpdate = (updated: UnifiedEvent) => {
    setSelectedEvent(updated);
    refetch();
  };

  const handleEventDeleted = () => {
    setSelectedEvent(null);
    refetch();
  };

  const openAddModal = (target: AddTarget) => {
    setShowFabMenu(false);
    setAddTarget(target);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Monthly calendar */}
      <CalendarView
        selectedDate={selectedDate}
        events={data?.events ?? []}
        onSelectDate={setSelectedDate}
      />

      {/* Date header + refresh */}
      <View style={styles.headerRow}>
        <Text style={styles.dateHeader}>{formatHeader(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color="#7C6EFF" />
          ) : (
            <Ionicons name="refresh-outline" size={18} color="#7878A8" />
          )}
        </TouchableOpacity>
      </View>

      {/* Event count pill */}
      {!isLoading && data && data.events.length > 0 && (
        <Text style={styles.eventCountLabel}>
          {data.events.length} event{data.events.length > 1 ? "s" : ""}
        </Text>
      )}

      {/* Event list */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C6EFF" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={32} color="#FF5C6A" />
          <Text style={styles.errorText}>Failed to load events</Text>
        </View>
      ) : data && data.events.length > 0 ? (
        <FlatList
          data={data.events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => setSelectedEvent(item)} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 180, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => refetch()}
              tintColor="#7C6EFF"
              colors={["#7C6EFF"]}
              progressBackgroundColor="#141424"
            />
          }
        />
      ) : (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkmark-circle-outline" size={32} color="#3C3C5E" />
          </View>
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptyText}>No events for this day</Text>
        </View>
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
            onUpdate={handleEventUpdate}
            onDeleted={handleEventDeleted}
            getValidGoogleToken={getValidGoogleToken}
            getValidMicrosoftToken={getValidMicrosoftToken}
          />
        )}
      </Modal>

      {/* FAB backdrop */}
      {showFabMenu && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        />
      )}

      {/* FAB menu */}
      {showFabMenu && (
        <View style={[styles.fabMenu, { bottom: insets.bottom + 168 }]}>
          {[
            { target: "google" as AddTarget, label: "Add to Google", color: "#4285F4" },
            { target: "microsoft" as AddTarget, label: "Add to Microsoft", color: "#2884E0" },
            { target: "both" as AddTarget, label: "Add to Both", color: "#7C6EFF" },
          ].map(({ target, label, color }) => (
            <TouchableOpacity
              key={target}
              style={[styles.fabOption, { borderLeftColor: color }]}
              onPress={() => openAddModal(target)}
              activeOpacity={0.8}
            >
              <View style={[styles.fabOptionDot, { backgroundColor: `${color}25` }]}>
                <View style={[styles.fabOptionDotInner, { backgroundColor: color }]} />
              </View>
              <Text style={styles.fabOptionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* FAB button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
        onPress={() => setShowFabMenu(!showFabMenu)}
        activeOpacity={0.85}
      >
        <Ionicons name={showFabMenu ? "close" : "add"} size={26} color="#fff" />
      </TouchableOpacity>

      {/* Add Event Modal */}
      {addTarget && (
        <AddEventModal
          visible={addTarget !== null}
          target={addTarget}
          initialDate={selectedDate}
          onClose={() => setAddTarget(null)}
          onSuccess={() => refetch()}
        />
      )}
    </View>
  );
}

// ─── Event Detail Modal ────────────────────────────────────────────────────────

function EventDetailModal({
  event,
  onClose,
  onDeleted,
  onUpdate,
  getValidGoogleToken,
  getValidMicrosoftToken,
}: {
  event: UnifiedEvent;
  onClose: () => void;
  onDeleted: () => void;
  onUpdate: (updated: UnifiedEvent) => void;
  getValidGoogleToken: () => Promise<string | null>;
  getValidMicrosoftToken: () => Promise<string | null>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isGoogle = event.source === "google";
  const accentColor = isGoogle ? "#4285F4" : "#2884E0";

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

  if (isEditing) {
    return (
      <EditModal
        event={event}
        accentColor={accentColor}
        getValidGoogleToken={getValidGoogleToken}
        getValidMicrosoftToken={getValidMicrosoftToken}
        onCancel={() => setIsEditing(false)}
        onSave={(updated) => {
          onUpdate(updated);
          setIsEditing(false);
        }}
        onDeleted={onDeleted}
      />
    );
  }

  return (
    <View style={detail.container}>
      <StatusBar barStyle="light-content" />

      {/* Header banner */}
      <View style={[detail.banner, { borderBottomColor: accentColor }]}>
        <View style={detail.bannerTopRow}>
          <TouchableOpacity style={detail.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color="#7878A8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[detail.editBtn, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }]}
            onPress={() => setIsEditing(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={13} color={accentColor} style={{ marginRight: 5 }} />
            <Text style={[detail.editBtnText, { color: accentColor }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={[detail.sourcePill, { backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }]}>
          <View style={[detail.sourceDot, { backgroundColor: accentColor }]} />
          <Text style={[detail.sourcePillText, { color: accentColor }]}>
            {isGoogle ? "Google Calendar" : "Outlook Calendar"}
          </Text>
        </View>

        <Text style={detail.bannerTitle} numberOfLines={3}>
          {event.title}
        </Text>
      </View>

      <ScrollView
        style={detail.body}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date & Time */}
        <DetailSection icon="calendar-outline" iconColor="#7878A8">
          <Text style={detail.sectionLabel}>Date</Text>
          <Text style={detail.sectionValue}>{formattedDate}</Text>
          <Text style={detail.sectionLabel}>Time</Text>
          <Text style={detail.sectionValue}>
            {event.isAllDay ? "All day" : `${formattedStart} — ${formattedEnd}`}
          </Text>
          {durationText && (
            <View style={detail.durationPill}>
              <Ionicons name="time-outline" size={12} color="#7C6EFF" style={{ marginRight: 5 }} />
              <Text style={detail.durationText}>{durationText}</Text>
            </View>
          )}
        </DetailSection>

        <View style={detail.divider} />

        {/* Location */}
        <DetailSection icon="location-outline" iconColor="#7878A8">
          <Text style={detail.sectionLabel}>Location</Text>
          {event.location ? (
            <Text style={detail.sectionValue}>{event.location}</Text>
          ) : (
            <Text style={detail.emptyValue}>Not specified</Text>
          )}
        </DetailSection>

        <View style={detail.divider} />

        {/* Description */}
        <DetailSection icon="document-text-outline" iconColor="#7878A8">
          <Text style={detail.sectionLabel}>Description</Text>
          {event.description ? (
            <Text style={detail.descText}>{event.description}</Text>
          ) : (
            <Text style={detail.emptyValue}>No description</Text>
          )}
        </DetailSection>

        <View style={detail.divider} />

        {/* Attendees */}
        <DetailSection icon="people-outline" iconColor="#7878A8">
          <Text style={detail.sectionLabel}>
            Attendees{event.attendees && event.attendees.length > 0 ? ` (${event.attendees.length})` : ""}
          </Text>
          {event.attendees && event.attendees.length > 0 ? (
            event.attendees.map((a, i) => (
              <View key={i} style={detail.attendeeRow}>
                <View style={[detail.attendeeAvatar, { backgroundColor: `${accentColor}20` }]}>
                  <Text style={[detail.attendeeInitial, { color: accentColor }]}>
                    {a.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={detail.attendeeName}>{a}</Text>
              </View>
            ))
          ) : (
            <Text style={detail.emptyValue}>No attendees</Text>
          )}
        </DetailSection>
      </ScrollView>
    </View>
  );
}

function DetailSection({
  icon,
  iconColor,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={detail.section}>
      <Ionicons name={icon} size={18} color={iconColor} style={detail.sectionIcon} />
      <View style={detail.sectionContent}>{children}</View>
    </View>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  event,
  accentColor,
  onCancel,
  onSave,
  onDeleted,
  getValidGoogleToken,
  getValidMicrosoftToken,
}: {
  event: UnifiedEvent;
  accentColor: string;
  onCancel: () => void;
  onSave: (updated: UnifiedEvent) => void;
  onDeleted: () => void;
  getValidGoogleToken: () => Promise<string | null>;
  getValidMicrosoftToken: () => Promise<string | null>;
}) {
  const startD = new Date(event.start);
  const endD = new Date(event.end);
  const initDate = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, "0")}-${String(startD.getDate()).padStart(2, "0")}`;
  const initStartTime = `${String(startD.getHours()).padStart(2, "0")}:${String(startD.getMinutes()).padStart(2, "0")}`;
  const initEndTime = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`;

  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(initDate);
  const [startTime, setStartTime] = useState(event.isAllDay ? "00:00" : initStartTime);
  const [endTime, setEndTime] = useState(event.isAllDay ? "23:59" : initEndTime);
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const realEventId = event.id.replace(/^[gm]_/, "");

  const getDeviceOffset = (): string => {
    const totalMinutes = -new Date().getTimezoneOffset();
    const sign = totalMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(totalMinutes);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  };

  const handleSave = async () => {
    if (!event.isAllDay && startTime >= endTime) {
      Alert.alert("Invalid time", "End time must be after start time.");
      return;
    }
    setIsSaving(true);
    const offset = getDeviceOffset();
    const newStartISO = `${date}T${startTime || "00:00"}:00${offset}`;
    const newEndISO = `${date}T${endTime || "23:59"}:00${offset}`;

    const toNaive = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
    };

    try {
      if (event.source === "google") {
        const token = await getValidGoogleToken();
        if (token) {
          await updateGoogleEvent(token, realEventId, {
            title: title.trim() || event.title,
            location: location.trim() || "",
            description: description.trim() || "",
            startISO: newStartISO,
            endISO: newEndISO,
          });
        } else {
          Alert.alert("Error", "Google session expired.");
        }
      } else {
        const token = await getValidMicrosoftToken();
        if (token) {
          await updateOutlookEvent(token, realEventId, {
            title: title.trim() || event.title,
            location: location.trim() || "",
            description: description.trim() || "",
            startDateTime: toNaive(newStartISO),
            endDateTime: toNaive(newEndISO),
          });
        } else {
          Alert.alert("Error", "Microsoft session expired.");
        }
      }
      onSave({
        ...event,
        title: title.trim() || event.title,
        start: newStartISO,
        end: newEndISO,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });
      Alert.alert("Saved", "Event updated successfully.");
    } catch (err: any) {
      Alert.alert("Update failed", err?.response?.data?.error?.message || err?.message || "Could not update event.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Event",
      `Delete "${event.title}" from ${event.source === "google" ? "Google Calendar" : "Outlook Calendar"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              if (event.source === "google") {
                const token = await getValidGoogleToken();
                if (token) await deleteGoogleEvent(token, realEventId);
              } else {
                const token = await getValidMicrosoftToken();
                if (token) await deleteOutlookEvent(token, realEventId);
              }
              Alert.alert("Deleted", "Event removed.");
              onDeleted();
            } catch (err: any) {
              Alert.alert("Delete failed", err?.response?.data?.error?.message || err?.message || "Could not delete event.");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={edit.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={edit.header}>
        <TouchableOpacity onPress={onCancel} style={edit.headerBtn}>
          <Text style={edit.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={edit.headerTitle}>Edit Event</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[edit.saveBtn, { backgroundColor: accentColor }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={edit.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={edit.body}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Source badge */}
        <View style={[edit.sourceBadge, { backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }]}>
          <View style={[edit.sourceDot, { backgroundColor: accentColor }]} />
          <Text style={[edit.sourceLabel, { color: accentColor }]}>
            {event.source === "google" ? "Google Calendar" : "Outlook Calendar"}
          </Text>
        </View>

        <EditFieldLabel icon="text" label="Title" />
        <TextInput
          style={edit.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Event title"
          placeholderTextColor="#3A3A58"
          selectionColor={accentColor}
        />

        <EditFieldLabel icon="calendar-outline" label="Date" />
        <DatePickerField value={date} onChange={setDate} accentColor={accentColor} />

        {!event.isAllDay && (
          <>
            <View style={edit.timeRow}>
              <View style={edit.timeCol}>
                <EditFieldLabel icon="play-circle-outline" label="Start time" />
                <TimePickerField
                  value={startTime}
                  onChange={setStartTime}
                  accentColor={accentColor}
                />
              </View>
              <View style={edit.timeSepBox}>
                <Ionicons name="arrow-forward" size={16} color="#3C3C5E" />
              </View>
              <View style={edit.timeCol}>
                <EditFieldLabel icon="stop-circle-outline" label="End time" />
                <TimePickerField
                  value={endTime}
                  onChange={setEndTime}
                  accentColor={accentColor}
                />
              </View>
            </View>

            {startTime && endTime && startTime < endTime && (
              <View style={edit.durationHint}>
                <Ionicons
                  name="hourglass-outline"
                  size={12}
                  color={accentColor}
                  style={{ marginRight: 5 }}
                />
                <Text style={[edit.durationHintText, { color: accentColor }]}>
                  {calcDuration(startTime, endTime)}
                </Text>
              </View>
            )}
          </>
        )}

        <EditFieldLabel icon="location-outline" label="Location" />
        <TextInput
          style={edit.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Add location"
          placeholderTextColor="#3A3A58"
          selectionColor={accentColor}
        />

        <EditFieldLabel icon="document-text-outline" label="Description" />
        <TextInput
          style={[edit.input, edit.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add description"
          placeholderTextColor="#3A3A58"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          selectionColor={accentColor}
        />

        <TouchableOpacity
          style={edit.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.8}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#FF5C6A" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#FF5C6A" style={{ marginRight: 8 }} />
              <Text style={edit.deleteText}>Delete Event</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditFieldLabel({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View style={editLabelStyles.row}>
      <Ionicons name={icon} size={12} color="#4A4A6E" style={{ marginRight: 5 }} />
      <Text style={editLabelStyles.text}>{label}</Text>
    </View>
  );
}

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = eh * 60 + em - (sh * 60 + sm);
  if (total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(start: Date, end: Date): string {
  const total = Math.round((end.getTime() - start.getTime()) / 60000);
  if (total <= 0) return "";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function formatHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0C0C16" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 2,
    marginHorizontal: 18,
  },
  dateHeader: {
    color: "#F0EEFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#141424",
    borderWidth: 1,
    borderColor: "#1E1E34",
    alignItems: "center",
    justifyContent: "center",
  },
  eventCountLabel: {
    color: "#4A4A6E",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 18,
    marginTop: 8,
    marginBottom: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#141424",
    borderWidth: 1,
    borderColor: "#1E1E34",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { color: "#EEEEFF", fontSize: 16, fontWeight: "700" },
  emptyText: { color: "#4A4A6E", fontSize: 13 },
  errorText: { color: "#FF5C6A", fontSize: 14, marginTop: 8, fontWeight: "500" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 10,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#7C6EFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 8,
    shadowColor: "#7C6EFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  fabMenu: {
    position: "absolute",
    right: 14,
    zIndex: 20,
    gap: 8,
  },
  fabOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141424",
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minWidth: 200,
    borderWidth: 1,
    borderColor: "#1E1E34",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabOptionDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  fabOptionDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fabOptionLabel: { color: "#EEEEFF", fontSize: 14, fontWeight: "600" },
});

const detail = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0C0C16" },
  banner: {
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: "#111120",
    borderBottomWidth: 1,
  },
  bannerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1A1A2C",
    borderWidth: 1,
    borderColor: "#242438",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 13, fontWeight: "700" },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
    borderWidth: 1,
    gap: 6,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourcePillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  bannerTitle: {
    color: "#F0EEFF",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  body: { flex: 1 },
  section: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "flex-start",
  },
  sectionIcon: { marginRight: 14, marginTop: 2 },
  sectionContent: { flex: 1 },
  sectionLabel: {
    color: "#4A4A6E",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
    marginTop: 10,
  },
  sectionValue: { color: "#EEEEFF", fontSize: 15, fontWeight: "500" },
  emptyValue: { color: "#2E2E4A", fontSize: 15, fontStyle: "italic" },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,110,255,0.1)",
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.2)",
  },
  durationText: { color: "#7C6EFF", fontSize: 12, fontWeight: "600" },
  descText: { color: "#A8A8C8", fontSize: 14, lineHeight: 22 },
  attendeeRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  attendeeAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  attendeeInitial: { fontSize: 13, fontWeight: "700" },
  attendeeName: { color: "#EEEEFF", fontSize: 14 },
  divider: { height: 1, backgroundColor: "#141424", marginHorizontal: 20 },
});

const editLabelStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  text: {
    color: "#5A5A7E",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
});

const edit = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0C0C16" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A2E",
    backgroundColor: "#111120",
  },
  headerBtn: { minWidth: 60 },
  cancelText: { color: "#7878A8", fontSize: 15, fontWeight: "500" },
  headerTitle: { color: "#F0EEFF", fontSize: 17, fontWeight: "700" },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 16,
    marginBottom: 4,
    borderWidth: 1,
    gap: 6,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourceLabel: { fontSize: 12, fontWeight: "700" },
  input: {
    backgroundColor: "#141424",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#EEEEFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#1E1E34",
  },
  multiline: { minHeight: 110, paddingTop: 12 },
  timeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  timeCol: { flex: 1 },
  timeSepBox: { paddingBottom: 14, paddingHorizontal: 2 },
  durationHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginLeft: 2,
  },
  durationHintText: {
    fontSize: 12,
    fontWeight: "600",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    backgroundColor: "rgba(255,92,106,0.08)",
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "rgba(255,92,106,0.2)",
  },
  deleteText: {
    color: "#FF5C6A",
    fontSize: 15,
    fontWeight: "700",
  },
});
