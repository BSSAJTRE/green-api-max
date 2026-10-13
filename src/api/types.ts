import type { z } from 'zod';
import type {
  chatTypeSchema,
  checkAccountResponseSchema,
  credentialsSchema,
  getStateInstanceResponseSchema,
  historyMessageSchema,
  instanceStateSchema,
  messageDataSchema,
  messageNotificationBodySchema,
  notificationBodySchema,
  otherNotificationBodySchema,
  outgoingStatusSchema,
  receivedNotificationSchema,
  senderDataSchema,
  sendMessageResponseSchema,
  statusNotificationBodySchema,
} from './schemas';

export type Credentials = z.infer<typeof credentialsSchema>;
export type InstanceState = z.infer<typeof instanceStateSchema>;
export type GetStateInstanceResponse = z.infer<typeof getStateInstanceResponseSchema>;
export type CheckAccountResponse = z.infer<typeof checkAccountResponseSchema>;
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;
export type ChatType = z.infer<typeof chatTypeSchema>;

/** Формат сообщений GetChatHistory и журналов LastIncomingMessages / LastOutgoingMessages. */
export type HistoryMessage = z.infer<typeof historyMessageSchema>;
export type MessageData = z.infer<typeof messageDataSchema>;
export type SenderData = z.infer<typeof senderDataSchema>;
export type OutgoingStatus = z.infer<typeof outgoingStatusSchema>;
export type MessageNotificationBody = z.infer<typeof messageNotificationBodySchema>;
export type StatusNotificationBody = z.infer<typeof statusNotificationBodySchema>;
export type OtherNotificationBody = z.infer<typeof otherNotificationBodySchema>;
export type NotificationBody = z.infer<typeof notificationBodySchema>;
export type ReceivedNotification = z.infer<typeof receivedNotificationSchema>;
