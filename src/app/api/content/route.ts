import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';
import { generateContentConcept, generateCarouselContent, analyzeImageAndGenerateContent } from '@/services/openai';
import { generateImage } from '@/services/imageGenerator';

export async function GET() {
  try {
    // 1. Fetch content logs ordered by latest
    const { data: logs, error: logsError } = await supabase
      .from('content_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    // 2. Fetch all images to map them to logs
    const { data: images, error: imagesError } = await supabase
      .from('uploaded_images')
      .select('*');

    if (imagesError) throw imagesError;

    // Map images to their respective logs
    const mappedLogs = (logs || []).map(log => {
      const logImages = (images || [])
        .filter(img => img.content_id === log.id)
        .map(img => img.image_url);
      return {
        ...log,
        image_urls: logImages
      };
    });

    return NextResponse.json({ ok: true, data: mappedLogs });
  } catch (error: any) {
    console.error('[API Content GET] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, image } = body; // type is 'auto' or 'vision'

    let resultLog;

    if (type === 'auto') {
      // 1. Generate concept
      const conceptPlan = await generateContentConcept();
      const recommended = conceptPlan.recommended_concept;

      // 2. Generate detailed slides & captions
      const fullContent = await generateCarouselContent(
        recommended.title,
        recommended.target_gender,
        recommended.carousel_structure
      );

      // 3. Generate image URLs
      const imageUrls = await Promise.all(
        fullContent.slides.map((slide, idx) => generateImage(slide.prompt, idx))
      );

      // 4. Save into Supabase DB
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

      if (logError || !logData) throw new Error(`DB Save Failed: ${logError?.message}`);

      // 5. Save image rows
      const imageRows = imageUrls.map(url => ({
        content_id: logData.id,
        image_url: url
      }));
      await supabase.from('uploaded_images').insert(imageRows);

      resultLog = {
        ...logData,
        image_urls: imageUrls
      };

    } else if (type === 'vision') {
      if (!image) {
        return NextResponse.json({ ok: false, error: 'Photo is required for analysis.' }, { status: 400 });
      }

      // 1. Analyze base64 image via Vision API
      const visionContent = await analyzeImageAndGenerateContent(image);

      // 2. Generate images
      const imageUrls = await Promise.all(
        visionContent.slides.map((slide, idx) => generateImage(slide.prompt, idx))
      );

      // 3. Save into Supabase DB
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

      if (logError || !logData) throw new Error(`DB Save Failed: ${logError?.message}`);

      // 4. Save image rows
      const imageRows = imageUrls.map(url => ({
        content_id: logData.id,
        image_url: url
      }));
      await supabase.from('uploaded_images').insert(imageRows);

      resultLog = {
        ...logData,
        image_urls: imageUrls
      };
    } else {
      return NextResponse.json({ ok: false, error: 'Invalid generation type' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: resultLog });
  } catch (error: any) {
    console.error('[API Content POST] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
