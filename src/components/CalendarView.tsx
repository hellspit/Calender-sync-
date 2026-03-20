import React from "react";
import { StyleSheet } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { UnifiedEvent } from "../types/event";

interface Props {
  selectedDate: string;
  events: UnifiedEvent[];
  onSelectDate: (date: string) => void;
}

/**
 * Monthly calendar with colored dots showing which days have events.
 * Blue dot = Google, Green dot = Outlook.
 */
export default function CalendarView({
  selectedDate,
  events,
  onSelectDate,
}: Props) {
  // Build marked-dates object
  const markedDates: Record<string, any> = {};

  events.forEach((event) => {
    const dateStr = event.start.substring(0, 10); // "YYYY-MM-DD"
    if (!markedDates[dateStr]) {
      markedDates[dateStr] = { dots: [], marked: true };
    }
    const color = event.source === "google" ? "#4285F4" : "#00A4EF";
    const alreadyHasColor = markedDates[dateStr].dots.some(
      (d: any) => d.color === color
    );
    if (!alreadyHasColor) {
      markedDates[dateStr].dots.push({ key: event.source, color });
    }
  });

  // Highlight selected date
  if (markedDates[selectedDate]) {
    markedDates[selectedDate].selected = true;
    markedDates[selectedDate].selectedColor = "#6C63FF";
  } else {
    markedDates[selectedDate] = {
      selected: true,
      selectedColor: "#6C63FF",
      dots: [],
    };
  }

  return (
    <Calendar
      markingType="multi-dot"
      markedDates={markedDates}
      onDayPress={(day: DateData) => onSelectDate(day.dateString)}
      theme={{
        backgroundColor: "#121212",
        calendarBackground: "#121212",
        textSectionTitleColor: "#888",
        selectedDayBackgroundColor: "#6C63FF",
        selectedDayTextColor: "#fff",
        todayTextColor: "#6C63FF",
        dayTextColor: "#E0E0E0",
        textDisabledColor: "#555",
        monthTextColor: "#fff",
        arrowColor: "#6C63FF",
        textDayFontWeight: "400",
        textMonthFontWeight: "700",
        textDayHeaderFontWeight: "600",
        textDayFontSize: 14,
        textMonthFontSize: 18,
        textDayHeaderFontSize: 12,
      }}
      style={styles.calendar}
    />
  );
}

const styles = StyleSheet.create({
  calendar: {
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 12,
    marginTop: 8,
  },
});
