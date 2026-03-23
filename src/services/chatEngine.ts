/**
 * chatEngine.ts – LLM-powered chatbot using OpenRouter.
 *
 * Uses function calling so the LLM can decide when to create/edit/delete/list
 * events and ask follow-up questions when information is missing.
 */

import axios from "axios";
import {
  fetchGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  NewEventPayload,
} from "./googleCalendar";
import {
  fetchOutlookEvents,
  createOutlookEvent,
  updateOutlookEvent,
  deleteOutlookEvent,
} from "./outlookCalendar";
import { normalizeGoogleEvents, normalizeOutlookEvents } from "./normalizer";
import { mergeEvents } from "./eventMerger";
import { UnifiedEvent } from "../types/event";

// ─── Types ────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatResponse {
  message: string;
  updatedHistory: ConversationMessage[];
}

// ─── Config ───────────────────────────────────────────────────────

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.0-flash-001";

// ─── System Prompt ────────────────────────────────────────────────

function getSystemPrompt(): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const dayName = today.toLocaleDateString(undefined, { weekday: "long" });

  return `You are a friendly calendar assistant inside a mobile app. Today is ${dayName}, ${todayStr}.

The user has Google Calendar and/or Outlook Calendar connected. You help them create, edit, delete, and list events.

RULES:
1. When the user wants to CREATE an event but hasn't provided all required info (title, date, start time, end time), ask follow-up questions one at a time. Don't create until you have at minimum: title + date + start time + end time.
2. When the user says "tomorrow", "today", "next Monday" etc., convert to YYYY-MM-DD format.
3. For times, always use HH:MM (24-hour) format in function calls.
4. If the user doesn't specify which calendar (Google/Outlook), default to "google". If they say "both", call the function twice.
5. When listing events, format them nicely with emoji.
6. For edits and deletes, first list events to find the matching one, then perform the action.
7. Always confirm actions after they succeed.
8. Be concise but friendly. Use emoji occasionally.
9. If the user says something unrelated to calendar management, politely redirect them.
10. The "source" parameter should be "google" or "microsoft" (not "outlook").`;
}

// ─── Tool Definitions ─────────────────────────────────────────────

const tools = [
  {
    type: "function" as const,
    function: {
      name: "list_events",
      description: "List calendar events for a specific date. Call this when the user wants to see their schedule.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to list events for, in YYYY-MM-DD format",
          },
          source: {
            type: "string",
            enum: ["google", "microsoft", "both"],
            description: "Which calendar to list from. Default: both",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_event",
      description: "Create a new calendar event. Only call this when you have ALL required information: title, date, startTime, and endTime.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Event title",
          },
          date: {
            type: "string",
            description: "Event date in YYYY-MM-DD format",
          },
          startTime: {
            type: "string",
            description: "Start time in HH:MM (24-hour) format",
          },
          endTime: {
            type: "string",
            description: "End time in HH:MM (24-hour) format",
          },
          location: {
            type: "string",
            description: "Optional event location",
          },
          description: {
            type: "string",
            description: "Optional event description",
          },
          source: {
            type: "string",
            enum: ["google", "microsoft", "both"],
            description: "Which calendar to create on. Default: google",
          },
        },
        required: ["title", "date", "startTime", "endTime"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_event",
      description: "Edit an existing calendar event. First call list_events to find the event ID.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The event ID (with g_ or m_ prefix) from list_events",
          },
          source: {
            type: "string",
            enum: ["google", "microsoft"],
            description: "Which calendar the event is on",
          },
          title: { type: "string", description: "New title (optional)" },
          date: { type: "string", description: "New date YYYY-MM-DD (optional)" },
          startTime: { type: "string", description: "New start time HH:MM (optional)" },
          endTime: { type: "string", description: "New end time HH:MM (optional)" },
          location: { type: "string", description: "New location (optional)" },
          description: { type: "string", description: "New description (optional)" },
        },
        required: ["eventId", "source"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_event",
      description: "Delete a calendar event. First call list_events to find the event ID.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The event ID (with g_ or m_ prefix) from list_events",
          },
          source: {
            type: "string",
            enum: ["google", "microsoft"],
            description: "Which calendar the event is on",
          },
        },
        required: ["eventId", "source"],
      },
    },
  },
];

// ─── Main Chat Function ──────────────────────────────────────────

export async function chat(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  googleToken: string | null,
  microsoftToken: string | null
): Promise<ChatResponse> {
  // Build messages array
  const messages: ConversationMessage[] = [
    { role: "system", content: getSystemPrompt() },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Track the updated history (without system prompt)
  const newHistory: ConversationMessage[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  try {
    // Call OpenRouter — loop to handle multiple tool calls
    let response = await callOpenRouter(messages);
    let loopCount = 0;
    const MAX_LOOPS = 5; // prevent infinite loops

    while (response.tool_calls && response.tool_calls.length > 0 && loopCount < MAX_LOOPS) {
      loopCount++;

      // Add the assistant's message with tool calls to history
      newHistory.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        const result = await executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          googleToken,
          microsoftToken
        );

        // Add tool result to history
        newHistory.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }

      // Call LLM again with tool results
      const updatedMessages: ConversationMessage[] = [
        { role: "system", content: getSystemPrompt() },
        ...newHistory,
      ];
      response = await callOpenRouter(updatedMessages);
    }

    // Final assistant response
    const assistantMessage = response.content || "I'm not sure how to help with that. Try asking me to create, list, edit, or delete events!";
    newHistory.push({ role: "assistant", content: assistantMessage });

    return {
      message: assistantMessage,
      updatedHistory: newHistory,
    };
  } catch (err: any) {
    const errorMsg = `❌ Sorry, I encountered an error: ${err?.message || "Unknown error"}. Please try again.`;
    newHistory.push({ role: "assistant", content: errorMsg });

    return {
      message: errorMsg,
      updatedHistory: newHistory,
    };
  }
}

// ─── OpenRouter API Call ──────────────────────────────────────────

async function callOpenRouter(
  messages: ConversationMessage[]
): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://calendar-app.local",
        "X-Title": "Calendar Assistant",
      },
    }
  );

  const choice = response.data.choices?.[0]?.message;
  return {
    content: choice?.content || null,
    tool_calls: choice?.tool_calls,
  };
}

// ─── Tool Execution ───────────────────────────────────────────────

async function executeTool(
  name: string,
  args: any,
  googleToken: string | null,
  microsoftToken: string | null
): Promise<any> {
  switch (name) {
    case "list_events":
      return await toolListEvents(args, googleToken, microsoftToken);
    case "create_event":
      return await toolCreateEvent(args, googleToken, microsoftToken);
    case "edit_event":
      return await toolEditEvent(args, googleToken, microsoftToken);
    case "delete_event":
      return await toolDeleteEvent(args, googleToken, microsoftToken);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function toolListEvents(
  args: { date: string; source?: string },
  googleToken: string | null,
  microsoftToken: string | null
) {
  const { date, source = "both" } = args;
  const timeMin = `${date}T00:00:00Z`;
  const timeMax = `${date}T23:59:59Z`;

  try {
    const [googleRaw, outlookRaw] = await Promise.all([
      googleToken && (source === "google" || source === "both")
        ? fetchGoogleEvents(googleToken, timeMin, timeMax)
        : Promise.resolve([]),
      microsoftToken && (source === "microsoft" || source === "both")
        ? fetchOutlookEvents(microsoftToken, timeMin, timeMax)
        : Promise.resolve([]),
    ]);

    const events = mergeEvents(
      normalizeGoogleEvents(googleRaw),
      normalizeOutlookEvents(outlookRaw)
    );

    return {
      success: true,
      count: events.length,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        source: e.source,
        isAllDay: e.isAllDay,
        location: e.location,
        description: e.description,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch events" };
  }
}

async function toolCreateEvent(
  args: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
    source?: string;
  },
  googleToken: string | null,
  microsoftToken: string | null
) {
  const { title, date, startTime, endTime, location, description, source = "google" } = args;
  const offset = getDeviceOffset();

  const payload: NewEventPayload = {
    title,
    startISO: `${date}T${startTime}:00${offset}`,
    endISO: `${date}T${endTime}:00${offset}`,
    location: location || undefined,
    description: description || undefined,
    isAllDay: false,
    allDayDate: date,
  };

  const results: string[] = [];
  const errors: string[] = [];

  try {
    if ((source === "google" || source === "both") && googleToken) {
      await createGoogleEvent(googleToken, payload);
      results.push("Google Calendar");
    } else if ((source === "google" || source === "both") && !googleToken) {
      errors.push("Google (not signed in)");
    }

    if ((source === "microsoft" || source === "both") && microsoftToken) {
      await createOutlookEvent(microsoftToken, payload);
      results.push("Outlook Calendar");
    } else if ((source === "microsoft" || source === "both") && !microsoftToken) {
      errors.push("Outlook (not signed in)");
    }

    return {
      success: results.length > 0,
      createdOn: results,
      errors,
      event: { title, date, startTime, endTime, location, description },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.response?.data?.error?.message || err?.message || "Failed to create event",
    };
  }
}

async function toolEditEvent(
  args: {
    eventId: string;
    source: string;
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
  },
  googleToken: string | null,
  microsoftToken: string | null
) {
  const { eventId, source, title, date, startTime, endTime, location, description } = args;
  const realId = eventId.replace(/^[gm]_/, "");
  const offset = getDeviceOffset();

  try {
    if (source === "google" && googleToken) {
      const updates: any = {};
      if (title) updates.title = title;
      if (location) updates.location = location;
      if (description) updates.description = description;
      if (startTime && date) updates.startISO = `${date}T${startTime}:00${offset}`;
      if (endTime && date) updates.endISO = `${date}T${endTime}:00${offset}`;
      await updateGoogleEvent(googleToken, realId, updates);
    } else if (source === "microsoft" && microsoftToken) {
      const updates: any = {};
      if (title) updates.title = title;
      if (location) updates.location = location;
      if (description) updates.description = description;
      if (startTime && date) updates.startDateTime = `${date}T${startTime}:00`;
      if (endTime && date) updates.endDateTime = `${date}T${endTime}:00`;
      await updateOutlookEvent(microsoftToken, realId, updates);
    } else {
      return { success: false, error: `Not signed into ${source}` };
    }

    return { success: true, updatedFields: { title, date, startTime, endTime, location, description } };
  } catch (err: any) {
    return {
      success: false,
      error: err?.response?.data?.error?.message || err?.message || "Failed to edit event",
    };
  }
}

async function toolDeleteEvent(
  args: { eventId: string; source: string },
  googleToken: string | null,
  microsoftToken: string | null
) {
  const { eventId, source } = args;
  const realId = eventId.replace(/^[gm]_/, "");

  try {
    if (source === "google" && googleToken) {
      await deleteGoogleEvent(googleToken, realId);
    } else if (source === "microsoft" && microsoftToken) {
      await deleteOutlookEvent(microsoftToken, realId);
    } else {
      return { success: false, error: `Not signed into ${source}` };
    }

    return { success: true, deletedEventId: eventId };
  } catch (err: any) {
    return {
      success: false,
      error: err?.response?.data?.error?.message || err?.message || "Failed to delete event",
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function getDeviceOffset(): string {
  const totalMinutes = -new Date().getTimezoneOffset();
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
