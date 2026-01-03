# Local LLM UI

A Next.js web application for interacting with Ollama (local LLM) on your MacBook. This application allows users to enter AI prompts, select models and temperature settings, and maintain conversation history in MongoDB.

## Features

- 🤖 Chat with local LLM models via Ollama
- 💾 Persistent conversation history in MongoDB
- 🎛️ Adjustable model and temperature parameters
- 💬 Continue existing conversations
- 🎨 Bootstrap styling (not Tailwind)
- 📱 Responsive design

## Prerequisites

- Node.js 18+ installed
- MongoDB running locally or accessible via connection string
- Ollama installed and running on your MacBook
- At least one Ollama model downloaded (e.g., `gemma3:12b`)

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/local-llm-ui
   OLLAMA_API_URL=http://localhost:11434/api
   NODE_ENV=development
   ```

3. **Start MongoDB:**
   Make sure MongoDB is running on your system. If using a local instance:
   ```bash
   mongod
   ```

4. **Start Ollama:**
   Make sure Ollama is running on your MacBook. The default API URL is `http://localhost:11434/api`.

5. **Download an Ollama model (if you haven't already):**
   ```bash
   ollama pull gemma3:12b
   ```
   Or any other model you prefer.

6. **Run the development server:**
   ```bash
   npm run dev
   ```

7. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Start a new conversation:** Click the "New Chat" button in the sidebar
2. **Select a model:** Use the dropdown in the header to select an available Ollama model
3. **Adjust temperature:** Use the slider to set the temperature (0-2). Higher values make responses more creative, lower values make them more focused.
4. **Enter a prompt:** Type your message in the text area and click "Submit" or press Enter (Shift+Enter for new line)
5. **View conversation history:** Click on any conversation in the sidebar to continue it
6. **Delete conversations:** Click the × button on any conversation to delete it

## Project Structure

```
local-llm-ui/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/              # Chat API endpoint
│   │   │   ├── conversations/     # Conversation CRUD endpoints
│   │   │   └── models/             # Available models endpoint
│   │   ├── components/
│   │   │   └── BootstrapClient.tsx # Bootstrap JS loader
│   │   ├── utils/
│   │   │   └── api.ts              # API client utilities
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Main chat interface
│   │   └── globals.css             # Global styles
│   ├── lib/
│   │   └── mongodb.ts              # MongoDB connection utility
│   └── models/
│       ├── Conversation.ts          # Conversation model
│       └── Message.ts               # Message model
├── package.json
├── tsconfig.json
└── next.config.ts
```

## API Endpoints

- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create a new conversation
- `GET /api/conversations/[id]` - Get a specific conversation
- `PUT /api/conversations/[id]` - Update a conversation
- `DELETE /api/conversations/[id]` - Delete a conversation
- `POST /api/chat` - Send a message and get LLM response
- `GET /api/models` - Get available Ollama models

## Technologies Used

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Bootstrap 5** - UI styling
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM
- **Axios** - HTTP client
- **Ollama API** - Local LLM integration

## Troubleshooting

### Ollama Connection Issues
- Make sure Ollama is running: `ollama serve`
- Check that the `OLLAMA_API_URL` in `.env.local` matches your Ollama instance
- Verify Ollama is accessible: `curl http://localhost:11434/api/tags`

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check your `MONGODB_URI` in `.env.local`
- For local MongoDB: `mongod` should be running

### Model Not Found
- Make sure you've downloaded the model: `ollama pull <model-name>`
- Check available models: `ollama list`

## License

ISC

