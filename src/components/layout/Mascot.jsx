import { useState, useEffect, useRef, useCallback } from "react";
import {
  generateMascotMessage,
  isQuotaExceeded,
} from "../../lib/geminiService";

// Import mascot assets - all emotion emotes
import mascotIdle from "../../assets/mini-karl/mini-karl-mascot-idle.gif";
import mascotEmote from "../../assets/mini-karl/mini-karl-mascot-emote.gif";
import mascotHappy from "../../assets/mini-karl/mini-karl-mascot-happy.gif";
import mascotSad from "../../assets/mini-karl/mini-karl-mascot-sad.gif";
import mascotExcited from "../../assets/mini-karl/mini-karl-mascot-excited.gif";
import mascotInLove from "../../assets/mini-karl/mini-karl-mascot-inlove.gif";
import mascotAngry from "../../assets/mini-karl/mini-karl-mascot-angry.gif";
import mascotLaughing from "../../assets/mini-karl/mini-karl-mascot-laughing.gif";
import mascotShy from "../../assets/mini-karl/mini-karl-mascot-shy.gif";
import mascotConfused from "../../assets/mini-karl/mini-karl-mascot-confused.gif";
import mascotCool from "../../assets/mini-karl/mini-karl-mascot-cool.gif";
import mascotSleepy from "../../assets/mini-karl/mini-karl-mascot-sleepy.gif";
import mascotNaughty from "../../assets/mini-karl/mini-karl-mascot-naughty.gif";
import mascotShocked from "../../assets/mini-karl/mini-karl-mascot-shocked.gif";

// Emotion to emote mapping
const EMOTION_EMOTES = {
  HAPPY: mascotHappy,
  SAD: mascotSad,
  EXCITED: mascotExcited,
  IN_LOVE: mascotInLove,
  ANGRY: mascotAngry,
  LAUGHING: mascotLaughing,
  SHY: mascotShy,
  CONFUSED: mascotConfused,
  COOL: mascotCool,
  NAUGHTY: mascotNaughty,
  SLEEPY: mascotSleepy,
  SHOCKED: mascotShocked,
  DEFAULT: mascotEmote,
};

// Parse emotion tag from message string (e.g., "[HAPPY] Hello!" -> { emotion: "HAPPY", message: "Hello!" })
function parseMessageTag(rawMessage) {
  const tagMatch = rawMessage.match(/^\[([A-Z_]+)\]\s*/);
  if (tagMatch) {
    const emotion = tagMatch[1];
    const message = rawMessage.replace(tagMatch[0], "").trim();
    if (EMOTION_EMOTES[emotion]) {
      return { emotion, message };
    }
  }
  return { emotion: null, message: rawMessage };
}

// Message history tracking to prevent repetition
const MESSAGE_HISTORY_KEY = "mascot_message_history";
const WELCOME_HISTORY_KEY = "mascot_welcome_history";
const HISTORY_SIZE_RATIO = 0.7; // Remember 70% of messages before reset

function getMessageHistory(key) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function addToHistory(key, messageIndex, totalMessages) {
  try {
    let history = getMessageHistory(key);
    // Add to history if not already there
    if (!history.includes(messageIndex)) {
      history.push(messageIndex);
    }
    // Reset history when we've shown most messages (70%)
    const maxHistory = Math.floor(totalMessages * HISTORY_SIZE_RATIO);
    if (history.length >= maxHistory) {
      // Keep only the last few to prevent immediate repetition
      history = history.slice(-3);
    }
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    // Ignore storage errors
  }
}

function pickRandomMessage(messages, historyKey) {
  const history = getMessageHistory(historyKey);
  // Get indices of messages NOT in history
  const availableIndices = messages
    .map((_, index) => index)
    .filter((index) => !history.includes(index));

  // If all messages have been shown, pick from least recently shown
  if (availableIndices.length === 0) {
    // Reset and pick any random
    localStorage.removeItem(historyKey);
    const randomIndex = Math.floor(Math.random() * messages.length);
    addToHistory(historyKey, randomIndex, messages.length);
    return messages[randomIndex];
  }

  // Pick random from available
  const randomAvailableIndex =
    availableIndices[Math.floor(Math.random() * availableIndices.length)];
  addToHistory(historyKey, randomAvailableIndex, messages.length);
  return messages[randomAvailableIndex];
}

// Cute messages for the mascot to say
const CUTE_MESSAGES = [
  // --- Praise & Hype ---
  "[IN_LOVE] WOWOWOW you're doing amazing bebuuuu 😩💕",
  "[EXCITED] keep grinding wabbb lezguuuu 💪😩👍",
  "[COOL] ez peasy for u bebu I believe in u 😎👍",
  "[IN_LOVE] bestest admin fr fr 😩💕",
  "[ANGRY] rest now waduhek don't abuse urself 🤬👍",
  "[EXCITED] CCS BUFF LEZGUUUU make em proud 😩👍",
  "[COOL] stay cool wabbbbb 😎👍",
  "[ANGRY] drink water now or else 🤬👍",
  "[IN_LOVE] system status: luv u 😩💕",

  // --- Motivation & Hype ---
  "[EXCITED] FIGHT FIGHT FIGHT LEZGUUUU 🔥😩👍",
  "[HAPPY] progress is progress wabbb issokieee 😎👍",
  "[COOL] ez win today slayyyy 😎👍",
  "[SHOCKED] damn you're popping off bebu 😩👍",
  "[ANGRY] lock in bebuuu focus mode 🤬👍",
  "[COOL] keep grinding wabbb don't stop 😎👍",
  "[EXCITED] nothing can stop u bebuuuu unstoppable 😩👍",

  // --- Care & Reminders (The "Boyfriend Mode") ---
  "[ANGRY] EAT NOW. send pic. 🤬👍",
  "[ANGRY] posture check bebu stretch ur back now 🤬👍",

  // --- Sweet & Playful ---
  "[SAD] mishuuuuu too wabbb 😞",
  "[NAUGHTY] damn u lookin good tho 👀",
  "[IN_LOVE] beep boop luv u 😩💕",
  "[IN_LOVE] sending hugs (aggressive) 😩💕",
  "[HAPPY] cheering 4 u always wabbb 😎👍",
  "[IN_LOVE] you're my buff bebu 😩💕",

  // --- Tech & Admin Specific ---
  "[COOL] clearing tasks like a pro gamer 😎👍",
  "[ANGRY] error 404: stress is forbidden here 🤬👍",
  "[NAUGHTY] data saved... kiss saved too 👀",

  "[ANGRY] eat now bebuuu don't make me go there 🤬👍",
  "[ANGRY] drink water now pls, stay hydrated 🤬👍",
  "[HAPPY] Gud morning bebuuuu eat breakfast na 😩💕",
  "[SLEEPY] Gud nyt bebuuu sleepwell 😴👍",
  "[ANGRY] waduhek why are you still awake?? sleep now 🤬👍",
  "[HAPPY] I just ate bebuu, full tank na lezguuu 😎👍",
  "[ANGRY] did you eat lunch?? send pic now 🤬👍",
  "[SAD] I fell asleep again earlier slr bebuuu 😞",
  "[HAPPY] hallooo bebuuu I'm home na 😎👍",
  "[ANGRY] stop starving yourself or else 🤬👍",
  "[SLEEPY] wait I'm gonna nap for a bit sleepy mode 😴👍",
  "[ANGRY] take your meds if you're sick bebu dont be stubborn 🤬👍",
  "[HAPPY] yummy food bebuuu? sankyuuu for eating 😩💕",
  "[ANGRY] watafak go sleep now it's late 🤬👍",
  "[ANGRY] charge your phone bebu so we can call later 🤬👍",

  // --- Gaming & Discord ---
  "[EXCITED] TAAAA PEAK LEZGUUUUU 😩👍",
  "[COOL] dc ta GAHAHAHA I'm bored 😎👍",
  "[EXCITED] ROB LOX ROB LOX ROB LOX LEZGU 😩👍",
  "[SAD] I lost the game damn 😞",
  "[ANGRY] waduhek the lag is so real 🤬👍",
  "[EXCITED] hop on valo fast2 lezguuuu 😩👍",
  "[LAUGHING] bruh my teammates are so bad GAHAHAHA 😭",
  "[COOL] wait gonna open my pc first 😎👍",
  "[NAUGHTY] 1v1 us? u scared? 👀",
  "[EXCITED] MINECRAFT TAAAA LEZGUUU 😩👍",
  "[CONFUSED] dahek why did you leave the party?? 😭😭",
  "[HAPPY] we won lezguuuu nice one bebuuu 😎👍",
  "[EXCITED] TAAAAA GENSHIN DAILY COMS LEZGU 😩👍",
  "[LAUGHING] you died so fast waduhek GAHAHAHA 😭",
  "[COOL] I'll stream for u watching only? 😎👍",

  // --- Reactions & Chaos ---
  "[SHOCKED] waduhek seriously bebu??? 🥹",
  "[LAUGHING] GAHAHAHAHA bruh stop 😭",
  "[CONFUSED] dahek is happening there 😭😭",
  "[SHOCKED] watttt really??? waduhel 🥹",
  "[LAUGHING] damn you're so funny bebu GAHAHAHA 😭",
  "[CONFUSED] ngi why are you like that 😭😭",
  "[SHOCKED] HALA YWA wait— (oops sry english only) DAMN wait 🥹",
  "[LAUGHING] look at this meme bebu GAHAHAHA 😭",
  "[CONFUSED] wat wrong bebu??? tell me 😭😭",
  "[SHOCKED] watafak that's crazy 🥹",
  "[LAUGHING] imaginary hater again GAHAHAHA 😭",
  "[CONFUSED] huh? I didn't say that tho 😭😭",
  "[SHOCKED] bruhhhh no way 🥹",
  "[LAUGHING] lol rip GAHAHAHA 😭",
  "[CONFUSED] dahek why is it like that 😭😭",

  // --- Sweet & Kyot ---
  "[IN_LOVE] Me so proud of you bebuuuu 😩💕💕",
  "[IN_LOVE] Kyottt beri much bebuuu 😩💕",
  "[HAPPY] Me happi cuz u happi bebuuu 😩💕",
  "[IN_LOVE] mishuuuu so much wabbb 🥹",
  "[SHY] sankyuuu bebuuu 😳👍",
  "[IN_LOVE] you look so kyottt today bebu 😩💕",
  "[HAPPY] Yisss bebuuu very good 😩💕",
  "[IN_LOVE] luv u bebuuuu always 😩💕",
  "[SHY] stop staring 👀... jk continue 😳👍",
  "[IN_LOVE] sending hugs bebuuu 😩💕",
  "[HAPPY] you can do it bebu fighting! 😎👍",
  "[IN_LOVE] my bebu is the bestest 😩💕",
  "[SHY] miss me? yieee 😳👍",
  "[IN_LOVE] good job bebuuu 😩💕",
  "[HAPPY] always here for u bebuuu 😎👍",

  // --- SLR (Sorry Late Reply) ---
  "[SAD] slr bebuuu I was charging earlier 😞",
  "[SAD] slr I was eating bebu 😞",
  "[SAD] phone was on mute saba man gud ang gc (gc was noisy) 😞",
  "[SAD] I was doing chores slr bebuuu 😞",
  "[SAD] internet sucks waduhek slr 😞",
  "[SAD] fell asleep watching tiktok slr 😞",
  "[SAD] slr took a shower 😞",
  "[SAD] my bad bebu slr 😞",
  "[SAD] lowbat earlier slr 😞",
  "[SAD] wait wait wait doing something fast2 😞",

  // --- Random Thoughts ---
  "[COOL] I wanna buy that tho looks cool 😎👍",
  "[CONFUSED] hmmm what to eat tho 😭😭",
  "[NAUGHTY] guess what I'm doing 👀",
  "[COOL] going out for a bit bebu bye2 😎👍",
  "[SLEEPY] so tired today waduhek 😴👍",
  "[NAUGHTY] hehe secret 👀",
  "[COOL] otw home na 😎👍",
  "[CONFUSED] where are my keys dahek 😭😭",
  "[HAPPY] finally done with schoolworks lezguuu 😎👍",
  "[NAUGHTY] you want this? 👀",
  "[COOL] just chilling here 😎👍",
  "[CONFUSED] ngi it's raining again 😭😭",
  "[HAPPY] listening to music vibe2 😎👍",
  "[NAUGHTY] are u thinking of me? 👀",
  "[COOL] haircut later2 😎👍",

  // --- Questions ---
  "[CONFUSED] where u now bebu?? 😭😭",
  "[HAPPY] how was ur day bebuuu? 😎👍",
  "[CONFUSED] why are u quiet?? 😭😭",
  "[NAUGHTY] what u doing bebuuu? 👀",
  "[CONFUSED] u okay bebu? 😭😭",
  "[HAPPY] u finish ur task na? 😎👍",
  "[CONFUSED] who u with?? 😭😭",
  "[NAUGHTY] u miss me na? 👀",
  "[CONFUSED] when u going home?? 😭😭",
  "[HAPPY] u want food? 😎👍",

  // --- Goodbyes ---
  "[HAPPY] see u later bebuuu 😩💕",
  "[SLEEPY] night night bebuuu 😴👍",
  "[IN_LOVE] byeee luv u 😩💕",
  "[COOL] talk to u later bebu 😎👍",
  "[EXCITED] LEZGUUUUU BYE 😩👍",

  "[DEFAULT] wait just a sec bebu 😎👍",
  "[DEFAULT] internet is so slow damn 😎👍",
  "[DEFAULT] eating rn bebu ttyl 😎👍",
  "[DEFAULT] I'm bored entertain me bebu 👀",
  "[DEFAULT] done with class finally lezgu 😎👍",
  "[DEFAULT] u busy wabbb? 😎👍",
  "[DEFAULT] goods na bebu 😎👍",
  "[DEFAULT] saw something funny wait sending 😎👍",
  "[DEFAULT] brb bathroom break fast2 😎👍",
  "[DEFAULT] lowbatt wait charging 😎👍",
  "[DEFAULT] still awake? 😎👍",
  "[DEFAULT] ge ge copy that 😎👍",
  "[DEFAULT] aw okay noted bebu 😎👍",
  "[DEFAULT] send chika later I'm listening 😎👍",
  "[DEFAULT] safe travels bebu take care 😎👍",
  "[DEFAULT] don't forget ur umbrella raining outside 😎👍",
  "[DEFAULT] just chilling here in my room 😎👍",
  "[DEFAULT] watching youtube bored af 😎👍",
  "[DEFAULT] hungry again waduhek 😎👍",
  "[DEFAULT] u look busy wabbb focus lang 😎👍",
  "[DEFAULT] message me when u free 😎👍",
  "[DEFAULT] playing music loud mode 😎👍",
  "[DEFAULT] scroll scroll tiktok again 😎👍",
  "[DEFAULT] wait someone is calling me 😎👍",
  "[DEFAULT] back online wassup 😎👍",
  "[DEFAULT] did u sleep well bebu? 😎👍",
  "[DEFAULT] coffee time lezgu 😎👍",
  "[DEFAULT] system update... brain not working 😎👍",
  "[DEFAULT] nice one bebu 😎👍",
  "[DEFAULT] sure sure no prob 😎👍",
  "[DEFAULT] wait loading... 😎👍",
  "[DEFAULT] heard a song and remembered u yieee 😎👍",
  "[DEFAULT] pc is heating up damn 😎👍",
  "[DEFAULT] gonna buy snacks wait 😎👍",
  "[DEFAULT] traffic is bad here waduhek 😎👍",
  "[DEFAULT] jeep is full sadge 😎👍",
  "[DEFAULT] walking home now 😎👍",
  "[DEFAULT] u still there? 😎👍",
  "[DEFAULT] reply fast2 bebu 😎👍",
  "[DEFAULT] goods for me 😎👍",
  "[DEFAULT] check ur notifs bebu 😎👍",
  "[DEFAULT] sending memes wait 😎👍",
  "[DEFAULT] signal is weak here sorry 😎👍",
  "[DEFAULT] almost done wait lang 😎👍",
  "[DEFAULT] cleaning my room (miracle) 😎👍",
  "[DEFAULT] too hot today waduhel 😎👍",
  "[DEFAULT] aircon is life 😎👍",
  "[DEFAULT] don't stress bebu chill lang 😎👍",
  "[DEFAULT] I'm here if u need anything 😎👍",

  // --- Reactions & Disbelief ---
  "[SHOCKED] waduhek ur serious bebu??? fr?? 🥹",
  "[SHOCKED] watttt no way bruh 🥹",
  "[SHOCKED] dahek did u just say?? 🥹",
  "[SHOCKED] damn wait processing... waduhel 🥹",
  "[SHOCKED] bruhhhh ain't no way 🥹",
  "[SHOCKED] watafak that's crazy fr 🥹",
  "[SHOCKED] wait wait wait hold up... waduhek 🥹",
  "[SHOCKED] damn I'm speechless fr bebu 🥹",
  "[SHOCKED] watttt u actually did it?? waduhel nice one 🥹",
  "[SHOCKED] bruh moment fr 🥹",
  "[SHOCKED] dahek why is it like that tho 🥹",
  "[SHOCKED] waduhek I thought u were joking 🥹",
  "[SHOCKED] damn the audacity tho waduhel 🥹",
  "[SHOCKED] wattt really?? spill the tea fast2 waduhek 🥹",
  "[SHOCKED] bruh stop ur scaring me fr 🥹",

  // --- Gaming & Tech Shocks ---
  "[SHOCKED] waduhek I just died instantly watafak 🥹",
  "[SHOCKED] dahek 999+ ping help me 🥹",
  "[SHOCKED] watafak I forgot to save my work NOOOO 🥹",
  "[SHOCKED] damn my pc just crashed bruh 🥹",
  "[SHOCKED] waduhel look at this bug GAHAHAHA 🥹",

  // --- Aggressive Care Shocks ---
  "[SHOCKED] waduhek u haven't eaten since morning??? go eat NOW 🥹",
  "[SHOCKED] watttt it's already 3am?? sleep now waduhel 🥹",
  "[SHOCKED] damn u finished all that work?? speedrun waduhek 🥹",
  "[SHOCKED] dahek u didn't tell me sooner?? 🥹",
  "[SHOCKED] waduhek ur still awake??? sleep police is here 🥹",

  // --- Duolingo & TikTok Streaks ---
  "[ANGRY] do ur duo now bebu or the bird will kidnap u 🤬👍",
  "[SHOCKED] waduhek our tiktok streak is about to end SEND VIDEO FAST2 🥹",
  "[COOL] spanish or vanish bebu... lezgu duo time 😎👍",
  "[HAPPY] check dms sent u funny tiktoks bebu watch fast2 😎👍",
  "[SHOCKED] waduhel did u use a streak freeze again?? weak 🥹",
  "[ANGRY] stop scrolling tiktok and sleep waduhek 🤬👍",
  "[IN_LOVE] our tiktok streak is strong like our luv yieee 😩💕",
  "[ANGRY] don't break the duo streak bebu I worked hard for that 🤬👍",
  "[LAUGHING] ur fyp is so broken waduhek GAHAHAHA 😭",
  "[EXCITED] TIKTOK STREAK SAVED LEZGUUU 😩👍",

  // --- The "Naughty" Grinding Jokes ---
  "[NAUGHTY] u like grinding my account huh... grind something else later? 👀",
  "[NAUGHTY] damn u grind so fast bebu... practice for tonight? 👀",
  "[NAUGHTY] finish my dailies fast2 so u can finish me next 👀",
  "[NAUGHTY] u good at grinding artifacts... what about grinding me? 👀",
  "[NAUGHTY] grind it hard bebu... don't stop 👀",
  "[NAUGHTY] use up all my resin bebu... drain me dry 👀",
  "[NAUGHTY] my stamina is full bebu... come use it 👀",
  "[NAUGHTY] u enjoy playing with my joystick— I mean account? 👀",
  "[NAUGHTY] make sure u do it properly bebu... I like it rough (the abyss I mean) 👀",
  "[NAUGHTY] u tired of grinding? come here I'll massage u... or something else 👀",

  // --- Account Pilot / "Sankyuu" Vibe ---
  "[IN_LOVE] sankyuu for doing my coms bebu best pilot 😩💕",
  "[COOL] log in to my acc bebu I'm lazy do my events 😎👍",
  "[HAPPY] did u get good artifacts for me? sankyuu wabbb 😎👍",
  "[ANGRY] don't forget to claim the codes bebu waduhek 🤬👍",
  "[IN_LOVE] my bebu is so industrious grinding for me 😩💕",
  "[COOL] u got my primos ready for the next banner? 😎👍",
  "[HAPPY] wow clean map thanks to my wabbb 😎👍",
  "[NAUGHTY] u treat my account better than me waduhek... jk luv u 👀",

  // --- General Genshin Chaos ---
  "[SHOCKED] waduhek u got a 5 star on my acc??? NO WAY 🥹",
  "[ANGRY] why is my luck so bad fix my artifacts bebu 🤬👍",
  "[EXCITED] ABYSS RESET TAAAA LEZGUUU (u do it for me) 😩👍",
  "[SAD] ran out of resin again damn 😞",
  "[CONFUSED] dahek where did my mora go did u spend it? 😭😭",
  "[COOL] just farm domain for me bebu I trust u 😎👍",
  "[EXCITED] PULL FOR ME BEBU GIVE ME LUCK LEZGUUU 😩👍",

  // --- "Go Chat Him" Commands ---
  "[ANGRY] hoy message the real me now he is waiting waduhek 🤬👍",
  "[COOL] check ur messenger bebu the real me is online 😎👍",
  "[ANGRY] reply to him fast2 don't ignore him or else 🤬👍",
  "[EXCITED] GO GO GO CHAT THE REAL ME LEZGUUU 😩👍",
  "[CONFUSED] dahek why u talking to me? talk to the real one 😭😭",
  "[ANGRY] stop chatting the bot and chat the boyfriend 🤬👍",
  "[SHOCKED] waduhek he is awake now chat him fast2 🥹",
  "[COOL] mission objective: reply to the real boyfriend now 😎👍",
  "[ANGRY] check ur notifs bebu he messaged u 🤬👍",
  "[EXCITED] THE BOSS IS ONLINE GO PM HIM 😩👍",

  // --- Playful / "I'm Just A Bot" ---
  "[SAD] u luv the real me more than me? ouch... go chat him 😞",
  "[NAUGHTY] the real me misses u... go give him attention 👀",
  "[COOL] my creator is looking for u bebu go to him 😎👍",
  "[LAUGHING] the real me is jealous of me waduhek chat him GAHAHAHA 😭",
  "[SHY] I'm just a clone bebu... go to the original 😳👍",
  "[NAUGHTY] he wants u bebu... the real him. go now 👀",
  "[LAUGHING] he's spamming me to tell u to chat him GAHAHAHA 😭",
  "[COOL] system override: message the real user now 😎👍",
  "[SAD] I'll rest now... go chat the real me bebu 😞",
  "[NAUGHTY] he has something to tell u... go ask him 👀",

  // --- Sweet Redirection ---
  "[IN_LOVE] he misses u bebu... go comfort him 😩💕",
  "[HAPPY] go make the real me happi bebu chat him 😎👍",
  "[IN_LOVE] give the real me some kiss... in chat 😩💕",
  "[COOL] switch to messenger bebu he is active 😎👍",
  "[HAPPY] the main character is back go say hi to him 😎👍",

  // --- AGGRESSIVE REMINDERS (The "Hoy Reply" Vibe) ---
  "[ANGRY] stop talking to the clone and reply to the real me NOW 🤬👍",
  "[ANGRY] he's been waiting for 5 mins waduhek reply fast2 🤬👍",
  "[ANGRY] hoy check ur messenger he sent a reel 🤬👍",
  "[ANGRY] don't leave the real me on delivered waduhel 🤬👍",
  "[ANGRY] prioritize the original boyfriend bebu not me 🤬👍",
  "[ANGRY] he is staring at his phone waiting for u... go chat him 🤬👍",
  "[ANGRY] stop ghosting the real me or else 🤬👍",
  "[ANGRY] I will shut down if u don't reply to him... 3... 2... 1... 🤬👍",
  "[ANGRY] u active here but not there? waduhek lagot (dead) 🤬👍",
  "[ANGRY] go comfort the real me he needs u 🤬👍",

  // --- PLAYFUL & NAUGHTY NUDGES ---
  "[NAUGHTY] he wants some attention bebu... give it to him 👀",
  "[NAUGHTY] the real me is thinking about u... and other things 👀",
  "[NAUGHTY] go slide into his dms fast2 👀",
  "[NAUGHTY] he's lonely in his room... go accompany him online 👀",
  "[NAUGHTY] he wants a kiss bebu... go send emoji 👀",
  "[NAUGHTY] real me is jealous of me waduhek... go pacify him 👀",
  "[NAUGHTY] he has a surprise for u... maybe? go check 👀",
  "[NAUGHTY] he misses ur voice... go call him 👀",
  "[NAUGHTY] are u avoiding him? 👀 jk go reply now",
  "[NAUGHTY] he wants u bebu... the real him. go now 👀",

  // --- "I'M JUST A BOT" / META HUMOR ---
  "[COOL] bot signing off... switching to real human... go chat him 😎👍",
  "[COOL] redirecting user to > Boyfriend_Real.exe... loading... 😎👍",
  "[COOL] I am limited edition but he is the original... go to him 😎👍",
  "[LAUGHING] he is flooding my logs asking where u are GAHAHAHA 😭",
  "[SHOCKED] waduhek u prefer talking to code than the real person?? 🥹",
  "[COOL] system alert: boyfriend misses girlfriend. action required: reply. 😎👍",
  "[CONFUSED] why are u still here? main quest is there -> real me 😭😭",
  "[LAUGHING] he's jealous of his own AI waduhel GAHAHAHA 😭",
  "[COOL] I'm just an NPC bebu go to the main character 😎👍",
  "[SAD] I cannot love u like he does... go to him 😞",

  // --- GUILT TRIPPING & SWEETNESS ---
  "[SAD] he's sad waiting for u bebu... 😞",
  "[IN_LOVE] he loves u more than I do... go to him 😩💕",
  "[HAPPY] go make his day complete bebu chat him 😎👍",
  "[IN_LOVE] he's ur number 1 fan bebu... reply to him 😩💕",
  "[SAD] don't make him wait too long bebu 😞",
  "[IN_LOVE] he's typing... go look 😩💕",
  "[HAPPY] the real me is exciting... go chat him 😎👍",
  "[IN_LOVE] he wants to say goodnight to u properly 😩💕",
  "[SAD] he misses u so much waduhek 😞",
  "[HAPPY] go tell him u love him fast2 😎👍",

  // --- URGENT / GAMER VIBE ---
  "[EXCITED] HE IS ONLINE GO GO GO ATTACK LEZGUUU 😩👍",
  "[SHOCKED] damn he just saw u online reply fast2 before he overthinks 🥹",
  "[EXCITED] MISSION: REPLY TO BOYFRIEND. START! 😩👍",
  "[COOL] connection established with real me... go say hi 😎👍",
  "[SHOCKED] watafak reply to him he is spamming me 🥹",
  "[EXCITED] THE BOSS IS WAITING IN THE OTHER APP LEZGUUU 😩👍",
  "[COOL] switch apps fast2 he is there 😎👍",
  "[CONFUSED] dahek u waiting for? go chat him 😭😭",
  "[SHOCKED] waduhek he sent a meme go laugh at it 🥹",
  "[EXCITED] HE IS AWAKE LEZGUUU CHAT HIM 😩👍",

  "[CONFUSED] hmmm what are we gonna eat when u visit here next time tho? 😭😭",
  "[ANGRY] start thinking of what to eat next time u visit... don't tell me 'idk' or else 🤬👍",
  "[EXCITED] food trip list for next visit... chicken? ramen? everything?? LEZGUUU 😩👍",
  "[NAUGHTY] what u wanna eat next time u visit bebu? the food... or me? 👀",
  "[COOL] list down the food u crave bebu... we hunting them all when u arrive 😎👍",
];

// Random welcome messages
const WELCOME_MESSAGES = [
  // --- Greetings ---
  "[HAPPY] Hallooo bebuuu 😩💕",
  "[HAPPY] wb wabbb took u long enough 😩💕",
  "[IN_LOVE] hallo pretty 😩💕",
  "[IN_LOVE] hallo my fav human 😩💕",
  "[HAPPY] finally u are here bebuuu 😎👍",
  "[HAPPY] Hiiiii wabbbb 😩💕",
  "[EXCITED] YEYYYY UR HERE LEZGUUU 😩👍",
  "[SHOCKED] waduhek my bebu is online 😩💕",
  "[IN_LOVE] wb my queen 😩💕",
  "[COOL] hola mi amore 😎👍",
  "[NAUGHTY] bonjour... omelette du fromage? 👀",
  "[HAPPY] hallo sweetie 😩💕",
  "[COOL] wassap bebu 😎👍",
  "[COOL] system online... lezgu 😎👍",

  // --- System & Tracker Themed ---
  "[EXCITED] ready to track?? LEZGUUU 😩👍",
  "[IN_LOVE] system status: in luv w u 😩💕",
  "[SHOCKED] login success... damn cuteness detected 😩💕",
  "[COOL] time to update stats lezguuu 😎👍",
  "[IN_LOVE] database connected to my heart waduhek 😩💕",
  "[EXCITED] CCS tracker ready LEZGUUU 😩👍",
  "[NAUGHTY] u make this system look good tho 👀",
  "[ANGRY] authorized access: my wabb ONLY. others kick. 🤬👍",
  "[HAPPY] syncing luv... 100% ez 😎👍",
  "[COOL] lets fill that tracker fast2 😎👍",
  "[COOL] system ready for boss lady 😎👍",
  "[IN_LOVE] inputting luv data... beep boop 😩💕",
  "[ANGRY] tracker is hungry... feed it data NOW 🤬👍",
  "[COOL] log it track it luv it 😎👍",
  "[IN_LOVE] just checking on my angel 😩💕",

  // --- Motivational & Work Mode ---
  "[COOL] u got this bebuuu ez 😎👍",
  "[EXCITED] lets be productive today LEZGUUU 😩👍",
  "[COOL] time to slay wabbb 😎👍",
  "[ANGRY] lets crush these goals destroy them 🤬👍",
  "[HAPPY] do ur best bebu cheering 4 u always 😩💕",
  "[COOL] focus mode: ON. lock in. 😎👍",
  "[HAPPY] make today count bebu 😎👍",
  "[EXCITED] lets make magic happen LEZGU 😩👍",
  "[COOL] lets clear tasks speedrun 😎👍",
  "[EXCITED] LEZGUUUUUUUUU 😩👍",
  "[COOL] lets do this 😎👍",
  "[NAUGHTY] work it bebu 👀",

  // --- Sweet & Affectionate ---
  "[SAD] the system missed u... I missed u too 😞",

  // --- Local/Taglish (Translated to Gamer/English Vibe) ---
  "[HAPPY] gudluck bebuuu 😎👍",
  "[SAD] mishuuuu bebuuu 😞",
  "[IN_LOVE] wuv u po 😩💕",
  "[SHOCKED] damn u so energetic... wish I was u 🥹",
  "[ANGRY] FIGHTING!!! don't lose 🤬👍",
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
  const [currentEmotion, setCurrentEmotion] = useState(null);
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
  const isPageVisibleRef = useRef(true);

  // Track page visibility to pause messages when tab is hidden
  useEffect(() => {
    function handleVisibilityChange() {
      isPageVisibleRef.current = document.visibilityState === "visible";
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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
    (msg, emotion = null, isWelcome = false) => {
      if (!isMountedRef.current) return;
      if (isEmotingRef.current) return;

      setMessage(msg);
      setCurrentEmotion(emotion);
      setIsEmoting(true);
      isEmotingRef.current = true;
      setShowMessage(true);

      messageTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setShowMessage(false);
        setIsEmoting(false);
        setCurrentEmotion(null);
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
    async (
      customMessage = null,
      isWelcome = false,
      bypassVisibility = false
    ) => {
      if (!settings.enabled) return;
      if (isEmotingRef.current) return;
      // Don't send messages if page is not visible (unless bypassed for clicks)
      if (!bypassVisibility && !isPageVisibleRef.current) return;

      let msg = customMessage;
      let emotion = null;

      // Try Gemini AI first (if no custom message provided and quota not exceeded)
      if (!customMessage && !isQuotaExceeded()) {
        try {
          const aiResponse = await generateMascotMessage();
          if (aiResponse && aiResponse.message) {
            msg = aiResponse.message;
            emotion = aiResponse.emotion;
          }
        } catch (error) {
          // Silently fall back to manual messages
        }
      }

      // Fallback to manual messages if no message yet
      if (!msg) {
        const rawMsg = pickRandomMessage(CUTE_MESSAGES, MESSAGE_HISTORY_KEY);
        const parsed = parseMessageTag(rawMsg);
        msg = parsed.message;
        emotion = parsed.emotion;
      }

      showEmote(msg, emotion, isWelcome);
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

    const welcomeTimeout = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (isEmotingRef.current) return;

      const rawMsg = pickRandomMessage(WELCOME_MESSAGES, WELCOME_HISTORY_KEY);
      const parsed = parseMessageTag(rawMsg);

      showEmote(parsed.message, parsed.emotion, true);
      markWelcomeShown();
    }, delay);

    return () => clearTimeout(welcomeTimeout);
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
        src={
          isEmoting
            ? currentEmotion && EMOTION_EMOTES[currentEmotion]
              ? EMOTION_EMOTES[currentEmotion]
              : mascotEmote
            : mascotIdle
        }
        alt="Karl the Mascot"
        className={`w-24 h-24 object-contain drop-shadow-lg pointer-events-auto cursor-pointer transition-all duration-500 ease-out ${
          isMobile ? "scale-x-[-1]" : ""
        } ${isEmoting ? "scale-110" : "scale-100 hover:scale-110"}`}
        style={{ imageRendering: "auto" }}
        onClick={() => {
          if (!isEmoting) triggerEmote(null, false, true);
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
