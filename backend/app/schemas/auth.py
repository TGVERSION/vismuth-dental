from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    login: EmailStr = Field(..., description="Email (совпадает с service_user.login)")
    password: str = Field(..., min_length=8, max_length=128)


class RegisterConfirmRequest(BaseModel):
    login: EmailStr
    code: str = Field(..., min_length=4, max_length=10, pattern=r"^\d{4}$")


class LoginRequest(BaseModel):
    login: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: UUID
    login: str
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class MessageResponse(BaseModel):
    detail: str


class RegisterResponse(BaseModel):
    detail: str = "code_sent"
