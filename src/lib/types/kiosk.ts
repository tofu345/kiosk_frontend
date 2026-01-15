import * as z from "zod";

import { MediaSchema } from "./media";

export const MessageSchema = z.object({
	pk: z.int().positive(),
	text: z.string(),
	is_usr_msg: z.boolean(),
});

export const ConversationSchema = z.object({
	pk: z.int().positive(),
	messages: z.array(MessageSchema),
});

export const KioskSchema = z.object({
	id: z.int().positive(),
	name: z.string(),
	image_duration_ms: z.int().positive(),
	media: z.array(MediaSchema),
	chat_placeholder: z.string(),
	conversations: z.array(ConversationSchema),

	backend: z.object({
		websocket: z.url(),
		api: z.url(),
	}),
});

export type KioskType = z.infer<typeof KioskSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
