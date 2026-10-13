import { z } from 'zod';

const nonEmptyString = z.string().min(1);
const unixTimestampSchema = z.number().int().nonnegative();

export const credentialsSchema = z.object({
  apiUrl: nonEmptyString,
  idInstance: nonEmptyString,
  apiTokenInstance: nonEmptyString,
});

export const instanceStateSchema = z.enum([
  'notAuthorized',
  'authorized',
  'blocked',
  'starting',
  'suspended',
  'pendingPassword',
]);

export const getStateInstanceResponseSchema = z.object({
  stateInstance: instanceStateSchema,
});

export const checkAccountResponseSchema = z.union([
  z.object({
    exist: z.boolean(),
    // При exist=false GREEN-API может не прислать chatId.
    chatId: z.string().default(''),
    fromCache: z.boolean().optional(),
  }),
  z.object({
    status: z.literal(false),
    reason: nonEmptyString,
  }),
]);

export const sendMessageResponseSchema = z.object({
  idMessage: nonEmptyString,
});

export const chatTypeSchema = z.enum(['user', 'group', 'channel', 'bot']);

export const historyMessageSchema = z.object({
  type: z.enum(['incoming', 'outgoing']),
  idMessage: nonEmptyString,
  timestamp: unixTimestampSchema,
  typeMessage: nonEmptyString,
  chatId: nonEmptyString,
  chatType: chatTypeSchema.optional(),
  textMessage: z.string().optional(),
  extendedTextMessage: z.object({ text: z.string() }).optional(),
  statusMessage: z.string().optional(),
  senderName: z.string().optional(),
  senderContactName: z.string().optional(),
});

export const historyMessagesSchema = z.array(historyMessageSchema);

export const messageDataSchema = z.object({
  typeMessage: nonEmptyString,
  textMessageData: z.object({ textMessage: z.string() }).optional(),
  extendedTextMessageData: z.object({ text: z.string() }).optional(),
});

export const senderDataSchema = z.object({
  chatId: nonEmptyString,
  chatName: z.string().optional(),
  chatType: chatTypeSchema.optional(),
  sender: z.string().optional(),
  senderName: z.string().optional(),
  senderContactName: z.string().optional(),
  senderPhoneNumber: z.number().optional(),
});

const messageWebhookSchema = z.enum([
  'incomingMessageReceived',
  'outgoingMessageReceived',
  'outgoingAPIMessageReceived',
]);

export const outgoingStatusSchema = z.enum([
  'sent',
  'delivered',
  'read',
  'failed',
  'noAccount',
  'notInGroup',
]);

export const messageNotificationBodySchema = z.object({
  typeWebhook: messageWebhookSchema,
  timestamp: unixTimestampSchema,
  idMessage: nonEmptyString,
  senderData: senderDataSchema,
  messageData: messageDataSchema,
});

export const statusNotificationBodySchema = z.object({
  typeWebhook: z.literal('outgoingMessageStatus'),
  timestamp: unixTimestampSchema,
  idMessage: nonEmptyString,
  chatId: nonEmptyString,
  status: outgoingStatusSchema,
  description: z.string().optional(),
});

const knownWebhookTypes = new Set<string>([
  'incomingMessageReceived',
  'outgoingMessageReceived',
  'outgoingAPIMessageReceived',
  'outgoingMessageStatus',
]);

export const otherNotificationBodySchema = z.object({
  typeWebhook: nonEmptyString.refine((value) => !knownWebhookTypes.has(value), {
    message: 'Известный typeWebhook имеет некорректную структуру',
  }),
  timestamp: unixTimestampSchema.optional(),
});

export const notificationBodySchema = z.union([
  messageNotificationBodySchema,
  statusNotificationBodySchema,
  otherNotificationBodySchema,
]);

/**
 * Тело уведомления валидируется отдельно в processNotification. Даже повреждённое
 * или новое уведомление должно сохранить receiptId, чтобы polling удалил его из очереди.
 */
export const receivedNotificationSchema = z.object({
  receiptId: z.number().int().nonnegative(),
  body: z.unknown(),
});

export const receiveNotificationResponseSchema = receivedNotificationSchema.nullable();

export const deleteNotificationResponseSchema = z.object({
  result: z.boolean(),
});
