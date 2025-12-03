BACKEND (FastAPI)

Directory: /backend/app

main.py

Purpose:

Central FastAPI application.

Wires all API routes together.

Nothing else.

It exposes:

/auth/login (password check)

/library/... (deck/category management endpoints)

config.py

Purpose:

Stores the environment configuration.

Holds the single shared staff password used to login.

Currently: APP_PASSWORD = "123"

Nothing else lives here.

db.py

Purpose:

Handles persistent state for the whole app.

This is where the “shared state” lives, so every staff member sees the same decks/categories when they refresh.

Uses ONE JSON file on disk:

/backend/data/decks.json

This JSON contains:

List of categories

List of decks

Mapping of which deck belongs to which category

Actual cards inside each deck

This is the internal “database.”

models.py

Purpose:

Internal Python classes to represent:

Deck

Category

Card

Deck library

Used by the service layer (taboo_parser + library actions)

These are not exposed to the API — they’re strictly internal logic.

schemas.py

Purpose:

Structures for request and response bodies used by the API.

These are the JSON shapes the frontend receives or sends.

Includes schemas for things like:

Uploading a CSV

Adding/deleting categories

Moving decks between categories

Returning deck lists to the frontend

services/taboo_parser.py

Purpose:

Converts uploaded CSV files into decks/cards.

Applies the “random shuffle deck” rule by preparing the structure.

Handles both:

CSV upload

Google Sheets → CSV download (your original bot mechanic)

This is what transforms raw data into usable decks.

api/auth.py

Purpose:

Contains exactly one endpoint: POST /auth/login

Verifies password from config.py.

Returns a simple success/fail JSON.

No tokens, no usernames, nothing fancy.

api/library.py

Purpose:

The heart of deck/category management.

Defines endpoints for:

Importing decks (CSV or Google Sheets URL)

Reading all current decks/categories

Adding or deleting categories

Deleting a deck

Moving a deck between categories

Reloading decks (reload from JSON)

Everything the “Manage Page” needs comes from here.

BACKEND ROOT FILES
requirements.txt

List of backend Python dependencies.

README.md

Your documentation.

FRONTEND (React + Vite)

Directory: /frontend/src

App.jsx

Purpose:

Top-level routing.

Decides which page to show based on:

Logged-in state

Active tab (Play / Manage)

Nothing else.

main.jsx

Purpose:

Entry point for the React app.

Renders <App />.

Loads global styles.

global.css

Purpose:

App-wide baseline styles.

Includes:

Global font

App centering

Light homepage styling

(Future) Variables and theme settings

COMPONENTS

Directory: /frontend/src/components

LoginPage.jsx

Purpose:

UI for login page.

Contains:

Password input

Login button

Calls backend /auth/login.

On success: moves to the main application.

Nothing more.

PlayView.jsx

Purpose:

UI for the Play Tab.

Displays:

Category/Deck selection list (checkboxes)

Card preview area

Green Draw button (random shuffle)

Red Skip button

Orange Copy block button

Yellow Reload button

Handles card drawing logic integrated with backend.

This is the staff-facing “gameplay page.”

MANAGE TAB COMPONENTS

Directory: /frontend/src/components/manage/

These files mirror your design sketch.

ManageView.jsx

Purpose:

The entire Manage tab page (the brain of it).

Displays:

Upload-from-Google-Sheet button

Upload-CSV button

Reload-from-disk button

List of categories (columns)

An “Uncategorized” column that always exists

Decks in draggable format

Calls backend endpoints from library.js.

DeckImportBar.jsx

Purpose:

The horizontal bar at the top of the Manage tab.

Contains:

“Upload Google Sheet” button

“Upload CSV” button

“Reload” button

CategoryColumn.jsx

Purpose:

Represents one vertical category column.

Shows:

Category name

Add/delete category button for that category

Decks inside it

Handles dragging decks in/out of itself.

DeckCard.jsx

Purpose:

A single deck card inside a category column.

Shows:

Deck name

Yellow “Move To” button

Red “Delete deck” button

Can be dragged to a different category.

API WRAPPER
src/api/library.js

Purpose:

One small file that wraps fetch() calls to backend:

import deck from CSV

import deck from Google Sheets

get decks & categories

add category

delete category

delete deck

move deck

This keeps API logic out of the UI components.

STATE
src/state/playSession.js

Purpose:

Provides a play-session helper:

Which decks are selected

Current card index (after shuffle)

Cards already drawn

Helps PlayView stay clean.

Not required for MVP, but included in your skeleton.