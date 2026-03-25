from pydantic import BaseModel, computed_field


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    first_name: str | None
    last_name: str | None
    username: str | None
    role: str

    @computed_field
    @property
    def display_name(self) -> str:
        parts = []
        if self.first_name:
            parts.append(self.first_name)
        if self.last_name:
            parts.append(self.last_name)
        return " ".join(parts) if parts else f"user_{self.id}"

    class Config:
        from_attributes = True
