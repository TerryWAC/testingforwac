import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username is required")
  .max(60)
  .regex(/^[a-zA-Z0-9_]+$/, "Letterboxd usernames are letters, numbers and underscores");

export const rssUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === "https:" && parsed.hostname === "letterboxd.com";
      } catch {
        return false;
      }
    },
    { message: "RSS URL must be an https://letterboxd.com/... feed" }
  );

export const tonightFiltersSchema = z.object({
  mood: z.enum(["comedy", "date", "thriller", "weird", "easy"]),
  intensity: z.enum(["light", "medium", "heavy"]),
  runtimeCap: z.enum(["under90", "under120", "any"]),
  language: z.enum(["english", "any"]),
  allowRewatches: z.boolean(),
});

export const recommendRequestSchema = z.object({
  filters: tonightFiltersSchema,
  count: z.union([z.literal(1), z.literal(8)]).default(8),
  chatMessage: z.string().trim().max(500).optional(),
  sessionId: z.string().uuid().optional(),
});

export const setupSchema = z.object({
  username: usernameSchema,
  rssUrl: rssUrlSchema,
});

export const joinSessionSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "Join codes are 6 letters/numbers"),
});

export const guestProfileSchema = z.object({
  sessionId: z.string().uuid(),
  username: usernameSchema,
});
