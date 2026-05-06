from cryptography.fernet import Fernet
from app.core.config import settings

def encrypt_key(plain_text: str) -> str:
    """Encrypt a plain text key using the master encryption secret."""
    if not plain_text or not settings.master_encryption_secret:
        return plain_text

    try:
        f = Fernet(settings.master_encryption_secret.encode())
        return f.encrypt(plain_text.encode()).decode()
    except Exception:
        return plain_text

def decrypt_key(cipher_text: str) -> str:
    """Decrypt a cipher text key using the master encryption secret."""
    if not cipher_text or not settings.master_encryption_secret:
        return cipher_text

    try:
        f = Fernet(settings.master_encryption_secret.encode())
        return f.decrypt(cipher_text.encode()).decode()
    except Exception:
        return cipher_text
