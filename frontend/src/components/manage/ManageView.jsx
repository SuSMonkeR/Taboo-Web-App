import { useEffect, useState } from "react";
import {
  fetchDeckState,
  importDeckFromUrl,
  createCategory,
  deleteCategory,
  moveDeck,
  deleteDeck,
} from "../../api/library";

/* ======================================================
   Delete Category Modal Component
====================================================== */
function DeleteCategoryModal({ categories, onConfirm, onCancel }) {
  const [selected, setSelected] = useState("");

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Delete Category</h2>

        <p style={{ marginBottom: "10px" }}>
          Select a category to delete.  
          <br />
          Decks inside it will move back to <b>Uncategorized</b>.
        </p>

        <select
          className="modal-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="" disabled>
            Choose category
          </option>

          {categories
            .filter((c) => c !== "Uncategorized")
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>

        <div className="modal-buttons">
          <button
            className="pill pill-red"
            disabled={!selected}
            onClick={() => onConfirm(selected)}
          >
            Delete
          </button>

          <button className="pill pill-outline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   MAIN COMPONENT
====================================================== */

export default function ManageView() {
  const [categories, setCategories] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState(null);

  // NEW STATE FOR DELETE MODAL
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /* ---------------- Load State ---------------- */
  const loadState = async () => {
    try {
      setLoading(true);
      setError("");
      const state = await fetchDeckState();
      setCategories(state.categories || []);
      setDecks(state.decks || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load decks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  /* ---------------- Import Deck ---------------- */
  const handleImportGoogle = async () => {
    const url = window.prompt("Paste Google Sheets / CSV URL:");
    if (!url) return;

    const name = window.prompt(
      "Name for this deck (e.g. 'Disney princess cards'):"
    );
    if (name === null) return;

    const tabooStr = window.prompt(
      "How many taboo words per card does this deck use? (e.g. 4)"
    );
    if (tabooStr === null) return;

    const tabooNum = parseInt(tabooStr, 10);
    if (!Number.isFinite(tabooNum) || tabooNum < 1) {
      window.alert(
        "Please enter a valid number (1 or more) for taboo words per card."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      // Pass tabooNum through to the backend
      const state = await importDeckFromUrl(url, name, null, tabooNum);
      setCategories(state.categories || []);
      setDecks(state.decks || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to import deck.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Reload ---------------- */
  const handleReload = () => {
    loadState();
  };

  /* ---------------- Create Category ---------------- */
  const handleAddCategory = async () => {
    const name = window.prompt("New category name:");
    if (!name) return;

    try {
      setLoading(true);
      setError("");
      const state = await createCategory(name);
      setCategories(state.categories || []);
      setDecks(state.decks || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to add category.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Delete Category ---------------- */
  const handleDeleteCategory = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteCategory = async (name) => {
    try {
      setLoading(true);
      setError("");
      const state = await deleteCategory(name);
      setCategories(state.categories || []);
      setDecks(state.decks || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete category.");
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  /* ---------------- Move Deck ---------------- */
  const handleSelectCategory = async (deckId, category) => {
    try {
      setLoading(true);
      setError("");
      const state = await moveDeck(deckId, category);
      setCategories(state.categories || []);
      setDecks(state.decks || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to move deck.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Delete Deck ---------------- */
  const handleDeleteDeck = async (deckId) => {
    if (!window.confirm("Delete this deck? This cannot be undone.")) return;

    try {
      setLoading(true);
      setError("");
      const state = await deleteDeck(deckId);
      setCategories(state.categories || []);
      setDecks(state.decks || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete deck.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Drag Events ---------------- */
  const handleDragStart = (e, deckId) => {
    setDraggingId(deckId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", deckId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleDropOnCategory = async (e, category) => {
    e.preventDefault();
    const deckId = e.dataTransfer.getData("text/plain") || draggingId;
    if (!deckId) return;

    await handleSelectCategory(deckId, category);
    setDraggingId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  /* ---------------- Helpers ---------------- */
  const decksByCategory = (category) =>
    decks.filter((d) => (d.category || "Uncategorized") === category);

  const allCategories = categories.includes("Uncategorized")
    ? categories
    : ["Uncategorized", ...categories];

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="page">
      <h1 className="page-title">Manage decks</h1>

      {/* --- Toolbar --- */}
      <div className="manage-toolbar">
        <button className="pill pill-green" onClick={handleImportGoogle}>
          Import from Google Sheets
        </button>

        <button
          className="pill pill-outline"
          onClick={() => window.alert("CSV upload not wired yet.")}
        >
          Upload CSV
        </button>

        <button className="pill pill-yellow" onClick={handleReload}>
          Reload decks
        </button>
      </div>

      {/* --- Category Controls --- */}
      <div className="manage-toolbar" style={{ marginTop: 12 }}>
        <button className="pill pill-outline" onClick={handleAddCategory}>
          + Add category
        </button>

        <button className="pill pill-red" onClick={handleDeleteCategory}>
          Delete category
        </button>

        {loading && <span style={{ marginLeft: 12 }}>Loading…</span>}
        {error && (
          <span style={{ marginLeft: 12, color: "#f97373" }}>{error}</span>
        )}
      </div>

      {/* --- Category Columns --- */}
      <div className="manage-layout" style={{ marginTop: 16 }}>
        {allCategories.map((cat) => (
          <div
            key={cat}
            className="category-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnCategory(e, cat)}
          >
            <div className="category-header">{cat}</div>

            <div className="category-decks">
              {decksByCategory(cat).length === 0 ? (
                <div className="deck-row placeholder">(No decks)</div>
              ) : (
                decksByCategory(cat).map((deck) => (
                  <div
                    key={deck.id}
                    className={
                      "deck-row" +
                      (draggingId === deck.id ? " deck-row-dragging" : "")
                    }
                    draggable
                    onDragStart={(e) => handleDragStart(e, deck.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="deck-left">
                      <span className="drag-handle">⋮⋮</span>
                      <div className="deck-title">
                        {deck.name}{" "}
                        <span className="deck-meta">
                          ({deck.card_count} cards)
                        </span>
                      </div>
                    </div>

                    <div className="deck-actions">
                      {deck.source && (
                        <button
                          className="pill pill-outline"
                          onClick={() => window.open(deck.source, "_blank")}
                          title="Open original Google Sheet / CSV"
                        >
                          Sheet
                        </button>
                      )}

                      <select
                        className="category-select"
                        value={deck.category || "Uncategorized"}
                        onChange={(e) =>
                          handleSelectCategory(deck.id, e.target.value)
                        }
                      >
                        {allCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <button
                        className="pill pill-red"
                        onClick={() => handleDeleteDeck(deck.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- DELETE CATEGORY MODAL (if open) --- */}
      {showDeleteModal && (
        <DeleteCategoryModal
          categories={categories}
          onConfirm={confirmDeleteCategory}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
