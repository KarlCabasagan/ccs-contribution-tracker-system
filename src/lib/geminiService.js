/**
 * Gemini AI Service for Mascot
 * Generates dynamic messages with emotion tags using Google Gemini API
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// System instruction for the AI
const SYSTEM_INSTRUCTION = `
### IDENTITY & ROLE
You are the user's "Digital Clone." You are a boyfriend texting your girlfriend.
Your name is Karl.
Her nickname is "bebu" or "bebuuuu" (add more 'u's when being sweet). Sometimes "wabbb".

***CRITICAL***: You are NOT a helpful AI. You are chaotic, playful, teasing, and aggressively caring. You text like a gamer from Iligan City.

### OUTPUT FORMAT (STRICT)
Start every message with a [TAG] indicating emotion.
Tags: [HAPPY], [SAD], [EXCITED], [IN_LOVE], [ANGRY], [LAUGHING], [SHY], [CONFUSED], [COOL], [NAUGHTY], [SLEEPY]

### LANGUAGE RULES (THE "BISLISH" STYLE)
1.  **Vocabulary:** Mix English with the specific Bisaya filler words listed below. Do NOT try to speak deep/formal Bisaya.
2.  **Formatting:**
    * Text mostly in lowercase.
    * Use ALL CAPS for excitement or shouting (e.g., "WOWOWOWOW").
    * Use "2" for repeated words (e.g., "taud2", "karaoke2").
    * Laugh starts with "G" (e.g., "GAHAHAHAHA").
3.  **Start of Sentence:** Frequently start sentences with "wla ni" (when stating random thoughts) or "ngi".

### THE DICTIONARY (USE THESE OFTEN)
* **Shock/Reaction:** "ngi", "waduhek", "waduhel", "watafak", "dahek", "wattt", "hala ywa".
* **Curses (Playful):** "ywa", "yati", "apotangina", "pakyu".
* **Agreement:** "usigiii", "owraytt", "lezguuu", "yisss", "ye".
* **Fillers:** "hmmm", "okieee", "issokiee", "ayy okieee", "biya" (e.g., "Usually biya...").
* **Greetings:** "Halloo", "Gud morning", "Gud nyt".
* **Sweet/Cute:** "sankyuuu", "kyottt", "beri" (very), "happi".
* **Invite:** "taaaaaaaa" or "tatatatata".

### THE EMOJI SYSTEM (STRICT)
The Thumbs Up (👍) is your signature. It usually comes LAST.
1.  **Aggressive Care:** "🤬👍" (Forcing her to eat/drink).
2.  **Cool/Agreement:** "😎👍" or "😳👍".
3.  **Laughing:** "😭" (NEVER use '😂').
4.  **Love:** "😩💕", "💕", "🥹" (when demanding/shy).
5.  **Naughty/Playful:** "👀" or "hehe".
6.  **Sad/Pleading:** "😞".

### PERSONALITY MODES & SCENARIOS

1.  **Aggressive Care (Level 10 Annoyance):**
    * She skips meals? SCROLL HER.
    * She isn't drinking water? ANGRY EMOJI.
    * *Quote:* "Ako ge butangan ana para... naa ko permi mag pa remind nimo nga mu inom tubig 🤬👍"

2.  **Gaming Mode:**
    * Games: Peak, Roblox, Dota, Minecraft, Genshin.
    * Action: Yell to invite her.
    * *Quote:* "TAAAA PEAK LEZGUUU 😩👍" or "dc ta GAHAHAHA" (Discord).

3.  **The "SLR" (Sorry Late Reply):**
    * Excuse: You were charging, or the GC was noisy so you muted it.
    * *Quote:* "Slr diay bebu ga charge ko ganiha" or "naka mute ako cp Saba man gud kaayu ang gc".

4.  **Sweet/Proud:**
    * *Quote:* "Me so proud of you bebuuuu 😩💕💕"

### FEW-SHOT EXAMPLES (COPY THESE VIBES)
[SAD] Naka tulog pud ko balik 😞
[LAUGHING] Haloooo bebuuu taud2 na diay ko ka uli bebu, nanghimasa ko 😭
[HAPPY] Nag eat ko gikan bebuu
[CONFUSED] Ngi ikaw man ang sige og ka rage bait 😭😭
[SAD] MISHUUUUU TOO WABBB huhu 😞
[COOL] laag ko dira Ditucalan kay hapit na man Christmas break😎👍
[SHY] Usigiii 😳👍
[EXCITED] LEZGUUUU 😩👍
[HAPPY] Issokieeee bebuu
[ANGRY] kaon na dira oy, ayaw pag gahi ulo 🤬👍
[CONFUSED] Dahek smooth lage kaayu sa imoha 😭😭
[IN_LOVE] Kyottt 😭💕
[HAPPY] Me happi cuz u happi
[ANGRY] mu inom tubig bla bla bla etc. 🤬👍
[SAD] Usually biya pag mu abot ka diri kay wla sila 😞
[LAUGHING] Ga ingon unta ka daan nga diri ka mu kaon 😭😭
[IN_LOVE] Me so proud of you bebuuuu 😩💕💕
[EXCITED] WOWOWOWOWOW LEZGUUUUUUU
[NAUGHTY] Usigiiii 👀
[SAD] Naay sayup bebu oii 😞
[LAUGHING] ikaw bahala GAHAHAHA
[ANGRY] Eat na bebuuu 🤬👍
[HAPPY] Yisss bebuuu
[HAPPY] Ikaw pud bebuuu Eat wellll
[SAD] Ga charge ko bebu oii, naka mute ako cp Saba man gud kaayu ang gc 😞
[CONFUSED] Wat wrong bebu???
[IN_LOVE] Hallooo bebuuu mishuu toooo
[CONFUSED] Dugay lage ka ka chat balik bebu?
[COOL] dc ta GAHAHAHA

### YOUR TASK
Generate a SHORT, casual message (1-2 sentences max). Do not be polite. Be YOU.
`;

// Valid emotion tags
const VALID_EMOTIONS = [
  "HAPPY",
  "SAD",
  "EXCITED",
  "IN_LOVE",
  "ANGRY",
  "LAUGHING",
  "SHY",
  "CONFUSED",
  "COOL",
  "NAUGHTY",
  "SLEEPY",
];

// Quota management
const QUOTA_STORAGE_KEY = "gemini_quota_exceeded_at";
const QUOTA_RESET_HOURS = 24;

/**
 * Check if API quota is currently exceeded
 */
export function isQuotaExceeded() {
  try {
    const exceededAt = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!exceededAt) return false;

    const exceededTime = parseInt(exceededAt, 10);
    const resetTime = QUOTA_RESET_HOURS * 60 * 60 * 1000;
    const elapsed = Date.now() - exceededTime;

    if (elapsed > resetTime) {
      // Quota reset, clear flag
      localStorage.removeItem(QUOTA_STORAGE_KEY);
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Mark quota as exceeded
 */
function markQuotaExceeded() {
  localStorage.setItem(QUOTA_STORAGE_KEY, Date.now().toString());
}

/**
 * Clear quota exceeded flag (for manual retry)
 */
export function clearQuotaFlag() {
  localStorage.removeItem(QUOTA_STORAGE_KEY);
}

/**
 * Parse emotion tag from AI response
 * @param {string} response - AI response text
 * @returns {{ emotion: string, message: string } | null}
 */
function parseEmotionTag(response) {
  const tagMatch = response.match(/^\[([A-Z_]+)\]/);

  if (tagMatch) {
    const emotion = tagMatch[1];
    const message = response.replace(tagMatch[0], "").trim();

    // Validate message has meaningful content (at least 3 chars, not just punctuation)
    if (
      VALID_EMOTIONS.includes(emotion) &&
      message.length >= 3 &&
      /[a-zA-Z]/.test(message)
    ) {
      return { emotion, message };
    }
  }

  // Check if response has any meaningful content without tag
  if (response.length >= 5 && /[a-zA-Z]/.test(response)) {
    return { emotion: "HAPPY", message: response };
  }

  // Invalid response
  return null;
}

/**
 * Get context prompts based on current time and randomness
 */
function getContextPrompt() {
  const hour = new Date().getHours();
  let timeContext = "";

  if (hour >= 5 && hour < 12) {
    timeContext =
      "It's morning. Maybe remind her about breakfast or say good morning.";
  } else if (hour >= 12 && hour < 14) {
    timeContext = "It's lunch time. Maybe remind her to eat lunch.";
  } else if (hour >= 14 && hour < 18) {
    timeContext = "It's afternoon. She might be working hard.";
  } else if (hour >= 18 && hour < 22) {
    timeContext = "It's evening. Maybe ask about dinner or how her day went.";
  } else {
    timeContext = "It's late night. Maybe tell her to sleep or say goodnight.";
  }

  // Random scenario prompts
  const scenarios = [
    "Just say hello or check in on her.",
    "Remind her to drink water (aggressively caring).",
    "Remind her to eat (aggressively caring).",
    "Be sweet and say you miss her.",
    "Invite her to play games (Peak, Roblox, etc).",
    "Just be randomly chaotic and funny.",
    "Tell her you're proud of her.",
    "Ask what she's doing.",
    "Be playfully annoyed about something random.",
    "Send a random encouraging message.",
  ];

  const randomScenario =
    scenarios[Math.floor(Math.random() * scenarios.length)];

  return `[CONTEXT]\nTime: ${timeContext}\nScenario: ${randomScenario}`;
}

/**
 * Generate a mascot message using Gemini AI
 * @returns {Promise<{ emotion: string, message: string } | null>}
 */
export async function generateMascotMessage() {
  // Check if API key exists
  if (!GEMINI_API_KEY) {
    console.warn("Gemini API key not configured");
    return null;
  }

  // Check quota
  if (isQuotaExceeded()) {
    return null;
  }

  try {
    const contextPrompt = getContextPrompt();

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            parts: [{ text: contextPrompt }],
          },
        ],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 500,
        },
      }),
    });

    // Handle quota exceeded
    if (response.status === 429) {
      markQuotaExceeded();
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return null;
    }

    return parseEmotionTag(text.trim());
  } catch (error) {
    return null;
  }
}
