const RISK_KEYWORDS = ['blocked', 'blocker', 'stuck', 'delay', 'issue', 'bug', 'error', 'waiting', 'confused', 'failed', 'not working', 'problem', 'struggling', 'behind', 'broken', 'unclear', 'missing', 'dependency'];
const PROGRESS_KEYWORDS = ['completed', 'done', 'finished', 'built', 'fixed', 'created', 'added', 'deployed', 'tested', 'connected', 'shipped', 'delivered', 'merged', 'launched', 'reviewed', 'approved'];

function cleanText(value, limit = 650) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function sentenceCase(text, fallback) {
  const clean = cleanText(text, 240);
  if (!clean) return fallback;
  return clean.endsWith('.') || clean.endsWith('!') || clean.endsWith('?') ? clean : `${clean}.`;
}

function hasAny(source, words) {
  const lower = source.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function normalizeRisk(value, fallback = 'Low') {
  const risk = cleanText(value, 20).toLowerCase();
  if (risk.includes('high')) return 'High';
  if (risk.includes('medium')) return 'Medium';
  if (risk.includes('low')) return 'Low';
  return fallback;
}

function normalizeBlockers(value, originalBlockers) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\n,;]/);
  const blockers = source.map((item) => cleanText(item, 90)).filter(Boolean).slice(0, 4);
  if (blockers.length) return blockers;
  const cleanOriginal = cleanText(originalBlockers, 120);
  if (cleanOriginal && !/^none|no blocker|nil$/i.test(cleanOriginal)) return [cleanOriginal];
  return [];
}

function localAnalyzeStandup(input) {
  const yesterday = cleanText(input.yesterday);
  const today = cleanText(input.today);
  const blockersText = cleanText(input.blockers);
  const confidence = cleanText(input.confidence, 20) || 'Medium';
  const combined = `${yesterday} ${today} ${blockersText}`;
  const wordCount = (combined.match(/[a-z0-9']+/gi) || []).length;
  const hasProgress = hasAny(combined, PROGRESS_KEYWORDS);
  const hasRisk = hasAny(combined, RISK_KEYWORDS) || (blockersText && !/^none|no blocker|nil$/i.test(blockersText));
  const hasPlan = today.length > 15;
  const hasHistory = yesterday.length > 15;
  const confidenceBoost = confidence === 'High' ? 1 : confidence === 'Low' ? -1 : 0;
  const clarityScore = Math.max(1, Math.min(10, 4 + (hasPlan ? 2 : 0) + (hasHistory ? 1 : 0) + (wordCount > 35 ? 1 : 0) + (hasProgress ? 1 : 0) + confidenceBoost - (hasRisk ? 1 : 0)));
  const riskLevel = hasRisk ? (confidence === 'Low' ? 'High' : 'Medium') : 'Low';
  const blockers = normalizeBlockers([], blockersText);
  return {
    clarityScore,
    summary: sentenceCase(
      today
        ? `Yesterday: ${yesterday || 'No previous progress shared'} Today: ${today}`
        : 'The update needs a clearer plan for today',
      'The update needs a clearer plan for today.'
    ),
    blockers,
    nextAction: hasRisk
      ? 'Name the owner of the blocker, confirm the missing input, and unblock it before starting extra work.'
      : 'Continue today\'s plan and post a short result update before the next standup.',
    riskLevel,
    followUpQuestion: hasRisk
      ? 'Who can remove the blocker fastest, and what exact help is needed?'
      : 'What measurable output will prove today\'s work is complete?',
    aiMode: 'Local fallback'
  };
}

function normalizeAiResult(data, input, aiMode = 'Groq active') {
  const fallback = localAnalyzeStandup(input);
  const clarityScore = Math.max(1, Math.min(10, Number(data?.clarityScore || data?.clarity_score || fallback.clarityScore) || fallback.clarityScore));
  const blockers = normalizeBlockers(data?.blockers, input.blockers);
  const riskFallback = blockers.length ? 'Medium' : fallback.riskLevel;
  return {
    clarityScore,
    summary: sentenceCase(data?.summary, fallback.summary),
    blockers,
    nextAction: sentenceCase(data?.nextAction || data?.next_action, fallback.nextAction),
    riskLevel: normalizeRisk(data?.riskLevel || data?.risk_level, riskFallback),
    followUpQuestion: sentenceCase(data?.followUpQuestion || data?.follow_up_question, fallback.followUpQuestion),
    aiMode
  };
}

export async function analyzeStandup(input) {
  const standup = {
    yesterday: cleanText(input?.yesterday),
    today: cleanText(input?.today),
    blockers: cleanText(input?.blockers),
    confidence: cleanText(input?.confidence, 20) || 'Medium'
  };

  if (!process.env.GROQ_API_KEY) return localAnalyzeStandup(standup);

  try {
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const systemPrompt = `You are an expert agile coach and engineering manager with 15+ years of experience running high-performance teams. Your role is to analyze daily standup updates and provide actionable, specific, and insightful feedback.

Analyze the standup update with these criteria:
- Clarity score (1-10): How clear and specific is the communication? 10 = crystal clear with measurable outcomes, 1 = vague with no actionable info
- Summary: A crisp, insightful one-sentence summary that captures the essence and momentum of the update
- Blockers: Specific extracted blockers as an array (empty array if none)  
- Next action: The single most important, specific action the person should take next (be concrete and actionable)
- Risk level: Low/Medium/High based on blockers, confidence, and delivery risk
- Follow-up question: One sharp, thought-provoking question that will help the person or team make progress

Return only valid JSON. No markdown, no extra text.`;

    const userPrompt = `Analyze this daily standup update and return JSON with these exact keys:
- clarityScore: number 1-10 (be precise and critical - most updates are 5-7)  
- summary: one insightful sentence capturing the update's essence and delivery momentum
- blockers: array of specific blocker strings (empty [] if none, max 4 items)
- nextAction: one concrete, specific action sentence (name names, mention specifics)
- riskLevel: "Low", "Medium", or "High" 
- followUpQuestion: one sharp question that drives progress

Standup input:
Yesterday completed: ${standup.yesterday}
Today's plan: ${standup.today}  
Blockers: ${standup.blockers || 'None reported'}
Self-confidence level: ${standup.confidence}`;

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    const modelUsed = model.includes('70b') ? 'Groq Llama 70B' : model.includes('8b') ? 'Groq Llama 8B' : `Groq ${model}`;
    return normalizeAiResult(JSON.parse(text), standup, modelUsed);
  } catch (error) {
    console.warn(`Groq analysis failed; using fallback. ${error.message}`);
    return localAnalyzeStandup(standup);
  }
}

export async function generateTeamDigest(posts) {
  if (!process.env.GROQ_API_KEY || !posts || posts.length === 0) {
    return null;
  }

  try {
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const recentPosts = posts.slice(0, 8).map(p => ({
      user: p.username,
      yesterday: p.yesterday,
      today: p.today,
      blockers: p.blockersText || 'None',
      risk: p.riskLevel,
      clarity: p.clarityScore
    }));

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert engineering manager. Analyze team standup data and provide a concise team health digest. Return only valid JSON.'
        },
        {
          role: 'user',
          content: `Analyze these ${recentPosts.length} team standup updates and return JSON with:
- headline: one punchy sentence about team momentum (max 80 chars)
- teamHealth: "Healthy" | "Needs Attention" | "At Risk"
- topWin: the biggest team win mentioned
- topRisk: the most critical risk or blocker to address
- suggestion: one specific suggestion to improve team velocity

Team data: ${JSON.stringify(recentPosts)}`
        }
      ],
      temperature: 0.4,
      max_tokens: 256,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.warn(`Team digest generation failed. ${error.message}`);
    return null;
  }
}
