# Esports Tournament Scheduler

An application for scheduling and optimizing esports tournaments using graph coloring and genetic algorithms.

## Project Structure

The project is organized into two main parts:

```
esports-scheduler/
├── backend/                # Python backend
│   ├── api/                # API endpoints
│   │   ├── scheduler_api.py  # FastAPI implementation
│   │   └── server.js      # Express server for frontend
│   ├── logs/               # Log files
│   ├── models/             # Data models
│   │   ├── models.py       # Core data models
│   │   └── tournament.py   # Tournament model
│   ├── schedulers/         # Scheduling algorithms
│   │   └── scheduler.py    # Graph coloring and genetic algorithm
│   ├── tests/              # Unit tests
│   │   └── test_optimization.py  # Performance tests
│   ├── utils/              # Utility functions
│   │   └── data_importer.py  # Data import utilities
│   ├── cli.py              # Command-line interface
│   └── main.py             # Entry point
│   
├── frontend/               # Next.js frontend
│   ├── components/         # React components
│   ├── config/             # Frontend configuration
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── tsconfig.json
│   │   └── components.json
│   ├── hooks/              # React hooks
│   ├── pages/              # Page components
│   ├── public/             # Static assets
│   ├── styles/             # CSS styles
│   ├── utils/              # Frontend utilities
│   ├── next-env.d.ts       # TypeScript declarations for Next.js
│   └── package.json        # Frontend-specific dependencies
│
├── package.json            # Main project dependencies
├── package-lock.json       # Dependency lock file
├── tsconfig.json           # Root TypeScript configuration
├── next.config.mjs         # Next.js configuration
└── requirements.txt        # Python dependencies
```

## Features

- **Graph Coloring Scheduling**: Initial scheduling using graph coloring algorithms
- **Genetic Algorithm Optimization**: Dynamic schedule optimization
- **Real-time Disruption Handling**: Adapt schedules to disruptions during the tournament

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js 16.x or higher
- npm 8.x or higher

### Setup Steps

1. Clone the repository
   ```
   git clone https://github.com/yourusername/esports-scheduler.git
   cd esports-scheduler
   ```

2. Install backend dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Install frontend dependencies:
   ```
   npm install
   ```

4. Create necessary directories:
   ```
   mkdir -p backend/logs
   ```

5. Setup environment variables (optional):
   Create a `.env` file in the root directory with the following variables:
   ```
   API_PORT=8000
   FRONTEND_PORT=3000
   DEBUG=True
   ```

6. Initialize the database (if applicable):
   ```
   python -m backend.utils.data_importer
   ```

## Usage

### Backend

Run the backend server:

```
python -m backend.main
```

### Frontend

Run the frontend development server from the project root:

```
npm run dev
```

### Optimization Testing

Run the optimization test to evaluate algorithm performance:

```
npm run test:optimization
```

This will generate a visualization of optimization metrics in `optimization_results.png`.

## Codebase Organization

### Backend Components

- **api/**: Contains API endpoints and server implementations
  - scheduler_api.py: FastAPI implementation for the scheduler API
  - server.js: Express server for the frontend

- **models/**: Contains data models and entities
  - models.py: Core data models for the scheduler
  - tournament.py: Tournament model and related functionality

- **schedulers/**: Contains scheduling algorithm implementations
  - scheduler.py: Graph coloring and genetic algorithm implementations

- **tests/**: Contains test files
  - test_optimization.py: Tests for evaluating optimization performance

- **utils/**: Contains utility functions
  - data_importer.py: Utilities for importing data

### Frontend Components

- **components/**: React components for the UI
- **config/**: Frontend configuration files
  - tailwind.config.ts: Tailwind CSS configuration
  - postcss.config.mjs: PostCSS configuration
  - tsconfig.json: TypeScript configuration for the frontend
  - components.json: UI component configuration
- **hooks/**: React hooks for state management
- **pages/**: Next.js page components
- **public/**: Static assets like images
- **styles/**: CSS and styling files
- **utils/**: Frontend utility functions

## Configuration

### Root Directory Files

These files must remain in the root directory for the frameworks to work properly:

- **package.json**: Main project dependencies and scripts - needed by npm
- **package-lock.json**: Dependency lock file - needed by npm
- **tsconfig.json**: Root TypeScript configuration - needed by TypeScript compiler
- **next.config.mjs**: Next.js configuration - needed by Next.js framework
- **requirements.txt**: Python dependencies - needed by pip

While these configuration files remain in the root directory, they reference the frontend configuration files in their new locations. For example, next.config.mjs references the Tailwind and PostCSS configs in the frontend/config directory.

### Backend Configuration

Backend configuration is managed through the Python modules in their respective directories:

- Scheduling parameters are configured in the `schedulers` modules
- API endpoints are configured in the `api` modules
- Data models are defined in the `models` modules

## Optimization Metrics

The scheduling optimization is evaluated using the following metrics:

1. **Conflict Resolution**: Eliminate team and venue conflicts
2. **Rest Period Compliance**: Ensure minimum rest periods between matches
3. **Venue Hours Compliance**: Schedule within venue operating hours
4. **Round Sequencing**: Maintain proper tournament progression
5. **Idle Time Minimization**: Reduce team waiting times
6. **Schedule Stability**: Minimize changes during disruptions

## Technologies Used

- Python 3.8+
- FastAPI and Flask
- React.js with Next.js
- TypeScript
- NetworkX (graph algorithms)
- DEAP (genetic algorithms)
- Tailwind CSS

## License

MIT
