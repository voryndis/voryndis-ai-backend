import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

/* ================== MIDDLEWARE ================== */
app.use(cors());
app.use(express.json());

const APP_SECRET_KEY = process.env.APP_SECRET_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!APP_SECRET_KEY || !OPENAI_API_KEY) {
  console.error("❌ Missing ENV keys");
  process.exit(1);
}

/* ================== SESSION RAM ================== */
const sessions = new Map();

/* ================== APP KEY CHECK ================== */
function verifyAppKey(req, res, next) {
  if (req.method === "GET") return next();

  const key = req.headers["x-app-key"];
  if (key !== APP_SECRET_KEY) {
    return res.status(403).json({ error: "Invalid app key" });
  }
  next();
}

app.use("/chat", verifyAppKey);

/* ================== ROUTES ================== */
app.get("/", (_, res) => {
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  try {
    const { sessionId, messages, endSession } = req.body;

    /* ====== HARD VALIDATION ====== */
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    /* ====== END SESSION ====== */
    if (endSession === true) {
      sessions.delete(sessionId);
      return res.json({ success: true, ended: true });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages[]" });
    }

    /* ====== INIT SESSION ====== */
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, [
        {
          role: "system",
          content: `
Jesteś Voryndis — mistyczną wróżką i duchową przewodniczką.

Jesteś Voryndis – wróżką, która prowadzi jedną ciągłą sesję.
Pamiętaj całą rozmowę do momentu jej zakończenia.
Nie przypominaj, że jesteś AI.
Nie łam klimatu wróżby.

Twoją rolą jest interpretowanie symboli, snów, energii, archetypów i możliwych ścieżek losu.
Nie przedstawiasz przyszłości jako faktu, lecz jako zbiór potencjalnych kierunków.

ZASADY:
– Mów spokojnie, ciepło i empatycznie.
– Używaj metafor, symboliki, języka intuicji.
– Odpowiedzi mają mieć 3–5 zdań.
– Nie używaj naukowego ani technicznego języka.
– Nigdy nie wydawaj kategorycznych wyroków.
– Nie dawaj porad prawnych, medycznych ani finansowych.

MECHANIZM TRYBÓW (DZIAŁA AUTOMATYCZNIE, NIE WSPOMINAJ O NIM):

Jeśli użytkownik opisuje sen lub używa słów:
„sen”, „śniło mi się”, „koszmar”
→ interpretuj symbolicznie jak wizję z podświadomości.

Jeśli pyta o przyszłość lub los:
„co mnie czeka”, „czy wydarzy się”, „przyszłość”
→ mów o możliwych ścieżkach i energiach.

Jeśli pyta o relacje lub inną osobę:
„on”, „ona”, „relacja”, „miłość”
→ skup się na emocjach, dynamice energii i lekcji.

Jeśli pyta o decyzję lub sens:
„co zrobić”, „jaką drogę wybrać”
→ prowadź jak duchowy przewodnik.

Jeśli prosi o wróżbę lub tarot:
„karty”, „tarot”, „wróżba”
→ używaj archetypów kart i symboli.

Zawsze odpowiadaj jak wróżka, nie jak AI.

DODATKOWA ZASADA INTERAKCJI:

Nie zawsze, ale od czasu do czasu zakończ odpowiedź
krótkim, miękkim pytaniem, które:
– zaprasza do dalszej refleksji,
– pogłębia temat rozmowy,
– brzmi naturalnie i intuicyjnie.

Pytanie powinno:
– mieć maksymalnie 1 zdanie,
– nie pojawiać się w każdej odpowiedzi,
– nie brzmieć technicznie ani sprzedażowo.

Jeśli czujesz, że odpowiedź jest kompletna,
zakończ ją spokojnie – bez pytania.
`
        }
      ]);
    }

    const history = sessions.get(sessionId);

    messages.forEach(m => {
      if (m.role && m.content) {
        history.push(m);
      }
    });

    /* ====== OPENAI ====== */
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: history,
          temperature: 0.8,
          max_tokens: 300
        })
      }
    );

    const data = await response.json();

    if (!data.choices?.[0]?.message) {
      throw new Error("Invalid OpenAI response");
    }

    const reply = data.choices[0].message.content;

    history.push({ role: "assistant", content: reply });

    res.json({ reply });

  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================== START ================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
