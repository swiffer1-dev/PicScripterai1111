import { storage } from "../storage";
import type { InsertAnalyticsEvent } from "@shared/schema";

export async function trackEvent(
  userId: string,
  eventType: InsertAnalyticsEvent["eventType"],
  eventName: string,
  properties?: Record<string, any>,
  sessionId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await storage.createAnalyticsEvent({
      userId,
      eventType,
      eventName,
      properties,
      sessionId,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to track analytics event:", error);
  }
}
