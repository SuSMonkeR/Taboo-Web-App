// frontend/src/components/manage/ManageView.jsx
import { useEffect, useMemo, useState } from "react";
import "./manage.css";
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

// ✅ Place this file at: frontend/src/components/manage/howto.webm
// ✅ Using an import ensures the bundler includes it in production builds.
import howtoWebm from "./howto.webm";

/* ======================================================
   How-to overlay (inline: no other files required)
   - closes on backdrop click, Esc, or X
   - locks background scroll while open
====================================================== */
function HowToOverlay({ open, onClose, title = "How to use" }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "min(90vh, 900px)",
          background: "rgba(15, 23, 42, 0.92)",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
          }}
        >
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>{title}</div>

          <button
            type="button"
            className="pill pill-outline"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{ padding: "8px 12px" }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16, overflow: "auto" }}>
          <video
            src={howtoWebm}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: 14,
              border: "1px solid rgba(148, 163, 184, 0.18)",
              background: "rgba(2,6,23,0.6)",
            }}
          />
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              opacity: 0.85,
              textAlign: "right",
            }}
          >
            Click outside or press <b>Esc</b> to close
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManageView() {
  const [categories, setCategories] = useState([]);
  const [decks, setDecks] = useState([]);
  const [workbooks, setWorkbooks] = useState([]);
  const [flaggedDeckIds, setFlaggedDeckIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState(null);

  // ✅ Inline Delete Category panel (Option A)
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deleteSelected, setDeleteSelected] = useState("");

  // ✅ Collapsible categories
  const [collapsedByCategory, setCollapsedByCategory] = useState({});

  // ✅ How-to overlay
  const [showHowTo, setShowHowTo] = useState(false);

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

  /* ---------------- Delete Category (Option A panel) ---------------- */
  const toggleDeletePanel = () => {
    setShowDeletePanel((v) => !v);
    setDeleteSelected("");
  };

  const confirmDeleteCategory = async () => {
    const name = deleteSelected;
    if (!name) return;

    try {
      setLoading(true);
      setError("");
      const state = await deleteCategory(name);
      setCategories(state.categories || []);
      setDecks(state.decks || []);

      // remove stale collapse state key immediately (prevents one-render weirdness)
      setCollapsedByCategory((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete category.");
    } finally {
      setLoading(false);
      setShowDeletePanel(false);
      setDeleteSelected("");
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
  const allCategories = useMemo(() => {
    return categories.includes("Uncategorized")
      ? categories
      : ["Uncategorized", ...categories];
  }, [categories]);

  const deletableCategories = useMemo(() => {
    return categories.filter((c) => c !== "Uncategorized");
  }, [categories]);

  const decksByCategory = (category) => {
    const filtered = decks.filter(
      (d) => (d.category || "Uncategorized") === category
    );
    return sortDecksForCategory(category, filtered);
  };

  /* ---------------- Collapse state initialization / sync ---------------- */
  useEffect(() => {
    // Ensure every category has a key; default = expanded (false)
    setCollapsedByCategory((prev) => {
      const next = { ...prev };
      for (const cat of allCategories) {
        if (typeof next[cat] !== "boolean") next[cat] = false;
      }
      // Remove stale keys if categories were deleted
      for (const key of Object.keys(next)) {
        if (!allCategories.includes(key)) delete next[key];
      }
      return next;
    });
  }, [allCategories]);

  const toggleCategoryCollapsed = (cat) => {
    setCollapsedByCategory((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const allCollapsed =
    allCategories.length > 0 &&
    allCategories.every((cat) => collapsedByCategory[cat] === true);

  const handleToggleAll = () => {
    setCollapsedByCategory((prev) => {
      const next = { ...prev };
      const target = !allCollapsed ? true : false; // if not all collapsed => collapse all, else expand all
      for (const cat of allCategories) next[cat] = target;
      return next;
    });
  };

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

        {/* ✅ Replaces dead CSV button */}
        <button className="pill pill-outline" onClick={() => setShowHowTo(true)}>
          How to use
        </button>
      </div>

      {/* ✅ Overlay */}
      <HowToOverlay open={showHowTo} onClose={() => setShowHowTo(false)} />

      {/* --- Google workbooks "category" --- (kept) */}
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
                const deckCount = (wb.tabs || []).filter((t) => t.deck_id).length;
                const deckTotal = deckCount || tabCount;

                const sheetUrl = wb.workbook_id
                  ? `https://docs.google.com/spreadsheets/d/${wb.workbook_id}/edit`
                  : null;

                const deckIdsFromWorkbook = (wb.tabs || [])
                  .map((t) => t.deck_id)
                  .filter(Boolean);

                const flagged =
                  deckIdsFromWorkbook.length > 0 &&
                  deckIdsFromWorkbook.every((id) => flaggedDeckIds.includes(id));

                return (
                  <div
                    key={mongoId}
                    className={
                      "deck-row workbook-row" + (flagged ? " deck-row-flagged" : "")
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

        <button className="pill pill-red" onClick={toggleDeletePanel}>
          Delete category ▾
        </button>

        <button className="pill pill-outline" onClick={handleToggleAll}>
          {allCollapsed ? "Expand All" : "Collapse All"}
        </button>

        {loading && <span style={{ marginLeft: 12 }}>Loading…</span>}
        {error && (
          <span style={{ marginLeft: 12, color: "#f97373" }}>{error}</span>
        )}
      </div>

      {/* --- Inline Delete Category Panel (Option A) --- */}
      {showDeletePanel && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 16, // dead space before categories start
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(148, 163, 184, 0.25)",
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Delete Category</div>
            <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.25 }}>
              Decks inside it will move to <b>Uncategorized</b>.
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <select
              className="modal-select"
              value={deleteSelected}
              onChange={(e) => setDeleteSelected(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="" disabled>
                Choose category
              </option>

              {deletableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 210,
              justifyContent: "flex-end",
            }}
          >
            <button
              className="pill pill-red"
              disabled={!deleteSelected}
              onClick={confirmDeleteCategory}
            >
              Delete
            </button>

            <button
              className="pill pill-outline"
              onClick={() => {
                setShowDeletePanel(false);
                setDeleteSelected("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* --- Categories (VERTICAL) --- */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {allCategories.map((cat) => {
          const collapsed = collapsedByCategory[cat] === true;
          const arrow = collapsed ? "▼" : "▲";

          return (
            <div
              key={cat}
              className="category-column"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnCategory(e, cat)}
            >
              {/* centered collapse arrow */}
              <button
                type="button"
                className="category-collapse-btn"
                onClick={() => toggleCategoryCollapsed(cat)}
                title={collapsed ? "Expand category" : "Collapse category"}
              >
                {arrow}
              </button>

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

              {!collapsed && (
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
                            <span className="deck-meta">({deck.card_count} cards)</span>
                          </div>
                        </div>

                        <div className="deck-actions">
                          {/* KEEP per-deck Sheet button */}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
