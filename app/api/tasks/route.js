let tasks = [
  {
    id: 1,
    title: 'Complete assignment',
    completed: false
  },
  {
    id: 2,
    title: 'Revise today subject',
    completed: false
  }
]

export async function GET() {
  return Response.json({ tasks })
}

export async function POST(request) {
  const body = await request.json()

  const newTask = {
    id: Date.now(),
    title: body.title,
    completed: false
  }

  tasks.push(newTask)

  return Response.json({
    message: 'Task created',
    task: newTask
  })
}
