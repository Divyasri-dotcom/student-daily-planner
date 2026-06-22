import './App.css'

function App() {
  return (
    <div className="app">
      <h1>Student Daily Planner</h1>
      <p>A simple app to help students manage daily tasks and study plans.</p>

      <div className="section">
        <h2>Home</h2>
        <p>Welcome to the Student Daily Planner app.</p>
      </div>

      <div className="section">
        <h2>Today's Tasks</h2>
        <ul>
          <li>Complete assignment</li>
          <li>Revise today's subject</li>
          <li>Prepare for tomorrow's class</li>
        </ul>
      </div>

      <div className="section">
        <h2>Study Plan</h2>
        <p>Plan your study time and stay organized every day.</p>
      </div>

      <div className="section">
        <h2>About</h2>
        <p>This app is created as a Day 1 runnable skeleton project.</p>
      </div>
    </div>
  )
}

export default App
