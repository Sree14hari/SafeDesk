
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    private openrouterKey: string | undefined;
    private geminiKey: string | undefined;
    private currentProvider: 'openrouter' | 'gemini' = 'openrouter';
    private apiUrl: string = "https://openrouter.ai/api/v1/chat/completions";
    private model: string = "tngtech/deepseek-r1t2-chimera:free";
    private geminiModel: any;

    constructor() {
        this.openrouterKey = process.env.OPENROUTER_API_KEY;
        this.geminiKey = process.env.GEMINI_API_KEY;
        
        // Clean up empty keys
        if (!this.openrouterKey || this.openrouterKey.trim() === '') {
            this.openrouterKey = undefined;
        }
        if (!this.geminiKey || this.geminiKey.trim() === '') {
            this.geminiKey = undefined;
        }
        
        // Initialize Gemini if key is available
        if (this.geminiKey) {
            const genAI = new GoogleGenerativeAI(this.geminiKey);
            this.geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        }
        
        // Start with OpenRouter if available, otherwise Gemini
        if (this.openrouterKey) {
            this.currentProvider = 'openrouter';
        } else if (this.geminiKey) {
            this.currentProvider = 'gemini';
        }
    }
    
    private switchToGemini() {
        if (this.geminiKey && this.geminiModel) {
            console.log('[GeminiPolicyService] Switching from OpenRouter to Gemini API');
            this.currentProvider = 'gemini';
            return true;
        }
        return false;
    }

    public async getRecommendation(context: SystemContext): Promise<PolicyRecommendation> {
        if (!this.openrouterKey && !this.geminiKey) {
            return DEFAULT_POLICY;
        }

        // If using Gemini, call it directly
        if (this.currentProvider === 'gemini') {
            return this.getGeminiRecommendation(context);
        }

        // Otherwise use OpenRouter
        const currentApiKey = this.openrouterKey;
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentApiKey}`,
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
                console.error(`[GeminiPolicyService] OpenRouter API Error: ${response.status} ${response.statusText}`, errorBody);

                // Fallback to Gemini on ANY OpenRouter error (4xx, 5xx, etc.)
                if (this.currentProvider === 'openrouter' && this.switchToGemini()) {
                    console.warn(`[GeminiPolicyService] OpenRouter failed with ${response.status}. Switching to Gemini fallback...`);
                    return this.getRecommendation(context); // Recursive retry
                }
                
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const data = await response.json();
            const text = data.choices[0]?.message?.content || "";
            
            return this.parseAIResponse(text);

        } catch (error) {
            console.error("[GeminiPolicyService] Primary Provider (OpenRouter) failed:", error);
            
            // Fallback on network/fetch errors
            if (this.currentProvider === 'openrouter' && this.switchToGemini()) {
                 console.warn(`[GeminiPolicyService] OpenRouter network error. Switching to Gemini fallback...`);
                 return this.getRecommendation(context);
            }

            const hasKey = this.openrouterKey || this.geminiKey;
            if (hasKey) {
                console.error("[GeminiPolicyService] Error generating policy:", error);
            }
            const errorMessage = (error as any).message || "Unknown error";
            return {
                ...DEFAULT_POLICY,
                reason: hasKey ? `AI Unavailable: ${errorMessage}` : "Baseline Protection"
            };
        }
    }

    private async getGeminiRecommendation(context: SystemContext): Promise<PolicyRecommendation> {
        try {
            const prompt = `You are a security policy advisor. Analyze this session and recommend security settings.

Session Context:
- Age: ${context.session_age_minutes} minutes
- Idle: ${context.user_idle_minutes} minutes  
- Files: ${context.files_uploaded}
- Time: ${context.time_of_day}
- Environment: ${context.environment_type}

Return ONLY valid JSON in this exact format:
{
  "recommended_timeout_minutes": <number 1-15>,
  "auto_end_if_idle_minutes": <number 1-10>,
  "require_user_confirmation": <boolean>,
  "allow_multiple_uploads": <boolean>,
  "risk_level": "low" | "medium" | "high",
  "reason": "<brief explanation>"
}`;

            const result = await this.geminiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return this.parseAIResponse(text);
        } catch (error) {
            console.error("[GeminiPolicyService] Gemini error:", error);
            const msg = (error as any).message || "";
            // Check for 429 quota reached
            if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
                 return {
                    ...DEFAULT_POLICY,
                    reason: "AI is resting (Quota limit reached)"
                 };
            }

            return {
                ...DEFAULT_POLICY,
                reason: `Gemini Unavailable: ${msg || "Unknown error"}`
            };
        }
    }

    private parseAIResponse(text: string): PolicyRecommendation {
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
        
        // Validate and normalize
        return {
            recommended_timeout_minutes: Number(recommendation.recommended_timeout_minutes) || 15,
            auto_end_if_idle_minutes: Number(recommendation.auto_end_if_idle_minutes) || 5,
            require_user_confirmation: Boolean(recommendation.require_user_confirmation),
            allow_multiple_uploads: Boolean(recommendation.allow_multiple_uploads),
            risk_level: (['low', 'medium', 'high'].includes(recommendation.risk_level) ? recommendation.risk_level : 'low') as any,
            reason: recommendation.reason || "AI provided policy."
        };
    }
}
