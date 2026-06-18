import asyncio
import sys
import os

# Add parent directory to sys.path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import engine

async def add_columns():
    async with engine.begin() as conn:
        print("Adding billing and feature columns to organizations table...")
        
        # We add the columns one by one IF NOT EXISTS
        columns = [
            ("plan_name", "VARCHAR(64) DEFAULT 'free'"),
            ("subscription_status", "VARCHAR(64) DEFAULT 'active'"),
            ("subscription_cycle", "VARCHAR(64) DEFAULT 'monthly'"),
            ("subscription_expires_at", "TIMESTAMP WITH TIME ZONE"),
            ("chatbot_enabled", "BOOLEAN DEFAULT TRUE"),
            ("crm_enabled", "BOOLEAN DEFAULT TRUE"),
            ("lead_bulk_share_enabled", "BOOLEAN DEFAULT TRUE"),
            ("requested_plan_name", "VARCHAR(64)"),
            ("requested_subscription_cycle", "VARCHAR(64)"),
            ("requested_at", "TIMESTAMP WITH TIME ZONE")
        ]
        
        for col_name, col_type in columns:
            try:
                await conn.execute(text(f"ALTER TABLE organizations ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                print(f"Column '{col_name}' added successfully or already exists.")
            except Exception as e:
                print(f"Error adding column '{col_name}': {e}")
                
        print("Database migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_columns())
