const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Escapes characters that are special in Telegram HTML
 */
export function escapeHTML(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends a message to a specific Telegram chat
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: { parseMode?: 'HTML' | 'Markdown'; replyMarkup?: any } = {}
) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured.');
    return null;
  }

  const url = `${TELEGRAM_API_URL}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup,
    }),
  });

  const result = await response.json();
  if (!result.ok) {
    console.error('Telegram sendMessage error:', result);
  }
  return result;
}

/**
 * Edits a message text in place (great for showing "loading..." or updating options)
 */
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  options: { parseMode?: 'HTML'; replyMarkup?: any } = {}
) {
  if (!TELEGRAM_BOT_TOKEN) return null;

  const url = `${TELEGRAM_API_URL}/editMessageText`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup,
    }),
  });

  const result = await response.json();
  if (!result.ok) {
    console.error('Telegram editMessageText error:', result);
  }
  return result;
}

/**
 * Acknowledges callback queries to remove the loading clock icon from the user's client
 */
export async function answerTelegramCallback(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return null;

  const url = `${TELEGRAM_API_URL}/answerCallbackQuery`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
    }),
  });

  return response.json();
}

/**
 * Downloads a photo file from Telegram's servers and converts it to a base64 string for Vision API
 */
export async function downloadTelegramPhoto(fileId: string): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;

  // 1. Get the file path
  const fileUrl = `${TELEGRAM_API_URL}/getFile?file_id=${fileId}`;
  const fileResponse = await fetch(fileUrl);
  const fileData = await fileResponse.json();

  if (!fileData.ok || !fileData.result.file_path) {
    console.error('Failed to get file path from Telegram:', fileData);
    return null;
  }

  const filePath = fileData.result.file_path;
  
  // 2. Fetch the file content
  const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
  const imgResponse = await fetch(downloadUrl);
  const arrayBuffer = await imgResponse.arrayBuffer();
  
  // 3. Convert buffer to base64
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

/**
 * Utility to format the generated content details for Telegram in premium HTML
 */
export function formatContentForTelegram(
  concept: string,
  gender: string,
  slides: any[],
  caption: string,
  hashtags: string
): string {
  let text = `<b>✨ 오늘 기획된 SMP 인스타 콘텐츠입니다!</b>\n\n`;
  text += `📌 <b>컨셉:</b> ${escapeHTML(concept)}\n`;
  text += `👥 <b>타겟:</b> ${escapeHTML(gender)} SMP\n\n`;
  
  text += `🖼️ <b>[슬라이드 구성 및 프롬프트]</b>\n`;
  slides.forEach((slide) => {
    text += `<b>${slide.slide_number}장 (${escapeHTML(slide.type)}):</b> <i>${escapeHTML(slide.description)}</i>\n`;
    text += `<code>프롬프트: ${escapeHTML(slide.prompt)}</code>\n\n`;
  });

  text += `✍️ <b>[인스타그램 캡션]</b>\n`;
  text += `<pre>${escapeHTML(caption)}</pre>\n\n`;

  text += `🏷️ <b>[해시태그]</b>\n`;
  text += `<i>${escapeHTML(hashtags)}</i>`;

  return text;
}
