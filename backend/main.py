import os
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import traceback

from database import SessionLocal, engine
from models import Base, User
from rag_pipeline import get_response_stream, add_new_document, load_user_index, delete_user_document

# --------------------------
# App & Config
# --------------------------
app = FastAPI(title="RAG Educational Assistant", version="1.0.0")

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all during dev; tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --------------------------
# DB Dependency
# --------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------
# Pydantic Models
# --------------------------
class Question(BaseModel):
    question: str
    user_id: int


# --------------------------
# Serve Frontend
# --------------------------
@app.get("/", response_class=HTMLResponse)
def serve_index():
    path = os.path.join("frontend", "index.html")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>index.html not found</h1>"


# --------------------------
# Auth Endpoints
# --------------------------
@app.post("/register")
def register(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    """Register new user with hashed password."""
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_pw = pwd_context.hash(password)
    user = User(username=username, hashed_password=hashed_pw)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create user data directory
    user_dir = os.path.join("data", str(user.id))
    os.makedirs(user_dir, exist_ok=True)

    return {"message": "User registered successfully", "user_id": user.id}


@app.post("/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    """User login verification."""
    user = db.query(User).filter(User.username == username).first()
    if not user or not pwd_context.verify(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"message": "Login successful", "user_id": user.id}


# --------------------------
# File Upload Endpoint
# --------------------------
@app.post("/upload")
async def upload_file(user_id: int = Form(...), file: UploadFile = File(...)):
    """
    Upload a new document (PDF/TXT/CSV) for a user.
    The file is saved in their folder and automatically chunked + indexed.
    """
    try:
        user_dir = os.path.join("data", str(user_id))
        os.makedirs(user_dir, exist_ok=True)

        # Save file locally
        file_path = os.path.join(user_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Process and embed document
        processed = add_new_document(file_path, user_id)
        if processed:
            return JSONResponse({
                "status": "success",
                "message": f"{file.filename} uploaded and indexed successfully."
            })
        else:
            return JSONResponse({
                "status": "error",
                "message": f"{file.filename} uploaded but could not be processed."
            })
    except Exception as e:
        print("❌ Error in /upload:", e)
        traceback.print_exc()
        return JSONResponse({"status": "error", "message": str(e)})


# --------------------------
# Chat / Question Endpoint
# --------------------------
@app.post("/ask")
def ask_question(q: Question):
    """
    Stream an AI-generated answer using the user's own documents as knowledge base.
    """
    try:
        stream = get_response_stream(q.user_id, q.question)
        return StreamingResponse(stream, media_type="text/plain")
    except Exception as e:
        print("❌ Error in /ask:", e)
        traceback.print_exc()
        return JSONResponse(
            {"answer": f"Error while processing your question: {str(e)}"}
        )


# --------------------------
# Chat (JSON, non-streaming)
# --------------------------
@app.post("/ask_json")
def ask_question_json(q: Question):
    """
    Return the full answer as JSON instead of a text stream.
    Useful for frontends that expect a single JSON payload.
    """
    try:
        stream = get_response_stream(q.user_id, q.question)
        full_answer = ""
        for chunk in stream:
            full_answer += chunk
        return {"answer": full_answer}
    except Exception as e:
        print("❌ Error in /ask_json:", e)
        traceback.print_exc()
        return JSONResponse(
            {"answer": f"Error while processing your question: {str(e)}"}
        )

# --------------------------
# Optional: Debug / Utility
# --------------------------
@app.get("/user/{user_id}/docs")
def list_user_docs(user_id: int):
    """
    View metadata of uploaded documents for a user.
    Useful for debugging / frontend display.
    """
    metadata_path = os.path.join("data", str(user_id), "metadata.json")
    if not os.path.exists(metadata_path):
        return {"message": "No documents uploaded yet."}
    with open(metadata_path, "r", encoding="utf-8") as f:
        import json
        return json.load(f)


# --------------------------
# Delete User Document
# --------------------------
@app.delete("/user/{user_id}/docs")
def delete_doc(user_id: int, filename: str):
    """
    Delete a specific user document by filename and rebuild the user's index.
    The `filename` should match the stored file name exactly.
    """
    try:
        ok = delete_user_document(user_id, filename)
        if ok:
            return {"status": "success", "message": f"Deleted {filename} and rebuilt index"}
        else:
            return JSONResponse({"status": "error", "message": "Failed to rebuild index after delete"}, status_code=500)
    except Exception as e:
        print("❌ Error in delete_doc:", e)
        traceback.print_exc()
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)
