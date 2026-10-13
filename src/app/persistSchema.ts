import { z } from 'zod';
import { credentialsSchema } from '../api/schemas';

const persistedChatSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  phone: z.string().nullable(),
  unread: z.number().int().nonnegative(),
  lastActivity: z.number().int().nonnegative(),
});

const persistedMessageSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  text: z.string(),
  timestamp: z.number().int().nonnegative(),
  direction: z.enum(['incoming', 'outgoing']),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).nullable(),
  error: z.string().optional(),
});

export const persistedStateSchema = z.object({
  credentials: credentialsSchema,
  chats: z.array(persistedChatSchema).default([]),
  activeChatId: z.string().nullable(),
  messages: z.record(z.string(), z.array(persistedMessageSchema)).default({}),
});

export type PersistedState = z.infer<typeof persistedStateSchema>;
