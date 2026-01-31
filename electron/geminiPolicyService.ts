
import * as dotenv from 'dotenv';

dotenv.config();

export interface SystemContext {
    environment_type: string;
    mode: string;
    session_age_minutes: number;
    user_idle_minutes: number;
    files_uploaded: number;
    print_operations: number;
    time_of_day: string; // e.g., "morning", "late_night"
    previous_sessions_today: number;
}

export interface PolicyRecommendation {
    recommended_timeout_minutes: number;
    auto_end_if_idle_minutes: number;
    require_user_confirmation: boolean;
    allow_multiple_uploads: boolean;
    risk_level: "low" | "medium" | "high";
    reason: string;
}

const DEFAULT_POLICY: PolicyRecommendation = {
    recommended_timeout_minutes: 15,
    auto_end_if_idle_minutes: 5,
    require_user_confirmation: true,
    allow_multiple_uploads: true,
    risk_level: "low",
    reason: "Default baseline safety policy (AI Offline/Fallback)."
};

export class GeminiPolicyService {
    private apiKey: string | undefined;
    private apiUrl: string = "https://openrouter.ai/api/v1/chat/completions";
    private model: string = "upstage/solar-pro-3:free";

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        if (!this.apiKey) {
            console.warn("[GeminiPolicyService] No OpenRouter API Key found. Running in passthrough mode.");
        }
    }

    public async getRecommendation(context: SystemContext): Promise<PolicyRecommendation> {
        if (!this.apiKey) {
            return DEFAULT_POLICY;
        }

        const prompt = `You are a safety policy advisor for a privacy-first public computer system.

Rules:
- You do NOT make decisions.
- You do NOT access files or users.
- You ONLY recommend safety-related policy adjustments.
- Do NOT repeat input data.
- Do NOT add assumptions.
- Output MUST be valid JSON only.

Given the following system context, suggest reasonable safety policies.

Context:
${JSON.stringify(context, null, 2)}

Output format (JSON only, no markdown):
{
  "recommended_timeout_minutes": number,
  "auto_end_if_idle_minutes": number,
  "require_user_confirmation": boolean,
  "allow_multiple_uploads": boolean,
  "risk_level": "low" | "medium" | "high",
  "reason": "short explanation in plain English"
}`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://secureengine.local',
                    'X-Title': 'SecureEngine Safety Advisor'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.choices[0]?.message?.content || "";
            
            // Clean markdown code blocks if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const recommendation = JSON.parse(jsonStr) as PolicyRecommendation;
            
            // Basic Schema Validation / Clamping logic could go here, 
            // but we trust the Enforcer (SessionManager) to do the hard clamping.
            // We just ensure types are correct-ish.
            return {
                recommended_timeout_minutes: Number(recommendation.recommended_timeout_minutes) || 15,
                auto_end_if_idle_minutes: Number(recommendation.auto_end_if_idle_minutes) || 5,
                require_user_confirmation: Boolean(recommendation.require_user_confirmation),
                allow_multiple_uploads: Boolean(recommendation.allow_multiple_uploads),
                risk_level: (['low', 'medium', 'high'].includes(recommendation.risk_level) ? recommendation.risk_level : 'low') as any,
                reason: recommendation.reason || "AI provided policy."
            };

        } catch (error) {
            console.error("[GeminiPolicyService] Error generating policy:", error);
            const errorMessage = (error as any).message || "Unknown error";
            return {
                ...DEFAULT_POLICY,
                reason: `AI Unavailable: ${errorMessage}`
            };
        }
    }
}
