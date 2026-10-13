// Локальный эмулятор GREEN-API для MAX: реализует методы, которые использует приложение,
// и принимает любые idInstance/apiTokenInstance. У каждого idInstance своё состояние в памяти процесса.
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

const PORT = Number(process.env.EMULATOR_PORT) || 3001;
const PANEL_PATH = join(import.meta.dirname, 'panel.html');

const AUTO_REPLY_DELAY_MS = 2500;
const STATUS_DELAYS_MS = { delivered: 800, read: 2000 };
/** Номера, оканчивающиеся на 0000, считаются незарегистрированными в MAX — для проверки ошибок. */
const NO_ACCOUNT_SUFFIX = '0000';

const AUTO_REPLIES = [
  'Привет! Получил твоё сообщение, спасибо. Сейчас как раз разбираю почту после выходных, так что дай мне минут двадцать — посмотрю всё внимательно и вернусь с ответом.',
  'Ок, договорились. Тогда давай так: я сегодня до вечера подготовлю черновик, скину тебе ссылку, а завтра утром созвонимся минут на пятнадцать и обсудим, что поправить. Если время неудобное — предложи своё.',
  'Сейчас на встрече и не могу нормально ответить 🙈\nОсвобожусь примерно через час, тогда напишу подробно. Если что-то срочное — лучше позвони.',
  'А можно подробнее? Не совсем понял, о какой версии идёт речь: о той, что мы показывали в пятницу, или уже о новой, с исправленной шапкой и списком чатов? От этого зависит, кому из дизайнеров переадресовать вопрос.',
  'Отлично 👍 Посмотрел, всё выглядит аккуратно. Единственное, что бросилось в глаза: на узких экранах длинные сообщения переносятся немного неровно, и время иногда прилипает к последнему слову. Глянь, пожалуйста, когда будет минутка.',
  'Слушай, по поводу завтрашней встречи:\n1. Начинаем в 11:00, а не в 10:30 — заказчик попросил сдвинуть.\n2. Нужно показать отправку и получение сообщений вживую.\n3. Презентацию можно не готовить, достаточно открытого браузера.\nЕсли есть вопросы — пиши.',
  'Да, видел. Честно говоря, я бы не стал усложнять: задача прямо говорит, что интерфейс должен быть максимально простым. Давай оставим только текстовые сообщения и список чатов, а всё остальное вынесем в отдельный список идей на потом.',
];

const settings = { autoReply: true };

/**
 * @typedef {object} Instance
 * @property {string} id
 * @property {number} nextReceiptId
 * @property {Map<string, { chatId: string, phone: string, name: string }>} contacts
 * @property {Map<string, any[]>} history История в формате GetChatHistory, по возрастанию времени.
 * @property {{ receiptId: number, body: any }[]} queue
 * @property {Set<() => void>} waiters
 */

/** @type {Map<string, Instance>} */
const instances = new Map();
/** Инстанс, к которому последним обращалось приложение: его панель показывает по умолчанию. */
let lastActiveInstanceId = null;

/** Инстанс создаётся при первом обращении и сразу получает демонстрационную переписку. */
function getInstance(id) {
  let instance = instances.get(id);
  if (!instance) {
    instance = { id, nextReceiptId: 1, contacts: new Map(), history: new Map(), queue: [], waiters: new Set() };
    instances.set(id, instance);
    seed(instance);
  }
  return instance;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const newMessageId = () => randomBytes(8).toString('hex').toUpperCase();

/**
 * chatId выводится из номера, чтобы не меняться между перезапусками эмулятора.
 * Берётся весь номер: остаток от деления схлопывал разные номера в один чат.
 */
const chatIdForPhone = (phone) => String(Number(phone));

function formatPhone(phone) {
  const ru = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  if (ru) return `+7 ${ru[1]} ${ru[2]}-${ru[3]}-${ru[4]}`;
  const by = /^375(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  if (by) return `+375 ${by[1]} ${by[2]}-${by[3]}-${by[4]}`;
  return `+${phone}`;
}

function addContact(instance, phone, name) {
  const chatId = chatIdForPhone(phone);
  const existing = instance.contacts.get(chatId);
  if (existing) return existing;
  const contact = { chatId, phone, name: name || formatPhone(phone) };
  instance.contacts.set(chatId, contact);
  instance.history.set(chatId, []);
  return contact;
}

function enqueue(instance, body) {
  instance.queue.push({ receiptId: instance.nextReceiptId++, body: { instanceData: instanceData(instance), ...body } });
  for (const wake of instance.waiters) wake();
}

function instanceData(instance) {
  return { idInstance: Number(instance.id), wid: '79990000000@c.us', typeInstance: 'max' };
}

function senderDataOf(contact) {
  return {
    chatId: contact.chatId,
    chatName: contact.name,
    chatType: 'user',
    sender: contact.chatId,
    senderName: contact.name,
    senderContactName: contact.name,
    senderPhoneNumber: Number(contact.phone),
  };
}

function incomingItem(contact, text, timestamp = nowSec()) {
  return {
    type: 'incoming',
    idMessage: newMessageId(),
    timestamp,
    typeMessage: 'textMessage',
    chatId: contact.chatId,
    chatType: 'user',
    textMessage: text,
    senderId: contact.chatId,
    senderName: contact.name,
    senderContactName: contact.name,
  };
}

function outgoingItem(chatId, text, statusMessage = 'sent', timestamp = nowSec()) {
  return {
    type: 'outgoing',
    idMessage: newMessageId(),
    timestamp,
    typeMessage: 'textMessage',
    chatId,
    chatType: 'user',
    textMessage: text,
    statusMessage,
    sendByApi: true,
  };
}

function receiveIncoming(instance, contact, text) {
  const item = incomingItem(contact, text);
  const { idMessage, timestamp } = item;
  instance.history.get(contact.chatId).push(item);
  enqueue(instance, {
    typeWebhook: 'incomingMessageReceived',
    timestamp,
    idMessage,
    senderData: senderDataOf(contact),
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  });
  return idMessage;
}

/** Журнал LastIncomingMessages / LastOutgoingMessages: сообщения за `minutes` минут, новые первыми. */
function journal(instance, type, query) {
  const since = nowSec() - (Number(query.get('minutes')) || 1440) * 60;
  return [...instance.history.values()]
    .flat()
    .filter((item) => item.type === type && item.timestamp >= since)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function setOutgoingStatus(instance, chatId, idMessage, status, description) {
  const message = instance.history.get(chatId)?.find((item) => item.idMessage === idMessage);
  if (message) message.statusMessage = status;
  enqueue(instance, {
    typeWebhook: 'outgoingMessageStatus',
    timestamp: nowSec(),
    idMessage,
    chatId,
    status,
    ...(description ? { description } : {}),
    sendByApi: true,
  });
}

// ---------- Методы GREEN-API ----------

const methods = {
  getstateinstance: () => ({ stateInstance: 'authorized' }),

  checkaccount: ({ instance, body }) => {
    const phone = String(body?.phoneNumber ?? '').replace(/\D/g, '');
    if (!phone) throw httpError(400, 'phoneNumber is required');
    if (phone.endsWith(NO_ACCOUNT_SUFFIX)) return { exist: false, chatId: '' };
    return { exist: true, chatId: addContact(instance, phone).chatId };
  },

  sendmessage: ({ instance, body }) => {
    const chatId = String(body?.chatId ?? '');
    const text = String(body?.message ?? '');
    if (!chatId || !text) throw httpError(400, 'chatId and message are required');

    const item = outgoingItem(chatId, text);
    const { idMessage, timestamp } = item;
    const contact = instance.contacts.get(chatId);
    if (!instance.history.has(chatId)) instance.history.set(chatId, []);
    instance.history.get(chatId).push(item);

    enqueue(instance, {
      typeWebhook: 'outgoingAPIMessageReceived',
      timestamp,
      idMessage,
      senderData: { chatId, chatName: contact?.name ?? '', chatType: 'user', sender: '79990000000@c.us', senderName: '' },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
    });

    if (!contact) {
      setTimeout(
        () => setOutgoingStatus(instance, chatId, idMessage, 'noAccount', 'Получатель не найден в эмуляторе'),
        500,
      );
      return { idMessage };
    }

    setTimeout(() => setOutgoingStatus(instance, chatId, idMessage, 'delivered'), STATUS_DELAYS_MS.delivered);
    if (settings.autoReply) {
      setTimeout(() => setOutgoingStatus(instance, chatId, idMessage, 'read'), STATUS_DELAYS_MS.read);
      setTimeout(() => {
        const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
        receiveIncoming(instance, contact, reply);
      }, AUTO_REPLY_DELAY_MS);
    }
    return { idMessage };
  },

  getchathistory: ({ instance, body }) => {
    const chatId = String(body?.chatId ?? '');
    const count = Number(body?.count) || 100;
    return [...(instance.history.get(chatId) ?? [])].reverse().slice(0, count);
  },

  lastincomingmessages: ({ instance, query }) => journal(instance, 'incoming', query),

  lastoutgoingmessages: ({ instance, query }) => journal(instance, 'outgoing', query),

  receivenotification: async ({ instance, query, res }) => {
    const timeoutSec = Math.min(Math.max(Number(query.get('receiveTimeout')) || 5, 5), 60);
    if (instance.queue.length) return instance.queue[0];

    await new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        instance.waiters.delete(done);
        resolve();
      };
      const timer = setTimeout(done, timeoutSec * 1000);
      instance.waiters.add(done);
      res.on('close', done);
    });
    return instance.queue[0] ?? null;
  },

  deletenotification: ({ instance, suffix }) => {
    const receiptId = Number(suffix);
    const index = instance.queue.findIndex((item) => item.receiptId === receiptId);
    if (index !== -1) instance.queue.splice(index, 1);
    return { result: index !== -1 };
  },
};

// ---------- API панели управления ----------

/** Инстанс, выбранный в панели, а если он не указан — тот, с которым последним работало приложение. */
function panelInstance(id) {
  return instances.get(id) ?? instances.get(lastActiveInstanceId) ?? null;
}

function requirePanelInstance(id) {
  const instance = panelInstance(id);
  if (!instance) throw httpError(400, 'Инстанс не выбран: сначала войдите в приложение');
  return instance;
}

const panelRoutes = {
  'GET /emulator/state': ({ query }) => {
    const instance = panelInstance(query.get('instance'));
    return {
      autoReply: settings.autoReply,
      instances: [...instances.keys()],
      instance: instance?.id ?? null,
      queueSize: instance?.queue.length ?? 0,
      contacts: [...(instance?.contacts.values() ?? [])].map((contact) => ({
        ...contact,
        messages: (instance.history.get(contact.chatId) ?? []).slice(-100),
      })),
    };
  },

  'POST /emulator/contacts': ({ body }) => {
    const instance = requirePanelInstance(body?.instance);
    const phone = String(body?.phone ?? '').replace(/\D/g, '');
    if (!phone) throw httpError(400, 'Укажите номер телефона');
    return addContact(instance, phone, String(body?.name ?? '').trim());
  },

  'POST /emulator/incoming': ({ body }) => {
    const instance = requirePanelInstance(body?.instance);
    const contact = instance.contacts.get(String(body?.chatId ?? ''));
    const text = String(body?.text ?? '').trim();
    if (!contact) throw httpError(404, 'Контакт не найден');
    if (!text) throw httpError(400, 'Пустое сообщение');
    return { idMessage: receiveIncoming(instance, contact, text) };
  },

  'POST /emulator/settings': ({ body }) => {
    if (typeof body?.autoReply === 'boolean') settings.autoReply = body.autoReply;
    return { autoReply: settings.autoReply };
  },
};

// ---------- HTTP ----------

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function send(res, status, payload, contentType = 'application/json; charset=utf-8') {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(contentType.startsWith('application/json') ? JSON.stringify(payload) : payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, 'Invalid JSON');
  }
}

const API_PATH = /^\/waInstance(\d+)\/(\w+)\/([^/]+)(?:\/([^/]+))?\/?$/;

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/panel')) {
      send(res, 200, await readFile(PANEL_PATH, 'utf8'), 'text/html; charset=utf-8');
      return;
    }

    const panelRoute = panelRoutes[`${req.method} ${url.pathname}`];
    if (panelRoute) {
      send(res, 200, panelRoute({ body: await readBody(req), query: url.searchParams }));
      return;
    }

    const match = API_PATH.exec(url.pathname);
    const handler = match && methods[match[2].toLowerCase()];
    if (!handler) throw httpError(404, `Unknown method: ${url.pathname}`);

    const instance = getInstance(match[1]);
    lastActiveInstanceId = instance.id;
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const result = await handler({ instance, body, query: url.searchParams, suffix: match[4], res });

    if (match[2].toLowerCase() !== 'receivenotification' || result) {
      console.log(`[${instance.id}] ${req.method} ${match[2]}`, body ? JSON.stringify(body) : (match[4] ?? ''));
    }
    send(res, 200, result);
  } catch (error) {
    const status = error.status ?? 500;
    if (status === 500) console.error(error);
    send(res, status, { message: error.message });
  }
});

/** Переписка за три предыдущих дня: [дней назад, время, кто пишет, текст]. */
const THREE_DAYS_DIALOG = [
  [3, '09:12', 'in', 'Доброе утро! Ты сегодня в офисе?'],
  [3, '09:15', 'out', 'Привет! Да, буду к десяти'],
  [3, '09:15', 'out', 'Что-то срочное?'],
  [3, '09:17', 'in', 'Хотел обсудить макеты для главной'],
  [3, '09:17', 'in', 'Дизайнер прислал новую версию'],
  [3, '09:18', 'in', 'Скину ссылку, как доберусь до ноутбука'],
  [3, '09:20', 'out', 'Ок, жду'],
  [3, '18:42', 'in', 'Посмотрел макеты?'],
  [3, '18:50', 'out', 'Да, в целом нравится'],
  [3, '18:51', 'out', 'Но шапку я бы сделал компактнее'],
  [3, '18:51', 'out', 'И кнопку «Новый чат» вынес бы наверх'],
  [3, '18:55', 'in', 'Согласен, передам'],
  [2, '11:03', 'out', 'Привет! Есть новости по макетам?'],
  [2, '11:30', 'in', 'Дизайнер обещал к вечеру'],
  [2, '11:31', 'in', 'Кстати, ты успеваешь со списком чатов?'],
  [2, '11:40', 'out', 'Почти готово, осталась вёрстка облачков'],
  [2, '20:14', 'in', 'Прислал обновлённые макеты, глянь завтра'],
  [2, '20:15', 'in', 'Там поправили скругления у сообщений'],
  [1, '10:05', 'out', 'Посмотрел, всё отлично 👍'],
  [1, '10:06', 'out', 'Сегодня внесу правки'],
  [1, '10:20', 'in', 'Супер! Тогда завтра покажем заказчику'],
  [1, '16:47', 'out', 'Правки внёс, можно проверять'],
  [1, '16:47', 'out', 'Ссылка та же'],
  [1, '17:02', 'in', 'Проверил, всё работает'],
  [1, '17:02', 'in', 'Спасибо!'],
  [1, '17:03', 'in', 'До завтра'],
  [1, '17:05', 'out', 'До завтра!'],
];

function daysAgoAt(daysAgo, time) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

function seed(instance) {
  const anna = addContact(instance, '79991112233', 'Анна');
  const ivan = addContact(instance, '375291234567', 'Иван');
  const hourAgo = nowSec() - 3600;
  instance.history.get(anna.chatId).push(
    incomingItem(anna, 'Привет! Как дела?', hourAgo),
    outgoingItem(anna.chatId, 'Привет, всё отлично', 'read', hourAgo + 60),
  );
  instance.history.get(ivan.chatId).push(
    outgoingItem(ivan.chatId, 'Иван, созвонимся завтра?', 'delivered', hourAgo + 120),
    incomingItem(ivan, 'Да, давай в одиннадцать', hourAgo + 180),
  );

  const colleague = addContact(instance, '79994445566');
  instance.history.get(colleague.chatId).push(
    ...THREE_DAYS_DIALOG.map(([daysAgo, time, from, text], index) => {
      // Сообщения с одинаковым временем разносятся по секундам, чтобы сохранить порядок.
      const timestamp = daysAgoAt(daysAgo, time) + index;
      return from === 'in' ? incomingItem(colleague, text, timestamp) : outgoingItem(colleague.chatId, text, 'read', timestamp);
    }),
  );
}

server.listen(PORT, () => {
  console.log(`Эмулятор GREEN-API: http://localhost:${PORT}`);
  console.log(`Панель управления:  http://localhost:${PORT}/`);
});
