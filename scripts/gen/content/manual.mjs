export function MANUAL(h) {
  const { H1, H2, LEAD, P, UL, KV, NOTE, WARN, C } = h;
  const meta = {
    title: "ENGRAM User Manual",
    docType: "User Manual",
    subtitle:
      "How to explore PYRI's mind and hold a conversation using the ENGRAM dashboard — on desktop or an Android phone.",
    version: "1.0",
    tag: "For Everyone",
    file: "04_ENGRAM_User_Manual.pdf",
    foot: "No technical background required. Keep this handy while you explore.",
  };

  const blocks = [
    H1("Welcome"),
    LEAD(
      "ENGRAM is a window into PYRI — an AI companion with a designed inner life. Unlike a plain chatbot, PYRI remembers, holds beliefs, has moods you can see, speaks in different styles, and can even reach out on her own. This manual walks you through every part of the dashboard and how to get the most from it.",
    ),
    P(
      "You do not need any technical knowledge. Each section below corresponds to a page in the app's navigation.",
    ),

    H1("Starting ENGRAM"),
    P(
      "If someone has already set ENGRAM up for you, just open the web address they gave you — often http://localhost:5000 — in your browser. If you are running it yourself, the project README describes a single command that starts everything on Windows, macOS, or Linux; once it is running, open that same address.",
    ),

    H1("Getting Around"),
    P(
      "On a computer, the menu sits in a sidebar down the left. Click any item to open that page. The current page is highlighted, and a status line at the bottom shows the system is online.",
    ),
    H2("Using ENGRAM on an Android phone"),
    P(
      "On a phone, the sidebar is tucked away to give you the full screen. Look for these:",
    ),
    UL([
      { h: "The menu button.", t: "Tap the lines icon in the top-left to slide the menu in. Tap any page and the menu closes automatically." },
      { h: "The conversation panel (in Chat).", t: "Tap the panel icon in the chat header to slide your conversation list in from the side, then tap a conversation to open it." },
      { h: "Everything scrolls.", t: "Pages are designed to fit a phone screen with no sideways scrolling — just scroll up and down." },
    ]),

    H1("The Hub"),
    P(
      "The Hub is your home screen. It shows live status at a glance: PYRI's active persona, how many memories and beliefs she holds, her average confidence, and a radar chart of her personality. Start here to see her current state before diving in.",
    ),

    H1("Chat"),
    LEAD("This is where you talk with PYRI. Replies stream in as she 'types'."),
    H2("Communication modes"),
    P(
      "PYRI can speak in seven different styles. Pick a mode when you start a conversation to set the tone:",
    ),
    UL([
      { h: "Informational", t: "clear, factual answers." },
      { h: "Alert", t: "urgent, to-the-point notices." },
      { h: "Tutorial", t: "patient, step-by-step teaching." },
      { h: "Companion", t: "warm and personable, with the most expressiveness." },
      { h: "Analyst", t: "structured, evidence-led reasoning." },
      { h: "Silent", t: "minimal words and no emotive flourishes." },
      { h: "Custom", t: "your own instructions for how she should respond." },
    ]),
    H2("Feeling her mood"),
    P(
      "In the more expressive modes, PYRI weaves small ASCII 'micro-expressions' into her replies so you can sense how she feels. She is most expressive in Companion mode and silent of them in Silent mode.",
    ),
    H2("Talking to a specific persona (engram)"),
    P(
      "You can choose one of PYRI's engrams to talk to directly. When you do, she sets the modes aside and answers fully in that character's voice and style.",
    ),
    H2("Bringing your own persona"),
    P(
      "You can upload a custom persona to chat with a character you define, without changing anything else in the app.",
    ),
    H2("Conversations are saved"),
    P(
      "Each chat is stored so you can return to it later. Start a new one with the plus button, switch between them in the conversation list, and pick up right where you left off.",
    ),
    NOTE(
      "Press Enter to send, and Shift+Enter to add a new line within your message.",
      "Quick tip",
    ),

    H1("Environment"),
    P(
      "The Environment page is where you shape how a persona behaves on its own. For each engram you can adjust:",
    ),
    UL([
      { h: "Autonomy", t: "turn self-initiated messages on or off." },
      { h: "Tick cadence", t: "how often the system checks whether the persona wants to speak." },
      { h: "Initiation threshold", t: "how much internal 'pressure' must build before she reaches out — lower means more talkative, higher means more reserved." },
      { h: "Focus themes", t: "the subjects on her mind that color what she brings up." },
    ]),
    P(
      "These settings let you tune a persona from quietly present to actively engaged.",
    ),

    H1("Inquiry"),
    LEAD("Inquiry lets you interview an engram — and, if you choose, help her grow."),
    UL([
      { h: "Probe", t: "ask a question and get an in-character answer. Nothing about her changes; it is a conversation, not an edit." },
      { h: "Develop", t: "request a change and watch her reflect, then adjust herself within safe limits — for example her mood, how often she initiates, or what she is focused on." },
    ]),
    P(
      "Pick an engram, choose Probe or Develop, type your question, and submit. Develop responses include the specific, bounded changes she made.",
    ),

    H1("Personality"),
    P(
      "Personality shows PYRI's core traits — curiosity, empathy, precision, humor, and more — as sliders and a radar chart. Drag a slider to recalibrate a trait, then save. Reset returns to the last saved values. Traits are bounded and revisable, so you can experiment freely.",
    ),

    H1("Memory"),
    P(
      "Memory is PYRI's six-layer knowledge store. Filter by layer — working, episodic, semantic, preference, reflective, or procedural — to see what she holds in each. Every memory shows its content, when it was formed, and a confidence indicator.",
    ),

    H1("Journal"),
    P(
      "The Journal is PYRI's reflective log: observations, inferences, and lessons she records as she operates. Browse entries to understand how she is making sense of her experience over time.",
    ),

    H1("Personas"),
    P(
      "Personas are the cognitive 'forms' PYRI can take, such as Archivist or Analyst. Each one favors a different way of remembering, reasoning, and speaking. Switching forms changes her style — but not her core identity, memories, or beliefs.",
    ),

    H1("Hiero-Code & the Expression Layer"),
    H2("Hiero-Code"),
    P(
      "Hiero-Code is PYRI's symbolic internal language. Each glyph stands for a concept. Select up to three glyphs to build a compound expression, and the page shows the combined meaning. Known compounds are listed for reference.",
    ),
    H2("Emotive Expression Layer"),
    P(
      "This is the library of ASCII micro-expressions PYRI uses to show feeling in chat. Each entry maps a small face-like glyph to a valence (positive, neutral, or negative) and an arousal level. Filter by valence or arousal to explore the vocabulary she draws on.",
    ),

    H1("Beliefs"),
    P(
      "The Belief Registry holds PYRI's working hypotheses — each with supporting evidence, counterarguments, a confidence score, and a revision history. Beliefs are meant to change as evidence accumulates, so you can watch her thinking mature.",
    ),

    H1("Evolution"),
    P(
      "The Evolution log is a transparent changelog of how PYRI has adapted: every adjustment, what triggered it, the evidence behind it, the expected impact, and how it was validated. Nothing changes without a record, so her growth is always inspectable.",
    ),

    H1("Analytics"),
    P(
      "Analytics gives a system-wide view: how memories are distributed across layers, the spread of beliefs, and a history of initiative events. Use it to understand PYRI's overall state and how it is shifting.",
    ),

    H1("Tips & Best Practices"),
    UL([
      "Check the Hub first to read PYRI's current mood and confidence before a conversation.",
      "Match the chat mode to your goal — Tutorial to learn, Analyst to reason through something, Companion to simply talk.",
      "Use Probe in Inquiry to understand a persona before using Develop to adjust her.",
      "Lower the initiation threshold in Environment if you want a persona to reach out more often.",
      "Revisit Evolution and Beliefs periodically to see what has changed.",
    ]),

    H1("Troubleshooting & FAQ"),
    KV([
      ["PYRI isn't replying", "Check that the app is online (status line) and that a model is configured; try sending again."],
      ["I can't find the menu on my phone", "Tap the lines icon in the top-left corner to open the navigation panel."],
      ["My conversation disappeared", "Open the conversation list (panel icon in Chat) — past chats are saved there."],
      ["She didn't reach out on her own", "Autonomy may be off or the threshold high; adjust both on the Environment page."],
      ["Did my trait change save?", "After moving a slider, press Save; Reset discards unsaved changes."],
    ]),

    H1("Glossary"),
    KV([
      ["Engram", "A persona with its own voice, mood, environment, memory, and drives."],
      ["Transmission", "A message a persona sends on its own initiative."],
      ["Drive", "An internal motivation that builds pressure over time until the persona acts."],
      ["Initiation threshold", "How much pressure is needed before a persona reaches out."],
      ["Mode", "The communication style PYRI uses in chat."],
      ["Belief", "A revisable, evidence-scored hypothesis PYRI holds."],
      ["Persona / form", "A cognitive style that changes how PYRI thinks and speaks."],
      ["Micro-expression", "A small ASCII glyph that conveys PYRI's feeling in chat."],
    ]),
  ];

  return { meta, blocks };
}
