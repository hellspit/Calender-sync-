import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { createGoogleEvent, NewEventPayload } from "../services/googleCalendar";
import { createOutlookEvent } from "../services/outlookCalendar";

export type AddTarget = "google" | "microsoft" | "both";

interface Props {
  visible: boolean;
  target: AddTarget;
  initialDate: string; // "YYYY-MM-DD"
  onClose: () => void;
  onSuccess: () => void; // called to refresh the event list
}

export default function AddEventModal({
  visible,
  target,
  initialDate,
  onClose,
  onSuccess,
}: Props) {
  const { getValidGoogleToken, getValidMicrosoftToken } = useAuth();

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetLabel =
    target === "both"
      ? "Google + Microsoft"
      : target === "google"
      ? "Google Calendar"
      : "Outlook Calendar";

  const accentColor =
    target === "google"
      ? "#4285F4"
      : target === "microsoft"
      ? "#00A4EF"
      : "#6C63FF";

  const resetForm = () => {
    setTitle("");
    setDate(initialDate);
    setStartTime("10:00");
    setEndTime("11:00");
    setLocation("");
    setDescription("");
    setIsAllDay(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const buildPayload = (): NewEventPayload => {
    // Use the device's actual UTC offset
    const now = new Date();
    const totalMinutes = -now.getTimezoneOffset();
    const sign = totalMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(totalMinutes);
    const hh = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const mm = String(absMinutes % 60).padStart(2, "0");
    const offset = `${sign}${hh}:${mm}`;
    return {
      title,
      startISO: `${date}T${startTime}:00${offset}`,
      endISO: `${date}T${endTime}:00${offset}`,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      isAllDay,
      allDayDate: date,
    };
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter an event title.");
      return;
    }
    if (!isAllDay && startTime >= endTime) {
      Alert.alert("Invalid time", "End time must be after start time.");
      return;
    }

    setIsSubmitting(true);
    const payload = buildPayload();
    const errors: string[] = [];

    try {
      if (target === "google" || target === "both") {
        const token = await getValidGoogleToken();
        if (token) {
          await createGoogleEvent(token, payload);
        } else {
          errors.push("Google (not signed in)");
        }
      }

      if (target === "microsoft" || target === "both") {
        const token = await getValidMicrosoftToken();
        if (token) {
          await createOutlookEvent(token, payload);
        } else {
          errors.push("Microsoft (not signed in)");
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          "Partial success",
          `Event created, but failed for: ${errors.join(", ")}`
        );
      } else {
        Alert.alert("✅ Event created!", `"${title}" added to ${targetLabel}.`);
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error?.message || err?.message || "Failed to create event. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: accentColor }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>New Event</Text>
            <Text style={styles.headerSub}>{targetLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.headerBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveText}>Add ✓</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor="#44445A"
            selectionColor={accentColor}
          />

          {/* All-day toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.label}>All Day</Text>
            <TouchableOpacity
              style={[styles.toggle, isAllDay && { backgroundColor: accentColor }]}
              onPress={() => setIsAllDay(!isAllDay)}
              activeOpacity={0.8}
            >
              <Text style={styles.toggleText}>{isAllDay ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
          </View>

          {/* Date */}
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#44445A"
            selectionColor={accentColor}
            keyboardType="numbers-and-punctuation"
          />

          {/* Start / End time — hidden if all day */}
          {!isAllDay && (
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="HH:MM"
                  placeholderTextColor="#44445A"
                  selectionColor={accentColor}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.timeSep}>
                <Text style={styles.timeSepText}>→</Text>
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="HH:MM"
                  placeholderTextColor="#44445A"
                  selectionColor={accentColor}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          )}

          {/* Location */}
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Add location (optional)"
            placeholderTextColor="#44445A"
            selectionColor={accentColor}
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add description (optional)"
            placeholderTextColor="#44445A"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            selectionColor={accentColor}
          />

          {/* Destination info */}
          <View style={[styles.destBadge, { borderColor: accentColor }]}>
            <Text style={[styles.destText, { color: accentColor }]}>
              📤 Will be added to: {targetLabel}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerBtn: { minWidth: 60 },
  headerCenter: { alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  cancelText: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "500" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "right" },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  label: {
    color: "#6C6C8A",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ECECEC",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2A2A3E",
  },
  multiline: { minHeight: 100, paddingTop: 12 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  toggle: {
    backgroundColor: "#2A2A3E",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  toggleText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  timeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  timeCol: { flex: 1 },
  timeSep: { marginBottom: 12, paddingHorizontal: 4 },
  timeSepText: { color: "#6C6C8A", fontSize: 18 },
  destBadge: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  destText: { fontSize: 13, fontWeight: "600" },
});
