import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://playbook.app",
    "X-Title": "Playbook",
  },
});

export const AI_MODEL = "anthropic/claude-sonnet-4.5";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrgContext = {
  orgName: string;
  fromName?: string;
  emailProvider?: "resend" | "agillic";
  brandConfig?: {
    primary_color?: string;
    secondary_color?: string;
    header_bg_color?: string;
    text_color?: string;
    logo_url?: string;
    footer_text?: string;
  };
  customFieldNames: string[];
};

export type AiErrorCode =
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "AI_SERVICE_ERROR"
  | "PARSE_ERROR";

export type AgillicVariableSlot = {
  raw: string;
  fieldName: string;
  type: "editable" | "blockparam";
  dataType?: string;
  namespace?: string;
};

export type GenerateRequest = {
  type: "subject" | "body" | "improve" | "improve-block" | "fill-agillic" | "improve-agillic-field";
  prompt: string;
  context?: string;
  currentContent?: string;
  structure?: string[];
  blockType?: string;
  templateName?: string;
  emailPurpose?: string;
  agillicVariables?: AgillicVariableSlot[];
  agillicFieldName?: string;
  agillicFieldDataType?: string;
  agillicFieldType?: "editable" | "blockparam";
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AI_TEMPERATURES: Record<string, number> = {
  subject: 0.7,
  body: 1.0,
  improve: 0.6,
  "improve-block": 0.6,
  "fill-agillic": 1.0,
  "improve-agillic-field": 0.6,
  "alt-text": 0.3,
  brand: 0.8,
};

export const AI_LIMITS = {
  MAX_PROMPT_LENGTH: 2000,
  MAX_CONTEXT_LENGTH: 4000,
  MAX_CURRENT_CONTENT_LENGTH: 10000,
  MAX_STRUCTURE_LENGTH: 30,
  MAX_BRAND_FIELD_LENGTH: 200,
} as const;

const VALID_BLOCK_TYPES = new Set([
  "heading", "text", "button", "image", "divider",
  "spacer", "social", "columns", "quote", "video", "html",
]);

const STANDARD_LIQUID_VARS = [
  "first_name", "last_name", "email", "company",
  "phone", "job_title", "city", "country",
];

// ---------------------------------------------------------------------------
// Dynamic system prompt
// ---------------------------------------------------------------------------

const BASE_PROMPT = `You are an expert email copywriter. You write clear, friendly, professional marketing emails.`;

export function buildSystemPrompt(orgContext?: OrgContext): string {
  const sections: string[] = [BASE_PROMPT];

  if (orgContext?.orgName) {
    sections.push(`You are writing emails on behalf of "${orgContext.orgName}".`);
  }
  if (orgContext?.fromName && orgContext.fromName !== orgContext.orgName) {
    sections.push(`The sender name is "${orgContext.fromName}".`);
  }
  if (orgContext?.brandConfig) {
    const bc = orgContext.brandConfig;
    const parts: string[] = [];
    if (bc.primary_color) parts.push(`brand color ${bc.primary_color}`);
    if (bc.footer_text) parts.push(`tagline: "${bc.footer_text}"`);
    if (parts.length > 0) {
      sections.push(`Brand identity: ${parts.join(", ")}.`);
    }
  }

  const isAgillic = orgContext?.emailProvider === "agillic";

  if (isAgillic) {
    // Agillic uses <persondata>FIELDNAME</persondata> syntax
    const agillicVars = [
      "<persondata>FIRSTNAME</persondata>",
      "<persondata>LASTNAME</persondata>",
      "<persondata>EMAIL</persondata>",
    ].join(", ");

    sections.push(`
Rules:
- Use Agillic personalization tags for recipient data: ${agillicVars}
- The format is <persondata>FIELDNAME</persondata> where FIELDNAME is uppercase
- Agillic templates have pre-styled blocks. You fill content into variable slots:
  - "Rich text (editable)" fields: use HTML (<p>, <strong>, <em>, <a>, <ul>, <li>) for formatting. No <html>/<head>/<body>.
  - "Text" fields (blockparam STRING): write PLAIN TEXT only — no HTML tags, no <p>, no <br>. Just the raw text content.
  - "URL" fields: return a valid URL only.
- Keep emails concise — aim for 100-200 words for the body
- Use a warm, conversational tone unless told otherwise
- Include a clear call-to-action where appropriate
- Do NOT include subject lines in the body — those are separate
- Do NOT use markdown`);
  } else {
    const allVars = STANDARD_LIQUID_VARS.map((v) => `{{ ${v} }}`).join(", ");
    const customVars = (orgContext?.customFieldNames ?? [])
      .map((f) => `{{ data.${f} }}`)
      .join(", ");

    sections.push(`
Rules:
- Use Liquid template variables for personalization: ${allVars}${customVars ? `\n- Custom contact fields also available: ${customVars}` : ""}
- Write in HTML format suitable for email (use <h1>, <h2>, <p>, <ul>, <li>, <a>, <strong>, <em>)
- Keep emails concise — aim for 100-200 words for the body
- Use a warm, conversational tone unless told otherwise
- Include a clear call-to-action where appropriate
- Do NOT include <html>, <head>, <body> tags — only the inner content
- Do NOT include subject lines in the body — those are separate
- Do NOT use markdown — use HTML tags only`);
  }

  return sections.join("\n");
}

/** Backward-compatible default prompt (no org context). */
export const SYSTEM_PROMPT = buildSystemPrompt();

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export function validateGenerateRequest(
  body: GenerateRequest
): { valid: true } | { valid: false; error: string } {
  if (!body.prompt || typeof body.prompt !== "string") {
    return { valid: false, error: "prompt is required" };
  }
  if (body.prompt.length > AI_LIMITS.MAX_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt must be under ${AI_LIMITS.MAX_PROMPT_LENGTH} characters` };
  }
  if (body.context && body.context.length > AI_LIMITS.MAX_CONTEXT_LENGTH) {
    return { valid: false, error: `Context must be under ${AI_LIMITS.MAX_CONTEXT_LENGTH} characters` };
  }
  if (body.currentContent && body.currentContent.length > AI_LIMITS.MAX_CURRENT_CONTENT_LENGTH) {
    return { valid: false, error: `Content must be under ${AI_LIMITS.MAX_CURRENT_CONTENT_LENGTH} characters` };
  }
  if (body.blockType && !VALID_BLOCK_TYPES.has(body.blockType)) {
    return { valid: false, error: `Invalid block type: ${body.blockType}` };
  }
  if (body.structure) {
    if (!Array.isArray(body.structure)) {
      return { valid: false, error: "structure must be an array" };
    }
    if (body.structure.length > AI_LIMITS.MAX_STRUCTURE_LENGTH) {
      return { valid: false, error: `Structure must have at most ${AI_LIMITS.MAX_STRUCTURE_LENGTH} blocks` };
    }
    for (const item of body.structure) {
      if (!VALID_BLOCK_TYPES.has(item)) {
        return { valid: false, error: `Invalid block type in structure: ${item}` };
      }
    }
  }
  if (body.type === "fill-agillic") {
    if (!body.agillicVariables || !Array.isArray(body.agillicVariables) || body.agillicVariables.length === 0) {
      return { valid: false, error: "agillicVariables is required for fill-agillic" };
    }
    if (body.agillicVariables.length > AI_LIMITS.MAX_STRUCTURE_LENGTH) {
      return { valid: false, error: `agillicVariables must have at most ${AI_LIMITS.MAX_STRUCTURE_LENGTH} items` };
    }
  }
  if (body.type === "improve-agillic-field") {
    if (!body.currentContent && body.currentContent !== "") {
      return { valid: false, error: "currentContent is required for improve-agillic-field" };
    }
    if (!body.agillicFieldName) {
      return { valid: false, error: "agillicFieldName is required for improve-agillic-field" };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Output parsing helpers
// ---------------------------------------------------------------------------

/** Parse Claude's subject-line response into a clean array. */
export function parseSubjectLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => line.replace(/^(\d+[\.\)]\s*|[-*]\s*|•\s*)/, "").trim())
    .filter((l) => l.length > 0);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Validate a brand config object has required keys and valid hex colors. */
export function validateBrandConfig(
  config: Record<string, unknown>
): { valid: true; config: Record<string, string> } | { valid: false; error: string } {
  const colorKeys = ["primary_color", "secondary_color", "header_bg_color", "text_color"];
  for (const key of [...colorKeys, "footer_text"]) {
    if (!(key in config)) {
      return { valid: false, error: `Missing required key: ${key}` };
    }
  }
  for (const key of colorKeys) {
    const val = config[key];
    if (typeof val !== "string" || !HEX_RE.test(val)) {
      return { valid: false, error: `Invalid hex color for ${key}: ${val}` };
    }
  }
  if (typeof config.footer_text !== "string" || config.footer_text.length > 100) {
    return { valid: false, error: "footer_text must be a string under 100 characters" };
  }
  return { valid: true, config: config as Record<string, string> };
}
