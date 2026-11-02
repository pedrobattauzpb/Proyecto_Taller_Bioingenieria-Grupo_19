from typing import List, Optional
from pydantic import BaseModel, EmailStr


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class CurrentUserRead(BaseModel):
    id: int
    email: str
    full_name: str
    professional_license: Optional[str] = None
    role: str
    is_active: bool
    has_global_scope: bool
    must_change_password: bool
    permissions: List[str]
    hospital_ids: List[int]

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: CurrentUserRead


class StreamTicketResponse(BaseModel):
    ticket: str
    expires_in: int = 60
