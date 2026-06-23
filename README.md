# Student Daily Planner

## What the App Does
Student Daily Planner is a simple web application for students to manage their daily academic tasks. The app includes basic authentication and one working CRUD entity called Tasks.

## Core Screens

### 1. Login Screen
The user can enter an email and login to the planner.

### 2. Home Screen
The app welcomes the logged-in student.

### 3. Tasks Screen
The user can create, read, update, and delete student tasks.

### 4. About Screen
This section explains the purpose of the app.

## Authentication
The app includes simple email-based authentication. The login route accepts an email and returns a user object. The frontend stores the logged-in user in localStorage.

## CRUD Entity: Tasks
The app includes one working CRUD entity called Tasks.

### Task Fields
- id
- title
- completed

### CRUD Operations
- Create task
- Read all tasks
- Update task completion status
- Delete task

## API Routes

### Authentication Route
- POST /api/auth/login

### Task Routes
- GET /api/tasks
- POST /api/tasks
- PUT /api/tasks/[id]
- DELETE /api/tasks/[id]

## Components
- components/TaskApp.jsx

## Data
The app uses sample in-memory task data inside the API routes.

## Deploy Config
The project includes a vercel.json file for deployment configuration.

## Tech Stack
- Next.js
- React
- JavaScript
- Vercel

## How to Run

```bash
npm install
npm run dev
