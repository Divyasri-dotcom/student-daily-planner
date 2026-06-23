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

export async function PUT(request, { params }) {
  const body = await request.json()
  const id = Number(params.id)

  tasks = tasks.map((task) =>
    task.id === id
      ? { ...task, completed: body.completed }
      : task
  )

  return Response.json({
    message: 'Task updated',
    tasks
  })
}

export async function DELETE(request, { params }) {
  const id = Number(params.id)

  tasks = tasks.filter((task) => task.id !== id)

  return Response.json({
    message: 'Task deleted',
    tasks
  })
}
