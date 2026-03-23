import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Platform,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { chat, ConversationMessage } from "../services/chatEngine";

// ─── Types ────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// ─── Component ────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { getValidGoogleToken, getValidMicrosoftToken } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      text: `👋 Hi! I'm your calendar assistant.`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // LLM conversation history (separate from display messages)
  const conversationRef = useRef<ConversationMessage[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const typingAnim = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track keyboard visibility for proper input positioning
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Typing animation
  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [isProcessing]);

  const addMessage = (text: string, isUser: boolean) => {
    const msg: ChatMessage = {
      id: Date.now().toString() + (isUser ? "_u" : "_b"),
      text,
      isUser,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    setInputText("");
    addMessage(text, true);
    setIsProcessing(true);

    try {
      const [googleToken, microsoftToken] = await Promise.all([
        getValidGoogleToken(),
        getValidMicrosoftToken(),
      ]);

      const response = await chat(
        text,
        conversationRef.current,
        googleToken,
        microsoftToken
      );

      // Update conversation history for context
      conversationRef.current = response.updatedHistory;

      addMessage(response.message, false);
    } catch (err: any) {
      addMessage(
        `❌ Something went wrong: ${err?.message || "Unknown error"}. Please try again.`,
        false
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageBubbleRow,
        item.isUser ? styles.userRow : styles.botRow,
      ]}
    >
      {!item.isUser && (
        <View style={styles.botAvatar}>
          <Ionicons name="calendar" size={16} color="#7C6EFF" />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          item.isUser ? styles.userBubble : styles.botBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            item.isUser ? styles.userText : styles.botText,
          ]}
        >
          {item.text}
        </Text>
        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubbles" size={20} color="#7C6EFF" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Calendar Assistant</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isProcessing && styles.statusDotBusy]} />
              <Text style={[styles.headerSub, isProcessing && styles.headerSubBusy]}>
                {isProcessing ? "Thinking..." : "Online"}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            conversationRef.current = [];
            setMessages([
              {
                id: "welcome_" + Date.now(),
                text: "🔄 Conversation cleared! How can I help you?",
                isUser: false,
                timestamp: new Date(),
              },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color="#7878A8" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Typing indicator */}
      {isProcessing && (
        <Animated.View
          style={[
            styles.typingContainer,
            { opacity: typingAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          ]}
        >
          <View style={styles.botAvatarSmall}>
            <Ionicons name="calendar" size={14} color="#7C6EFF" />
          </View>
          <View style={styles.typingBubble}>
            <View style={styles.typingDots}>
              <View style={[styles.dot, { opacity: 1 }]} />
              <View style={[styles.dot, { opacity: 0.6 }]} />
              <View style={[styles.dot, { opacity: 0.3 }]} />
            </View>
          </View>
        </Animated.View>
      )}

      {/* Input – uses keyboard height to position above keyboard */}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: keyboardHeight > 0
              ? keyboardHeight + 40
              : Math.max(insets.bottom, 12) + 68,
          },
        ]}
      >
        {/* Quick action chips */}
        <FlatList
          horizontal
          data={[
            { label: "📅 Today's events", cmd: "What events do I have today?" },
            { label: "➕ Create event", cmd: "I want to create an event" },
            { label: "✏️ Edit event", cmd: "I want to edit an event" },
            { label: "🗑️ Delete event", cmd: "I want to delete an event" },
          ]}
          keyExtractor={(item) => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setInputText(item.cmd);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />

        {/* Text input row */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#3A3A58"
            multiline
            maxLength={500}
            editable={!isProcessing}
            selectionColor="#7C6EFF"
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isProcessing) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isProcessing}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() && !isProcessing ? "#fff" : "#3C3C5E"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C0C16",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A2E",
    backgroundColor: "#111120",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#7C6EFF15",
    borderWidth: 1,
    borderColor: "#7C6EFF30",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#F0EEFF",
    fontSize: 17,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#4ECB71",
  },
  statusDotBusy: {
    backgroundColor: "#FFB84D",
  },
  headerSub: {
    color: "#4ECB71",
    fontSize: 12,
    fontWeight: "500",
  },
  headerSubBusy: {
    color: "#FFB84D",
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#141424",
    borderWidth: 1,
    borderColor: "#1E1E34",
    alignItems: "center",
    justifyContent: "center",
  },

  // Messages
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  messageBubbleRow: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "85%",
  },
  userRow: {
    alignSelf: "flex-end",
  },
  botRow: {
    alignSelf: "flex-start",
  },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#7C6EFF15",
    borderWidth: 1,
    borderColor: "#7C6EFF30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 2,
  },
  botAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#7C6EFF15",
    borderWidth: 1,
    borderColor: "#7C6EFF30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "100%",
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: "#7C6EFF",
    borderBottomRightRadius: 6,
  },
  botBubble: {
    backgroundColor: "#1A1A30",
    borderWidth: 1,
    borderColor: "#252540",
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  userText: {
    color: "#FFFFFF",
  },
  botText: {
    color: "#D8D8F0",
  },
  timestamp: {
    color: "#5A5A7A",
    fontSize: 10,
    marginTop: 6,
    alignSelf: "flex-end",
  },

  // Typing indicator
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: "#1A1A30",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#252540",
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#7C6EFF",
  },

  // Input
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: "#1A1A2E",
    backgroundColor: "#111120",
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  chipsRow: {
    paddingBottom: 10,
    gap: 8,
  },
  chip: {
    backgroundColor: "#1A1A30",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#252540",
  },
  chipText: {
    color: "#B8B8D8",
    fontSize: 12,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#141424",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: "#EEEEFF",
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#1E1E34",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7C6EFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#7C6EFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sendBtnDisabled: {
    backgroundColor: "#1E1E34",
    elevation: 0,
    shadowOpacity: 0,
  },
});
