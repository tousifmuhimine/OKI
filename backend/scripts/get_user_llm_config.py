import asyncio
from app.db.session import SessionLocal
from sqlalchemy import text

USER_ID = 'a31c8d90-ab44-4001-a9ee-3a513156a6bd'

async def main():
    async with SessionLocal() as session:
        q = text("SELECT id, workspace_id, user_id, provider, model_preferences::text AS model_prefs, automation_modes::text AS automation_modes, default_model FROM user_llm_configs WHERE user_id = :uid")
        res = await session.execute(q, {"uid": USER_ID})
        rows = res.fetchall()
        print('rows:', len(rows))
        for r in rows:
            print('id=', r.id)
            print('workspace_id=', r.workspace_id)
            print('provider=', r.provider)
            print('default_model=', r.default_model)
            print('model_preferences=', r.model_prefs)
            print('automation_modes=', r.automation_modes)

if __name__ == '__main__':
    asyncio.run(main())
