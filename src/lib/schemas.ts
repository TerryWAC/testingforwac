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
  mood: z.enum([
    "comedy",
    "date",
    "thriller",
    "horror",
    "action",
    "romance",
    "weird",
    "mindbender",
    "feelgood",
    "tearjerker",
    "classic",
    "easy",
  ]),
  intensity: z.enum(["light", "medium", "heavy", "extreme"]),
  runtimeCap: z.enum(["under90", "under105", "under120", "under150", "any"]),
  language: z.enum(["english", "foreign", "any"]),
  era: z
    .enum(["any", "2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "pre1970"])
    .default("any"),
  allowRewatches: z.boolean(),
});

export const recommendRequestSchema = z.object({
  filters: tonightFiltersSchema,
  count: z.union([z.literal(1), z.literal(8)]).default(8),
  chatMessage: z.string().trim().max(500).optional(),
  sessionId: z.string().uuid().optional(),
  // Recently shown picks the client doesn't want to see again.
  excludeSlugs: z.array(z.string().max(200)).max(30).default([]),
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
