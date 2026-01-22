/**
 * IncidentCase Durable Object - Simplified REST API version
 *
 * Manages stateful incident triage workflow with persistent storage.
 */

import {
    Env,
    IncidentState,
    ChatMessage,
    SeverityLevel,
    Action,
} from "./types";

const TRIAGE_SYSTEM_PROMPT = `You are an expert incident triage assistant for a cloud platform engineering team.

Extract structured incident information, classify severity, and propose actionable next steps.

Severity rubric:
- P0: Complete outage, >50% users affected, critical services down
- P1: Major degradation, 10-50% users affected, significant business impact
- P2: Partial degradation, <10% users affected, minor business impact
- P3: Minor issue, no customer impact
- P4: Cosmetic issue

Be concise, actionable, and professional.`;

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export class IncidentCase implements DurableObject {
    private state: DurableObjectState;
    private env: Env;
    private incidentState: IncidentState | null = null;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
        this.state.blockConcurrencyWhile(async () => {
            await this.loadState();
        });
    }

    private async loadState(): Promise<void> {
        const stored = await this.state.storage.get<IncidentState>("incident");
        this.incidentState = stored || null;
    }

    private async saveState(): Promise<void> {
        if (this.incidentState) {
            this.incidentState.updatedAt = Date.now();
            await this.state.storage.put("incident", this.incidentState);
        }
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Get current state
        if (request.method === "GET" && url.pathname.endsWith("/state")) {
            return new Response(JSON.stringify(this.incidentState), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // Triage a new incident
        if (request.method === "POST" && url.pathname.endsWith("/triage")) {
            const { message } = (await request.json()) as { message: string };
            const result = await this.triageIncident(message);
            return new Response(JSON.stringify(result), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // Export markdown
        if (request.method === "GET" && url.pathname.endsWith("/export")) {
            const markdown = this.generateMarkdown();
            return new Response(markdown, {
                headers: { "Content-Type": "text/markdown" },
            });
        }

        return new Response("Not found", { status: 404 });
    }

    private async triageIncident(userMessage: string) {
        // Initialize or update state
        if (!this.incidentState) {
            const url = new URL(this.state.id.toString());
            const caseId = url.searchParams.get("id") || crypto.randomUUID();
            this.incidentState = {
                caseId,
                messages: [],
                entities: {},
                actions: [],
                timeline: [
                    {
                        timestamp: Date.now(),
                        type: "created",
                        description: "Incident case created",
                    },
                ],
                status: "intake",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        // Add user message
        this.incidentState.messages.push({
            role: "user",
            content: userMessage,
            timestamp: Date.now(),
        });

        try {
            // Step 1: Extract entities
            await this.extractEntities(userMessage);

            // Step 2: Classify severity
            if (this.incidentState.entities.service && this.incidentState.entities.customerImpact) {
                await this.classifySeverity();
            }

            // Step 3: Propose actions
            if (this.incidentState.severity) {
                await this.proposeActions();
            }

            await this.saveState();

            return {
                success: true,
                state: this.incidentState,
            };
        } catch (error) {
            console.error("Triage failed:", error);
            return {
                success: false,
                error: "Failed to process incident",
            };
        }
    }

    private async extractEntities(text: string): Promise<void> {
        const prompt = `Extract incident details from: "${text}"

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "service": "service name",
  "region": "region or global",
  "customerImpact": "impact description",
  "affectedUsers": "percentage or number"
}`;

        const response = await this.env.AI.run(MODEL_ID, {
            messages: [
                { role: "system", content: TRIAGE_SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            max_tokens: 256,
        });

        const data = this.parseAIResponse(response);
        if (data.service) this.incidentState!.entities.service = data.service;
        if (data.region) this.incidentState!.entities.region = data.region;
        if (data.customerImpact)
            this.incidentState!.entities.customerImpact = data.customerImpact;
        if (data.affectedUsers)
            this.incidentState!.entities.affectedUsers = data.affectedUsers;

        this.incidentState!.timeline.push({
            timestamp: Date.now(),
            type: "entities_extracted",
            description: "Extracted incident entities",
        });
    }

    private async classifySeverity(): Promise<void> {
        const prompt = `Classify severity:
Service: ${this.incidentState!.entities.service}
Region: ${this.incidentState!.entities.region}
Impact: ${this.incidentState!.entities.customerImpact}
Users: ${this.incidentState!.entities.affectedUsers}

Return JSON:
{
  "severity": "P0|P1|P2|P3|P4",
  "reasoning": "brief explanation"
}`;

        const response = await this.env.AI.run(MODEL_ID, {
            messages: [
                { role: "system", content: TRIAGE_SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            max_tokens: 256,
        });

        const data = this.parseAIResponse(response);
        this.incidentState!.severity = data.severity as SeverityLevel;
        this.incidentState!.status = "triaged";

        this.incidentState!.timeline.push({
            timestamp: Date.now(),
            type: "severity_set",
            description: `Classified as ${data.severity}`,
            metadata: { reasoning: data.reasoning },
        });

        // Add assistant message
        this.incidentState!.messages.push({
            role: "assistant",
            content: `✅ **Severity: ${data.severity}**\n\n${data.reasoning}`,
            timestamp: Date.now(),
        });
    }

    private async proposeActions(): Promise<void> {
        const prompt = `Propose 3-5 actions for:
Severity: ${this.incidentState!.severity}
Service: ${this.incidentState!.entities.service}
Region: ${this.incidentState!.entities.region}

Return JSON:
{
  "actions": ["action 1", "action 2", "action 3"]
}`;

        const response = await this.env.AI.run(MODEL_ID, {
            messages: [
                { role: "system", content: TRIAGE_SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            max_tokens: 512,
        });

        const data = this.parseAIResponse(response);
        data.actions.forEach((desc: string) => {
            const action: Action = {
                id: crypto.randomUUID(),
                description: desc,
                status: "proposed",
                createdAt: Date.now(),
            };
            this.incidentState!.actions.push(action);
        });

        // Add assistant message
        const actionsList = data.actions
            .map((a: string, i: number) => `${i + 1}. ${a}`)
            .join("\n");
        this.incidentState!.messages.push({
            role: "assistant",
            content: `📋 **Proposed Actions:**\n\n${actionsList}`,
            timestamp: Date.now(),
        });
    }

    private parseAIResponse(response: unknown): any {
        if (typeof response === "object" && response !== null && "response" in response) {
            const responseData = response as { response: unknown };

            // If already parsed JSON object
            if (typeof responseData.response === "object" && responseData.response !== null) {
                return responseData.response;
            }

            // If string, try to extract and parse JSON
            if (typeof responseData.response === "string") {
                let text = responseData.response.trim();

                // Remove markdown code blocks
                text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");

                // Try to find JSON object in the text
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error("Failed to parse extracted JSON:", jsonMatch[0]);
                    }
                }

                // If no JSON found, try parsing the whole thing
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error("Failed to parse response as JSON:", text.substring(0, 100));
                    throw new Error("LLM did not return valid JSON");
                }
            }
        }
        throw new Error("Unexpected AI response format");
    }

    private generateMarkdown(): string {
        if (!this.incidentState) return "";

        let md = `# Incident Report: ${this.incidentState.caseId}\n\n`;
        md += `**Status:** ${this.incidentState.status.toUpperCase()}\n`;
        if (this.incidentState.severity) {
            md += `**Severity:** ${this.incidentState.severity}\n`;
        }
        md += `\n## Incident Details\n\n`;
        if (this.incidentState.entities.service) {
            md += `- **Service:** ${this.incidentState.entities.service}\n`;
        }
        if (this.incidentState.entities.region) {
            md += `- **Region:** ${this.incidentState.entities.region}\n`;
        }
        if (this.incidentState.entities.customerImpact) {
            md += `- **Impact:** ${this.incidentState.entities.customerImpact}\n`;
        }
        if (this.incidentState.entities.affectedUsers) {
            md += `- **Affected Users:** ${this.incidentState.entities.affectedUsers}\n`;
        }

        if (this.incidentState.actions.length > 0) {
            md += `\n## Next Actions\n\n`;
            this.incidentState.actions.forEach((action, i) => {
                md += `${i + 1}. ${action.description}\n`;
            });
        }

        return md;
    }
}
