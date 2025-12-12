// frontend/src/api/workbooks.js

import { API_BASE, authHeaders, handleJsonResponse } from "./library";

/**
 * Import a full Google Sheets workbook.
 * Backend will:
 *  - Parse all tabs
 *  - Create decks (one per tab)
 *  - Store workbook + tab metadata in Mongo
 */
export async function importWorkbook(sheetUrl) {
  const resp = await fetch(`${API_BASE}/admin/workbooks/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ sheet_url: sheetUrl }),
  });

  return handleJsonResponse(resp);
}

/**
 * Fetch list of all known workbooks.
 */
export async function fetchWorkbooks() {
  const resp = await fetch(`${API_BASE}/admin/workbooks/list`, {
    method: "GET",
    headers: {
      ...authHeaders(),
    },
  });

  return handleJsonResponse(resp);
}

/**
 * Re-parse a single workbook and update all of its decks in place.
 */
export async function reloadWorkbook(workbookId) {
  const resp = await fetch(
    `${API_BASE}/admin/workbooks/${encodeURIComponent(workbookId)}/reload`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
      },
    }
  );

  return handleJsonResponse(resp);
}

/**
 * Delete a workbook (and, once the backend route is wired, its decks).
 */
export async function deleteWorkbook(workbookId) {
  const resp = await fetch(
    `${API_BASE}/admin/workbooks/${encodeURIComponent(workbookId)}`,
    {
      method: "DELETE",
      headers: {
        ...authHeaders(),
      },
    }
  );

  return handleJsonResponse(resp);
}
