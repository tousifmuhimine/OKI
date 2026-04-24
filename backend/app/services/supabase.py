from supabase import Client, create_client

from app.core.config import settings


class SupabaseService:
    def __init__(self) -> None:
        self._client: Client | None = None

    @property
    def client(self) -> Client:
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_service_role_key:
                raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
            self._client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        return self._client


supabase_service = SupabaseService()
