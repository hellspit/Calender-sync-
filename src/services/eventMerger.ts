import { UnifiedEvent } from "../types/event";

/**
 * Merge events from both sources into a single sorted array.
 * Events are kept separate (not merged even if overlapping)
 * so the user can see both side-by-side.
 */
export function mergeEvents(
  googleEvents: UnifiedEvent[],
  outlookEvents: UnifiedEvent[]
): UnifiedEvent[] {
  const all = [...googleEvents, ...outlookEvents];
  all.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return all;
}
