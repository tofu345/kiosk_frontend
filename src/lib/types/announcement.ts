import * as z from "zod";

export const AnnouncementSchema = z.object({
	title: z.string(),
	text: z.string(),
	duration_ms: z.nullable(z.int().positive()),
});

export type Announcement = z.infer<typeof AnnouncementSchema>;
