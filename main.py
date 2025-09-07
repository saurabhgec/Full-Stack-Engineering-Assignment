# app/main.py
import os
import io
import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import requests

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PyPDF2 import PdfReader

from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from google.auth import default
from google.auth.transport.requests import Request
import chromadb
from google import genai

# ---------- Database Setup ----------
DB_USER = "postgres"
DB_PASSWORD = "12345"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "mydb"
GEMINI_API_KEY = "AIzaSyBjn2a3aUgOkirEm56YrJ6mkSdTqOmlWA8"

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, echo=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# ---------- DB Models ----------
class KnowledgeBaseDoc(Base):
    __tablename__ = "knowledge_base_docs"
    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(String, unique=True, index=True)
    collection = Column(String, default="default")
    text = Column(Text)
    filename = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(String, unique=True, index=True)
    name = Column(String, default="My Workflow")
    graph = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)

class Stack(Base):
    __tablename__ = "stacks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)

from pydantic import BaseModel

class StackResponse(BaseModel):
    id: int
    name: str
    description: str | None = None

    class Config:
        orm_mode = True  # SQLAlchemy object ko JSON me convert karne ke liye


Base.metadata.create_all(bind=engine)

# ---------- FastAPI App ----------
app = FastAPI(title="Workflow Backend with Gemini & ChromaDB", version="0.5")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- ChromaDB Client ----------
chroma_client = chromadb.Client()
vector_collection = chroma_client.get_or_create_collection("knowledge_base")


def gemini_generate_response(prompt: str):
    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model="gemini-2.5-flash", contents=f"{prompt}"
    )
    return response.text

# ---------- Gemini API with Debug ----------
def gemini_generate(prompt: str) -> str:
    try:
        print("=== Gemini Debug Start ===")
        print("Prompt:", prompt[:200])  # sirf first 200 chars

        creds, project = default()
        print("Got Google credentials.")

        creds.refresh(Request())
        print("Access token refreshed.")
        access_token = creds.token
        print("Access Token:", access_token[:20] + "...")  # token ka sirf beginning dikhaye
        print("Got Google credentials.")
        print("Access token:", creds.token[:20], "...")  # show first 20 chars
        print("Sending request to Gemini API...")

        GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        headers = {"Authorization": f"Bearer {access_token}"}
        data = {"prompt": prompt, "max_output_tokens": 200}

        print("Sending request to Gemini API...")
        response = requests.post(GEMINI_API_URL, json=data, headers=headers, timeout=30)
        print("Response received, status code:", response.status_code)
        response.raise_for_status()

        content = response.json()
        print("Full response JSON:", json.dumps(content, indent=2)[:1000])  # only first 1000 chars
        result = content["candidates"][0]["content"]
        print("Gemini output:", result[:500])  # first 500 chars
        print("=== Gemini Debug End ===\n")
        return result

    except Exception as e:
        print("Gemini Error:", str(e))
        return f"MOCK Gemini response due to error: {str(e)}"

# ---------- Schemas ----------
class Node(BaseModel):
    id: str
    type: str
    position: Optional[Dict[str, Any]] = {}
    data: Optional[Dict[str, Any]] = {}

class Edge(BaseModel):
    id: Optional[str]
    source: str
    target: str

class RunRequest(BaseModel):
    question: str
    workflow: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None

class RunResponse(BaseModel):
    answer: str
    trace: Optional[List[Dict[str, Any]]] = None
    sources: Optional[List[Dict[str, Any]]] = None

class WorkflowGraph(BaseModel):
    id: str
    created_at: Optional[str]
    steps: List[Node]
    meta: Optional[Dict[str, Any]] = {}

class StackCreate(BaseModel):
    name: str
    description: str


# ---------- Utility ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- KB Functions ----------
def generate_embedding(text: str) -> List[float]:
    # fallback mock embedding
    return [0.0] * 768

def kb_add_text(collection: str, doc_text: str, filename: str, db: Session):
    doc_id = str(uuid.uuid4())
    doc = KnowledgeBaseDoc(doc_id=doc_id, collection=collection or "default", text=doc_text, filename=filename)
    db.add(doc)
    db.commit()
    db.refresh(doc)

    embedding = generate_embedding(doc_text)
    vector_collection.add(
        documents=[doc_text],
        ids=[doc_id],
        metadatas=[{"filename": filename, "collection": collection}],
        embeddings=[embedding]
    )
    return {"doc_id": doc_id, "text": doc_text[:200], "filename": filename}

def kb_retrieve(query: str, top_k: int = 3):
    try:
        query_emb = generate_embedding(query)
        results = vector_collection.query(query_embeddings=[query_emb], n_results=top_k)
        return [
            {"id": results["ids"][0][i], "text": results["documents"][0][i], "score": 1.0 - i*0.1}
            for i in range(len(results["ids"][0]))
        ]
    except Exception as e:
        # fallback empty
        return []

# ---------- Upload Directory ----------
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ---------- Endpoints ----------
@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    try:
        ext = Path(file.filename).suffix
        doc_id = f"{uuid.uuid4()}{ext}"
        dest = UPLOAD_DIR / doc_id
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        return {"status": "ok", "doc_id": str(doc_id), "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process/{doc_id}")
async def api_process(doc_id: str, collection: Optional[str] = None, db: Session = Depends(get_db)):
    fpath = UPLOAD_DIR / doc_id
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="file not found")
    try:
        data = fpath.read_bytes()
        text = ""
        if fpath.suffix.lower() == ".pdf":
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join([page.extract_text() or "" for page in reader.pages])
        else:
            try:
                text = data.decode("utf-8", errors="ignore")
            except:
                text = f"Binary content of {doc_id}, cannot extract text."
        doc = kb_add_text(collection or "default", text, fpath.name, db)
        return {"status": "processed", "doc": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/workflow/build")
async def workflow_build(payload: dict, db: Session = Depends(get_db)):
    workflow_id = str(uuid.uuid4())
    workflow_name = f"Workflow {workflow_id[:8]}"
    workflow = Workflow(workflow_id=workflow_id, name=workflow_name, graph=payload)
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return {"status": "ok", "workflow_id": workflow.workflow_id, "name": workflow.name, "graph": workflow.graph}

@app.post("/api/workflow/run", response_model=RunResponse)
async def api_workflow_run(payload: RunRequest, db: Session = Depends(get_db)):
    question = payload.question
    wf = payload.workflow
    if not wf:
        raise HTTPException(status_code=400, detail="workflow is required")

    trace = []
    sources = []
    current_input = question
    trace.append({"step": "start", "info": "User question received", "question": question})

    for step in wf.get("steps", []):
        stype = step.get("type")
        sdata = step.get("data") or {}
        trace_entry = {"step_id": step.get("id"), "type": stype, "input": current_input}

        if stype == "userQuery":
            trace_entry["info"] = "user query entry"

        elif stype == "knowledgeBase":
            retrieved = kb_retrieve(current_input, top_k=3)
            trace_entry["info"] = f"retrieved {len(retrieved)} docs from Vector DB"
            trace_entry["docs"] = retrieved
            ctx = "\n\n".join([f"[source {d['id']}]\n{d['text']}" for d in retrieved])
            current_input = f"CONTEXT:\n{ctx}\n\nQUESTION:\n{current_input}"
            sources.extend([{"id": d["id"], "score": d["score"]} for d in retrieved])

        elif stype == "llmEngine":
            prompt = f"{sdata.get('prompt')}\n\n{current_input}" if sdata.get("prompt") else current_input
            # output_text = gemini_generate(prompt)
            output_text = gemini_generate_response((prompt))
            trace_entry["info"] = "Gemini LLM called"
            trace_entry["output"] = output_text
            current_input = output_text

        elif stype == "output":
            trace_entry["info"] = "output node - finalize"

        trace.append(trace_entry)

    return RunResponse(answer=current_input, trace=trace, sources=sources)

# ---------- Health ----------
@app.get("/api/health")
async def health():
    return {"status": "ok", "postgres": True, "vector_db": True, "gemini": True}



@app.post("/api/setstack")
def create_stack(stack: StackCreate, db: Session = Depends(get_db)):
    new_stack = Stack(name=stack.name, description=stack.description)
    db.add(new_stack)
    db.commit()
    db.refresh(new_stack)
    return {"id": new_stack.id, "name": new_stack.name, "description": new_stack.description}


@app.get("/api/getstack", response_model=List[StackResponse])
def get_stack(db: Session = Depends(get_db)):
    stacks = db.query(Stack).all()  # saare stacks fetch
    return stacks


@app.get("/")
def root():
    return {"message": "Workflow Backend with Gemini & ChromaDB 🚀"}
