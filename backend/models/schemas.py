from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# ==================== AUTH ====================

class UserSignUp(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    username: str = Field(..., min_length=3, max_length=50)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ==================== USERS ====================

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None

class UserDetailResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: str

# ==================== DATA ====================

class DataCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    content: str = Field(..., min_length=1)
    category: Optional[str] = Field(None, max_length=100)

class DataUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=100)

class DataResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str]
    content: str
    category: Optional[str]
    created_at: str
    updated_at: str

class DataListResponse(BaseModel):
    total: int
    data: list[DataResponse]

# ==================== ERRORS ====================

class ErrorResponse(BaseModel):
    detail: str
    status_code: int