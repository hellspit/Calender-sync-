import React from "react";
import { StyleSheet } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { UnifiedEvent } from "../types/event";

interface Props {
  selectedDate: string;
  events: UnifiedEvent[];
  onSelectDate: (date: string) => void;
}

export default function CalendarView({ selectedDate, events, onSelectDate }: Props) {
  const markedDates: Record<string, any> = {};

  events.forEach((event) => {
    const dateStr = event.start.substring(0, 10);
    if (!markedDates[dateStr]) {
      markedDates[dateStr] = { dots: [], marked: true };
    }
    const color = event.source === "google" ? "#4285F4" : "#2884E0";
    const alreadyHasColor = markedDates[dateStr].dots.some((d: any) => d.color === color);
    if (!alreadyHasColor) {
      markedDates[dateStr].dots.push({ key: event.source, color });
    }
  });

  if (markedDates[selectedDate]) {
    markedDates[selectedDate].selected = true;
    markedDates[selectedDate].selectedColor = "#7C6EFF";
  } else {
    markedDates[selectedDate] = { selected: true, selectedColor: "#7C6EFF", dots: [] };
  }

  return (
    <Calendar
      markingType="multi-dot"
      markedDates={markedDates}
      onDayPress={(day: DateData) => onSelectDate(day.dateString)}
      theme={{
        backgroundColor: "#0C0C16",
        calendarBackground: "#111120",
        textSectionTitleColor: "#3C3C5E",
        selectedDayBackgroundColor: "#7C6EFF",
        selectedDayTextColor: "#FFFFFF",
        todayTextColor: "#7C6EFF",
        dayTextColor: "#D8D8F0",
        textDisabledColor: "#2A2A42",
        monthTextColor: "#F0EEFF",
        arrowColor: "#7C6EFF",
        textDayFontWeight: "500",
        textMonthFontWeight: "700",
        textDayHeaderFontWeight: "600",
        textDayFontSize: 14,
        textMonthFontSize: 17,
        textDayHeaderFontSize: 11,
        dotColor: "#7C6EFF",
        selectedDotColor: "#fff",
      }}
      style={styles.calendar}
    />
  );
}

const styles = StyleSheet.create({
  calendar: {
    borderRadius: 20,
    overflow: "hidden",
    marginHorizontal: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1A1A2E",
  },
});
