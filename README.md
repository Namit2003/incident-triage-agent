# 🚨 Incident Triage Copilot

A production-ready AI agent application built on **Cloudflare Workers AI** and **Durable Objects** that demonstrates all four core agent components: LLM coordination, workflow orchestration, realtime input, and persistent state management.

## 🎯 Overview

The Incident Triage Copilot helps engineering teams quickly classify and respond to production incidents. Users report an issue, and the agent:

1. **Extracts** structured incident details (service, region, customer impact)
2. **Asks** clarifying questions when needed
3. **Classifies** severity based on impact (P0-P4)
4. **Proposes** actionable next steps
5. **Generates** a markdown status update for sharing

All conversation and incident state persists across sessions using Durable Objects.

---

## 🏗️ Architecture

```mermaid
graph TB
    User[User Browser] -->|WebSocket| Worker[Cloudflare Worker]
    Worker -->|Route by case ID| DO[Durable Object: IncidentCase]
    DO -->|LLM calls| AI[Workers AI - Llama 3.3]
    DO -->|Persist state| Storage[DO Storage]
    
    subgraph "Durable Object State"
        Storage -->|messages[]| Messages
        Storage -->|severity| Severity
        Storage -->|entities| Entities
        Storage -->|actions[]| Actions
        Storage -->|timeline[]| Timeline
    end
    
    Worker -->|Serve static assets| Assets[Static Assets]
    
    style DO fill:#f96,stroke:#333,stroke-width:2px
    style AI fill:#6cf,stroke:#333,stroke-width:2px
    style Storage fill:#9c6,stroke:#333,stroke-width:2px
```

### Why This Architecture?

**Durable Objects for Coordination**
- Single-threaded consistency guarantees for incident state
- Native WebSocket support for real-time chat
- Co-located storage and logic at the edge
- One canonical source of truth per case

**Workers AI with Llama 3.3**
- Fast inference with fp8 quantization
- Strong instruction following for structured extraction
- Reliable JSON formatting
- Runs at the edge with no cold starts

**WebSocket Transport**
- Bidirectional communication (server can push updates)
- Lower latency than SSE for realtime coordination
- Native integration with Durable Objects

---

## ✨ Features

### Core Functionality
- ✅ **Stateful Workflow**: Deterministic triage steps (extract → clarify → classify → propose → generate)
- ✅ **Real-time Chat**: WebSocket-based streaming with instant feedback
- ✅ **Persistent State**: Conversation and case data survive page refreshes
- ✅ **Smart Classification**: LLM-powered severity assessment (P0-P4)
- ✅ **Action Proposals**: Context-aware next steps generation
- ✅ **Export Functionality**: One-click markdown export to clipboard

### UI/UX
- 🎨 **Modern Dark Theme**: Polished gradient design with micro-animations
- 📱 **Responsive Layout**: Works on desktop, tablet, and mobile
- 🔄 **Live Updates**: Case panel updates in real-time as agent processes
- 📊 **Timeline View**: Track incident progression with timestamps
- 🎯 **Session Persistence**: Continues from where you left off

---

## 🚀 Getting Started

### Prerequisites

1. **Cloudflare Account** with Workers Paid Plan ($5/month)
   - Required for Durable Objects
   - Sign up: https://dash.cloudflare.com
   
2. **Node.js** v18+ and npm

3. **Wrangler CLI**
   ```bash
   npm install -g wrangler
   # or use npx wrangler for project-local usage
   ```

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd incident-triage-agent
   npm install
   ```

2. **Authenticate with Cloudflare:**
   ```bash
   npx wrangler login
   ```

3. **Generate types:**
   ```bash
   npm run cf-typegen
   ```

### Local Development

Start the development server:

```bash
npm run dev
```

The app will be available at **http://localhost:8787**

> **Note**: Workers AI is accessed even during local development, which will incur usage charges on your Cloudflare account.

---

## 📦 Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

Your app will be deployed to: `https://incident-triage-agent.<your-subdomain>.workers.dev`

### Post-Deployment

1. Visit the deployed URL
2. Test the full workflow with a sample incident
3. Monitor logs with `npx wrangler tail`

---

## 💡 Sample Usage

### Example Incident Report

Paste this into the chat:

```
Payment API is returning 500 errors in us-west-2.
About 15% of checkout requests are failing.
This started 10 minutes ago.
Customers are seeing "Payment Failed" errors.
```

### Expected Workflow

1. **Agent extracts entities:**
   - Service: Payment API
   - Region: us-west-2
   - Customer Impact: Checkout failures
   - Affected Users: ~15%

2. **Agent may ask clarifying questions:**
   - "How many users are affected?"
   - "Is this impacting all payment methods?"

3. **Severity classification:**
   - **P1**: Major degradation, 10-50% users affected

4. **Proposed actions:**
   - Check error logs in us-west-2
   - Engage on-call engineer for Payment API
   - Monitor error rates
   - Prepare customer communication

5. **Export status update:**
   - Markdown-formatted incident report
   - Ready to paste into Slack/PagerDuty/Jira

---

## 🗂️ Project Structure

```
/
├── public/              # Frontend assets
│   ├── index.html       # Two-panel UI (chat + case sidebar)
│   └── chat.js          # WebSocket client & state management
├── src/
│   ├── index.ts         # Worker entry point
│   ├── incident-case.ts # Durable Object (core coordination logic)
│   └── types.ts         # TypeScript definitions
├── wrangler.jsonc       # Cloudflare Worker configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies and scripts
└── README.md            # This file
```

---

## 🔧 Configuration

### Model Selection

The app uses **Llama 3.3 70B Instruct (fp8-fast)**. To change models:

1. Edit `src/incident-case.ts`:
   ```typescript
   const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
   ```

2. See available models: [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)

### Severity Rubric

Customize the classification logic in `src/incident-case.ts`:

```typescript
const TRIAGE_SYSTEM_PROMPT = `...
- P0: Complete outage, >50% users affected
- P1: Major degradation, 10-50% users affected
- P2: Partial degradation, <10% users affected
- P3: Minor issue, no customer impact
- P4: Cosmetic issue
...`;
```

### AI Gateway (Optional)

For rate limiting, caching, and analytics, enable AI Gateway:

1. Create gateway at https://dash.cloudflare.com/ai/ai-gateway
2. Update LLM calls in `src/incident-case.ts`:
   ```typescript
   const response = await this.env.AI.run(
     MODEL_ID,
     { messages, max_tokens: 512 },
     {
       gateway: {
         id: "YOUR_GATEWAY_ID",
         skipCache: false,
         cacheTtl: 3600,
       },
     }
   );
   ```

---

## 🧪 Testing

### Manual Testing Flow

1. **Open the app** at http://localhost:8787 or your deployed URL
2. **Check WebSocket connection** in DevTools → Network → WS tab
3. **Submit test incident** (see Sample Usage above)
4. **Verify workflow execution:**
   - ✅ Entities extracted and displayed
   - ✅ Severity classified (P0-P4 badge appears)
   - ✅ Actions proposed
   - ✅ Timeline updates
5. **Test persistence:** Refresh page, verify case state persists
6. **Test export:** Click "Export Status Update", verify clipboard

### Console Monitoring

Watch backend logs during development:

```bash
npm run dev
# In another terminal:
npx wrangler tail
```

---

## 📊 API Endpoints

### WebSocket: `/api/case?id={caseId}`

Real-time bidirectional communication with the incident case.

**Client → Server:**
```json
{
  "type": "chat",
  "message": "Payment API is down"
}
```

**Server → Client:**
```json
{
  "type": "message",
  "message": {
    "role": "assistant",
    "content": "I'm analyzing the incident...",
    "timestamp": 1737515000000
  }
}
```

```json
{
  "type": "state_update",
  "state": {
    "caseId": "case-123",
    "severity": "P1",
    "entities": { ... },
    "actions": [ ... ],
    "timeline": [ ... ]
  }
}
```

### REST: `GET /api/case/state?id={caseId}`

Retrieve current case state as JSON.

### REST: `GET /api/case/export?id={caseId}`

Export incident report as markdown.

---

## 🎨 Customization

### Branding

Edit `public/index.html` CSS variables:

```css
:root {
  --primary-color: #f6821f;      /* Orange accent */
  --accent-blue: #3b82f6;        /* Blue highlights */
  --accent-purple: #8b5cf6;      /* Purple gradients */
  --bg-dark: #0f172a;            /* Dark background */
}
```

### System Prompt

Modify agent behavior in `src/incident-case.ts`:

```typescript
const TRIAGE_SYSTEM_PROMPT = `
You are an expert incident triage assistant...
[customize instructions here]
`;
```

---

## 🚧 Known Limitations

- **Case Persistence**: Cases are stored in Durable Objects, not shared across devices
- **Multi-User**: Designed for single-user workflow (no concurrent editing)
- **LLM Accuracy**: Extraction and classification depend on LLM output quality
- **Cost**: Durable Objects incur higher costs than KV (~$0.50/million requests)

---

## 🔒 Security Considerations

- **Input Sanitization**: User input is escaped before rendering in HTML
- **WebSocket Authentication**: Consider adding auth for production deployments
- **Rate Limiting**: Use AI Gateway to prevent abuse
- **CORS**: Configured for same-origin by default

---

## 📈 Future Enhancements

Potential improvements for production use:

- [ ] **Authentication**: Add Cloudflare Access or custom auth
- [ ] **Multi-User Collaboration**: Real-time co-editing with CRDT
- [ ] **Integrations**: Post updates to Slack, PagerDuty, Jira
- [ ] **Metrics**: Track MTTD (mean time to detect) and MTTR
- [ ] **Advanced Workflows**: Custom runbooks per service
- [ ] **Voice Input**: Add speech-to-text for incident reporting

---

## 🛠️ Troubleshooting

### WebSocket Connection Fails

**Problem**: Browser shows WebSocket error in console

**Solutions**:
- Ensure `npm run dev` is running
- Check wrangler output for errors
- Verify Durable Objects are enabled on your account (paid plan required)

### LLM Returns Invalid JSON

**Problem**: Entity extraction or classification fails

**Solutions**:
- Check wrangler logs for the raw LLM response
- Adjust prompts to be more explicit about JSON formatting
- Increase `max_tokens` if response is truncated

### Case State Not Persisting

**Problem**: Page refresh loses case data

**Solutions**:
- Check browser console for errors
- Verify `sessionStorage` has `caseId`
- Ensure Durable Object storage calls are succeeding

### Deployment Fails

**Problem**: `npm run deploy` errors

**Solutions**:
- Run `npx wrangler login` to authenticate
- Verify `wrangler.jsonc` is valid JSON
- Check you have a paid Workers plan (required for Durable Objects)

---

## 📚 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [WebSocket API](https://developers.cloudflare.com/durable-objects/examples/websocket-server/)

---

## 📝 License

MIT License - feel free to use this as a template for your own agent applications.

---

## 🙏 Acknowledgments

Built with:
- **Cloudflare Workers** - Edge compute platform
- **Durable Objects** - Stateful coordination primitive
- **Workers AI** - Edge-native LLM inference
- **Llama 3.3** - Meta's instruction-tuned model

---

**Questions or feedback?** Open an issue or submit a PR!

🚀 **Ready to ship?** Deploy with `npm run deploy` and start triaging incidents at the edge!
