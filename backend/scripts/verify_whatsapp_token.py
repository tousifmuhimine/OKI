import asyncio
import httpx
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Inbox
from app.inbox.security import decrypt_channel_config

WORKSPACE_ID = 'a31c8d90-ab44-4001-a9ee-3a513156a6bd'
GRAPH_API_VERSION = 'v19.0'

async def main():
    async with SessionLocal() as session:
        inbox = (
            await session.execute(
                select(Inbox).where(Inbox.workspace_id == WORKSPACE_ID, Inbox.channel_type == 'whatsapp').limit(1)
            )
        ).scalar_one_or_none()
        if not inbox:
            print('No WhatsApp inbox found')
            return

        cfg = decrypt_channel_config(inbox.channel_config)
        phone_number_id = cfg.get('phone_number_id')
        token = cfg.get('api_token')

        print('inbox_id={}'.format(inbox.id))
        print('integration_mode={}'.format(cfg.get('integration_mode')))
        print('phone_number_id={}'.format(phone_number_id))

        if not token or not phone_number_id:
            print('Missing token or phone_number_id')
            return

        url = 'https://graph.facebook.com/{}/{}'.format(GRAPH_API_VERSION, phone_number_id)
        headers = {'Authorization': 'Bearer {}'.format(token)}
        params = {'fields': 'id,display_phone_number,verified_name,quality_rating'}

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers=headers, params=params)

        print('status={}'.format(resp.status_code))
        print('body={}'.format(resp.text))

if __name__ == '__main__':
    asyncio.run(main())
