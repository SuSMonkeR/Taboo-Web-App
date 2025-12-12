// frontend/src/views/manage/ManageView.jsx
import { useEffect, useState } from "react";
import {
  fetchDeckState,
  createCategory,
  deleteCategory,
  moveDeck,
  deleteDeck,
} from "../../api/library";
import {
  importWorkbook,
  fetchWorkbooks,
  reloadWorkbook,
  deleteWorkbook,
} from "../../api/workbooks";

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
  const [workbooks, setWorkbooks] = useState([]);
  const [flaggedDeckIds, setFlaggedDeckIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /* ---------------- Load State ---------------- */
  const loadState = async () => {
    try {
      setLoading(true);
      setError("");

      const [state, workbookList] = await Promise.all([
        fetchDeckState(),
        fetchWorkbooks().catch(() => []),
      ]);

      setCategories(state.categories || []);
      setDecks(state.decks || []);
      setWorkbooks(Array.isArray(workbookList) ? workbookList : []);
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

  /* ---------------- Import Workbook (Google Sheets) ---------------- */
  const handleImportGoogle = async () => {
    const url = window.prompt("Paste the Google Sheets URL for the workbook:");
    if (!url) return;

    try {
      setLoading(true);
      setError("");

      await importWorkbook(url);
      await loadState();

      window.alert("Workbook imported and decks updated.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to import workbook.");
      window.alert(`Failed to import workbook:\n${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Workbook actions ---------------- */

  const handleReloadWorkbook = async (workbookId) => {
    try {
      setLoading(true);
      setError("");
      await reloadWorkbook(workbookId);
      await loadState();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to reload workbook.");
    } finally {
      setLoading(false);
    }
  };

  const handleFlagWorkbook = (workbook) => {
    const deckIdsFromWorkbook = (workbook.tabs || [])
      .map((t) => t.deck_id)
      .filter(Boolean);

    const allFlagged =
      deckIdsFromWorkbook.length > 0 &&
      deckIdsFromWorkbook.every((id) => flaggedDeckIds.includes(id));

    if (allFlagged) {
      setFlaggedDeckIds([]);
    } else {
      setFlaggedDeckIds(deckIdsFromWorkbook);
    }
  };

  const handleDeleteWorkbook = async (workbookId) => {
    if (
      !window.confirm(
        "Delete this workbook and all decks that came from it? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await deleteWorkbook(workbookId);
      await loadState();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete workbook.");
    } finally {
      setLoading(false);
    }
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

  /* ---------------- Sorting helpers ---------------- */

  const getSortMode = (category) => sortConfig[category] || "alphaAsc";

  const handleChangeSort = (category, mode) => {
    setSortConfig((prev) => ({ ...prev, [category]: mode }));
  };

  const sortDecksForCategory = (category, items) => {
    const mode = getSortMode(category);
    const arr = [...items];

    if (mode === "alphaAsc") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (mode === "alphaDesc") {
      arr.sort((a, b) => b.name.localeCompare(a.name));
    } else if (mode === "cardAsc") {
      arr.sort((a, b) => (a.card_count || 0) - (b.card_count || 0));
    } else if (mode === "cardDesc") {
      arr.sort((a, b) => (b.card_count || 0) - (a.card_count || 0));
    }
    return arr;
  };

  /* ---------------- Helpers ---------------- */
  const decksByCategory = (category) => {
    const filtered = decks.filter(
      (d) => (d.category || "Uncategorized") === category
    );
    return sortDecksForCategory(category, filtered);
  };

  const allCategories = categories.includes("Uncategorized")
    ? categories
    : ["Uncategorized", ...categories];

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="page">
      <h1 className="page-title">Manage decks</h1>

      {/* --- Top toolbar --- */}
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
      </div>

      {/* --- Google workbooks "category" --- */}
      <div className="manage-layout" style={{ marginTop: 16 }}>
        <div className="category-column workbooks-column">
          <div className="category-header-row">
            <div className="category-header">Google workbooks</div>
          </div>

          <div className="category-decks">
            {workbooks.length === 0 ? (
              <div className="deck-row placeholder">
                (No workbooks yet — use “Import from Google Sheets” above.)
              </div>
            ) : (
              workbooks.map((wb) => {
                const mongoId = wb._id || wb.id;
                const tabCount = (wb.tabs || []).length;
                const deckCount = (wb.tabs || []).filter((t) => t.deck_id)
                  .length;
                const deckTotal = deckCount || tabCount;

                const sheetUrl = wb.workbook_id
                  ? `https://docs.google.com/spreadsheets/d/${wb.workbook_id}/edit`
                  : null;

                const deckIdsFromWorkbook = (wb.tabs || [])
                  .map((t) => t.deck_id)
                  .filter(Boolean);

                const flagged =
                  deckIdsFromWorkbook.length > 0 &&
                  deckIdsFromWorkbook.every((id) =>
                    flaggedDeckIds.includes(id)
                  );

                return (
                  <div
                    key={mongoId}
                    className={
                      "deck-row workbook-row" +
                      (flagged ? " deck-row-flagged" : "")
                    }
                  >
                    <div className="deck-left workbook-left">
                      <div className="deck-title">
                        {wb.name}{" "}
                        <span className="deck-meta">
                          ({deckTotal} deck{deckTotal === 1 ? "" : "s"})
                        </span>
                      </div>
                    </div>

                    <div className="deck-actions workbook-actions">
                      {sheetUrl && (
                        <button
                          className="pill pill-outline small-pill"
                          onClick={() => window.open(sheetUrl, "_blank")}
                          title="Open workbook in Google Sheets"
                        >
                          Sheet
                        </button>
                      )}

                      <button
                        className="pill pill-cyan small-pill"
                        onClick={() => handleFlagWorkbook(wb)}
                        title="Highlight decks from this workbook"
                      >
                        Flag decks
                      </button>

                      <button
                        className="pill pill-yellow small-pill"
                        onClick={() => handleReloadWorkbook(mongoId)}
                      >
                        Reload
                      </button>

                      <button
                        className="pill pill-red small-pill"
                        onClick={() => handleDeleteWorkbook(mongoId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
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
            <div className="category-header-row">
              <div className="category-header">{cat}</div>

              <div className="category-sort">
                <span className="category-sort-label">Sort</span>
                <select
                  className="category-sort-select"
                  value={getSortMode(cat)}
                  onChange={(e) => handleChangeSort(cat, e.target.value)}
                  title="Sort decks in this category"
                >
                  <option value="alphaAsc">A → Z</option>
                  <option value="alphaDesc">Z → A</option>
                  <option value="cardAsc">Cards ↑</option>
                  <option value="cardDesc">Cards ↓</option>
                </select>
              </div>
            </div>

            <div className="category-decks">
              {decksByCategory(cat).length === 0 ? (
                <div className="deck-row placeholder">(No decks)</div>
              ) : (
                decksByCategory(cat).map((deck) => (
                  <div
                    key={deck.id}
                    className={
                      "deck-row" +
                      (draggingId === deck.id ? " deck-row-dragging" : "") +
                      (flaggedDeckIds.includes(deck.id)
                        ? " deck-row-flagged"
                        : "")
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
