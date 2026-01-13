import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors());
app.use(express.json());

const APP_SECRET_KEY = process.env.APP_KEY;

/* ===== TEST ROOT ===== */
app.get("/", (req, res) => {
  res.json({ status: "AI backend online" });
});

/* ===== CHAT ===== */
app.post("/chat", async (req, res) => {

  const appKey = req.headers["x-app-key"];
  if (!appKey || appKey !== APP_SECRET_KEY) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid application key"
    });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "No message" });
  }

  try {
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
                "Jesteś mistycznym doradcą tarotowym. Odpowiadaj spokojnie i duchowo. 3–4 zdania."
            },
            { role: "user", content: message }
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
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🚀 AI backend running on port", PORT)
);
