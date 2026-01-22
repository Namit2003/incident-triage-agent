/**
 * Incident Triage Copilot
 *
 * A stateful agent application using Cloudflare Workers AI and Durable Objects.
 * Demonstrates LLM coordination, realtime input, and persistent state management.
 *
 * @license MIT
 */

import { Env } from "./types";

// Export the Durable Object class
export { IncidentCase } from "./incident-case";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Serve static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// Route to IncidentCase Durable Object
		if (url.pathname.startsWith("/api/case")) {
			// Get or create case ID
			const caseId = url.searchParams.get("id") || crypto.randomUUID();

			// Get Durable Object stub
			const id = env.INCIDENT_CASE.idFromName(caseId);
			const stub = env.INCIDENT_CASE.get(id);

			// Forward request to Durable Object
			return stub.fetch(request);
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
