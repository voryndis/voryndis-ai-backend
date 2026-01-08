import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());

/* ===== TEST ENDPOINT ===== */
app.get("/", (req, res) => {
  res.send("AI backend is running");
});

/* ===== CHAT ENDPOINT ===== */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Jesteś mistycznym tarotowym doradcą. Odpowiadaj spokojnie, empatycznie i duchowo."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (!data.choices) {
      console.error("OpenAI error:", data);
      return res.status(500).json({ error: "OpenAI API error" });
    }

    res.json({
      reply: data.choices[0].message.content
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server crashed" });
  }
});

/* ===== START SERVER (RAILWAY) ===== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
