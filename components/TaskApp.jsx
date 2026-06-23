'use client'

import { useEffect, useState } from 'react'

export default function TaskApp() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [tasks, setTasks] = useState([])
  const [taskName, setTaskName] = useState('')

  useEffect(() => {
    const savedUser = localStorage.getItem('studentUser')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
      fetchTasks()
    }
  }, [])

  async function login() {
    if (!email) {
      alert('Please enter email')
      return
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })

    const data = await res.json()
    localStorage.setItem('studentUser', JSON.stringify(data.user))
    setUser(data.user)
    fetchTasks()
  }

  function logout() {
    localStorage.removeItem('studentUser')
    setUser(null)
    setTasks([])
    setEmail('')
  }

  async function fetchTasks() {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(data.tasks)
  }

  async function addTask() {
    if (!taskName) {
      alert('Please enter task name')
      return
    }

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: taskName })
    })

    setTaskName('')
    fetchTasks()
  }

  async function toggleTask(task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed })
    })

    fetchTasks()
  }

  async function deleteTask(id) {
    await fetch(`/api/tasks/${id}`, {
      method: 'DELETE'
    })

    fetchTasks()
  }

  if (!user) {
    return (
      <main className="container">
        <h1>Student Daily Planner</h1>

        <div className="card">
          <h2>Login</h2>
          <p>Enter your email to access your student tasks.</p>

          <input
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button onClick={login}>Login</button>
        </div>

        <div className="card">
          <h2>Core Screens</h2>
          <p>Home, Login, Tasks CRUD, and About sections are included.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container">
      <h1>Student Daily Planner</h1>

      <div className="card">
        <h2>Welcome, {user.email}</h2>
        <button className="logout" onClick={logout}>Logout</button>
      </div>

      <div className="card">
        <h2>Tasks CRUD</h2>
        <p>Create, read, update, and delete your student tasks.</p>

        <input
          type="text"
          placeholder="Enter new task"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />

        <button onClick={addTask}>Add Task</button>

        {tasks.map((task) => (
          <div className="task" key={task.id}>
            <h3 className={task.completed ? 'completed' : ''}>
              {task.title}
            </h3>
            <p>Status: {task.completed ? 'Completed' : 'Pending'}</p>

            <button onClick={() => toggleTask(task)}>
              Toggle Complete
            </button>

            <button className="delete" onClick={() => deleteTask(task.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>About</h2>
        <p>
          This app helps students manage daily academic tasks.
          It includes simple authentication and one working CRUD entity.
        </p>
      </div>
    </main>
  )
}
