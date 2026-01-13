const APP_SECRET_KEY = process.env.APP_KEY;

app.post("/chat", async (req, res) => {
  const appKey = req.headers["x-app-key"];

  if (!appKey || appKey !== APP_SECRET_KEY) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid application key"
    });
  }

  // reszta kodu...
});

import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors());
app.use(express.json());

const APP_KEY = process.env.APP_KEY;

/* ===== ROOT ===== */
app.get("/", (req, res) => {
  res.json({ status: "online" });
});

/* ===== HEALTH ===== */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

/* ===== CHAT ===== */
app.post("/chat", async (req, res) => {

  // 🔐 APP KEY CHECK
  const appKey = req.headers["x-app-key"];
  if (!appKey || appKey !== APP_KEY) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid application key"
    });
  }

  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid message" });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Jesteś mistycznym tarotowym doradcą. Odpowiadaj spokojnie, duchowo i empatycznie. Maks 3–4 zdania."
            },
            {
              role: "user",
              content: message.substring(0, 500)
            }
          ],
          temperature: 0.8,
          max_tokens: 300
        })
      }
    );

    const data = await response.json();

    res.json({
      reply: data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
