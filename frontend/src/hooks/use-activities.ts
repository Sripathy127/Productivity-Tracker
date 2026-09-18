/**
 * TanStack Query hooks for the activity month view.
 *
 * Every mutation invalidates the month key it affects, so the timeline and the
 * monthly summary stay consistent without manual cache surgery.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createActivity,
  createSubActivity,
  deleteActivity,
  deleteSubActivity,
  fetchActivities,
  fetchMonthStats,
  updateActivity,
  updateSubActivity,
} from "@/api/activities";
import type {
  Activity,
  ActivityCreateInput,
  ActivityUpdateInput,
  MonthStats,
  SubActivityInput,
  SubActivityUpdateInput,
} from "@/types/api";

export const activityKeys = {
  month: (month: string) => ["activities", month] as const,
  stats: (month: string) => ["activity-stats", month] as const,
};

export function useActivities(month: string) {
  return useQuery<Activity[]>({
    queryKey: activityKeys.month(month),
    queryFn: ({ signal }) => fetchActivities(month, signal),
  });
}

export function useMonthStats(month: string) {
  return useQuery<MonthStats>({
    queryKey: activityKeys.stats(month),
    queryFn: ({ signal }) => fetchMonthStats(month, signal),
  });
}

/**
 * Invalidates every month-scoped query rather than just the active month: an
 * edit can move an activity across a month boundary, which leaves the month it
 * came *from* stale as well.
 */
function useMonthInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["activities"] });
    void queryClient.invalidateQueries({ queryKey: ["activity-stats"] });
  };
}

export function useCreateActivity() {
  const invalidate = useMonthInvalidation();
  return useMutation({
    mutationFn: (input: ActivityCreateInput) => createActivity(input),
    onSuccess: invalidate,
  });
}

export function useUpdateActivity() {
  const invalidate = useMonthInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ActivityUpdateInput }) =>
      updateActivity(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteActivity() {
  const invalidate = useMonthInvalidation();
  return useMutation({
    mutationFn: (id: number) => deleteActivity(id),
    onSuccess: invalidate,
  });
}

export function useCreateSubActivity() {
  const invalidate = useMonthInvalidation();
  return useMutation({
    mutationFn: ({
      activityId,
      input,
    }: {
      activityId: number;
      input: SubActivityInput;
    }) => createSubActivity(activityId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateSubActivity() {
  const invalidate = useMonthInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SubActivityUpdateInput }) =>
      updateSubActivity(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSubActivity() {
  const invalidate = useMonthInvalidation();
  return useMutation({
    mutationFn: (id: number) => deleteSubActivity(id),
    onSuccess: invalidate,
  });
}
