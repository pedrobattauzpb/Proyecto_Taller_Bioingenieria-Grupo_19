from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    professional_license: Optional[str] = None
    role: UserRole = UserRole.TECHNICIAN
    password: Optional[str] = None
    hospital_ids: Optional[List[int]] = None
    has_global_scope: bool = False


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    professional_license: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    has_global_scope: Optional[bool] = None
    hospital_ids: Optional[List[int]] = None


class UserHospitalsUpdate(BaseModel):
    hospital_ids: List[int]
    has_global_scope: bool = False


class UserRead(BaseModel):
    id: int
    email: str
    full_name: str
    professional_license: Optional[str] = None
    role: UserRole
    is_active: bool
    has_global_scope: bool
    must_change_password: bool
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    hospital_ids: List[int] = []
    temporary_password: Optional[str] = None

    class Config:
        from_attributes = True


class PasswordResetResponse(BaseModel):
    temporary_password: str


class RoleRead(BaseModel):
    role: str
    name: str
    description: str
    permissions: List[str]
