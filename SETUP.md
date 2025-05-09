# Esports Tournament Scheduler Setup

This application uses a combination of JavaScript (Node.js) frontend and Python backend for genetic algorithm-based esports tournament scheduling.

## Setup Instructions

### 1. Install Dependencies

#### Node.js Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

#### Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Application

To run both the Node.js server and Python API server simultaneously:

```bash
npm run dev
# or 
yarn dev
# or
pnpm dev
```

This will start:
- The Node.js server at http://localhost:3000
- The Python Flask API at http://localhost:5000

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Running Servers Separately

If you need to run the servers separately:

### Node.js Server Only
```bash
npm run start
# or
yarn start
# or 
pnpm start
```

### Python API Server Only
```bash
npm run start:python
# or
yarn start:python
# or
pnpm start:python
```

## Environment Variables

You can configure the following environment variables:

- `PORT`: Port for the Node.js server (default: 3000)
- `PYTHON_API_URL`: URL for the Python API server (default: http://localhost:5000)

## Architecture Overview

1. **Frontend**: JavaScript/React UI in the Next.js framework
2. **Backend**: 
   - Node.js/Express server handling API routes and serving static files
   - Python Flask API running the genetic algorithm scheduling

3. **Scheduling Logic**:
   - Initial schedule generation using graph coloring algorithm
   - Dynamic schedule adjustments using genetic algorithms

## Features

- Tournament creation with customizable parameters
- Automatic schedule generation
- Real-time schedule adjustments for disruptions
- Visualization of the tournament schedule 