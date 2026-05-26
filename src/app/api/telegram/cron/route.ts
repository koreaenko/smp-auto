import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/services/telegram';

export async function GET(req: NextRequest) {
  try {
    console.log('[Cron] Received daily content cron trigger request.');

    // 1. Security Check: Prevent arbitrary triggers in production
    // Vercel Cron injects: Authorization: Bearer <CRON_SECRET>
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // In local development or if CRON_SECRET is not configured, we allow testing easily.
    // In production, we strictly match the cron secrets.
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const urlToken = req.nextUrl.searchParams.get('token');
      if (urlToken !== cronSecret) {
        console.warn('[Cron] Unauthorized cron trigger attempt.');
        return NextResponse.json(
          { ok: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      throw new Error('TELEGRAM_CHAT_ID environment variable is missing.');
    }

    // 2. Send the interactive starter question to Telegram
    const text = `<b>📅 좋은 아침입니다! 오늘 SMP 콘텐츠 작업을 진행할까요?</b>\n\n최근 브랜드 흐름에 발맞춰 트렌디한 피드를 구성해 드립니다. 아래 옵션 중 하나를 선택하세요.`;
    
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🤖 AI가 알아서 만들기', callback_data: 'action_generate_auto' },
          { text: '📸 사진 첨부해서 만들기', callback_data: 'action_upload_photo_info' }
        ],
        [
          { text: '⏭️ 오늘은 건너뛰기', callback_data: 'action_skip_today' }
        ]
      ]
    };

    const result = await sendTelegramMessage(chatId, text, { replyMarkup });
    
    if (result && result.ok) {
      console.log('[Cron] Message sent successfully.');
      return NextResponse.json({ ok: true, message: 'Telegram prompt sent.' });
    } else {
      throw new Error(result?.description || 'Telegram Bot send failed');
    }
  } catch (error: any) {
    console.error('[Cron] Error running daily cron trigger:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
