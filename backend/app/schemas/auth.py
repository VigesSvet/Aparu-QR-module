"""Auth-related Pydantic schemas."""

from pydantic import BaseModel, Field


class SendCodeRequest(BaseModel):
    phone: str = Field(..., min_length=5, description="Phone number")


class SendCodeResponse(BaseModel):
    message: str = "SMS code sent"
    # In dev mode we return the code for convenience
    code: str | None = None


class VerifyCodeRequest(BaseModel):
    phone: str = Field(..., min_length=5)
    code: str = Field(..., min_length=4, max_length=4)


class AuthResponse(BaseModel):
    token: str
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    phone: str
    name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class DriverProfileOut(BaseModel):
    id: int
    car_model: str
    car_color: str
    plate_number: str
    rating: float
    is_online: bool

    model_config = {"from_attributes": True}


class UserWithProfileOut(UserOut):
    driver_profile: DriverProfileOut | None = None
