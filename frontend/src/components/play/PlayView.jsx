// frontend/src/views/play/PlayView.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchDeckState } from "../../api/library"; // ../../ because we're in /views/play/

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// Convert A-Z, a-z, 0-9 into bold Unicode characters
function toUnicodeBold(str) {
  if (!str) return "";
  const boldChar = (ch) => {
    const code = ch.codePointAt(0);
    // A–Z
    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(code + 119743);
    }
    // a–z
    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(code + 119737);
    }
    // 0–9
    if (code >= 48 && code <= 57) {
      return String.fromCodePoint(code + 120734);
    }
    return ch;
  };
  return Array.from(str).map(boldChar).join("");
}

// Convert normal text into "tiny" / small-caps Unicode for the deck footer
function toTinyText(str) {
  if (!str) return "";

  const map = {
    a: "ᴀ",
    b: "ʙ",
    c: "ᴄ",
    d: "ᴅ",
    e: "ᴇ",
    f: "ғ",
    g: "ɢ",
    h: "ʜ",
    i: "ɪ",
    j: "ᴊ",
    k: "ᴋ",
    l: "ʟ",
    m: "ᴍ",
    n: "ɴ",
    o: "ᴏ",
    p: "ᴘ",
    q: "ǫ",
    r: "ʀ",
    s: "s", // small-cap s looks weird, regular s is fine
    t: "ᴛ",
    u: "ᴜ",
    v: "ᴠ",
    w: "ᴡ",
    x: "x",
    y: "ʏ",
    z: "ᴢ",
  };

  return Array.from(str)
    .map((ch) => {
      const lower = ch.toLowerCase();
      if (map[lower]) return map[lower];
      return ch; // keep spaces, punctuation, etc.
    })
    .join("");
}

export default function PlayView() {
  const [categories, setCategories] = useState([]);
  const [decks, setDecks] = useState([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState([]);
  const [randomCount, setRandomCount] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Game state: pool of cards built from selected decks
  const [isPlaying, setIsPlaying] = useState(false);
  const [basePool, setBasePool] = useState([]); // unshuffled pool
  const [originalRun, setOriginalRun] = useState([]); // last shuffled run
  const [remaining, setRemaining] = useState([]); // what’s left to draw
  const [copied, setCopied] = useState(false);

  // ---------- Load deck state from backend ----------
  const loadDeckState = async () => {
    try {
      setLoading(true);
      setError("");
      const state = await fetchDeckState();
      const cats = state && state.categories ? state.categories : [];
      const ds = state && state.decks ? state.decks : [];

      setCategories(cats);
      setDecks(ds);

      // If nothing is selected yet, default to "all decks"
      if (selectedDeckIds.length === 0 && ds.length > 0) {
        setSelectedDeckIds(ds.map((d) => d.id));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load decks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeckState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Helpers for categories / decks ----------
  const allCategories = useMemo(() => {
    const explicit = categories || [];
    const hasUncat = explicit.includes("Uncategorized");
    return hasUncat ? explicit : ["Uncategorized", ...explicit];
  }, [categories]);

  const decksByCategory = (cat) =>
    decks.filter((d) => (d.category || "Uncategorized") === cat);

  const isDeckSelected = (id) => selectedDeckIds.includes(id);

  const toggleDeck = (id) => {
    setSelectedDeckIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCategory = (cat) => {
    const inCat = decksByCategory(cat).map((d) => d.id);
    if (inCat.length === 0) return;

    setSelectedDeckIds((prev) => {
      const allSelected = inCat.every((id) => prev.includes(id));
      if (allSelected) {
        // unselect all in that category
        return prev.filter((id) => !inCat.includes(id));
      }
      // select all in that category (union)
      const next = new Set(prev);
      inCat.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const clearSelection = () => {
    setSelectedDeckIds([]);
  };

  const selectAll = () => {
    setSelectedDeckIds(decks.map((d) => d.id));
  };

  const randomizeSelection = () => {
    const n = parseInt(randomCount || "0", 10);
    if (!Number.isFinite(n) || n <= 0) {
      window.alert("Enter how many decks you want to randomly select.");
      return;
    }
    if (decks.length === 0) return;

    const allIds = decks.map((d) => d.id);
    const needed = Math.min(n, allIds.length);

    const shuffled = shuffleArray(allIds);
    setSelectedDeckIds(shuffled.slice(0, needed));
  };

  // ---------- Build card pool from selected decks ----------
  const buildCardPoolFromSelection = () => {
    const pool = [];
    decks.forEach((deck) => {
      if (!selectedDeckIds.includes(deck.id)) return;
      if (!Array.isArray(deck.cards) || deck.cards.length === 0) return;

      deck.cards.forEach((card) => {
        pool.push({
          ...card,
          deckName: deck.name,
        });
      });
    });
    return pool;
  };

  // ---------- Game controls ----------
  const beginPlay = () => {
    if (selectedDeckIds.length === 0) {
      window.alert("Select at least one deck first.");
      return;
    }

    const pool = buildCardPoolFromSelection();
    if (!pool.length) {
      window.alert(
        "The selected decks don't have any stored cards.\n" +
          "Try re-importing your Google Sheet decks from the Manage tab."
      );
      return;
    }

    const shuffled = shuffleArray(pool);
    setIsPlaying(true);
    setBasePool(pool); // store unshuffled
    setOriginalRun(shuffled); // store one shuffled run (optional)
    setRemaining(shuffled);
  };

  const stopPlay = () => {
    setIsPlaying(false);
    setRemaining([]);
  };

  const reloadPlay = () => {
    // Reshuffle the base pool instead of reusing originalRun
    const pool =
      basePool && basePool.length ? basePool : buildCardPoolFromSelection();
    if (!pool || !pool.length) return;

    const shuffled = shuffleArray(pool);
    setIsPlaying(true);
    setOriginalRun(shuffled);
    setRemaining(shuffled);
  };

  const drawCard = () => {
    if (!isPlaying || remaining.length === 0) return;
    // Remove the first card from the pool
    setRemaining((prev) => prev.slice(1));
  };

  const skipCard = () => {
    if (!isPlaying || remaining.length <= 1) return;
    // Move the first card to the back of the pool
    setRemaining((prev) => {
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  };

  const currentCard = remaining && remaining.length > 0 ? remaining[0] : null;

  // For preview text if we don't have a real card yet
  const previewWord = currentCard
    ? currentCard.word
    : isPlaying
    ? "No cards left in this run."
    : "Word will appear here once play starts";

  // ---------- Copy / paste box ----------
  const buildCopyText = () => {
    if (!currentCard) {
      return `TABOO CARD CONTENT WILL GO HERE\n(Current card: ${previewWord})`;
    }

    const boldWord = toUnicodeBold(currentCard.word || "");
    const tabooLine =
      currentCard.taboo && currentCard.taboo.length
        ? currentCard.taboo.map((t) => toUnicodeBold(t)).join(" | ")
        : toUnicodeBold("(none)");

    const deckName = currentCard.deckName || "";
    const tinyDeckName = toTinyText(deckName);

    const lines = [];

    // Main code block
    lines.push("```");
    lines.push(`✅ GOAL WORD: ${boldWord}`);
    lines.push("");
    lines.push("❌ Don't say:");
    lines.push(tabooLine);
    lines.push("```");

    // Footer line, outside the code block
    if (deckName) {
      // no blank line here
      lines.push(`-# 🃏 ${tinyDeckName}`);
    }

    return lines.join("\n").trimEnd();
  };

  const handleCopyClick = async () => {
    const text = buildCopyText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    } catch (err) {
      console.error(err);
      window.alert("Could not copy to clipboard. You can still select the text.");
    }
  };

  const copyText = buildCopyText();

  return (
    <div className="page">
      <h1 className="page-title">Play Taboo</h1>

      <div className="play-layout">
        {/* LEFT/MIDDLE: card preview and controls */}
        <div className="play-main">
          {/* Card preview box */}
          <div className="card-preview-box">
            <div className="card-preview-title">Discord preview</div>

            <div
              style={{
                marginTop: 8,
                borderRadius: 8,
                padding: 12,
                background: "#020617",
                color: "#e5e7eb",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {copyText}
            </div>
          </div>

          {/* Draw / Skip row (D / K buttons) */}
          <div className="draw-skip-row">
            <button
              className="pill pill-green big-pill"
              onClick={drawCard}
              disabled={!isPlaying || remaining.length === 0}
            >
              D (Draw)
            </button>
            <button
              className="pill pill-red big-pill"
              onClick={skipCard}
              disabled={!isPlaying || remaining.length <= 1}
            >
              K (Skip)
            </button>
          </div>

          {/* Copy / paste block */}
          <div className="copy-block" onClick={handleCopyClick}>
            <div className="copy-block-header">
              {copied ? "Copied!" : "Copy / paste block (for Discord DM)"}
              <span className="copy-icon" title="Click to copy">
                ⧉
              </span>
            </div>
            {/* Make the whole orange box clickable; this div just shows text */}
            <div className="copy-block-textarea">{copyText}</div>
          </div>

          {/* Play / Stop / Reload buttons */}
          <div className="play-controls-row">
            <button className="pill pill-green big-pill" onClick={beginPlay}>
              P (Play)
            </button>
            <button className="pill pill-red big-pill" onClick={stopPlay}>
              S (Stop)
            </button>
            <button className="pill pill-yellow big-pill" onClick={reloadPlay}>
              R (Reload)
            </button>
          </div>

          {loading && <div className="play-status-row">Loading deck list…</div>}
          {error && <div className="play-status-row play-error">{error}</div>}
        </div>

        {/* RIGHT: deck selection column */}
        <div className="deck-panel">
          <div className="deck-panel-header">
            <div className="deck-panel-title">Deck list</div>
            <div className="deck-panel-actions">
              <button
                className="pill pill-outline small-pill"
                onClick={clearSelection}
              >
                Clear
              </button>
              <button
                className="pill pill-outline small-pill"
                onClick={selectAll}
              >
                Select all
              </button>
            </div>
          </div>

          {/* Randomize controls */}
          <div className="deck-random-row">
            <input
              className="random-input"
              type="number"
              min={1}
              placeholder="# decks"
              value={randomCount}
              onChange={(e) => setRandomCount(e.target.value)}
            />
            <button
              className="pill pill-outline small-pill"
              onClick={randomizeSelection}
            >
              Randomize
            </button>
          </div>

          {/* Scrollable deck list */}
          <div className="deck-list">
            {allCategories.map((cat) => {
              const decksForCat = decksByCategory(cat);
              if (decksForCat.length === 0) return null;

              const allInCatSelected =
                decksForCat.length > 0 &&
                decksForCat.every((d) => isDeckSelected(d.id));

              return (
                <div key={cat} className="deck-category-block">
                  <label className="deck-category-label">
                    <input
                      type="checkbox"
                      checked={allInCatSelected}
                      onChange={() => toggleCategory(cat)}
                    />
                    <span className="deck-category-name">{cat}</span>
                  </label>

                  <div className="deck-category-decks">
                    {decksForCat.map((deck) => (
                      <label
                        key={deck.id}
                        className="deck-item-row"
                        title={
                          typeof deck.card_count === "number"
                            ? `${deck.card_count} cards`
                            : "Deck"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isDeckSelected(deck.id)}
                          onChange={() => toggleDeck(deck.id)}
                        />
                        <span className="deck-item-name">
                          {deck.name}
                          {typeof deck.card_count === "number" && (
                            <span className="deck-item-meta">
                              {" "}
                              ({deck.card_count} cards)
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {decks.length === 0 && !loading && (
              <div className="deck-empty">
                No decks available. Import some in the Manage tab.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
