import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { UnifiedEvent } from "../types/event";

interface Props {
  selectedDate: string;
  events: UnifiedEvent[];
  onSelectDate: (date: string) => void;
}

export default function CalendarView({ selectedDate, events, onSelectDate }: Props) {
  // Count events per date
  const eventCounts: Record<string, number> = {};
  const dotColors: Record<string, Set<string>> = {};

  events.forEach((event) => {
    const dateStr = event.start.substring(0, 10);
    eventCounts[dateStr] = (eventCounts[dateStr] || 0) + 1;
    if (!dotColors[dateStr]) dotColors[dateStr] = new Set();
    dotColors[dateStr].add(event.source === "google" ? "#4285F4" : "#2884E0");
  });

  // Build markedDates for multi-dot
  const markedDates: Record<string, any> = {};

  Object.keys(dotColors).forEach((dateStr) => {
    markedDates[dateStr] = {
      dots: Array.from(dotColors[dateStr]).map((color) => ({ key: color, color })),
      marked: true,
    };
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
      dayComponent={({ date, state, marking }: any) => {
        const isSelected = marking?.selected;
        const isDisabled = state === "disabled";
        const isToday = state === "today";
        const count = date ? eventCounts[date.dateString] : 0;
        const dots = marking?.dots || [];

        return (
          <TouchableOpacity
            onPress={() => date && onSelectDate(date.dateString)}
            activeOpacity={0.7}
            style={[
              cs.dayContainer,
              isSelected && cs.daySelected,
            ]}
          >
            <Text
              style={[
                cs.dayText,
                isDisabled && cs.dayDisabled,
                isToday && !isSelected && cs.dayToday,
                isSelected && cs.daySelectedText,
              ]}
            >
              {date?.day}
            </Text>
            {/* Dots row */}
            <View style={cs.dotRow}>
              {dots.map((dot: any, i: number) => (
                <View
                  key={i}
                  style={[cs.dot, { backgroundColor: isSelected ? "#fff" : dot.color }]}
                />
              ))}
            </View>
            {/* Event count badge */}
            {count > 0 && (
              <View style={[cs.badge, isSelected && cs.badgeSelected]}>
                <Text style={[cs.badgeText, isSelected && cs.badgeTextSelected]}>
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
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

const cs = StyleSheet.create({
  dayContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    minHeight: 46,
    borderRadius: 10,
  },
  daySelected: {
    backgroundColor: "#7C6EFF",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#D8D8F0",
  },
  dayDisabled: {
    color: "#2A2A42",
  },
  dayToday: {
    color: "#7C6EFF",
    fontWeight: "700",
  },
  daySelectedText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  dotRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
    height: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "rgba(124,110,255,0.2)",
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeSelected: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  badgeText: {
    color: "#7C6EFF",
    fontSize: 9,
    fontWeight: "800",
  },
  badgeTextSelected: {
    color: "#fff",
  },
});

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
