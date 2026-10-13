import type {
  MessageData,
  MessageNotificationBody,
  NotificationBody,
  OutgoingStatus,
  StatusNotificationBody,
} from '../../api/types';
import { notificationBodySchema } from '../../api/schemas';
import type { AppThunk } from '../../app/store';
import { formatPhone } from '../../utils/phone';
import {
  messageReceived,
  messageStatusChanged,
  selectHasMessage,
  type MessageStatus,
} from '../messages/messagesSlice';

const MESSAGE_WEBHOOKS = new Set(['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived']);

function isMessageNotification(body: NotificationBody): body is MessageNotificationBody {
  return MESSAGE_WEBHOOKS.has(body.typeWebhook);
}

function isStatusNotification(body: NotificationBody): body is StatusNotificationBody {
  return body.typeWebhook === 'outgoingMessageStatus';
}

function extractText(messageData: MessageData): string | null {
  switch (messageData.typeMessage) {
    case 'textMessage':
      return messageData.textMessageData?.textMessage ?? null;
    case 'extendedTextMessage':
      return messageData.extendedTextMessageData?.text ?? null;
    default:
      return null;
  }
}

const STATUS_MAP: Record<OutgoingStatus, MessageStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'failed',
  notInGroup: 'failed',
};

const STATUS_ERRORS: Partial<Record<OutgoingStatus, string>> = {
  failed: 'Ошибка отправки на сервер MAX',
  noAccount: 'У получателя нет аккаунта MAX',
  notInGroup: 'Вы не участник этого чата',
};

/**
 * Превращает уведомление GREEN-API в действия хранилища.
 * Поддерживаются только текстовые сообщения в личных чатах — остальное игнорируется.
 */
export const processNotification =
  (rawBody: unknown): AppThunk =>
  (dispatch, getState) => {
    const result = notificationBodySchema.safeParse(rawBody);
    if (!result.success) {
      console.error('GREEN-API прислал некорректное уведомление', result.error.issues);
      return;
    }
    const body = result.data;

    if (isStatusNotification(body)) {
      const status = STATUS_MAP[body.status];
      if (!status) return;
      dispatch(
        messageStatusChanged({
          chatId: body.chatId,
          id: body.idMessage,
          status,
          error: body.description || STATUS_ERRORS[body.status],
        }),
      );
      return;
    }

    if (!isMessageNotification(body)) return;

    const { senderData, messageData, idMessage, timestamp, typeWebhook } = body;
    if (senderData.chatType && senderData.chatType !== 'user') return;

    const text = extractText(messageData);
    if (text === null) return;

    // Уведомление может прийти повторно, если DeleteNotification не успел выполниться.
    if (selectHasMessage(getState(), senderData.chatId, idMessage)) return;

    const incoming = typeWebhook === 'incomingMessageReceived';
    const phone = senderData.senderPhoneNumber ? String(senderData.senderPhoneNumber) : null;
    const name =
      senderData.chatName ||
      (incoming ? senderData.senderContactName || senderData.senderName : '') ||
      (phone ? formatPhone(phone) : senderData.chatId);

    dispatch(
      messageReceived({
        chat: { id: senderData.chatId, name, phone },
        message: {
          id: idMessage,
          chatId: senderData.chatId,
          text,
          timestamp: timestamp * 1000,
          direction: incoming ? 'incoming' : 'outgoing',
          status: incoming ? null : 'sent',
        },
      }),
    );
  };
