import OpenAI from 'openai';

// Define the available providers
export type ImageGenProvider = 'mock' | 'dalle3' | 'flux' | 'sdxl';

const CURRENT_PROVIDER: ImageGenProvider = (process.env.IMAGE_GEN_PROVIDER as ImageGenProvider) || 'mock';
const ENABLE_LIVE_IMAGE_GEN = process.env.ENABLE_LIVE_IMAGE_GEN === 'true';

// Curated beautiful premium imagery from Unsplash for realistic placeholder previews
const MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=600&auto=format&fit=crop', // Elegant luxury salon interior
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600&auto=format&fit=crop', // Close up hair care details
  'https://images.unsplash.com/photo-1620331311520-246422fd82f9?q=80&w=600&auto=format&fit=crop', // Premium aesthetic natural skin & hair
  'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?q=80&w=600&auto=format&fit=crop', // Micro scalp/treatment details
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop'  // Confident portrait professional look
];

/**
 * Main adapter function to generate or simulate an image from a detailed prompt.
 */
export async function generateImage(prompt: string, slideIndex: number = 0): Promise<string> {
  console.log(`[ImageGenerator] Requesting image generation for slide ${slideIndex} using provider: ${CURRENT_PROVIDER}`);

  if (!ENABLE_LIVE_IMAGE_GEN || CURRENT_PROVIDER === 'mock') {
    // Return a curated luxury aesthetic photo based on the slide index
    const placeholderUrl = MOCK_IMAGES[slideIndex % MOCK_IMAGES.length];
    return placeholderUrl;
  }

  try {
    switch (CURRENT_PROVIDER) {
      case 'dalle3':
        return await generateDalle3(prompt);
      case 'flux':
        return await generateFlux(prompt);
      case 'sdxl':
        return await generateSdxl(prompt);
      default:
        return MOCK_IMAGES[slideIndex % MOCK_IMAGES.length];
    }
  } catch (error) {
    console.error(`[ImageGenerator] Live generation failed. Falling back to mockup:`, error);
    return MOCK_IMAGES[slideIndex % MOCK_IMAGES.length];
  }
}

/**
 * 1. OpenAI DALL-E 3 Implementation
 */
async function generateDalle3(prompt: string): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'hd',
    style: 'natural' // 'natural' is key for realistic SMP, avoids 'vivid' cartoonish renders
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error('DALL-E 3 did not return any image URL.');
  
  return imageUrl;
}

/**
 * 2. Flux API (via fal.ai / replicate) Placeholder
 * Easy to fill in with Fal.ai or Replicate SDK.
 */
async function generateFlux(prompt: string): Promise<string> {
  console.log(`[ImageGenerator] Flux connection is configured. Prompt: ${prompt.substring(0, 40)}...`);
  
  /*
  // Example Fal AI integration:
  const response = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Authorization": `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt,
      image_size: "square",
      num_inference_steps: 4,
      sync_mode: true
    })
  });
  const data = await response.json();
  return data.images[0].url;
  */
  
  throw new Error('Flux API is not fully configured yet. Uncomment flux adapter.');
}

/**
 * 3. SDXL API Placeholder
 */
async function generateSdxl(prompt: string): Promise<string> {
  console.log(`[ImageGenerator] SDXL connection is configured. Prompt: ${prompt.substring(0, 40)}...`);
  
  /*
  // Example Replicate Integration:
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "stable-diffusion-xl-model-version-id",
      input: { prompt: prompt }
    })
  });
  const prediction = await response.json();
  // Poll prediction...
  */

  throw new Error('SDXL API is not fully configured yet. Uncomment sdxl adapter.');
}
