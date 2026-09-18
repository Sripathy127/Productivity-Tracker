import { request } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type {
  Activity,
  ActivityCreateInput,
  ActivityUpdateInput,
  MonthStats,
  SubActivity,
  SubActivityInput,
  SubActivityUpdateInput,
} from "@/types/api";

export function fetchActivities(
  month: string,
  signal?: AbortSignal
): Promise<Activity[]> {
  return request<Activity[]>(endpoints.activities(month), { signal });
}

export function fetchMonthStats(
  month: string,
  signal?: AbortSignal
): Promise<MonthStats> {
  return request<MonthStats>(endpoints.monthStats(month), { signal });
}

export function createActivity(input: ActivityCreateInput): Promise<Activity> {
  return request<Activity>(endpoints.activitiesRoot, {
    method: "POST",
    body: input,
  });
}

export function updateActivity(
  id: number,
  input: ActivityUpdateInput
): Promise<Activity> {
  return request<Activity>(endpoints.activity(id), {
    method: "PATCH",
    body: input,
  });
}

export function deleteActivity(id: number): Promise<void> {
  return request<void>(endpoints.activity(id), { method: "DELETE" });
}

export function createSubActivity(
  activityId: number,
  input: SubActivityInput
): Promise<SubActivity> {
  return request<SubActivity>(endpoints.subActivitiesOf(activityId), {
    method: "POST",
    body: input,
  });
}

export function updateSubActivity(
  id: number,
  input: SubActivityUpdateInput
): Promise<SubActivity> {
  return request<SubActivity>(endpoints.subActivity(id), {
    method: "PATCH",
    body: input,
  });
}

export function deleteSubActivity(id: number): Promise<void> {
  return request<void>(endpoints.subActivity(id), { method: "DELETE" });
}
