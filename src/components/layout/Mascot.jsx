import { useState, useEffect, useRef, useCallback } from "react";

// Import mascot assets
import mascotIdle from "../../assets/mini-karl/mini-karl-mascot-idle.gif";
import mascotEmote from "../../assets/mini-karl/mini-karl-mascot-emote.gif";

// Cute messages for the mascot to say
const CUTE_MESSAGES = [
  "You're doing amazing, bebu! ✨",
  "Keep up the great work, wabbb! 💪",
  "I believe in you, bebu! 🌟",
  "You're the best admin ever, bebuu! 👑",
  "Ayaw kalimot pahulay bebuu! ☕",
  "You make CCS proud, bebu! 🎉",
  "Stay awesome, my wabbbbb! 🚀",
  "Ayaw kalimot inom tubig! 😡💧",
  "System status: labyu! 💖",

  // --- Motivation & Hype ---
  "Laban lang, bebu! 🔥",
  "Small progress is still progress, wabb! 🐢🚀",
  "Slay the day! 💅👑",
  "You're killing it! 🔪💖",
  "Focus lang bebuu! 🧠💡",
  "Padayon lang, wabbbb! 🛤️👣",
  "Nothing can stop my bebu! 🛑🚫",

  // --- Care & Reminders (The "Boyfriend Mode") ---
  "Ayaw kalimot kaon bebu! 🍗🍚",
  "Pag stretching pud, aron di mag sakit ang likod! 🧘‍♀️✨",

  // --- Sweet & Playful ---
  "Mishuu luds! 🥺💔",
  "You're my favorite view, bebuuu! 🖼️❤️",
  "Beep boop! wabbyou! 🤖💟",
  "Huggies for my hardworking bebu! 🧸🤗",
  "My heart is cheering for you, wabb! 📣💓",
  "You inspire me, bebu! ✨🦸‍♀️",

  // --- Tech & Admin Specific ---
  "Clearing tasks like a boss! 🧹✅",
  "Error 404: Stress not found (hopefully)! 🚫😖",
  "Data saved... and I saved a kiss for you! 💾💋",
];

// Random welcome messages
const WELCOME_MESSAGES = [
  "Halloooo bebuuu! 💖",
  "Welcome back, wabbb! 🥰",
  "Hi there, pretty! ✨",
  "Hallo, my favorite person! 🌍❤️",
  "Good to see you, bebuu! 🌸",
  "Hiiiii wabbbb! 👋😘",
  "Yay, you're here! 🎉❤️",
  "My bebu is online! 🟢😍",
  "Welcome home, my queen! 👑💖",
  "Hola, mi amore! 🇪🇸🌹",
  "Bonjour, beauty! 🇫🇷🥐",
  "Hi sweetie! 🍬🍭",
  "Wassap bebu! 🤘❤️",
  "System Online! 🟢⚡",

  // --- System & Tracker Themed (Best for this specific app) ---
  "Ready to track some contributions? 📈💪",
  "System status: In wabb with you. 🤖❤️",
  "Login successful: Cuteness detected! 🔓✨",
  "Time to update those stats! 📝🚀",
  "Database connected to my heart! 💾💘",
  "CCS Tracker is ready for you! 🏫🔥",
  "You make this system look good! 💅💻",
  "Authorized access: My wabb only! 🛡️❤️",
  "Syncing love... 100% complete! 🔄💕",
  "Let's fill up that tracker! 🖊️✨",
  "System ready for the boss lady! 👩‍💻💖",
  "Inputting love data... ⌨️💖",
  "Tracker is hungry for data! 🍽️📄",
  "Log it, track it, love it! 📝❤️",
  "Just checking in on my angel! 👼☁️",

  // --- Motivational & Work Mode ---
  "You got this, bebuuu! 💪🔥",
  "Let's be productive today! 🚀🧠",
  "Time to slay, wabbb! 💅✨",
  "Let's crush these goals! 🥅💥",
  "Do your best, bebu! I'm cheering for you! 📣💕",
  "Focus mode: ON! 🧐⚡",
  "Make today count! ⏳🌈",
  "Let's make magic happen! 🪄✨",
  "Let's clear those tasks! 🧹✅",
  "Let's goooo! 🏎️💨",
  "Let's do this! 👊💥",
  "Work it! 💃✨",

  // --- Sweet & Affectionate ---
  "The system missed you! 🥺💻",

  // --- Local/Taglish (Perfect for Iligan context) ---
  "Gudluckk bebuu! 🇵🇭❤️",
  "Mishuuu luds! 😗💏",
  "Wabbbyouu po! 🙇‍♂️❤️",
  "Naol dasig kaayu! 😝🌟",
  "Fighting!! 🥊😠",
];

// Default mascot settings
const DEFAULT_MASCOT_SETTINGS = {
  enabled: true,
  showWelcome: true,
  mobileAutoOpen: true,
  autoMessageInterval: 120, // seconds (2 minutes)
  idleTimeout: 30, // seconds
};

// Get mascot settings from localStorage (used as fallback)
function getMascotSettings(profileSettings = null) {
  // Prioritize profile settings from database
  if (profileSettings) {
    return { ...DEFAULT_MASCOT_SETTINGS, ...profileSettings };
  }
  // Fallback to localStorage
  try {
    const stored = localStorage.getItem("mascotSettings");
    if (stored) {
      return { ...DEFAULT_MASCOT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Error reading mascot settings:", e);
  }
  return DEFAULT_MASCOT_SETTINGS;
}

// Check if welcome cooldown has passed (1 hour)
export function canShowWelcome() {
  try {
    const lastWelcome = localStorage.getItem("mascotLastWelcome");
    if (!lastWelcome) return true;

    const lastTime = parseInt(lastWelcome, 10);
    const oneHour = 60 * 60 * 1000; // 1 hour in ms
    return Date.now() - lastTime > oneHour;
  } catch (e) {
    return true;
  }
}

// Mark welcome as shown
function markWelcomeShown() {
  localStorage.setItem("mascotLastWelcome", Date.now().toString());
}

export function Mascot({
  isMobile = false,
  onCloseMobileMenu,
  profileSettings = null,
}) {
  const [isEmoting, setIsEmoting] = useState(false);
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [settings, setSettings] = useState(() =>
    getMascotSettings(profileSettings)
  );

  // Sync with profile settings changes (from database)
  useEffect(() => {
    if (profileSettings) {
      setSettings({ ...DEFAULT_MASCOT_SETTINGS, ...profileSettings });
    }
  }, [profileSettings]);

  // Refs for timers and state
  const timerRef = useRef(null);
  const autoMessageRef = useRef(null);
  const messageTimeoutRef = useRef(null);
  const hasTriedWelcome = useRef(false);
  const isEmotingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Keep isEmotingRef in sync with state
  useEffect(() => {
    isEmotingRef.current = isEmoting;
  }, [isEmoting]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Listen for settings changes
  useEffect(() => {
    function handleSettingsChange() {
      setSettings(getMascotSettings());
    }

    window.addEventListener("mascotSettingsChanged", handleSettingsChange);
    return () =>
      window.removeEventListener("mascotSettingsChanged", handleSettingsChange);
  }, []);

  // Core emote function - use ref to avoid stale closures
  const showEmote = useCallback(
    (msg, isWelcome = false) => {
      if (!isMountedRef.current) return;
      if (isEmotingRef.current) return;

      setMessage(msg);
      setIsEmoting(true);
      isEmotingRef.current = true;
      setShowMessage(true);

      messageTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setShowMessage(false);
        setIsEmoting(false);
        isEmotingRef.current = false;

        if (isWelcome && isMobile && onCloseMobileMenu) {
          onCloseMobileMenu();
        }
      }, 7400);
    },
    [isMobile, onCloseMobileMenu]
  );

  // Public triggerEmote for click handlers and intervals
  const triggerEmote = useCallback(
    (customMessage = null, isWelcome = false) => {
      if (!settings.enabled) return;

      const msg =
        customMessage ||
        CUTE_MESSAGES[Math.floor(Math.random() * CUTE_MESSAGES.length)];
      showEmote(msg, isWelcome);
    },
    [settings.enabled, showEmote]
  );

  // Show welcome message on mount - ONLY RUNS ONCE
  useEffect(() => {
    // Skip if already tried
    if (hasTriedWelcome.current) return;

    // Check conditions
    if (!settings.enabled || !settings.showWelcome) return;
    if (!canShowWelcome()) return;

    // Mark as tried BEFORE scheduling timeout
    hasTriedWelcome.current = true;

    // Delay for mobile (menu needs to open) vs desktop
    const delay = isMobile ? 800 : 500;

    setTimeout(() => {
      if (!isMountedRef.current) return;

      const welcomeMsg =
        WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];

      if (isEmotingRef.current) return;

      setMessage(welcomeMsg);
      setIsEmoting(true);
      isEmotingRef.current = true;
      setShowMessage(true);
      markWelcomeShown();

      messageTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setShowMessage(false);
        setIsEmoting(false);
        isEmotingRef.current = false;

        if (isMobile && onCloseMobileMenu) {
          onCloseMobileMenu();
        }
      }, 7400);
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - ONLY run on mount

  // Start auto message interval
  useEffect(() => {
    if (!settings.enabled) return;

    autoMessageRef.current = setInterval(() => {
      triggerEmote();
    }, settings.autoMessageInterval * 1000);

    return () => {
      if (autoMessageRef.current) clearInterval(autoMessageRef.current);
    };
  }, [settings.enabled, settings.autoMessageInterval, triggerEmote]);

  // Idle timer - triggers after idle timeout
  useEffect(() => {
    if (!settings.enabled) return;

    function startIdleTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        triggerEmote();
      }, settings.idleTimeout * 1000);
    }

    function handleActivity() {
      startIdleTimer();
    }

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    startIdleTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [settings.enabled, settings.idleTimeout, triggerEmote]);

  // Don't render if disabled
  if (!settings.enabled) return null;

  return (
    <div
      className={`flex flex-col items-center gap-1 pointer-events-none ${
        isMobile ? "justify-end" : "fixed bottom-4 left-4 z-50"
      }`}
    >
      {/* Pixelated Speech Bubble */}
      {showMessage && (
        <div
          className="relative bg-white dark:bg-slate-800 border-4 border-black dark:border-white px-4 py-2 max-w-[200px] animate-bounce-in"
          style={{
            imageRendering: "pixelated",
            fontFamily: "'Courier New', monospace",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.3)",
          }}
        >
          <p
            className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight"
            style={{
              fontFamily: "'Courier New', monospace",
              textRendering: "optimizeSpeed",
            }}
          >
            {message}
          </p>
          {/* Speech bubble tail */}
          <div
            className="absolute -bottom-3 left-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-b-4 border-r-4 border-black dark:border-white"
            style={{
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}

      {/* Minecraft-style Nametag - moves up when message is showing */}
      <div
        className={`px-3 py-1 bg-black/70 text-white text-sm font-bold rounded transition-all duration-500 ease-out ${
          showMessage ? "" : "translate-y-1"
        }`}
        style={{
          fontFamily: "'Courier New', monospace",
          textShadow: "1px 1px 0 #000",
        }}
      >
        Karl
      </div>

      {/* Mascot Image with smooth transitions */}
      <img
        src={isEmoting ? mascotEmote : mascotIdle}
        alt="Karl the Mascot"
        className={`w-24 h-24 object-contain drop-shadow-lg pointer-events-auto cursor-pointer transition-all duration-500 ease-out ${
          isMobile ? "scale-x-[-1]" : ""
        } ${isEmoting ? "scale-110" : "scale-100 hover:scale-110"}`}
        style={{ imageRendering: "auto" }}
        onClick={() => {
          if (!isEmoting) triggerEmote();
        }}
        title="Click me for a surprise!"
      />

      {/* Custom animation styles */}
      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
