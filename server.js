import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());

const APP_SECRET_KEY = process.env.APP_SECRET_KEY;

if (!APP_SECRET_KEY) {
  console.error("❌ Missing APP_SECRET_KEY");
  process.exit(1);
}

/* ===== ROOT ENDPOINT ===== */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "AI Tarot Backend",
    endpoints: {
      root: "GET /",
      health: "GET /health",
      chat: "POST /chat"
    },
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

/* ===== HEALTH CHECK (dla Render) ===== */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

/* ===== CHAT ENDPOINT ===== */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: "Invalid request",
        message: "Message must be a non-empty string" 
      });
    }

    // Walidacja klucza OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY environment variable");
      return res.status(500).json({
        error: "Server configuration error",
        message: "OpenAI API key is not configured"
      });
    }

    // Ograniczenie długości wiadomości
    const trimmedMessage = message.trim().substring(0, 2000);
    
    console.log(`Processing chat request: "${trimmedMessage.substring(0, 50)}..."`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Jesteś mistycznym tarotowym doradcą. Odpowiadaj spokojnie, empatycznie i duchowo. Używaj metafor związanych z tarotem. Ogranicz odpowiedź do 3-4 zdań."
          },
          {
            role: "user",
            content: trimmedMessage
          }
        ],
        temperature: 0.8,
        max_tokens: 300
      }),
      timeout: 30000 // 30 sekund timeout
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", {
        status: response.status,
        error: errorData
      });
      
      return res.status(response.status).json({
        error: "OpenAI API error",
        details: errorData.error?.message || "Unknown API error"
      });
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No choices in OpenAI response");
    }

    res.json({
      success: true,
      reply: data.choices[0].message.content,
      model: data.model,
      tokens: data.usage?.total_tokens
    });

  } catch (error) {
    console.error("Chat endpoint error:", error);
    
    // Sprawdź typ błędu
    if (error.name === 'AbortError' || error.code === 'ECONNRESET') {
      return res.status(504).json({
        error: "Request timeout",
        message: "OpenAI API response took too long"
      });
    }
    
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

/* ===== ERROR HANDLING ===== */
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.path} not found`
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: "An unexpected error occurred"
  });
});

/* ===== START SERVER (Render compatible) ===== */
const PORT = process.env.PORT || 3000;

// Render sam ustawia HOST, nie musimy podawać '0.0.0.0'
const server = app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 OpenAI Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'MISSING!'}`);
  console.log(`🔗 Root URL: http://localhost:${PORT}`);
});

// Graceful shutdown dla Render
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Timeout dla requestów
server.timeout = 60000; // 60 sekund
