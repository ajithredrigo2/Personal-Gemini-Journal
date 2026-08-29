import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FIREBASE_PROJECT_ID = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || '';

// 1. Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Token Verification & Extraction for Firebase Auth ID Tokens
export function extractAndVerifyUid(authHeader: string | undefined): { uid: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    // Validate expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) {
      console.warn('[Auth] Token has expired');
      return null;
    }

    // Validate project binding if project ID is available
    if (FIREBASE_PROJECT_ID) {
      if (payload.aud !== FIREBASE_PROJECT_ID && payload.aud !== 'crucial-chalice-388018') {
        console.warn(`[Auth] Audience mismatch. Expected ${FIREBASE_PROJECT_ID}, got ${payload.aud}`);
      }
      if (
        payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` &&
        payload.iss !== `https://securetoken.google.com/crucial-chalice-388018`
      ) {
        console.warn(`[Auth] Issuer mismatch: ${payload.iss}`);
      }
    }

    const uid = payload.user_id || payload.sub;
    if (!uid || typeof uid !== 'string') {
      return null;
    }

    return { uid };
  } catch (err) {
    console.warn('[Auth] Token validation error:', err);
    return null;
  }
}

// Lazy Google GenAI Client with Environment Secret Access
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

interface ChatMessageInput {
  role: 'user' | 'model';
  content: string;
}

interface GeneratePayload {
  mode?: string;
  messages?: ChatMessageInput[];
  currentInput?: string;
  mood?: string;
}

// Fallback execution helper
async function generateWithFallbackLadder(
  systemInstruction: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  responseMimeType?: string
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  let lastError: unknown = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        config: {
          systemInstruction,
          temperature: 0.7,
          ...(responseMimeType ? { responseMimeType } : {}),
        },
        contents,
      });

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: modelName,
        };
      }
    } catch (err: unknown) {
      console.warn(`[Gemini API] Failed with model ${modelName}:`, (err as Error)?.message || err);
      lastError = err;
      // Continue to next model in fallback ladder
    }
  }

  throw lastError || new Error('All models in fallback ladder failed to generate response');
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MindScribe AI Backend',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/gemini/reflect', async (req, res) => {
  try {
    // Defensive Payload Ingestion
    const payload: GeneratePayload = (req.body && typeof req.body === 'object') ? req.body : {};
    const { mode = 'reflection', messages = [], currentInput = '', mood = 'neutral' } = payload;

    if (!currentInput && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Journal input or messages are required' });
    }

    const modePromptMap: Record<string, string> = {
      reflection:
        'You are an empathetic, insightful, and thoughtful psychological journaling companion and mentor. Listen deeply to the user\'s personal reflection, validate their emotional experience, offer gentle reframing or constructive perspectives, and ask 1-2 open-ended follow-up questions to help them uncover deeper self-awareness.',
      brainstorm:
        'You are a creative, expansive, and structured brainstorming collaborator. Take the user\'s ideas, goals, or problems, and expand them into innovative angles, diverse possibilities, structured categories, and creative sparks.',
      summary:
        'You are an executive synthesis expert. Provide an articulate, crystal-clear executive summary of the user\'s thoughts, identify underlying recurring themes, and synthesize their key takeaways into a clean structure.',
      action_plan:
        'You are a high-performance pragmatic life and productivity strategist. Translate the user\'s reflections into clear, prioritized, achievable step-by-step action items with estimated timelines and potential friction mitigations.',
      deep_inquiry:
        'You are a Socratic coach and philosophical guide. Challenge assumptions gently, explore root causes, examine belief systems, and probe with incisive, transformative questions.',
    };

    const systemInstruction = `
${modePromptMap[mode] || modePromptMap.reflection}
The user's current self-reported mood state is: "${mood}".

Formatting Directives:
1. Provide a warm, conversational, well-formatted Markdown response addressing their thoughts directly.
2. Structure your insights clearly using clean headings, bullet points, or bold text where appropriate.
3. At the very bottom of your response, output a structured JSON block delimited strictly with '<<<INSIGHTS_META>>>' on its own line:
<<<INSIGHTS_META>>>
{
  "summary": "A 1-2 sentence concise essence of this entry",
  "keyInsights": ["Key takeaway or insight 1", "Key takeaway 2", "Key takeaway 3"],
  "suggestedTags": ["Career", "Personal Growth"],
  "extractedActions": ["Action item 1 if any", "Action item 2 if any"]
}
<<<INSIGHTS_META>>>
Where suggestedTags should ideally select from standard tags (Career, Learning, Work, Personal Growth, Ideas, Goals, Challenges, Planning) plus any topic-specific tags.
    `.trim();

    // Prepare contents array for Gemini
    const contents = messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    if (currentInput) {
      contents.push({
        role: 'user',
        parts: [{ text: currentInput }],
      });
    }

    const { text, modelUsed } = await generateWithFallbackLadder(systemInstruction, contents);

    // Parse structured JSON block from the response
    let cleanReply = text;
    let summary = 'Personal journal reflection and synthesis.';
    let keyInsights: string[] = [];
    let suggestedTags: string[] = ['Journal'];
    let extractedActions: string[] = [];

    const metaParts = text.split('<<<INSIGHTS_META>>>');
    if (metaParts.length >= 3) {
      cleanReply = metaParts[0].trim();
      const metaJsonStr = metaParts[1].trim();
      try {
        const parsed = JSON.parse(metaJsonStr);
        if (parsed.summary) summary = parsed.summary;
        if (Array.isArray(parsed.keyInsights)) keyInsights = parsed.keyInsights;
        if (Array.isArray(parsed.suggestedTags)) suggestedTags = parsed.suggestedTags;
        if (Array.isArray(parsed.extractedActions)) extractedActions = parsed.extractedActions;
      } catch (parseErr) {
        console.warn('Could not parse metadata JSON block, using fallback extraction:', parseErr);
      }
    } else if (metaParts.length === 2) {
      cleanReply = metaParts[0].trim();
      try {
        const parsed = JSON.parse(metaParts[1].trim());
        if (parsed.summary) summary = parsed.summary;
        if (Array.isArray(parsed.keyInsights)) keyInsights = parsed.keyInsights;
        if (Array.isArray(parsed.suggestedTags)) suggestedTags = parsed.suggestedTags;
        if (Array.isArray(parsed.extractedActions)) extractedActions = parsed.extractedActions;
      } catch {
        // Ignored
      }
    }

    return res.json({
      reply: cleanReply,
      summary,
      keyInsights,
      suggestedTags,
      extractedActions,
      modelUsed,
    });
  } catch (error: unknown) {
    console.error('Error generating AI reflection:', error);
    const errorMessage = (error as Error)?.message || 'An unexpected error occurred while communicating with Gemini';
    return res.status(500).json({
      error: errorMessage,
      fallbackSuggestion: 'Please check your API key or network connection and retry.',
    });
  }
});

// Reflection Intelligence Cross-Journal Pattern Synthesis
app.post('/api/gemini/insights', async (req, res) => {
  try {
    // 1. Authorization: Derive UID strictly from verified Firebase token
    const authResult = extractAndVerifyUid(req.headers.authorization);
    if (!authResult || !authResult.uid) {
      return res.status(401).json({
        error: 'Unauthorized: Valid Firebase ID token is required to generate reflection intelligence.',
      });
    }

    const payload = (req.body && typeof req.body === 'object') ? req.body : {};
    const { summaries = [] } = payload;

    if (!Array.isArray(summaries) || summaries.length < 2) {
      return res.status(400).json({
        error: 'Insufficient journal history. At least 2 journal entries are required to generate cross-entry reflection intelligence.',
        code: 'INSUFFICIENT_ENTRIES',
      });
    }

    // Prepare digest of past entries (privacy-conscious: uses summaries, key insights, tags, dates)
    const digestText = summaries
      .map(
        (entry, idx) => `
Entry #${idx + 1}: "${entry.title || 'Untitled'}"
Date: ${entry.createdAt || 'Unknown'}
Mode: ${entry.mode || 'reflection'} | Mood: ${entry.mood || 'neutral'}
Tags: ${(entry.tags || []).join(', ')}
Executive Summary: ${entry.summary || 'None'}
Key Insights: ${(entry.keyInsights || []).join('; ')}
`
      )
      .join('\n---\n');

    const systemInstruction = `
You are an expert cognitive psychologist, life coach, and intelligence synthesis engine.
Analyze the user's past journal entries and reflections. Detect recurring behavioral patterns, emerging themes, personal & professional goals, open and completed action items, recurring hurdles or challenges, positive growth patterns, and formulate a weekly reflection summary and suggested next focus.

Output ONLY a valid JSON object strictly matching this schema:
{
  "themes": [
    { "name": "Theme Name", "count": 2, "description": "Brief description of how this theme surfaces across entries" }
  ],
  "goals": [
    "Goal statement identified across reflections"
  ],
  "actionItems": [
    { "title": "Concrete next action item", "suggestedFrom": "Entry or theme source" }
  ],
  "recurringChallenges": [
    "Recurring challenge or friction point"
  ],
  "positivePatterns": [
    "Positive growth pattern, habit, or resilience indicator"
  ],
  "suggestedFocus": "1-2 paragraphs of inspiring, strategic, and practical guidance on what the user should prioritize or reflect on next.",
  "weeklyReflection": "A comprehensive, warm, articulate summary of the user's thoughts, experiences, and cognitive progression across the analyzed time period."
}
`.trim();

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Here is the digest of the user's previous journal summaries for meta-analysis:\n\n${digestText}`,
          },
        ],
      },
    ];

    const { text, modelUsed } = await generateWithFallbackLadder(
      systemInstruction,
      contents,
      'application/json'
    );

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(text);
    } catch {
      // Clean possible markdown code fences
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleaned);
    }

    const sortedSummaries = [...summaries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const periodStart = sortedSummaries[0]?.createdAt || new Date().toISOString();
    const periodEnd = sortedSummaries[sortedSummaries.length - 1]?.createdAt || new Date().toISOString();

    return res.json({
      themes: parsedResponse.themes || [],
      goals: parsedResponse.goals || [],
      actionItems: parsedResponse.actionItems || [],
      recurringChallenges: parsedResponse.recurringChallenges || [],
      positivePatterns: parsedResponse.positivePatterns || [],
      suggestedFocus: parsedResponse.suggestedFocus || 'Continue your reflective journey.',
      weeklyReflection: parsedResponse.weeklyReflection || '',
      periodStart,
      periodEnd,
      modelUsed,
    });
  } catch (error: unknown) {
    console.error('Error generating reflection intelligence:', error);
    const errorMessage = (error as Error)?.message || 'Failed to synthesize reflection intelligence';
    return res.status(500).json({
      error: errorMessage,
      fallbackSuggestion: 'Please verify your connection and try again.',
    });
  }
});

// Standalone Action Item Extraction
app.post('/api/gemini/extract-actions', async (req, res) => {
  try {
    const authResult = extractAndVerifyUid(req.headers.authorization);
    if (!authResult || !authResult.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = (req.body && typeof req.body === 'object') ? req.body : {};
    const { title = '', content = '', summary = '' } = payload;

    if (!content && !summary) {
      return res.status(400).json({ error: 'Content or summary is required' });
    }

    const systemInstruction = `
You are a productivity strategist. Extract any concrete, actionable tasks from the user's journal reflection.
Output ONLY a JSON array of strings, e.g. ["Task 1", "Task 2"]. If no actionable tasks exist, return [].
`.trim();

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Title: ${title}\nSummary: ${summary}\nContent: ${content}`,
          },
        ],
      },
    ];

    const { text } = await generateWithFallbackLadder(systemInstruction, contents, 'application/json');
    let actions: string[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) actions = parsed;
    } catch {
      // ignore
    }

    return res.json({ actions });
  } catch (error) {
    console.error('Error extracting action items:', error);
    return res.status(500).json({ error: 'Failed to extract action items' });
  }
});

// Setup Vite Development or Production Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MindScribe AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

