import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

// ─── Time Picker Field ────────────────────────────────────────────────────────

interface TimePickerProps {
  value: string; // "HH:MM" 24-h
  onChange: (value: string) => void;
  accentColor: string;
  disabled?: boolean;
}

export function TimePickerField({
  value,
  onChange,
  accentColor,
  disabled,
}: TimePickerProps) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseTime(value));

  const dateValue = parseTime(value);

  const handleAndroid = (_: DateTimePickerEvent, date?: Date) => {
    setShow(false);
    if (date) onChange(toHHMM(date));
  };

  const handleIOS = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setTempDate(date);
  };

  const confirmIOS = () => {
    onChange(toHHMM(tempDate));
    setShow(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={[s.field, disabled && s.fieldDisabled]}
        onPress={() => !disabled && setShow(true)}
        activeOpacity={0.75}
      >
        <Ionicons
          name="time-outline"
          size={17}
          color={disabled ? "#2E2E4A" : accentColor}
        />
        <Text style={[s.fieldText, disabled && s.fieldTextDisabled]}>
          {value ? formatDisplayTime(dateValue) : "—"}
        </Text>
        {!disabled && (
          <Ionicons name="chevron-expand-outline" size={14} color="#4A4A6E" />
        )}
      </TouchableOpacity>

      {/* Android — system clock dialog */}
      {Platform.OS === "android" && show && (
        <DateTimePicker
          value={dateValue}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleAndroid}
        />
      )}

      {/* iOS — bottom sheet with spinner */}
      {Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="slide">
          <View style={s.overlay}>
            <TouchableOpacity
              style={s.overlayDismiss}
              activeOpacity={1}
              onPress={() => setShow(false)}
            />
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={s.sheetTitle}>Select Time</Text>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={[s.doneText, { color: accentColor }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="spinner"
                onChange={handleIOS}
                themeVariant="dark"
                style={s.picker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Date Picker Field ────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  accentColor: string;
}

export function DatePickerField({ value, onChange, accentColor }: DatePickerProps) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseDate(value));

  const dateValue = parseDate(value);

  const handleAndroid = (_: DateTimePickerEvent, date?: Date) => {
    setShow(false);
    if (date) onChange(toYYYYMMDD(date));
  };

  const handleIOS = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setTempDate(date);
  };

  const confirmIOS = () => {
    onChange(toYYYYMMDD(tempDate));
    setShow(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={s.field}
        onPress={() => setShow(true)}
        activeOpacity={0.75}
      >
        <Ionicons name="calendar-outline" size={17} color={accentColor} />
        <Text style={s.fieldText}>
          {value ? formatDisplayDate(dateValue) : "Select date"}
        </Text>
        <Ionicons name="chevron-expand-outline" size={14} color="#4A4A6E" />
      </TouchableOpacity>

      {/* Android — system calendar dialog */}
      {Platform.OS === "android" && show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={handleAndroid}
        />
      )}

      {/* iOS — bottom sheet with spinner */}
      {Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="slide">
          <View style={s.overlay}>
            <TouchableOpacity
              style={s.overlayDismiss}
              activeOpacity={1}
              onPress={() => setShow(false)}
            />
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={s.sheetTitle}>Select Date</Text>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={[s.doneText, { color: accentColor }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleIOS}
                themeVariant="dark"
                style={s.picker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(hhmm: string): Date {
  const d = new Date();
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function parseDate(yyyymmdd: string): Date {
  if (!yyyymmdd) return new Date();
  const [y, mo, d] = yyyymmdd.split("-").map(Number);
  const date = new Date();
  date.setFullYear(y, mo - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toYYYYMMDD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141424",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#1E1E34",
    gap: 10,
  },
  fieldDisabled: {
    opacity: 0.35,
  },
  fieldText: {
    color: "#EEEEFF",
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  fieldTextDisabled: {
    color: "#3C3C5E",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  overlayDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#111120",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: "#1E1E38",
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A42",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A2E",
  },
  sheetTitle: {
    color: "#F0EEFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelText: {
    color: "#7878A8",
    fontSize: 15,
    fontWeight: "500",
  },
  doneText: {
    fontSize: 15,
    fontWeight: "700",
  },
  picker: {
    height: 220,
  },
});
