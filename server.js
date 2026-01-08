import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());

/* ===== HEALTH CHECK ===== */
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    message: "AI backend is running",
    timestamp: new Date().toISOString()
  });
});

/* ===== HEALTH ENDPOINT DLA RAILWAY ===== */
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/* ===== CHAT ENDPOINT ===== */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    // WERYFIKUJ KLUCZ API
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey || apiKey === "your-openai-key-here") {
      console.error("OpenAI API key not configured");
      return res.status(500).json({ 
        error: "Server configuration error",
        message: "OpenAI API key is not set"
      });
    }

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
            content: "Jesteś mistycznym tarotowym doradcą. Odpowiadaj spokojnie, empatycznie i duchowo."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.8,
        max_tokens: 500
      })
    });

    // LOG ODPOWIEDZI API
    console.log("OpenAI API Status:", response.status);
    
    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(response.status).json({ 
        error: "OpenAI API error",
        details: data.error || "Unknown error"
      });
    }

    if (!data.choices || data.choices.length === 0) {
      console.error("OpenAI empty response:", data);
      return res.status(500).json({ error: "Empty response from OpenAI" });
    }

    res.json({
      reply: data.choices[0].message.content,
      model: data.model,
      usage: data.usage
    });
    
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
});

/* ===== START SERVER (RAILWAY OPTIMIZED) ===== */
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // WAŻNE dla Railway!

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🔑 OpenAI Key configured: ${process.env.OPENAI_KEY ? 'YES' : 'NO'}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  process.exit(1);
});
