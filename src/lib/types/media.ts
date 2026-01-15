import * as z from "zod"; 

export const MediaSchema = z.object({
	pk: z.int().positive(),
	type: z.enum(["image", "video/mp4"]),
	src: z.string(),
});

export type Media = z.infer<typeof MediaSchema>;
