import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';
import {
  generateContentConcept,
  generateCarouselContent,
  analyzeImageAndGenerateContent
} from '@/services/openai';
import {
  sendTelegramMessage,
  editTelegramMessage,
  answerTelegramCallback,
  downloadTelegramPhoto,
  formatContentForTelegram
} from '@/services/telegram';
import { generateImage } from '@/services/imageGenerator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[TelegramWebhook] Received update:', JSON.stringify(body, null, 2));

    // 1. Handle Callback Queries (Button Clicks)
    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    // 2. Handle Direct Messages (Text, Photos)
    if (body.message) {
      await handleMessage(body.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[TelegramWebhook] Global error handling update:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * Handles all inline button callback actions
 */
async function handleCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data;
  const callbackQueryId = callbackQuery.id;
  const chat = callbackQuery.message.chat;
  const messageId = callbackQuery.message.message_id;
  const chatId = chat.id;

  // Acknowledge the callback immediately
  await answerTelegramCallback(callbackQueryId);

  // A: Clicked "AI가 알아서 만들기"
  if (data === 'action_generate_auto') {
    await editTelegramMessage(
      chatId,
      messageId,
      `🤖 <b>AI 자동 콘텐츠 기획 중...</b>\n\n최근 콘텐츠 이력을 분석하여 가장 균형 잡힌 주제를 선정하고 있습니다. 잠시만 기다려주세요 (약 10초 소요). ☕`
    );

    try {
      // 1. Draft and select concept
      const conceptPlan = await generateContentConcept();
      const recommended = conceptPlan.recommended_concept;

      await editTelegramMessage(
        chatId,
        messageId,
        `✍️ <b>콘텐츠 구성 및 이미지 프롬프트 작성 중...</b>\n\n선정 주제: <i>${recommended.title}</i> (${recommended.target_gender} SMP)\n\n슬라이드별 극사실적 이미지 프롬프트를 조율하고 있습니다... 🛠️`
      );

      // 2. Generate full carousel via 3-agent pipeline (Agent2: prompts, Agent3: caption+hashtags)
      const fullContent = await generateCarouselContent(
        recommended.title,
        recommended.target_gender,
        recommended.carousel_structure,
        recommended.category,
        recommended.goal
      );

      // 3. Generate image previews (from Unsplash mock or live DALL-E)
      const imageUrls = await Promise.all(
        fullContent.slides.map((slide, idx) => generateImage(slide.prompt, idx))
      );

      // 4. Save into Supabase Database
      const { data: logData, error: logError } = await supabase
        .from('content_logs')
        .insert({
          content_type: 'auto',
          target_gender: fullContent.target_gender,
          concept: fullContent.concept,
          prompts: fullContent.slides,
          caption: fullContent.caption,
          hashtags: fullContent.hashtags,
          approval_status: 'pending'
        })
        .select()
        .single();

      if (logError || !logData) {
        throw new Error(`DB Save Failed: ${logError?.message}`);
      }

      // 5. Store image rows referencing the log
      const imageRows = imageUrls.map(url => ({
        content_id: logData.id,
        image_url: url
      }));
      await supabase.from('uploaded_images').insert(imageRows);

      // 6. Send the results formatted in HTML
      const telegramText = formatContentForTelegram(
        logData.concept,
        logData.target_gender,
        logData.prompts,
        logData.caption,
        logData.hashtags
      );

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ 승인 및 저장', callback_data: `approve_${logData.id}` },
            { text: '🔄 다시 생성', callback_data: `regenerate_${logData.id}` }
          ],
          [
            { text: '✍️ 캡션 수정', callback_data: `edit_caption_${logData.id}` },
            { text: '🏷️ 해시태그 수정', callback_data: `edit_tags_${logData.id}` }
          ]
        ]
      };

      // Notify completion and send the new complete card
      await editTelegramMessage(chatId, messageId, `✅ <b>콘텐츠 기획이 성공적으로 완료되었습니다!</b> 아래 세부내역을 확인하고 승인해 주세요.`);
      await sendTelegramMessage(chatId, telegramText, { replyMarkup });

    } catch (err: any) {
      console.error('Auto content generation error:', err);
      await sendTelegramMessage(chatId, `❌ <b>콘텐츠 생성 실패:</b> ${err.message || err}`);
    }
  }

  // B: Clicked "사진 첨부해서 만들기"
  else if (data === 'action_upload_photo_info') {
    // Save session state to awaiting photo
    await supabase.from('user_sessions').upsert({
      chat_id: String(chatId),
      state: 'awaiting_photo',
      updated_at: new Date().toISOString()
    });

    await editTelegramMessage(
      chatId,
      messageId,
      `📸 <b>사진 첨부해서 만들기</b>\n\n분석할 SMP 포트폴리오용 두피 또는 시술 사진을 채팅창에 전송해주세요.\n\n⚠️ <i>사진 전송 시 <b>'압축하지 않고 전송(File)'</b> 또는 일반 <b>'사진(Photo)'</b> 형태로 그대로 올려주시면 됩니다.</i>`
    );
  }

  // C: Clicked "오늘은 건너뛰기"
  else if (data === 'action_skip_today') {
    await editTelegramMessage(
      chatId,
      messageId,
      `⏭️ <b>오늘은 콘텐츠 생성을 건너뜁니다.</b>\n\n내일 오전 9시에 새로운 트렌드로 알림을 보내드리겠습니다. 좋은 하루 보내세요! ☀️`
    );
  }

  // D: Clicked "승인" (approve_<uuid>)
  else if (data.startsWith('approve_')) {
    const contentId = data.replace('approve_', '');
    
    // Update Supabase approval status
    const { error } = await supabase
      .from('content_logs')
      .update({ approval_status: 'approved' })
      .eq('id', contentId);

    if (error) {
      await sendTelegramMessage(chatId, `❌ <b>DB 상태 변경 실패:</b> ${error.message}`);
      return;
    }

    // Prepend approval status to the original message
    const updatedText = `<b>[✅ 최종 승인 완료]</b>\n\n` + callbackQuery.message.text;
    await editTelegramMessage(chatId, messageId, updatedText);
    await sendTelegramMessage(chatId, `🎉 <b>콘텐츠 최종 승인 완료!</b> 대시보드에 상태가 반영되었습니다. 인스타그램에 게시물을 업로드해 주세요!`);
  }

  // E: Clicked "다시 생성" (regenerate_<uuid>)
  else if (data.startsWith('regenerate_')) {
    const contentId = data.replace('regenerate_', '');
    
    await editTelegramMessage(
      chatId,
      messageId,
      `🔄 <b>동일한 컨셉으로 인스타 콘텐츠 재구성 중...</b>\n\n새로운 관점의 프롬프트와 캡션안을 다듬고 있습니다. 잠시만 기다려주세요... ☕`
    );

    try {
      // Fetch previous concept details
      const { data: oldLog } = await supabase
        .from('content_logs')
        .select('*')
        .eq('id', contentId)
        .single();

      if (!oldLog) throw new Error('이전 콘텐츠 이력을 찾을 수 없습니다.');

      // 1. Re-generate content using the same concept title
      const fullContent = await generateCarouselContent(
        oldLog.concept,
        oldLog.target_gender,
        oldLog.prompts
      );

      // 2. Generate new slide images
      const imageUrls = await Promise.all(
        fullContent.slides.map((slide, idx) => generateImage(slide.prompt, idx))
      );

      // 3. Update existing row or insert new row as pending
      const { data: logData, error: logError } = await supabase
        .from('content_logs')
        .update({
          prompts: fullContent.slides,
          caption: fullContent.caption,
          hashtags: fullContent.hashtags,
          approval_status: 'pending'
        })
        .eq('id', contentId)
        .select()
        .single();

      if (logError || !logData) throw new Error(`DB 업데이트 실패: ${logError?.message}`);

      // 4. Delete old images and insert new ones
      await supabase.from('uploaded_images').delete().eq('content_id', contentId);
      const imageRows = imageUrls.map(url => ({
        content_id: contentId,
        image_url: url
      }));
      await supabase.from('uploaded_images').insert(imageRows);

      // 5. Send updated telegram message
      const telegramText = formatContentForTelegram(
        logData.concept,
        logData.target_gender,
        logData.prompts,
        logData.caption,
        logData.hashtags
      );

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ 승인 및 저장', callback_data: `approve_${logData.id}` },
            { text: '🔄 다시 생성', callback_data: `regenerate_${logData.id}` }
          ],
          [
            { text: '✍️ 캡션 수정', callback_data: `edit_caption_${logData.id}` },
            { text: '🏷️ 해시태그 수정', callback_data: `edit_tags_${logData.id}` }
          ]
        ]
      };

      await editTelegramMessage(chatId, messageId, `✅ <b>콘텐츠 재기획이 완료되었습니다!</b>`);
      await sendTelegramMessage(chatId, telegramText, { replyMarkup });

    } catch (err: any) {
      await sendTelegramMessage(chatId, `❌ <b>재생성 실패:</b> ${err.message}`);
    }
  }

  // F: Clicked "캡션 수정" (edit_caption_<uuid>)
  else if (data.startsWith('edit_caption_')) {
    const contentId = data.replace('edit_caption_', '');
    
    await supabase.from('user_sessions').upsert({
      chat_id: String(chatId),
      state: `awaiting_caption_edit_${contentId}`,
      updated_at: new Date().toISOString()
    });

    await sendTelegramMessage(chatId, `✍️ <b>새로운 인스타그램 캡션을 작성하여 전송해주세요.</b>\n줄바꿈과 이모지가 그대로 적용됩니다.`, {
      replyMarkup: { force_reply: true }
    });
  }

  // G: Clicked "해시태그 수정" (edit_tags_<uuid>)
  else if (data.startsWith('edit_tags_')) {
    const contentId = data.replace('edit_tags_', '');
    
    await supabase.from('user_sessions').upsert({
      chat_id: String(chatId),
      state: `awaiting_tags_edit_${contentId}`,
      updated_at: new Date().toISOString()
    });

    await sendTelegramMessage(chatId, `🏷️ <b>새로운 해시태그 목록을 작성하여 전송해주세요.</b>\n띄어쓰기로 해시태그를 구분하십시오.\n예: <i>#두피문신 #여성탈모 #SMP</i>`, {
      replyMarkup: { force_reply: true }
    });
  }
}

/**
 * Handles direct text messages and uploaded images
 */
async function handleMessage(message: any) {
  const chatId = message.chat.id;
  const messageText = message.text;
  const isPhoto = message.photo && message.photo.length > 0;
  const isDocumentPhoto = message.document && message.document.mime_type?.startsWith('image/');

  // Fetch session state
  const { data: session } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('chat_id', String(chatId))
    .single();

  const state = session?.state || 'idle';

  // 1. Process Photo Uploads (for Scalp analysis via Vision API)
  if (isPhoto || isDocumentPhoto) {
    const fileId = isPhoto 
      ? message.photo[message.photo.length - 1].file_id // Get highest res photo
      : message.document.file_id;

    await sendTelegramMessage(chatId, `📸 <b>두피 사진을 성공적으로 수신했습니다!</b>\n\nOpenAI Vision API를 활용해 시술 부위(성별, 정수리/가르마 등)를 분석하고 맞춤형 프리미엄 SMP 인스타 포트폴리오를 디자인하는 중입니다... ☕ (약 15초 소요)`);

    try {
      // 1. Download file and encode as base64
      const base64Img = await downloadTelegramPhoto(fileId);
      if (!base64Img) throw new Error('Telegram 사진 다운로드 실패');

      // 2. Send base64 image to OpenAI Vision
      const visionContent = await analyzeImageAndGenerateContent(base64Img);

      // 3. Generate preview images for slides
      const imageUrls = await Promise.all(
        visionContent.slides.map((slide, idx) => generateImage(slide.prompt, idx))
      );

      // 4. Save to Supabase DB as pending
      const { data: logData, error: logError } = await supabase
        .from('content_logs')
        .insert({
          content_type: 'vision',
          target_gender: visionContent.target_gender,
          concept: visionContent.concept,
          prompts: visionContent.slides,
          caption: visionContent.caption,
          hashtags: visionContent.hashtags,
          approval_status: 'pending'
        })
        .select()
        .single();

      if (logError || !logData) throw new Error(`DB 저장 실패: ${logError?.message}`);

      // 5. Save photo references in uploaded_images
      const imageRows = imageUrls.map(url => ({
        content_id: logData.id,
        image_url: url
      }));
      await supabase.from('uploaded_images').insert(imageRows);

      // 6. Reset session state
      await supabase.from('user_sessions').upsert({
        chat_id: String(chatId),
        state: 'idle',
        updated_at: new Date().toISOString()
      });

      // 7. Format and send to Telegram
      const telegramText = formatContentForTelegram(
        logData.concept,
        logData.target_gender,
        logData.prompts,
        logData.caption,
        logData.hashtags
      );

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ 승인 및 저장', callback_data: `approve_${logData.id}` },
            { text: '🔄 다시 생성', callback_data: `regenerate_${logData.id}` }
          ],
          [
            { text: '✍️ 캡션 수정', callback_data: `edit_caption_${logData.id}` },
            { text: '🏷️ 해시태그 수정', callback_data: `edit_tags_${logData.id}` }
          ]
        ]
      };

      await sendTelegramMessage(chatId, `✨ <b>사진 분석 및 기획이 끝났습니다!</b> 아래 내역을 확인해 주세요.`);
      await sendTelegramMessage(chatId, telegramText, { replyMarkup });

    } catch (err: any) {
      console.error('Vision analysis error:', err);
      await sendTelegramMessage(chatId, `❌ <b>사진 분석 기획 실패:</b> ${err.message}`);
    }
    return;
  }

  // 2. Process Text message based on current State
  if (messageText) {
    // If command /start
    if (messageText === '/start' || messageText === '/smp') {
      await sendTelegramMessage(chatId, `👋 <b>안녕하세요! Premium SMP 인스타 콘텐츠 기획 봇입니다.</b>\n\n매일 아침 브랜드 가이드에 맞는 자연스러운 SMP 콘텐츠를 제안해 드립니다. 아래 버튼을 눌러 작업을 시작해 보세요.`, {
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '🤖 AI가 알아서 만들기', callback_data: 'action_generate_auto' },
              { text: '📸 사진 첨부해서 만들기', callback_data: 'action_upload_photo_info' }
            ],
            [
              { text: '⏭️ 오늘은 건너뛰기', callback_data: 'action_skip_today' }
            ]
          ]
        }
      });
      return;
    }

    // Awaiting caption edit state
    if (state.startsWith('awaiting_caption_edit_')) {
      const contentId = state.replace('awaiting_caption_edit_', '');

      // Update caption in DB
      const { error } = await supabase
        .from('content_logs')
        .update({ caption: messageText })
        .eq('id', contentId);

      if (error) {
        await sendTelegramMessage(chatId, `❌ <b>캡션 업데이트 실패:</b> ${error.message}`);
        return;
      }

      // Reset state to idle
      await supabase.from('user_sessions').upsert({
        chat_id: String(chatId),
        state: 'idle',
        updated_at: new Date().toISOString()
      });

      // Get updated data to show the user
      const { data: updatedLog } = await supabase
        .from('content_logs')
        .select('*')
        .eq('id', contentId)
        .single();

      if (!updatedLog) return;

      await sendTelegramMessage(chatId, `✅ <b>캡션이 성공적으로 수정되었습니다!</b> 아래는 업데이트된 콘텐츠 내역입니다.`);

      const telegramText = formatContentForTelegram(
        updatedLog.concept,
        updatedLog.target_gender,
        updatedLog.prompts,
        updatedLog.caption,
        updatedLog.hashtags
      );

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ 승인 및 저장', callback_data: `approve_${updatedLog.id}` },
            { text: '🔄 다시 생성', callback_data: `regenerate_${updatedLog.id}` }
          ],
          [
            { text: '✍️ 캡션 수정', callback_data: `edit_caption_${updatedLog.id}` },
            { text: '🏷️ 해시태그 수정', callback_data: `edit_tags_${updatedLog.id}` }
          ]
        ]
      };

      await sendTelegramMessage(chatId, telegramText, { replyMarkup });
      return;
    }

    // Awaiting hashtags edit state
    if (state.startsWith('awaiting_tags_edit_')) {
      const contentId = state.replace('awaiting_tags_edit_', '');

      // Update hashtags in DB
      const { error } = await supabase
        .from('content_logs')
        .update({ hashtags: messageText })
        .eq('id', contentId);

      if (error) {
        await sendTelegramMessage(chatId, `❌ <b>해시태그 업데이트 실패:</b> ${error.message}`);
        return;
      }

      // Reset state to idle
      await supabase.from('user_sessions').upsert({
        chat_id: String(chatId),
        state: 'idle',
        updated_at: new Date().toISOString()
      });

      // Get updated data
      const { data: updatedLog } = await supabase
        .from('content_logs')
        .select('*')
        .eq('id', contentId)
        .single();

      if (!updatedLog) return;

      await sendTelegramMessage(chatId, `✅ <b>해시태그가 성공적으로 수정되었습니다!</b> 아래는 업데이트된 콘텐츠 내역입니다.`);

      const telegramText = formatContentForTelegram(
        updatedLog.concept,
        updatedLog.target_gender,
        updatedLog.prompts,
        updatedLog.caption,
        updatedLog.hashtags
      );

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ 승인 및 저장', callback_data: `approve_${updatedLog.id}` },
            { text: '🔄 다시 생성', callback_data: `regenerate_${updatedLog.id}` }
          ],
          [
            { text: '✍️ 캡션 수정', callback_data: `edit_caption_${updatedLog.id}` },
            { text: '🏷️ 해시태그 수정', callback_data: `edit_tags_${updatedLog.id}` }
          ]
        ]
      };

      await sendTelegramMessage(chatId, telegramText, { replyMarkup });
      return;
    }

    // If waiting for photo, but user sent text instead
    if (state === 'awaiting_photo') {
      await sendTelegramMessage(chatId, `⚠️ <b>현재 시술 전후 두피 사진을 기다리는 중입니다.</b>\n\n분석할 이미지를 전송해 주시거나, 작업을 종료하려면 <code>/start</code>를 전송하십시오.`);
      return;
    }

    // Default chat fallback
    await sendTelegramMessage(chatId, `안녕하세요! Premium SMP 인스타 콘텐츠 기획 봇입니다. 🤖\n시작하시려면 <code>/start</code> 또는 <code>/smp</code>를 입력하세요!`);
  }
}
