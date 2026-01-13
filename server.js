import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());

// Pobierz klucz z environment variables
const APP_SECRET_KEY = process.env.APP_SECRET_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Walidacja kluczy
if (!APP_SECRET_KEY) {
  console.error("❌ Missing APP_SECRET_KEY");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}

/* ===== MIDDLEWARE DO WERYFIKACJI KLUCZA ===== */
const verifyAppKey = (req, res, next) => {
  // Pozwól na GET requesty bez klucza (dla health check)
  if (req.method === 'GET') {
    return next();
  }

  const clientKey = req.headers['x-app-key'] || req.body.appKey;
  
  if (!clientKey) {
    console.warn("Brak klucza w requestcie", {
      ip: req.ip,
      path: req.path,
      headers: req.headers
    });
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing app key"
    });
  }

  if (clientKey !== APP_SECRET_KEY) {
    console.warn("Niepoprawny klucz", {
      ip: req.ip,
      keyReceived: clientKey.substring(0, 10) + "..."
    });
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid app key"
    });
  }

  next();
};

// Użyj middleware dla wszystkich endpointów
app.use(verifyAppKey);

/* ===== ROOT ENDPOINT ===== */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "AI Tarot Backend (Secured)",
    endpoints: {
      root: "GET /",
      health: "GET /health",
      chat: "POST /chat (requires x-app-key)"
    },
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

/* ===== HEALTH CHECK ===== */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    secure: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* ===== CHAT ENDPOINT (ZABEZPIECZONY) ===== */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ 
        error: "Invalid request",
        message: "Message must be a non-empty string" 
      });
    }

    // Ograniczenie długości
    const trimmedMessage = message.trim().substring(0, 2000);
    
    console.log(`[SECURE] Processing chat: "${trimmedMessage.substring(0, 50)}..."`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
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
      timeout: 30000
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      
      return res.status(response.status).json({
        error: "OpenAI API error",
        details: errorData.error?.message || "Unknown error"
      });
    }

    const data = await response.json();

    res.json({
      success: true,
      reply: data.choices[0].message.content,
      model: data.model,
      tokens: data.usage?.total_tokens,
      secured: true
    });

  } catch (error) {
    console.error("Chat error:", error);
    
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

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Secure server started on port ${PORT}`);
  console.log(`🔐 App key: ${APP_SECRET_KEY ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`🔑 OpenAI key: ${OPENAI_API_KEY ? 'CONFIGURED' : 'MISSING'}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
