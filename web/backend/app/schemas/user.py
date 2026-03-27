from pydantic import BaseModel, computed_field


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    name: str | None = None
    first_name: str | None
    last_name: str | None
    username: str | None
    role: str

    @computed_field
    @property
    def display_name(self) -> str:
        if self.first_name:
            name = self.first_name
            if self.last_name:
                name = f"{name} {self.last_name}"
            return name
        n: str = self.name or ""
        return n or f"user_{self.id}"

    class Config:
        from_attributes = True
