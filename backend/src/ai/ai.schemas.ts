/**
 * Claude javobi shu JSON sxemalarga mos bo'lishi shart (CLI --json-schema
 * tekshiradi). Panel hisobotni shu maydonlar bo'yicha chizadi.
 */
const str = { type: 'string' };
const strArr = { type: 'array', items: str };
const priority = { type: 'string', enum: ['high', 'medium', 'low'] };
const recommendations = {
  type: 'array',
  items: {
    type: 'object',
    properties: { title: str, detail: str, priority },
    required: ['title', 'detail', 'priority'],
    additionalProperties: false,
  },
};

export const MEDIA_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '3-5 jumla: asosiy xulosa raqamlar bilan' },
    score: { type: 'integer', minimum: 1, maximum: 10 },
    verdict: { type: 'string', description: "2-4 so'zli qisqa baho, masalan: 'Kuchli reels', 'Foydali, lekin sekin boshlanadi'" },
    performance: {
      type: 'object',
      properties: { vs_account: str, highlights: strArr },
      required: ['vs_account', 'highlights'],
      additionalProperties: false,
    },
    hook: {
      type: 'object',
      properties: { score: { type: 'integer', minimum: 1, maximum: 10 }, analysis: str, suggestion: str },
      required: ['score', 'analysis', 'suggestion'],
      additionalProperties: false,
    },
    content: {
      type: 'object',
      properties: { topic: str, structure: str, visuals: str, speech: str },
      required: ['topic', 'structure', 'visuals', 'speech'],
      additionalProperties: false,
    },
    audience: {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'mixed', 'negative', 'none'] },
        themes: strArr,
        questions: strArr,
      },
      required: ['sentiment', 'themes', 'questions'],
      additionalProperties: false,
    },
    strengths: strArr,
    weaknesses: strArr,
    recommendations,
    caption_suggestion: str,
  },
  required: ['summary', 'score', 'verdict', 'performance', 'hook', 'content', 'audience', 'strengths', 'weaknesses', 'recommendations', 'caption_suggestion'],
  additionalProperties: false,
};

const postRef = {
  type: 'array',
  items: {
    type: 'object',
    properties: { media_id: str, why: str },
    required: ['media_id', 'why'],
    additionalProperties: false,
  },
};

export const PROFILE_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: str,
    score: { type: 'integer', minimum: 1, maximum: 10 },
    positioning: str, // profil kim uchun, nima haqida, qanday qabul qilinadi
    what_works: strArr,
    what_doesnt: strArr,
    content_pillars: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: str, performance: str },
        required: ['name', 'performance'],
        additionalProperties: false,
      },
    },
    formats: str, // format, uzunlik, montaj bo'yicha xulosa
    hooks: str,
    posting: {
      type: 'object',
      properties: { timing: str, frequency: str },
      required: ['timing', 'frequency'],
      additionalProperties: false,
    },
    captions: str,
    audience: str,
    top_posts: postRef,
    weak_posts: postRef,
    recommendations,
    plan_30_days: {
      type: 'array',
      items: {
        type: 'object',
        properties: { week: { type: 'integer', minimum: 1, maximum: 5 }, focus: str, actions: strArr },
        required: ['week', 'focus', 'actions'],
        additionalProperties: false,
      },
    },
    kpi_targets: {
      type: 'array',
      items: {
        type: 'object',
        properties: { metric: str, current: str, target: str },
        required: ['metric', 'current', 'target'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'score', 'positioning', 'what_works', 'what_doesnt', 'content_pillars', 'formats', 'hooks', 'posting', 'captions', 'audience', 'top_posts', 'weak_posts', 'recommendations', 'plan_30_days', 'kpi_targets'],
  additionalProperties: false,
};
