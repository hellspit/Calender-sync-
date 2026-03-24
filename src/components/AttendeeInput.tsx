import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchOutlookUsers } from "../services/outlookCalendar";

interface Props {
  attendees: string[];
  onChange: (attendees: string[]) => void;
  accentColor: string;
  /** If provided, enables Outlook company directory autocomplete */
  getMicrosoftToken?: () => Promise<string | null>;
}

interface Suggestion {
  displayName: string;
  mail: string;
}

export default function AttendeeInput({
  attendees,
  onChange,
  accentColor,
  getMicrosoftToken,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addAttendee = useCallback(
    (email: string) => {
      const trimmed = email.trim().toLowerCase();
      if (trimmed && !attendees.includes(trimmed)) {
        onChange([...attendees, trimmed]);
      }
      setInputValue("");
      setSuggestions([]);
    },
    [attendees, onChange]
  );

  const removeAttendee = useCallback(
    (email: string) => {
      onChange(attendees.filter((a) => a !== email));
    },
    [attendees, onChange]
  );

  const handleTextChange = useCallback(
    (text: string) => {
      // If user types a comma or space after an email, add it
      if (text.endsWith(",") || text.endsWith(" ")) {
        const candidate = text.slice(0, -1).trim();
        if (candidate && candidate.includes("@")) {
          addAttendee(candidate);
          return;
        }
      }

      setInputValue(text);

      // Debounced company directory search
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!getMicrosoftToken || text.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const token = await getMicrosoftToken();
          if (token) {
            const results = await searchOutlookUsers(token, text.trim());
            setSuggestions(
              results.filter((r) => !attendees.includes(r.mail.toLowerCase()))
            );
          }
        } catch {
          // silently ignore
        } finally {
          setIsSearching(false);
        }
      }, 400);
    },
    [getMicrosoftToken, attendees, addAttendee]
  );

  const handleSubmitEditing = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && trimmed.includes("@")) {
      addAttendee(trimmed);
    }
  }, [inputValue, addAttendee]);

  return (
    <View>
      {/* Chips */}
      {attendees.length > 0 && (
        <View style={styles.chipContainer}>
          {attendees.map((email) => (
            <View
              key={email}
              style={[styles.chip, { borderColor: `${accentColor}40` }]}
            >
              <View
                style={[
                  styles.chipAvatar,
                  { backgroundColor: `${accentColor}20` },
                ]}
              >
                <Text style={[styles.chipInitial, { color: accentColor }]}>
                  {email.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.chipText} numberOfLines={1}>
                {email}
              </Text>
              <TouchableOpacity
                onPress={() => removeAttendee(email)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color="#5A5A7E" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmitEditing}
          placeholder="Type email or name to search..."
          placeholderTextColor="#3A3A58"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          selectionColor={accentColor}
        />
        {isSearching && (
          <ActivityIndicator
            size="small"
            color={accentColor}
            style={styles.spinner}
          />
        )}
      </View>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.mail}
              style={styles.suggestionRow}
              onPress={() => addAttendee(item.mail)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.suggestionAvatar,
                  { backgroundColor: `${accentColor}20` },
                ]}
              >
                <Text
                  style={[
                    styles.suggestionInitial,
                    { color: accentColor },
                  ]}
                >
                  {item.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.suggestionEmail} numberOfLines={1}>
                  {item.mail}
                </Text>
              </View>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={accentColor}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141424",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 6,
    paddingLeft: 4,
    paddingRight: 10,
    maxWidth: "100%",
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  chipInitial: {
    fontSize: 11,
    fontWeight: "700",
  },
  chipText: {
    color: "#C8C8E8",
    fontSize: 13,
    fontWeight: "500",
    marginRight: 6,
    flexShrink: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#141424",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#EEEEFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#1E1E34",
  },
  spinner: {
    position: "absolute",
    right: 14,
  },
  suggestionsBox: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A44",
    marginTop: 6,
    maxHeight: 200,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E34",
  },
  suggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  suggestionInitial: {
    fontSize: 13,
    fontWeight: "700",
  },
  suggestionText: {
    flex: 1,
    marginRight: 8,
  },
  suggestionName: {
    color: "#EEEEFF",
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionEmail: {
    color: "#5A5A7E",
    fontSize: 12,
    marginTop: 1,
  },
});
