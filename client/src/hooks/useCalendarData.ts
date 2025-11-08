import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

type CalendarPost = {
  id: string;
  status: "scheduled_pending" | "scheduled" | "published" | "failed";
  scheduledAt: string;
  platforms: any[];
  caption: string;
  mediaUrl?: string | null;
};

type CalendarDataMap = Record<string, CalendarPost[]>;

export function useCalendarData(month: Date) {
  const monthKey = format(month, "yyyy-MM");
  
  const query = useQuery<CalendarPost[]>({
    queryKey: ["/api/calendar", monthKey],
    queryFn: async () => {
      const response = await fetch(`/api/calendar?month=${monthKey}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error("Failed to fetch calendar data");
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Convert array to date-keyed map
  const dataMap: CalendarDataMap = {};
  
  if (query.data) {
    query.data.forEach((post) => {
      const dateKey = format(new Date(post.scheduledAt), "yyyy-MM-dd");
      if (!dataMap[dateKey]) {
        dataMap[dateKey] = [];
      }
      dataMap[dateKey].push(post);
    });
  }
  
  return {
    data: dataMap,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
