#!/usr/bin/env python3
"""
Migrate decks from library.json to MongoDB.
Run this ONCE after deploying the new code.
"""

import json
from pathlib import Path

# Import after the app is set up
from app.mongo_client import get_db

DATA_DIR = Path(__file__).resolve().parent / "app" / "data"
LIBRARY_FILE = DATA_DIR / "library.json"

db = get_db()
decks_collection = db["decks"]


def migrate():
    """Migrate all decks from library.json to MongoDB."""
    
    # Check if library.json exists
    if not LIBRARY_FILE.exists():
        print("📂 No library.json found - starting fresh!")
        print("   This is fine if you're setting up for the first time.")
        return
    
    # Load library.json
    try:
        with open(LIBRARY_FILE, 'r', encoding='utf-8') as f:
            library = json.load(f)
    except Exception as e:
        print(f"❌ Error reading library.json: {e}")
        return
    
    decks = library.get('decks', [])
    
    if not decks:
        print("📂 No decks found in library.json")
        return
    
    print(f"\n🔄 Found {len(decks)} decks to migrate...\n")
    
    migrated = 0
    skipped = 0
    
    for deck in decks:
        deck_id = deck.get('id')
        deck_name = deck.get('name', 'Unknown')
        
        if not deck_id:
            print(f"  ⚠️  Skipped: {deck_name} (no ID)")
            skipped += 1
            continue
        
        # Check if deck already exists in MongoDB
        existing = decks_collection.find_one({'_id': deck_id})
        if existing:
            print(f"  ⏭️  Skipped: {deck_name} (already in MongoDB)")
            skipped += 1
            continue
        
        # Prepare document for MongoDB
        # Remove 'id' field and use it as '_id'
        doc = {k: v for k, v in deck.items() if k != 'id'}
        doc['_id'] = deck_id
        
        # Insert into MongoDB
        try:
            decks_collection.insert_one(doc)
            print(f"  ✅ Migrated: {deck_name}")
            migrated += 1
        except Exception as e:
            print(f"  ❌ Failed: {deck_name} - {e}")
    
    print(f"\n{'='*50}")
    print(f"✨ Migration complete!")
    print(f"   Migrated: {migrated} decks")
    print(f"   Skipped:  {skipped} decks")
    print(f"{'='*50}\n")
    
    # Save categories to new format
    categories = library.get('categories', [])
    if categories:
        CATEGORIES_FILE = DATA_DIR / "categories.json"
        try:
            with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
                json.dump(categories, f, indent=2, ensure_ascii=False)
            print(f"✅ Saved {len(categories)} categories to categories.json")
        except Exception as e:
            print(f"❌ Failed to save categories: {e}")


if __name__ == "__main__":
    print("\n" + "="*50)
    print("🔄 MONGODB MIGRATION SCRIPT")
    print("   Migrating decks from library.json → MongoDB")
    print("="*50 + "\n")
    
    try:
        migrate()
        print("\n✅ Migration successful!\n")
        print("💡 You can now safely delete library.json (but keep a backup!)")
        print("   The app will use MongoDB for decks from now on.\n")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}\n")
        raise
