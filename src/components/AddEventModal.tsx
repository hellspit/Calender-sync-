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
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { createGoogleEvent, NewEventPayload } from "../services/googleCalendar";
import { createOutlookEvent } from "../services/outlookCalendar";
import { DatePickerField, TimePickerField } from "./PickerField";

export type AddTarget = "google" | "microsoft" | "both";

interface Props {
  visible: boolean;
  target: AddTarget;
  initialDate: string;
  initialStartTime?: string;
  initialEndTime?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEventModal({
  visible,
  target,
  initialDate,
  initialStartTime = "10:00",
  initialEndTime = "11:00",
  onClose,
  onSuccess,
}: Props) {
  const { getValidGoogleToken, getValidMicrosoftToken } = useAuth();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isGoogle = target === "google";
  const isBoth = target === "both";
  const accentColor = isGoogle ? "#4285F4" : isBoth ? "#7C6EFF" : "#2884E0";

  const targetLabel =
    isBoth ? "Google & Outlook" : isGoogle ? "Google Calendar" : "Outlook Calendar";

  const resetForm = () => {
    setTitle("");
    setDate(initialDate);
    setStartTime(initialStartTime);
    setEndTime(initialEndTime);
    setLocation("");
    setDescription("");
    setIsAllDay(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const buildPayload = (): NewEventPayload => {
    const now = new Date();
    const totalMinutes = -now.getTimezoneOffset();
    const sign = totalMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(totalMinutes);
    const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
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
        if (token) await createGoogleEvent(token, payload);
        else errors.push("Google (not signed in)");
      }
      if (target === "microsoft" || target === "both") {
        const token = await getValidMicrosoftToken();
        if (token) await createOutlookEvent(token, payload);
        else errors.push("Microsoft (not signed in)");
      }
      if (errors.length > 0) {
        Alert.alert("Partial success", `Event created, but failed for: ${errors.join(", ")}`);
      } else {
        Alert.alert("Event created", `"${title}" added to ${targetLabel}.`);
      }
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error?.message || err?.message || "Failed to create event."
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
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerSideBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.targetDot, { backgroundColor: accentColor }]} />
            <Text style={styles.headerTitle}>New Event</Text>
            <Text style={styles.headerSub}>{targetLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.saveBtn, { backgroundColor: accentColor }]}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Add</Text>
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
          <FL icon="text" label="Title" required />
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor="#3A3A58"
            selectionColor={accentColor}
          />

          {/* All-day toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons
                name="sunny-outline"
                size={15}
                color="#7878A8"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.toggleLabel}>All Day Event</Text>
            </View>
            <Switch
              value={isAllDay}
              onValueChange={setIsAllDay}
              trackColor={{ false: "#1E1E34", true: `${accentColor}90` }}
              thumbColor={isAllDay ? accentColor : "#3C3C5E"}
            />
          </View>

          {/* Date */}
          <FL icon="calendar-outline" label="Date" />
          <DatePickerField value={date} onChange={setDate} accentColor={accentColor} />

          {/* Times */}
          {!isAllDay && (
            <>
              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <FL icon="play-circle-outline" label="Start time" />
                  <TimePickerField
                    value={startTime}
                    onChange={setStartTime}
                    accentColor={accentColor}
                  />
                </View>
                <View style={styles.timeSepBox}>
                  <Ionicons name="arrow-forward" size={16} color="#3C3C5E" />
                </View>
                <View style={styles.timeCol}>
                  <FL icon="stop-circle-outline" label="End time" />
                  <TimePickerField
                    value={endTime}
                    onChange={setEndTime}
                    accentColor={accentColor}
                  />
                </View>
              </View>

              {/* Duration indicator */}
              {startTime && endTime && startTime < endTime && (
                <View style={styles.durationHint}>
                  <Ionicons
                    name="hourglass-outline"
                    size={12}
                    color={accentColor}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.durationHintText, { color: accentColor }]}>
                    {calcDuration(startTime, endTime)}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Location */}
          <FL icon="location-outline" label="Location" />
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Add location (optional)"
            placeholderTextColor="#3A3A58"
            selectionColor={accentColor}
          />

          {/* Description */}
          <FL icon="document-text-outline" label="Description" />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add description (optional)"
            placeholderTextColor="#3A3A58"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            selectionColor={accentColor}
          />

          {/* Destination badge */}
          <View style={[styles.destBadge, { borderColor: `${accentColor}30` }]}>
            <Ionicons
              name="send-outline"
              size={13}
              color={accentColor}
              style={{ marginRight: 7 }}
            />
            <Text style={[styles.destText, { color: accentColor }]}>
              Adding to {targetLabel}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Field Label helper ───────────────────────────────────────────────────────

function FL({
  icon,
  label,
  required,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  required?: boolean;
}) {
  return (
    <View style={fl.row}>
      <Ionicons name={icon} size={12} color="#4A4A6E" style={{ marginRight: 5 }} />
      <Text style={fl.text}>
        {label}
        {required ? <Text style={fl.req}> *</Text> : null}
      </Text>
    </View>
  );
}

const fl = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 8 },
  text: {
    color: "#5A5A7E",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  req: { color: "#7C6EFF" },
});

// ─── Duration helper ──────────────────────────────────────────────────────────

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = (eh * 60 + em) - (sh * 60 + sm);
  if (total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  headerSideBtn: { minWidth: 60 },
  cancelText: { color: "#7878A8", fontSize: 15, fontWeight: "500" },
  headerCenter: { alignItems: "center", gap: 3 },
  targetDot: { width: 6, height: 6, borderRadius: 3 },
  headerTitle: { color: "#F0EEFF", fontSize: 17, fontWeight: "700" },
  headerSub: { color: "#5A5A7A", fontSize: 12 },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
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
  multiline: { minHeight: 100, paddingTop: 12 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#141424",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#1E1E34",
  },
  toggleLeft: { flexDirection: "row", alignItems: "center" },
  toggleLabel: { color: "#C8C8E8", fontSize: 15, fontWeight: "500" },
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
  destBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  destText: { fontSize: 13, fontWeight: "600" },
});
