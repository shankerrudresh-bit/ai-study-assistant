import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai.errors import APIError
from google.genai._gaos.errors import GenAiError
from google.genai._gaos.lib.compat_errors import GeminiNextGenAPIClientError
from pydantic import BaseModel, Field

BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"

load_dotenv(BACKEND_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()

app = FastAPI(title="AI Study Assistant")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(request: ChatRequest):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "paste_your_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured in backend/.env.",
        )

    message = request.message.strip()
    if not message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message.",
        )

    try:
        with genai.Client(api_key=GEMINI_API_KEY) as client:
            response = client.interactions.create(
                model=GEMINI_MODEL,
                input=message,
                system_instruction=(
                    "You are a friendly study assistant for a diploma computer "
                    "science student. Explain ideas in simple language. Keep "
                    "ordinary answers concise (about 120 words) unless the "
                    "student asks for detail. Use short headings and bullets "
                    "when they improve readability."
                ),
                generation_config={
                    "thinking_level": "low",
                    "max_output_tokens": 700,
                },
            )
    except (APIError, GenAiError) as exc:
        status_code = exc.code if isinstance(exc, APIError) else exc.status_code
        provider_message = exc.message

        if status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Gemini usage or rate limit reached. Check your Google AI Studio project limits.",
            ) from exc

        if status_code in (401, 403):
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Gemini authentication failed (HTTP {status_code}). "
                    "Check the API key and API access settings. "
                    f"Provider message: {provider_message}"
                ),
            ) from exc

        if status_code == 503:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini is temporarily unavailable (HTTP 503). "
                    f"Wait a few minutes and try again. Provider message: {provider_message}"
                ),
            ) from exc

        raise HTTPException(
            status_code=502,
            detail=(
                f"Gemini returned HTTP {status_code}. "
                f"Provider message: {provider_message or 'No additional details were provided.'}"
            ),
        ) from exc
    except GeminiNextGenAPIClientError as exc:
        status_code = getattr(exc, "status_code", None)
        provider_message = getattr(exc, "message", str(exc))

        if status_code == 429:
            raise HTTPException(
                status_code=429,
                detail=f"Gemini usage or rate limit reached. Provider message: {provider_message}",
            ) from exc

        if status_code == 503:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini is temporarily busy. Wait a few minutes and try again. "
                    f"Provider message: {provider_message}"
                ),
            ) from exc

        if status_code in (401, 403):
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Gemini authentication failed (HTTP {status_code}). "
                    "Check the API key and API access settings."
                ),
            ) from exc

        raise HTTPException(
            status_code=502,
            detail=(
                f"Gemini returned HTTP {status_code or 'unknown'}. "
                f"Provider message: {provider_message or 'No additional details were provided.'}"
            ),
        ) from exc

    if not response.output_text:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an empty response. Please try again.",
        )

    return {"reply": response.output_text}


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")