"""
Main entry point for the esports tournament scheduler backend.
"""

import uvicorn
from backend.api.scheduler_api import app

def main():
    """Run the FastAPI application using uvicorn."""
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main() 