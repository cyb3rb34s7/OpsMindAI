from pydantic import BaseModel


class ChatRequest(BaseModel):
    customer_id: str
    message: str
    thread_id: str = "main"
    provider: str | None = None


class ChatStopRequest(BaseModel):
    customer_id: str
    thread_id: str = "main"
