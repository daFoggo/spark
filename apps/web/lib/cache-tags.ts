/**
 * Cache tag names, one scheme for every feature (spec §7.3). Per-user data is tagged with the user id so
 * one user's write never expires another's entries. Never put tokens or personal data in a tag.
 */
export const settingsTag = (userId: string) => `settings:${userId}`
export const goalsTag = (userId: string) => `goals:${userId}`
export const goalTag = (goalId: string) => `goal:${goalId}`
export const habitsTag = (userId: string) => `habits:${userId}`
export const checkinsTag = (userId: string) => `checkins:${userId}`
export const activitiesTag = (userId: string) => `activities:${userId}`
export const tasksTag = (userId: string) => `tasks:${userId}`
export const reviewsTag = (userId: string) => `reviews:${userId}`
