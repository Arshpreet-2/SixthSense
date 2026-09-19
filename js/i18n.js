/* SixthSense — Hindi for the main screens.
   Applied at render time to text only (never inside tags or attributes).
   Anything not listed stays in English, so nothing breaks if a string changes. */
"use strict";

const HI = {
  // navigation and shell
  "Home": "होम", "Map": "मैप", "Audit": "ऑडिट", "Connect": "कनेक्ट",
  "Back": "वापस", "Done": "हो गया", "Save": "सेव करें", "Cancel": "रद्द करें", "Try again": "फिर कोशिश करें",
  // sign in
  "Sign in": "साइन इन", "Email": "ईमेल", "Send me a sign-in link": "साइन-इन लिंक भेजें",
  "Continue with Google": "Google से जारी रखें", "Create an account": "नया खाता बनाएँ",
  "Try the demo account": "डेमो खाता आज़माएँ", "Stay signed in on this phone": "इस फ़ोन पर साइन इन रहें",
  "Your Silent Protector": "आपका ख़ामोश रक्षक", "Switch theme": "थीम बदलें",
  // home
  "Welcome back": "वापसी पर स्वागत है", "Demo account": "डेमो खाता",
  "SixthSense Agent is ready": "SixthSense एजेंट तैयार है",
  "SixthSense Agent is with you": "SixthSense एजेंट आपके साथ है",
  "Emergency": "आपातकाल", "Press and hold for 2 seconds": "2 सेकंड दबाकर रखें",
  "Call 112": "112 पर कॉल करें", "Women helpline 1091": "महिला हेल्पलाइन 1091", "Details": "विवरण",
  "Safe Travel": "सुरक्षित यात्रा", "Compare your routes": "अपने रास्तों की तुलना करें",
  "One tap, one safer street": "एक टैप, एक सुरक्षित सड़क",
  "My Halo": "मेरा हेलो", "Points, badges, impact": "अंक, बैज, असर",
  "Help Center": "सहायता केंद्र", "Explore resources": "संसाधन देखें",
  "Ask": "पूछें", "Angels": "एंजल्स", "My": "मेरे", "Guardians": "गार्जियन", "Live": "लाइव", "Signals": "सिग्नल",
  "Safety Around You": "आपके आसपास सुरक्षा", "Safety Measures": "सुरक्षा उपाय", "Swipe": "स्वाइप करें",
  // safe travel
  "Starting point": "कहाँ से", "Destination": "कहाँ जाना है", "Current Location": "मौजूदा स्थान",
  "Where do you want to go?": "आप कहाँ जाना चाहती हैं?", "Swap": "बदलें",
  "When are you leaving?": "आप कब निकल रही हैं?", "Now": "अभी", "In 30 min": "30 मिनट में",
  "Tomorrow morning": "कल सुबह", "How are you travelling?": "आप कैसे जा रही हैं?",
  "Compare all": "सब देखें", "Walking": "पैदल", "Auto or cab": "ऑटो या कैब", "Metro + walk/auto": "मेट्रो + पैदल/ऑटो",
  "Compare routes": "रास्तों की तुलना करें", "I have my own scooter or car": "मेरे पास अपनी स्कूटी या कार है",
  // routes
  "Choose your route": "अपना रास्ता चुनें", "Recommended": "सुझाया गया",
  "How we compare routes": "हम रास्तों की तुलना कैसे करते हैं", "Compare": "तुलना",
  "See the six senses": "छह इंद्रियाँ देखें", "Hide the six senses": "छह इंद्रियाँ छिपाएँ",
  "Ask Angels": "एंजल्स से पूछें", "Start Journey": "यात्रा शुरू करें",
  "How sure: high": "कितना पक्का: ज़्यादा", "How sure: medium": "कितना पक्का: ठीक-ठाक", "How sure: low": "कितना पक्का: कम",
  "Free": "मुफ़्त", "min": "मिनट", "Show street light on this route": "इस रास्ते की स्ट्रीट लाइट दिखाएँ",
  // journey
  "Journey Active": "यात्रा चल रही है", "left": "बाकी", "complete": "पूरा",
  "Are you okay?": "क्या आप ठीक हैं?", "I'm fine": "मैं ठीक हूँ", "Uneasy": "असहज", "Worried": "चिंतित", "Danger": "ख़तरा",
  "What the agent did": "एजेंट ने क्या किया", "Play demo walk": "डेमो वॉक चलाएँ", "Stop demo walk": "डेमो वॉक रोकें",
  "Help QR": "मदद QR", "End Journey": "यात्रा समाप्त करें", "Trip finished": "यात्रा पूरी हुई",
  "Audit this route": "इस रास्ते का ऑडिट करें",
  // sos
  "Emergency Mode Activated": "आपातकालीन मोड चालू",
  "Send alert with location": "स्थान के साथ अलर्ट भेजें", "Nearest help": "सबसे नज़दीकी मदद",
  "Navigate": "रास्ता दिखाएँ", "End emergency mode": "आपातकालीन मोड बंद करें",
  "Show help QR for people nearby": "आसपास के लोगों के लिए मदद QR दिखाएँ",
  // guardians
  "SMS Guardian": "SMS गार्जियन", "Voice Guardian": "वॉइस गार्जियन", "Camera Guardian": "कैमरा गार्जियन",
  "Your guardians": "आपके गार्जियन", "Activate Guardians": "गार्जियन चालू करें", "Pause": "रोकें",
  "Share my journeys with guardians": "अपनी यात्राएँ गार्जियन के साथ साझा करें",
  // audit
  "Create New Audit": "नया ऑडिट बनाएँ", "Quick audit with a photo": "फ़ोटो के साथ झटपट ऑडिट",
  "History": "इतिहास", "My Past Audits": "मेरे पिछले ऑडिट", "Audit logged": "ऑडिट दर्ज हुआ",
  "Confirmed": "पुष्ट", "Pending": "प्रतीक्षा में", "Being checked": "जाँच हो रही है", "Not confirmed": "पुष्ट नहीं",
  "Points": "अंक", "Audits": "ऑडिट",
  // connect
  "Need an Angel": "एंजल चाहिए", "Walk Together": "साथ चलें", "Angel Circles": "एंजल सर्कल",
  "Be an Angel": "एंजल बनें", "Community Forum": "कम्युनिटी फ़ोरम", "Post": "पोस्ट करें",
  // profile and settings
  "Profile": "प्रोफ़ाइल", "Verification": "सत्यापन", "Personal Details": "निजी जानकारी",
  "Emergency Contacts": "आपातकालीन संपर्क", "My journeys": "मेरी यात्राएँ",
  "What SixthSense learned": "SixthSense ने क्या सीखा", "Settings": "सेटिंग्स",
  "Switch account": "खाता बदलें", "Sign out": "साइन आउट", "Reset demo data": "डेमो डेटा रीसेट करें",
  "What data we use": "हम कौन-सा डेटा उपयोग करते हैं", "Language": "भाषा",
  "Alerts": "सूचनाएँ", "Halo, badges and rewards": "हेलो, बैज और इनाम",
};

// Longest first, so "Ask Angels" is replaced before "Ask"
const HI_KEYS = Object.keys(HI).sort((a, b) => b.length - a.length);
const HI_RE = new RegExp("(" + HI_KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");

/* Translate the text between tags only; attributes and markup are untouched */
function localize(html) {
  if (S.lang !== "hi") return html;
  return html.replace(/>([^<>]+)</g, (m, text) =>
    ">" + text.replace(HI_RE, k => HI[k]) + "<");
}
