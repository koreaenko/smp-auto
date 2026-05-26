import OpenAI from 'openai';
import { supabase } from './supabase';
import {
  AGENT1_CONTENT_DIRECTOR,
  AGENT2_IMAGE_PROMPT_ENGINEER,
  AGENT3_COPYWRITER,
  VISION_ANALYSIS_AGENT
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

// ─────────────────────────────────────────────
// [Agent 1] 콘텐츠 디렉터: 피드 분석 & 오늘의 기획
// ─────────────────────────────────────────────

export async function generateContentConcept(): Promise<any> {
  let femaleCount = 0;
  let maleCount = 0;
  let recentConcepts: string[] = [];
  let recentCategories: string[] = [];
  
  try {
    const { data } = await supabase
      .from('content_logs')
      .select('target_gender, concept, content_type')
      .order('created_at', { ascending: false })
      .limit(30);
      
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
    console.error('[Agent1] Error fetching history:', error);
  }

  const feedAnalysis = `[피드 이력 분석 데이터]
  - 최근 30회 성별 분포: 여성 ${femaleCount}회, 남성 ${maleCount}회 (목표: 여성 70%, 남성 30%)
  - 최근 발행된 기획안 주제들:
    ${recentConcepts.length > 0 ? recentConcepts.map((c, i) => `${i+1}. ${c}`).join('\n    ') : '발행 이력이 없습니다. 첫 콘텐츠를 자유롭게 기획하세요.'}
  
  위 데이터를 분석하여, 같은 유형이 연속되지 않고 피드 전체 밸런스가 최적화되는 오늘의 콘텐츠를 기획하세요.`;

  console.log('[Agent1] 콘텐츠 디렉터 에이전트 호출...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: AGENT1_CONTENT_DIRECTOR },
      { role: 'user', content: `오늘의 콘텐츠 콘셉트를 기획해주세요.\n${feedAnalysis}` }
    ],
    response_format: { type: 'json_object' }
  });

  const rawJson = response.choices[0]?.message?.content || '{}';
  console.log('[Agent1] 기획 완료.');
  return JSON.parse(rawJson);
}

// ─────────────────────────────────────────────
// [Agent 2] 이미지 프롬프트 엔지니어: 슬라이드별 영문 프롬프트 생성
// ─────────────────────────────────────────────

export async function generateImagePrompts(
  conceptTitle: string,
  targetGender: string,
  carouselStructure: any[]
): Promise<CarouselSlide[]> {
  const userPrompt = `
  [콘텐츠 디렉터가 기획한 오늘의 콘셉트]
  - 제목: ${conceptTitle}
  - 대상 타겟 성별: ${targetGender}
  - 캐러셀 구조:
  ${JSON.stringify(carouselStructure, null, 2)}
  
  위 기획안을 바탕으로, 각 슬라이드별 초고퀄리티 영문 이미지 생성 프롬프트를 작성하십시오.
  반드시 [STYLE] [LIGHTING] [SUBJECT] [RULES] [QUALITY] 구조를 준수하십시오.
  `;

  console.log('[Agent2] 이미지 프롬프트 엔지니어 에이전트 호출...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: AGENT2_IMAGE_PROMPT_ENGINEER },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const rawJson = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(rawJson);
  console.log('[Agent2] 이미지 프롬프트 생성 완료.');
  return parsed.slides as CarouselSlide[];
}

// ─────────────────────────────────────────────
// [Agent 3] 카피라이터: 캡션 + 후킹 + 해시태그 생성
// ─────────────────────────────────────────────

export async function generateCaptionAndHashtags(
  conceptTitle: string,
  targetGender: string,
  category: string,
  goal: string
): Promise<{ caption: string; hashtags: string }> {
  const userPrompt = `
  [콘텐츠 디렉터가 기획한 오늘의 콘셉트]
  - 제목: ${conceptTitle}
  - 대상 타겟 성별: ${targetGender}
  - 콘텐츠 카테고리: ${category}
  - 목표: ${goal}
  
  위 기획안을 바탕으로, 인스타그램에 즉시 복붙할 수 있는 완성형 캡션(후킹 문장 포함)과 해시태그를 작성하십시오.
  캡션은 5단계 공식(후킹→공감→해결→전문성→DM유도)을 반드시 지키십시오.
  해시태그는 반드시 #더톡 #THETOK #안양두피문신 #안양SMP #평촌두피문신 #범계두피문신을 포함하십시오.
  `;

  console.log('[Agent3] 카피라이터 에이전트 호출...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: AGENT3_COPYWRITER },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const rawJson = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(rawJson);
  console.log('[Agent3] 캡션 & 해시태그 생성 완료.');
  return {
    caption: parsed.caption || '',
    hashtags: parsed.hashtags || ''
  };
}

// ─────────────────────────────────────────────
// 🔗 3단계 파이프라인 통합 실행
// Agent1 → Agent2 → Agent3 (순차 실행)
// ─────────────────────────────────────────────

export async function generateCarouselContent(
  conceptTitle: string,
  targetGender: string,
  carouselStructure: any[],
  category?: string,
  goal?: string
): Promise<GeneratedContent> {
  console.log('[Pipeline] 3단계 멀티 에이전트 파이프라인 시작...');

  // Step 2: Agent2 - 이미지 프롬프트 생성
  const slides = await generateImagePrompts(conceptTitle, targetGender, carouselStructure);

  // Step 3: Agent3 - 캡션 & 해시태그 생성 (Agent2와 병렬 가능하지만 안정성 위해 순차 실행)
  const { caption, hashtags } = await generateCaptionAndHashtags(
    conceptTitle,
    targetGender,
    category || '결과형',
    goal || '문의'
  );

  console.log('[Pipeline] 3단계 파이프라인 완료!');

  return {
    target_gender: targetGender,
    concept: conceptTitle,
    slides,
    caption,
    hashtags
  };
}

// ─────────────────────────────────────────────
// 📸 Vision 분석 (사진 업로드 시) → Agent1 역할 대행
// 이후 Agent2, Agent3로 자동 연결
// ─────────────────────────────────────────────

export async function analyzeImageAndGenerateContent(
  base64Image: string
): Promise<GeneratedContent> {
  const imageUrl = base64Image.startsWith('data:') 
    ? base64Image 
    : `data:image/jpeg;base64,${base64Image}`;

  console.log('[Vision] 사진 분석 에이전트 호출...');

  // Step 1: Vision Agent → 기획안 생성 (Agent1 역할 대행)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VISION_ANALYSIS_AGENT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '다음 두피/가르마 사진을 면밀히 분석하고 맞춤형 콘텐츠 기획안을 작성해 주세요.' },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' }
  });

  const rawJson = response.choices[0]?.message?.content || '{}';
  const visionPlan = JSON.parse(rawJson);
  const recommended = visionPlan.recommended_concept;
  
  console.log('[Vision] 사진 분석 완료. Agent2 & Agent3 파이프라인으로 전달...');

  // Step 2 & 3: Agent2 + Agent3 파이프라인 실행
  const fullContent = await generateCarouselContent(
    recommended.title,
    recommended.target_gender,
    recommended.carousel_structure,
    recommended.category,
    recommended.goal
  );

  return fullContent;
}
