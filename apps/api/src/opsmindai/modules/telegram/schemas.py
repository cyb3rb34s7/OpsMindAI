from pydantic import BaseModel, Field


class TelegramWebhookRequest(BaseModel):
    customer_id: str
    message: str
    payload: dict = Field(default_factory=dict)
    provider: str | None = None


class TelegramConnectRequest(BaseModel):
    customer_id: str
    token: str
    name: str = ""


class TelegramDisconnectRequest(BaseModel):
    customer_id: str
