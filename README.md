# Full-Stack-Engineering-Assignment
his project is a FastAPI-based backend system that integrates Google Gemini LLM, ChromaDB (Vector Database), and PostgreSQL to build and execute dynamic workflows. It also supports document knowledge base ingestion (PDF/text), LLM-powered responses, and stack management APIs.

# Workflow Backend with Gemini & ChromaDB 🚀

This project is a **FastAPI-based backend system** that integrates **Google Gemini LLM**, **ChromaDB (Vector Database)**, and **PostgreSQL** to build and execute dynamic workflows. It also supports **document knowledge base ingestion** (PDF/text), **LLM-powered responses**, and **stack management APIs**.

---

## ✨ Features

- **FastAPI Backend** – High-performance async backend framework.  
- **Knowledge Base**  
  - Upload documents (PDF/Text).  
  - Extract text and save into PostgreSQL.  
  - Generate embeddings and store in ChromaDB.  
  - Retrieve context for user queries.  
- **Workflow Builder**  
  - Create workflows with nodes/edges.  
  - Supports nodes like:  
    - User Query  
    - Knowledge Base Retrieval  
    - LLM Engine (Gemini)  
    - Output Node  
  - Executes workflows step by step and returns trace logs.  
- **Google Gemini Integration** – Generate intelligent answers with context.  
- **Stacks Module** – Create and fetch stacks (simple example entity).  
- **Database** – PostgreSQL with SQLAlchemy ORM.  
- **Health Check API** – Verify connectivity with PostgreSQL, ChromaDB, and Gemini.  

---

## 🛠️ Tech Stack

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/)  
- **Database:** PostgreSQL + SQLAlchemy ORM  
- **Vector DB:** [ChromaDB](https://docs.trychroma.com/)  
- **LLM:** Google Gemini (via API Key)  
- **Other:** PyPDF2 (PDF parsing), Requests, Pydantic  

---



