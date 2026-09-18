/** Every API path in one place, so a route rename is a single edit. */
export const endpoints = {
  session: "/auth/session",
  googleSignIn: "/auth/google",
  logout: "/auth/logout",
  categories: "/categories",
  category: (id: number) => `/categories/${id}`,
  activities: (month: string) => `/activities?month=${encodeURIComponent(month)}`,
  activitiesRoot: "/activities",
  activity: (id: number) => `/activities/${id}`,
  subActivitiesOf: (activityId: number) => `/activities/${activityId}/sub-activities`,
  subActivity: (id: number) => `/sub-activities/${id}`,
  monthStats: (month: string) => `/stats/month?month=${encodeURIComponent(month)}`,
} as const;
