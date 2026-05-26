import OpenAI from 'openai';
import { supabase } from './supabase';
import {
  CAROUSEL_CONCEPT_SYSTEM_PROMPT,
  CONTENT_AI_SYSTEM_PROMPT,
  VISION_AI_SYSTEM_PROMPT
} from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-openai-key-for-static-build-compilation-only',
});

export interface CarouselSlide {
  slide_number: number;
  type: string;
  description: string;
  prompt: string;
}

export interface GeneratedContent {
  target_gender: string;
  concept: string;
  slides: CarouselSlide[];
  caption: string;
  hashtags: string;
}

/**
 * 1. Generates 3 concept options, picks the recommended one considering gender balance.
 */
export async function generateContentConcept(): Promise<any> {
  // Query Supabase for recent content logs to evaluate gender balance (last 10 entries)
  let femaleCount = 0;
  let maleCount = 0;
  let recentConcepts: string[] = [];
  
  try {
    const { data } = await supabase
      .from('content_logs')
      .select('target_gender, concept')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data && data.length > 0) {
      data.forEach(log => {
        if (log.target_gender === '여성' || log.target_gender?.toLowerCase() === 'female') {
          femaleCount++;
        } else {
          maleCount++;
        }
        if (log.concept) {
          recentConcepts.push(log.concept);
        }
      });
    }
  } catch (error) {
    console.error('Error fetching gender history:', error);
  }

  // Brand preference & Strategic Feed Rotation
  const ratioContext = `[과거 발행 이력 분석 및 피드 최적화 지침]
  - 최근 10회 타겟 성별 분포: 여성 ${femaleCount}회, 남성 ${maleCount}회. (목표 비율: 여성 70%, 남성 30%)
  - 최근 발행된 기획안 주제들:
    ${recentConcepts.length > 0 ? recentConcepts.map((c, i) => `${i+1}. ${c}`).join('\n    ') : '이력이 없습니다.'}
  
  ⚠️ 중요 지침: 매일 인스타 피드가 지루해지지 않고 최적화되도록, 어제나 최근에 발행된 '주제' 및 '포맷(예: 시술 전후 비교, 정보성 카드뉴스, Q&A, 고객 후기 등)'이 연속해서 겹치지 않도록 완전히 새로운 포맷으로 로테이션하여 기획하세요.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Premium model for deep concept planning
    messages: [
      { role: 'system', content: CAROUSEL_CONCEPT_SYSTEM_PROMPT },
      { role: 'user', content: `오늘의 콘텐츠 콘셉트를 기획해주세요. \n${ratioContext}` }
    ],
    response_format: { type: 'json_object' }
  });

  const rawJson = response.choices[0]?.message?.content || '{}';
  return JSON.parse(rawJson);
}

/**
 * 2. Generates slide-by-slide prompts, caption, and hashtags based on a selected concept.
 */
export async function generateCarouselContent(
  conceptTitle: string,
  targetGender: string,
  carouselStructure: any[]
): Promise<GeneratedContent> {
  const userPrompt = `
  선정된 오늘의 콘텐츠 콘셉트입니다:
  - 제목: ${conceptTitle}
  - 대상 타겟 성별: ${targetGender}
  - 연출 구조: ${JSON.stringify(carouselStructure, null, 2)}
  
  이 콘셉트를 기반으로 극사실적 이미지 생성 프롬프트(각 슬라이드별 영어)와 인스타그램 전용 한국어 캡션 및 해시태그를 생성하십시오.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Best for high-end copywriting and prompt synthesis
    messages: [
      { role: 'system', content: CONTENT_AI_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const rawJson = response.choices[0]?.message?.content || '{}';
  return JSON.parse(rawJson) as GeneratedContent;
}

/**
 * 3. Vision API: Analyzes a base64 scalp image and designs a customized portfolio post.
 */
export async function analyzeImageAndGenerateContent(
  base64Image: string
): Promise<GeneratedContent> {
  // Check if base64 contains the data prefix, strip it if needed but OpenAI expects the full data URI
  const imageUrl = base64Image.startsWith('data:') 
    ? base64Image 
    : `data:image/jpeg;base64,${base64Image}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Must use gpt-4o for complex vision reasoning
    messages: [
      { role: 'system', content: VISION_AI_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '다음 두피/가르마 사진을 면밀히 분석하고 프리미엄 SMP 시술 전후를 가정한 인스타그램 콘텐츠 기획안을 작성해 주세요.' },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' }
  });

  const rawJson = response.choices[0]?.message?.content || '{}';
  return JSON.parse(rawJson) as GeneratedContent;
}
