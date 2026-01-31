
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
    private model: string = "tngtech/deepseek-r1t2-chimera:free";

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        if (!this.apiKey || this.apiKey.trim() === '') {
            // Silent mode - no API key configured, will use baseline policies
            this.apiKey = undefined;
        }
    }

    public async getRecommendation(context: SystemContext): Promise<PolicyRecommendation> {
        if (!this.apiKey) {
            return DEFAULT_POLICY;
        }

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
                            role: "system",
                            content: "You are a security policy advisor. Always respond with valid JSON only. Never include explanations or markdown."
                        },
                        {
                            role: "user",
                            content: `Analyze this session and recommend security settings. Return ONLY valid JSON.

Session Context:
- Age: ${context.session_age_minutes} minutes
- Idle: ${context.user_idle_minutes} minutes  
- Files: ${context.files_uploaded}
- Time: ${context.time_of_day}
- Environment: ${context.environment_type}

Required JSON format:
{
  "recommended_timeout_minutes": <number 1-15>,
  "auto_end_if_idle_minutes": <number 1-10>,
  "require_user_confirmation": <boolean>,
  "allow_multiple_uploads": <boolean>,
  "risk_level": "low" | "medium" | "high",
  "reason": "<brief explanation>"
}

Return ONLY the JSON object, nothing else.`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[GeminiPolicyService] API Error Details:`, {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorBody
                });
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.choices[0]?.message?.content || "";
            
            console.log('[GeminiPolicyService] Raw AI response:', text.substring(0, 200));
            
            // Clean markdown code blocks if present
            let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Try to extract JSON if it's embedded in text
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            if (!jsonStr || jsonStr.length < 10) {
                console.warn('[GeminiPolicyService] AI returned empty or invalid response');
                return DEFAULT_POLICY;
            }
            
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
            // Only log errors if we actually have an API key configured
            if (this.apiKey) {
                console.error("[GeminiPolicyService] Error generating policy:", error);
            }
            const errorMessage = (error as any).message || "Unknown error";
            return {
                ...DEFAULT_POLICY,
                reason: this.apiKey ? `AI Unavailable: ${errorMessage}` : "Baseline Protection"
            };
        }
    }
}
