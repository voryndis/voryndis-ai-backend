import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());

const APP_SECRET_KEY = process.env.APP_SECRET_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!APP_SECRET_KEY || !OPENAI_API_KEY) {
  console.error("❌ Missing APP_SECRET_KEY or OPENAI_API_KEY");
  process.exit(1);
}

/* ===== PAMIĘĆ SESJI (w RAM) ===== */
const sessionStorage = new Map(); // sessionId -> { messages: [], lastActive: timestamp }

/* ===== WERYFIKACJA KLUCZA ===== */
const verifyAppKey = (req, res, next) => {
  if (req.method === "GET") return next();
  
  const clientKey = req.headers["x-app-key"];
  if (!clientKey || clientKey !== APP_SECRET_KEY) {
    return res.status(403).json({ 
      error: "Unauthorized",
      reply: "🔒 Dostęp wymaga prawidłowego klucza energii."
    });
  }
  next();
};

app.use(verifyAppKey);

/* ===== ENDPOINTY ===== */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Voryndis AI Backend",
    activeSessions: sessionStorage.size,
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

/* ===== GŁÓWNY ENDPOINT CZATU ===== */
app.post("/chat", async (req, res) => {
  console.log("📨 Chat request received");
  
  try {
    const { sessionId, message, endSession } = req.body;
    
    // ===== 1. ZAKOŃCZENIE SESJI =====
    if (endSession === true) {
      if (sessionId && sessionStorage.has(sessionId)) {
        sessionStorage.delete(sessionId);
        console.log(`🗑️ Session ended: ${sessionId}`);
      }
      return res.json({ 
        success: true, 
        message: "Sesja zakończona. Pamięć wyczyszczona." 
      });
    }
    
    // ===== 2. WALIDACJA =====
    if (!sessionId) {
      console.error("❌ Missing sessionId");
      return res.status(400).json({ 
        reply: "Brak identyfikatora sesji. Rozpocznij nową rozmowę." 
      });
    }
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error("❌ Invalid message");
      return res.status(400).json({ 
        reply: "Nie otrzymałam wiadomości do interpretacji." 
      });
    }
    
    const userMessage = message.trim();
    console.log(`💬 Session ${sessionId}: "${userMessage.substring(0, 50)}..."`);
    
    // ===== 3. INICJALIZACJA LUB POBRANIE SESJI =====
    if (!sessionStorage.has(sessionId)) {
      console.log(`🆕 New session created: ${sessionId}`);
      sessionStorage.set(sessionId, {
        messages: [
          {
            role: "system",
            content: `Jesteś Voryndis — mistyczną wróżką i duchową przewodniczką.

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
zakończ ją spokojnie – bez pytania.`
          }
        ],
        lastActive: Date.now()
      });
    }
    
    const session = sessionStorage.get(sessionId);
    session.lastActive = Date.now();
    
    // ===== 4. DODAJ WIADOMOŚĆ UŻYTKOWNIKA =====
    session.messages.push({
      role: "user",
      content: userMessage
    });
    
    // ===== 5. OGRANICZ HISTORIĘ (max 15 wiadomości) =====
    if (session.messages.length > 15) {
      // Zachowaj system prompt i ostatnie 14 wiadomości
      const systemPrompt = session.messages[0];
      const recentMessages = session.messages.slice(-14);
      session.messages = [systemPrompt, ...recentMessages];
    }
    
    console.log(`📊 Session ${sessionId}: ${session.messages.length} messages in history`);
    
    // ===== 6. WYWOŁAJ OPENAI =====
    console.log("🤖 Calling OpenAI API...");
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: session.messages,
        temperature: 0.8,
        max_tokens: 300,
        stream: false
      }),
      timeout: 15000
    });
    
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error("❌ OpenAI API error:", errorData);
      
      // Usuń ostatnią wiadomość użytkownika (bo się nie udało)
      session.messages.pop();
      
      return res.status(500).json({ 
        reply: "Przepraszam, połączenie z wymiarami energii jest dziś niestabilne. Spróbuj ponownie za chwilę." 
      });
    }
    
    const openaiData = await openaiResponse.json();
    const aiReply = openaiData.choices?.[0]?.message?.content || "Nie otrzymałam odpowiedzi od energii.";
    
    console.log(`✅ OpenAI response (${aiReply.length} chars)`);
    
    // ===== 7. DODAJ ODPOWIEDŹ DO HISTORII =====
    session.messages.push({
      role: "assistant",
      content: aiReply
    });
    
    // ===== 8. ODPOWIEDŹ DO KLIENTA =====
    res.json({ 
      reply: aiReply,
      sessionSize: session.messages.length
    });
    
  } catch (error) {
    console.error("💥 Server error:", error);
    res.status(500).json({ 
      reply: "Wystąpił nieoczekiwany błąd w polu energii. Odśwież przestrzeń i spróbuj ponownie." 
    });
  }
});

/* ===== AUTOMATYCZNE CZYSZCZENIE STARYCH SESJI ===== */
setInterval(() => {
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessionStorage.entries()) {
    if (now - session.lastActive > THIRTY_MINUTES) {
      sessionStorage.delete(sessionId);
      cleanedCount++;
      console.log(`🧹 Cleaned old session: ${sessionId} (inactive for 30+ minutes)`);
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Total cleaned: ${cleanedCount} old sessions`);
  }
}, 10 * 60 * 1000); // Sprawdzaj co 10 minut

/* ===== START SERWERA ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔮 Voryndis AI Backend started on port ${PORT}`);
  console.log(`🔐 App Key: ${APP_SECRET_KEY ? '✓ Configured' : '✗ MISSING'}`);
  console.log(`🤖 OpenAI Key: ${OPENAI_API_KEY ? '✓ Configured' : '✗ MISSING'}`);
  console.log(`⏰ Auto-clean: Every 10 minutes (30min inactivity)`);
  console.log(`📅 ${new Date().toISOString()}`);
});
